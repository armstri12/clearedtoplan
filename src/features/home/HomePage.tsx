import { Link } from 'react-router-dom';

const COLORS = {
  primary: '#2563eb', // blue-600
  primaryDark: '#1e40af', // blue-800
  background: '#f8fafc', // slate-50
  text: '#1e293b', // slate-800
  textLight: '#64748b', // slate-500
  border: '#e2e8f0', // slate-200
};

const TOOLS = [
  { to: '/aircraft', label: 'Aircraft', icon: '✈️', description: 'Configure aircraft profile with W&B envelope and performance data' },
  { to: '/wb', label: 'Weight & Balance', icon: '⚖️', description: 'Calculate loading, CG position, and envelope compliance' },
  { to: '/performance', label: 'Performance', icon: '📊', description: 'Density altitude and takeoff/landing distance calculations' },
  { to: '/weather', label: 'Weather', icon: '🌤️', description: 'Real-time METAR & TAF with decoded conditions' },
  { to: '/navlog', label: 'Navlog', icon: '🗺️', description: 'Navigation log and flight planning calculations' },
];

export default function HomePage() {
  return (
    <div style={{ background: COLORS.background, minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* Header */}
      <div
        style={{
          background: `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.primaryDark} 100%)`,
          color: '#fff',
          padding: '80px 24px 60px',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <img src="/images/logo.png" alt="Cleared To Plan" style={{ width: 60, height: 'auto', marginBottom: 16 }} />
          <div style={{ fontSize: 42, fontWeight: 900, marginBottom: 12, lineHeight: 1.2 }}>
            Cleared to Plan
          </div>
          <div style={{ fontSize: 18, opacity: 0.95, fontWeight: 400 }}>
            Flight planning tools for VFR pilots
          </div>
        </div>
      </div>

      {/* Tools Grid */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '60px 24px', flex: 1 }}>
        <div style={{ textAlign: 'center', marginBottom: 40 }}>
          <h2 style={{ fontSize: 32, fontWeight: 900, color: COLORS.text, marginBottom: 12 }}>
            Planning Tools
          </h2>
          <p style={{ fontSize: 16, color: COLORS.textLight }}>
            Select a tool to get started
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
          {TOOLS.map((tool) => (
            <Link
              key={tool.to}
              to={tool.to}
              style={{
                padding: 32,
                background: '#fff',
                borderRadius: 16,
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                textDecoration: 'none',
                color: COLORS.text,
                transition: 'all 0.3s',
                border: `2px solid ${COLORS.border}`,
                display: 'block',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(37,99,235,0.15)';
                e.currentTarget.style.borderColor = COLORS.primary;
                e.currentTarget.style.transform = 'translateY(-4px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
                e.currentTarget.style.borderColor = COLORS.border;
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div style={{ fontSize: 48, marginBottom: 16, textAlign: 'center' }}>{tool.icon}</div>
              <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8, color: COLORS.text, textAlign: 'center' }}>
                {tool.label}
              </h3>
              <p style={{ fontSize: 14, color: COLORS.textLight, lineHeight: 1.6, margin: 0, textAlign: 'center' }}>
                {tool.description}
              </p>
            </Link>
          ))}
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          background: '#fff',
          borderTop: `1px solid ${COLORS.border}`,
          padding: '24px',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ fontSize: 14, color: COLORS.text, marginBottom: 8, fontWeight: 600 }}>
            Training aid only — Always verify results with official sources and your POH/AFM
          </div>
          <div style={{ fontSize: 13, color: COLORS.textLight }}>
            VFR planning • Not for commercial use • Built by{' '}
            <a
              href="https://flywithian.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: COLORS.primary, textDecoration: 'none' }}
            >
              Fly With Ian
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
