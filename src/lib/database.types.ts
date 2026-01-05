// TypeScript types for Supabase database
// This file defines the schema structure for type-safe database access

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[];

export interface Database {
  public: {
    Tables: {
      aircraft_profiles: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          tail_number: string | null;
          aircraft_type: string | null;
          empty_weight_lb: number | null;
          empty_cg_in: number | null;
          max_gross_weight_lb: number | null;
          max_ramp_weight_lb: number | null;
          stations: Json;
          cg_envelope: Json;
          performance_data: Json;
          fuel_capacity_gal: number | null;
          usable_fuel_gal: number | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          tail_number?: string | null;
          aircraft_type?: string | null;
          empty_weight_lb?: number | null;
          empty_cg_in?: number | null;
          max_gross_weight_lb?: number | null;
          max_ramp_weight_lb?: number | null;
          stations?: Json;
          cg_envelope?: Json;
          performance_data?: Json;
          fuel_capacity_gal?: number | null;
          usable_fuel_gal?: number | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          tail_number?: string | null;
          aircraft_type?: string | null;
          empty_weight_lb?: number | null;
          empty_cg_in?: number | null;
          max_gross_weight_lb?: number | null;
          max_ramp_weight_lb?: number | null;
          stations?: Json;
          cg_envelope?: Json;
          performance_data?: Json;
          fuel_capacity_gal?: number | null;
          usable_fuel_gal?: number | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      flight_sessions: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          is_current: boolean;
          aircraft_profile_id: string | null;
          completed_steps: Json;
          session_data: Json;
          route: string | null;
          departure_icao: string | null;
          destination_icao: string | null;
          departure_time: string | null;
          created_at: string;
          updated_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          is_current?: boolean;
          aircraft_profile_id?: string | null;
          completed_steps?: Json;
          session_data?: Json;
          route?: string | null;
          departure_icao?: string | null;
          destination_icao?: string | null;
          departure_time?: string | null;
          created_at?: string;
          updated_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          is_current?: boolean;
          aircraft_profile_id?: string | null;
          completed_steps?: Json;
          session_data?: Json;
          route?: string | null;
          departure_icao?: string | null;
          destination_icao?: string | null;
          departure_time?: string | null;
          created_at?: string;
          updated_at?: string;
        };
      };
      wb_scenarios: {
        Row: {
          id: string;
          user_id: string;
          name: string;
          aircraft_id: string;
          front_lb: number;
          rear_lb: number;
          baggage_by_station: Json;
          start_fuel_gal: string;
          taxi_fuel_gal: string;
          planned_burn_gal: string;
          created_at: string;
        };
        Insert: {
          id?: string;
          user_id: string;
          name: string;
          aircraft_id: string;
          front_lb?: number;
          rear_lb?: number;
          baggage_by_station?: Json;
          start_fuel_gal?: string;
          taxi_fuel_gal?: string;
          planned_burn_gal?: string;
          created_at?: string;
        };
        Update: {
          id?: string;
          user_id?: string;
          name?: string;
          aircraft_id?: string;
          front_lb?: number;
          rear_lb?: number;
          baggage_by_station?: Json;
          start_fuel_gal?: string;
          taxi_fuel_gal?: string;
          planned_burn_gal?: string;
          created_at?: string;
        };
      };
      weather_cache: {
        Row: {
          id: string;
          icao: string;
          metar_data: Json | null;
          taf_data: Json | null;
          fetched_at: string;
          expires_at: string;
        };
        Insert: {
          id?: string;
          icao: string;
          metar_data?: Json | null;
          taf_data?: Json | null;
          fetched_at?: string;
          expires_at: string;
        };
        Update: {
          id?: string;
          icao?: string;
          metar_data?: Json | null;
          taf_data?: Json | null;
          fetched_at?: string;
          expires_at?: string;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
  };
}
