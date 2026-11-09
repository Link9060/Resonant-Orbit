'use client';

import { useEffect, useState, type FormEvent } from 'react';

type Place = { name: string; latitude: number; longitude: number };
type Forecast = {
  current?: { time?: string; temperature_2m?: number; apparent_temperature?: number; relative_humidity_2m?: number; precipitation?: number; weather_code?: number; wind_speed_10m?: number };
  hourly?: { time?: string[]; temperature_2m?: number[]; precipitation_probability?: number[]; weather_code?: number[] };
  daily?: { time?: string[]; weather_code?: number[]; temperature_2m_max?: number[]; temperature_2m_min?: number[]; sunrise?: string[]; sunset?: string[]; uv_index_max?: number[]; precipitation_probability_max?: number[] };
};

const WEATHER_PLACE_KEY = 'arrow_orbit_weather_place_v1';

function condition(code?: number): string {
  if (code === undefined) return 'Forecast';
  if (code === 0) return 'Clear';
  if (code <= 3) return 'Partly cloudy';
  if (code === 45 || code === 48) return 'Foggy';
  if (code <= 57) return 'Drizzle';
  if (code <= 67) return 'Rain';
  if (code <= 77) return 'Snow';
  if (code <= 82) return 'Rain showers';
  if (code <= 86) return 'Snow showers';
  if (code >= 95) return 'Thunderstorms';
  return 'Cloudy';
}
function temp(value?: number): string {
  return Number.isFinite(value) ? Math.round(value as number) + '°' : '–';
}
function hour(iso?: string): string {
  if (!iso) return '–';
  const value = new Date(iso);
  return Number.isNaN(value.getTime()) ? '–' : value.toLocaleTimeString(undefined, { hour: 'numeric', minute: iso.includes(':') && !iso.endsWith(':00') ? '2-digit' : undefined });
}
function day(iso: string, index: number): string {
  if (index === 0) return 'Today';
  return new Date(iso + 'T12:00:00').toLocaleDateString(undefined, { weekday: 'short' });
}

