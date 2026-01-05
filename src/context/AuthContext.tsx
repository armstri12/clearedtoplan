/**
 * Authentication Context
 *
 * Provides user authentication state and functions throughout the application.
 * Integrated with Supabase Auth for real authentication.
 *
 * Features:
 * - Email/password authentication via Supabase
 * - User registration and login
 * - Persistent authentication state (handled by Supabase)
 * - Real-time auth state synchronization
 * - React Context for global auth state
 * - Custom hook (useAuth) for easy access
 *
 * Usage:
 * ```tsx
 * const { user, login, signup, logout, isAuthenticated, loading } = useAuth();
 *
 * // Sign up
 * await signup('user@example.com', 'password123', 'John Doe');
 *
 * // Login
 * const { success, error } = await login('user@example.com', 'password123');
 *
 * // Check auth status
 * if (isAuthenticated) {
 *   console.log('Logged in as:', user.email);
 * }
 *
 * // Logout
 * await logout();
 * ```
 *
 * @module AuthContext
 */
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';
import { authClient } from '../services/supabaseClient';
import type { User as SupabaseUser } from '@supabase/supabase-js';

/**
 * User object representing an authenticated user
 */
type User = {
  id: string;
  email: string;
  name?: string;
};

/**
 * Authentication context value shape
 */
type AuthContextType = {
  /** Currently authenticated user, or null if not logged in */
  user: User | null;
  /** Sign up a new user with email, password, and optional name */
  signup: (email: string, password: string, name?: string) => Promise<{ success: boolean; error?: string }>;
  /** Attempt to log in with email and password */
  login: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  /** Log out the current user and clear auth state */
  logout: () => Promise<void>;
  /** Convenience flag: true if user is logged in */
  isAuthenticated: boolean;
  /** Loading state for initial auth check */
  loading: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Transform Supabase user to our User type
 */
function transformSupabaseUser(supabaseUser: SupabaseUser | null): User | null {
  if (!supabaseUser) return null;

  return {
    id: supabaseUser.id,
    email: supabaseUser.email || '',
    name: supabaseUser.user_metadata?.name,
  };
}

/**
 * Authentication Provider Component
 *
 * Wraps the application to provide authentication state and functions.
 * Must be placed near the root of the component tree.
 *
 * @param children - Child components that will have access to auth context
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  // Load user from Supabase session on mount and listen for auth changes
  useEffect(() => {
    // Get initial session
    authClient.getSession().then((session) => {
      setUser(transformSupabaseUser(session?.user ?? null));
      setLoading(false);
    }).catch(() => {
      setUser(null);
      setLoading(false);
    });

    // Listen for auth state changes
    const { data: { subscription } } = authClient.onAuthStateChange((_event, session) => {
      setUser(transformSupabaseUser(session?.user ?? null));
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  async function signup(email: string, password: string, name?: string): Promise<{ success: boolean; error?: string }> {
    try {
      await authClient.signUp(email, password, name);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error?.message || 'An unexpected error occurred' };
    }
  }

  async function login(email: string, password: string): Promise<{ success: boolean; error?: string }> {
    try {
      await authClient.signIn(email, password);
      return { success: true };
    } catch (error: any) {
      return { success: false, error: error?.message || 'An unexpected error occurred' };
    }
  }

  async function logout(): Promise<void> {
    try {
      await authClient.signOut();
    } catch (error) {
      console.error('Error signing out:', error);
    }
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        signup,
        login,
        logout,
        isAuthenticated: !!user,
        loading,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

/**
 * Custom hook to access authentication context
 *
 * Must be used within an AuthProvider component tree.
 * Throws an error if used outside of AuthProvider.
 *
 * @returns Authentication context with user, login, logout, and isAuthenticated
 * @throws Error if used outside AuthProvider
 *
 * @example
 * ```tsx
 * function MyComponent() {
 *   const { user, isAuthenticated, login, logout } = useAuth();
 *
 *   if (!isAuthenticated) {
 *     return <button onClick={() => login('pilot', 'cleared2024')}>Login</button>;
 *   }
 *
 *   return <div>Welcome, {user.username}!</div>;
 * }
 * ```
 */
export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
