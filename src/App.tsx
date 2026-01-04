import { NavLink, Route, Routes, useLocation } from 'react-router-dom';
import HomePage from './features/home/HomePage';
import { TripWizardLayout } from './components/TripWizard/TripWizardLayout';
import { StepGuard } from './components/TripWizard/StepGuard';
import { BasicsStep } from './components/TripWizard/steps/BasicsStep';
import { WeatherStep } from './components/TripWizard/steps/WeatherStep';
import { PerformanceStep } from './components/TripWizard/steps/PerformanceStep';
import { ExportBriefStep } from './components/TripWizard/steps/ExportBriefStep';

// Consistent color scheme
const COLORS = {
  primary: '#2563eb',
  primaryDark: '#1e40af',
  background: '#f8fafc',
  text: '#1e293b',
  textLight: '#64748b',
  border: '#e2e8f0',
};

function Layout({ children }: { children: React.ReactNode }) {
  const location = useLocation();
  const isHomePage = location.pathname === '/';

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

            {/* Donate Button */}
            <a
              href="https://donate.stripe.com/test_00000000"
              target="_blank"
              rel="noopener noreferrer"
              style={{
                marginLeft: 'auto',
                padding: '8px 16px',
                background: COLORS.primary,
                color: '#fff',
                borderRadius: 8,
                fontWeight: 700,
                fontSize: 14,
                textDecoration: 'none',
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
          </div>
        </header>
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
            element={
              <StepGuard step="basics">
                <BasicsStep />
              </StepGuard>
            }
          />
          <Route
            path="weather"
            element={
              <StepGuard step="weather">
                <WeatherStep />
              </StepGuard>
            }
          />
          <Route
            path="performance"
            element={
              <StepGuard step="performance">
                <PerformanceStep />
              </StepGuard>
            }
          />
          <Route
            path="export"
            element={
              <StepGuard step="export">
                <ExportBriefStep />
              </StepGuard>
            }
          />
        </Route>
      </Routes>
    </Layout>
  );
}
