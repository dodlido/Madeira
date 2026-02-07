import React, { useMemo } from 'react'
import { MapContainer, TileLayer, GeoJSON, useMap, Marker, CircleMarker, Popup } from 'react-leaflet'
import L from 'leaflet'

type CustomMarker = { id: string; name: string; lat: number; lng: number; layerId?: string; desc?: string }
type CustomLayer = { id: string; name: string; color?: string; iconDataUrl?: string }

function FitBounds({ geojson }: { geojson: any | null }) {
  const map = useMap()
  React.useEffect(() => {
    if (!geojson) return
    try {
      const layer = (window as any).L.geoJSON(geojson)
      map.fitBounds(layer.getBounds(), { padding: [20, 20] })
    } catch {}
  }, [geojson, map])
  return null
}

export default function MapView({ geojson, markers, layers }: { geojson: any | null; markers?: CustomMarker[]; layers?: CustomLayer[] }) {
  const center = useMemo(() => {
    try {
      if (geojson && geojson.features && geojson.features.length > 0) {
        const f = geojson.features[0]
        if (f.geometry && f.geometry.type === 'Point') {
          const [lng, lat] = f.geometry.coordinates
          return [lat, lng]
        }
      }
    } catch {}
    // Default center: Madeira
    return [32.75, -16.95]
  }, [geojson])

  return (
    <MapContainer center={center as [number, number]} zoom={12} style={{ height: 320, width: '100%' }}>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {geojson && (
        <GeoJSON
          data={geojson}
          style={(feature: any) => {
            const p = feature.properties || {}
            const c = p._color || '#2563eb'
            const opacity = p._opacity !== undefined ? p._opacity : 0.6
            return { color: c, fillColor: c, fillOpacity: opacity }
          }}
          pointToLayer={(feature: any, latlng) => {
            const props = feature.properties || {}
            // prefer color if provided (many My Maps icons are white blanks tinted by Google)
            if (props._color) {
              const color = props._color as string
              const opacity = props._opacity !== undefined ? props._opacity : 0.9
              return L.circleMarker(latlng, { radius: 7, fillColor: color, color: color, weight: 1, fillOpacity: opacity })
            }
            if (props._icon) {
              try {
                const icon = L.icon({ iconUrl: props._icon, iconSize: [28, 28], iconAnchor: [14, 28], popupAnchor: [0, -28] })
                return L.marker(latlng, { icon })
              } catch {}
            }
            return L.circleMarker(latlng, { radius: 6, fillColor: '#2563eb', color: '#1e40af', weight: 1, fillOpacity: 0.9 })
          }}
          onEachFeature={(feature: any, layer: any) => {
            try {
              const p = feature.properties || {}
              let html = '<div>'
              if (p.name) html += `<div style="font-weight:600">${p.name}</div>`
              if (p.description) html += `<div>${p.description}</div>`
              if (p._layer) html += `<div style="font-size:11px;color:#6b7280">${p._layer}</div>`
              html += '</div>'
              layer.bindPopup(html)
            } catch {}
          }}
        />
      )}
      {/* render custom markers (from MapEditor) */}
      {markers && markers.map(m => {
        const layer = layers?.find(l => l.id === m.layerId)
        const position = [m.lat, m.lng] as [number, number]
        if (layer && layer.iconDataUrl) {
          const icon = L.icon({ iconUrl: layer.iconDataUrl, iconSize: [28, 28], iconAnchor: [14, 28], popupAnchor: [0, -28] })
          return (
            <Marker key={m.id} position={position} icon={icon}>
              <Popup>
                <div style={{ fontWeight: 600 }}>{m.name}</div>
                <div>{m.desc || ''}</div>
              </Popup>
            </Marker>
          )
        }
        const c = layer?.color || '#2563eb'
        return (
          <CircleMarker key={m.id} center={position} pathOptions={{ color: c, fillColor: c }} radius={6}>
            <Popup>
              <div style={{ fontWeight: 600 }}>{m.name}</div>
              <div>{m.desc || ''}</div>
            </Popup>
          </CircleMarker>
        )
      })}
      <FitBounds geojson={geojson} />
    </MapContainer>
  )
}
