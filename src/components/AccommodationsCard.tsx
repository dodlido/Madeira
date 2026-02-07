import React, { useState } from 'react'
import Card from './Card'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { useUI } from '../context/UIContext'

type Stay = { id: string; name: string; address?: string; checkin?: string; checkout?: string; notes?: string }
type BudgetItem = { id: string; desc: string; amount: number }

export default function AccommodationsCard() {
  const [stays, setStays] = useLocalStorage<Stay[]>('accommodations', [])
  const [budgetItems, setBudgetItems] = useLocalStorage<BudgetItem[]>('budget', [])
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [checkin, setCheckin] = useState('')
  const [checkout, setCheckout] = useState('')
  const [notes, setNotes] = useState('')
  const { showAdd } = useUI()

  function add(e: React.FormEvent) {
    e.preventDefault()
    if (!name) return
    const next: Stay = { id: String(Date.now()), name, address, checkin, checkout, notes }
    // dedupe by name + dates
    const exists = stays.some(s => s.name === next.name && s.checkin === next.checkin && s.checkout === next.checkout)
    if (!exists) setStays([...stays, next])
    setName('')
    setAddress('')
    setCheckin('')
    setCheckout('')
    setNotes('')
  }

  function remove(id: string) {
    setStays(stays.filter(s => s.id !== id))
  }

  // Helpers for .eml parsing
  function b64DecodeUnicode(str: string) {
    try {
      // atob -> percent-encoding -> decodeURIComponent for UTF-8
      return decodeURIComponent(Array.prototype.map.call(atob(str.replace(/\r?\n/g, '')), function (c: any) {
        return '%' + ('00' + c.charCodeAt(0).toString(16)).slice(-2)
      }).join(''))
    } catch {
      try { return atob(str) } catch { return str }
    }
  }

  function extractPlainFromEml(eml: string) {
    // Find text/plain part (base64) and decode
    const contentTypeIdx = eml.search(/Content-Type:\s*text\/plain/i)
    if (contentTypeIdx === -1) return ''
    // slice from that point to next boundary (a line starting with --_)
    const slice = eml.slice(contentTypeIdx)
    // find the first blank line after the headers
    const afterHeaders = slice.replace(/\r/g, '').split('\n\n')
    if (afterHeaders.length < 2) return ''
    const bodyAndMore = afterHeaders.slice(1).join('\n\n')
    // body is up to the next boundary line
    const boundaryMatch = bodyAndMore.match(/--_[-\w]+/)
    const body = boundaryMatch ? bodyAndMore.slice(0, boundaryMatch.index) : bodyAndMore
    // body may be base64; try to detect base64 chars
    const trimmed = body.trim()
    // if looks like base64
    if (/^[A-Za-z0-9+/=\s]+$/.test(trimmed.slice(0, 200))) {
      return b64DecodeUnicode(trimmed)
    }
    return trimmed
  }

  function parseDatesFromText(txt: string) {
    // Look for lines like: Check-in Tuesday, 23 June 2026 (from 16:00)
    const ci = txt.match(/Check[- ]?in[^\n\r]*?(\d{1,2}\s+\w+\s+\d{4})(?:[^\d\n\r]*(?:from)\s*([0-2]?\d:[0-5]\d))?/i)
    const co = txt.match(/Check[- ]?out[^\n\r]*?(\d{1,2}\s+\w+\s+\d{4})(?:[^\d\n\r]*(?:until)\s*([0-2]?\d:[0-5]\d))?/i)
    function toISO(dateStr?: string) {
      if (!dateStr) return undefined
      const d = new Date(dateStr)
      if (isNaN(d.getTime())) return undefined
      return d.toISOString().slice(0, 10)
    }
    return { checkin: toISO(ci && ci[1] ? ci[1] : undefined), checkout: toISO(co && co[1] ? co[1] : undefined) }
  }

  function parseAddressFromText(txt: string) {
    // try to find a 'Location' heading then following non-empty lines
    const locIdx = txt.search(/\bLocation\b/i)
    if (locIdx !== -1) {
      const slice = txt.slice(locIdx)
      const lines = slice.split(/\r?\n/).map(s => s.trim()).filter(Boolean)
      if (lines.length >= 2) return lines[1]
    }
    // fallback: find a line with number + street + comma
    const addr = txt.match(/\d{1,4}[^\n\r]{5,100},\s*[^\n\r]{2,60}/)
    return addr ? addr[0].trim() : undefined
  }

  function parseHotelNameFromEml(eml: string, txt: string) {
    // First try headers Reply-To: "Hotel name"
    const headerMatch = eml.match(/Reply-To:\s*"([^"]+)"/i)
    if (headerMatch) return headerMatch[1].trim()
    // look for 'Hotel' lines in plain text
    const m = txt.match(/Hotel\s+[A-Z0-9\-\w\s\'\,\-]{3,80}/i)
    if (m) return m[0].trim()
    // fallback to first line with 'Reservation' nearby
    const res = txt.match(/Reservation details[\s\S]{0,120}?\n\s*(.+)/i)
    if (res) return res[1].trim()
    return undefined
  }

  function parsePriceFromText(txt: string) {
    // Prefer explicit euro amounts
    try {
      const euroMatches = Array.from(txt.matchAll(/€\s*([0-9]+[.,][0-9]{2})/g)).map(m => parseFloat(m[1].replace(',', '.')))
      if (euroMatches.length > 0) {
        // prefer the largest euro amount (likely the total)
        return Math.max(...euroMatches)
      }

      // Look for labeled totals like 'Total price' or 'Total'
      const labeled = txt.match(/(?:Total price|Total|Pay(?:ment)?|Price)[^0-9\n\r]{0,80}?([0-9]+[.,][0-9]{2})/i)
      if (labeled) return parseFloat(labeled[1].replace(',', '.'))

      // As a fallback, find all decimal numbers and pick the largest (total is usually largest)
      const all = Array.from(txt.matchAll(/([0-9]+[.,][0-9]{2})/g)).map(m => parseFloat(m[1].replace(',', '.')))
      if (all.length > 0) return Math.max(...all)
    } catch {}
    return undefined
  }

  function extractBookingConfirmation(plain: string) {
    const idx = plain.search(/Booking\.com/i)
    if (idx === -1) return undefined
    const slice = plain.slice(idx)
    const lines = slice.split(/\r?\n/).map(s => s.trim()).filter(Boolean)
    const confIdx = lines.findIndex(l => /Confirmation/i.test(l))
    if (confIdx !== -1) {
      const res = lines.slice(confIdx, confIdx + 3)
      return res.join(' • ')
    }
    return lines.slice(0, 3).join(' • ')
  }

  async function handleEmlFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files && e.target.files[0]
    if (!f) return
    const txt = await f.text()
    const plain = extractPlainFromEml(txt) || txt
    const hotel = parseHotelNameFromEml(txt, plain) || name
    const addr = parseAddressFromText(plain) || address
    const { checkin: ci, checkout: co } = parseDatesFromText(plain)
    const price = parsePriceFromText(plain)

    if (!hotel) {
      alert('Could not parse hotel name from this email.')
      return
    }

    const bookingNotes = extractBookingConfirmation(plain) || ''
    const stay: Stay = { id: String(Date.now()), name: hotel, address: addr, checkin: ci, checkout: co, notes: bookingNotes }
    const exists = stays.some(s => s.name === stay.name && s.checkin === stay.checkin && s.checkout === stay.checkout)
    if (!exists) setStays([...stays, stay])

    if (price && !Number.isNaN(price)) {
      const desc = `Hotel: ${hotel}`
      const existsBudget = budgetItems.some(b => b.desc === desc && Math.abs(b.amount - price) < 0.01)
      if (!existsBudget) setBudgetItems([...budgetItems, { id: String(Date.now()) + '-b', desc, amount: price }])
    }

    alert(`Imported stay${exists ? ' (duplicate skipped)' : ''}${price ? ` and price ${price.toFixed(2)}` : ''}`)
    // reset file input
    e.target.value = '' as any
  }

  return (
    <Card title="Accommodations">
      {showAdd && (
        <form onSubmit={add} className="space-y-2">
          <input className="w-full border rounded px-2 py-1 text-gray-900" placeholder="Name (hotel / apt)" value={name} onChange={e => setName(e.target.value)} />
          <input className="w-full border rounded px-2 py-1 text-gray-900" placeholder="Address" value={address} onChange={e => setAddress(e.target.value)} />
          <div className="grid grid-cols-2 gap-2">
            <input className="border rounded px-2 py-1 text-gray-900" type="date" value={checkin} onChange={e => setCheckin(e.target.value)} />
            <input className="border rounded px-2 py-1 text-gray-900" type="date" value={checkout} onChange={e => setCheckout(e.target.value)} />
          </div>
          <input className="w-full border rounded px-2 py-1 text-gray-900" placeholder="Notes" value={notes} onChange={e => setNotes(e.target.value)} />
          <div className="flex gap-2">
            <button className="bg-indigo-600 text-white px-3 py-1 rounded" type="submit">Add</button>
            <button className="px-3 py-1 rounded border" type="button" onClick={() => setStays([])}>Clear</button>
            <label className="px-3 py-1 rounded border cursor-pointer bg-white/5">
              Import .eml
              <input accept=".eml" type="file" onChange={handleEmlFile} className="hidden" />
            </label>
          </div>
        </form>
      )}

      <div className="mt-3 text-sm">
        {stays.length === 0 && <div className="text-teal-600">No accommodations added.</div>}
        <ul className="mt-2 space-y-2">
          {stays.map(s => (
            <li key={s.id} className="border rounded p-2 bg-gray-50">
              <div className="font-medium text-teal-700">{s.name}</div>
              {s.address && <div className="text-xs text-violet-600">{s.address}</div>}
              <div className="text-sm text-teal-600">{s.checkin ? `Check-in: ${s.checkin}` : ''} {s.checkout ? ` • Check-out: ${s.checkout}` : ''}</div>
              {s.notes && <div className="text-sm mt-1 text-teal-600">{s.notes}</div>}
              <div className="mt-2">
                <button className="px-2 py-1 rounded border border-red-200 text-red-600" onClick={() => remove(s.id)}>Remove</button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </Card>
  )
}

