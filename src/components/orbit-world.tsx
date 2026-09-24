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
  clamp,
  drawOrbitSegments,
  nearestEquivalentAngle,
  projectAnchor,
  projectPoint,
  resolveSafeScreenPosition,
  resolveScreenCollisions,
  smoothstep,
  type ScreenRect,
} from '@/lib/orbit-spatial';
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
type RenderProfile = 'high' | 'balanced' | 'low';

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

type TouchPoint = { x: number; y: number };

const destinations = ARROW_DESTINATIONS;
const destinationIndex = ARROW_DESTINATION_BY_ID;

function DestinationIcon({ id, size = 18 }: { id: Destination['id']; size?: number }) {
  if (id === 'atlas') return <CompassIcon size={size} />;
  if (id === 'ravin') return <CoreIcon size={size} />;
  if (id === 'relay') return <RadioTowerIcon size={size} />;
  return <FutureNodeIcon size={size} />;
}

function relativeRect(
  shell: HTMLElement,
  element: HTMLElement | null,
): ScreenRect | null {
  if (!element) return null;
  const shellRect = shell.getBoundingClientRect();
  const rect = element.getBoundingClientRect();

  return {
    left: rect.left - shellRect.left,
    top: rect.top - shellRect.top,
    right: rect.right - shellRect.left,
    bottom: rect.bottom - shellRect.top,
  };
}

