'use client';

import { useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';

export type WeatherSnapshot = {
  temp:number;
  hi:number;
  lo:number;
  precip:number;
  sunrise:string;
  sunset:string;
  unit:string;
  location:string;
  apparent:number;
  humidity:number;
  wind:number;
  uv:number;
  code:number;
  hourly:{ time:string; temp:number; rain:number; code:number }[];
  days:{ date:string; hi:number; lo:number; rain:number; uv:number; code:number }[];
};

function condition(code:number) {
  if (code===0) return 'Clear';
  if (code<=3) return 'Partly cloudy';
  if (code<=48) return 'Fog';
  if (code<=57) return 'Drizzle';
  if (code<=67) return 'Rain';
  if (code<=77) return 'Snow';
  if (code<=82) return 'Showers';
  if (code<=86) return 'Snow showers';
  if (code<=99) return 'Thunderstorms';
  return 'Conditions unavailable';
}

function hourLabel(time:string) {
  const hour=Number(time.slice(11,13));
  if (!Number.isFinite(hour)) return time;
  return (hour%12||12)+(hour<12?' AM':' PM');
}
function dayLabel(time:string) {
  const [year,month,day]=time.split('-').map(Number);
  if(!year||!month||!day) return time;
  return new Date(year,month-1,day,12).toLocaleDateString('en-US',{weekday:'short',month:'short',day:'numeric'});
}
function solar(time:string) {return time ? hourLabel(time) : 'Unavailable';}

export function OrbitWeatherDetails({forecast,onClose}:{forecast:WeatherSnapshot;onClose:()=>void}) {
  const ref=useRef<HTMLElement>(null);
  useEffect(()=>{
    const previouslyFocused=document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const previousOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    const frame=requestAnimationFrame(()=>ref.current?.querySelector<HTMLButtonElement>('.orbit-weather-close')?.focus());
    const onKeyDown=(event:KeyboardEvent)=>{
      if(event.key==='Escape') {event.preventDefault();event.stopPropagation();onClose();return;}
      if(event.key!=='Tab') return;
      const choices=Array.from(ref.current?.querySelectorAll<HTMLElement>('button:not(:disabled),a[href],input:not(:disabled),[tabindex]:not([tabindex="-1"])')||[]);
      if(!choices.length)return;
      const first=choices[0],last=choices[choices.length-1];
      if(event.shiftKey && (document.activeElement===first||!ref.current?.contains(document.activeElement))) {event.preventDefault();last.focus();}
      if(!event.shiftKey && (document.activeElement===last||!ref.current?.contains(document.activeElement))) {event.preventDefault();first.focus();}
    };
    window.addEventListener('keydown',onKeyDown,true);
    return ()=>{
      cancelAnimationFrame(frame);
      document.body.style.overflow=previousOverflow;
      window.removeEventListener('keydown',onKeyDown,true);
      previouslyFocused?.focus({preventScroll:true});
    };
  },[onClose]);

  return createPortal(<div className="orbit-weather-overlay" onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}}>
    <section ref={ref} className="orbit-weather-dialog" role="dialog" aria-modal="true" aria-label={'Detailed weather forecast for '+forecast.location}>
      <header className="orbit-weather-dialog-head">
        <div><p className="orbit-weather-kicker">WEATHER / LOCAL FORECAST</p><h2>{forecast.location}</h2></div>
        <button className="orbit-weather-close" type="button" onClick={onClose} aria-label="Close detailed forecast">Close ×</button>
      </header>
      <div className="orbit-weather-dialog-body">
        <section className="orbit-weather-now">
          <div><strong>{Math.round(forecast.temp)}°</strong><p>{condition(forecast.code)} · H {Math.round(forecast.hi)}° / L {Math.round(forecast.lo)}°</p></div>
          <span className="orbit-weather-range">Rain chance {Math.round(forecast.precip)}%</span>
        </section>
        <section aria-label="Current conditions" className="orbit-weather-facts">
          <div><span>Feels like</span><strong>{Math.round(forecast.apparent)}°</strong></div>
          <div><span>Humidity</span><strong>{Math.round(forecast.humidity)}%</strong></div>
          <div><span>Wind</span><strong>{Math.round(forecast.wind)} mph</strong></div>
          <div><span>UV high</span><strong>{Math.round(forecast.uv)}</strong></div>
          <div><span>Sunrise</span><strong>{solar(forecast.sunrise)}</strong></div>
          <div><span>Sunset</span><strong>{solar(forecast.sunset)}</strong></div>
        </section>
        <section className="orbit-weather-section" aria-label="Next 12 hours">
          <h3>Next 12 hours</h3>
          <div className="orbit-weather-hours">
            {forecast.hourly.map((item,index)=><div className="orbit-weather-hour" key={item.time+'-'+index}>
              <span>{hourLabel(item.time)}</span>
              <strong>{Math.round(item.temp)}°</strong>
              <small>{condition(item.code)}</small>
              <span>Rain {Math.round(item.rain)}%</span>
            </div>)}
            {!forecast.hourly.length&&<p>Hourly forecast is unavailable.</p>}
          </div>
        </section>
        <section className="orbit-weather-section" aria-label="Seven-day forecast">
          <h3>Seven-day forecast</h3>
          <div className="orbit-weather-days">
            {forecast.days.map((item,index)=><div className="orbit-weather-day" key={item.date+'-'+index}>
              <strong>{dayLabel(item.date)}</strong>
              <span>{condition(item.code)}</span>
              <small>Rain {Math.round(item.rain)}%</small>
              <b>L {Math.round(item.lo)}° · H {Math.round(item.hi)}°</b>
            </div>)}
            {!forecast.days.length&&<p>Daily forecast is unavailable.</p>}
          </div>
        </section>
        <p className="orbit-weather-provider">Forecast data: Open-Meteo. Times refer to the forecast location.</p>
      </div>
    </section>
  </div>,document.body);
}
