'use client';

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

function clamp(value: number) {
  return Math.max(0, Math.min(1, value));
}

function easeOutCubic(value: number) {
  return 1 - Math.pow(1 - value, 3);
}

function easeInOutCubic(value: number) {
  return value < 0.5 ? 4 * value * value * value : 1 - Math.pow(-2 * value + 2, 3) / 2;
}

function drawArrowMark(ctx: CanvasRenderingContext2D, x: number, y: number, size: number) {
  ctx.save();
  ctx.translate(x, y);
  ctx.beginPath();
  ctx.moveTo(-size * 0.42, -size * 0.24);
  ctx.lineTo(size * 0.48, 0);
  ctx.lineTo(-size * 0.42, size * 0.24);
  ctx.lineTo(-size * 0.16, 0);
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function ParticleWordmark({ active, onFormed }: { active: boolean; onFormed: () => void }) {
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
    let cancelled = false;
    let formationReported = false;

    const buildAnimation = () => {
      const width = window.innerWidth;
      const height = window.innerHeight;
      const density = Math.min(window.devicePixelRatio || 1, 2);
      canvas.width = Math.floor(width * density);
      canvas.height = Math.floor(height * density);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;
      context.setTransform(density, 0, 0, density, 0, 0);

      const targetCanvas = document.createElement('canvas');
      targetCanvas.width = width;
      targetCanvas.height = height;
      const targetContext = targetCanvas.getContext('2d', { willReadFrequently: true });
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

      const glyphWidths = Array.from(word, character => targetContext.measureText(character).width);
      const textWidth = glyphWidths.reduce((total, glyphWidth) => total + glyphWidth, 0) + letterSpacing * (glyphWidths.length - 1);
      const groupWidth = markSize + gap + textWidth;
      const groupLeft = width / 2 - groupWidth / 2;
      const textX = groupLeft + markSize + gap;

      drawArrowMark(targetContext, groupLeft + markSize / 2, centerY, markSize);

      let cursorX = textX;
      Array.from(word).forEach((character, index) => {
        targetContext.fillText(character, cursorX, centerY);
        cursorX += glyphWidths[index]! + letterSpacing;
      });

      const pixels = targetContext.getImageData(0, 0, width, height).data;
      const destinations: Array<{ x: number; y: number }> = [];
      const sampleStep = 4;

      for (let y = 0; y < height; y += sampleStep) {
        for (let x = 0; x < width; x += sampleStep) {
          if ((pixels[(y * width + x) * 4 + 3] ?? 0) > 110) destinations.push({ x, y });
        }
      }

      for (let index = destinations.length - 1; index > 0; index -= 1) {
        const swapIndex = Math.floor(Math.random() * (index + 1));
        [destinations[index], destinations[swapIndex]] = [destinations[swapIndex]!, destinations[index]!];
      }

      const limit = width < 520 ? 950 : 1600;
      const particles: Particle[] = destinations.slice(0, limit).map((destination, index) => {
        const angle = Math.random() * Math.PI * 2;
        const distance = 52 + Math.random() * Math.min(210, width * 0.26);
        return {
          targetX: destination.x,
          targetY: destination.y,
          burstX: width / 2 + Math.cos(angle) * distance,
          burstY: centerY + Math.sin(angle) * distance,
          radius: 0.7 + Math.random() * 0.9,
          delay: (index % 19) * 6 + Math.random() * 55,
        };
      });

      const startedAt = performance.now();

      const draw = (now: number) => {
        const elapsed = now - startedAt;
        context.clearRect(0, 0, width, height);
        context.fillStyle = '#ffffff';

        const solidProgress = easeInOutCubic(clamp((elapsed - 1780) / 260));

        for (const particle of particles) {
          const burstProgress = easeOutCubic(clamp(elapsed / 430));
          const settleProgress = easeInOutCubic(clamp((elapsed - 260 - particle.delay) / 1320));
          const burstX = width / 2 + (particle.burstX - width / 2) * burstProgress;
          const burstY = centerY + (particle.burstY - centerY) * burstProgress;
          const x = burstX + (particle.targetX - burstX) * settleProgress;
          const y = burstY + (particle.targetY - burstY) * settleProgress;
          const alpha = Math.min(1, elapsed / 130) * (0.48 + settleProgress * 0.52) * (1 - solidProgress);
          const radius = particle.radius * (1 - settleProgress * 0.12);

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

        if (elapsed < 2350 && !cancelled) {
          animationFrame = window.requestAnimationFrame(draw);
        } else if (!cancelled) {
          context.clearRect(0, 0, width, height);
          context.drawImage(targetCanvas, 0, 0);
        }
      };

      if (!cancelled) animationFrame = window.requestAnimationFrame(draw);
    };

    buildAnimation();

    return () => {
      cancelled = true;
      window.cancelAnimationFrame(animationFrame);
    };
  }, [active]);

  return <canvas ref={canvasRef} className={`startup-particle-canvas ${active ? 'is-active' : ''}`} aria-hidden="true" />;
}

export function StartupSequence() {
  const [ready, setReady] = useState(false);
  const [visible, setVisible] = useState(false);
  const [activated, setActivated] = useState(false);
  const [formed, setFormed] = useState(false);
  const [finished, setFinished] = useState(false);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      const source = readIncomingArrowSource(window.location.search);

      if (source) {
        sessionStorage.setItem(STARTUP_SESSION_KEY, '1');
        setReady(true);
        setVisible(false);
        return;
      }

      setReady(true);
      setVisible(sessionStorage.getItem(STARTUP_SESSION_KEY) !== '1');
    }, 0);
    return () => window.clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!activated) return;

    const finishTimer = window.setTimeout(() => {
      sessionStorage.setItem(STARTUP_SESSION_KEY, '1');
      setFinished(true);
    }, 3550);

    const removeTimer = window.setTimeout(() => setVisible(false), 4200);

    return () => {
      window.clearTimeout(finishTimer);
      window.clearTimeout(removeTimer);
    };
  }, [activated]);

  if (!ready || !visible) return null;

  const skip = () => {
    sessionStorage.setItem(STARTUP_SESSION_KEY, '1');
    setVisible(false);
  };

  return (
    <div className={`startup-shell ${finished ? 'is-finished' : ''}`} role="dialog" aria-label="Orbit introduction">
      <button type="button" onClick={skip} className="startup-skip">Skip intro</button>

      <button
        type="button"
        aria-label="Start Orbit intro"
        disabled={activated}
        onClick={() => setActivated(true)}
        className="startup-trigger"
      >
        <span className={`startup-core ${activated ? 'is-active' : ''}`}>
          <span className="startup-orbit orbit-one" />
          <span className="startup-orbit orbit-two" />
          <span className="startup-dot" />
          {!activated && <span className="startup-prompt">enter orbit</span>}
        </span>
      </button>

      <ParticleWordmark active={activated} onFormed={() => setFormed(true)} />

      <div className={`startup-copy ${formed ? 'is-formed' : ''}`} aria-hidden={!formed}>
        <p>the center of ARROW.</p>
      </div>
    </div>
  );
}
