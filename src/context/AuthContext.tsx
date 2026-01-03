import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

// Simple auth for now - will be enhanced with real backend later
type User = {
  id: string;
  username: string;
  email: string;
};

type AuthContextType = {
  user: User | null;
  login: (username: string, password: string) => boolean;
  logout: () => void;
  isAuthenticated: boolean;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

// Default credentials for development
const DEFAULT_USER = {
  id: 'default_user',
  username: 'pilot',
  email: 'pilot@clearedtoplan.com',
};

const DEFAULT_PASSWORD = 'cleared2024';

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

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
