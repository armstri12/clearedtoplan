/**
 * Flight Session Context
 *
 * Manages the complete flight planning workflow and session state.
 * This is the core state management system for the application.
 *
 * Architecture:
 * - FlightSession: Complete flight planning data (aircraft, W&B, performance, weather, navlog)
 * - Workflow tracking: Enforces step-by-step completion
 * - Data persistence: Auto-saves to localStorage
 * - Multi-session support: Save and load multiple flight plans
 *
 * Workflow Steps (must be completed in order):
 * 1. Aircraft - Select aircraft profile and basic info
 * 2. Weight & Balance - Calculate W&B for ramp, takeoff, landing
 * 3. Performance - Calculate density altitude and takeoff/landing distances
 * 4. Weather - Fetch METAR/TAF for departure, destination, alternates
 * 5. Navlog - Build navigation log with legs, checkpoints, fuel burn
 *
 * Data Flow:
 * - Each page updates its section using updateAircraft(), updateWeightBalance(), etc.
 * - Pages mark their step complete using completeStep()
 * - WorkflowGuard checks canAccessStep() to enforce workflow order
 * - All changes auto-save to localStorage
 *
 * Usage:
 * ```tsx
 * const { currentSession, updateAircraft, completeStep } = useFlightSession();
 *
 * // Start planning
 * startNewSession('Flight to KMCO');
 *
 * // Update data
 * updateAircraft({ profileId: '...', ident: 'N12345', ... });
 * completeStep('aircraft');
 *
 * // Navigate with workflow enforcement
 * if (canAccessStep('weightBalance')) {
 *   navigate('/wb');
 * }
 * ```
 *
 * @module FlightSessionContext
 */
import { createContext, useContext, useState, useEffect, type ReactNode, useCallback } from 'react';

// ===== TYPES =====

/**
 * Aircraft performance data structure
 * Includes cruise performance tables and takeoff/landing baselines
 */
export type AircraftPerformance = {
  // Cruise performance (multiple power settings)
  cruisePerformance: Array<{
    rpm: number;
    altitudeFt: number;
    tasKt: number;
    fuelBurnGPH: number;
  }>;

  // Takeoff/landing baselines (sea level, standard day, max gross)
  takeoffGroundRoll: number;  // feet
  takeoffOver50ft: number;    // feet
  landingGroundRoll: number;  // feet
  landingOver50ft: number;    // feet
};

/**
 * Aircraft data stored in flight session
 * Snapshot of aircraft profile and weight/balance parameters
 */
export type FlightSessionAircraft = {
  /** ID of the aircraft profile this data came from */
  profileId: string;
  /** Aircraft registration (N-number or tail number) */
  ident: string;
  /** Aircraft type/model (e.g., "C172S", "PA-28-181") */
  type: string;
  /** Empty weight in pounds */
  emptyWeight: number;
  /** Empty weight moment in pound-inches */
  emptyMoment: number;
  /** Maximum ramp weight in pounds (optional) */
  maxRampWeight?: number;
  /** Maximum takeoff weight in pounds (optional) */
  maxTakeoffWeight?: number;
  /** Maximum landing weight in pounds (optional) */
  maxLandingWeight?: number;
  /** Usable fuel capacity in gallons */
  fuelCapacityUsable: number;
  /** Fuel density in pounds per gallon (typically 6.0 for 100LL) */
  fuelDensity: number;
  /** Performance data for cruise, takeoff, and landing */
  performance: AircraftPerformance;
};

/**
 * Weight & Balance data stored in flight session
 * Includes payload, fuel, and calculated W&B results
 */
export type FlightSessionWB = {
  // Payload
  frontSeatsLb: number;
  rearSeatsLb: number;
  baggageLb: number;

  // Fuel
  startFuelGal: number;
  taxiFuelGal: number;
  plannedBurnGal: number;

  // Calculated results
  rampWeight: number;
  rampCG: number;
  takeoffWeight: number;
  takeoffCG: number;
  landingWeight: number;
  landingCG: number;
};

export type FlightSessionPerformance = {
  departure: {
    fieldElevation: number;   // ft
    altimeter: number;        // inHg
    temperature: number;      // °F
    densityAltitude: number;  // ft
    takeoffDistanceRequired: number;  // ft
    runwayAvailable?: number; // ft
  };
  destination: {
    fieldElevation: number;
    altimeter: number;
    temperature: number;
    densityAltitude: number;
    landingDistanceRequired: number;
    runwayAvailable?: number;
  };
  cruise: {
    rpm: number;
    altitudeFt: number;
    tasKt: number;
    fuelBurnGPH: number;
  };
};

export type FlightSessionWeather = {
  departure: {
    icao: string;
    metar?: any;
    taf?: any;
  };
  destination: {
    icao: string;
    metar?: any;
    taf?: any;
  };
  windsAloft?: {
    direction: number;  // degrees true
    speed: number;      // knots
    altitudeFt: number;
  };
};

