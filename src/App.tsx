import { NavLink, Route, Routes } from 'react-router-dom';
import AircraftPage from './features/aircraft/AircraftPage';
import WeightBalancePage from './features/weightBalance/WeightBalancePage';
import NavlogPage from './features/navlog/NavlogPage';



function Home() {
  return (
    <div>
      <h1>Clear to Plan</h1>
      <p>Weight &amp; Balance and Navlog planning for general aviation.</p>
      <ul>
        <li>Build aircraft profiles</li>
        <li>Run weight &amp; balance scenarios</li>
        <li>Plan cross-country navlogs</li>
      </ul>
    </div>
  );
}


function Navlog() {
  return <h2>Navlog (coming next)</h2>;
}

function Layout({ children }: { children: React.ReactNode }) {
  const linkStyle = ({ isActive }: { isActive: boolean }) => ({
    marginRight: 12,
    textDecoration: 'none',
    fontWeight: isActive ? 700 : 500,
  });

  return (
    <div style={{ maxWidth: 960, margin: '0 auto', padding: 24, fontFamily: 'system-ui' }}>
      <header style={{ display: 'flex', alignItems: 'baseline', gap: 16, marginBottom: 16 }}>
        <div style={{ fontSize: 18, fontWeight: 800 }}>Clear to Plan</div>
        <nav>
          <NavLink to="/" style={linkStyle} end>
            Home
          </NavLink>
          <NavLink to="/aircraft" style={linkStyle}>
            Aircraft
          </NavLink>
          <NavLink to="/wb" style={linkStyle}>
            W&amp;B
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
        <Route path="/navlog" element={<NavlogPage />} />
      </Routes>
    </Layout>
  );
}
