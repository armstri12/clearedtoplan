import assert from 'node:assert';
import test from 'node:test';
import {
  calculateLandingDistance,
  calculateTakeoffDistance,
  getRunwaySafetyLevel,
} from '../performance/takeoffLanding.js';

test('calculateTakeoffDistance applies weight, wind, surface, slope, humidity, and safety margin', () => {
  const result = calculateTakeoffDistance({
    pohGroundRoll: 1200,
    pohDistanceOver50ft: 2000,
    currentWeight: 2600,
    pohBaselineWeight: 2400,
    windComponent: -6, // tailwind
    runwayType: 'grass',
    runwayCondition: 'wet',
    runwaySlope: 1,
    humidity: 'high',
  });

  assert.strictEqual(result.groundRoll, 4499);
  assert.strictEqual(result.over50ft, 7499);
  assert.strictEqual(result.baselineGroundRoll, 1200);
  assert.strictEqual(result.baselineOver50ft, 2000);
  assert.ok(result.corrections.some((c) => c.factor === 'Weight'));
  assert.ok(result.corrections.some((c) => c.factor === 'Wind'));
  assert.ok(result.corrections.some((c) => c.factor === 'Runway Surface'));
  assert.ok(result.corrections.some((c) => c.factor === 'Runway Slope'));
});

test('calculateLandingDistance defaults to safety margin when not provided', () => {
  const result = calculateLandingDistance({
    pohGroundRoll: 900,
    pohDistanceOver50ft: 1500,
    landingWeight: 2400,
    pohBaselineWeight: 2300,
    windComponent: 8, // headwind
    runwayType: 'paved',
    runwayCondition: 'dry',
    runwaySlope: -1,
  });

  assert.ok(result.groundRoll > 900);
  assert.ok(result.over50ft > 1500);
  assert.strictEqual(result.safetyMargin, 1.5);
});

test('getRunwaySafetyLevel handles unknown and thresholds', () => {
  assert.strictEqual(getRunwaySafetyLevel(1000, null).level, 'unknown');
  assert.strictEqual(getRunwaySafetyLevel(2000, 3000).level, 'safe');
  assert.strictEqual(getRunwaySafetyLevel(2500, 3000).level, 'caution');
  assert.strictEqual(getRunwaySafetyLevel(2800, 3000).level, 'danger');
});
