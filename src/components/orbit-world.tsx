'use client';

import {
  ARROW_DESTINATIONS,
  ARROW_DESTINATION_BY_ID,
  readIncomingArrowSource,
  type ArrowDestination,
  type OrbitSelectionId,
} from '@/lib/arrow-map';
import { createCloudRenderer, fitCanvas } from '@/lib/particle-renderer';
import {
  ArrowLeftIcon,
  ArrowMarkIcon,
  ArrowUpRightIcon,
  CloseIcon,
  CommandIcon,
  CompassIcon,
  CoreIcon,
  FutureNodeIcon,
  PulseIcon,
  RadioTowerIcon,
  RotateWorldIcon,
  SearchIcon,
  TargetIcon,
  ZoomInIcon,
  ZoomOutIcon,
} from '@/components/orbit-icons';
import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
  type PointerEvent as ReactPointerEvent,
  type WheelEvent as ReactWheelEvent,
} from 'react';

type Destination = ArrowDestination;
type DestinationId = OrbitSelectionId;
type TravelPhase = 'idle' | 'launching' | 'preview' | 'returning';

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

type FlightPath = {
  startX: number;
  startY: number;
  targetX: number;
  targetY: number;
};

type UiState = {
  selectedId: DestinationId;
  travelPhase: TravelPhase;
  travelId: Destination['id'] | null;
  incomingFrom: Destination['id'] | null;
  navigatorOpen: boolean;
};

const destinations = ARROW_DESTINATIONS;
const destinationIndex = ARROW_DESTINATION_BY_ID;
const TAU = Math.PI * 2;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function nearestEquivalentAngle(angle: number, current: number) {
  return angle + Math.round((current - angle) / TAU) * TAU;
}

