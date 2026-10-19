/**
 * Ideal-sphere solar geometry. Angles are in degrees unless named otherwise.
 * We use parallel sunlight, a point Sun and a geometric horizon (no refraction,
 * solar disc, terrain, precession or orbital eccentricity). Seasons describe the
 * Northern Hemisphere. Solstice/equinox dates are approximate, not an ephemeris.
 */
export const OBLIQUITY = 23.44;
export const DEG = Math.PI / 180;

export type Vec3 = [number, number, number];
export type Vector3Tuple = Vec3;
type VectorLike = readonly [number, number, number];
export type SeasonId = 'march' | 'june' | 'september' | 'december';

export interface Season {
  id: SeasonId;
  label: string;
  date: string;
  longitude: number;
  declination: number;
  description: string;
}

const clamp = (value: number, min = -1, max = 1) =>
  Math.max(min, Math.min(max, value));

function finite(value: number, name: string): void {
  if (!Number.isFinite(value)) throw new RangeError(`${name} 必須為有限數值`);
}

function latitudeAngle(value: number, name: string): void {
  finite(value, name);
  if (Math.abs(value) > 90) throw new RangeError(`${name} 必須介於 −90° 與 90°`);
}

/** Solar declination δ = asin(sin ε · sin λ), where λ is solar ecliptic longitude. */
export function computeDeclination(
  solarLongitude: number,
  obliquity = OBLIQUITY,
): number {
  finite(solarLongitude, '太陽黃經');
  latitudeAngle(obliquity, '地軸傾角');
  return Math.asin(clamp(Math.sin(obliquity * DEG) * Math.sin(solarLongitude * DEG))) / DEG;
}

export const SEASONS: readonly Season[] = [
  { id: 'march', label: '春分', date: '3 月 20 日前後', longitude: 0,
    declination: computeDeclination(0), description: '太陽直射赤道，除兩極外，各緯度理論晝長皆為 12 小時。' },
  { id: 'june', label: '夏至', date: '6 月 21 日前後', longitude: 90,
    declination: computeDeclination(90), description: '太陽直射北回歸線，北半球晝最長，南半球相反。' },
  { id: 'september', label: '秋分', date: '9 月 22 日前後', longitude: 180,
    declination: computeDeclination(180), description: '太陽再次直射赤道，除兩極外，各緯度理論晝長皆為 12 小時。' },
  { id: 'december', label: '冬至', date: '12 月 21 日前後', longitude: 270,
    declination: computeDeclination(270), description: '太陽直射南回歸線，北半球晝最短，南半球相反。' },
];

/**
 * Unit direction FROM Earth TO Sun, in the equatorial comparison frame:
 * y = geographic north; x = reference-meridian noon; east longitudes point −z.
 * The meridian follows solar right ascension so λ changes declination only.
 * It is not an inertial orbit frame. Rotation of the surface supplies hour angle.
 * The incoming photon direction is the negative of this vector.
 */
export function sunDirection(solarLongitude: number, obliquity = OBLIQUITY): Vec3 {
  const delta = computeDeclination(solarLongitude, obliquity) * DEG;
  return [Math.cos(delta), Math.sin(delta), 0];
}

/** Geographic surface position. East longitude is positive; y is geographic north. */
export function surfacePoint(latitude: number, longitude: number, radius = 1): Vec3 {
  latitudeAngle(latitude, '緯度');
  finite(longitude, '經度');
  finite(radius, '半徑');
  if (radius <= 0) throw new RangeError('半徑必須大於零');
  const phi = latitude * DEG;
  const lambda = longitude * DEG;
  return [radius * Math.cos(phi) * Math.cos(lambda), radius * Math.sin(phi),
    -radius * Math.cos(phi) * Math.sin(lambda)];
}

/** sin h = sin φ sin δ + cos φ cos δ cos H; H = 0 at local solar noon. */
export function solarAltitude(latitude: number, declination: number, hourAngle = 0): number {
  latitudeAngle(latitude, '緯度');
  latitudeAngle(declination, '赤緯');
  finite(hourAngle, '時角');
  const phi = latitude * DEG;
  const delta = declination * DEG;
  return Math.asin(clamp(Math.sin(phi) * Math.sin(delta)
    + Math.cos(phi) * Math.cos(delta) * Math.cos(hourAngle * DEG))) / DEG;
}

