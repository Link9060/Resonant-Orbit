const TAU = Math.PI * 2;

export type ParticleOptions = {
  density?: number;
  size?: number;
};

export type CloudMotion = {
  mx?: number;
  my?: number;
  hover?: number;
  impulse?: number;
  loadingMix?: number;
  pointerX?: number;
  pointerY?: number;
  scale?: number;
  alpha?: number;
};

type SpherePoint = {
  x: number;
  y: number;
  z: number;
  phase: number;
  grain: number;
  layer: 0 | 1 | 2 | 3 | 4;
  tone: number;
  spark: number;
};

export type CloudRenderer = (
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  width: number,
  time: number,
  dark: boolean,
  motion?: CloudMotion,
) => void;

function clamp01(value: number) {
  return Math.max(0, Math.min(1, value));
}

function smooth01(value: number) {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
}

/**
 * Ported from Relay's layered particle sphere.
 * Orbit keeps the structured inner shells and loose outer skin, then uses
 * pointer motion to make the sphere feel like a navigable object rather than
 * a passive background.
 */
export function createCloudRenderer(compact = false, options: ParticleOptions = {}) {
  const density = Math.max(0.35, Math.min(1.5, options.density ?? 1));
  const size = Math.max(0.6, Math.min(1.8, options.size ?? 1));
  const targetCount = Math.round((compact ? 3900 : 6400) * density);
  const points: SpherePoint[] = [];

  let seed = 1741;
  const random = () => {
    seed = (Math.imul(seed, 1664525) + 1013904223) | 0;
    return (seed >>> 0) / 4294967296;
  };

  const addGridShell = (amount: number, radius: number, layer: 1 | 2 | 3) => {
    const bands = Math.max(12, Math.round(Math.sqrt(amount * 0.52)));
    const longitudeBase = Math.max(24, Math.round((amount * Math.PI) / (2 * bands)));

    for (let band = 1; band < bands; band += 1) {
      const phi = (Math.PI * band) / bands;
      const y = Math.cos(phi);
      const ring = Math.sin(phi);
      const around = Math.max(10, Math.round(longitudeBase * ring));
      const offset = band % 2 ? Math.PI / around : 0;

      for (let column = 0; column < around; column += 1) {
        const angle = (column / around) * TAU + offset + (random() - 0.5) * 0.012;
        const ripple = 1 + Math.sin(angle * 4 + y * 3.4 + layer) * 0.004 + (random() - 0.5) * 0.004;
        const r = radius * ripple;

        points.push({
          x: Math.cos(angle) * ring * r,
          y: y * r,
          z: Math.sin(angle) * ring * r,
          phase: random() * TAU,
          grain: 0.62 + random() * 0.5,
          layer,
          tone: 0.25 + random() * 0.65,
          spark: 0,
        });
      }
    }
  };

  addGridShell(Math.round(targetCount * 0.15), 0.58, 1);
  addGridShell(Math.round(targetCount * 0.17), 0.75, 2);
  addGridShell(Math.round(targetCount * 0.19), 0.9, 3);

  const outerCount = Math.round(targetCount * 0.37);
  for (let i = 0; i < outerCount; i += 1) {
    const y = 1 - (2 * (i + 0.5)) / outerCount;
    const ring = Math.sqrt(Math.max(0, 1 - y * y));
    const angle = random() * TAU;
    const patch = Math.max(
      0,
      Math.sin(angle * 5.1 + y * 7.3) * 0.5 + Math.sin(angle * 9.2 - y * 4.1) * 0.5,
    );
    const loose = random() > 0.68 ? (0.025 + random() * 0.11) * (0.35 + patch * 0.8) : 0;
    const r = 0.995 + Math.sin(angle * 3 + y * 4.5) * 0.018 + (random() - 0.5) * 0.026 + loose;

    points.push({
      x: Math.cos(angle) * ring * r,
      y: y * r,
      z: Math.sin(angle) * ring * r,
      phase: random() * TAU,
      grain: 0.72 + random() * 0.82,
      layer: 4,
      tone: 0.46 + random() * 0.54,
      spark: random() > 0.974 ? 1 : 0,
    });
  }

  const volumeCount = Math.max(0, targetCount - points.length);
  for (let i = 0; i < volumeCount; i += 1) {
    const y = random() * 2 - 1;
    const ring = Math.sqrt(Math.max(0, 1 - y * y));
    const angle = random() * TAU;
    const r = Math.cbrt(random()) * 0.93;

    points.push({
      x: Math.cos(angle) * ring * r,
      y: y * r,
      z: Math.sin(angle) * ring * r,
      phase: random() * TAU,
      grain: 0.5 + random() * 0.62,
      layer: 0,
      tone: 0.18 + random() * 0.68,
      spark: random() > 0.994 ? 1 : 0,
    });
  }

  const getRadius = (width: number, height: number, scale = 1) =>
    Math.min(
      width * (compact ? 0.315 : 0.228),
      height * (compact ? 0.25 : 0.258),
      compact ? 208 : 292,
    ) * scale;

  const render: CloudRenderer = (ctx, cx, cy, width, time, dark, motion = {}) => {
    const mx = motion.mx ?? 0;
    const my = motion.my ?? 0;
    const hover = motion.hover ?? 0;
    const impulse = motion.impulse ?? 0;
    const pointerX = motion.pointerX ?? 0;
    const pointerY = motion.pointerY ?? 0;
    const scale = Math.max(0.025, motion.scale ?? 1);
    const opacity = clamp01(motion.alpha ?? 1);
    const loadingMix = smooth01(motion.loadingMix ?? 0);

    const transform = ctx.getTransform();
    const viewportHeight = ctx.canvas.height / Math.max(1, transform.d);
    const radius = getRadius(width, viewportHeight, scale);
    const yaw = time * (0.052 + loadingMix * 0.045) + mx * hover * 0.68;
    const pitch = Math.sin(time * 0.14) * 0.028 - my * hover * 0.42;
    const roll = Math.sin(time * 0.09) * 0.016 + mx * hover * 0.05;

    const cyaw = Math.cos(yaw);
    const syaw = Math.sin(yaw);
    const cpitch = Math.cos(pitch);
    const spitch = Math.sin(pitch);
    const croll = Math.cos(roll);
    const sroll = Math.sin(roll);

    const followX = mx * hover * radius * 0.028;
    const followY = my * hover * radius * 0.02;
    const interactionRadius = radius * (0.43 + loadingMix * 0.14);

    ctx.fillStyle = dark ? '#fff' : '#0d0d0f';

    for (const point of points) {
      const structural = point.layer === 1 || point.layer === 2 || point.layer === 3;
      const cloudDrift =
        point.layer === 4
          ? Math.sin(time * 0.72 + point.phase) * (0.009 + point.spark * 0.008)
          : Math.sin(time * 0.2 + point.phase) * 0.0018;

      const pulse = impulse * (point.layer === 4 ? 0.048 + point.spark * 0.03 : 0.017);
      const wobble = 1 + cloudDrift + pulse;
      const px = point.x * wobble;
      const py = point.y * wobble;
      const pz = point.z * wobble;

      const x1 = px * cyaw + pz * syaw;
      const z1 = -px * syaw + pz * cyaw;
      const y2 = py * cpitch - z1 * spitch;
      const z2 = py * spitch + z1 * cpitch;
      const x3 = x1 * croll - y2 * sroll;
      const y3 = x1 * sroll + y2 * croll;
      const perspective = 1 / Math.max(0.76, 1 - z2 * 0.13);

      let sx = cx + followX + x3 * radius * perspective;
      let sy = cy + followY + y3 * radius * perspective;
      let interaction = 0;

      if (hover > 0.015) {
        const dx = sx - (cx + pointerX);
        const dy = sy - (cy + pointerY);
        const distance = Math.hypot(dx, dy);

        if (distance < interactionRadius) {
          interaction = Math.pow(1 - distance / interactionRadius, 2) * hover;
          const inverse = distance > 0.5 ? 1 / distance : 0;
          const push = radius * 0.14 * interaction;
          const swirl = radius * 0.065 * interaction;
          sx += dx * inverse * push - dy * inverse * swirl;
          sy += dy * inverse * push + dx * inverse * swirl;
        }
      }

      const projectedRadius = Math.min(1.2, Math.hypot(x3, y3));
      const rim = clamp01((projectedRadius - 0.65) / 0.37);
      const front = clamp01((z2 + 1.05) / 2.1);
      const randomTone = 0.48 + point.tone * 0.52;

      let alpha =
        point.layer === 4
          ? (0.28 + rim * 0.48 + front * 0.11 + point.spark * 0.12) * randomTone
          : point.layer === 3
            ? (0.19 + rim * 0.18 + front * 0.17) * randomTone
            : point.layer === 2
              ? (0.15 + rim * 0.14 + front * 0.145) * randomTone
              : point.layer === 1
                ? (0.12 + rim * 0.105 + front * 0.125) * randomTone
                : (0.05 + front * 0.14 + rim * 0.035 + point.spark * 0.22) * randomTone;

      if (structural) alpha *= 1.08;

      const grain = Math.max(
        0.58,
        point.grain * size * (0.9 + rim * 0.26 + front * 0.12 + point.spark * 0.45),
      );

      ctx.globalAlpha = Math.min(0.99, alpha + interaction * 0.22) * opacity;
      ctx.fillRect(sx - grain / 2, sy - grain / 2, grain, grain);
    }

    ctx.globalAlpha = 1;
  };

  return render;
}

export function fitCanvas(
  canvas: HTMLCanvasElement,
  ctx: CanvasRenderingContext2D,
  width: number,
  height: number,
) {
  const dpr = Math.min(
    window.devicePixelRatio || 1,
    1.5,
    Math.sqrt(5_000_000 / Math.max(1, width * height)),
  );

  canvas.width = Math.round(width * dpr);
  canvas.height = Math.round(height * dpr);
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
}
