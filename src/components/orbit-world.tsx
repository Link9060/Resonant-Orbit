'use client';

import { createCloudRenderer, fitCanvas } from '@/lib/particle-renderer';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type PointerEvent as ReactPointerEvent,
} from 'react';

type DestinationId = 'orbit' | 'atlas' | 'ravin' | 'relay' | 'w';
type TravelPhase = 'idle' | 'launching' | 'preview' | 'returning';

type Destination = {
  id: Exclude<DestinationId, 'orbit'>;
  name: string;
  code: string;
  description: string;
  detail: string;
  arrivalLine: string;
  anchor: readonly [number, number, number];
};

type RotationState = {
  yaw: number;
  pitch: number;
  targetYaw: number;
  targetPitch: number;
  velocityYaw: number;
  velocityPitch: number;
  dragging: boolean;
  pointerId: number | null;
  lastX: number;
  lastY: number;
};

const destinations: Destination[] = [
  {
    id: 'atlas',
    name: 'Atlas',
    code: 'NAVIGATION',
    description: 'Maps, place, movement, and spatial context.',
    detail: 'Compass landmark',
    arrivalLine: 'Place becomes context.',
    anchor: [-0.82, -0.42, 0.38],
  },
  {
    id: 'ravin',
    name: 'RAVIN',
    code: 'INTELLIGENCE',
    description: 'Reasoning, memory, conversation, and the ARROW intelligence layer.',
    detail: 'Core landmark',
    arrivalLine: 'Intelligence, connected to everything.',
    anchor: [0.48, -0.7, 0.52],
  },
  {
    id: 'relay',
    name: 'Relay',
    code: 'COMMUNICATION',
    description: 'Messaging, planning, coordination, and the social layer.',
    detail: 'Broadcast landmark',
    arrivalLine: 'Communication without breaking flow.',
    anchor: [0.76, 0.5, 0.34],
  },
  {
    id: 'w',
    name: 'W',
    code: 'FUTURE MODULE',
    description: 'Reserved space for the next ARROW destination.',
    detail: 'Uncharted',
    arrivalLine: 'This destination has not been charted yet.',
    anchor: [-0.62, 0.56, -0.55],
  },
];

const destinationIndex = new Map(destinations.map(destination => [destination.id, destination]));

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function projectAnchor(
  anchor: Destination['anchor'],
  yaw: number,
  pitch: number,
  roll: number,
  radius: number,
  centerX: number,
  centerY: number,
) {
  const [ax, ay, az] = anchor;
  const length = Math.hypot(ax, ay, az) || 1;
  const shellRadius = 1.22;
  const px = (ax / length) * shellRadius;
  const py = (ay / length) * shellRadius;
  const pz = (az / length) * shellRadius;

  const cyaw = Math.cos(yaw);
  const syaw = Math.sin(yaw);
  const cpitch = Math.cos(pitch);
  const spitch = Math.sin(pitch);
  const croll = Math.cos(roll);
  const sroll = Math.sin(roll);

  const x1 = px * cyaw + pz * syaw;
  const z1 = -px * syaw + pz * cyaw;
  const y2 = py * cpitch - z1 * spitch;
  const z2 = py * spitch + z1 * cpitch;
  const x3 = x1 * croll - y2 * sroll;
  const y3 = x1 * sroll + y2 * croll;
  const perspective = 1 / Math.max(0.76, 1 - z2 * 0.13);

  return {
    x: centerX + x3 * radius * perspective,
    y: centerY + y3 * radius * perspective,
    depth: clamp((z2 + 1.22) / 2.44, 0, 1),
  };
}