function projectAnchor(
  anchor: readonly [number, number, number],
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

function DestinationIcon({ id, size = 18 }: { id: Destination['id']; size?: number }) {
  if (id === 'atlas') return <CompassIcon size={size} />;
  if (id === 'ravin') return <CoreIcon size={size} />;
  if (id === 'relay') return <RadioTowerIcon size={size} />;
  return <FutureNodeIcon size={size} />;
}

export function OrbitWorld() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const ringsRef = useRef<HTMLDivElement>(null);
  const craftRef = useRef<HTMLDivElement>(null);
  const navigatorRef = useRef<HTMLElement>(null);
  const navigatorInputRef = useRef<HTMLInputElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const nodeRefs = useRef<Partial<Record<Destination['id'], HTMLButtonElement | null>>>({});
  const linkRefs = useRef<Partial<Record<Destination['id'], SVGLineElement | null>>>({});
  const pointerRef = useRef({ x: 0, y: 0, inside: false });
  const impulseRef = useRef(0);
  const zoomRef = useRef({ current: 1, target: 1 });
  const autoYawRef = useRef(0);
  const craftAngleRef = useRef(-0.8);
  const timersRef = useRef<number[]>([]);
  const uiRef = useRef<UiState>({
    selectedId: 'orbit',
    travelPhase: 'idle',
    travelId: null,
    incomingFrom: null,
    navigatorOpen: false,
  });
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
  const [flightPath, setFlightPath] = useState<FlightPath>({
    startX: 0,
    startY: 0,
    targetX: 0,
    targetY: 0,
  });
  const [dragging, setDragging] = useState(false);
  const [navigatorOpen, setNavigatorOpen] = useState(false);
  const [navigatorQuery, setNavigatorQuery] = useState('');
  const [incomingFrom, setIncomingFrom] = useState<Destination['id'] | null>(null);

  const renderer = useMemo(() => createCloudRenderer(false, { density: 0.92, size: 1.02 }), []);
  const selected = selectedId === 'orbit' ? null : destinationIndex.get(selectedId) ?? null;
  const travelingTo = travelId ? destinationIndex.get(travelId) ?? null : null;
  const isTraveling = travelPhase === 'launching' || travelPhase === 'returning';

  useEffect(() => {
    uiRef.current = { selectedId, travelPhase, travelId, incomingFrom, navigatorOpen };
  }, [incomingFrom, navigatorOpen, selectedId, travelId, travelPhase]);

  useEffect(() => {
    return () => {
      timersRef.current.forEach(timer => window.clearTimeout(timer));
    };
  }, []);

  useEffect(() => {
    const incoming = readIncomingArrowSource(window.location.search);
    if (!incoming) return;

    setIncomingFrom(incoming);
    pointerRef.current.inside = false;
    impulseRef.current = 1.5;

    timersRef.current.push(
      window.setTimeout(() => {
        impulseRef.current = 1.15;
      }, 980),
      window.setTimeout(() => {
        setIncomingFrom(null);
        const url = new URL(window.location.href);
        url.searchParams.delete('from');
        window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
        impulseRef.current = 0.75;
      }, 2200),
    );
  }, []);

  useEffect(() => {
    if (!navigatorOpen) return;

    previousFocusRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusTimer = window.setTimeout(() => navigatorInputRef.current?.focus(), 0);

    return () => {
      window.clearTimeout(focusTimer);
      previousFocusRef.current?.focus();
      previousFocusRef.current = null;
    };
  }, [navigatorOpen]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const ui = uiRef.current;
      const target = event.target as HTMLElement | null;
      const isTyping = target?.matches('input, textarea, select, [contenteditable="true"]') ?? false;

      if (event.key === 'Escape' && ui.navigatorOpen) {
        event.preventDefault();
        setNavigatorOpen(false);
        setNavigatorQuery('');
        return;
      }

      if (ui.incomingFrom || ui.travelPhase !== 'idle') return;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setNavigatorOpen(open => !open);
        return;
      }

      if (!ui.navigatorOpen && !isTyping && event.key === '/') {
        event.preventDefault();
        setNavigatorOpen(true);
        return;
      }

      if (ui.navigatorOpen || isTyping) return;

      if (/^[1-4]$/.test(event.key)) {
        const shortcut = Number(event.key);
        const destination = destinations.find(item => item.shortcut === shortcut);
        if (destination) focusDestination(destination, 0.8);
        return;
      }

      if (event.key.toLowerCase() === 'o') recenterWorld();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
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
    let travelMix = 0;
    let lastFrame = performance.now();

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
      const dt = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
      lastFrame = now;

      const time = now / 1000;
      const pointer = pointerRef.current;
      const rotation = rotationRef.current;
      const ui = uiRef.current;
      const locked =
        ui.travelPhase !== 'idle' ||
        ui.incomingFrom !== null ||
        ui.navigatorOpen;

      if (!rotation.dragging && !locked) {
        rotation.targetYaw += rotation.velocityYaw;
        rotation.targetPitch = clamp(rotation.targetPitch + rotation.velocityPitch, -0.72, 0.72);
        rotation.velocityYaw *= 0.945;
        rotation.velocityPitch *= 0.92;
      }

      if (ui.selectedId === 'orbit' && !rotation.dragging && !locked) {
        autoYawRef.current += dt * 0.052;
      }

      craftAngleRef.current += dt * (locked ? 0 : 0.24);

      rotation.yaw += (rotation.targetYaw - rotation.yaw) * 0.12;
      rotation.pitch += (rotation.targetPitch - rotation.pitch) * 0.12;

      const zoom = zoomRef.current;
      zoom.current += (zoom.target - zoom.current) * 0.11;

      hover += ((pointer.inside && !locked && !rotation.dragging ? 1 : 0) - hover) * 0.075;
      impulse += (impulseRef.current - impulse) * 0.14;
      impulseRef.current *= 0.91;
      const travelTarget = ui.travelPhase === 'launching' || ui.travelPhase === 'preview' ? 1 : 0;
      travelMix += (travelTarget - travelMix) * 0.055;

      ctx.clearRect(0, 0, width, height);

      const centerX = width * 0.5;
      const centerY = height * 0.5;
      const normalizedX = (pointer.x - centerX) / Math.max(1, width * 0.5);
      const normalizedY = (pointer.y - centerY) / Math.max(1, height * 0.5);
      const worldScale =
        (width < 720 ? 0.9 : 1.12) *
        zoom.current *
        (1 + travelMix * 0.16);

      const worldYaw = autoYawRef.current + rotation.yaw;
      const worldPitch = Math.sin(time * 0.14) * 0.028 + rotation.pitch;
      const worldRoll = Math.sin(time * 0.09) * 0.016;

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
        yaw: worldYaw,
        pitch: worldPitch,
        roll: worldRoll,
      });

      const sphereRadius = Math.min(width * 0.228, height * 0.258, 292) * worldScale;
      const safeTopLeftX = Math.min(390, width * 0.38);
      const safeBottomRightX = Math.min(390, width * 0.4);

      for (const destination of destinations) {
        const node = nodeRefs.current[destination.id];
        if (!node) continue;

        const projected = projectAnchor(
          destination.anchor,
          worldYaw,
          worldPitch,
          worldRoll,
          sphereRadius,
          centerX,
          centerY,
        );

        const isBack = projected.depth < 0.42;
        const isSelected = ui.selectedId === destination.id;
        const inTopLeftSafeZone = projected.x < safeTopLeftX && projected.y < 275;
        const inBottomRightSafeZone =
          projected.x > width - safeBottomRightX &&
          projected.y > height - 250;
        const hideLabel =
          isBack ||
          (!isSelected && (inTopLeftSafeZone || inBottomRightSafeZone));

        node.style.setProperty('--node-x', `${projected.x}px`);
        node.style.setProperty('--node-y', `${projected.y}px`);
        node.style.setProperty('--node-scale', (0.84 + projected.depth * 0.22).toFixed(3));
        node.style.setProperty('--node-opacity', isBack ? '0.12' : (0.52 + projected.depth * 0.48).toFixed(3));
        node.style.setProperty('--label-opacity', hideLabel ? '0' : '1');
        node.style.zIndex = String(ui.travelId === destination.id ? 35 : 18 + Math.round(projected.depth * 7));
        node.dataset.side = projected.x < centerX ? 'left' : 'right';
        node.dataset.backface = isBack ? 'true' : 'false';
        node.tabIndex = locked || isBack ? -1 : 0;
        node.style.pointerEvents = locked || isBack ? 'none' : 'auto';

        const link = linkRefs.current[destination.id];
        if (link) {
          const dx = projected.x - centerX;
          const dy = projected.y - centerY;
          link.setAttribute('x1', String(centerX + dx * 0.18));
          link.setAttribute('y1', String(centerY + dy * 0.18));
          link.setAttribute('x2', String(centerX + dx * 0.86));
          link.setAttribute('y2', String(centerY + dy * 0.86));
          link.style.opacity = String(
            isBack ? 0.025 : isSelected ? 0.58 : 0.08 + projected.depth * 0.12,
          );
        }
      }

      const orbitAngle = craftAngleRef.current;
      const craftAnchor: readonly [number, number, number] = [
        Math.cos(orbitAngle) * 1.32,
        Math.sin(orbitAngle * 0.7) * 0.23,
        Math.sin(orbitAngle) * 1.32,
      ];
      const nextCraftAnchor: readonly [number, number, number] = [
        Math.cos(orbitAngle + 0.025) * 1.32,
        Math.sin((orbitAngle + 0.025) * 0.7) * 0.23,
        Math.sin(orbitAngle + 0.025) * 1.32,
      ];
      const craftPoint = projectAnchor(
        craftAnchor,
        worldYaw,
        worldPitch,
        worldRoll,
        sphereRadius,
        centerX,
        centerY,
      );
      const nextCraftPoint = projectAnchor(
        nextCraftAnchor,
        worldYaw,
        worldPitch,
        worldRoll,
        sphereRadius,
        centerX,
        centerY,
      );
      const craftRotation =
        Math.atan2(nextCraftPoint.y - craftPoint.y, nextCraftPoint.x - craftPoint.x) *
        (180 / Math.PI);

      if (craftRef.current) {
        craftRef.current.style.setProperty('--craft-x', `${craftPoint.x}px`);
        craftRef.current.style.setProperty('--craft-y', `${craftPoint.y}px`);
        craftRef.current.style.setProperty('--craft-rotation', `${craftRotation}deg`);
        craftRef.current.style.setProperty('--craft-depth', craftPoint.depth.toFixed(3));
        craftRef.current.style.setProperty('--craft-opacity', (0.38 + craftPoint.depth * 0.62).toFixed(3));
      }

      if (ringsRef.current) {
        ringsRef.current.style.setProperty('--ring-pitch', `${worldPitch * (180 / Math.PI)}deg`);
        ringsRef.current.style.setProperty('--ring-yaw', `${(worldYaw % TAU) * (180 / Math.PI)}deg`);
      }

      frame = window.requestAnimationFrame(draw);
    };

    frame = window.requestAnimationFrame(draw);

    return () => {
      observer.disconnect();
      window.cancelAnimationFrame(frame);
    };
  }, [renderer]);

  const interactionLocked =
    travelPhase !== 'idle' ||
    incomingFrom !== null ||
    navigatorOpen;

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (interactionLocked) return;

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
    if (interactionLocked || event.button !== 0) return;
    if ((event.target as HTMLElement).closest('button, input, a, [role="dialog"]')) return;

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

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (interactionLocked) return;
    if ((event.target as HTMLElement).closest('button, input, a, [role="dialog"]')) return;

    event.preventDefault();
    zoomRef.current.target = clamp(
      zoomRef.current.target - event.deltaY * 0.0007,
      0.82,
      1.22,
    );
  };

  const resetPointer = () => {
    pointerRef.current.inside = false;
  };

  const changeZoom = (amount: number) => {
    if (interactionLocked) return;
    zoomRef.current.target = clamp(zoomRef.current.target + amount, 0.82, 1.22);
    impulseRef.current = Math.max(impulseRef.current, 0.32);
  };

  const focusDestination = (destination: Destination, impulse = 1) => {
    if (uiRef.current.travelPhase !== 'idle' || uiRef.current.incomingFrom) return;

    const [x, y, z] = destination.anchor;
    const horizontal = Math.max(0.001, Math.hypot(x, z));
    const sideOffset = x >= 0 ? 0.38 : -0.38;
    const baseYaw = Math.atan2(-x, z);
    const currentWorldYaw = autoYawRef.current + rotationRef.current.targetYaw;
    const desiredWorldYaw = nearestEquivalentAngle(baseYaw + sideOffset, currentWorldYaw);
    const forwardDepth = horizontal * Math.cos(sideOffset);
    const basePitch = Math.atan2(y, Math.max(0.001, forwardDepth));
    const desiredPitch = clamp(basePitch + 0.13, -0.58, 0.58);

    const rotation = rotationRef.current;
    rotation.targetYaw = desiredWorldYaw - autoYawRef.current;
    rotation.targetPitch = desiredPitch;
    rotation.velocityYaw = 0;
    rotation.velocityPitch = 0;

    setSelectedId(destination.id);
    impulseRef.current = impulse;
  };

  const clearTimers = () => {
    timersRef.current.forEach(timer => window.clearTimeout(timer));
    timersRef.current = [];
  };

  const relativePoint = (element: HTMLElement | null) => {
    const shell = shellRef.current;
    if (!shell || !element) return { x: 0, y: 0 };

    const shellRect = shell.getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    return {
      x: rect.left + rect.width / 2 - (shellRect.left + shellRect.width / 2),
      y: rect.top + rect.height / 2 - (shellRect.top + shellRect.height / 2),
    };
  };

  const launchDestination = () => {
    if (!selected || interactionLocked) return;

    const start = relativePoint(craftRef.current);
    const target = relativePoint(nodeRefs.current[selected.id] ?? null);

    clearTimers();
    pointerRef.current.inside = false;
    setTravelId(selected.id);
    setFlightPath({
      startX: start.x,
      startY: start.y,
      targetX: target.x,
      targetY: target.y,
    });
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
      setFlightPath({ startX: 0, startY: 0, targetX: 0, targetY: 0 });
      impulseRef.current = 0.65;
    }, 1050));
  };

  const recenterWorld = () => {
    if (incomingFrom || travelPhase !== 'idle') return;

    const rotation = rotationRef.current;
    autoYawRef.current = 0;
    rotation.yaw = 0;
    rotation.pitch = 0;
    rotation.targetYaw = 0;
    rotation.targetPitch = 0;
    rotation.velocityYaw = 0;
    rotation.velocityPitch = 0;
    zoomRef.current.target = 1;
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
    setNavigatorOpen(false);
    setNavigatorQuery('');
    window.setTimeout(() => focusDestination(destination, 0.9), 0);
  };

  const handleNavigatorKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    if (event.key !== 'Tab') return;

    const focusable = Array.from(
      navigatorRef.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled), input:not(:disabled), a[href], [tabindex]:not([tabindex="-1"])',
      ) ?? [],
    );

    if (!focusable.length) return;

    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;

    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  };

  const flightStyle = {
    '--flight-start-x': `${flightPath.startX}px`,
    '--flight-start-y': `${flightPath.startY}px`,
    '--flight-target-x': `${flightPath.targetX}px`,
    '--flight-target-y': `${flightPath.targetY}px`,
  } as CSSProperties;

  return (
    <div
      ref={shellRef}
      className={[
        'world-shell',
        `travel-${travelPhase}`,
        dragging ? 'is-dragging' : '',
        incomingFrom ? 'incoming-active' : '',
        navigatorOpen ? 'has-navigator' : '',
      ].filter(Boolean).join(' ')}
      data-travel-destination={travelId ?? undefined}
      data-incoming-from={incomingFrom ?? undefined}
      style={flightStyle}
      onPointerMove={handlePointerMove}
      onPointerDown={handlePointerDown}
      onPointerUp={endDrag}
      onPointerCancel={endDrag}
      onPointerEnter={handlePointerMove}
      onPointerLeave={resetPointer}
      onWheel={handleWheel}
    >
      <div className="world-scene" aria-hidden={navigatorOpen ? true : undefined} inert={navigatorOpen ? true : undefined}>
        <div className="stage-copy">
          <p className="eyebrow">CENTRAL WORLD</p>
          <h1>Everything starts here.</h1>
          <p className="stage-description">
            Move through ARROW as one connected system. The sphere is the map; each signal is a destination.
          </p>
        </div>

        <canvas ref={canvasRef} className="world-canvas" aria-hidden="true" />

        <div ref={ringsRef} className="orbit-rings" aria-hidden="true">
          <span className="ring ring-a" />
          <span className="ring ring-b" />
          <span className="ring ring-c" />
        </div>

        <svg className="orbit-links" aria-hidden="true">
          {destinations.map(destination => (
            <line
              key={destination.id}
              ref={line => {
                linkRefs.current[destination.id] = line;
              }}
              className={`orbit-link ${selectedId === destination.id ? 'is-selected' : ''}`}
            />
          ))}
        </svg>

        <div ref={craftRef} className="craft-orbit" aria-hidden="true">
          <ArrowMarkIcon size={20} />
        </div>

        {travelingTo && (
          <div className="travel-flight-layer" aria-hidden="true">
            <span className="travel-wake wake-one" />
            <span className="travel-wake wake-two" />
            <span className="travel-wake wake-three" />
            <span className="travel-craft"><ArrowMarkIcon size={28} /></span>
          </div>
        )}

        {incomingFrom && (
          <div className="incoming-flight-layer" aria-hidden="true">
            <span className="incoming-arrival-ring ring-one" />
            <span className="incoming-arrival-ring ring-two" />
            <span className="incoming-trail trail-one" />
            <span className="incoming-trail trail-two" />
            <span className="incoming-trail trail-three" />
            <span className="incoming-craft"><ArrowMarkIcon size={28} /></span>
            <span className="incoming-source-label">
              returning from {destinationIndex.get(incomingFrom)?.name ?? incomingFrom}
            </span>
          </div>
        )}

        <button
          type="button"
          className={`orbit-core-label ${selectedId === 'orbit' ? 'is-active' : ''}`}
          disabled={interactionLocked}
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
              className={[
                'destination-node',
                selectedId === destination.id ? 'is-selected' : '',
                travelId === destination.id ? 'is-travel-target' : '',
              ].filter(Boolean).join(' ')}
              onClick={() => focusDestination(destination)}
              aria-pressed={selectedId === destination.id}
            >
              <span className="node-pulse" />
              <span className="node-landmark" aria-hidden="true">
                <DestinationIcon id={destination.id} size={18} />
              </span>
              <span className="node-copy">
                <span className="node-code">{destination.code}</span>
                <strong>{destination.name}</strong>
              </span>
            </button>
          ))}
        </div>

        <aside
          className={`world-inspector ${selected ? 'has-selection' : ''}`}
          aria-hidden={travelPhase !== 'idle' || Boolean(incomingFrom)}
        >
          <div className="inspector-topline">
            <span>{selected ? selected.code : 'ORBIT'}</span>
            <span className={`route-state ${selected?.href ? 'is-live' : selected ? 'is-staged' : ''}`}>
              {selected ? (selected.href ? 'connected' : 'staged') : 'central world'}
            </span>
          </div>

          <h2>{selected ? selected.name : 'Your ARROW system'}</h2>
          <p>
            {selected
              ? selected.description
              : 'Drag the world, choose a landmark, or use Navigator to move through ARROW.'}
          </p>

          <div className="world-control-row" aria-label="World controls">
            <span className="control-hint" title="Drag the world to rotate it">
              <RotateWorldIcon size={15} />
              <span>drag</span>
            </span>
            <button type="button" onClick={recenterWorld} disabled={interactionLocked} title="Recenter Orbit">
              <TargetIcon size={15} />
              <span>recenter</span>
            </button>
            <button type="button" onClick={() => changeZoom(-0.1)} disabled={interactionLocked} title="Zoom out">
              <ZoomOutIcon size={15} />
              <span className="sr-only">Zoom out</span>
            </button>
            <button type="button" onClick={() => changeZoom(0.1)} disabled={interactionLocked} title="Zoom in">
              <ZoomInIcon size={15} />
              <span className="sr-only">Zoom in</span>
            </button>
            <button
              type="button"
              onClick={() => {
                pointerRef.current.inside = false;
                setNavigatorOpen(true);
              }}
              disabled={interactionLocked}
              title="Open ARROW Navigator"
            >
              <SearchIcon size={15} />
              <span>navigator</span>
              <kbd><CommandIcon size={11} />K</kbd>
            </button>
          </div>

          <div className="inspector-actions">
            {selected ? (
              <button type="button" className="focus-button travel-button" onClick={launchDestination}>
                Travel to {selected.name}
                <ArrowUpRightIcon size={14} />
              </button>
            ) : (
              <button
                type="button"
                className="focus-button"
                onClick={() => {
                  impulseRef.current = 1;
                }}
              >
                <PulseIcon size={14} />
                Pulse field
              </button>
            )}
            <span className="handoff-state">
              {selected ? (selected.href ? 'route connected' : 'route not connected yet') : 'select a destination'}
            </span>
          </div>
        </aside>

        {travelingTo && (
          <section className="destination-preview" aria-live="polite" aria-hidden={travelPhase !== 'preview'}>
            <div className="arrival-landmark" aria-hidden="true">
              <DestinationIcon id={travelingTo.id} size={42} />
            </div>
            <p className="arrival-code">{travelingTo.code}</p>
            <h2>{travelingTo.name}</h2>
            <p className="arrival-line">{travelingTo.arrivalLine}</p>

            <div className="arrival-actions">
              {travelingTo.href ? (
                <a className="arrival-primary is-live" href={travelingTo.href}>
                  Open {travelingTo.name}
                  <ArrowUpRightIcon size={14} />
                </a>
              ) : (
                <button type="button" className="arrival-primary" disabled>
                  Route not connected
                </button>
              )}
              <button type="button" className="arrival-return" onClick={returnToOrbit}>
                <ArrowLeftIcon size={14} />
                Back to Orbit
              </button>
            </div>
          </section>
        )}

        {isTraveling && (
          <div className="travel-status" aria-live="polite">
            <span className="travel-status-dot" />
            {travelPhase === 'returning'
              ? 'returning to Orbit'
              : `traveling to ${travelingTo?.name ?? 'destination'}`}
          </div>
        )}

        <div className="stage-footer">
          <span><RotateWorldIcon size={13} /> drag to rotate</span>
          <span><SearchIcon size={13} /> Navigator</span>
        </div>
      </div>

      {navigatorOpen && travelPhase === 'idle' && !incomingFrom && (
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
          <section
            ref={navigatorRef}
            className="orbit-navigator"
            role="dialog"
            aria-modal="true"
            aria-label="Orbit navigator"
            onKeyDown={handleNavigatorKeyDown}
          >
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
                <CloseIcon size={16} />
              </button>
            </div>

            <label className="navigator-search">
              <SearchIcon size={17} />
              <input
                ref={navigatorInputRef}
                value={navigatorQuery}
                onChange={event => setNavigatorQuery(event.target.value)}
                placeholder="Search ARROW destinations"
                aria-label="Search ARROW destinations"
              />
              <kbd>/</kbd>
            </label>

            <div className="navigator-results">
              {filteredDestinations.map(destination => (
                <button
                  type="button"
                  key={destination.id}
                  className="navigator-result"
                  onClick={() => chooseFromNavigator(destination)}
                >
                  <span className="navigator-index">0{destination.shortcut}</span>
                  <span className="navigator-result-icon" aria-hidden="true">
                    <DestinationIcon id={destination.id} size={18} />
                  </span>
                  <span className="navigator-result-copy">
                    <strong>{destination.name}</strong>
                    <span>{destination.code}</span>
                  </span>
                  <span className="navigator-result-description">{destination.description}</span>
                  <span className={`navigator-route ${destination.href ? 'is-live' : 'is-staged'}`}>
                    {destination.href ? 'connected' : 'staged'}
                  </span>
                  <ArrowUpRightIcon size={15} />
                </button>
              ))}

              {filteredDestinations.length === 0 && (
                <div className="navigator-empty">
                  No ARROW destination matches “{navigatorQuery}”.
                </div>
              )}
            </div>

            <footer className="navigator-footer">
              <span><kbd>1–4</kbd> focus destination</span>
              <span><kbd>O</kbd> recenter Orbit</span>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
