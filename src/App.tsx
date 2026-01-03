import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { useMemo, useState } from 'react';
import HomePage from './features/home/HomePage';
import AircraftPage from './features/aircraft/AircraftPage';
import WeightBalancePage from './features/weightBalance/WeightBalancePage';
import NavlogPage from './features/navlog/NavlogPage';
import PerformancePage from './features/performance/PerformancePage';
import WeatherPage from './features/weather/WeatherPage';
import { WorkflowProgress } from './components/WorkflowProgress';
import { WorkflowGuard } from './components/WorkflowGuard';
import { TripHeader } from './components/TripHeader';
import { useAuth } from './context/AuthContext';
import { useFlightSession, type FlightSession } from './context/FlightSessionContext';
import { TripWizardLayout } from './components/TripWizard/TripWizardLayout';
import { StepGuard } from './components/TripWizard/StepGuard';
import { BasicsStep } from './components/TripWizard/steps/BasicsStep';
import { WeatherStep } from './components/TripWizard/steps/WeatherStep';
import { PerformanceStep } from './components/TripWizard/steps/PerformanceStep';
import { ExportStep } from './components/TripWizard/steps/ExportStep';

// Consistent color scheme
const COLORS = {
  primary: '#2563eb', // blue-600
  primaryDark: '#1e40af', // blue-800
  primaryLight: '#3b82f6', // blue-500
  accent: '#60a5fa', // blue-400
  background: '#f8fafc', // slate-50
  text: '#1e293b', // slate-800
  textLight: '#64748b', // slate-500
  border: '#e2e8f0', // slate-200
};

type Step = keyof FlightSession['completed'];

const STEP_ORDER: Step[] = ['aircraft', 'weightBalance', 'performance', 'weather', 'navlog'];

const STEP_ROUTES: Record<Step, string> = {
  aircraft: '/aircraft',
  weightBalance: '/wb',
  performance: '/performance',
  weather: '/weather',
  navlog: '/navlog',
};

const NAV_ITEMS: Array<{ step: Step; label: string; to: string }> = [
  { step: 'aircraft', label: '1. Aircraft', to: STEP_ROUTES.aircraft },
  { step: 'weightBalance', label: '2. W&B', to: STEP_ROUTES.weightBalance },
  { step: 'performance', label: '3. Performance', to: STEP_ROUTES.performance },
  { step: 'weather', label: '4. Weather', to: STEP_ROUTES.weather },
  { step: 'navlog', label: '5. Navlog', to: STEP_ROUTES.navlog },
];

function getStepFromPath(pathname: string): Step | null {
  const match = (Object.entries(STEP_ROUTES) as Array<[Step, string]>).find(([, path]) =>
    pathname.startsWith(path),
  );
  return match ? match[0] : null;
}

