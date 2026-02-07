import React, { useState } from 'react'
import Card from './Card'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { useUI } from '../context/UIContext'

type DailyForecast = {
  time: string[]
  temperature_2m_max: number[]
  temperature_2m_min: number[]
  weathercode?: number[]
}

function weatherEmoji(code?: number) {
  if (code === undefined || code === null) return '🌤️'
  if (code === 0) return '☀️'
  if (code === 1 || code === 2 || code === 3) return '🌤️'
  if (code === 45 || code === 48) return '🌫️'
  if (code >= 51 && code <= 67) return '🌦️'
  if (code >= 71 && code <= 77) return '❄️'
  if (code >= 80 && code <= 82) return '🌧️'
  if (code >= 95 && code <= 99) return '⛈️'
  return '🌤️'
}

type LocationWeather = {
  id: string
  name: string
  lat: number
  lon: number
  daily?: DailyForecast
  error?: string
}

export default function WeatherCard() {
  const [locations, setLocations] = useLocalStorage<LocationWeather[]>('weather-places', [])
  const [input, setInput] = useState('')
  const [loading, setLoading] = useState(false)
  const { showAdd } = useUI()

  async function add(e: React.FormEvent) {
    e.preventDefault()
    if (!input) return
    setLoading(true)
    try {
      // Geocode using Open-Meteo geocoding API
      const gRes = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(input)}&count=1`)
      const gJson = await gRes.json()
      if (!gJson || !gJson.results || gJson.results.length === 0) {
        setLocations([...locations, { id: String(Date.now()), name: input, lat: 0, lon: 0, error: 'Location not found' }])
        setInput('')
        return
      }

      const r = gJson.results[0]
      const lat = r.latitude
      const lon = r.longitude

      // Fetch 7-day daily forecasts (max/min + weathercode)
      const fRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto`)
      const fJson = await fRes.json()

      const daily: DailyForecast | undefined = fJson && fJson.daily ? {
        time: fJson.daily.time || [],
        temperature_2m_max: fJson.daily.temperature_2m_max || [],
        temperature_2m_min: fJson.daily.temperature_2m_min || [],
        weathercode: fJson.daily.weathercode || [],
      } : undefined

      setLocations([...locations, { id: String(Date.now()), name: r.name + (r.country ? `, ${r.country}` : ''), lat, lon, daily }])
      setInput('')
    } catch (err) {
      setLocations([...locations, { id: String(Date.now()), name: input, lat: 0, lon: 0, error: 'Fetch error' }])
      setInput('')
    } finally {
      setLoading(false)
    }
  }

  async function refresh(place: LocationWeather) {
    try {
      const fRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${place.lat}&longitude=${place.lon}&daily=temperature_2m_max,temperature_2m_min,weathercode&timezone=auto`)
      const fJson = await fRes.json()
      const daily: DailyForecast | undefined = fJson && fJson.daily ? {
        time: fJson.daily.time || [],
        temperature_2m_max: fJson.daily.temperature_2m_max || [],
        temperature_2m_min: fJson.daily.temperature_2m_min || [],
        weathercode: fJson.daily.weathercode || [],
      } : undefined
      setLocations(locations.map(l => l.id === place.id ? { ...l, daily, error: undefined } : l))
    } catch {
      setLocations(locations.map(l => l.id === place.id ? { ...l, error: 'Refresh failed' } : l))
    }
  }

  function remove(id: string) {
    setLocations(locations.filter(l => l.id !== id))
  }

  return (
    <Card title="Weather">
      {showAdd && (
        <form onSubmit={add} className="flex gap-2">
          <input className="flex-1 border rounded px-2 py-1 text-gray-900" placeholder="City or location (e.g. Madeira, Portugal)" value={input} onChange={e => setInput(e.target.value)} />
          <button className="bg-teal-600 hover:bg-teal-700 text-white px-3 py-1 rounded" type="submit" disabled={loading}>{loading ? 'Adding...' : 'Add'}</button>
        </form>
      )}

      <ul className="mt-3 text-sm space-y-3">
        {locations.length === 0 && <li className="text-gray-600">No locations added.</li>}
        {locations.map(l => (
          <li key={l.id} className="border rounded p-2 bg-gray-50">
            <div className="flex justify-between items-start">
              <div>
                <div className="font-medium">{l.name}</div>
                <div className="text-xs text-gray-500">{l.lat}, {l.lon}</div>
              </div>
              <div className="flex gap-2">
                <button className="px-2 py-1 text-sm rounded border border-teal-200 text-teal-700 hover:bg-teal-50" onClick={() => refresh(l)}>Refresh</button>
                <button className="px-2 py-1 text-sm rounded border border-red-200 text-red-600 hover:bg-red-50" onClick={() => remove(l.id)}>Delete</button>
              </div>
            </div>

            {l.error && <div className="text-red-600 text-sm mt-2">{l.error}</div>}

            {l.daily ? (
              <div className="mt-2 grid grid-cols-2 gap-2">
                {l.daily.time.map((t, i) => {
                  const code = l.daily?.weathercode ? l.daily.weathercode[i] : undefined
                  const emoji = weatherEmoji(code)
                  return (
                    <div key={t} className="p-2 bg-white rounded shadow-sm flex items-center gap-3">
                      <div className="text-2xl">{emoji}</div>
                      <div>
                        <div className="text-xs text-gray-500">{t}</div>
                        <div className="font-medium text-amber-600">Max: {l.daily!.temperature_2m_max[i]}°C</div>
                        <div className="text-sm text-sky-600">Min: {l.daily!.temperature_2m_min[i]}°C</div>
                      </div>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="text-gray-600 text-sm mt-2">Forecast not available.</div>
            )}
          </li>
        ))}
      </ul>
    </Card>
  )
}
