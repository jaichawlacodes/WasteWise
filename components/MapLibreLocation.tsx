"use client";

import { useEffect, useRef, useState } from "react";
import * as maplibregl from "maplibre-gl";
import type { Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

export interface LocationResult {
  address: string;
  latitude: number;
  longitude: number;
}

interface MapLibreLocationProps {
  value: string;
  onChange: (result: LocationResult | null) => void;
}

export default function MapLibreLocation({ value, onChange }: MapLibreLocationProps) {
  const mapContainer = useRef<HTMLDivElement | null>(null);
  const map = useRef<MapLibreMap | null>(null);
  const [query, setQuery] = useState(value);
  const [results, setResults] = useState<LocationResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => setQuery(value), [value]);

  useEffect(() => {
    if (!mapContainer.current || map.current) return;

    try {
      map.current = new maplibregl.Map({
        container: mapContainer.current,
        style: {
          version: 8,
          sources: {
            osm: {
              type: "raster",
              tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
              tileSize: 256,
              attribution: "© OpenStreetMap contributors",
            },
          },
          layers: [{ id: "osm", type: "raster", source: "osm" }],
        },
        center: [77.5946, 12.9716],
        zoom: 4,
      });
      map.current.addControl(new maplibregl.NavigationControl(), "top-right");
    } catch {
      setError("Map unavailable. You can still enter a location manually.");
    }

    return () => {
      map.current?.remove();
      map.current = null;
    };
  }, []);

  useEffect(() => {
    if (!query.trim() || query.trim() === value.trim()) {
      setResults([]);
      return;
    }

    const controller = new AbortController();
    const timeout = window.setTimeout(async () => {
      setLoading(true);
      setError("");
      try {
        const response = await fetch(`/api/geocode?q=${encodeURIComponent(query)}`, { signal: controller.signal });
        const payload = await response.json();
        if (!response.ok) throw new Error(payload.error ?? "Geocoding unavailable");
        setResults(payload.results ?? []);
      } catch (requestError) {
        if ((requestError as Error).name !== "AbortError") {
          setResults([]);
          setError("Autocomplete unavailable. You can still enter a location manually.");
        }
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, 350);

    return () => {
      window.clearTimeout(timeout);
      controller.abort();
    };
  }, [query, value]);

  const selectResult = (result: LocationResult) => {
    setQuery(result.address);
    setResults([]);
    onChange(result);
    map.current?.flyTo({ center: [result.longitude, result.latitude], zoom: 13, essential: true });
    new maplibregl.Marker().setLngLat([result.longitude, result.latitude]).addTo(map.current!);
  };

  return (
    <div className="space-y-3">
      <div className="relative">
        <input
          type="text"
          id="location"
          name="location"
          value={query}
          onChange={(event) => {
            setQuery(event.target.value);
            onChange(null);
          }}
          required
          className="w-full px-4 py-2 border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-green-500 transition-all duration-300"
          placeholder="Enter waste location"
        />
        {(loading || results.length > 0) && (
          <div className="absolute left-0 right-0 top-full z-20 mt-1 rounded-md border bg-white shadow-lg">
            {loading && <p className="p-3 text-sm text-gray-500">Searching...</p>}
            {results.map((result) => (
              <button
                type="button"
                key={`${result.latitude}-${result.longitude}`}
                onClick={() => selectResult(result)}
                className="block w-full px-3 py-2 text-left text-sm hover:bg-gray-50"
              >
                {result.address}
              </button>
            ))}
          </div>
        )}
      </div>
      {error && <p className="text-sm text-amber-700">{error}</p>}
      <div ref={mapContainer} className="h-48 w-full overflow-hidden rounded-xl border border-gray-200" aria-label="Location map" />
    </div>
  );
}
