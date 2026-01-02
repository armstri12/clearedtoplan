import { NavLink, Route, Routes } from 'react-router-dom';
import AircraftPage from './features/aircraft/AircraftPage';
import WeightBalancePage from './features/weightBalance/WeightBalancePage';
import NavlogPage from './features/navlog/NavlogPage';
import PerformancePage from './features/performance/PerformancePage';
import WeatherPage from './features/weather/WeatherPage';



function Home() {
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <img
          src="/images/logo.png"
          alt="Cleared To Plan Logo"
          style={{ width: 120, height: 'auto' }}
        />
        <h1 style={{ margin: 0 }}>Cleared To Plan</h1>
      </div>
      <p>Weight &amp; Balance and Navlog planning for general aviation.</p>
      <ul>
        <li>Build aircraft profiles</li>
        <li>Save &amp; load weight &amp; balance scenarios</li>
        <li>Calculate density altitude &amp; performance</li>
        <li>Get real-time weather briefings (METAR &amp; TAF)</li>
        <li>Plan cross-country navlogs</li>
      </ul>
    </div>
  );
}

function Layout({ children }: { children: React.ReactNode }) {
  const linkStyle = ({ isActive }: { isActive: boolean }) => ({
    marginRight: 12,
    textDecoration: 'none',
    fontWeight: isActive ? 700 : 500,
  });

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: 24, fontFamily: 'system-ui' }}>
      <header style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 16 }}>
        <img
          src="/images/logo.png"
          alt="Cleared To Plan"
          style={{ width: 50, height: 'auto' }}
        />
        <div style={{ fontSize: 18, fontWeight: 800 }}>Cleared To Plan</div>
        <nav style={{ marginLeft: 'auto' }}>
          <NavLink to="/" style={linkStyle} end>
            Home
          </NavLink>
          <NavLink to="/aircraft" style={linkStyle}>
            Aircraft
          </NavLink>
          <NavLink to="/wb" style={linkStyle}>
            W&amp;B
          </NavLink>
          <NavLink to="/performance" style={linkStyle}>
            Performance
          </NavLink>
          <NavLink to="/weather" style={linkStyle}>
            Weather
          </NavLink>
          <NavLink to="/navlog" style={linkStyle}>
            Navlog
          </NavLink>
        </nav>
      </header>

      <main
        style={{
          padding: 16,
          border: '1px solid #ddd',
          borderRadius: 12,
          background: '#fff',
        }}
      >
        {children}
      </main>

      <footer style={{ marginTop: 16, fontSize: 12, opacity: 0.75 }}>
        Training aid — verify all results with the POH/AFM.
      </footer>
    </div>
  );
}

export default function App() {
  return (
    <Layout>
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/aircraft" element={<AircraftPage />} />
        <Route path="/wb" element={<WeightBalancePage />} />
        <Route path="/performance" element={<PerformancePage />} />
        <Route path="/weather" element={<WeatherPage />} />
        <Route path="/navlog" element={<NavlogPage />} />
      </Routes>
    </Layout>
  );
}