function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isHomePage = location.pathname === '/';
  const { user, login, logout, isAuthenticated } = useAuth();
  const { currentSession, completeStep } = useFlightSession();
  const [showLogin, setShowLogin] = useState(false);
  const [loginUsername, setLoginUsername] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [loginError, setLoginError] = useState('');
  const activeStep = useMemo(() => getStepFromPath(location.pathname), [location.pathname]);

  function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    const success = login(loginUsername, loginPassword);
    if (success) {
      setShowLogin(false);
      setLoginUsername('');
      setLoginPassword('');
      setLoginError('');
    } else {
      setLoginError('Invalid username or password');
    }
  }

  const linkStyle = ({ isActive }: { isActive: boolean }) => ({
    padding: '8px 16px',
    textDecoration: 'none',
    fontWeight: isActive ? 700 : 500,
    color: isActive ? COLORS.primary : COLORS.text,
    borderRadius: 8,
    background: isActive ? `${COLORS.primary}10` : 'transparent',
    transition: 'all 0.2s',
    fontSize: 14,
    whiteSpace: 'nowrap' as const,
  });

  const handleNavClick = (targetStep: Step) => {
    if (!currentSession || !activeStep) return;

    const currentIndex = STEP_ORDER.indexOf(activeStep);
    const targetIndex = STEP_ORDER.indexOf(targetStep);

    if (targetIndex > currentIndex) {
      completeStep(activeStep);
    }
  };

  return (
    <div style={{ fontFamily: 'system-ui', background: COLORS.background, minHeight: '100vh' }}>
      {/* Navigation Header */}
      {!isHomePage && (
        <header
          style={{
            background: '#fff',
            borderBottom: `1px solid ${COLORS.border}`,
            padding: '16px 24px',
            position: 'sticky',
            top: 0,
            zIndex: 100,
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}
        >
          <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 24 }}>
            {/* Logo */}
            <NavLink
              to="/"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                textDecoration: 'none',
                color: COLORS.primary,
              }}
            >
              <img src="/images/logo.png" alt="Cleared To Plan" style={{ width: 40, height: 'auto' }} />
              <div style={{ fontSize: 20, fontWeight: 900 }}>Cleared to Plan</div>
            </NavLink>

            {/* Main Navigation */}
            <nav
              style={{
                marginLeft: 'auto',
                display: 'flex',
                gap: 8,
                alignItems: 'center',
                flexWrap: 'wrap',
              }}
            >
              {NAV_ITEMS.map(({ step, label, to }) => (
                <NavLink key={step} to={to} style={linkStyle} onClick={() => handleNavClick(step)}>
                  {label}
                </NavLink>
              ))}

              {/* Donate Button */}
              <a
                href="https://donate.stripe.com/test_00000000" // Replace with actual link
                target="_blank"
                rel="noopener noreferrer"
                style={{
                  padding: '8px 16px',
                  background: COLORS.primary,
                  color: '#fff',
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: 14,
                  textDecoration: 'none',
                  marginLeft: 8,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = COLORS.primaryDark;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = COLORS.primary;
                }}
              >
                ☕ Donate
              </a>

              {/* Auth Button */}
              {isAuthenticated ? (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginLeft: 8 }}>
                  <span style={{ fontSize: 13, color: COLORS.textLight }}>👤 {user?.username}</span>
                  <button
                    onClick={logout}
                    style={{
                      padding: '6px 12px',
                      background: '#f3f4f6',
                      color: COLORS.text,
                      border: 'none',
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 600,
                      cursor: 'pointer',
                    }}
                  >
                    Logout
                  </button>
                </div>
              ) : (
                <button
                  onClick={() => setShowLogin(true)}
                  style={{
                    padding: '8px 16px',
                    background: '#f3f4f6',
                    color: COLORS.text,
                    border: 'none',
                    borderRadius: 8,
                    fontWeight: 700,
                    fontSize: 14,
                    marginLeft: 8,
                    cursor: 'pointer',
                  }}
                >
                  Login
                </button>
              )}
            </nav>
          </div>
        </header>
      )}

      {/* Login Modal */}
      {showLogin && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowLogin(false)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 16,
              padding: 32,
              maxWidth: 400,
              width: '90%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: 0, marginBottom: 8, fontSize: 24, fontWeight: 900, color: COLORS.text }}>
              Login
            </h2>
            <p style={{ margin: 0, marginBottom: 16, fontSize: 13, color: COLORS.textLight }}>
              Default credentials: <strong>pilot</strong> / <strong>cleared2024</strong>
            </p>
            <form onSubmit={handleLogin}>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: COLORS.text }}>
                  Username
                </label>
                <input
                  type="text"
                  value={loginUsername}
                  onChange={(e) => setLoginUsername(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: 14,
                    borderRadius: 8,
                    border: '2px solid #e2e8f0',
                    boxSizing: 'border-box',
                  }}
                  autoFocus
                />
              </div>
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', marginBottom: 6, fontSize: 13, fontWeight: 600, color: COLORS.text }}>
                  Password
                </label>
                <input
                  type="password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  style={{
                    width: '100%',
                    padding: '10px 12px',
                    fontSize: 14,
                    borderRadius: 8,
                    border: '2px solid #e2e8f0',
                    boxSizing: 'border-box',
                  }}
                />
              </div>
              {loginError && (
                <div style={{ padding: 10, marginBottom: 16, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, fontSize: 13, color: '#991b1b' }}>
                  {loginError}
                </div>
              )}
              <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
                <button
                  type="button"
                  onClick={() => setShowLogin(false)}
                  style={{
                    padding: '10px 20px',
                    background: '#f3f4f6',
                    color: COLORS.text,
                    border: 'none',
                    borderRadius: 8,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  style={{
                    padding: '10px 20px',
                    background: COLORS.primary,
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    fontWeight: 600,
                    cursor: 'pointer',
                  }}
                >
                  Login
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Workflow Progress */}
      {!isHomePage && (
        <>
          <WorkflowProgress />
          <TripHeader />
        </>
      )}

      {/* Main Content */}
      {isHomePage ? (
        children
      ) : (
        <div style={{ maxWidth: 1400, margin: '0 auto', padding: 24 }}>
          <main
            style={{
              padding: 32,
              border: `1px solid ${COLORS.border}`,
              borderRadius: 16,
              background: '#fff',
              boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
            }}
          >
            {children}
          </main>

          <footer
            style={{
              marginTop: 24,
              padding: 16,
              textAlign: 'center',
              fontSize: 13,
              color: COLORS.textLight,
            }}
          >
            <div style={{ marginBottom: 8 }}>
              <strong>Training aid only</strong> — Always verify results with official sources and your POH/AFM
            </div>
            <div style={{ fontSize: 12, opacity: 0.8 }}>
              VFR planning • Not for commercial use • Built by{' '}
              <a
                href="https://flywithian.com"
                target="_blank"
                rel="noopener noreferrer"
                style={{ color: COLORS.primary }}
              >
                Fly With Ian
              </a>
            </div>
          </footer>
        </div>
      )}
    </div>
  );
}

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<HomePage />} />
        <Route path="/trip-wizard" element={<TripWizardLayout />}>
          <Route
            index
            element=
              {(
                <StepGuard step="basics">
                  <BasicsStep />
                </StepGuard>
              )}
          />
          <Route
            path="weather"
            element=
              {(
                <StepGuard step="weather">
                  <WeatherStep />
                </StepGuard>
              )}
          />
          <Route
            path="performance"
            element=
              {(
                <StepGuard step="performance">
                  <PerformanceStep />
                </StepGuard>
              )}
          />
          <Route
            path="export"
            element=
              {(
                <StepGuard step="export">
                  <ExportStep />
                </StepGuard>
              )}
          />
        </Route>
        <Route
          path="/aircraft"
          element={
            <WorkflowGuard step="aircraft">
              <AircraftPage />
            </WorkflowGuard>
          }
        />
        <Route
          path="/wb"
          element={
            <WorkflowGuard step="weightBalance">
              <WeightBalancePage />
            </WorkflowGuard>
          }
        />
        <Route
          path="/performance"
          element={
            <WorkflowGuard step="performance">
              <PerformancePage />
            </WorkflowGuard>
          }
        />
        <Route
          path="/weather"
          element={
            <WorkflowGuard step="weather">
              <WeatherPage />
            </WorkflowGuard>
          }
        />
        <Route
          path="/navlog"
          element={
            <WorkflowGuard step="navlog">
              <NavlogPage />
            </WorkflowGuard>
          }
        />
      </Routes>
    </Layout>
  );
}
