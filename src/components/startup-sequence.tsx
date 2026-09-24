'use client';

import { ARROW_MARK_PATH } from '@/components/orbit-icons';
import { readIncomingArrowSource } from '@/lib/arrow-map';
import { useEffect, useRef, useState } from 'react';

const STARTUP_SESSION_KEY = 'orbit-startup-seen';

type Particle = {
  targetX: number;
  targetY: number;
  burstX: number;
  burstY: number;
  radius: number;
  delay: number;
};

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - value, 3);
}

function easeInOutCubic(value: number) {
  return value < 0.5
    ? 4 * value * value * value
    : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function drawArrowMark(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  size: number,
) {
  const path = new Path2D(ARROW_MARK_PATH);
  ctx.save();
  ctx.translate(x - size / 2, y - size / 2);
  ctx.scale(size / 24, size / 24);
  ctx.fill(path);
  ctx.restore();
}

function ParticleWordmark({
  active,
  onFormed,
}: {
  active: boolean;
  onFormed: () => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const onFormedRef = useRef(onFormed);

  useEffect(() => {
    onFormedRef.current = onFormed;
  }, [onFormed]);

  useEffect(() => {
    if (!active || !canvasRef.current) return;

    const canvas = canvasRef.current;
    const context = canvas.getContext('2d');
    if (!context) return;

    let animationFrame = 0;
    let resizeTimer = 0;
    let cancelled = false;
    let formationReported = false;
    let buildVersion = 0;
    const sequenceStartedAt = performance.now();

    const buildAnimation = () => {
      buildVersion += 1;
      const version = buildVersion;
      window.cancelAnimationFrame(animationFrame);

      const width = window.innerWidth;
      const height = window.innerHeight;
      const density = Math.min(window.devicePixelRatio || 1, 2);

      let seed = 982451653;
      const random = () => {
        seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
        return (seed >>> 0) / 4294967296;
      };

      canvas.width = Math.floor(width * density);
      canvas.height = Math.floor(height * density);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(density, 0, 0, density, 0, 0);

      const targetCanvas = document.createElement('canvas');
      targetCanvas.width = width;
      targetCanvas.height = height;
      const targetContext = targetCanvas.getContext('2d', {
        willReadFrequently: true,
      });
      if (!targetContext) return;

      const wordSize = Math.max(58, Math.min(92, width * 0.16));
      const markSize = wordSize * 0.86;
      const gap = Math.max(13, Math.min(22, width * 0.025));
      const letterSpacing = wordSize * -0.055;
      const centerY = height / 2;
      const word = 'Orbit';
      const font = `600 ${wordSize}px system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif`;

      targetContext.fillStyle = '#ffffff';
      targetContext.textAlign = 'left';
      targetContext.textBaseline = 'middle';
      targetContext.font = font;

      const glyphWidths = Array.from(word, character =>
        targetContext.measureText(character).width,
      );
      const textWidth =
        glyphWidths.reduce((total, glyphWidth) => total + glyphWidth, 0) +
        letterSpacing * (glyphWidths.length - 1);
      const groupWidth = markSize + gap + textWidth;
      const groupLeft = width / 2 - groupWidth / 2;
      const textX = groupLeft + markSize + gap;

      drawArrowMark(
        targetContext,
        groupLeft + markSize / 2,
        centerY,
        markSize,
      );

      let cursorX = textX;
      Array.from(word).forEach((character, index) => {
        targetContext.fillText(character, cursorX, centerY);
        cursorX += glyphWidths[index]! + letterSpacing;
      });

      const pixels = targetContext.getImageData(0, 0, width, height).data;
      const destinations: Array<{ x: number; y: number }> = [];
      const sampleStep = width < 520 ? 5 : 4;

      for (let y = 0; y < height; y += sampleStep) {
        for (let x = 0; x < width; x += sampleStep) {
          if ((pixels[(y * width + x) * 4 + 3] ?? 0) > 110) {
            destinations.push({ x, y });
          }
        }
      }

      for (let index = destinations.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(random() * (index + 1));
        [destinations[index], destinations[swapIndex]] = [
          destinations[swapIndex]!,
          destinations[index]!,
        ];
      }

      const limit = width < 520 ? 850 : 1500;
      const particles: Particle[] = destinations
        .slice(0, limit)
        .map((destination, index) => {
          const angle = random() * Math.PI * 2;
          const distance =
            52 + random() * Math.min(210, width * 0.26);

          return {
            targetX: destination.x,
            targetY: destination.y,
            burstX: width / 2 + Math.cos(angle) * distance,
            burstY: centerY + Math.sin(angle) * distance,
            radius: 0.7 + random() * 0.9,
            delay: (index % 19) * 6 + random() * 55,
          };
        });

      const draw = (now: number) => {
        if (cancelled || version !== buildVersion) return;

        const elapsed = now - sequenceStartedAt;
        context.clearRect(0, 0, width, height);
        context.fillStyle = '#ffffff';

        const solidProgress = easeInOutCubic(
          clamp01((elapsed - 1780) / 260),
        );

        for (const particle of particles) {
          const burstProgress = easeOutCubic(clamp01(elapsed / 430));
          const settleProgress = easeInOutCubic(
            clamp01((elapsed - 260 - particle.delay) / 1320),
          );
          const burstX =
            width / 2 +
            (particle.burstX - width / 2) * burstProgress;
          const burstY =
            centerY +
            (particle.burstY - centerY) * burstProgress;
          const x =
            burstX +
            (particle.targetX - burstX) * settleProgress;
          const y =
            burstY +
            (particle.targetY - burstY) * settleProgress;
          const alpha =
            Math.min(1, elapsed / 130) *
            (0.48 + settleProgress * 0.52) *
            (1 - solidProgress);
          const radius =
            particle.radius * (1 - settleProgress * 0.12);

          context.globalAlpha = alpha;
          context.beginPath();
          context.arc(x, y, radius, 0, Math.PI * 2);
          context.fill();
        }

        if (solidProgress > 0) {
          context.globalAlpha = solidProgress;
          context.drawImage(targetCanvas, 0, 0);
        }

        context.globalAlpha = 1;

        if (!formationReported && elapsed >= 2050) {
          formationReported = true;
          onFormedRef.current();
        }

        if (elapsed < 2350) {
          animationFrame = window.requestAnimationFrame(draw);
        } else {
          context.clearRect(0, 0, width, height);
          context.drawImage(targetCanvas, 0, 0);
        }
      };

      animationFrame = window.requestAnimationFrame(draw);
    };

    const handleResize = () => {
      window.clearTimeout(resizeTimer);
      resizeTimer = window.setTimeout(buildAnimation, 120);
    };

    buildAnimation();
    window.addEventListener('resize', handleResize);

    return () => {
      cancelled = true;
      buildVersion += 1;
      window.clearTimeout(resizeTimer);
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener('resize', handleResize);
    };
  }, [active]);

  return (
    <canvas
      ref={canvasRef}
      className={`startup-particle-canvas ${active ? 'is-active' : ''}`}
      aria-hidden="true"
    />
  );
}

export function StartupSequence() {
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(false);
  const [activated, setActivated] = useState(false);
  const [formed, setFormed] = useState(false);
  const [finished, setFinished] = useState(false);

  const focusOrbitCore = () => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(() => {
        document.querySelector<HTMLButtonElement>('.orbit-core-label')?.focus({
          preventScroll: true,
        });
      });
    });
  };

  const dismissIntro = () => {
    sessionStorage.setItem(STARTUP_SESSION_KEY, '1');
    setVisible(false);
    focusOrbitCore();
  };

  useEffect(() => {
    const motionQuery = window.matchMedia(
      '(prefers-reduced-motion: reduce)',
    );

    const resolveVisibility = () => {
      const source = readIncomingArrowSource(window.location.search);
      const shouldSkip =
        Boolean(source) ||
        motionQuery.matches ||
        sessionStorage.getItem(STARTUP_SESSION_KEY) === '1';

      if (source || motionQuery.matches) {
        sessionStorage.setItem(STARTUP_SESSION_KEY, '1');
      }

      setReady(true);
      setVisible(!shouldSkip);
    };

    const timer = window.setTimeout(resolveVisibility, 0);
    const handleMotionChange = () => {
      if (motionQuery.matches) {
        setFinished(true);
        dismissIntro();
      }
    };

    motionQuery.addEventListener('change', handleMotionChange);

    return () => {
      window.clearTimeout(timer);
      motionQuery.removeEventListener('change', handleMotionChange);
    };
  }, []);

  useEffect(() => {
    if (!ready || !visible) return;

    const app = document.querySelector<HTMLElement>('.orbit-app');
    const previousAriaHidden = app?.getAttribute('aria-hidden');

    app?.setAttribute('inert', '');
    app?.setAttribute('aria-hidden', 'true');

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;
      event.preventDefault();
      dismissIntro();
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      app?.removeAttribute('inert');

      if (previousAriaHidden === null || previousAriaHidden === undefined) {
        app?.removeAttribute('aria-hidden');
      } else {
        app?.setAttribute('aria-hidden', previousAriaHidden);
      }
    };
  }, [ready, visible]);

  useEffect(() => {
    if (!activated) return;

    const finishTimer = window.setTimeout(() => {
      sessionStorage.setItem(STARTUP_SESSION_KEY, '1');
      setFinished(true);
    }, 3550);

    const removeTimer = window.setTimeout(() => {
      setVisible(false);
      focusOrbitCore();
    }, 4200);

    return () => {
      window.clearTimeout(finishTimer);
      window.clearTimeout(removeTimer);
    };
  }, [activated]);

  if (!ready || !visible) return null;

  return (
    <div
      className={`startup-shell ${finished ? 'is-finished' : ''}`}
      role="dialog"
      aria-modal="true"
      aria-label="Orbit introduction"
    >
      <button type="button" onClick={dismissIntro} className="startup-skip">
        Skip intro
      </button>

      <button
        type="button"
        aria-label="Start Orbit intro"
        autoFocus
        disabled={activated}
        onClick={() => setActivated(true)}
        className="startup-trigger"
      >
        <span className={`startup-core ${activated ? 'is-active' : ''}`}>
          <span className="startup-orbit orbit-one" />
          <span className="startup-orbit orbit-two" />
          <span className="startup-dot" />
          {!activated && (
            <span className="startup-prompt">enter orbit</span>
          )}
        </span>
      </button>

      <ParticleWordmark
        active={activated}
        onFormed={() => setFormed(true)}
      />

      <div
        className={`startup-copy ${formed ? 'is-formed' : ''}`}
        aria-hidden={!formed}
      >
        <p>the center of ARROW.</p>
      </div>
    </div>
  );
}
