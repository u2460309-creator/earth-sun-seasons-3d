import { describe, expect, it } from 'vitest';
import {
  DEG, OBLIQUITY, SEASONS, computeDeclination, dayLengthHours, formatHours,
  hourAngleForLongitude, illumination, solarAltitude, sunDirection,
  surfacePoint, terminatorPoints, type Vec3,
} from './astronomy';

describe('太陽赤緯與地軸傾角', () => {
  it('以太陽黃經給出春秋分 0°、夏至 +23.44°、冬至 −23.44°', () => {
    expect(OBLIQUITY).toBe(23.44);
    expect(computeDeclination(0)).toBeCloseTo(0, 12);
    expect(computeDeclination(180)).toBeCloseTo(0, 12);
    expect(computeDeclination(90)).toBeCloseTo(23.44, 12);
    expect(computeDeclination(270)).toBeCloseTo(-23.44, 12);
    expect(SEASONS.map((season) => season.id)).toEqual(['march', 'june', 'september', 'december']);
  });

  it('可使用不同傾角，零傾角時全年直射赤道', () => {
    expect(computeDeclination(90, 0)).toBe(0);
    expect(computeDeclination(90, 30)).toBeCloseTo(30, 12);
    expect(computeDeclination(45)).toBeCloseTo(16.336551335441698, 10);
    expect(computeDeclination(450)).toBeCloseTo(23.44, 12);
  });

  it.each([0, 45, 90, 180, 270, 359])('黃經 %s° 的朝日向量為單位長度，y 分量為 sin δ', (longitude) => {
    const sun = sunDirection(longitude);
    expect(Math.hypot(...sun)).toBeCloseTo(1, 14);
    expect(sun[1]).toBeCloseTo(Math.sin(computeDeclination(longitude) * DEG), 14);
    expect(sun[0]).toBeGreaterThan(0);
    expect(sun[2]).toBe(0);
  });
});

describe('理論晝長', () => {
  it.each([-90, -80, -66.56, -25, 0, 25, 66.56, 80, 90])('春秋分緯度 %s° 皆採 12 小時', (latitude) => {
    expect(dayLengthHours(latitude, 0)).toBeCloseTo(12, 10);
    expect(dayLengthHours(latitude, computeDeclination(180))).toBeCloseTo(12, 10);
  });

  it.each([-23.44, 0, 23.44])('赤道在赤緯 %s° 時晝長皆為 12 小時', (declination) => {
    expect(dayLengthHours(0, declination)).toBeCloseTo(12, 12);
  });

  it('臺灣北緯 25° 夏至約 13.56 h，冬至約 10.44 h', () => {
    // Independent benchmark: solving the geometric sunrise equation with ε=23.44°.
    expect(dayLengthHours(25, 23.44)).toBeCloseTo(13.55523100427026, 10);
    expect(dayLengthHours(25, -23.44)).toBeCloseTo(10.44476899572974, 10);
  });

  it('南北半球同一日期的對應緯度晝長互補', () => {
    for (const latitude of [0, 23.44, 25, 45, 65, 70, 90]) {
      expect(dayLengthHours(latitude, 23.44) + dayLengthHours(-latitude, 23.44)).toBeCloseTo(24, 10);
      expect(dayLengthHours(latitude, 23.44)).toBeCloseTo(dayLengthHours(-latitude, -23.44), 10);
    }
  });

  it('夏至北極圈內極晝、南極圈內極夜，冬至相反', () => {
    for (const latitude of [66.56, 70, 89.9999, 90]) {
      expect(dayLengthHours(latitude, 23.44)).toBe(24);
      expect(dayLengthHours(latitude, -23.44)).toBe(0);
      expect(dayLengthHours(-latitude, 23.44)).toBe(0);
      expect(dayLengthHours(-latitude, -23.44)).toBe(24);
    }
  });

  it('任意緯度的離散幾何採樣與解析晝長一致', () => {
    const sampleCount = 7200;
    for (const [latitude, declination] of [[25, 23.44], [-45, 12], [70, -23.44]]) {
      let illuminatedSamples = 0;
      for (let index = 0; index < sampleCount; index++) {
        const hourAngle = (index + 0.5) / sampleCount * 360 - 180;
        if (solarAltitude(latitude, declination, hourAngle) > 0) illuminatedSamples++;
      }
      expect(Math.abs(24 * illuminatedSamples / sampleCount - dayLengthHours(latitude, declination)))
        .toBeLessThanOrEqual(24 / sampleCount);
    }
  });
});

