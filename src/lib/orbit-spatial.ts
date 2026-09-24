export type Point3 = readonly [number, number, number];

export type ProjectedPoint = {
  x: number;
  y: number;
  z: number;
  depth: number;
};

export type ScreenRect = {
  left: number;
  top: number;
  right: number;
  bottom: number;
};

export function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

export function smoothstep(edge0: number, edge1: number, value: number) {
  const t = clamp((value - edge0) / Math.max(0.0001, edge1 - edge0), 0, 1);
  return t * t * (3 - 2 * t);
}

export function nearestEquivalentAngle(angle: number, current: number) {
  const tau = Math.PI * 2;
  return angle + Math.round((current - angle) / tau) * tau;
}

export function rotatePoint(
  point: Point3,
  yaw: number,
  pitch: number,
  roll: number,
): Point3 {
  const [px, py, pz] = point;
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

  return [x3, y3, z2];
}

export function projectPoint(
  point: Point3,
  yaw: number,
  pitch: number,
  roll: number,
  radius: number,
  centerX: number,
  centerY: number,
): ProjectedPoint {
  const [x, y, z] = rotatePoint(point, yaw, pitch, roll);
  const perspective = 1 / Math.max(0.76, 1 - z * 0.13);

  return {
    x: centerX + x * radius * perspective,
    y: centerY + y * radius * perspective,
    z,
    depth: clamp((z + 1.22) / 2.44, 0, 1),
  };
}

export function projectAnchor(
  anchor: Point3,
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

  return projectPoint(
    [
      (ax / length) * shellRadius,
      (ay / length) * shellRadius,
      (az / length) * shellRadius,
    ],
    yaw,
    pitch,
    roll,
    radius,
    centerX,
    centerY,
  );
}

export function pushOutsideRect(
  x: number,
  y: number,
  rect: ScreenRect,
  padding = 18,
) {
  const expanded = {
    left: rect.left - padding,
    top: rect.top - padding,
    right: rect.right + padding,
    bottom: rect.bottom + padding,
  };

  if (
    x < expanded.left ||
    x > expanded.right ||
    y < expanded.top ||
    y > expanded.bottom
  ) {
    return { x, y };
  }

  const distances = [
    { side: 'left' as const, value: Math.abs(x - expanded.left) },
    { side: 'right' as const, value: Math.abs(expanded.right - x) },
    { side: 'top' as const, value: Math.abs(y - expanded.top) },
    { side: 'bottom' as const, value: Math.abs(expanded.bottom - y) },
  ].sort((a, b) => a.value - b.value);

  switch (distances[0]?.side) {
    case 'left':
      return { x: expanded.left, y };
    case 'right':
      return { x: expanded.right, y };
    case 'top':
      return { x, y: expanded.top };
    default:
      return { x, y: expanded.bottom };
  }
}

export function resolveScreenCollisions<T extends { x: number; y: number; depth: number }>(
  items: T[],
  minDistance: number,
  centerX: number,
  centerY: number,
) {
  const output = items.map(item => ({ ...item }));

  for (let pass = 0; pass < 3; pass += 1) {
    for (let i = 0; i < output.length; i += 1) {
      for (let j = i + 1; j < output.length; j += 1) {
        const a = output[i]!;
        const b = output[j]!;
        const dx = b.x - a.x;
        const dy = b.y - a.y;
        const distance = Math.hypot(dx, dy);

        if (distance >= minDistance) continue;

        const overlap = (minDistance - Math.max(0.01, distance)) * 0.52;
        const ux = distance > 0.01 ? dx / distance : (a.x < centerX ? 1 : -1);
        const uy = distance > 0.01 ? dy / distance : (a.y < centerY ? 0.4 : -0.4);
        const frontBias = a.depth >= b.depth ? 0.35 : 0.65;

        a.x -= ux * overlap * (1 - frontBias);
        a.y -= uy * overlap * (1 - frontBias);
        b.x += ux * overlap * frontBias;
        b.y += uy * overlap * frontBias;
      }
    }
  }

  return output;
}

function rotateLocal(point: Point3, rx: number, ry: number, rz: number): Point3 {
  let [x, y, z] = point;

  const cx = Math.cos(rx);
  const sx = Math.sin(rx);
  [y, z] = [y * cx - z * sx, y * sx + z * cx];

  const cy = Math.cos(ry);
  const sy = Math.sin(ry);
  [x, z] = [x * cy + z * sy, -x * sy + z * cy];

  const cz = Math.cos(rz);
  const sz = Math.sin(rz);
  [x, y] = [x * cz - y * sz, x * sz + y * cz];

  return [x, y, z];
}

const ORBIT_PLANES = [
  { radius: 1.34, rx: 0.2, ry: 0.12, rz: -0.18, alpha: 0.075 },
  { radius: 1.47, rx: 0.75, ry: -0.28, rz: 0.34, alpha: 0.06 },
  { radius: 1.56, rx: -0.64, ry: 0.34, rz: -0.42, alpha: 0.045 },
] as const;

export function drawOrbitSegments(
  ctx: CanvasRenderingContext2D,
  phase: 'back' | 'front',
  yaw: number,
  pitch: number,
  roll: number,
  sphereRadius: number,
  centerX: number,
  centerY: number,
) {
  ctx.save();
  ctx.lineWidth = 0.8;
  ctx.lineCap = 'round';

  for (const orbit of ORBIT_PLANES) {
    const segments = 108;
    const points: ProjectedPoint[] = [];

    for (let index = 0; index <= segments; index += 1) {
      const angle = (index / segments) * Math.PI * 2;
      const local = rotateLocal(
        [Math.cos(angle) * orbit.radius, 0, Math.sin(angle) * orbit.radius],
        orbit.rx,
        orbit.ry,
        orbit.rz,
      );

      points.push(
        projectPoint(
          local,
          yaw,
          pitch,
          roll,
          sphereRadius,
          centerX,
          centerY,
        ),
      );
    }

    for (let index = 0; index < segments; index += 1) {
      const a = points[index]!;
      const b = points[index + 1]!;
      const avgZ = (a.z + b.z) * 0.5;
      const front = avgZ >= 0;

      if ((phase === 'front') !== front) continue;

      if (!front) {
        const mx = (a.x + b.x) * 0.5 - centerX;
        const my = (a.y + b.y) * 0.5 - centerY;
        if (Math.hypot(mx, my) < sphereRadius * 1.015) continue;
      }

      ctx.beginPath();
      ctx.moveTo(a.x, a.y);
      ctx.lineTo(b.x, b.y);
      ctx.strokeStyle = `rgba(255,255,255,${front ? orbit.alpha : orbit.alpha * 0.62})`;
      ctx.stroke();
    }
  }

  ctx.restore();
}
