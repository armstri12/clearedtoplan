import type { MetarData, TafData } from '../../services/aviationApi';
import type {
  BriefContent,
  FlightPlanBasics,
  LoadingPlan,
  PerformancePlan,
  WeatherAndNotams,
} from '../../stores/flightPlan';

export const demoMetar: MetarData = {
  icao: 'KJYO',
  name: 'Leesburg Executive Airport',
  observed: '2024-10-13T12:30:00Z',
  raw_text: 'KJYO 131230Z 18008KT 10SM FEW050 21/10 A2992 RMK AO2',
  barometer: {
    hg: 29.92,
    hpa: 1013.0,
    kpa: 101.3,
    mb: 1013.0,
  },
  temperature: {
    celsius: 21,
    fahrenheit: 69.8,
  },
  dewpoint: {
    celsius: 10,
    fahrenheit: 50,
  },
  wind: {
    degrees: 180,
    speed_kts: 8,
  },
  visibility: {
    miles: '10',
    miles_float: 10,
  },
  clouds: [
    { code: 'FEW', text: 'Few', feet: 5000 },
  ],
  flight_category: 'VFR',
  elevation: {
    feet: 389,
    meters: 118.6,
  },
};

export const demoTaf: TafData = {
  icao: 'KHEF',
  name: 'Manassas Regional Airport',
  raw_text: 'KHEF 131130Z 1312/1412 18007KT P6SM FEW050',
  timestamp: {
    issued: '2024-10-13T11:30:00Z',
    bulletin: '2024-10-13T11:30:00Z',
  },
  forecast: [
    {
      timestamp: { from: '2024-10-13T12:00:00Z', to: '2024-10-13T18:00:00Z' },
      wind: { degrees: 180, speed_kts: 7 },
      visibility: { miles: 'P6SM' },
    },
    {
      timestamp: { from: '2024-10-13T18:00:00Z', to: '2024-10-14T00:00:00Z' },
      wind: { degrees: 200, speed_kts: 9 },
      visibility: { miles: 'P6SM' },
    },
  ],
};

export const demoWeather: WeatherAndNotams = {
  departure: {
    icao: 'KJYO',
    metar: demoMetar,
    taf: null,
    notams: ['RWY 17/35 CLSD 2200-0600Z', 'PAPI RWY 17 OTS'],
    fetchedAt: '2024-10-13T12:35:00Z',
  },
  destination: {
    icao: 'KHEF',
    metar: null,
    taf: demoTaf,
    notams: ['TWY A NORTH OF A3 CLSD'],
    fetchedAt: '2024-10-13T12:35:00Z',
  },
  alternates: [{ icao: 'KIAD' }],
  briefingNotes: 'Sample data loaded for offline/demo use.',
};

export const demoBasics: FlightPlanBasics = {
  title: 'Demo Flight Plan',
  pilot: 'Demo Pilot',
  route: 'KJYO EMI V214 BAL KHEF',
  departure: 'KJYO',
  destination: 'KHEF',
  departureTime: '2024-10-14T14:00:00Z',
  etd: '14:00Z',
  eta: '14:45Z',
  lessonType: 'Dual XC',
  aircraftIdent: 'N12345',
  aircraftType: 'C172',
  aircraftProfileId: 'demo-c172',
  fuelPolicy: 'T/O with 3 hours fuel (VFR day reserve met)',
  notes: 'Demo plan seeded for offline use',
};

export const demoPerformance: PerformancePlan = {
  pressureAltitudeFt: 1200,
  densityAltitudeFt: 1400,
  takeoff: {
    inputs: {
      pohGroundRoll: 950,
      pohDistanceOver50ft: 1600,
      currentWeight: 2450,
      pohBaselineWeight: 2300,
      windComponent: -6,
      runwayType: 'grass',
      runwayCondition: 'dry',
      runwaySlope: 1,
      humidity: 'normal',
    },
    results: {
      groundRoll: 1900,
      over50ft: 2450,
      corrections: [],
      baselineGroundRoll: 950,
      baselineOver50ft: 1600,
      safetyMargin: 1.5,
    },
    runwayAvailableFt: 3500,
  },
  landing: {
    inputs: {
      pohGroundRoll: 800,
      pohDistanceOver50ft: 1400,
      landingWeight: 2350,
      pohBaselineWeight: 2300,
      windComponent: 8,
      runwayType: 'paved',
      runwayCondition: 'dry',
      runwaySlope: -0.5,
      safetyFactor: 1.2,
    },
    results: {
      groundRoll: 1200,
      over50ft: 1550,
      corrections: [],
      baselineGroundRoll: 800,
      baselineOver50ft: 1400,
      safetyMargin: 1.2,
    },
    runwayAvailableFt: 4200,
  },
  remarks: 'Demo performance data for offline evaluation.',
};

export const demoLoading: LoadingPlan = {
  rampWeight: 2500,
  takeoffWeight: 2450,
  landingWeight: 2350,
  taxiFuelGal: 7,
  plannedBurnGal: 12,
  centerOfGravity: 43.2,
  payloadNotes: 'Demo payload: 2 PAX + bags',
};

export const demoBrief: BriefContent = {
  summary: 'Route: KJYO → KHEF; VFR dual cross-country',
  exportReadyText: '',
  updatedAt: '2024-10-13T12:40:00Z',
  audience: 'pilot',
};

export function buildDemoWeather(): WeatherAndNotams {
  return structuredClone(demoWeather);
}

export function buildDemoBriefingSnapshot(): {
  basics: FlightPlanBasics;
  weather: WeatherAndNotams;
  performance: PerformancePlan;
  loading: LoadingPlan;
  brief: BriefContent;
} {
  return {
    basics: structuredClone(demoBasics),
    weather: buildDemoWeather(),
    performance: structuredClone(demoPerformance),
    loading: structuredClone(demoLoading),
    brief: structuredClone(demoBrief),
  };
}
