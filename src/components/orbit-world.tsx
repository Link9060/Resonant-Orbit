'use client';

import { createCloudRenderer, fitCanvas } from '@/lib/particle-renderer';
import { useEffect, useMemo, useRef, useState, type CSSProperties, type PointerEvent as ReactPointerEvent } from 'react';

type DestinationId = 'orbit' | 'atlas' | 'ravin' | 'relay' | 'w';
type TravelPhase = 'idle' | 'launching' | 'preview' | 'returning';

type Destination = {
  id: Exclude<DestinationId, 'orbit'>;
  name: string;
  code: string;
  description: string;
  position: string;
  detail: string;
  arrivalLine: string;
};

const destinations: Destination[] = [
  {
    id: 'atlas',
    name: 'Atlas',
    code: 'NAVIGATION',
    description: 'Maps, place, movement, and spatial context.',
    position: 'node-atlas',
    detail: 'Compass landmark',
    arrivalLine: 'Place becomes context.',
  },
  {
    id: 'ravin',
    name: 'RAVIN',
    code: 'INTELLIGENCE',
    description: 'Reasoning, memory, conversation, and the ARROW intelligence layer.',
    position: 'node-ravin',
    detail: 'Core landmark',
    arrivalLine: 'Intelligence, connected to everything.',
  },
  {
    id: 'relay',
    name: 'Relay',
    code: 'COMMUNICATION',
    description: 'Messaging, planning, coordination, and the social layer.',
    position: 'node-relay',
    detail: 'Broadcast landmark',
    arrivalLine: 'Communication without breaking flow.',
  },
  {
    id: 'w',
    name: 'W',
    code: 'FUTURE MODULE',
    description: 'Reserved space for the next ARROW destination.',
    position: 'node-w',
    detail: 'Uncharted',
    arrivalLine: 'This destination has not been charted yet.',
  },
];

const destinationIndex = new Map(destinations.map(destination => [destination.id, destination]));

export function OrbitWorld() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const nodeRefs = useRef<Partial<Record<Destination['id'], HTMLButtonElement | null>>>({});
  const pointerRef = useRef({ x: 0, y: 0, inside: false });
  const impulseRef = useRef(0);
  const timersRef = useRef<number[]>([]);

  const [selectedId, setSelectedId] = useState<DestinationId>('orbit');
  const [travelPhase, setTravelPhase] = useState<TravelPhase>('idle');
  const [travelId, setTravelId] = useState<Destination['id'] | null>(null);
  const [travelVector, setTravelVector] = useState({ x: 0, y: 0 });

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
      const travelTarget = travelPhase === 'idle' ? 0 : travelPhase === 'returning' ? 0 : 1;

      hover += ((pointer.inside && travelPhase === 'idle' ? 1 : 0) - hover) * 0.075;
      impulse += (impulseRef.current - impulse) * 0.14;
      impulseRef.current *= 0.91;
      travelMix += (travelTarget - travelMix) * 0.055;

      ctx.clearRect(0, 0, width, height);

      const centerX = width * 0.5;
      const centerY = height * 0.5;
      const normalizedX = (pointer.x - centerX) / Math.max(1, width * 0.5);
      const normalizedY = (pointer.y - centerY) / Math.max(1, height * 0.5);

      renderer(ctx, centerX, centerY, width, time, true, {
        mx: normalizedX,
        my: normalizedY,
        hover,
        impulse: impulse + travelMix * 0.28,
        pointerX: pointer.x - centerX,
        pointerY: pointer.y - centerY,
        scale: (width < 720 ? 0.9 : 1.12) * (1 + travelMix * 0.16),
        alpha: 1 - travelMix * 0.44,
        loadingMix: travelMix * 0.72,
      });

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

  const travelStyle = {
    '--travel-x': `${travelVector.x}px`,
    '--travel-y': `${travelVector.y}px`,
  } as CSSProperties;

  return (
    <div
      ref={shellRef}
      className={`world-shell travel-${travelPhase}`}
      data-travel-destination={travelId ?? undefined}
      style={travelStyle}
      onPointerMove={handlePointerMove}
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
        onClick={() => {
          setSelectedId('orbit');
          impulseRef.current = 1;
        }}
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
            className={`destination-node ${destination.position} ${selectedId === destination.id ? 'is-selected' : ''} ${travelId === destination.id ? 'is-travel-target' : ''}`}
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

      <aside className={`world-inspector ${selected ? 'has-selection' : ''}`} aria-hidden={travelPhase !== 'idle'}>
        <div className="inspector-topline">
          <span>{selected ? selected.code : 'ORBIT'}</span>
          <span>{selected ? selected.detail : 'CENTRAL WORLD'}</span>
        </div>
        <h2>{selected ? selected.name : 'Your ARROW system'}</h2>
        <p>
          {selected
            ? selected.description
            : 'Orbit is the connective layer between every ARROW product. Select a landmark to bring that destination into focus.'}
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
