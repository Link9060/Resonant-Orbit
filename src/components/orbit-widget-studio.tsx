'use client';

import { useMemo, useState, type CSSProperties, type ReactNode } from 'react';
import {
  DASHBOARD_SIZE_PRESETS, type DashboardWidgetId, type DashboardWidgetPreference,
  type DashboardWidgetSize,
} from '@/lib/dashboard-layout';
import {
  GRID_COLUMNS, packDashboard, placementFits, placeWidget, autoPlaceWidget,
  highlightedCells, gridRows, type GridPoint,
} from '@/lib/orbit-widget-grid';

type SizeName = Exclude<DashboardWidgetSize, 'custom'>;
type Meta = Record<DashboardWidgetId, { title: string; subtitle: string }>;
type WidgetGroup = 'Recommended' | 'Productivity' | 'Communication' | 'Utilities';
const GROUPS: Record<WidgetGroup, DashboardWidgetId[]> = {
  Recommended: ['tasks', 'askravin', 'calendar', 'weather', 'quicknote'],
  Productivity: ['overview', 'tasks', 'calendar', 'today', 'focus', 'dayprogress', 'assignments', 'schoolschedule', 'momentum', 'countdowns'],
  Communication: ['chats', 'askravin', 'ravinbrief', 'quicknote'],
  Utilities: ['weather', 'sun', 'quicklinks'],
};
const SIZES: SizeName[] = ['extra-small', 'small', 'medium', 'wide', 'large', 'extra-wide', 'tall'];
const COLORS: Partial<Record<DashboardWidgetId, string>> = {
  weather: '☀', tasks: '✓', calendar: '▦', askravin: '✦', chats: '◇', quicknote: '✎',
  focus: '◷', overview: '◈', sun: '☀', quicklinks: '↗', dayprogress: '◉', countdowns: '◷',
};
type Pick = { id: DashboardWidgetId; size: SizeName; moving: boolean };
export function OrbitWidgetStudio({
  widgets, meta, editing, onChange, onEdit, disabled, renderWidget, extra,
}: {
  widgets: DashboardWidgetPreference[];
  meta: Meta;
  editing: boolean;
  onChange: (layout: DashboardWidgetPreference[]) => void;
  onEdit: (editing: boolean) => void;
  disabled: boolean;
  renderWidget: (id: DashboardWidgetId) => ReactNode;
  extra: ReactNode;
}) {
  const [gallery, setGallery] = useState(false);
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState<WidgetGroup>('Recommended');
  const [preview, setPreview] = useState<Pick | null>(null);
  const [placing, setPlacing] = useState<Pick | null>(null);
  const [hover, setHover] = useState<GridPoint | null>(null);
  const [hint, setHint] = useState('Choose an empty space to place your widget.');
  const packed = useMemo(() => packDashboard(widgets), [widgets]);
  const visible = packed.filter(w => w.visible);
  const boardRows = editing ? Math.max(gridRows(widgets), placing ? (hover?.y ?? 0) + DASHBOARD_SIZE_PRESETS[placing.size].rows + 4 : 12) : Math.max(1, ...visible.map(w => w.y + w.rows));
  const selected = placing ? DASHBOARD_SIZE_PRESETS[placing.size] : null;
  const tiles = useMemo(() => placing && selected ? highlightedCells(packed, placing.id, hover, selected.cols, selected.rows) : null,
    [packed, placing, hover, selected]);
  const library = useMemo(() => {
    const set = new Set(GROUPS[category]);
    const all = Object.keys(meta) as DashboardWidgetId[];
    return (query.trim() ? all : all.filter(id => set.has(id)))
      .filter(id => widgets.some(w => w.id === id))
      .filter(id => (meta[id].title + ' ' + meta[id].subtitle).toLowerCase().includes(query.toLowerCase()));
  }, [category, meta, query, widgets]);

  const chooseWidget = (id: DashboardWidgetId) => {
    const prior = packed.find(w => w.id === id);
    const available = SIZES.find(s => DASHBOARD_SIZE_PRESETS[s].cols === prior?.cols && DASHBOARD_SIZE_PRESETS[s].rows === prior?.rows);
    setPreview({ id, size: available || 'medium', moving: Boolean(prior?.visible) });
    setGallery(true);
    setPlacing(null); setHover(null);
  };
  const startPlacing = (value: Pick) => {
    setPreview(null); setGallery(false); setPlacing(value); setHover(null);
    setHint('Hover over the grid: green cells are available; red cells are blocked. Tap a green region to place.');
    onEdit(true);
  };
  const commit = (point: GridPoint, candidate = placing) => {
    if (!candidate) return;
    const size = DASHBOARD_SIZE_PRESETS[candidate.size];
    if (!placementFits(packed, candidate.id, point, size.cols, size.rows)) {
      setHint('That area is blocked. Choose another green region.');
      setHover(point); return;
    }
    const result = placeWidget(packed, candidate.id, point, size.cols, size.rows);
    if (!result) return;
    onChange(result.map(item => item.id === candidate.id ? { ...item, size:candidate.size } : item));
    setPlacing(null); setHover(null); setHint(meta[candidate.id].title + ' placed successfully.');
  };
  const automatic = (candidate: Pick) => {
    const size = DASHBOARD_SIZE_PRESETS[candidate.size];
    const result = autoPlaceWidget(packed, candidate.id, size.cols, size.rows);
    if (result) {
      onChange(result.map(item => item.id === candidate.id ? { ...item, size:candidate.size } : item));
      setHint(meta[candidate.id].title + ' added at the first available location.');
      setPreview(null); setGallery(false); setPlacing(null); setHover(null);
    } else setHint('No room available. Hide or resize a widget.');
  };
  const remove = (id: DashboardWidgetId) => {
    onChange(widgets.map(item => item.id === id ? { ...item, visible:false, x:undefined, y:undefined } : item));
    if (placing?.id === id) setPlacing(null);
    setHint(meta[id].title + ' removed from dashboard. You can re-add it from the gallery.');
  };
  const boardStyle = { '--orbit-grid-rows':boardRows } as CSSProperties;
  const currentPreview = preview ? DASHBOARD_SIZE_PRESETS[preview.size] : null;

  return <>
    {editing && <div className="orbit-studio-toolbar">
      <div><strong>Arrange your space</strong><span>Drag widgets or choose Move. Place only on open cells.</span></div>
      <div className="orbit-studio-toolbar-actions">
        <button type="button" onClick={() => { setGallery(true); setPlacing(null); }} disabled={disabled}>+ Add Widgets</button>
        <button type="button" onClick={() => { onEdit(false); setPlacing(null); setGallery(false); setPreview(null); }}>Done</button>
      </div>
    </div>}
    {editing && <div className="orbit-placement-status" role="status">
      <span className="orbit-legend-green"/><span>Available</span>
      <span className="orbit-legend-red"/><span>Blocked</span>
      <strong>{placing ? 'Placing ' + meta[placing.id].title : hint}</strong>
      {placing && <button type="button" onClick={() => { setPlacing(null); setHover(null); }}>Cancel placement</button>}
    </div>}
    <div className={'orbit-grid-scroller' + (editing ? ' is-editing' : '')}>
      <div className={'orbit-widget-board' + (editing ? ' is-editing' : '') + (placing ? ' is-placing' : '')}
        style={boardStyle}
        onDragOver={event => { if (editing) event.preventDefault(); }}
      >
        {editing && Array.from({ length:boardRows * GRID_COLUMNS }, (_, index) => {
          const x=index%GRID_COLUMNS, y=Math.floor(index/GRID_COLUMNS), key=x+':'+y;
          const active=placing && hover && x>=hover.x && x<hover.x+DASHBOARD_SIZE_PRESETS[placing.size].cols &&
            y>=hover.y && y<hover.y+DASHBOARD_SIZE_PRESETS[placing.size].rows;
          const state=active ? tiles?.red.has(key) ? 'blocked' : 'available' : 'neutral';
          return <button key={key} type="button"
            className={'orbit-grid-cell is-' + state}
            style={{ gridColumn:x+1,gridRow:y+1 }}
            aria-label={'Column '+(x+1)+', row '+(y+1)+(state==='blocked'?', blocked':'')}
            tabIndex={placing ? 0 : -1} aria-hidden={!placing}
            onPointerEnter={() => { if (placing) setHover({x,y}); }}
            onFocus={() => { if (placing) setHover({x,y}); }}
            onClick={() => { if (placing) commit({x,y}); }}
            onDragOver={event => {
              if (!editing) return;
              event.preventDefault();
              if (placing) setHover({x,y});
            }}
            onDrop={event => {
              event.preventDefault();
              const id=event.dataTransfer.getData('text/plain') as DashboardWidgetId;
              const existing=packed.find(w=>w.id===id && w.visible);
              if (!existing) return;
              const size=SIZES.find(s=>DASHBOARD_SIZE_PRESETS[s].cols===existing.cols && DASHBOARD_SIZE_PRESETS[s].rows===existing.rows) || 'medium';
              const candidate={id,size,moving:true};
              const point={x,y};
              const next=placeWidget(packed,id,point,existing.cols,existing.rows);
              if(next) { onChange(next);setHint(meta[id].title+' moved.');setPlacing(null);setHover(null); }
              else { setHint('Blocked. Move to green squares.');setPlacing(candidate);setHover(point); }
            }}
          />;
        })}
        {visible.map(item => <article key={item.id} className="adapt-widget orbit-positioned-widget"
          style={{ gridColumn:(item.x+1)+' / span '+item.cols,gridRow:(item.y+1)+' / span '+item.rows, '--orbit-widget-column':(item.x+1)+' / span '+item.cols,'--orbit-widget-row':(item.y+1)+' / span '+item.rows } as CSSProperties}
          draggable={editing && !placing}
          onDragStart={event => { if (editing) event.dataTransfer.setData('text/plain',item.id); }}
        >
          <div className="adapt-widget-top"><strong>{meta[item.id].title}</strong><span aria-hidden="true">{COLORS[item.id] || '✦'}</span></div>
          {editing ? <>
            <p className="adapt-widget-desc">{item.cols} × {item.rows} cells</p>
            <div className="orbit-widget-edit-actions">
              <button type="button" onClick={() => {
                const size=SIZES.find(s=>DASHBOARD_SIZE_PRESETS[s].cols===item.cols && DASHBOARD_SIZE_PRESETS[s].rows===item.rows) || 'medium';
                startPlacing({id:item.id,size,moving:true});
              }}>Move</button>
              <button type="button" onClick={() => chooseWidget(item.id)}>Resize</button>
              <button type="button" aria-label={'Remove '+meta[item.id].title} onClick={() => remove(item.id)}>−</button>
            </div>
          </> : <div className="adapt-widget-content">{renderWidget(item.id)}</div>}
        </article>)}
      </div>
    </div>
    {!visible.length && !editing && <div className="orbit-empty-studio"><strong>Your dashboard is a blank canvas.</strong><p>Choose Customize, then Add Widgets to create your first layout.</p></div>}
    {editing && extra}
    {editing && gallery && <div className="orbit-widget-gallery-backdrop" onMouseDown={event => { if (event.target === event.currentTarget) {setGallery(false);setPreview(null);} }}>
      <section className="orbit-widget-gallery" role="dialog" aria-modal="true" aria-label="Add ARROW widgets">
        <div className="orbit-gallery-header"><div><small>ARROW WIDGET GALLERY</small><h2>Add Widgets</h2></div><button type="button" onClick={() => {setGallery(false);setPreview(null);}} aria-label="Close widget gallery">×</button></div>
        {!preview ? <>
          <label className="orbit-gallery-search"><span>Search widgets</span><input autoFocus value={query} onChange={e=>setQuery(e.target.value)} placeholder="Search tasks, weather, RAVIN…" /></label>
          <div className="orbit-gallery-categories" role="group" aria-label="Widget categories">
            {(Object.keys(GROUPS) as WidgetGroup[]).map(name=><button type="button" aria-pressed={category===name} key={name} onClick={()=>setCategory(name)}>{name}</button>)}
          </div>
          <p className="orbit-gallery-section-caption">{query ? 'Search results' : category==='Recommended' ? 'Suggested for your dashboard' : category}</p>
          <div className="orbit-gallery-items">
            {library.map(id => {
              const active=widgets.find(w=>w.id===id)?.visible;
              return <button key={id} type="button" className="orbit-gallery-item" onClick={()=>chooseWidget(id)}>
                <span className="orbit-gallery-item-icon">{COLORS[id] || '✦'}</span>
                <span><strong>{meta[id].title}</strong><small>{meta[id].subtitle}</small></span>
                <span className="orbit-gallery-item-tail">{active?'Edit':'+'}</span>
              </button>;
            })}
          </div>
          {library.length===0&&<p className="adapt-small-muted">No widgets match your search.</p>}
          <p className="orbit-gallery-footnote">Widgets use ARROW's existing features and account data. You can add each widget once and resize or reposition it any time.</p>
        </> : <>
          <button type="button" className="orbit-gallery-back" onClick={()=>setPreview(null)}>← All widgets</button>
          <div className="orbit-gallery-widget-heading"><span className="orbit-gallery-item-icon">{COLORS[preview.id] || '✦'}</span><div><h3>{meta[preview.id].title}</h3><p>{meta[preview.id].subtitle}</p></div></div>
          <div className="orbit-widget-visual-preview" aria-label="Widget appearance preview">
            <div className="orbit-preview-tile" style={{ '--preview-cols':currentPreview?.cols,'--preview-rows':currentPreview?.rows } as CSSProperties}>
              <small>{meta[preview.id].title}</small><strong>{preview.id==='weather'?'72°':preview.id==='tasks'?'3 tasks':preview.id==='askravin'?'Ask anything':preview.id==='calendar'?'Next up':COLORS[preview.id] || '✦'}</strong>
              <span>{meta[preview.id].subtitle}</span>
            </div>
          </div>
          <h4 className="orbit-preview-size-label">Choose widget size</h4>
          <div className="orbit-preview-size-options" role="group" aria-label="Widget size">
            {SIZES.map(size=><button type="button" key={size} aria-pressed={preview.size===size} onClick={()=>setPreview({ ...preview,size })}>
              <span className="orbit-preview-size-icon" style={{ width:Math.max(25,DASHBOARD_SIZE_PRESETS[size].cols*4),height:Math.max(15,DASHBOARD_SIZE_PRESETS[size].rows*9) }}/>
              <span>{DASHBOARD_SIZE_PRESETS[size].label}</span><small>{DASHBOARD_SIZE_PRESETS[size].cols} × {DASHBOARD_SIZE_PRESETS[size].rows}</small>
            </button>)}
          </div>
          <div className="orbit-gallery-cta">
            <button type="button" className="orbit-gallery-primary" onClick={()=>startPlacing(preview)}>{preview.moving?'Choose location':'Add Widget'}</button>
            <button type="button" onClick={()=>automatic(preview)}>Auto place</button>
          </div>
          <p className="orbit-gallery-footnote">After adding, tap an empty green part of the grid to choose its exact position. Red cells mean the widget won't fit.</p>
        </>}
      </section>
    </div>}
  </>;
}
