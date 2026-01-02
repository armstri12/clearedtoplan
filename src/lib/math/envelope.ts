export type EnvelopePoint = { weightLb: number; cgIn: number };

export type EnvelopeValidation = {
  ok: boolean;
  messages: string[];
  points: EnvelopePoint[]; // normalized (numbers only)
};

function isFiniteNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n);
}

function nearlyEqual(a: number, b: number, eps = 1e-9) {
  return Math.abs(a - b) <= eps;
}

function samePoint(a: EnvelopePoint, b: EnvelopePoint) {
  return nearlyEqual(a.weightLb, b.weightLb) && nearlyEqual(a.cgIn, b.cgIn);
}

export function normalizeEnvelopePoints(raw: unknown): EnvelopePoint[] {
  if (!Array.isArray(raw)) return [];
  const out: EnvelopePoint[] = [];
  for (const p of raw) {
    const w = (p as any)?.weightLb;
    const cg = (p as any)?.cgIn;
    if (isFiniteNumber(w) && isFiniteNumber(cg)) out.push({ weightLb: w, cgIn: cg });
  }
  return out;
}

export function sortEnvelopePoints(points: EnvelopePoint[]): EnvelopePoint[] {
  // Sort by angle around centroid in (cg, weight) plane
  if (points.length < 3) return points.slice();

  const cx = points.reduce((s, p) => s + p.cgIn, 0) / points.length;
  const cy = points.reduce((s, p) => s + p.weightLb, 0) / points.length;

  return points
    .slice()
    .sort((a, b) => Math.atan2(a.weightLb - cy, a.cgIn - cx) - Math.atan2(b.weightLb - cy, b.cgIn - cx));
}

// Geometry helpers for intersection test (in cg=x, weight=y)
type Pt = { x: number; y: number };

function orient(a: Pt, b: Pt, c: Pt) {
  return (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);
}

function onSegment(a: Pt, b: Pt, c: Pt) {
  // c on segment ab (collinear assumed)
  return (
    Math.min(a.x, b.x) - 1e-9 <= c.x &&
    c.x <= Math.max(a.x, b.x) + 1e-9 &&
    Math.min(a.y, b.y) - 1e-9 <= c.y &&
    c.y <= Math.max(a.y, b.y) + 1e-9
  );
}

function segmentsIntersect(p1: Pt, p2: Pt, q1: Pt, q2: Pt) {
  const o1 = orient(p1, p2, q1);
  const o2 = orient(p1, p2, q2);
  const o3 = orient(q1, q2, p1);
  const o4 = orient(q1, q2, p2);

  // General case
  if ((o1 > 0) !== (o2 > 0) && (o3 > 0) !== (o4 > 0)) return true;

  // Collinear cases
  if (nearlyEqual(o1, 0) && onSegment(p1, p2, q1)) return true;
  if (nearlyEqual(o2, 0) && onSegment(p1, p2, q2)) return true;
  if (nearlyEqual(o3, 0) && onSegment(q1, q2, p1)) return true;
  if (nearlyEqual(o4, 0) && onSegment(q1, q2, p2)) return true;

  return false;
}

export function envelopeSelfIntersects(points: EnvelopePoint[]) {
  // O(n^2) check for polygon edge crossings (excluding adjacent edges)
  if (points.length < 4) return false;
  const poly: Pt[] = points.map((p) => ({ x: p.cgIn, y: p.weightLb }));
  const n = poly.length;

  for (let i = 0; i < n; i++) {
    const a1 = poly[i];
    const a2 = poly[(i + 1) % n];

    for (let j = i + 1; j < n; j++) {
      // Skip adjacent edges and same edge
      if (j === i) continue;
      if ((j + 1) % n === i) continue;
      if (j === (i + 1) % n) continue;

      const b1 = poly[j];
      const b2 = poly[(j + 1) % n];

      if (segmentsIntersect(a1, a2, b1, b2)) return true;
    }
  }
  return false;
}

export function validateEnvelope(points: EnvelopePoint[]): EnvelopeValidation {
  const messages: string[] = [];
  if (points.length < 3) {
    messages.push('Need at least 3 points.');
    return { ok: false, messages, points };
  }

  // Duplicates
  for (let i = 0; i < points.length; i++) {
    for (let j = i + 1; j < points.length; j++) {
      if (samePoint(points[i], points[j])) {
        messages.push(`Duplicate point detected at index ${i + 1} and ${j + 1}.`);
        i = points.length; // bail early-ish
        break;
      }
    }
  }

  // Self-intersection
  if (envelopeSelfIntersects(points)) {
    messages.push('Polygon edges intersect (self-crossing). Reorder points around the perimeter.');
  }

  return { ok: messages.length === 0, messages, points };
}

export function assistEnvelope(rawPoints: unknown) {
  const normalized = normalizeEnvelopePoints(rawPoints);
  const sorted = sortEnvelopePoints(normalized);
  const validation = validateEnvelope(sorted);
  return { normalized, sorted, validation };
}

export type EnvelopeViolation =
  | 'inside'
  | 'overweight'
  | 'forward'
  | 'aft'
  | 'outside';

export function diagnoseEnvelope(
  x: number, // CG (in)
  y: number, // Weight (lb)
  poly: { x: number; y: number }[],
) : EnvelopeViolation {
  if (poly.length < 3) return 'outside';

  const maxY = Math.max(...poly.map(p => p.y));

  if (y > maxY) return 'overweight';

  // Find envelope CG limits at this weight
  const intersections: number[] = [];

  for (let i = 0; i < poly.length; i++) {
    const a = poly[i];
    const b = poly[(i + 1) % poly.length];

    // Edge crosses this weight
    if ((a.y <= y && b.y >= y) || (b.y <= y && a.y >= y)) {
      if (a.y === b.y) continue;
      const t = (y - a.y) / (b.y - a.y);
      const xAtY = a.x + t * (b.x - a.x);
      intersections.push(xAtY);
    }
  }

  if (intersections.length < 2) return 'outside';

  const minX = Math.min(...intersections);
  const maxX = Math.max(...intersections);

  if (x < minX) return 'forward';
  if (x > maxX) return 'aft';

  return 'inside';
}
