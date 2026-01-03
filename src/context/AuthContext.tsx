/**
 * Authentication Context
 *
 * Provides user authentication state and functions throughout the application.
 * Currently implements simple local authentication with hardcoded credentials.
 *
 * Features:
 * - Login/logout functionality
 * - Persistent authentication state via localStorage
 * - React Context for global auth state
 * - Custom hook (useAuth) for easy access
 *
 * Current Implementation:
 * - Single default user (username: "pilot", password: "cleared2024")
 * - Credentials stored in localStorage (clearedtoplan_user key)
 * - No backend integration (ready for future enhancement)
 *
 * Future Enhancements:
 * - Backend API integration for real authentication
 * - JWT token management
 * - Password reset and recovery
 * - Multi-user support with roles
 * - OAuth/SSO integration
 *
 * Usage:
 * ```tsx
 * const { user, login, logout, isAuthenticated } = useAuth();
 *
 * // Login
 * const success = login('pilot', 'cleared2024');
 *
 * // Check auth status
 * if (isAuthenticated) {
 *   console.log('Logged in as:', user.username);
 * }
 *
 * // Logout
 * logout();
 * ```
 *
 * @module AuthContext
 */
import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

/**
 * User object representing an authenticated user
 */
type User = {
  id: string;
  username: string;
  email: string;
};

/**
 * Authentication context value shape
 */
type AuthContextType = {
  /** Currently authenticated user, or null if not logged in */
  user: User | null;
  /** Attempt to log in with username and password. Returns true if successful. */
  login: (username: string, password: string) => boolean;
  /** Log out the current user and clear auth state */
  logout: () => void;
  /** Convenience flag: true if user is logged in */
  isAuthenticated: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

/**
 * Default development credentials
 * Username: pilot
 * Password: cleared2024
 */
const DEFAULT_USER = {
  id: 'default_user',
  username: 'pilot',
  email: 'pilot@clearedtoplan.com',
};

const DEFAULT_PASSWORD = 'cleared2024';

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

  // Load user from localStorage on mount
  useEffect(() => {
    const storedUser = localStorage.getItem('clearedtoplan_user');
    if (storedUser) {
      try {
        setUser(JSON.parse(storedUser));
      } catch (error) {
        console.error('Error loading user from localStorage:', error);
        localStorage.removeItem('clearedtoplan_user');
      }
    }
  }, []);

  function login(username: string, password: string): boolean {
    // For now, check against default credentials
    if (username === DEFAULT_USER.username && password === DEFAULT_PASSWORD) {
      setUser(DEFAULT_USER);
      localStorage.setItem('clearedtoplan_user', JSON.stringify(DEFAULT_USER));
      return true;
    }
    return false;
  }

  function logout() {
    setUser(null);
    localStorage.removeItem('clearedtoplan_user');
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        isAuthenticated: !!user,
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