export type FlightSessionNavlog = {
  route: string;
  departureTime: string;
  arrivalTime?: string;
  departure?: string;
  destination?: string;
  ete?: string;
  legs: any[];  // Will use existing Leg type
};

export type FlightSessionMetadata = {
  route?: string;
  departure?: string;
  destination?: string;
  etd?: string;
  eta?: string;
  lessonType?: string;
  alternates?: string[];
};

/**
 * Complete Flight Session
 *
 * Represents a complete flight planning session with all workflow data.
 * This is the main data structure that gets saved to localStorage.
 *
 * Lifecycle:
 * 1. Created with createEmptySession(name)
 * 2. Updated as user completes each workflow step
 * 3. Auto-saved to localStorage on every change
 * 4. Can be loaded, saved, or deleted from saved sessions list
 *
 * Workflow Enforcement:
 * - Steps must be completed in order (aircraft → W&B → performance → weather → navlog)
 * - Each step stores its data in the corresponding field
 * - completed flags track which steps are done
 * - WorkflowGuard component uses this to control navigation
 */
export type FlightSession = {
  /** Unique session identifier */
  id: string;
  /** User-friendly session name (e.g., "Flight to KMCO") */
  name: string;
  /** ISO timestamp of session creation */
  createdAt: string;
  /** ISO timestamp of last update */
  updatedAt: string;
  /** User ID for multi-user support (future enhancement) */
  userId?: string;

  /** Workflow completion tracking - enforces step-by-step progression */
  completed: {
    aircraft: boolean;
    weightBalance: boolean;
    performance: boolean;
    weather: boolean;
    navlog: boolean;
  };

  /** Data from each workflow step */
  aircraft?: FlightSessionAircraft;
  weightBalance?: FlightSessionWB;
  performance?: FlightSessionPerformance;
  weather?: FlightSessionWeather;
  navlog?: FlightSessionNavlog;

  /** Cross-step summary data for header display */
  metadata: FlightSessionMetadata;
};

// ===== CONTEXT =====

/**
 * Flight Session Context Type
 * Defines all state and functions available through useFlightSession() hook
 */
type FlightSessionContextType = {
  currentSession: FlightSession | null;
  savedSessions: FlightSession[];

  // Session management
  startNewSession: (name: string, metadata?: Partial<FlightSessionMetadata>) => void;
  loadSession: (id: string) => void;
  saveSession: () => void;
  deleteSession: (id: string) => void;
  clearSession: () => void;

  // Update session data
  updateAircraft: (data: FlightSessionAircraft) => void;
  updateWeightBalance: (data: FlightSessionWB) => void;
  updatePerformance: (data: FlightSessionPerformance) => void;
  updateWeather: (data: FlightSessionWeather) => void;
  updateNavlog: (data: FlightSessionNavlog) => void;
  updateMetadata: (data: Partial<FlightSessionMetadata>) => void;

  // Mark steps complete
  completeStep: (step: keyof FlightSession['completed']) => void;

  // Workflow validation
  canAccessStep: (step: keyof FlightSession['completed']) => boolean;
  getNextStep: () => keyof FlightSession['completed'] | null;
};

const FlightSessionContext = createContext<FlightSessionContextType | undefined>(undefined);

// ===== PROVIDER =====

const STORAGE_KEY = 'clearedtoplan_sessions';
const CURRENT_SESSION_KEY = 'clearedtoplan_current_session';

function withMetadataDefaults(session: FlightSession): FlightSession {
  const alternates = session.metadata?.alternates ?? [];
  return {
    ...session,
    metadata: {
      ...(session.metadata ?? {}),
      alternates,
    },
  };
}