export function WeatherWidget() {
  const [query, setQuery] = useState('');
  const [place, setPlace] = useState<Place | null>(null);
  const [forecast, setForecast] = useState<Forecast | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState(false);

  async function load(next: Place) {
    setLoading(true);
    setError('');
    try {
      const url = new URL('https://api.open-meteo.com/v1/forecast');
      url.search = new URLSearchParams({
        latitude: String(next.latitude),
        longitude: String(next.longitude),
        current: 'temperature_2m,apparent_temperature,relative_humidity_2m,precipitation,weather_code,wind_speed_10m',
        hourly: 'temperature_2m,precipitation_probability,weather_code',
        daily: 'weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset,uv_index_max,precipitation_probability_max',
        temperature_unit: 'fahrenheit', wind_speed_unit: 'mph', timezone: 'auto', forecast_days: '7',
      }).toString();
      const response = await fetch(url.toString());
      if (!response.ok) throw new Error('Forecast is unavailable.');
      const data = await response.json() as Forecast;
      if (!data.current || !data.daily?.time?.length) throw new Error('No forecast was returned.');
      setPlace(next);
      setForecast(data);
      try { localStorage.setItem(WEATHER_PLACE_KEY, JSON.stringify(next)); } catch {}
    } catch {
      setError('Weather is unavailable right now. Try another location or check your connection.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(WEATHER_PLACE_KEY) || 'null') as Place | null;
      if (saved && typeof saved.name === 'string' && Number.isFinite(saved.latitude) && Number.isFinite(saved.longitude)) {
        setQuery(saved.name);
        void load(saved);
      }
    } catch {}
  }, []);

  useEffect(() => {
    if (!expanded) return;
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setExpanded(false);
    };
    window.addEventListener('keydown', close);
    return () => window.removeEventListener('keydown', close);
  }, [expanded]);

  async function searchPlace(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!query.trim()) return;
    setLoading(true);
    setError('');
    try {
      const response = await fetch('https://geocoding-api.open-meteo.com/v1/search?' + new URLSearchParams({ name: query.trim(), count: '1', language: 'en', format: 'json' }));
      if (!response.ok) throw new Error('Location search failed.');
      const result = await response.json() as { results?: Array<{ name: string; admin1?: string; country?: string; latitude: number; longitude: number }> };
      const found = result.results?.[0];
      if (!found) { setError('No matching location. Try a nearby city.'); setLoading(false); return; }
      await load({ name: [found.name, found.admin1 || found.country].filter(Boolean).join(', '), latitude: found.latitude, longitude: found.longitude });
    } catch {
      setError('Could not find that location. Try again.');
      setLoading(false);
    }
  }

  function useLocation() {
    if (!navigator.geolocation) { setError('Location is not available in this browser. Search for a city instead.'); return; }
    setLoading(true);
    setError('');
    navigator.geolocation.getCurrentPosition(
      position => { void load({ name: 'Current location', latitude: position.coords.latitude, longitude: position.coords.longitude }); },
      () => { setLoading(false); setError('Location was not shared. You can still search by city.'); },
      { timeout: 10000, maximumAge: 15 * 60 * 1000 },
    );
  }

  const current = forecast?.current;
  const daily = forecast?.daily;
  const hourly = forecast?.hourly;
  const startIndex = Math.max(0, hourly?.time?.findIndex(iso => iso >= (current?.time || '').slice(0,13)) ?? 0);
  const hourlyItems = (hourly?.time || []).slice(startIndex, startIndex + 12);

  return <div className="adapt-weather">
    {current && place ? (
      <>
        <button type="button" className="adapt-weather-summary" onClick={() => setExpanded(true)} aria-label={'Open detailed weather forecast for ' + place.name}>
          <span><small>{place.name}</small><strong>{temp(current.temperature_2m)}</strong><span>{condition(current.weather_code)} · Feels like {temp(current.apparent_temperature)}</span></span>
          <span className="adapt-weather-open" aria-hidden="true">Details ↗</span>
        </button>
        <div className="adapt-weather-range">High {temp(daily?.temperature_2m_max?.[0])} · Low {temp(daily?.temperature_2m_min?.[0])}<span>Updated {hour(current.time)}</span></div>
      </>
    ) : <p className="adapt-weather-empty">Get your local forecast, hourly outlook, and next seven days.</p>}
    <form className="adapt-weather-search" onSubmit={searchPlace}>
      <label className="sr-only" htmlFor="adapt-weather-city">City or town</label>
      <input id="adapt-weather-city" value={query} onChange={event => setQuery(event.target.value)} placeholder="Search city or town" autoComplete="address-level2" />
      <button type="submit" disabled={loading || !query.trim()}>Search</button>
    </form>
    <button className="adapt-weather-location" type="button" onClick={useLocation} disabled={loading}>Use my location</button>
    {loading && <p className="adapt-weather-status" role="status">Updating forecast…</p>}
    {error && <p className="adapt-weather-error" role="status">{error}</p>}

    {expanded && current && place && daily && (
      <div className="adapt-weather-overlay" onMouseDown={event => { if (event.target === event.currentTarget) setExpanded(false); }}>
        <section className="adapt-weather-detail" role="dialog" aria-modal="true" aria-labelledby="adapt-weather-heading">
          <header className="adapt-weather-detail-header">
            <div><small>WEATHER / {place.name.toUpperCase()}</small><h2 id="adapt-weather-heading">{temp(current.temperature_2m)} <span>{condition(current.weather_code)}</span></h2><p>High {temp(daily.temperature_2m_max?.[0])} · Low {temp(daily.temperature_2m_min?.[0])}</p></div>
            <button type="button" onClick={() => setExpanded(false)} aria-label="Close weather details">✕</button>
          </header>
          <section className="adapt-weather-detail-card" aria-label="Hourly forecast">
            <h3>Next 12 hours</h3>
            <div className="adapt-weather-hourly">{hourlyItems.map((iso,i) => {
              const index = startIndex + i;
              return <div key={iso}><small>{i === 0 ? 'Now' : hour(iso)}</small><strong>{temp(hourly?.temperature_2m?.[index])}</strong><span>{condition(hourly?.weather_code?.[index])}</span><small>{hourly?.precipitation_probability?.[index] ?? 0}% rain</small></div>;
            })}</div>
          </section>
          <section className="adapt-weather-detail-card" aria-label="Seven day forecast">
            <h3>Seven-day forecast</h3>
            <div className="adapt-weather-days">{(daily.time || []).map((iso,i) => <div key={iso}><strong>{day(iso,i)}</strong><span>{condition(daily.weather_code?.[i])}</span><small>{daily.precipitation_probability_max?.[i] ?? 0}% rain</small><span>{temp(daily.temperature_2m_min?.[i])} <b>{temp(daily.temperature_2m_max?.[i])}</b></span></div>)}</div>
          </section>
          <div className="adapt-weather-facts">
            <section className="adapt-weather-detail-card"><h3>Feels like</h3><strong>{temp(current.apparent_temperature)}</strong></section>
            <section className="adapt-weather-detail-card"><h3>Wind</h3><strong>{Math.round(current.wind_speed_10m ?? 0)} mph</strong></section>
            <section className="adapt-weather-detail-card"><h3>Humidity</h3><strong>{Math.round(current.relative_humidity_2m ?? 0)}%</strong></section>
            <section className="adapt-weather-detail-card"><h3>UV index</h3><strong>{daily.uv_index_max?.[0]?.toFixed(1) ?? '–'}</strong></section>
            <section className="adapt-weather-detail-card"><h3>Sunrise</h3><strong>{hour(daily.sunrise?.[0])}</strong></section>
            <section className="adapt-weather-detail-card"><h3>Sunset</h3><strong>{hour(daily.sunset?.[0])}</strong></section>
          </div>
          <p className="adapt-weather-credit">Forecast data: Open-Meteo. Values are estimates and may change.</p>
        </section>
      </div>
    )}
  </div>;
}
