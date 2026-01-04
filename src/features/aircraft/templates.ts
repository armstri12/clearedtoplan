import type { AircraftProfile } from './types';
import { makeId } from './id';

function nowIso() {
  return new Date().toISOString();
}

/**
 * Starter template only.
 * User must verify arms/limits/empty weight/moment from POH/AFM + W&B sheet for the specific tail number.
 */
export function makeC172STemplate(): AircraftProfile {
  const t = nowIso();

  return {
    id: makeId('ac'),
    tailNumber: '',
    makeModel: 'Cessna 172S',
    notes:
      'TEMPLATE: Verify all values against THIS aircraft’s POH/AFM & W&B sheet (datum, arms, limits, empty weight/moment, and envelope).',
    emptyWeight: {
      // Leave empty weight/moment blank/zero so they must enter tail-specific values
      weightLb: 0,
      momentLbIn: 0,
    },
    limits: {
      // Leave undefined so PASS/FAIL won’t be authoritative until user enters them
      maxRampLb: undefined,
      maxTakeoffLb: undefined,
      maxLandingLb: undefined,
    },
    fuel: {
      usableGal: 53, // common for many 172S, but STILL verify (some differ)
      densityLbPerGal: 6.0,
    },
    stations: [
      { id: makeId('st'), name: 'Front seats', armIn: 37 },
      { id: makeId('st'), name: 'Rear seats', armIn: 73 },
      { id: makeId('st'), name: 'Baggage', armIn: 95 },
      { id: makeId('st'), name: 'Fuel (usable)', armIn: 48 },
    ],
    createdAt: t,
    updatedAt: t,
  };
}
