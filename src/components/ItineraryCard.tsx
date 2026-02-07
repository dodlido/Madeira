import React, { useState } from 'react'
import Card from './Card'
import { useUI } from '../context/UIContext'
import { useLocalStorage } from '../hooks/useLocalStorage'
import kmlUrl from '../../resources/Madeira.kml?url'
import mdUrl from '../../resources/Madeira.md?url'

type Stop = { id: string; date: string; location: string; notes?: string }

export default function ItineraryCard() {
  const [items, setItems] = useLocalStorage<Stop[]>('itinerary', [])
  const [date, setDate] = useState('')
  const [location, setLocation] = useState('')
  const [notes, setNotes] = useState('')

  function addItem(e: React.FormEvent) {
    e.preventDefault()
    if (!date || !location) return
    const next: Stop = { id: String(Date.now()), date, location, notes }
    setItems([...items, next])
    setDate('')
    setLocation('')
    setNotes('')
  }

  async function importMadeira() {
    try {
      // fetch KML
      const kmlRes = await fetch(kmlUrl)
      if (!kmlRes.ok) throw new Error('KML not found')
      const kmlText = await kmlRes.text()
      const parser = new DOMParser()
      const xml = parser.parseFromString(kmlText, 'application/xml')

      // map folder -> placemarks
      const newStops: Stop[] = []
      const folders = Array.from(xml.querySelectorAll('Folder'))
      for (const folder of folders) {
        const dayName = folder.querySelector('name')?.textContent?.trim() || 'Day'
        const placemarks = Array.from(folder.querySelectorAll('Placemark'))
        for (const pm of placemarks) {
          const name = pm.querySelector('name')?.textContent?.trim() || 'Untitled'
          const desc = pm.querySelector('description')?.textContent?.trim() || ''
          const stop: Stop = { id: String(Date.now()) + Math.random().toString(36).slice(2), date: dayName, location: name, notes: desc }
          newStops.push(stop)
        }
      }

      // fetch markdown for summary/notes
      try {
        const mdRes = await fetch(mdUrl)
        if (mdRes.ok) {
          const md = await mdRes.text()
          if (newStops.length > 0) {
            newStops[0].notes = (newStops[0].notes ? newStops[0].notes + '\n\n' : '') + md.split('\n').slice(0,6).join('\n')
          }
        }
      } catch {}

      if (newStops.length === 0) {
        alert('No placemarks found in KML')
        return
      }

      setItems([...items, ...newStops])
      alert(`Imported ${newStops.length} stops from Madeira`)
    } catch (err) {
      console.error(err)
      alert('Import failed: ' + (err as any).message)
    }
  }

  const { showAdd } = useUI()

  // group items by date/day label
  const grouped = items.reduce<Record<string, Stop[]>>((acc, s) => {
    const key = s.date || 'Unscheduled'
    if (!acc[key]) acc[key] = []
    acc[key].push(s)
    return acc
  }, {})

  const [openDays, setOpenDays] = React.useState<Record<string, boolean>>(() => {
    const keys = Object.keys(grouped)
    const m: Record<string, boolean> = {}
    keys.forEach(k => (m[k] = true))
    return m
  })

  return (
    <Card title="Itinerary">
      {showAdd && (
        <form onSubmit={addItem} className="space-y-2">
          <input className="w-full border rounded px-2 py-1" type="date" value={date} onChange={e => setDate(e.target.value)} />
          <input className="w-full border rounded px-2 py-1" placeholder="Location" value={location} onChange={e => setLocation(e.target.value)} />
          <input className="w-full border rounded px-2 py-1" placeholder="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} />
          <div className="flex gap-2">
            <button className="bg-indigo-600 text-white px-3 py-1 rounded" type="submit">Add</button>
            <button className="px-3 py-1 rounded border" type="button" onClick={() => setItems([])}>Clear</button>
            <button className="px-3 py-1 rounded border" type="button" onClick={importMadeira}>Import Madeira</button>
          </div>
        </form>
      )}

      <div className="flex justify-end gap-2 mt-2">
        <button className="px-2 py-1 rounded border" onClick={() => setOpenDays(Object.keys(grouped).reduce((acc, k) => ({ ...acc, [k]: true }), {} as Record<string, boolean>))}>Expand All</button>
        <button className="px-2 py-1 rounded border" onClick={() => setOpenDays(Object.keys(grouped).reduce((acc, k) => ({ ...acc, [k]: false }), {} as Record<string, boolean>))}>Collapse All</button>
      </div>

      <div className="mt-3 text-sm space-y-3">
        {Object.keys(grouped).length === 0 && <div className="text-gray-600">No itinerary items.</div>}
        {Object.entries(grouped).map(([day, stops]) => (
          <div key={day} className="border rounded p-2 bg-gray-50">
            <div className="flex items-center justify-between">
              <div>
                <div className="font-medium text-violet-700">{day}</div>
                <div className="text-xs text-teal-600">{stops.length} stops</div>
              </div>
              <div>
                <button className="px-2 py-1 text-sm rounded border border-violet-200 text-violet-700 hover:bg-violet-50" onClick={() => setOpenDays(prev => ({ ...prev, [day]: !prev[day] }))}>
                  {openDays[day] ? 'Collapse' : 'Expand'}
                </button>
              </div>
            </div>
            {openDays[day] && (
              <ul className="mt-2 space-y-2">
                {stops.map(it => (
                  <li key={it.id} className="p-2 bg-white rounded shadow-sm">
                    <div className="font-medium text-green-700">{it.location}</div>
                    <div className="text-xs text-gray-500">{it.date}</div>
                    {it.notes && <div className="text-sm mt-1 text-green-900">{it.notes}</div>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </Card>
  )
}
