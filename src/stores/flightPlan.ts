import { createContext, createElement, useContext, useState, type ReactNode } from 'react';
import { createStore, shallow, useStore, type StoreApi } from '../vendor/zustand.js';
import { buildDemoWeather, demoBasics, demoBrief, demoLoading, demoPerformance } from '../lib/fixtures/demoSnapshots.js';
import type { TakeoffInputs, DistanceResults, LandingInputs } from '../lib/performance/takeoffLanding';
import type { MetarData, TafData } from '../services/aviationApi';

export type FlightPlanBasics = {
  title?: string;
  pilot?: string;
  route?: string;
  departure?: string;
  destination?: string;
  departureTime?: string;
  etd?: string;
  eta?: string;
  lessonType?: string;
  aircraftIdent?: string;
  aircraftType?: string;
  aircraftProfileId?: string;
  fuelPolicy?: string;
  notes?: string;
};

export type WeatherSnapshot = {
  icao?: string;
  metar?: MetarData | null;
  taf?: TafData | null;
  notams?: string[];
  fetchedAt?: string;
};

export type WeatherAndNotams = {
  departure: WeatherSnapshot;
  destination: WeatherSnapshot;
  alternates: WeatherSnapshot[];
  briefingNotes?: string;
};

export type PerformancePlan = {
  pressureAltitudeFt?: number;
  densityAltitudeFt?: number;
  takeoff?: {
    inputs?: TakeoffInputs;
    results?: DistanceResults;
    runwayAvailableFt?: number;
  };
  landing?: {
    inputs?: LandingInputs;
    results?: DistanceResults;
    runwayAvailableFt?: number;
  };
  remarks?: string;
};

export type LoadingPlan = {
  rampWeight?: number;
  takeoffWeight?: number;
  landingWeight?: number;
  taxiFuelGal?: number;
  plannedBurnGal?: number;
  centerOfGravity?: number;
  payloadNotes?: string;
};

export type BriefContent = {
  summary?: string;
  exportReadyText?: string;
  updatedAt?: string;
  audience?: 'student' | 'instructor' | 'pilot';
};

type FlightPlanSlices = {
  basics: FlightPlanBasics;
  weather: WeatherAndNotams;
  performance: PerformancePlan;
  loading: LoadingPlan;
  brief: BriefContent;
};

type FlightPlanActions = {
  updateBasics: (update: Partial<FlightPlanBasics>) => void;
  updateWeather: (update: Partial<WeatherAndNotams>) => void;
  updatePerformance: (update: Partial<PerformancePlan>) => void;
  updateLoading: (update: Partial<LoadingPlan>) => void;
  updateBrief: (update: Partial<BriefContent>) => void;
  setTakeoffPlan: (inputs: TakeoffInputs, results?: DistanceResults) => void;
  setLandingPlan: (inputs: LandingInputs, results?: DistanceResults) => void;
  reset: (nextDefaults?: FlightPlanSlices) => void;
};

export type FlightPlanState = FlightPlanSlices & FlightPlanActions;

const FlightPlanStoreContext = createContext<StoreApi<FlightPlanState> | null>(null);

function createFlightPlanStore(defaultSlices: FlightPlanSlices) {
  let baseDefaults = defaultSlices;

  return createStore<FlightPlanState>((set) => ({
    ...defaultSlices,
    updateBasics: (update) =>
      set((state) => ({
        basics: { ...state.basics, ...update },
      })),
    updateWeather: (update) =>
      set((state) => ({
        weather: {
          ...state.weather,
          ...update,
          departure: { ...state.weather.departure, ...(update.departure ?? {}) },
          destination: { ...state.weather.destination, ...(update.destination ?? {}) },
          alternates: update.alternates ?? state.weather.alternates,
        },
      })),
    updatePerformance: (update) =>
      set((state) => ({
        performance: { ...state.performance, ...update },
      })),
    updateLoading: (update) =>
      set((state) => ({
        loading: { ...state.loading, ...update },
      })),
    updateBrief: (update) =>
      set((state) => ({
        brief: { ...state.brief, ...update, updatedAt: update.updatedAt ?? new Date().toISOString() },
      })),
    setTakeoffPlan: (inputs, results) =>
      set((state) => ({
        performance: {
          ...state.performance,
          takeoff: {
            runwayAvailableFt: state.performance.takeoff?.runwayAvailableFt,
            ...state.performance.takeoff,
            inputs,
            results: results ?? state.performance.takeoff?.results,
          },
        },
      })),
    setLandingPlan: (inputs, results) =>
      set((state) => ({
        performance: {
          ...state.performance,
          landing: {
            runwayAvailableFt: state.performance.landing?.runwayAvailableFt,
            ...state.performance.landing,
            inputs,
            results: results ?? state.performance.landing?.results,
          },
        },
      })),
    reset: (nextDefaults) => {
      if (nextDefaults) {
        baseDefaults = nextDefaults;
      }
      set((state) => ({
        ...state,
        ...baseDefaults,
      }));
    },
  }));
}

function createInitialFlightPlanState(): FlightPlanSlices {
  return {
    basics: structuredClone(demoBasics),
    weather: buildDemoWeather(),
    performance: structuredClone(demoPerformance),
    loading: structuredClone(demoLoading),
    brief: structuredClone(demoBrief),
  };
}

// Test-only helper to exercise reducer behavior without React wiring
export function createFlightPlanStoreForTest(defaultSlices: FlightPlanSlices) {
  return createFlightPlanStore(structuredClone(defaultSlices));
}

export function FlightPlanProvider({ children }: { children: ReactNode }) {
  const [store] = useState<StoreApi<FlightPlanState>>(() =>
    createFlightPlanStore(createInitialFlightPlanState())
  );

  return createElement(FlightPlanStoreContext.Provider, { value: store }, children);
}

function useFlightPlanStoreContext() {
  const store = useContext(FlightPlanStoreContext);
  if (!store) {
    throw new Error('useFlightPlan must be used within a FlightPlanProvider');
  }
  return store;
}

export function useFlightPlan<T>(
  selector: (state: FlightPlanState) => T,
  equalityFn?: (left: T, right: T) => boolean,
) {
  const store = useFlightPlanStoreContext();
  const resolvedEqualityFn =
    equalityFn ??
    ((left: T, right: T) =>
      shallow(
        left as unknown as Record<string, unknown>,
        right as unknown as Record<string, unknown>,
      ));
  return useStore(store, selector, resolvedEqualityFn);
}

export function useFlightPlanUpdater() {
  return useFlightPlan(
    (state) => ({
      updateBasics: state.updateBasics,
      updateWeather: state.updateWeather,
      updatePerformance: state.updatePerformance,
      updateLoading: state.updateLoading,
      updateBrief: state.updateBrief,
      setTakeoffPlan: state.setTakeoffPlan,
      setLandingPlan: state.setLandingPlan,
      reset: state.reset,
    }),
    shallow,
  );
}
