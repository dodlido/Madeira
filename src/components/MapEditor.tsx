import React, { useState } from 'react'
import { useLocalStorage } from '../hooks/useLocalStorage'
import MapView from './MapView'
import { useMapEvents } from 'react-leaflet'

type Layer = { id: string; name: string; color?: string; iconDataUrl?: string }
type Marker = { id: string; name: string; lat: number; lng: number; layerId?: string; desc?: string }

function MapClickBinder({ onClick }: { onClick: (lat: number, lng: number) => void; active: boolean }) {
  useMapEvents({ click(e) { if ((onClick) as any) onClick(e.latlng.lat, e.latlng.lng) } })
  return null
}

export default function MapEditor() {
  const [data, setData] = useLocalStorage<{ layers: Layer[]; markers: Marker[] }>('custom-map', { layers: [], markers: [] })
  const [layerName, setLayerName] = useState('')
  const [layerColor, setLayerColor] = useState('#ff5722')
  const [selectedLayer, setSelectedLayer] = useState<string | undefined>(undefined)
  const [markerName, setMarkerName] = useState('')
  const [markerDesc, setMarkerDesc] = useState('')
  const [lat, setLat] = useState('')
  const [lng, setLng] = useState('')
  const [addingByClick, setAddingByClick] = useState(false)

  function addLayer() {
    if (!layerName) return
    const id = String(Date.now())
    const l: Layer = { id, name: layerName, color: layerColor }
    setData({ ...data, layers: [...data.layers, l] })
    setLayerName('')
  }

  function handleIconUpload(e: React.ChangeEvent<HTMLInputElement>, layerId: string) {
    const f = e.target.files && e.target.files[0]
    if (!f) return
    const reader = new FileReader()
    reader.onload = () => {
      const url = String(reader.result)
      setData({ ...data, layers: data.layers.map(l => l.id === layerId ? { ...l, iconDataUrl: url } : l) })
    }
    reader.readAsDataURL(f)
  }

  function addMarker() {
    const nlat = parseFloat(lat)
    const nlng = parseFloat(lng)
    if (!markerName || Number.isNaN(nlat) || Number.isNaN(nlng)) return
    const m: Marker = { id: String(Date.now()), name: markerName, lat: nlat, lng: nlng, layerId: selectedLayer, desc: markerDesc }
    setData({ ...data, markers: [...data.markers, m] })
    setMarkerName('')
    setMarkerDesc('')
    setLat('')
    setLng('')
  }

  function onMapClick(latc: number, lngc: number) {
    if (!addingByClick) return
    setLat(String(latc))
    setLng(String(lngc))
    // auto-add marker when clicking if name provided
    if (markerName) {
      const m: Marker = { id: String(Date.now()), name: markerName, lat: latc, lng: lngc, layerId: selectedLayer, desc: markerDesc }
      setData({ ...data, markers: [...data.markers, m] })
      setMarkerName('')
      setMarkerDesc('')
    }
    setAddingByClick(false)
  }

  function removeMarker(id: string) { setData({ ...data, markers: data.markers.filter(m => m.id !== id) }) }
  function removeLayer(id: string) { setData({ layers: data.layers.filter(l => l.id !== id), markers: data.markers.filter(m => m.layerId !== id) }) }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
      <div className="col-span-2">
        <MapView geojson={null} markers={data.markers} layers={data.layers} />
        <MapClickBinder onClick={onMapClick} active={addingByClick} />
      </div>

      <aside className="space-y-4">
        <section className="bg-white p-3 rounded shadow">
          <div className="font-medium mb-2">Layers</div>
          <div className="space-y-2">
            <input className="w-full border rounded px-2 py-1 text-gray-900" placeholder="Layer name" value={layerName} onChange={e => setLayerName(e.target.value)} />
            <div className="flex gap-2">
              <input type="color" value={layerColor} onChange={e => setLayerColor(e.target.value)} className="w-12 h-8 p-0" />
              <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={addLayer}>Add layer</button>
            </div>
            <ul className="mt-2 space-y-2">
              {data.layers.map(l => (
                <li key={l.id} className="flex items-center gap-2">
                  {l.iconDataUrl ? <img src={l.iconDataUrl} alt={l.name} className="w-6 h-6 object-contain" /> : <span className="w-6 h-6 rounded-full" style={{ background: l.color }} />}
                  <div className="flex-1 text-sm">{l.name}</div>
                  <input type="file" accept="image/*" onChange={e => handleIconUpload(e, l.id)} />
                  <button className="px-2 py-1 border rounded" onClick={() => removeLayer(l.id)}>Del</button>
                </li>
              ))}
            </ul>
          </div>
        </section>

        <section className="bg-white p-3 rounded shadow">
          <div className="font-medium mb-2">Add marker</div>
          <input className="w-full border rounded px-2 py-1 mb-2 text-gray-900" placeholder="Name" value={markerName} onChange={e => setMarkerName(e.target.value)} />
          <input className="w-full border rounded px-2 py-1 mb-2 text-gray-900" placeholder="Description" value={markerDesc} onChange={e => setMarkerDesc(e.target.value)} />
          <select className="w-full border rounded px-2 py-1 mb-2" value={selectedLayer} onChange={e => setSelectedLayer(e.target.value)}>
            <option value={''}>-- Select layer --</option>
            {data.layers.map(l => <option key={l.id} value={l.id}>{l.name}</option>)}
          </select>
          <div className="grid grid-cols-2 gap-2 mb-2">
            <input className="border rounded px-2 py-1 text-gray-900" placeholder="Latitude" value={lat} onChange={e => setLat(e.target.value)} />
            <input className="border rounded px-2 py-1 text-gray-900" placeholder="Longitude" value={lng} onChange={e => setLng(e.target.value)} />
          </div>
          <div className="flex gap-2">
            <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={addMarker}>Add</button>
            <button className="px-3 py-1 border rounded" onClick={() => setAddingByClick(!addingByClick)}>{addingByClick ? 'Click mode: ON' : 'Add by map click'}</button>
          </div>

          <div className="mt-3">
            <div className="font-medium">Markers</div>
            <ul className="space-y-2 mt-2 text-sm">
              {data.markers.map(m => (
                <li key={m.id} className="flex items-center justify-between gap-2 border rounded p-2 bg-gray-50">
                  <div>
                    <div className="font-medium">{m.name}</div>
                    <div className="text-xs text-gray-500">{m.lat.toFixed(5)}, {m.lng.toFixed(5)}</div>
                  </div>
                  <div className="flex flex-col gap-1">
                    <button className="px-2 py-1 border rounded" onClick={() => removeMarker(m.id)}>Delete</button>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </section>
      </aside>
    </div>
  )
}