export function OrbitWorld() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const shellRef = useRef<HTMLDivElement>(null);
  const stageCopyRef = useRef<HTMLDivElement>(null);
  const inspectorRef = useRef<HTMLElement>(null);
  const craftRef = useRef<HTMLDivElement>(null);
  const coreRef = useRef<HTMLButtonElement>(null);
  const arrivalPanelRef = useRef<HTMLElement>(null);
  const navigatorRef = useRef<HTMLElement>(null);
  const navigatorInputRef = useRef<HTMLInputElement>(null);
  const shortcutRailRef = useRef<HTMLElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const previousTravelPhaseRef = useRef<TravelPhase>('idle');

  const nodeRefs = useRef<Partial<Record<Destination['id'], HTMLButtonElement | null>>>({});
  const linkRefs = useRef<Partial<Record<Destination['id'], SVGLineElement | null>>>({});
  const nodeFrontRef = useRef<Partial<Record<Destination['id'], boolean>>>({});
  const nodeSideRef = useRef<Partial<Record<Destination['id'], 'left' | 'right'>>>({});
  const selectedBackSinceRef = useRef<number | null>(null);
  const restoreNavigatorFocusRef = useRef(true);

  const pointerRef = useRef({ x: 0, y: 0, inside: false });
  const touchPointersRef = useRef(new Map<number, TouchPoint>());
  const pinchRef = useRef({ active: false, distance: 0, startZoom: 1 });
  const impulseRef = useRef(0);
  const zoomRef = useRef({ current: 1, target: 1 });
  const autoYawRef = useRef(0);
  const autoResumeAtRef = useRef(0);
  const craftAngleRef = useRef(-0.8);
  const timersRef = useRef<number[]>([]);
  const safeRectsRef = useRef<ScreenRect[]>([]);
  const reducedMotionRef = useRef(false);
  const perfDowngradedRef = useRef(false);

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
  const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);
  const [renderProfile, setRenderProfile] = useState<RenderProfile>('balanced');
  const [usesCommandKey, setUsesCommandKey] = useState(true);

  const renderer = useMemo(() => {
    const density =
      renderProfile === 'high' ? 0.92 :
      renderProfile === 'balanced' ? 0.72 :
      0.52;

    return createCloudRenderer(false, { density, size: 1.02 });
  }, [renderProfile]);

  const selected = selectedId === 'orbit' ? null : destinationIndex.get(selectedId) ?? null;
  const travelingTo = travelId ? destinationIndex.get(travelId) ?? null : null;
  const isTraveling = travelPhase === 'launching' || travelPhase === 'returning';
  const interactionLocked =
    travelPhase !== 'idle' ||
    incomingFrom !== null ||
    navigatorOpen;

  const beginReturnToOrbit = () => {
    const ui = uiRef.current;
    if (ui.travelPhase !== 'preview' || !ui.travelId) return;

    timersRef.current.forEach(timer => window.clearTimeout(timer));
    timersRef.current = [];
    setTravelPhase('returning');
    impulseRef.current = 1;

    const duration = reducedMotionRef.current ? 80 : 1050;
    timersRef.current.push(
      window.setTimeout(() => {
        setTravelPhase('idle');
        setTravelId(null);
        setSelectedId('orbit');
        setFlightPath({ startX: 0, startY: 0, targetX: 0, targetY: 0 });
        impulseRef.current = 0.65;
      }, duration),
    );
  };

  useEffect(() => {
    uiRef.current = { selectedId, travelPhase, travelId, incomingFrom, navigatorOpen };
  }, [incomingFrom, navigatorOpen, selectedId, travelId, travelPhase]);

  useEffect(() => {
    const motionQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
    const coarseQuery = window.matchMedia('(pointer: coarse)');

    const updateRuntimeProfile = () => {
      const reduceMotion = motionQuery.matches;
      reducedMotionRef.current = reduceMotion;
      setPrefersReducedMotion(reduceMotion);

      const hardwareConcurrency = navigator.hardwareConcurrency || 4;
      const deviceMemory =
        (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
      const lowMemory =
        typeof deviceMemory === 'number' && deviceMemory <= 4;
      const highMemory =
        typeof deviceMemory !== 'number' || deviceMemory >= 8;

      const lowPower =
        reduceMotion ||
        coarseQuery.matches ||
        hardwareConcurrency <= 4 ||
        lowMemory;

      const highPower =
        !reduceMotion &&
        !coarseQuery.matches &&
        hardwareConcurrency >= 10 &&
        highMemory;

      setRenderProfile(lowPower ? 'low' : highPower ? 'high' : 'balanced');
      setUsesCommandKey(
        /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent),
      );
    };

    updateRuntimeProfile();
    motionQuery.addEventListener('change', updateRuntimeProfile);
    coarseQuery.addEventListener('change', updateRuntimeProfile);

    return () => {
      motionQuery.removeEventListener('change', updateRuntimeProfile);
      coarseQuery.removeEventListener('change', updateRuntimeProfile);
    };
  }, []);

  useEffect(() => {
    return () => {
      timersRef.current.forEach(timer => window.clearTimeout(timer));
    };
  }, []);

  useEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;

    const updateRects = () => {
      const header = document.querySelector<HTMLElement>('.orbit-header');
      safeRectsRef.current = [
        relativeRect(shell, header),
        relativeRect(shell, stageCopyRef.current),
        relativeRect(shell, inspectorRef.current),
        relativeRect(shell, shortcutRailRef.current),
      ].filter((rect): rect is ScreenRect => rect !== null);
    };

    const observer = new ResizeObserver(updateRects);
    if (stageCopyRef.current) observer.observe(stageCopyRef.current);
    if (inspectorRef.current) observer.observe(inspectorRef.current);
    if (shortcutRailRef.current) observer.observe(shortcutRailRef.current);
    observer.observe(shell);

    updateRects();
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    const incoming = readIncomingArrowSource(window.location.search);
    if (!incoming) return;

    const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (reduced) {
      const url = new URL(window.location.href);
      url.searchParams.delete('from');
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
      return;
    }

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

    restoreNavigatorFocusRef.current = true;
    previousFocusRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const focusTimer = window.setTimeout(() => navigatorInputRef.current?.focus(), 0);

    return () => {
      window.clearTimeout(focusTimer);
      if (restoreNavigatorFocusRef.current) {
        previousFocusRef.current?.focus({ preventScroll: true });
      }
      restoreNavigatorFocusRef.current = true;
      previousFocusRef.current = null;
    };
  }, [navigatorOpen]);

  useEffect(() => {
    const previous = previousTravelPhaseRef.current;
    previousTravelPhaseRef.current = travelPhase;

    if (travelPhase === 'idle' && previous === 'returning') {
      const frame = window.requestAnimationFrame(() => {
        coreRef.current?.focus({ preventScroll: true });
      });

      return () => window.cancelAnimationFrame(frame);
    }
  }, [travelPhase]);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const ui = uiRef.current;
      const target = event.target as HTMLElement | null;
      const isTyping =
        target?.matches('input, textarea, select, [contenteditable="true"]') ?? false;

      if (event.key === 'Escape' && ui.navigatorOpen) {
        event.preventDefault();
        setNavigatorOpen(false);
        setNavigatorQuery('');
        return;
      }

      if (event.key === 'Escape' && ui.travelPhase === 'preview') {
        event.preventDefault();
        beginReturnToOrbit();
        return;
      }

      if (ui.incomingFrom || ui.travelPhase !== 'idle') return;

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setNavigatorOpen(open => !open);
        return;
      }

      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (ui.navigatorOpen || isTyping) return;

      if (event.key === '/') {
        event.preventDefault();
        setNavigatorOpen(true);
        return;
      }

      if (/^[1-4]$/.test(event.key)) {
        event.preventDefault();
        const shortcut = Number(event.key);
        const destination = destinations.find(item => item.shortcut === shortcut);
        if (destination) focusDestination(destination, 0.8);
        return;
      }

      if (event.key.toLowerCase() === 'o') {
        event.preventDefault();
        recenterWorld();
      }
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
    let running = true;
    let width = 1;
    let height = 1;
    let hover = 0;
    let impulse = 0;
    let travelMix = 0;
    let lastFrame = performance.now();
    let sampleStarted = performance.now();
    let sampleFrames = 0;

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
      if (!running || document.hidden) return;

      const dt = Math.min(0.05, Math.max(0, (now - lastFrame) / 1000));
      lastFrame = now;

      const time = now / 1000;
      const pointer = pointerRef.current;
      const rotation = rotationRef.current;
      const ui = uiRef.current;
      const reduced = reducedMotionRef.current;
      const locked =
        ui.travelPhase !== 'idle' ||
        ui.incomingFrom !== null ||
        ui.navigatorOpen;

      if (!rotation.dragging && !locked) {
        rotation.targetYaw += rotation.velocityYaw;
        rotation.targetPitch = clamp(
          rotation.targetPitch + rotation.velocityPitch,
          -0.72,
          0.72,
        );
        rotation.velocityYaw *= 0.945;
        rotation.velocityPitch *= 0.92;
      }

      if (
        ui.selectedId === 'orbit' &&
        !rotation.dragging &&
        !locked &&
        !reduced &&
        now >= autoResumeAtRef.current
      ) {
        autoYawRef.current += dt * 0.052;
      }

      if (!locked && !reduced) {
        craftAngleRef.current += dt * 0.24;
      }

      rotation.yaw += (rotation.targetYaw - rotation.yaw) * (reduced ? 1 : 0.12);
      rotation.pitch += (rotation.targetPitch - rotation.pitch) * (reduced ? 1 : 0.12);

      const zoom = zoomRef.current;
      zoom.current += (zoom.target - zoom.current) * (reduced ? 1 : 0.11);

      hover +=
        ((pointer.inside && !locked && !rotation.dragging && !reduced ? 1 : 0) - hover) *
        0.075;
      impulse += (impulseRef.current - impulse) * 0.14;
      impulseRef.current *= 0.91;

      const travelTarget =
        ui.travelPhase === 'launching' || ui.travelPhase === 'preview' ? 1 : 0;
      travelMix += (travelTarget - travelMix) * (reduced ? 1 : 0.055);

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
      const worldPitch =
        (reduced ? 0 : Math.sin(time * 0.14) * 0.028) +
        rotation.pitch;
      const worldRoll = reduced ? 0 : Math.sin(time * 0.09) * 0.016;

      const sphereRadius =
        Math.min(width * 0.228, height * 0.258, 292) *
        worldScale;

      drawOrbitSegments(
        ctx,
        'back',
        worldYaw,
        worldPitch,
        worldRoll,
        sphereRadius,
        centerX,
        centerY,
      );

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
        reduceMotion: reduced,
      });

      drawOrbitSegments(
        ctx,
        'front',
        worldYaw,
        worldPitch,
        worldRoll,
        sphereRadius,
        centerX,
        centerY,
      );

      const rawNodes = destinations.map(destination => {
        const projected = projectAnchor(
          destination.anchor,
          worldYaw,
          worldPitch,
          worldRoll,
          sphereRadius,
          centerX,
          centerY,
        );

        const mobile = width < 680;
        const position = resolveSafeScreenPosition(
          projected.x,
          projected.y,
          safeRectsRef.current,
          {
            left: mobile ? 66 : 94,
            top: mobile ? 70 : 62,
            right: width - (mobile ? 66 : 94),
            bottom: height - (mobile ? 86 : 68),
          },
          mobile ? 38 : 48,
          4,
        );

        return {
          destination,
          ...projected,
          x: position.x,
          y: position.y,
        };
      });

      const projectedNodes = resolveScreenCollisions(
        rawNodes,
        width < 680 ? 82 : 112,
        centerX,
        centerY,
      ).map(projected => {
        const mobile = width < 680;
        const settled = resolveSafeScreenPosition(
          projected.x,
          projected.y,
          safeRectsRef.current,
          {
            left: mobile ? 66 : 94,
            top: mobile ? 70 : 62,
            right: width - (mobile ? 66 : 94),
            bottom: height - (mobile ? 86 : 68),
          },
          mobile ? 38 : 48,
          3,
        );

        return { ...projected, ...settled };
      });

      for (const projected of projectedNodes) {
        const destination = projected.destination;
        const node = nodeRefs.current[destination.id];
        if (!node) continue;

        const frontness = smoothstep(0.32, 0.56, projected.depth);
        const currentFront =
          nodeFrontRef.current[destination.id] ??
          projected.depth >= 0.42;

        const nextFront = currentFront
          ? projected.depth > 0.32
          : projected.depth >= 0.46;

        nodeFrontRef.current[destination.id] = nextFront;

        if (ui.selectedId === destination.id) {
          if (!nextFront && projected.depth < 0.34) {
            selectedBackSinceRef.current ??= now;
            if (now - selectedBackSinceRef.current > 240) {
              setSelectedId('orbit');
              selectedBackSinceRef.current = null;

              if (document.activeElement === node) {
                window.requestAnimationFrame(() => {
                  coreRef.current?.focus({ preventScroll: true });
                });
              }
            }
          } else {
            selectedBackSinceRef.current = null;
          }
        }

        node.style.setProperty('--node-x', `${projected.x}px`);
        node.style.setProperty('--node-y', `${projected.y}px`);
        node.style.setProperty(
          '--node-scale',
          (0.84 + projected.depth * 0.22).toFixed(3),
        );
        node.style.setProperty(
          '--node-opacity',
          (0.035 + frontness * 0.965).toFixed(3),
        );
        node.style.setProperty(
          '--label-opacity',
          smoothstep(0.4, 0.57, projected.depth).toFixed(3),
        );
        node.style.zIndex = String(
          ui.travelId === destination.id
            ? 35
            : 18 + Math.round(projected.depth * 7),
        );
        const currentSide =
          nodeSideRef.current[destination.id] ??
          (projected.x < centerX ? 'left' : 'right');
        const sideDeadzone = width < 680 ? 20 : 30;
        const nextSide =
          currentSide === 'left'
            ? projected.x > centerX + sideDeadzone ? 'right' : 'left'
            : projected.x < centerX - sideDeadzone ? 'left' : 'right';

        nodeSideRef.current[destination.id] = nextSide;
        node.dataset.side = nextSide;
        node.dataset.backface = nextFront ? 'false' : 'true';
        node.tabIndex = locked || !nextFront ? -1 : 0;
        node.style.pointerEvents = locked || !nextFront ? 'none' : 'auto';

        const link = linkRefs.current[destination.id];
        if (link) {
          const dx = projected.x - centerX;
          const dy = projected.y - centerY;
          link.setAttribute('x1', String(centerX + dx * 0.2));
          link.setAttribute('y1', String(centerY + dy * 0.2));
          link.setAttribute('x2', String(centerX + dx * 0.84));
          link.setAttribute('y2', String(centerY + dy * 0.84));

          const linkVisible = projected.z > 0.02;
          link.style.opacity = linkVisible
            ? String(
                ui.selectedId === destination.id
                  ? 0.58
                  : 0.06 + frontness * 0.13,
              )
            : '0';
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

      const craftPoint = projectPoint(
        craftAnchor,
        worldYaw,
        worldPitch,
        worldRoll,
        sphereRadius,
        centerX,
        centerY,
      );
      const nextCraftPoint = projectPoint(
        nextCraftAnchor,
        worldYaw,
        worldPitch,
        worldRoll,
        sphereRadius,
        centerX,
        centerY,
      );
      const craftRotation =
        Math.atan2(
          nextCraftPoint.y - craftPoint.y,
          nextCraftPoint.x - craftPoint.x,
        ) *
        (180 / Math.PI);

      const craftDistance = Math.hypot(
        craftPoint.x - centerX,
        craftPoint.y - centerY,
      );
      const behindDisc =
        craftPoint.z < 0 &&
        craftDistance < sphereRadius * 1.015;
      const craftOcclusion = behindDisc
        ? smoothstep(-0.02, 0.12, craftPoint.z)
        : 1;

      if (craftRef.current) {
        craftRef.current.style.setProperty('--craft-x', `${craftPoint.x}px`);
        craftRef.current.style.setProperty('--craft-y', `${craftPoint.y}px`);
        craftRef.current.style.setProperty(
          '--craft-rotation',
          `${craftRotation}deg`,
        );
        craftRef.current.style.setProperty(
          '--craft-depth',
          craftPoint.depth.toFixed(3),
        );
        craftRef.current.style.setProperty(
          '--craft-opacity',
          ((0.38 + craftPoint.depth * 0.62) * craftOcclusion).toFixed(3),
        );
      }

      sampleFrames += 1;
      if (now - sampleStarted >= 2400) {
        const fps = (sampleFrames * 1000) / (now - sampleStarted);
        sampleStarted = now;
        sampleFrames = 0;

        if (
          fps < 43 &&
          renderProfile !== 'low' &&
          !perfDowngradedRef.current
        ) {
          perfDowngradedRef.current = true;
          setRenderProfile('low');
        }
      }

      frame = window.requestAnimationFrame(draw);
    };

    const start = () => {
      if (!running || document.hidden) return;
      lastFrame = performance.now();
      frame = window.requestAnimationFrame(draw);
    };

    const handleVisibilityChange = () => {
      window.cancelAnimationFrame(frame);
      if (!document.hidden) start();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    start();

    return () => {
      running = false;
      observer.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.cancelAnimationFrame(frame);
    };
  }, [renderer, renderProfile]);

  const handlePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (interactionLocked) return;

    const bounds = event.currentTarget.getBoundingClientRect();
    pointerRef.current = {
      x: event.clientX - bounds.left,
      y: event.clientY - bounds.top,
      inside: true,
    };

    if (event.pointerType === 'touch') {
      const touches = touchPointersRef.current;
      if (touches.has(event.pointerId)) {
        touches.set(event.pointerId, { x: event.clientX, y: event.clientY });
      }

      if (touches.size >= 2) {
        const [a, b] = Array.from(touches.values());
        if (!a || !b) return;

        const distance = Math.hypot(b.x - a.x, b.y - a.y);
        if (!pinchRef.current.active) {
          pinchRef.current = {
            active: true,
            distance,
            startZoom: zoomRef.current.target,
          };
        }

        if (pinchRef.current.distance > 1) {
          zoomRef.current.target = clamp(
            pinchRef.current.startZoom *
              (distance / pinchRef.current.distance),
            0.82,
            1.22,
          );
        }

        rotationRef.current.dragging = false;
        setDragging(false);
        return;
      }
    }

    const rotation = rotationRef.current;
    if (!rotation.dragging || rotation.pointerId !== event.pointerId) return;

    const dx = event.clientX - rotation.lastX;
    const dy = event.clientY - rotation.lastY;
    rotation.lastX = event.clientX;
    rotation.lastY = event.clientY;

    const touchScale = event.pointerType === 'touch' ? 0.78 : 1;
    const yawDelta = dx * 0.0054 * touchScale;
    const pitchDelta = dy * 0.0045 * touchScale;
    rotation.targetYaw += yawDelta;
    rotation.targetPitch = clamp(
      rotation.targetPitch + pitchDelta,
      -0.72,
      0.72,
    );
    rotation.velocityYaw = yawDelta * (event.pointerType === 'touch' ? 0.28 : 0.42);
    rotation.velocityPitch = pitchDelta * (event.pointerType === 'touch' ? 0.22 : 0.32);
  };

  const handlePointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (interactionLocked || event.button !== 0) return;
    if ((event.target as HTMLElement).closest('button, input, a, [role="dialog"]')) return;

    if (event.pointerType === 'touch') {
      touchPointersRef.current.set(event.pointerId, {
        x: event.clientX,
        y: event.clientY,
      });
      event.currentTarget.setPointerCapture(event.pointerId);

      if (touchPointersRef.current.size >= 2) {
        const [a, b] = Array.from(touchPointersRef.current.values());
        if (a && b) {
          pinchRef.current = {
            active: true,
            distance: Math.hypot(b.x - a.x, b.y - a.y),
            startZoom: zoomRef.current.target,
          };
        }
        rotationRef.current.dragging = false;
        setDragging(false);
        return;
      }
    }

    const rotation = rotationRef.current;
    rotation.dragging = true;
    rotation.pointerId = event.pointerId;
    rotation.lastX = event.clientX;
    rotation.lastY = event.clientY;
    rotation.velocityYaw = 0;
    rotation.velocityPitch = 0;
    setDragging(true);

    if (!event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.setPointerCapture(event.pointerId);
    }
  };

  const endDrag = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.pointerType === 'touch') {
      touchPointersRef.current.delete(event.pointerId);

      if (touchPointersRef.current.size < 2) {
        pinchRef.current.active = false;
      }

      if (touchPointersRef.current.size === 1) {
        const [[pointerId, remaining]] = Array.from(
          touchPointersRef.current.entries(),
        );
        if (remaining) {
          const rotation = rotationRef.current;
          rotation.dragging = true;
          rotation.pointerId = pointerId;
          rotation.lastX = remaining.x;
          rotation.lastY = remaining.y;
          setDragging(true);
        }
      }
    }

    const rotation = rotationRef.current;
    if (rotation.pointerId === event.pointerId) {
      rotation.dragging = false;
      rotation.pointerId = null;
      setDragging(false);
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  };

  const handleWheel = (event: ReactWheelEvent<HTMLDivElement>) => {
    if (interactionLocked) return;
    if ((event.target as HTMLElement).closest('button, input, a, [role="dialog"]')) return;

    event.preventDefault();
    const deltaUnit =
      event.deltaMode === 1
        ? 16
        : event.deltaMode === 2
          ? Math.max(120, event.currentTarget.clientHeight)
          : 1;
    const normalizedDelta = clamp(event.deltaY * deltaUnit, -240, 240);

    zoomRef.current.target = clamp(
      zoomRef.current.target - normalizedDelta * 0.0007,
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
    const desiredWorldYaw = nearestEquivalentAngle(
      baseYaw + sideOffset,
      currentWorldYaw,
    );
    const forwardDepth = horizontal * Math.cos(sideOffset);
    const basePitch = Math.atan2(y, Math.max(0.001, forwardDepth));
    const desiredPitch = clamp(basePitch + 0.13, -0.58, 0.58);

    const rotation = rotationRef.current;
    rotation.targetYaw = desiredWorldYaw - autoYawRef.current;
    rotation.targetPitch = desiredPitch;
    rotation.velocityYaw = 0;
    rotation.velocityPitch = 0;
    autoResumeAtRef.current = performance.now() + 900;

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

  const openDestination = (destination: Destination) => {
    if (!destination.href) return;

    const url = new URL(destination.href);
    url.searchParams.set('from', 'orbit');
    window.location.assign(url.toString());
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

    const duration = reducedMotionRef.current ? 80 : 1450;
    timersRef.current.push(
      window.setTimeout(() => {
        setTravelPhase('preview');
        impulseRef.current = 0.8;
      }, duration),
    );
  };

  const returnToOrbit = beginReturnToOrbit;

  const recenterWorld = () => {
    if (incomingFrom || travelPhase !== 'idle') return;

    const rotation = rotationRef.current;
    rotation.yaw += autoYawRef.current;
    rotation.targetYaw += autoYawRef.current;
    autoYawRef.current = 0;

    rotation.targetYaw = nearestEquivalentAngle(0, rotation.targetYaw);
    rotation.targetPitch = 0;
    rotation.velocityYaw = 0;
    rotation.velocityPitch = 0;
    zoomRef.current.target = 1;
    autoResumeAtRef.current =
      performance.now() + (reducedMotionRef.current ? 0 : 850);

    setSelectedId('orbit');
    impulseRef.current = 0.7;
  };

  const filteredDestinations = destinations.filter(destination => {
    const query = navigatorQuery.trim().toLowerCase();
    if (!query) return true;

    return [
      String(destination.shortcut),
      destination.name,
      destination.code,
      destination.description,
      destination.detail,
    ]
      .join(' ')
      .toLowerCase()
      .includes(query);
  });

  const chooseFromNavigator = (destination: Destination) => {
    restoreNavigatorFocusRef.current = false;
    setNavigatorOpen(false);
    setNavigatorQuery('');
    window.setTimeout(() => focusDestination(destination, 0.9), 0);
  };

  const handleNavigatorKeyDown = (event: ReactKeyboardEvent<HTMLElement>) => {
    const results = Array.from(
      navigatorRef.current?.querySelectorAll<HTMLButtonElement>('.navigator-result') ?? [],
    );

    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      if (!results.length) return;
      event.preventDefault();

      const currentIndex = results.indexOf(document.activeElement as HTMLButtonElement);
      const direction = event.key === 'ArrowDown' ? 1 : -1;
      const nextIndex =
        currentIndex === -1
          ? direction > 0 ? 0 : results.length - 1
          : (currentIndex + direction + results.length) % results.length;

      results[nextIndex]?.focus();
      return;
    }

    if (
      event.key === 'Enter' &&
      document.activeElement === navigatorInputRef.current &&
      filteredDestinations[0]
    ) {
      event.preventDefault();
      chooseFromNavigator(filteredDestinations[0]);
      return;
    }

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
        prefersReducedMotion ? 'reduce-motion' : '',
        `render-${renderProfile}`,
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
      <div
        className="world-scene"
        aria-hidden={navigatorOpen ? true : undefined}
        inert={navigatorOpen ? true : undefined}
      >
        <div ref={stageCopyRef} className="stage-copy">
          <p className="eyebrow">CENTRAL WORLD</p>
          <h1>Everything starts here.</h1>
          <p className="stage-description">
            Move through ARROW as one connected system. The sphere is the map; each signal is a destination.
          </p>
        </div>

        <canvas ref={canvasRef} className="world-canvas" aria-hidden="true" />

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
          ref={coreRef}
          type="button"
          className={`orbit-core-label ${selectedId === 'orbit' ? 'is-active' : ''}`}
          disabled={interactionLocked}
          onClick={recenterWorld}
        >
          <span className="core-kicker">YOU ARE HERE</span>
          <span className="core-title">Orbit</span>
        </button>

        <nav
          ref={shortcutRailRef}
          className="orbit-shortcuts"
          aria-label="ARROW quick routes"
          aria-hidden={travelPhase !== 'idle' || Boolean(incomingFrom)}
          inert={travelPhase !== 'idle' || Boolean(incomingFrom) ? true : undefined}
        >
          <span className="orbit-shortcuts-label">Quick routes</span>
          <div className="orbit-shortcuts-list">
            {destinations.map(destination => (
              <button
                type="button"
                key={destination.id}
                className={`orbit-shortcut ${selectedId === destination.id ? 'is-active' : ''}`}
                onClick={() => focusDestination(destination, 0.75)}
                disabled={interactionLocked}
                aria-keyshortcuts={String(destination.shortcut)}
                aria-pressed={selectedId === destination.id}
                aria-label={`${destination.shortcut}: Focus ${destination.name}`}
                title={`${destination.shortcut} · ${destination.name}`}
              >
                <kbd>{destination.shortcut}</kbd>
                <DestinationIcon id={destination.id} size={14} />
                <span>{destination.name}</span>
              </button>
            ))}
          </div>
        </nav>

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
              aria-label={`${destination.name}, ${destination.code}. ${destination.detail}`}
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
          ref={inspectorRef}
          className={`world-inspector ${selected ? 'has-selection' : ''}`}
          aria-hidden={travelPhase !== 'idle' || Boolean(incomingFrom)}
          inert={travelPhase !== 'idle' || Boolean(incomingFrom) ? true : undefined}
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
            <button type="button" onClick={recenterWorld} disabled={interactionLocked} title="Recenter Orbit" aria-keyshortcuts="O">
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
              title={usesCommandKey ? 'Open ARROW Navigator (⌘K)' : 'Open ARROW Navigator (Ctrl+K)'}
              aria-keyshortcuts="Meta+K Control+K"
            >
              <SearchIcon size={15} />
              <span>navigator</span>
              <kbd>{usesCommandKey ? <CommandIcon size={11} /> : <span>Ctrl</span>}K</kbd>
            </button>
          </div>

          <div className="inspector-actions">
            {selected ? (
              <button
                type="button"
                className="focus-button travel-button"
                onClick={launchDestination}
              >
                {selected.href ? 'Travel to' : 'Preview'} {selected.name}
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
              {selected ? (selected.href ? 'route connected' : 'preview only · route staged') : 'select a destination'}
            </span>
          </div>
        </aside>

        {travelingTo && travelPhase !== 'launching' && (
          <section
            ref={arrivalPanelRef}
            className="destination-preview"
            role="region"
            aria-label={`${travelingTo.name} arrival`}
            aria-live="polite"
            aria-hidden={travelPhase !== 'preview'}
            tabIndex={-1}
            autoFocus={travelPhase === 'preview'}
          >
            <div className="arrival-landmark" aria-hidden="true">
              <DestinationIcon id={travelingTo.id} size={42} />
            </div>
            <p className="arrival-code">{travelingTo.code}</p>
            <h2>{travelingTo.name}</h2>
            <p className="arrival-line">{travelingTo.arrivalLine}</p>

            <div className="arrival-actions">
              {travelPhase === 'preview' && (
                <>
                  {travelingTo.href ? (
                    <button
                      type="button"
                      className="arrival-primary is-live"
                      onClick={() => openDestination(travelingTo)}
                    >
                      Open {travelingTo.name}
                      <ArrowUpRightIcon size={14} />
                    </button>
                  ) : (
                    <button type="button" className="arrival-primary" disabled>
                      Route staged
                    </button>
                  )}
                  <button
                    type="button"
                    className="arrival-return"
                    onClick={returnToOrbit}
                  >
                    <ArrowLeftIcon size={14} />
                    Back to Orbit
                  </button>
                </>
              )}
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
          <span>1–4 quick routes</span>
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
                  className={`navigator-result ${selectedId === destination.id ? 'is-current' : ''}`}
                  aria-current={selectedId === destination.id ? 'true' : undefined}
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
                  <TargetIcon size={15} />
                </button>
              ))}

              {filteredDestinations.length === 0 && (
                <div className="navigator-empty">
                  No ARROW destination matches “{navigatorQuery}”.
                </div>
              )}
            </div>

            <footer className="navigator-footer">
              <span><kbd>↑↓</kbd> browse</span>
              <span><kbd>Enter</kbd> select · <kbd>Esc</kbd> close</span>
            </footer>
          </section>
        </div>
      )}
    </div>
  );
}
