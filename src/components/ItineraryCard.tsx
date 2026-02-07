import React, { useState, useEffect } from 'react'
import Card from './Card'
import { useUI } from '../context/UIContext'
import { useLocalStorage } from '../hooks/useLocalStorage'

type Stop = { id: string; date: string; location: string; notes?: string }

const ItineraryCard = React.forwardRef(function ItineraryCard(props, ref) {
  const [items, setItems] = useLocalStorage<Stop[]>('itinerary', [])
    // Auto-import Madeira itinerary on mount if not already imported
    useEffect(() => {
      if (!items || items.length === 0) {
        importPresetItinerary('/madeira/Madeira.md')
      }
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [])
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

  async function importPresetItinerary(mdPath: string) {
    try {
      const mdRes = await fetch(mdPath)
      if (!mdRes.ok) throw new Error(mdPath + ' not found')
      const md = await mdRes.text()
      const days = md.split(/## Day [0-9]+:/).slice(1)
      const newStops: Stop[] = []
      days.forEach((dayBlock, i) => {
        const lines = dayBlock.split('\n')
        const dayTitle = (lines[0] || `Day ${i+1}`).replace(/\*+/g, '').trim()
        let currentDay = dayTitle
        let lastStop: Stop | null = null
        for (let j = 1; j < lines.length; j++) {
          const line = lines[j]
          if (/^-[^\S\r\n]/.test(line)) {
            const stopName = line.replace(/^- /, '').trim()
            lastStop = { id: String(Date.now()) + Math.random().toString(36).slice(2), date: currentDay, location: stopName, notes: '' }
            newStops.push(lastStop)
          } else if (/^\s+- /.test(line) && lastStop) {
            lastStop.notes = line.replace(/^\s+- /, '').trim()
          }
        }
      })
      if (newStops.length === 0) {
        // No stops found, do nothing
        return
      }
      setItems([...items, ...newStops])
    } catch (err) {
      console.error(err)
      // Optionally handle import failure silently
    }
  }

  // List all .md files in public/madeira/ for presets
  const [presetFiles, setPresetFiles] = React.useState<string[]>([])
  const [showPresetMenu, setShowPresetMenu] = React.useState(false)
  React.useEffect(() => {
    // Hardcoded for now, could be fetched from an API or manifest
    setPresetFiles(['/madeira/Madeira.md'])
  }, [])

  // Expose loadMadeira for preset button
  React.useImperativeHandle(ref, () => ({
    loadMadeira: async () => {
      setItems([])
      setTimeout(() => importPresetItinerary('/madeira/Madeira.md'), 0)
    }
  }))

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
    keys.forEach(k => (m[k] = false))
    return m
  })

  return (
    <Card title="Itinerary">
      {showAdd && (
        <form onSubmit={addItem} className="space-y-2">
          <input className="w-full border rounded px-2 py-1 text-gray-900" type="date" value={date} onChange={e => setDate(e.target.value)} />
          <input className="w-full border rounded px-2 py-1 text-gray-900" placeholder="Location" value={location} onChange={e => setLocation(e.target.value)} />
          <input className="w-full border rounded px-2 py-1 text-gray-900" placeholder="Notes (optional)" value={notes} onChange={e => setNotes(e.target.value)} />
          <div className="flex gap-2">
            <button className="bg-indigo-600 text-white px-3 py-1 rounded" type="submit">Add</button>
            <button className="px-3 py-1 rounded border" type="button" onClick={() => setItems([])}>Clear</button>
            <button className="px-3 py-1 rounded border" type="button" onClick={() => setShowPresetMenu(v => !v)}>Preset Itinerary</button>
            {showPresetMenu && (
              <div className="absolute z-10 bg-white border rounded shadow p-2 mt-1">
                {presetFiles.map(f => (
                  <button key={f} className="block w-full text-left px-2 py-1 hover:bg-indigo-100" type="button" onClick={() => { setItems([]); importPresetItinerary(f); setShowPresetMenu(false); }}>{f.replace('/madeira/', '').replace('.md', '')}</button>
                ))}
              </div>
            )}
          </div>
        </form>
      )}

      <div className="flex justify-end gap-2 mt-2">
        <button className="px-2 py-1 rounded border" onClick={() => setOpenDays(Object.keys(grouped).reduce((acc, k) => ({ ...acc, [k]: true }), {} as Record<string, boolean>))}>Expand All</button>
        <button className="px-2 py-1 rounded border" onClick={() => setOpenDays(Object.keys(grouped).reduce((acc, k) => ({ ...acc, [k]: false }), {} as Record<string, boolean>))}>Collapse All</button>
      </div>

      <div className="mt-3 text-sm space-y-3">
        {Object.keys(grouped).length === 0 && <div className="text-gray-600">No itinerary items.</div>}
        {Object.entries(grouped).map(([day, stops], idx) => (
          <div key={day} className="border rounded p-2 bg-gray-50">
            <div className="flex items-center justify-between mb-1">
              <div>
                <div className="text-xs text-violet-500 font-bold uppercase tracking-wide">Day {idx + 1}</div>
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
                    {it.notes ? (
                      <div className="text-sm mt-1 text-green-900">{it.notes}</div>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ))}
      </div>
    </Card>
  )
})
export default ItineraryCard