function makeId() {
  return `session_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function createEmptySession(name: string, metadata?: Partial<FlightSessionMetadata>): FlightSession {
  const alternates = metadata?.alternates ?? [];
  return {
    id: makeId(),
    name,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    completed: {
      aircraft: false,
      weightBalance: false,
      performance: false,
      weather: false,
      navlog: false,
    },
    metadata: {
      ...(metadata ?? {}),
      alternates,
    },
  };
}

export function FlightSessionProvider({ children }: { children: ReactNode }) {
  const [currentSession, setCurrentSession] = useState<FlightSession | null>(null);
  const [savedSessions, setSavedSessions] = useState<FlightSession[]>([]);

  // Load from localStorage on mount
  useEffect(() => {
    try {
      const savedStr = localStorage.getItem(STORAGE_KEY);
      if (savedStr) {
        const sessions = JSON.parse(savedStr);
        setSavedSessions(Array.isArray(sessions) ? sessions.map(withMetadataDefaults) : []);
      }

      const currentStr = localStorage.getItem(CURRENT_SESSION_KEY);
      if (currentStr) {
        const session = JSON.parse(currentStr);
        setCurrentSession(withMetadataDefaults(session));
      }
    } catch (error) {
      console.error('Error loading sessions:', error);
    }
  }, []);

  // Save to localStorage whenever sessions change
  useEffect(() => {
    if (savedSessions.length > 0) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(savedSessions));
    }
  }, [savedSessions]);

  useEffect(() => {
    if (currentSession) {
      localStorage.setItem(CURRENT_SESSION_KEY, JSON.stringify(currentSession));
    } else {
      localStorage.removeItem(CURRENT_SESSION_KEY);
    }
  }, [currentSession]);

  const startNewSession = (name: string, metadata?: Partial<FlightSessionMetadata>) => {
    const session = createEmptySession(name, metadata);
    setCurrentSession(session);
  };

  const loadSession = (id: string) => {
    const session = savedSessions.find((s) => s.id === id);
    if (session) {
      setCurrentSession(withMetadataDefaults({ ...session }));
    }
  };

  const saveSession = () => {
    if (!currentSession) return;

    const updated = {
      ...currentSession,
      updatedAt: new Date().toISOString(),
    };

    setCurrentSession(updated);

    setSavedSessions((prev) => {
      const existing = prev.findIndex((s) => s.id === updated.id);
      if (existing >= 0) {
        const next = [...prev];
        next[existing] = updated;
        return next;
      }
      return [...prev, updated];
    });
  };

  const deleteSession = (id: string) => {
    setSavedSessions((prev) => prev.filter((s) => s.id !== id));
    if (currentSession?.id === id) {
      setCurrentSession(null);
    }
  };

  const clearSession = () => {
    setCurrentSession(null);
  };

  const updateAircraft = (data: FlightSessionAircraft) => {
    if (!currentSession) return;
    setCurrentSession({
      ...currentSession,
      aircraft: data,
      updatedAt: new Date().toISOString(),
    });
  };

  const updateWeightBalance = (data: FlightSessionWB) => {
    if (!currentSession) return;
    setCurrentSession({
      ...currentSession,
      weightBalance: data,
      updatedAt: new Date().toISOString(),
    });
  };

  const updatePerformance = (data: FlightSessionPerformance) => {
    if (!currentSession) return;
    setCurrentSession({
      ...currentSession,
      performance: data,
      updatedAt: new Date().toISOString(),
    });
  };

  const updateWeather = (data: FlightSessionWeather) => {
    if (!currentSession) return;
    setCurrentSession({
      ...currentSession,
      weather: data,
      updatedAt: new Date().toISOString(),
    });
  };

  const updateNavlog = (data: FlightSessionNavlog) => {
    if (!currentSession) return;
    setCurrentSession({
      ...currentSession,
      navlog: data,
      updatedAt: new Date().toISOString(),
    });
  };

  const updateMetadata = useCallback(
    (data: Partial<FlightSessionMetadata>) => {
      if (!currentSession) return;

      const nextMetadata = {
        ...currentSession.metadata,
        ...data,
        alternates: data.alternates ?? currentSession.metadata.alternates,
      };

      if (JSON.stringify(nextMetadata) === JSON.stringify(currentSession.metadata)) {
        return;
      }

      setCurrentSession({
        ...currentSession,
        metadata: nextMetadata,
        updatedAt: new Date().toISOString(),
      });
    },
    [currentSession],
  );

  const completeStep = (step: keyof FlightSession['completed']) => {
    if (!currentSession) return;
    setCurrentSession({
      ...currentSession,
      completed: {
        ...currentSession.completed,
        [step]: true,
      },
      updatedAt: new Date().toISOString(),
    });
  };

  const canAccessStep = (step: keyof FlightSession['completed']): boolean => {
    if (!currentSession) return false;

    const order: Array<keyof FlightSession['completed']> = [
      'aircraft',
      'weightBalance',
      'performance',
      'weather',
      'navlog',
    ];

    const stepIndex = order.indexOf(step);
    if (stepIndex === 0) return true; // Can always access first step

    // Must complete all previous steps
    for (let i = 0; i < stepIndex; i++) {
      if (!currentSession.completed[order[i]]) {
        return false;
      }
    }

    return true;
  };

  const getNextStep = (): keyof FlightSession['completed'] | null => {
    if (!currentSession) return 'aircraft';

    const order: Array<keyof FlightSession['completed']> = [
      'aircraft',
      'weightBalance',
      'performance',
      'weather',
      'navlog',
    ];

    for (const step of order) {
      if (!currentSession.completed[step]) {
        return step;
      }
    }

    return null; // All complete
  };

  return (
    <FlightSessionContext.Provider
      value={{
        currentSession,
        savedSessions,
        startNewSession,
        loadSession,
        saveSession,
        deleteSession,
        clearSession,
        updateAircraft,
        updateWeightBalance,
        updatePerformance,
        updateWeather,
        updateNavlog,
        updateMetadata,
        completeStep,
        canAccessStep,
        getNextStep,
      }}
    >
      {children}
    </FlightSessionContext.Provider>
  );
}

// ===== HOOK =====

export function useFlightSession() {
  const context = useContext(FlightSessionContext);
  if (!context) {
    throw new Error('useFlightSession must be used within FlightSessionProvider');
  }
  return context;
}
