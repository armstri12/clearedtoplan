import { createContext, createElement, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import { createStore, shallow, useStore, type StoreApi } from '../vendor/zustand.js';
import { useAuth } from '../context/AuthContext.js';
import { useFlightSession, type FlightSession } from '../context/FlightSessionContext.js';
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

function deriveWeather(session: FlightSession | null): WeatherAndNotams {
  if (!session) {
    return buildDemoWeather();
  }

  const fallback = buildDemoWeather();

  return {
    departure: {
      icao: session.weather?.departure?.icao ?? session.metadata.departure ?? fallback.departure.icao,
      metar: session.weather?.departure?.metar ?? fallback.departure.metar,
      taf: session.weather?.departure?.taf ?? fallback.departure.taf,
      notams: session.weather?.departure?.notams ?? fallback.departure.notams,
      fetchedAt: session.weather?.departure?.fetchedAt ?? fallback.departure.fetchedAt,
    },
    destination: {
      icao: session.weather?.destination?.icao ?? session.metadata.destination ?? fallback.destination.icao,
      metar: session.weather?.destination?.metar ?? fallback.destination.metar,
      taf: session.weather?.destination?.taf ?? fallback.destination.taf,
      notams: session.weather?.destination?.notams ?? fallback.destination.notams,
      fetchedAt: session.weather?.destination?.fetchedAt ?? fallback.destination.fetchedAt,
    },
    alternates: (session.metadata.alternates ?? fallback.alternates).map((icao) =>
      typeof icao === 'string' ? { icao } : icao),
    briefingNotes: session.metadata.lessonType
      ? `Lesson type: ${session.metadata.lessonType}`
      : fallback.briefingNotes,
  };
}

function derivePerformance(session: FlightSession | null): PerformancePlan {
  if (!session?.performance) {
    return structuredClone(demoPerformance);
  }

  return {
    pressureAltitudeFt: session.performance.departure?.densityAltitude,
    densityAltitudeFt: session.performance.departure?.densityAltitude,
    takeoff: {
      runwayAvailableFt: session.performance.departure?.runwayAvailable,
    },
    landing: {
      runwayAvailableFt: session.performance.destination?.runwayAvailable,
    },
    remarks: 'Initialized from most recent flight session performance data.',
  };
}

function deriveLoading(session: FlightSession | null): LoadingPlan {
  if (!session) {
    return structuredClone(demoLoading);
  }

  return {
    rampWeight: session.weightBalance?.rampWeight ?? demoLoading.rampWeight,
    takeoffWeight: session.weightBalance?.takeoffWeight ?? demoLoading.takeoffWeight,
    landingWeight: session.weightBalance?.landingWeight ?? demoLoading.landingWeight,
    taxiFuelGal: session.weightBalance?.taxiFuelGal ?? demoLoading.taxiFuelGal,
    plannedBurnGal: session.weightBalance?.plannedBurnGal ?? demoLoading.plannedBurnGal,
    centerOfGravity: session.weightBalance?.takeoffCG ?? demoLoading.centerOfGravity,
    payloadNotes: session.aircraft?.ident
      ? `Configured for ${session.aircraft.ident}${session.aircraft.type ? ` (${session.aircraft.type})` : ''}`
      : demoLoading.payloadNotes,
  };
}

function deriveBasics(user: ReturnType<typeof useAuth>['user'], session: FlightSession | null): FlightPlanBasics {
  if (!session) {
    return {
      ...structuredClone(demoBasics),
      pilot: user?.username ?? demoBasics.pilot,
    };
  }

  return {
    title: session.name ?? 'New Flight Plan',
    pilot: user?.username ?? 'Pilot',
    route: session.metadata.route ?? session.navlog?.route ?? demoBasics.route,
    departure: session.metadata.departure ?? session.navlog?.departure ?? session.weather?.departure?.icao ?? demoBasics.departure,
    destination: session.metadata.destination ?? session.navlog?.destination ?? session.weather?.destination?.icao ?? demoBasics.destination,
    departureTime: session.metadata.departureTime ?? session.metadata.etd ?? session.navlog?.departureTime ?? demoBasics.departureTime,
    etd: session.metadata.etd ?? session.navlog?.departureTime ?? demoBasics.etd,
    eta: session.metadata.eta ?? session.navlog?.arrivalTime ?? demoBasics.eta,
    lessonType: session.metadata.lessonType ?? demoBasics.lessonType,
    aircraftIdent: session.aircraft?.ident ?? demoBasics.aircraftIdent,
    aircraftType: session.aircraft?.type ?? demoBasics.aircraftType,
    aircraftProfileId: session.aircraft?.profileId ?? demoBasics.aircraftProfileId,
    fuelPolicy: session.metadata.fuelPolicy ?? demoBasics.fuelPolicy,
    notes: session.metadata.notes ?? demoBasics.notes,
  };
}

function deriveBrief(session: FlightSession | null): BriefContent {
  if (!session) {
    return structuredClone(demoBrief);
  }

  return {
    summary: session.metadata.route
      ? `Route: ${session.metadata.route}`
      : demoBrief.summary ?? 'Draft flight briefing',
    exportReadyText: '',
    updatedAt: new Date().toISOString(),
    audience: session.metadata.lessonType ? 'student' : 'pilot',
  };
}

function createInitialFlightPlanState(
  user: ReturnType<typeof useAuth>['user'],
  session: FlightSession | null,
): FlightPlanSlices {
  return {
    basics: deriveBasics(user, session),
    weather: deriveWeather(session),
    performance: derivePerformance(session),
    loading: deriveLoading(session),
    brief: deriveBrief(session),
  };
}

// Test-only helper to exercise reducer behavior without React wiring
export function createFlightPlanStoreForTest(defaultSlices: FlightPlanSlices) {
  return createFlightPlanStore(structuredClone(defaultSlices));
}

export function FlightPlanProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const { currentSession } = useFlightSession();
  const defaults = useMemo(
    () => createInitialFlightPlanState(user, currentSession),
    [user, currentSession],
  );

  const [store] = useState<StoreApi<FlightPlanState>>(() => createFlightPlanStore(defaults));

  useEffect(() => {
    store.getState().reset(defaults);
  }, [store, defaults]);

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
