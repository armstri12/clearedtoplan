/**
 * Aircraft Profile Templates
 *
 * Pre-configured aircraft profiles based on standard POH values.
 * Users can load these templates and customize them for their specific aircraft.
 */

import type { AircraftProfile } from './types';
import { makeId } from './id';

function nowIso() {
  return new Date().toISOString();
}

export type AircraftTemplate = {
  id: string;
  name: string;
  description: string;
  manufacturer: string;
  model: string;
  createProfile: () => AircraftProfile;
};

/**
 * Cessna 172S Skyhawk Template
 * Standard POH values with Normal & Utility category envelopes
 */
export function makeC172STemplate(): AircraftProfile {
  const t = nowIso();

  return {
    id: makeId('ac'),
    tailNumber: '',
    makeModel: 'Cessna 172S',
    notes: 'Standard C172S POH values. IMPORTANT: Verify all data against YOUR aircraft\'s specific POH/AFM and W&B paperwork. Empty weight and CG will vary by aircraft.',

    emptyWeight: {
      weightLb: 1663,
      momentLbIn: 65789, // CG: ~39.5 in (typical, but verify yours!)
    },

    limits: {
      maxRampLb: 2558,
      maxTakeoffLb: 2550,
      maxLandingLb: 2550,
    },

    fuel: {
      usableGal: 53.0,
      densityLbPerGal: 6.0,
    },

    stations: [
      { id: makeId('st'), name: 'Front Seats', armIn: 37, maxWeightLb: undefined },
      { id: makeId('st'), name: 'Rear Seats', armIn: 73, maxWeightLb: undefined },
      { id: makeId('st'), name: 'Baggage (Forward)', armIn: 95, maxWeightLb: 70 },
      { id: makeId('st'), name: 'Baggage (Aft)', armIn: 123, maxWeightLb: 50 },
      { id: makeId('st'), name: 'Fuel (Usable)', armIn: 48, maxWeightLb: undefined },
    ],

    cgEnvelopes: {
      normal: {
        points: [
          { weightLb: 1500, cgIn: 35.0 },
          { weightLb: 1950, cgIn: 35.0 },
          { weightLb: 2550, cgIn: 41.0 },
          { weightLb: 2550, cgIn: 47.3 },
          { weightLb: 1500, cgIn: 47.3 },
        ],
      },
      utility: {
        points: [
          { weightLb: 1500, cgIn: 35.0 },
          { weightLb: 1950, cgIn: 35.0 },
          { weightLb: 2200, cgIn: 37.5 },
          { weightLb: 2200, cgIn: 40.5 },
          { weightLb: 1500, cgIn: 40.5 },
        ],
      },
    },

    performance: {
      cruisePerformance: [
        { rpm: 2400, altitudeFt: 2000, tasKt: 122, fuelBurnGPH: 8.6 },
        { rpm: 2400, altitudeFt: 4000, tasKt: 122, fuelBurnGPH: 8.5 },
        { rpm: 2400, altitudeFt: 6000, tasKt: 122, fuelBurnGPH: 8.5 },
        { rpm: 2400, altitudeFt: 8000, tasKt: 122, fuelBurnGPH: 8.4 },
        { rpm: 2300, altitudeFt: 2000, tasKt: 114, fuelBurnGPH: 7.4 },
        { rpm: 2300, altitudeFt: 4000, tasKt: 114, fuelBurnGPH: 7.3 },
        { rpm: 2300, altitudeFt: 6000, tasKt: 114, fuelBurnGPH: 7.3 },
        { rpm: 2300, altitudeFt: 8000, tasKt: 114, fuelBurnGPH: 7.2 },
      ],
      takeoffGroundRoll: 960,
      takeoffOver50ft: 1630,
      landingGroundRoll: 575,
      landingOver50ft: 1335,
    },

    createdAt: t,
    updatedAt: t,
  };
}

/**
 * Available aircraft templates
 */
export const AIRCRAFT_TEMPLATES: AircraftTemplate[] = [
  {
    id: 'c172s',
    name: 'Cessna 172S Skyhawk',
    description: 'Standard C172S with Normal & Utility envelopes, performance data, and all stations',
    manufacturer: 'Cessna',
    model: '172S',
    createProfile: makeC172STemplate,
  },
];

/**
 * Get a template by ID
 */
export function getTemplate(templateId: string): AircraftTemplate | undefined {
  return AIRCRAFT_TEMPLATES.find(t => t.id === templateId);
}

