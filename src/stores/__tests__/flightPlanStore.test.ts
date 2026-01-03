import assert from 'node:assert';
import test from 'node:test';
import { buildDemoBriefingSnapshot } from '../../lib/fixtures/demoSnapshots.js';
import { createFlightPlanStoreForTest } from '../flightPlan.js';

function setupStore() {
  const snapshot = buildDemoBriefingSnapshot();
  const store = createFlightPlanStoreForTest(snapshot);
  return { snapshot, store };
}

test('updateWeather merges nested snapshots without losing other fields', () => {
  const { snapshot, store } = setupStore();
  const { updateWeather } = store.getState();

  updateWeather({
    departure: { icao: 'KABC', notams: ['RWY CLOSED'] },
  });

  const state = store.getState();
  assert.strictEqual(state.weather.departure.icao, 'KABC');
  assert.deepStrictEqual(state.weather.departure.notams, ['RWY CLOSED']);
  // Destination details remain from default snapshot
  assert.strictEqual(state.weather.destination.icao, snapshot.weather.destination.icao);
  assert.deepStrictEqual(state.weather.destination.notams, snapshot.weather.destination.notams);
});

test('setTakeoffPlan preserves runway availability and allows new results', () => {
  const { store } = setupStore();
  const runwayAvailableFt = store.getState().performance.takeoff?.runwayAvailableFt;

  store.getState().setTakeoffPlan(
    { pohGroundRoll: 1000, pohDistanceOver50ft: 1800, windComponent: 0, runwayType: 'paved', runwayCondition: 'dry', runwaySlope: 0, humidity: 'normal' },
    { groundRoll: 1500, over50ft: 2100, corrections: [], baselineGroundRoll: 1000, baselineOver50ft: 1800, safetyMargin: 1.5 },
  );

  const takeoff = store.getState().performance.takeoff;
  assert.strictEqual(takeoff?.runwayAvailableFt, runwayAvailableFt);
  assert.strictEqual(takeoff?.results?.groundRoll, 1500);
});

test('reset swaps the base defaults when provided', () => {
  const { store } = setupStore();
  const initialTitle = store.getState().basics.title;

  const nextDefaults = {
    basics: { ...store.getState().basics, title: 'Reset Title' },
    weather: store.getState().weather,
    performance: store.getState().performance,
    loading: store.getState().loading,
    brief: store.getState().brief,
  };

  store.getState().reset(nextDefaults);
  const afterReset = store.getState();

  assert.notStrictEqual(afterReset.basics.title, initialTitle);
  assert.strictEqual(afterReset.basics.title, 'Reset Title');

  // A second reset should keep using the new base defaults
  store.getState().reset();
  assert.strictEqual(store.getState().basics.title, 'Reset Title');
});