describe('三維日照與晨昏線', () => {
  it('地理座標的北極指向 +y、東經 90° 指向 −z', () => {
    expect(surfacePoint(0, 0)).toEqual([1, 0, -0]);
    expect(surfacePoint(90, 0)[1]).toBeCloseTo(1, 14);
    expect(surfacePoint(0, 90)[2]).toBeCloseTo(-1, 14);
    expect(Math.hypot(...surfacePoint(-25, 121, 2))).toBeCloseTo(2, 14);
  });

  it('夏至北回歸線、冬至南回歸線在正午太陽位於天頂', () => {
    expect(solarAltitude(23.44, computeDeclination(90))).toBeCloseTo(90, 10);
    expect(solarAltitude(-23.44, computeDeclination(270))).toBeCloseTo(90, 10);
    expect(illumination(surfacePoint(23.44, 0), sunDirection(90))).toBeCloseTo(1, 14);
    expect(solarAltitude(25, 23.44)).toBeCloseTo(88.44, 10);
    expect(solarAltitude(25, -23.44)).toBeCloseTo(41.56, 10);
  });

  it('向量點積與太陽高度角的正弦一致，包括自轉後的幾何', () => {
    for (const longitude of [-120, -30, 0, 60, 180]) {
      for (const latitude of [-90, -25, 0, 25, 90]) {
        const rotation = 37;
        const [x, y, z] = surfacePoint(latitude, longitude);
        const angle = rotation * DEG;
        const rotated: Vec3 = [x * Math.cos(angle) + z * Math.sin(angle), y,
          -x * Math.sin(angle) + z * Math.cos(angle)];
        const altitude = solarAltitude(latitude, 23.44, hourAngleForLongitude(longitude, rotation));
        expect(illumination(rotated, sunDirection(90))).toBeCloseTo(Math.sin(altitude * DEG), 12);
      }
    }
  });

  it.each([0, 90, 180, 270])('黃經 %s° 晨昏線位於日光垂直面、球面上，且首尾閉合', (longitude) => {
    const sun = sunDirection(longitude);
    const points = terminatorPoints(sun, 180, 1.006);
    expect(points).toHaveLength(181);
    for (const point of points) {
      expect(Math.hypot(...point)).toBeCloseTo(1.006, 12);
      expect(illumination(point, sun)).toBeCloseTo(0, 12);
    }
    points[0].forEach((coordinate, axis) => expect(points.at(-1)![axis]).toBeCloseTo(coordinate, 12));
  });

  it('晨昏線可處理平行輔助軸及未正規化光向量', () => {
    for (const sun of [[0, 1, 0], [0, -2, 0], [1, 2, 3]] as Vec3[]) {
      for (const point of terminatorPoints(sun, 20)) expect(illumination(point, sun)).toBeCloseTo(0, 12);
    }
    expect(illumination([10, 0, 0], [5, 0, 0])).toBe(1);
    expect(illumination([-10, 0, 0], [5, 0, 0])).toBe(-1);
  });
});

describe('顯示、週期與輸入邊界', () => {
  it('時角遵循東經加自轉角並以 360° 為週期', () => {
    expect(hourAngleForLongitude(121, 0)).toBe(121);
    expect(hourAngleForLongitude(121, 90)).toBe(-149);
    expect(hourAngleForLongitude(121, 360)).toBe(121);
    expect(hourAngleForLongitude(-180, -720)).toBe(-180);
    expect(hourAngleForLongitude(0, -1)).toBe(-1);
  });

  it('時長顯示四捨五入至分鐘並正確進位', () => {
    expect(formatHours(13.55523100427026)).toBe('13 小時 33 分');
    expect(formatHours(10.44476899572974)).toBe('10 小時 27 分');
    expect(formatHours(11.999)).toBe('12 小時 00 分');
    expect(formatHours(0)).toBe('0 小時 00 分');
    expect(formatHours(24)).toBe('24 小時 00 分');
  });

  it('拒絕無效角度、零向量與無效幾何取樣', () => {
    expect(() => dayLengthHours(91, 0)).toThrow(RangeError);
    expect(() => solarAltitude(0, Number.NaN)).toThrow(RangeError);
    expect(() => computeDeclination(Number.POSITIVE_INFINITY)).toThrow(RangeError);
    expect(() => illumination([0, 0, 0], [1, 0, 0])).toThrow(RangeError);
    expect(() => terminatorPoints([0, 0, 0])).toThrow(RangeError);
    expect(() => terminatorPoints([1, 0, 0], 2)).toThrow(RangeError);
  });
});
