import React from 'react'
import ItineraryCard from './components/ItineraryCard'
import FlightsCard from './components/FlightsCard'
import WeatherCard from './components/WeatherCard'
import MapsCard from './components/MapsCard'
import BudgetCard from './components/BudgetCard'
import AccommodationsCard from './components/AccommodationsCard'
import { useUI } from './context/UIContext'


export default function App() {
  // Refs to trigger preset actions in cards
  const itineraryRef = React.useRef<{ loadMadeira?: () => void }>(null)
  const mapsRef = React.useRef<{ loadMadeira?: () => void }>(null)
  const weatherRef = React.useRef<{ loadMadeira?: () => void }>(null)
  const flightsRef = React.useRef<{ loadMadeira?: () => void }>(null)
  const { showAdd, setShowAdd } = useUI()
  const [headline, setHeadline] = React.useState('Madeira Trip')
  const [subheadline, setSubheadline] = React.useState('Lior and Etay Present')

  async function handleMadeiraPreset() {
    itineraryRef.current?.loadMadeira?.()
    mapsRef.current?.loadMadeira?.()
    weatherRef.current?.loadMadeira?.()
    flightsRef.current?.loadMadeira?.()
    // Load headlines from preset
    try {
      const res = await fetch('/madeira/headlines.json')
      if (res.ok) {
        const data = await res.json()
        if (data.headline) setHeadline(data.headline)
        if (data.subheadline) setSubheadline(data.subheadline)
      }
    } catch {}
  }

  return (
    <div className="min-h-screen p-6">
      <div className="app-container">
        <header className="mb-6 flex items-center justify-between">
          <div>
            {showAdd ? (
              <>
                <input
                  className="text-sm text-amber-100 bg-transparent border-b border-amber-200 focus:outline-none focus:border-amber-400 mb-1"
                  value={subheadline}
                  onChange={e => setSubheadline(e.target.value)}
                  aria-label="Subheadline"
                  style={{ width: Math.max(12, subheadline.length) + 'ch' }}
                />
                <input
                  className="block text-3xl md:text-4xl font-bold text-white drop-shadow bg-transparent border-b border-white focus:outline-none focus:border-amber-400"
                  value={headline}
                  onChange={e => setHeadline(e.target.value)}
                  aria-label="Headline"
                  style={{ width: Math.max(12, headline.length) + 'ch' }}
                />
              </>
            ) : (
              <>
                <div className="text-sm text-amber-100">{subheadline}</div>
                <h1 className="text-3xl md:text-4xl font-bold text-white drop-shadow">{headline}</h1>
              </>
            )}
          </div>
          <div className="flex items-center gap-3">
            <button
              className="px-2 py-1 rounded bg-amber-400 text-xs font-semibold text-slate-900 shadow hover:bg-amber-300 border border-amber-300"
              style={{ fontSize: '0.85rem' }}
              onClick={handleMadeiraPreset}
              type="button"
              title="Load Madeira preset itinerary, map, weather, and flights"
            >
              Madeira preset
            </button>
            <label className="flex items-center gap-2 text-sm text-white">
              <input type="checkbox" checked={showAdd} onChange={e => setShowAdd(e.target.checked)} />
              Show add controls
            </label>
          </div>
        </header>

        <main className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <ItineraryCard ref={itineraryRef} />
          <MapsCard ref={mapsRef} />
          <AccommodationsCard />
          <FlightsCard ref={flightsRef} />
          <WeatherCard ref={weatherRef} />
          <BudgetCard />
        </main>
      </div>
    </div>
  )
}