/**
 * Geometric daylight in one 24 h rotation. H₀ = acos(−tan φ tan δ).
 * a + b cos H avoids divergent tan(±90°) and treats polar day/night explicitly.
 * At a pole on an equinox the Sun stays on the horizon; 12 h is a stated
 * symmetry convention, not 12 hours strictly above the horizon.
 */
export function dayLengthHours(latitude: number, declination: number): number {
  latitudeAngle(latitude, '緯度');
  latitudeAngle(declination, '赤緯');
  const phi = latitude * DEG;
  const delta = declination * DEG;
  const a = Math.sin(phi) * Math.sin(delta);
  const b = Math.cos(phi) * Math.cos(delta);
  const tolerance = 1e-12;
  if (Math.abs(b) < tolerance) {
    if (a > tolerance) return 24;
    if (a < -tolerance) return 0;
    return 12;
  }
  const crossing = -a / b;
  if (crossing <= -1 + tolerance) return 24;
  if (crossing >= 1 - tolerance) return 0;
  return 24 * Math.acos(clamp(crossing)) / Math.PI;
}

/** Cosine of solar zenith angle: >0 day, <0 night, 0 geometric terminator. */
export function illumination(point: VectorLike, sun: VectorLike): number {
  const pointLength = Math.hypot(...point);
  const sunLength = Math.hypot(...sun);
  if (!Number.isFinite(pointLength) || !Number.isFinite(sunLength)
    || pointLength === 0 || sunLength === 0) {
    throw new RangeError('位置與日照方向必須為非零有限向量');
  }
  return clamp((point[0] * sun[0] + point[1] * sun[1] + point[2] * sun[2])
    / (pointLength * sunLength));
}

/** A closed great circle perpendicular to the Earth-to-Sun direction. */
export function terminatorPoints(sun: VectorLike, count = 180, radius = 1.006): Vec3[] {
  const length = Math.hypot(...sun);
  if (!Number.isFinite(length) || length === 0) throw new RangeError('日照方向必須為非零有限向量');
  if (!Number.isInteger(count) || count < 3) throw new RangeError('晨昏線取樣數至少為 3');
  if (!Number.isFinite(radius) || radius <= 0) throw new RangeError('半徑必須大於零');
  const n: Vec3 = [sun[0] / length, sun[1] / length, sun[2] / length];
  // Choose a helper axis far from parallel to n to avoid an unstable cross product.
  const helper: Vec3 = Math.abs(n[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
  const cross: Vec3 = [n[1] * helper[2] - n[2] * helper[1],
    n[2] * helper[0] - n[0] * helper[2], n[0] * helper[1] - n[1] * helper[0]];
  const crossLength = Math.hypot(...cross);
  const u: Vec3 = cross.map((component) => component / crossLength) as Vec3;
  const v: Vec3 = [n[1] * u[2] - n[2] * u[1],
    n[2] * u[0] - n[0] * u[2], n[0] * u[1] - n[1] * u[0]];
  return Array.from({ length: count + 1 }, (_, i) => {
    const theta = i / count * 2 * Math.PI;
    return u.map((component, axis) => radius * (component * Math.cos(theta)
      + v[axis] * Math.sin(theta))) as Vec3;
  });
}

/** Nearest minute, with carry handled before splitting hours/minutes. */
export function formatHours(hours: number): string {
  finite(hours, '時數');
  const totalMinutes = Math.round(clamp(hours, 0, 24) * 60);
  return `${Math.floor(totalMinutes / 60)} 小時 ${String(totalMinutes % 60).padStart(2, '0')} 分`;
}

/** A globe rotation about +y adds to east-positive longitude; H > 0 is afternoon. */
export function hourAngleForLongitude(longitude: number, rotationDegrees: number): number {
  finite(longitude, '經度');
  finite(rotationDegrees, '自轉角');
  return ((longitude + rotationDegrees + 180) % 360 + 360) % 360 - 180;
}
