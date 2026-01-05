/**
 * Supabase API Client
 * Handles all database operations for aircraft profiles and flight sessions
 */

import { supabase } from '../lib/supabase';
import type { Database } from '../lib/database.types';
import type { AircraftProfile } from '../features/aircraft/types';

type DbAircraftProfile = Database['public']['Tables']['aircraft_profiles']['Row'];
type DbAircraftProfileInsert = Database['public']['Tables']['aircraft_profiles']['Insert'];

// =====================================================
// AUTHENTICATION
// =====================================================

export const authClient = {
  /**
   * Sign up a new user
   */
  async signUp(email: string, password: string, name?: string) {
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          name: name || email.split('@')[0],
        },
      },
    });

    if (error) throw error;
    return data;
  },

  /**
   * Sign in existing user
   */
  async signIn(email: string, password: string) {
    const { data, error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) throw error;
    return data;
  },

  /**
   * Sign out current user
   */
  async signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  },

  /**
   * Get current session
   */
  async getSession() {
    const { data, error } = await supabase.auth.getSession();
    if (error) throw error;
    return data.session;
  },

  /**
   * Get current user
   */
  async getUser() {
    const { data, error } = await supabase.auth.getUser();
    if (error) throw error;
    return data.user;
  },

  /**
   * Reset password
   */
  async resetPassword(email: string) {
    const { data, error} = await supabase.auth.resetPasswordForEmail(email);
    if (error) throw error;
    return data;
  },

  /**
   * Listen to auth state changes
   */
  onAuthStateChange(callback: (event: string, session: any) => void) {
    return supabase.auth.onAuthStateChange(callback);
  },
};

// =====================================================
// AIRCRAFT PROFILES
// =====================================================