export function OrbitWorld() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Partial<Record<Destination['id'], HTMLButtonElement | null>>>({});
  const pointerRef = useRef({ x: 0, y: 0, inside: false });
  const impulseRef = useRef(0);
  const timersRef = useRef<number[]>([]);
  const rotationRef = useRef<RotationState>({
    yaw: 0,
    pitch: 0,
    targetYaw: 0,
    targetPitch: 0,
    velocityYaw: 0,
    velocityPitch: 0,
    dragging: false,
    pointerId: null,
    lastX: 0,
    lastY: 0,
  });

  const [selectedId, setSelectedId] = useState<DestinationId>('orbit');
  const [travelPhase, setTravelPhase] = useState<TravelPhase>('idle');
  const [travelId, setTravelId] = useState<Destination['id'] | null>(null);
  const [travelVector, setTravelVector] = useState({ x: 0, y: 0 });
  const [dragging, setDragging] = useState(false);
  const [navigatorOpen, setNavigatorOpen] = useState(false);
  const [navigatorQuery, setNavigatorQuery] = useState('');

  const renderer = useMemo(() => createCloudRenderer(false, { density: 0.92, size: 1.02 }), []);
  const selected = selectedId === 'orbit' ? null : destinationIndex.get(selectedId) ?? null;
  const travelingTo = travelId ? destinationIndex.get(travelId) ?? null : null;
  const isTraveling = travelPhase === 'launching' || travelPhase === 'returning';

  useEffect(() => {
    return () => {
      timersRef.current.forEach(timer => window.clearTimeout(timer));
    };
  }, []);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      const isTyping = target?.matches('input, textarea, select, [contenteditable="true"]') ?? false;

      if (event.key === 'Escape') {
        setNavigatorOpen(false);
        setNavigatorQuery('');
        return;
      }

      if (travelPhase !== 'idle') return;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setNavigatorOpen(open => !open);
        return;
      }

      if (!isTyping && event.key === '/') {
        event.preventDefault();
        setNavigatorOpen(true);
        return;
      }

      if (!isTyping && /^[1-4]$/.test(event.key)) {
        const destination = destinations[Number(event.key) - 1];
        if (!destination) return;
        setSelectedId(destination.id);
        impulseRef.current = 0.8;
      }

      if (!isTyping && event.key.toLowerCase() === 'o') {
        const rotation = rotationRef.current;
        rotation.targetYaw = 0;
        rotation.targetPitch = 0;
        rotation.velocityYaw = 0;
        rotation.velocityPitch = 0;
        setSelectedId('orbit');
        impulseRef.current = 0.7;
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [travelPhase]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const shell = shellRef.current;
    if (!canvas || !shell) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let frame = 0;
    let width = 1;
    let height = 1;
    let hover = 0;
    let impulse = 0;
    let travelMix = travelPhase === 'preview' ? 1 : 0;

    const resize = () => {
      const bounds = shell.getBoundingClientRect();
      width = Math.max(1, bounds.width);
      height = Math.max(1, bounds.height);
      fitCanvas(canvas, ctx, width, height);
    };

    const observer = new ResizeObserver(resize);
    observer.observe(shell);
    resize();

    const draw = (now: number) => {
      const time = now / 1000;
      const pointer = pointerRef.current;
      const rotation = rotationRef.current;
      const travelTarget = travelPhase === 'idle' ? 0 : travelPhase === 'returning' ? 0 : 1;

      if (!rotation.dragging && travelPhase === 'idle') {
        rotation.targetYaw += rotation.velocityYaw;
        rotation.targetPitch = clamp(rotation.targetPitch + rotation.velocityPitch, -0.72, 0.72);
        rotation.velocityYaw *= 0.945;
        rotation.velocityPitch *= 0.92;
      }

      rotation.yaw += (rotation.targetYaw - rotation.yaw) * 0.12;
      rotation.pitch += (rotation.targetPitch - rotation.pitch) * 0.12;

      hover += ((pointer.inside && travelPhase === 'idle' && !rotation.dragging ? 1 : 0) - hover) * 0.075;
      impulse += (impulseRef.current - impulse) * 0.14;
      impulseRef.current *= 0.91;
      travelMix += (travelTarget - travelMix) * 0.055;

      ctx.clearRect(0, 0, width, height);

      const centerX = width * 0.5;
      const centerY = height * 0.5;
      const normalizedX = (pointer.x - centerX) / Math.max(1, width * 0.5);
      const normalizedY = (pointer.y - centerY) / Math.max(1, height * 0.5);
      const worldScale = (width < 720 ? 0.9 : 1.12) * (1 + travelMix * 0.16);

      renderer(ctx, centerX, centerY, width, time, true, {
        mx: normalizedX,
        my: normalizedY,
        hover,
        impulse: impulse + travelMix * 0.28,
        pointerX: pointer.x - centerX,
        pointerY: pointer.y - centerY,
        scale: worldScale,
        alpha: 1 - travelMix * 0.44,
        loadingMix: travelMix * 0.72,
        yawOffset: rotation.yaw,
        pitchOffset: rotation.pitch,
      });

      const sphereRadius =
        Math.min(width * 0.228, height * 0.258, 292) *
        worldScale;
      const nodeYaw = time * (0.052 + travelMix * 0.045) + rotation.yaw;
      const nodePitch = Math.sin(time * 0.14) * 0.028 + rotation.pitch;
      const nodeRoll = Math.sin(time * 0.09) * 0.016;

      for (const destination of destinations) {
        const node = nodeRefs.current[destination.id];
        if (!node) continue;

        const projected = projectAnchor(
          destination.anchor,
          nodeYaw,
          nodePitch,
          nodeRoll,
          sphereRadius,
          centerX,
          centerY,
        );

        node.style.left = `${projected.x}px`;
        node.style.top = `${projected.y}px`;
        node.style.zIndex = String(18 + Math.round(projected.depth * 8));
        node.style.setProperty('--node-depth', projected.depth.toFixed(3));
        node.style.setProperty('--node-scale', (0.86 + projected.depth * 0.24).toFixed(3));
        node.style.setProperty('--node-opacity', (0.4 + projected.depth * 0.6).toFixed(3));
      }

      frame = window.requestAnimationFrame(draw);
    };

    frame = window.requestAnimationFrame(draw);

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, [renderer, travelPhase]);

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (travelPhase !== 'idle') return;

    const bounds = event.currentTarget.getBoundingClientRect();
    pointerRef.current = {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
      inside: true,
    };

    const rotation = rotationRef.current;
    if (!rotation.dragging || rotation.pointerId !== event.pointerId) return;

    const dx = event.clientX - rotation.lastX;
    const dy = event.clientY - rotation.lastY;
    rotation.lastX = event.clientX;
    rotation.lastY = event.clientY;

    const yawDelta = dx * 0.0054;
    const pitchDelta = dy * 0.0045;
    rotation.targetYaw += yawDelta;
    rotation.targetPitch = clamp(rotation.targetPitch + pitchDelta, -0.72, 0.72);
    rotation.velocityYaw = yawDelta * 0.42;
    rotation.velocityPitch = pitchDelta * 0.32;
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (travelPhase !== 'idle' || event.button !== 0) return;
    if ((event.target as HTMLElement).closest('button')) return;

    const rotation = rotationRef.current;
    rotation.dragging = true;
    rotation.pointerId = event.pointerId;
    rotation.lastX = event.clientX;
    rotation.lastY = event.clientY;
    rotation.velocityYaw = 0;
    rotation.velocityPitch = 0;
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    const rotation = rotationRef.current;
    if (!rotation.dragging || rotation.pointerId !== event.pointerId) return;

    rotation.dragging = false;
    rotation.pointerId = null;
    setDragging(false);

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const resetPointer = () => {
    pointerRef.current.inside = false;
  };

  const selectDestination = (destination: Destination) => {
    if (travelPhase !== 'idle') return;
    setSelectedId(destination.id);
    impulseRef.current = 1;
  };

  const clearTimers = () => {
    timersRef.current.forEach(timer => window.clearTimeout(timer));
    timersRef.current = [];
  };

  const computeTravelVector = (destination: Destination) => {
    const shell = shellRef.current;
    const node = nodeRefs.current[destination.id];
    if (!shell || !node) return { x: 0, y: 0 };

    const shellRect = shell.getBoundingClientRect();
    const nodeRect = node.getBoundingClientRect();
    return {
      x: nodeRect.left + nodeRect.width / 2 - (shellRect.left + shellRect.width / 2),
      y: nodeRect.top + nodeRect.height / 2 - (shellRect.top + shellRect.height / 2),
    };
  };

  const launchDestination = () => {
    if (!selected || travelPhase !== 'idle') return;

    clearTimers();
    pointerRef.current.inside = false;
    setTravelId(selected.id);
    setTravelVector(computeTravelVector(selected));
    setTravelPhase('launching');
    impulseRef.current = 1.35;

    timersRef.current.push(window.setTimeout(() => {
      setTravelPhase('preview');
      impulseRef.current = 0.8;
    }, 1450));
  };

  const returnToOrbit = () => {
    if (!travelingTo || travelPhase !== 'preview') return;

    clearTimers();
    setTravelPhase('returning');
    impulseRef.current = 1;

    timersRef.current.push(window.setTimeout(() => {
      setTravelPhase('idle');
      setTravelId(null);
      setSelectedId('orbit');
      setTravelVector({ x: 0, y: 0 });
      impulseRef.current = 0.65;
    }, 1050));
  };

  const recenterWorld = () => {
    const rotation = rotationRef.current;
    rotation.targetYaw = 0;
    rotation.targetPitch = 0;
    rotation.velocityYaw = 0;
    rotation.velocityPitch = 0;
    setSelectedId('orbit');
    impulseRef.current = 0.7;
  };

  const filteredDestinations = destinations.filter(destination => {
    const query = navigatorQuery.trim().toLowerCase();
    if (!query) return true;
    return [destination.name, destination.code, destination.description]
      .join(' ')
      .toLowerCase()
      .includes(query);
  });

  const chooseFromNavigator = (destination: Destination) => {
    setSelectedId(destination.id);
    setNavigatorOpen(false);
    setNavigatorQuery('');
    impulseRef.current = 0.9;
  };

  const travelStyle = {
    '--travel-x': `${travelVector.x}px`,
    '--travel-y': `${travelVector.y}px`,
  } as CSSProperties;

  return (
    <div
      ref={shellRef}
      className={`world-shell travel-${travelPhase} ${dragging ? 'is-dragging' : ''}`}
      data-travel-destination={travelId ?? undefined}
      style={travelStyle}
      onPointerMove={handlePointerMove}
      onPointerDown={handlePointerDown}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerEnter={handlePointerMove}
      onPointerLeave={resetPointer}
    >
      <canvas ref={canvasRef} className="world-canvas" aria-hidden="true" />

      <div className="orbit-rings" aria-hidden="true">
        <span className="ring ring-a" />
        <span className="ring ring-b" />
        <span className="ring ring-c" />
      </div>

      <div className="craft-orbit" aria-hidden="true">
        <span className="arrow-craft"><span /></span>
      </div>

      {travelingTo && (
        <div className="travel-flight-layer" aria-hidden="true">
          <span className="travel-path" />
          <span className="travel-craft"><span /></span>
          <span className="travel-wake wake-one" />
          <span className="travel-wake wake-two" />
          <span className="travel-wake wake-three" />
        </div>
      )}

      <button
        type="button"
        className={`orbit-core-label ${selectedId === 'orbit' ? 'is-active' : ''}`}
        disabled={travelPhase !== 'idle'}
        onClick={recenterWorld}
      >
        <span className="core-kicker">YOU ARE HERE</span>
        <span className="core-title">Orbit</span>
      </button>

      <div className="destination-layer">
        {destinations.map(destination => (
          <button
            ref={node => {
              nodeRefs.current[destination.id] = node;
            }}
            type="button"
            key={destination.id}
            className={`destination-node ${selectedId === destination.id ? 'is-selected' : ''} ${travelId === destination.id ? 'is-travel-target' : ''}`}
            onClick={() => selectDestination(destination)}
            disabled={travelPhase !== 'idle'}
            aria-pressed={selectedId === destination.id}
          >
            <span className="node-pulse" />
            <span className="node-landmark" aria-hidden="true">
              {destination.id === 'relay' && <span className="landmark-relay"><i /><i /><i /></span>}
              {destination.id === 'atlas' && <span className="landmark-atlas"><i /></span>}
              {destination.id === 'ravin' && <span className="landmark-ravin"><i /><i /></span>}
              {destination.id === 'w' && <span className="landmark-w">W</span>}
            </span>
            <span className="node-copy">
              <span className="node-code">{destination.code}</span>
              <strong>{destination.name}</strong>
            </span>
          </button>
        ))}
      </div>

      <div className="world-controls" aria-label="World controls">
        <span className="drag-hint">
          <span className="drag-icon" aria-hidden="true" />
          drag world
        </span>
        <button type="button" onClick={recenterWorld} disabled={travelPhase !== 'idle'}>
          recenter
        </button>
        <button
          type="button"
          className="navigator-trigger"
          onClick={() => setNavigatorOpen(true)}
          disabled={travelPhase !== 'idle'}
        >
          navigator <kbd>⌘K</kbd>
        </button>
      </div>

      {navigatorOpen && travelPhase === 'idle' && (
        <div
          className="orbit-navigator-backdrop"
          role="presentation"
          onPointerDown={event => {
            if (event.target === event.currentTarget) {
              setNavigatorOpen(false);
              setNavigatorQuery('');
            }
          }}
        >
          <section className="orbit-navigator" role="dialog" aria-modal="true" aria-label="Orbit navigator">
            <div className="navigator-heading">
              <div>
                <p>ARROW NAVIGATOR</p>
                <h2>Where to?</h2>
              </div>
              <button
                type="button"
                className="navigator-close"
                onClick={() => {
                  setNavigatorOpen(false);
                  setNavigatorQuery('');
                }}
                aria-label="Close navigator"
              >
                esc
              </button>
            </div>

            <label className="navigator-search">
              <span className="navigator-search-mark" aria-hidden="true">⌕</span>
              <input
                autoFocus
                value={navigatorQuery}
                onChange={event => setNavigatorQuery(event.target.value)}
                placeholder="Search ARROW"
                aria-label="Search ARROW destinations"
              />
              <kbd>/</kbd>
            </label>

            <div className="navigator-results">
              {filteredDestinations.map((destination, index) => (
                <button
                  type="button"
                  key={destination.id}
                  className="navigator-result"
                  onClick={() => chooseFromNavigator(destination)}
                >
                  <span className="navigator-index">0{index + 1}</span>
                  <span className="navigator-result-copy">
                    <strong>{destination.name}</strong>
                    <span>{destination.code}</span>
                  </span>
                  <span className="navigator-result-description">{destination.description}</span>
                  <span className="navigator-go" aria-hidden="true"><span /></span>
                </button>
              ))}

              {filteredDestinations.length === 0 && (
                <div className="navigator-empty">
                  No destination matches “{navigatorQuery}”.
                </div>
              )}
            </div>

            <footer className="navigator-footer">
              <span><kbd>1–4</kbd> quick focus</span>
              <span><kbd>O</kbd> recenter Orbit</span>
            </footer>
          </section>
        </div>
      )}

      <aside className={`world-inspector ${selected ? 'has-selection' : ''}`} aria-hidden={travelPhase !== 'idle'}>
        <div className="inspector-topline">
          <span>{selected ? selected.code : 'ORBIT'}</span>
          <span>{selected ? selected.detail : 'CENTRAL WORLD'}</span>
        </div>
        <h2>{selected ? selected.name : 'Your ARROW system'}</h2>
        <p>
          {selected
            ? selected.description
            : 'Orbit is the connective layer between every ARROW product. Drag the world or select a landmark to choose where ARROW goes next.'}
        </p>
        <div className="inspector-actions">
          {selected ? (
            <button type="button" className="focus-button travel-button" onClick={launchDestination}>
              Travel to {selected.name}
              <span className="mini-arrow" aria-hidden="true" />
            </button>
          ) : (
            <button
              type="button"
              className="focus-button"
              onClick={() => {
                impulseRef.current = 1;
              }}
            >
              Pulse field
            </button>
          )}
          <span className="handoff-state">
            <span /> {selected ? 'route staged' : 'navigation online'}
          </span>
        </div>
      </aside>

      {travelingTo && (
        <section className="destination-preview" aria-live="polite" aria-hidden={travelPhase !== 'preview'}>
          <div className="arrival-landmark" aria-hidden="true">
            {travelingTo.id === 'relay' && <span className="landmark-relay large"><i /><i /><i /></span>}
            {travelingTo.id === 'atlas' && <span className="landmark-atlas large"><i /></span>}
            {travelingTo.id === 'ravin' && <span className="landmark-ravin large"><i /><i /></span>}
            {travelingTo.id === 'w' && <span className="landmark-w large">W</span>}
          </div>
          <p className="arrival-code">{travelingTo.code}</p>
          <h2>{travelingTo.name}</h2>
          <p className="arrival-line">{travelingTo.arrivalLine}</p>

          <div className="arrival-actions">
            <button type="button" className="arrival-primary" disabled>
              Open {travelingTo.name}
              <span>connect route</span>
            </button>
            <button type="button" className="arrival-return" onClick={returnToOrbit}>
              <span className="return-arrow" aria-hidden="true" />
              Back to Orbit
            </button>
          </div>
        </section>
      )}

      {isTraveling && (
        <div className="travel-status" aria-live="polite">
          <span className="travel-status-dot" />
          {travelPhase === 'returning' ? 'returning to Orbit' : `traveling to ${travelingTo?.name ?? 'destination'}`}
        </div>
      )}
    </div>
  );
}
