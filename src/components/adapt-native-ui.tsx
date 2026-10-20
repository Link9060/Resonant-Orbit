'use client';

import { useEffect, useState, type ComponentPropsWithoutRef, type ReactNode } from 'react';
import type { DashboardWidgetId } from '@/lib/dashboard-layout';

/**
 * ARROW Adapt V: an identity decides COMPONENT COMPOSITION rather than just CSS.
 * Shared widget children retain the same account data, routes and callbacks.
 * Core returns the original header/content arrangement without extra chrome.
 */
export const ADAPT_IDENTITIES = ['core','bloom','haven','atelier','pulse'] as const;
export type AdaptIdentity = (typeof ADAPT_IDENTITIES)[number];
export type NativeWidgetLayout = 'compact' | 'standard' | 'wide' | 'expanded' | 'tall';

export function normalizeIdentity(value: unknown): AdaptIdentity {
  return typeof value === 'string' && ADAPT_IDENTITIES.includes(value as AdaptIdentity)
    ? value as AdaptIdentity : 'core';
}
export function useAdaptIdentity(): AdaptIdentity {
  const [identity, setIdentity] = useState<AdaptIdentity>('core');
  useEffect(() => {
    const root = document.documentElement;
    const sync = () => setIdentity(normalizeIdentity(root.dataset.arrowAdapt));
    sync();
    const observer = new MutationObserver(sync);
    observer.observe(root,{attributes:true,attributeFilter:['data-arrow-adapt']});
    window.addEventListener('arrow:adaptchange',sync);
    return () => {observer.disconnect();window.removeEventListener('arrow:adaptchange',sync);};
  },[]);
  return identity;
}
const MARKS: Partial<Record<DashboardWidgetId, string>> = {
  overview:'◈', tasks:'✓', calendar:'▦', weather:'☀', sun:'☼',
  askravin:'✦', ravinbrief:'✧', chats:'◇', quicknote:'✎', focus:'◷',
  quicklinks:'↗', dayprogress:'◉', countdowns:'◷', momentum:'◉',
};
export function widgetMark(id: DashboardWidgetId): string {
  return MARKS[id] || '✦';
}
const LABELS: Record<AdaptIdentity,string> = {
  core:'',bloom:'MY SPACE',haven:'FIELD NOTES',atelier:'THE PERSONAL EDITION',pulse:'CONTROL DECK',
};
export function NativeWidgetHeader({identity,id,title,subtitle,number}:{
  identity:AdaptIdentity;id:DashboardWidgetId;title:string;subtitle?:string;number?:number;
}) {
  const icon=widgetMark(id);
  switch(identity) {
    case 'bloom':return <div className="adapt-widget-top adapt-native-header native-bloom-header">
      <span className="native-bloom-icon" aria-hidden="true">{icon}</span>
      <span className="native-header-copy"><strong>{title}</strong><small>{subtitle || 'Part of your day'}</small></span>
      <span className="native-bloom-spark" aria-hidden="true">✿</span>
    </div>;
    case 'haven':return <div className="adapt-widget-top adapt-native-header native-haven-header">
      <span className="native-haven-index" aria-hidden="true">{String((number||1)).padStart(2,'0')} / {LABELS.haven}</span>
      <strong>{title}</strong>
      <span className="native-haven-rule" aria-hidden="true">❧</span>
    </div>;
    case 'atelier':return <div className="adapt-widget-top adapt-native-header native-atelier-header">
      <span className="native-atelier-index">{String(number||1).padStart(2,'0')}</span>
      <span className="native-header-copy"><small>{LABELS.atelier}</small><strong>{title}</strong></span>
      <span className="native-atelier-symbol" aria-hidden="true">{icon}</span>
    </div>;
    case 'pulse':return <div className="adapt-widget-top adapt-native-header native-pulse-header">
      <span className="native-pulse-live" aria-hidden="true"><i/>LIVE</span>
      <span className="native-header-copy"><small>{LABELS.pulse} / {String(number||1).padStart(2,'0')}</small><strong>{title}</strong></span>
      <span className="native-pulse-symbol" aria-hidden="true">{icon}</span>
    </div>;
    default:return <div className="adapt-widget-top"><strong>{title}</strong><span aria-hidden="true">{icon}</span></div>;
  }
}
type FrameProps = ComponentPropsWithoutRef<'article'> & {
  identity:AdaptIdentity;
  id:DashboardWidgetId;
  title:string;
  subtitle?:string;
  number?:number;
  layout:NativeWidgetLayout;
  editing?:boolean;
  preview?:boolean;
  children:ReactNode;
  controls?:ReactNode;
};
/** The actual widget surface, used for dashboard and real-data gallery preview. */
export function NativeWidgetFrame({
  identity,id,title,subtitle,number,layout,editing=false,preview=false,children,controls,
  className='',...articleProps
}:FrameProps) {
  return <article {...articleProps}
    className={'adapt-widget adapt-native-widget native-'+identity+' '+className}
    data-native-identity={identity} data-widget-layout={layout}
    data-native-preview={preview?'true':'false'}>
    {identity==='bloom'&&<span className="native-bloom-ornament" aria-hidden="true">✿</span>}
    {identity==='haven'&&<span className="native-haven-margin" aria-hidden="true"/>}
    {identity==='atelier'&&<span className="native-atelier-mast-rule" aria-hidden="true"/>}
    {identity==='pulse'&&<div className="native-pulse-trace" aria-hidden="true"><i/><i/><i/></div>}
    <NativeWidgetHeader identity={identity} id={id} title={title} subtitle={subtitle} number={number}/>
    <div className={'adapt-widget-content native-content-'+identity} inert={editing||preview} aria-hidden={editing||preview}>
      {children}
    </div>
    {identity==='haven'&&<span className="native-haven-footer" aria-hidden="true">ARROW / {String(number||1).padStart(2,'0')}</span>}
    {identity==='atelier'&&<span className="native-atelier-footer" aria-hidden="true">{LABELS.atelier} · {id.toUpperCase()}</span>}
    {identity==='pulse'&&<span className="native-pulse-footer" aria-hidden="true">◆ RAVIN ECOSYSTEM / {id.toUpperCase()}</span>}
    {controls}
  </article>;
}
export function NativeGalleryHeading({identity,children,subtitle}:{
  identity:AdaptIdentity;children:ReactNode;subtitle?:string;
}) {
  return <header className={'native-gallery-heading native-gallery-'+identity}>
    {identity==='bloom'&&<span aria-hidden="true" className="native-gallery-glyph">✿</span>}
    {identity==='haven'&&<span className="native-gallery-overline">THE PERSONAL COLLECTION</span>}
    {identity==='atelier'&&<span className="native-gallery-overline">ARROW / DIRECTORY 001</span>}
    {identity==='pulse'&&<span className="native-gallery-overline">SYSTEM / WIDGET DEPLOYMENT</span>}
    <h2>{children}</h2>{subtitle&&<p>{subtitle}</p>}
  </header>;
}
export function NativeGalleryRow({identity,icon,title,subtitle,active,onClick}:{
  identity:AdaptIdentity;icon:string;title:string;subtitle:string;active:boolean;onClick:()=>void;
}) {
  return <button type="button"
    className={'orbit-gallery-item native-gallery-row native-gallery-row-'+identity}
    onClick={onClick}>
    {identity==='atelier'&&<span className="native-gallery-row-index" aria-hidden="true">↗</span>}
    <span className="orbit-gallery-item-icon" aria-hidden="true">{icon}</span>
    <span><strong>{title}</strong><small>{subtitle}</small></span>
    {identity==='pulse'&&<span className="native-gallery-signal" aria-hidden="true">●</span>}
    <span className="orbit-gallery-item-tail">{active?'Edit':'+'}</span>
  </button>;
}