export const aircraftClient = {
  /**
   * Get all aircraft profiles for the current user
   */
  async getProfiles(): Promise<AircraftProfile[]> {
    const { data, error } = await supabase
      .from('aircraft_profiles')
      .select('*')
      .order('name');

    if (error) throw error;

    // Transform database format to app format
    return (data || []).map(transformDbToAircraft);
  },

  /**
   * Get a single aircraft profile by ID
   */
  async getProfile(id: string): Promise<AircraftProfile | null> {
    const { data, error } = await supabase
      .from('aircraft_profiles')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    return transformDbToAircraft(data);
  },

  /**
   * Create a new aircraft profile
   */
  async createProfile(profile: AircraftProfile): Promise<AircraftProfile> {
    const user = await authClient.getUser();
    if (!user) throw new Error('Not authenticated');

    const dbProfile = transformAircraftToDb(profile, user.id);

    const { data, error } = await supabase
      .from('aircraft_profiles')
      .insert(dbProfile as any)
      .select()
      .single();

    if (error) throw error;
    return transformDbToAircraft(data as DbAircraftProfile);
  },

  /**
   * Update an existing aircraft profile
   */
  async updateProfile(id: string, profile: Partial<AircraftProfile>): Promise<AircraftProfile> {
    const user = await authClient.getUser();
    if (!user) throw new Error('Not authenticated');

    const dbProfile = transformAircraftToDb(profile as AircraftProfile, user.id);
    delete (dbProfile as any).id; // Don't update ID
    delete (dbProfile as any).created_at; // Don't update created_at

    const { data, error } = await supabase
      .from('aircraft_profiles')
      // @ts-ignore - Supabase type generation issue
      .update(dbProfile)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return transformDbToAircraft(data as DbAircraftProfile);
  },

  /**
   * Delete an aircraft profile
   */
  async deleteProfile(id: string): Promise<void> {
    const { error } = await supabase
      .from('aircraft_profiles')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};

// =====================================================
// WEIGHT & BALANCE SCENARIOS
// =====================================================

export type WBScenario = {
  id: string;
  name: string;
  aircraftId: string;
  frontLb: number;
  rearLb: number;
  baggageByStation: Record<string, number>;
  startFuelGal: string;
  taxiFuelGal: string;
  plannedBurnGal: string;
  createdAt: string;
};

export const wbScenarioClient = {
  /**
   * Get all W&B scenarios for the current user
   */
  async getScenarios(): Promise<WBScenario[]> {
    const { data, error } = await supabase
      .from('wb_scenarios')
      .select('*')
      .order('created_at', { ascending: false });

    if (error) throw error;

    return (data || []).map(transformDbToWBScenario);
  },

  /**
   * Create a new W&B scenario
   */
  async createScenario(scenario: Omit<WBScenario, 'id' | 'createdAt'>): Promise<WBScenario> {
    const user = await authClient.getUser();
    if (!user) throw new Error('Not authenticated');

    const dbScenario = {
      user_id: user.id,
      name: scenario.name,
      aircraft_id: scenario.aircraftId,
      front_lb: scenario.frontLb,
      rear_lb: scenario.rearLb,
      baggage_by_station: scenario.baggageByStation as any,
      start_fuel_gal: scenario.startFuelGal,
      taxi_fuel_gal: scenario.taxiFuelGal,
      planned_burn_gal: scenario.plannedBurnGal,
    };

    const { data, error } = await supabase
      .from('wb_scenarios')
      .insert(dbScenario as any)
      .select()
      .single();

    if (error) throw error;
    return transformDbToWBScenario(data);
  },

  /**
   * Delete a W&B scenario
   */
  async deleteScenario(id: string): Promise<void> {
    const { error } = await supabase
      .from('wb_scenarios')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};

function transformDbToWBScenario(db: any): WBScenario {
  return {
    id: db.id,
    name: db.name,
    aircraftId: db.aircraft_id,
    frontLb: db.front_lb,
    rearLb: db.rear_lb,
    baggageByStation: db.baggage_by_station || {},
    startFuelGal: db.start_fuel_gal,
    taxiFuelGal: db.taxi_fuel_gal,
    plannedBurnGal: db.planned_burn_gal,
    createdAt: db.created_at,
  };
}

// =====================================================
// FLIGHT SESSIONS
// =====================================================

export const sessionClient = {
  /**
   * Get all sessions for the current user
   */
  async getSessions() {
    const { data, error } = await supabase
      .from('flight_sessions')
      .select('*')
      .order('updated_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  /**
   * Get the current active session
   */
  async getCurrentSession() {
    const { data, error } = await supabase
      .from('flight_sessions')
      .select('*')
      .eq('is_current', true)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null; // Not found
      throw error;
    }

    return data;
  },

  /**
   * Get a single session by ID
   */
  async getSession(id: string) {
    const { data, error } = await supabase
      .from('flight_sessions')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return data;
  },

  /**
   * Create a new session
   */
  async createSession(name: string, metadata?: {
    route?: string;
    departure?: string;
    destination?: string;
    departure_time?: string;
  }) {
    const user = await authClient.getUser();
    if (!user) throw new Error('Not authenticated');

    const { data, error } = await supabase
      .from('flight_sessions')
      .insert({
        user_id: user.id,
        name,
        is_current: true, // New session becomes current
        route: metadata?.route,
        departure_icao: metadata?.departure,
        destination_icao: metadata?.destination,
        departure_time: metadata?.departure_time,
      } as any)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Update a session
   */
  async updateSession(id: string, updates: {
    name?: string;
    completed_steps?: any;
    session_data?: any;
    aircraft_profile_id?: string;
    route?: string;
    departure_icao?: string;
    destination_icao?: string;
  }) {
    const { data, error } = await supabase
      .from('flight_sessions')
      // @ts-ignore - Supabase type generation issue
      .update(updates)
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Set a session as current
   */
  async setCurrentSession(id: string) {
    const { data, error } = await supabase
      .from('flight_sessions')
      // @ts-ignore - Supabase type generation issue
      .update({ is_current: true })
      .eq('id', id)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  /**
   * Delete a session
   */
  async deleteSession(id: string) {
    const { error } = await supabase
      .from('flight_sessions')
      .delete()
      .eq('id', id);

    if (error) throw error;
  },
};

// =====================================================
// HELPER FUNCTIONS
// =====================================================

/**
 * Transform database aircraft profile to app format
 */
function transformDbToAircraft(db: DbAircraftProfile): AircraftProfile {
  const envelopeData = db.cg_envelope as any;

  // Handle both new format (cgEnvelopes with categories) and legacy format (cgEnvelope)
  let cgEnvelopes = undefined;
  let cgEnvelope = undefined;

  if (envelopeData) {
    // Check if it's the new format with categories (normal/utility)
    if (envelopeData.normal || envelopeData.utility) {
      cgEnvelopes = envelopeData;
    } else if (envelopeData.points) {
      // Legacy format: single envelope with points
      cgEnvelope = envelopeData;
    }
  }

  return {
    id: db.id,
    tailNumber: db.tail_number || '',
    makeModel: db.name || db.aircraft_type || '',
    notes: '',
    emptyWeight: {
      weightLb: db.empty_weight_lb || 0,
      momentLbIn: (db.empty_weight_lb || 0) * (db.empty_cg_in || 0),
    },
    limits: {
      maxRampLb: db.max_ramp_weight_lb || undefined,
      maxTakeoffLb: db.max_gross_weight_lb || undefined,
      maxLandingLb: db.max_gross_weight_lb || undefined,
    },
    fuel: {
      usableGal: db.usable_fuel_gal || 0,
      densityLbPerGal: 6.0, // Standard avgas density
    },
    stations: (db.stations as any) || [],
    cgEnvelopes: cgEnvelopes,
    cgEnvelope: cgEnvelope,
    performance: (db.performance_data as any) || undefined,
    createdAt: db.created_at,
    updatedAt: db.updated_at,
  };
}

/**
 * Transform app aircraft profile to database format
 */
function transformAircraftToDb(
  profile: AircraftProfile,
  userId: string
): DbAircraftProfileInsert {
  // Prefer new cgEnvelopes format over legacy cgEnvelope
  const envelopeData = profile.cgEnvelopes || profile.cgEnvelope;

  return {
    user_id: userId,
    name: profile.makeModel,
    tail_number: profile.tailNumber,
    aircraft_type: profile.makeModel,
    empty_weight_lb: profile.emptyWeight.weightLb,
    empty_cg_in: profile.emptyWeight.weightLb > 0
      ? profile.emptyWeight.momentLbIn / profile.emptyWeight.weightLb
      : 0,
    max_gross_weight_lb: profile.limits.maxTakeoffLb,
    max_ramp_weight_lb: profile.limits.maxRampLb,
    stations: profile.stations as any,
    cg_envelope: envelopeData as any,
    performance_data: profile.performance as any,
    fuel_capacity_gal: profile.fuel.usableGal,
    usable_fuel_gal: profile.fuel.usableGal,
  };
}

/**
 * Subscribe to real-time changes for a table
 */
export function subscribeToTable(
  table: 'aircraft_profiles' | 'flight_sessions',
  callback: (payload: any) => void
) {
  return supabase
    .channel(`public:${table}`)
    .on('postgres_changes', { event: '*', schema: 'public', table }, callback)
    .subscribe();
}

// =====================================================
// AIRPORTS & RUNWAYS
// =====================================================

export type Airport = {
  icao: string;
  name: string;
  iata: string | null;
  type: string | null;
  latitude: number | null;
  longitude: number | null;
  elevationFt: number | null;
  municipality: string | null;
  region: string | null;
  country: string | null;
};

export type Runway = {
  id: string;
  airportIcao: string;
  identifier: string; // "09", "27", "04R"
  headingDeg: number | null;
  lengthFt: number | null;
  widthFt: number | null;
  surface: string | null;
  displacedThresholdFt: number | null;
  isClosed: boolean;
};

export type RunwayWithWind = Runway & {
  headwindComponent: number;
  crosswindComponent: number;
};

export const airportClient = {
  /**
   * Search for airport by ICAO code
   */
  async getAirport(icao: string): Promise<Airport | null> {
    const { data, error } = await supabase
      .from('airports')
      .select('*')
      .eq('icao', icao.toUpperCase())
      .maybeSingle();

    if (error || !data) {
      if (error) console.error('Error fetching airport:', error);
      return null;
    }

    // Transform database row to app format
    const airport = data as Database['public']['Tables']['airports']['Row'];

    return {
      icao: airport.icao,
      name: airport.name,
      iata: airport.iata,
      type: airport.type,
      latitude: airport.latitude_deg,
      longitude: airport.longitude_deg,
      elevationFt: airport.elevation_ft,
      municipality: airport.municipality,
      region: airport.region,
      country: airport.country,
    };
  },

  /**
   * Get all runways for an airport
   */
  async getRunways(icao: string): Promise<Runway[]> {
    const { data, error } = await supabase
      .from('runways')
      .select('*')
      .eq('airport_icao', icao.toUpperCase())
      .eq('is_closed', false)
      .order('identifier');

    if (error) {
      console.error('Error fetching runways:', error);
      return [];
    }

    return (data || []).map(transformDbToRunway);
  },

  /**
   * Get airport with runways
   */
  async getAirportWithRunways(icao: string): Promise<{ airport: Airport | null; runways: Runway[] }> {
    const [airport, runways] = await Promise.all([
      this.getAirport(icao),
      this.getRunways(icao),
    ]);

    return { airport, runways };
  },

  /**
   * Calculate wind components for runways
   */
  calculateWindComponents(
    runways: Runway[],
    windDir: number,
    windSpeed: number
  ): RunwayWithWind[] {
    return runways.map(runway => {
      const runwayHeading = runway.headingDeg || 0;
      const angleDiff = Math.abs(windDir - runwayHeading);
      
      // Convert to radians
      const angleRad = (angleDiff % 360) * Math.PI / 180;
      
      // Calculate components
      const headwind = Math.round(windSpeed * Math.cos(angleRad));
      const crosswind = Math.round(Math.abs(windSpeed * Math.sin(angleRad)));

      return {
        ...runway,
        headwindComponent: headwind,
        crosswindComponent: crosswind,
      };
    });
  },

  /**
   * Rank runways by best headwind
   */
  rankRunwaysByWind(runwaysWithWind: RunwayWithWind[]): RunwayWithWind[] {
    return [...runwaysWithWind].sort((a, b) => b.headwindComponent - a.headwindComponent);
  },
};

function transformDbToRunway(db: any): Runway {
  return {
    id: db.id,
    airportIcao: db.airport_icao,
    identifier: db.identifier,
    headingDeg: db.heading_deg,
    lengthFt: db.length_ft,
    widthFt: db.width_ft,
    surface: db.surface,
    displacedThresholdFt: db.displaced_threshold_ft,
    isClosed: db.is_closed || false,
  };
}
