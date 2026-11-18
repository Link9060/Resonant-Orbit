'use client';

import {useEffect,useRef,type FormEvent} from 'react';
import {createPortal} from 'react-dom';

type CityChoice={name:string;latitude:number;longitude:number};

export type WeatherLocationControls={
  draft:string;
  setDraft:(value:string)=>void;
  cityDraft:string;
  setCityDraft:(value:string)=>void;
  cityResults:CityChoice[];
  loading:boolean;
  error:string;
  load:(zip:string)=>Promise<void>;
  searchCity:()=>Promise<void>;
  chooseCity:(city:CityChoice)=>void;
  useBrowserLocation:()=>void;
};

export function OrbitWeatherLocationDialog({controls,onClose}:{
  controls:WeatherLocationControls;
  onClose:()=>void;
}) {
  const ref=useRef<HTMLElement>(null);
  useEffect(()=>{
    const previouslyFocused=document.activeElement instanceof HTMLElement?document.activeElement:null;
    const oldOverflow=document.body.style.overflow;
    document.body.style.overflow='hidden';
    const frame=requestAnimationFrame(()=>ref.current?.querySelector<HTMLElement>('.orbit-weather-close')?.focus());
    const onKeydown=(event:KeyboardEvent)=>{
      if(event.key==='Escape'){event.preventDefault();event.stopPropagation();onClose();return;}
      if(event.key!=='Tab')return;
      const focusable=Array.from(ref.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled),input:not(:disabled),a[href],[tabindex]:not([tabindex="-1"])'
      )||[]);
      if(!focusable.length)return;
      const first=focusable[0],last=focusable[focusable.length-1];
      if(event.shiftKey&&(document.activeElement===first||!ref.current?.contains(document.activeElement))){
        event.preventDefault();last.focus();
      }else if(!event.shiftKey&&(document.activeElement===last||!ref.current?.contains(document.activeElement))){
        event.preventDefault();first.focus();
      }
    };
    window.addEventListener('keydown',onKeydown,true);
    return()=>{
      cancelAnimationFrame(frame);document.body.style.overflow=oldOverflow;
      window.removeEventListener('keydown',onKeydown,true);previouslyFocused?.focus({preventScroll:true});
    };
  },[onClose]);

  function submitZip(event:FormEvent<HTMLFormElement>){
    event.preventDefault();void controls.load(controls.draft);
  }
  function submitCity(event:FormEvent<HTMLFormElement>){
    event.preventDefault();void controls.searchCity();
  }
  return createPortal(
    <div className="orbit-weather-overlay" onMouseDown={event=>{if(event.target===event.currentTarget)onClose();}}>
      <section className="orbit-weather-dialog orbit-weather-location-dialog" ref={ref}
        role="dialog" aria-modal="true" aria-label="Choose a weather location">
        <header className="orbit-weather-dialog-head">
          <div><p className="orbit-weather-kicker">WEATHER / LOCATION</p><h2>Choose a location</h2></div>
          <button type="button" className="orbit-weather-close" onClick={onClose}
            aria-label="Close weather location picker">Close ×</button>
        </header>
        <div className="orbit-weather-dialog-body">
          <p className="orbit-weather-location-intro">
            Search for a city, enter a US ZIP code, or optionally share your approximate location.
            Your browser will only request location permission if you choose it.
          </p>
          <form onSubmit={submitCity} className="orbit-weather-location-form">
            <label htmlFor="weather-city-search">Find a city</label>
            <div className="orbit-weather-location-row">
              <input id="weather-city-search" aria-label="Weather city search" maxLength={90}
                value={controls.cityDraft}
                onChange={event=>controls.setCityDraft(event.target.value)}
                placeholder="City, state or region" />
              <button type="submit" disabled={controls.loading||controls.cityDraft.trim().length<2}>Search</button>
            </div>
          </form>
          {controls.cityResults.length>0&&<div role="group" aria-label="Matching weather locations"
              className="orbit-weather-location-results">
            {controls.cityResults.map(place=><button type="button" key={place.name+'-'+place.latitude+'-'+place.longitude}
              disabled={controls.loading} onClick={()=>controls.chooseCity(place)}>
              <span>{place.name}</span><span aria-hidden="true">↗</span>
            </button>)}
          </div>}
          <form onSubmit={submitZip} className="orbit-weather-location-form">
            <label htmlFor="weather-zip">US ZIP code</label>
            <div className="orbit-weather-location-row">
              <input id="weather-zip" inputMode="numeric" maxLength={5}
                value={controls.draft}
                onChange={event=>controls.setDraft(event.target.value.replace(/\D/g,''))}
                placeholder="ZIP code" aria-label="Weather ZIP code" />
              <button type="submit" disabled={controls.loading||controls.draft.length!==5}>Apply ZIP</button>
            </div>
          </form>
          <div className="orbit-weather-location-geo">
            <div>
              <strong>Use my approximate location</strong>
              <p>Optional. Permission is requested only when you select this.</p>
            </div>
            <button type="button" disabled={controls.loading} onClick={controls.useBrowserLocation}>Use location</button>
          </div>
          {controls.loading&&<p role="status" className="orbit-weather-location-status">Getting weather…</p>}
          {controls.error&&<p role="alert" className="orbit-weather-location-error">{controls.error}</p>}
        </div>
      </section>
    </div>,document.body
  );
}
