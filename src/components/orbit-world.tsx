'use client';

import { createCloudRenderer, fitCanvas } from '@/lib/particle-renderer';
import { useEffect, useMemo, useRef, useState } from 'react';

type DestinationId = 'orbit' | 'atlas' | 'ravin' | 'relay' | 'w';

type Destination = {
  id: DestinationId;
  name: string;
  code: string;
  description: string;
  position: string;
  detail: string;
};

const destinations: Destination[] = [
  {
    id: 'atlas',
    name: 'Atlas',
    code: 'NAVIGATION',
    description: 'Maps, place, movement, and spatial context.',
    position: 'node-atlas',
    detail: 'Compass landmark',
  },
  {
    id: 'ravin',
    name: 'RAVIN',
    code: 'INTELLIGENCE',
    description: 'Reasoning, memory, conversation, and the ARROW intelligence layer.',
    position: 'node-ravin',
    detail: 'Core landmark',
  },
  {
    id: 'relay',
    name: 'Relay',
    code: 'COMMUNICATION',
    description: 'Messaging, planning, coordination, and the social layer.',
    position: 'node-relay',
    detail: 'Broadcast landmark',
  },
  {
    id: 'w',
    name: 'W',
    code: 'FUTURE MODULE',
    description: 'Reserved space for the next ARROW destination.',
    position: 'node-w',
    detail: 'Uncharted',
  },
];

export function OrbitWorld() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const pointerRef = useRef({ x: 0, y: 0, inside: false });
  const impulseRef = useRef(0);
  const [selectedId, setSelectedId] = useState<DestinationId>('orbit');

  const renderer = useMemo(() => createCloudRenderer(false, { density: 0.92, size: 1.02 }), []);

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
      hover += ((pointer.inside ? 1 : 0) - hover) * 0.075;
      impulse += (impulseRef.current - impulse) * 0.14;
      impulseRef.current *= 0.91;

      ctx.clearRect(0, 0, width, height);

      const centerX = width * 0.5;
      const centerY = height * 0.5;
      const normalizedX = (pointer.x - centerX) / Math.max(1, width * 0.5);
      const normalizedY = (pointer.y - centerY) / Math.max(1, height * 0.5);

      renderer(ctx, centerX, centerY, width, time, true, {
        mx: normalizedX,
        my: normalizedY,
        hover,
        impulse,
        pointerX: pointer.x - centerX,
        pointerY: pointer.y - centerY,
        scale: width < 720 ? 0.9 : 1.12,
        alpha: 1,
      });

      frame = window.requestAnimationFrame(draw);
    };

    frame = window.requestAnimationFrame(draw);

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, [renderer]);

  const selected = destinations.find(destination => destination.id === selectedId) ?? null;

  const handlePointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
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
    setSelectedId(destination.id);
    impulseRef.current = 1;
  };

  return (
    <div
      ref={shellRef}
      className="world-shell"
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

      <button
        type="button"
        className={`orbit-core-label ${selectedId === 'orbit' ? 'is-active' : ''}`}
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
            type="button"
            key={destination.id}
            className={`destination-node ${destination.position} ${selectedId === destination.id ? 'is-selected' : ''}`}
            onClick={() => selectDestination(destination)}
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

      <aside className={`world-inspector ${selected ? 'has-selection' : ''}`}>
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
          <button
            type="button"
            className="focus-button"
            onClick={() => {
              impulseRef.current = 1;
            }}
          >
            Pulse field
          </button>
          <span className="handoff-state">
            <span /> {selected ? 'handoff not connected yet' : 'navigation online'}
          </span>
        </div>
      </aside>
    </div>
  );
}
