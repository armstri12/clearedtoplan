/**
 * Aircraft Profile Context
 *
 * Manages aircraft profiles with Supabase backend storage
 *
 * Features:
 * - Load profiles from Supabase
 * - Create, update, delete operations
 * - Real-time sync across devices
 * - React Context for global state
 * - Custom hook (useAircraft) for easy access
 */

import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { aircraftClient } from '../services/supabaseClient';
import type { AircraftProfile } from '../features/aircraft/types';
import { useAuth } from './AuthContext';

type AircraftContextType = {
  /** All aircraft profiles for the current user */
  profiles: AircraftProfile[];
  /** Loading state */
  loading: boolean;
  /** Create a new profile */
  createProfile: (profile: AircraftProfile) => Promise<{ success: boolean; error?: string }>;
  /** Update an existing profile */
  updateProfile: (id: string, profile: AircraftProfile) => Promise<{ success: boolean; error?: string }>;
  /** Delete a profile */
  deleteProfile: (id: string) => Promise<{ success: boolean; error?: string }>;
  /** Reload profiles from Supabase */
  reloadProfiles: () => Promise<void>;
};

const AircraftContext = createContext<AircraftContextType | undefined>(undefined);

export function AircraftProvider({ children }: { children: ReactNode }) {
  const { user, isAuthenticated } = useAuth();
  const [profiles, setProfiles] = useState<AircraftProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Load profiles when user logs in
  useEffect(() => {
    if (!isAuthenticated) {
      setProfiles([]);
      setLoading(false);
      return;
    }

    loadProfiles();
  }, [isAuthenticated, user?.id]);

  async function loadProfiles() {
    try {
      setLoading(true);
      const data = await aircraftClient.getProfiles();
      setProfiles(data);
    } catch (error) {
      console.error('Error loading aircraft profiles:', error);
      setProfiles([]);
    } finally {
      setLoading(false);
    }
  }

  async function createProfile(profile: AircraftProfile): Promise<{ success: boolean; error?: string }> {
    try {
      const created = await aircraftClient.createProfile(profile);
      setProfiles((prev) => [created, ...prev]);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error?.message || 'Failed to create profile' };
    }
  }

  async function updateProfile(id: string, profile: AircraftProfile): Promise<{ success: boolean; error?: string }> {
    try {
      const updated = await aircraftClient.updateProfile(id, profile);
      setProfiles((prev) => prev.map((p) => (p.id === id ? updated : p)));
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error?.message || 'Failed to update profile' };
    }
  }

  async function deleteProfile(id: string): Promise<{ success: boolean; error?: string }> {
    try {
      await aircraftClient.deleteProfile(id);
      setProfiles((prev) => prev.filter((p) => p.id !== id));
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error?.message || 'Failed to delete profile' };
    }
  }

  return (
    <AircraftContext.Provider
      value={{
        profiles,
        loading,
        createProfile,
        updateProfile,
        deleteProfile,
        reloadProfiles: loadProfiles,
      }}
    >
      {children}
    </AircraftContext.Provider>
  );
}

/**
 * Custom hook to access aircraft context
 */
export function useAircraft() {
  const context = useContext(AircraftContext);
  if (context === undefined) {
    throw new Error('useAircraft must be used within AircraftProvider');
  }
  return context;
}
