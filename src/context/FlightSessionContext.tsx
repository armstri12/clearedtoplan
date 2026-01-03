import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

// ===== TYPES =====

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

export type FlightSessionAircraft = {
  profileId: string;
  ident: string;              // N12345
  type: string;               // C172S
  emptyWeight: number;        // lbs
  emptyMoment: number;        // lb-in
  maxRampWeight?: number;
  maxTakeoffWeight?: number;
  maxLandingWeight?: number;
  fuelCapacityUsable: number; // gallons
  fuelDensity: number;        // lb/gal (default 6.0)
  performance: AircraftPerformance;
};

export type FlightSessionWB = {
  loadedWeight: number;       // lbs
  loadedMoment: number;       // lb-in
  cgPosition: number;         // inches
  fuelOnboard: number;        // gallons
  fuelWeight: number;         // lbs
  isWithinEnvelope: boolean;
  isWithinLimits: boolean;
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
  legs: any[];  // Will use existing Leg type
};

export type FlightSession = {
  id: string;
  name: string;
  createdAt: string;
  updatedAt: string;
  userId?: string;  // For multi-user support

  // Workflow completion tracking
  completed: {
    aircraft: boolean;
    weightBalance: boolean;
    performance: boolean;
    weather: boolean;
    navlog: boolean;
  };

  // Data from each step
  aircraft?: FlightSessionAircraft;
  weightBalance?: FlightSessionWB;
  performance?: FlightSessionPerformance;
  weather?: FlightSessionWeather;
  navlog?: FlightSessionNavlog;
};

// ===== CONTEXT =====

type FlightSessionContextType = {
  currentSession: FlightSession | null;
  savedSessions: FlightSession[];

  // Session management
  startNewSession: (name: string) => void;
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

function makeId() {
  return `session_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function createEmptySession(name: string): FlightSession {
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
        setSavedSessions(sessions);
      }

      const currentStr = localStorage.getItem(CURRENT_SESSION_KEY);
      if (currentStr) {
        const session = JSON.parse(currentStr);
        setCurrentSession(session);
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

  const startNewSession = (name: string) => {
    const session = createEmptySession(name);
    setCurrentSession(session);
  };

  const loadSession = (id: string) => {
    const session = savedSessions.find((s) => s.id === id);
    if (session) {
      setCurrentSession({ ...session });
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
