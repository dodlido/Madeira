import React, { useState } from 'react'
import Card from './Card'
import MapView from './MapView'
import MapEditor from './MapEditor'
import { useLocalStorage } from '../hooks/useLocalStorage'
import { useUI } from '../context/UIContext'

export default function MapsCard() {
  const [geojson, setGeojson] = useLocalStorage<any | null>('map-geojson', null)
  const [mode, setMode] = useState<'import' | 'create'>('import')
  const [kmlUrl, setKmlUrl] = useState('')
  const [error, setError] = useState<string | null>(null)

  type StyleEntry = { icon?: string; color?: string; opacity?: number }
  function kmlColorToCss(kmlColor?: string): { color?: string; opacity?: number } {
    if (!kmlColor) return {}
    const s = kmlColor.trim()
    if (!/^([0-9a-fA-F]{8})$/.test(s)) return {}
    const aabbggrr = s
    const a = aabbggrr.slice(0, 2)
    const bb = aabbggrr.slice(2, 4)
    const gg = aabbggrr.slice(4, 6)
    const rr = aabbggrr.slice(6, 8)
    const color = `#${rr}${gg}${bb}`
    const opacity = parseInt(a, 16) / 255
    return { color, opacity }
  }

  function extractMid(url: string) {
    try {
      const u = new URL(url)
      const mid = u.searchParams.get('mid')
      if (mid) return mid
      // sometimes people paste the /d/ URL; try matching
      const m = url.match(/\/d\/viewer\?mid=([^&]+)/)
      if (m) return m[1]
    } catch {}
    return null
  }

  async function handleFetch(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    const mid = extractMid(kmlUrl) || kmlUrl.trim()
    if (!mid) {
      setError('Enter a My Maps URL or map id')
      return
    }
    await fetchKmlFromMid(mid)
  }

  async function fetchKmlFromMid(mid: string) {
    setError(null)
    try {
      const kmlUrl = `https://www.google.com/maps/d/kml?mid=${mid}`
      const res = await fetch(kmlUrl)
      if (!res.ok) throw new Error(`Fetch failed: ${res.status}`)
      const text = await res.text()
      const parser = new DOMParser()
      const xml = parser.parseFromString(text, 'application/xml')

      // extract styles and folder mappings from raw KML
      const styles: Record<string, StyleEntry> = {}

      Array.from(xml.querySelectorAll('Style')).forEach(s => {
        const id = s.getAttribute('id')
        if (!id) return
        const entry: StyleEntry = {}
        const href = s.querySelector('Icon > href')?.textContent
        if (href) entry.icon = href
        const iconStyleColor = s.querySelector('IconStyle > color')?.textContent || s.querySelector('IconStyle > Icon > href')?.textContent
        const polyColor = s.querySelector('PolyStyle > color')?.textContent
        const lineColor = s.querySelector('LineStyle > color')?.textContent
        const labelColor = s.querySelector('LabelStyle > color')?.textContent
        const c = iconStyleColor || polyColor || lineColor || labelColor
        const css = kmlColorToCss(c)
        if (css.color) entry.color = css.color
        if (css.opacity !== undefined) entry.opacity = css.opacity
        styles[id] = entry
      })
      // StyleMap entries may refer to styles
      Array.from(xml.querySelectorAll('StyleMap')).forEach(sm => {
        const id = sm.getAttribute('id')
        if (!id) return
        const pair = sm.querySelector('Pair > styleUrl')?.textContent
        if (!pair) return
        const ref = pair.replace('#', '')
        if (styles[ref]) styles[id] = styles[ref]
      })

      // map placemark name -> folder name (layer)
      const placemarkToFolder: Record<string, string> = {}
      Array.from(xml.querySelectorAll('Folder')).forEach(folder => {
        const folderName = folder.querySelector('name')?.textContent || ''
        Array.from(folder.querySelectorAll('Placemark')).forEach(pm => {
          const nm = pm.querySelector('name')?.textContent
          if (nm) placemarkToFolder[nm] = folderName
        })
      })

      const mod = await import('togeojson')
      const gj = (mod as any).kml(xml)

      // attach extracted style icon urls and folder names to geojson features
      if (gj && gj.features) {
        gj.features.forEach((f: any) => {
          try {
            const name = f.properties && f.properties.name
            const styleUrl = f.properties && f.properties.styleUrl
            if (styleUrl) {
              const sid = String(styleUrl).replace('#', '')
              const s = styles[sid]
              if (s) {
                if (s.icon) f.properties._icon = s.icon
                if (s.color) f.properties._color = s.color
                if (s.opacity !== undefined) f.properties._opacity = s.opacity
              }
            }
            if (name && placemarkToFolder[name]) f.properties._layer = placemarkToFolder[name]
          } catch {}
        })
      }

      setGeojson(gj)
    } catch (err: any) {
      console.error(err)
      setError('Unable to fetch KML. CORS or network issue — try exporting KML manually and paste it below.')
    }
  }
  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files && e.target.files[0]
    if (!f) return
    const text = await f.text()
    try {
      const parser = new DOMParser()
      const xml = parser.parseFromString(text, 'application/xml')
      // extract styles and folder mappings
      const styles: Record<string, StyleEntry> = {}
      Array.from(xml.querySelectorAll('Style')).forEach(s => {
        const id = s.getAttribute('id')
        if (!id) return
        const entry: StyleEntry = {}
        const href = s.querySelector('Icon > href')?.textContent
        if (href) entry.icon = href
        const iconStyleColor = s.querySelector('IconStyle > color')?.textContent || s.querySelector('IconStyle > Icon > href')?.textContent
        const polyColor = s.querySelector('PolyStyle > color')?.textContent
        const lineColor = s.querySelector('LineStyle > color')?.textContent
        const labelColor = s.querySelector('LabelStyle > color')?.textContent
        const c = iconStyleColor || polyColor || lineColor || labelColor
        const css = kmlColorToCss(c)
        if (css.color) entry.color = css.color
        if (css.opacity !== undefined) entry.opacity = css.opacity
        styles[id] = entry
      })
      Array.from(xml.querySelectorAll('StyleMap')).forEach(sm => {
        const id = sm.getAttribute('id')
        if (!id) return
        const pair = sm.querySelector('Pair > styleUrl')?.textContent
        if (!pair) return
        const ref = pair.replace('#', '')
        if (styles[ref]) styles[id] = styles[ref]
      })

      const placemarkToFolder: Record<string, string> = {}
      Array.from(xml.querySelectorAll('Folder')).forEach(folder => {
        const folderName = folder.querySelector('name')?.textContent || ''
        Array.from(folder.querySelectorAll('Placemark')).forEach(pm => {
          const nm = pm.querySelector('name')?.textContent
          if (nm) placemarkToFolder[nm] = folderName
        })
      })

      const mod = await import('togeojson')
      const gj = (mod as any).kml(xml)
      if (gj && gj.features) {
        gj.features.forEach((f: any) => {
          try {
            const name = f.properties && f.properties.name
            const styleUrl = f.properties && f.properties.styleUrl
            if (styleUrl) {
              const sid = String(styleUrl).replace('#', '')
              const s = styles[sid]
              if (s) {
                if (s.icon) f.properties._icon = s.icon
                if (s.color) f.properties._color = s.color
                if (s.opacity !== undefined) f.properties._opacity = s.opacity
              }
            }
            if (name && placemarkToFolder[name]) f.properties._layer = placemarkToFolder[name]
          } catch {}
        })
      }
      setGeojson(gj)
      setError(null)
    } catch (err) {
      setError('Failed to parse KML file')
    }
  }

  async function handlePasteKml(e: React.FormEvent) {
    e.preventDefault()
    const form = e.target as HTMLFormElement
    const area = form.elements.namedItem('kml') as HTMLTextAreaElement
    if (!area || !area.value) return
    try {
      const parser = new DOMParser()
      const xml = parser.parseFromString(area.value, 'application/xml')
      const mod = await import('togeojson')
      const gj = (mod as any).kml(xml)
      setGeojson(gj)
      setError(null)
      area.value = ''
    } catch {
      setError('Failed to parse pasted KML')
    }
  }

  function clear() {
    setGeojson(null)
    setError(null)
    setKmlUrl('')
  }

  const { showAdd } = useUI()

  return (
    <Card title="Maps">
      <div className="space-y-2">
        {showAdd && (
          <div className="flex gap-2">
            <button className={`px-3 py-1 rounded ${mode==='create'?'bg-indigo-600 text-white':'border'}`} onClick={() => setMode('create')}>Create map</button>
            <button className={`px-3 py-1 rounded ${mode==='import'?'bg-indigo-600 text-white':'border'}`} onClick={() => setMode('import')}>Import KML</button>
          </div>
        )}

        {mode === 'import' ? (
          <>
            {showAdd && (
              <form onSubmit={handleFetch} className="flex gap-2">
                <input value={kmlUrl} onChange={e => setKmlUrl(e.target.value)} placeholder="Google My Maps URL or map id" className="flex-1 border rounded px-2 py-1" />
                <button className="bg-indigo-600 text-white px-3 py-1 rounded" type="submit">Import</button>
              </form>
            )}

            {showAdd && <div className="text-xs text-amber-100">If fetching fails due to CORS, export KML from My Maps and upload or paste it below.</div>}

            {showAdd && (
              <div className="flex items-center gap-2">
                <input type="file" accept=".kml" onChange={handleFile} />
                <button className="px-3 py-1 rounded border" onClick={clear}>Clear</button>
              </div>
            )}

            {showAdd && (
              <form onSubmit={handlePasteKml} className="space-y-2">
                <textarea name="kml" className="w-full border rounded px-2 py-1" rows={4} placeholder="Or paste KML content here"></textarea>
                <div className="flex gap-2">
                  <button className="bg-green-600 text-white px-3 py-1 rounded" type="submit">Parse pasted KML</button>
                </div>
              </form>
            )}

            {error && <div className="text-red-300 text-sm">{error}</div>}

            <div className="mt-2">
              <MapView geojson={geojson} />
            </div>
          </>
        ) : (
          <MapEditor />
        )}
        {/* Legend: list unique layers and their icons */}
        {geojson && (
          (() => {
            const map: Record<string, { icon?: string; color?: string }> = {}
            try {
              for (const f of geojson.features || []) {
                const layer = (f.properties && f.properties._layer) || 'Default'
                if (!map[layer]) map[layer] = {}
                if (f.properties) {
                  if (f.properties._icon) map[layer].icon = f.properties._icon
                  if (f.properties._color) map[layer].color = f.properties._color
                }
              }
            } catch {}
            const entries = Object.entries(map)
            if (entries.length === 0) return null
            return (
              <div className="mt-3">
                <div className="font-medium mb-1">Legend</div>
                <ul className="space-y-1">
                  {entries.map(([layer, info]) => (
                    <li key={layer} className="flex items-center gap-2">
                      {info?.color ? (
                        <div className="w-4 h-4 rounded-full" style={{ background: info.color }} />
                      ) : (
                        <div className="w-4 h-4 rounded-full bg-slate-400 inline-block" />
                      )}
                      {info?.icon && !/blank|wht/i.test(info.icon) ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={info.icon} alt={layer} className="w-5 h-5 object-contain" onError={e => (e.currentTarget.style.display = 'none')} />
                      ) : null}
                      <span className="text-sm text-amber-100">{layer}</span>
                    </li>
                  ))}
                </ul>
              </div>
            )
          })()
        )}
      </div>
    </Card>
  )
}

