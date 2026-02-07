import React, { useState } from 'react'
import Card from './Card'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { useUI } from '../context/UIContext'

type Flight = {
  id: string
  airline: string
  flightNumber: string
  from: string
  to: string
  depart: string
  arrive: string
  flightIata?: string
  departTZ?: string
  arriveTZ?: string
}

  

export default function FlightsCard() {
  const [flights, setFlights] = useLocalStorage<Flight[]>('flights', [])

  // Manual entry fields
  const [airline, setAirline] = useState('')
  const [flightNumber, setFlightNumber] = useState('')
  const [from, setFrom] = useState('')
  const [to, setTo] = useState('')
  const [depart, setDepart] = useState('')
  const [arrive, setArrive] = useState('')

  // Lookup fields
  const [lookupAirlineCode, setLookupAirlineCode] = useState('') // IATA code e.g. "TP"
  const [lookupNumber, setLookupNumber] = useState('')
  const [lookupLoading, setLookupLoading] = useState(false)
  const [refreshLoading, setRefreshLoading] = useState(false)
  const apiKey = import.meta.env.VITE_AVIATIONSTACK_KEY
  const { showAdd } = useUI()

  function addFlight(e: React.FormEvent) {
    e.preventDefault()
    if (!airline || !flightNumber) return
    const next: Flight = { id: String(Date.now()), airline, flightNumber, from, to, depart, arrive }
    setFlights([...flights, next])
    setAirline('')
    setFlightNumber('')
    setFrom('')
    setTo('')
    setDepart('')
    setArrive('')
  }

  async function lookup(e?: React.FormEvent) {
    if (e) e.preventDefault()
    if (!lookupAirlineCode || !lookupNumber) return
    if (!apiKey) {
      // No API key provided: inform user to add one (no network call)
      alert('No Aviationstack API key found. Add VITE_AVIATIONSTACK_KEY to .env to enable lookups.')
      return
    }

    setLookupLoading(true)
    try {
      const flightIata = `${lookupAirlineCode}${lookupNumber}`
      const url = `http://api.aviationstack.com/v1/flights?access_key=${apiKey}&flight_iata=${encodeURIComponent(flightIata)}`
      const res = await fetch(url)
      const json = await res.json()

      // aviationstack returns `data` array
      if (!json || !json.data || json.data.length === 0) {
        alert('No data found for that flight.')
        return
      }

      // Map returned flights into our Flight type, skip duplicates
      const mapped: Flight[] = json.data.map((d: any) => ({
        id: String(Date.now()) + Math.random().toString(36).slice(2),
        airline: d.airline?.name || lookupAirlineCode,
        flightNumber: d.flight?.number || lookupNumber,
        from: d.departure?.airport || d.departure?.iata || '—',
        to: d.arrival?.airport || d.arrival?.iata || '—',
        depart: d.departure?.scheduled || d.departure?.estimated || '',
        arrive: d.arrival?.scheduled || d.arrival?.estimated || '',
        departTZ: d.departure?.timezone || undefined,
        arriveTZ: d.arrival?.timezone || undefined,
        flightIata: d.flight?.iata || flightIata,
      }))

      // Filter out items that already exist (by airline+flightNumber)
      const existingKeys = new Set(flights.map(f => `${normalize(f.airline)}|${normalize(f.flightNumber)}`))
      const nonDup = mapped.filter(m => !existingKeys.has(`${normalize(m.airline)}|${normalize(m.flightNumber)}`))
      if (nonDup.length === 0) {
        // nothing new
      } else {
        setFlights([...flights, ...nonDup])
      }
      setLookupAirlineCode('')
      setLookupNumber('')
    } catch (err) {
      console.error(err)
      alert('Lookup failed. See console for details.')
    } finally {
      setLookupLoading(false)
    }
  }

  function clearAll() {
    setFlights([])
  }

  function normalize(s: string | undefined) {
    if (!s) return ''
    return s.toLowerCase().replace(/\s+/g, '')
  }

  function dedupe() {
    const seen = new Set<string>()
    const unique: Flight[] = []
    for (const f of flights) {
      const key = `${normalize(f.airline)}|${normalize(f.flightNumber)}`
      if (!seen.has(key)) {
        seen.add(key)
        unique.push(f)
      }
    }
    setFlights(unique)
  }

  async function refreshAll() {
    if (!apiKey) {
      alert('No Aviationstack API key found. Add VITE_AVIATIONSTACK_KEY to .env to enable refresh.')
      return
    }
    if (!flights || flights.length === 0) return
    setRefreshLoading(true)
    try {
      const updated = await Promise.all(flights.map(async f => {
        try {
          if (!f.flightIata) return f
          const url = `http://api.aviationstack.com/v1/flights?access_key=${apiKey}&flight_iata=${encodeURIComponent(f.flightIata)}`
          const res = await fetch(url)
          const json = await res.json()
          if (!json || !json.data || json.data.length === 0) return f
          const d = json.data[0]
          return {
            ...f,
            airline: d.airline?.name || f.airline,
            flightNumber: d.flight?.number || f.flightNumber,
            from: d.departure?.airport || d.departure?.iata || f.from,
            to: d.arrival?.airport || d.arrival?.iata || f.to,
            depart: d.departure?.scheduled || d.departure?.estimated || f.depart,
            arrive: d.arrival?.scheduled || d.arrival?.estimated || f.arrive,
            departTZ: d.departure?.timezone || f.departTZ,
            arriveTZ: d.arrival?.timezone || f.arriveTZ,
            flightIata: d.flight?.iata || f.flightIata,
          }
        } catch (err) {
          console.error('refresh error for', f, err)
          return f
        }
      }))
      setFlights(updated)
    } finally {
      setRefreshLoading(false)
    }
  }

  return (
    <Card title="Flights">
      <div className="space-y-3">
        {showAdd && (
          <>
            <form onSubmit={lookup} className="flex gap-2 items-center">
              <input className="w-20 border rounded px-2 py-1" placeholder="IATA" value={lookupAirlineCode} onChange={e => setLookupAirlineCode(e.target.value.toUpperCase())} />
              <input className="flex-1 border rounded px-2 py-1" placeholder="Flight # (e.g. 123)" value={lookupNumber} onChange={e => setLookupNumber(e.target.value)} />
              <button className="bg-green-600 text-white px-3 py-1 rounded" type="submit" disabled={lookupLoading}>{lookupLoading ? 'Searching...' : 'Lookup'}</button>
              <button className="px-3 py-1 rounded border" type="button" onClick={refreshAll} disabled={refreshLoading}>{refreshLoading ? 'Refreshing...' : 'Refresh'}</button>
            </form>

            <div className="text-xs text-gray-500">Tip: use airline IATA code (e.g. TP for TAP Air Portugal).</div>

            <form onSubmit={addFlight} className="space-y-2">
              <input className="w-full border rounded px-2 py-1" placeholder="Airline" value={airline} onChange={e => setAirline(e.target.value)} />
              <input className="w-full border rounded px-2 py-1" placeholder="Flight #" value={flightNumber} onChange={e => setFlightNumber(e.target.value)} />
              <div className="grid grid-cols-2 gap-2">
                <input className="border rounded px-2 py-1" placeholder="From" value={from} onChange={e => setFrom(e.target.value)} />
                <input className="border rounded px-2 py-1" placeholder="To" value={to} onChange={e => setTo(e.target.value)} />
              </div>
              <div className="grid grid-cols-2 gap-2">
                <input className="border rounded px-2 py-1" type="datetime-local" value={depart} onChange={e => setDepart(e.target.value)} />
                <input className="border rounded px-2 py-1" type="datetime-local" value={arrive} onChange={e => setArrive(e.target.value)} />
              </div>
              <div className="flex gap-2">
                <button className="bg-indigo-600 text-white px-3 py-1 rounded" type="submit">Add</button>
                <button className="px-3 py-1 rounded border" type="button" onClick={clearAll}>Clear</button>
                <button className="px-3 py-1 rounded border" type="button" onClick={dedupe}>Remove duplicates</button>
              </div>
            </form>
          </>
        )}
      </div>

      <ul className="mt-3 space-y-2 text-sm">
        {flights.length === 0 && <li className="text-gray-600">No flights.</li>}
        {flights.map(f => (
          <li key={f.id} className="border rounded p-2 bg-gray-50">
            <div className="font-medium text-teal-700">{f.airline} {f.flightNumber}</div>
            <div className="text-xs text-violet-600">{f.from} → {f.to}</div>
            <div className="text-sm text-teal-600">Depart: {formatFlightDate(f.depart, f.arriveTZ)}</div>
            <div className="text-sm text-teal-600">Arrive: {formatFlightDate(f.arrive, f.arriveTZ)}</div>
          </li>
        ))}
      </ul>
    </Card>
  )
}

function formatFlightDate(value?: string, targetTZ?: string) {
  if (!value) return '—'
  try {
    const d = new Date(value)
    if (isNaN(d.getTime())) return value

    const dateFmt = new Intl.DateTimeFormat(undefined as any, { day: '2-digit', month: '2-digit', timeZone: targetTZ })
    const timeFmt = new Intl.DateTimeFormat(undefined as any, { hour: '2-digit', minute: '2-digit', hour12: false, timeZone: targetTZ })
    const datePart = dateFmt.format(d)
    const timePart = timeFmt.format(d)
    return `${datePart}, ${timePart}`
  } catch {
    return value
  }
}

