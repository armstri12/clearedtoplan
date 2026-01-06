import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

const COLORS = {
  primary: '#1d4ed8',
  primaryDark: '#0f172a',
  accent: '#8b5cf6',
  background: '#f6f8fc',
  surface: '#ffffff',
  text: '#0f172a',
  textLight: '#475569',
  border: '#e2e8f0',
};

const TOOLS = [
  { to: '/aircraft', label: 'Aircraft', icon: '✈️', description: 'Configure aircraft profile with W&B envelope and performance data' },
  { to: '/wb', label: 'Weight & Balance', icon: '⚖️', description: 'Calculate loading, CG position, and envelope compliance' },
  { to: '/performance', label: 'Performance', icon: '📊', description: 'Density altitude and takeoff/landing distance calculations' },
  { to: '/weather', label: 'Weather', icon: '🌤️', description: 'Real-time METAR & TAF with decoded conditions' },
  { to: '/navlog', label: 'Navlog', icon: '🗺️', description: 'Navigation log and flight planning calculations' },
];

export default function HomePage() {
  const { isAuthenticated, user, login, signup, logout } = useAuth();
  const [isSignupMode, setIsSignupMode] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  async function handleAuth(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      const result = isSignupMode
        ? await signup(email, password, name)
        : await login(email, password);

      if (!result.success) {
        setError(result.error || 'Authentication failed');
      } else {
        setEmail('');
        setPassword('');
        setName('');
      }
    } catch (err) {
      setError('An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  }

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
        <div style={{ maxWidth: 1600, margin: '0 auto' }}>
          <img src="/images/logo.png" alt="Cleared To Plan" style={{ width: 60, height: 'auto', marginBottom: 16 }} />
          <div style={{ fontSize: 42, fontWeight: 900, marginBottom: 12, lineHeight: 1.2 }}>
            Cleared to Plan
          </div>
          <div
            style={{
              padding: '8px 12px',
              background: '#fff',
              borderRadius: 999,
              border: `1px solid ${COLORS.border}`,
              fontSize: 13,
              color: COLORS.textLight,
              boxShadow: '0 8px 24px rgba(15,23,42,0.08)',
            }}
          >
            Training aid • Verify with official sources
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ maxWidth: 1600, margin: '0 auto', padding: '60px 24px', flex: 1 }}>
        {!isAuthenticated ? (
          /* Login/Signup Hero Section */
          <section style={{ position: 'relative', display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 32, alignItems: 'center' }}>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span
                  style={{
                    padding: '6px 12px',
                    background: 'rgba(255,255,255,0.08)',
                    borderRadius: 999,
                    fontSize: 13,
                    letterSpacing: 0.3,
                    border: '1px solid rgba(255,255,255,0.1)',
                  }}
                >
                  Modern VFR workflow
                </span>
                <span style={{ height: 1, width: 32, background: 'rgba(255,255,255,0.14)' }} />
                <span style={{ fontSize: 13, color: '#cbd5f5' }}>Fast, calm, and organized</span>
              </div>

              <h1 style={{ fontSize: 'clamp(30px, 4vw, 42px)', margin: 0, lineHeight: 1.1, fontWeight: 900 }}>
                Plan every leg with confidence—not clutter.
              </h1>
              <p style={{ maxWidth: 560, fontSize: 16, lineHeight: 1.6, color: '#cbd5f5', margin: 0 }}>
                A composed workspace that keeps aircraft data, performance, weather, and navlogs in one elegant flow. Save profiles, swap routes, and brief with clarity.
              </p>

              <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                {['Aircraft-aware tools', 'Readable weather', 'Shareable navlogs'].map((chip) => (
                  <span
                    key={chip}
                    style={{
                      padding: '10px 14px',
                      background: 'rgba(255,255,255,0.08)',
                      borderRadius: 12,
                      border: '1px solid rgba(255,255,255,0.15)',
                      fontSize: 13,
                      color: '#e5edff',
                      letterSpacing: 0.2,
                    }}
                  >
                    {chip}
                  </span>
                ))}
              </div>
            </div>

            <div
              style={{
                background: 'rgba(255,255,255,0.06)',
                borderRadius: 20,
                border: '1px solid rgba(255,255,255,0.1)',
                boxShadow: '0 20px 50px rgba(0,0,0,0.25)',
                padding: 24,
                backdropFilter: 'blur(10px)',
              }}
            >
              {!isAuthenticated ? (
                <>
                  <div style={{ marginBottom: 16 }}>
                    <div style={{ fontSize: 14, textTransform: 'uppercase', letterSpacing: 0.8, color: '#cbd5f5', marginBottom: 8 }}>
                      {isSignupMode ? 'Create an account' : 'Sign in'}
                    </div>
                    <div style={{ fontSize: 22, fontWeight: 800, color: '#fff', marginBottom: 4 }}>
                      {isSignupMode ? 'Save profiles. Sync plans.' : 'Welcome back.'}
                    </div>
                    <p style={{ margin: 0, color: '#cbd5f5', fontSize: 14 }}>
                      {isSignupMode ? 'Securely store aircraft data and revisit any flight.' : 'Your routes, aircraft, and performance data await.'}
                    </p>
                  </div>

                  <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                    {isSignupMode && (
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        <label style={{ fontSize: 13, fontWeight: 600, color: '#dbeafe' }}>Name (optional)</label>
                        <input
                          type="text"
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '12px 14px',
                            fontSize: 15,
                            borderRadius: 12,
                            border: '1px solid rgba(255,255,255,0.25)',
                            background: 'rgba(255,255,255,0.08)',
                            color: '#fff',
                            outline: 'none',
                          }}
                        />
                      </div>
                    )}

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ fontSize: 13, fontWeight: 600, color: '#dbeafe' }}>Email</label>
                      <input
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        required
                        autoFocus
                        style={{
                          width: '100%',
                          padding: '12px 14px',
                          fontSize: 15,
                          borderRadius: 12,
                          border: '1px solid rgba(255,255,255,0.25)',
                          background: 'rgba(255,255,255,0.08)',
                          color: '#fff',
                          outline: 'none',
                        }}
                      />
                    </div>

                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      <label style={{ fontSize: 13, fontWeight: 600, color: '#dbeafe' }}>Password</label>
                      <input
                        type="password"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        required
                        minLength={6}
                        style={{
                          width: '100%',
                          padding: '12px 14px',
                          fontSize: 15,
                          borderRadius: 12,
                          border: '1px solid rgba(255,255,255,0.25)',
                          background: 'rgba(255,255,255,0.08)',
                          color: '#fff',
                          outline: 'none',
                        }}
                      />
                      {isSignupMode && (
                        <p style={{ margin: 0, fontSize: 12, color: '#cbd5f5' }}>Minimum 6 characters</p>
                      )}
                    </div>

                    {error && (
                      <div
                        style={{
                          padding: 12,
                          borderRadius: 10,
                          background: 'rgba(248, 113, 113, 0.15)',
                          border: '1px solid rgba(248, 113, 113, 0.35)',
                          color: '#fecdd3',
                          fontSize: 13,
                        }}
                      >
                        {error}
                      </div>
                    )}

                    <button
                      type="submit"
                      disabled={isLoading}
                      style={{
                        width: '100%',
                        padding: '14px 16px',
                        background: isLoading ? 'rgba(255,255,255,0.2)' : '#fff',
                        color: isLoading ? '#cbd5f5' : COLORS.primaryDark,
                        border: 'none',
                        borderRadius: 12,
                        fontSize: 16,
                        fontWeight: 800,
                        cursor: isLoading ? 'not-allowed' : 'pointer',
                        boxShadow: '0 10px 35px rgba(15,23,42,0.25)',
                        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                      }}
                      onMouseEnter={(e) => {
                        if (!isLoading) {
                          e.currentTarget.style.transform = 'translateY(-2px)';
                          e.currentTarget.style.boxShadow = '0 14px 40px rgba(15,23,42,0.32)';
                        }
                      }}
                      onMouseLeave={(e) => {
                        e.currentTarget.style.transform = 'translateY(0)';
                        e.currentTarget.style.boxShadow = '0 10px 35px rgba(15,23,42,0.25)';
                      }}
                    >
                      {isLoading ? 'Please wait…' : isSignupMode ? 'Create account' : 'Sign in'}
                    </button>

                    <div style={{ textAlign: 'center', fontSize: 13, color: '#cbd5f5' }}>
                      {isSignupMode ? 'Already have an account?' : "Don't have an account?"}{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setIsSignupMode(!isSignupMode);
                          setError('');
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#fff',
                          fontWeight: 700,
                          cursor: 'pointer',
                          textDecoration: 'underline',
                        }}
                      >
                        {isSignupMode ? 'Sign in' : 'Sign up'}
                      </button>
                    </div>
                  </form>
                </>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                  <div style={{ fontSize: 14, letterSpacing: 0.8, textTransform: 'uppercase', color: '#cbd5f5' }}>Welcome back</div>
                  <div style={{ fontSize: 24, fontWeight: 800, color: '#fff' }}>
                    {user?.name || user?.email?.split('@')[0]}, your cockpit is ready.
                  </div>
                  <p style={{ margin: 0, color: '#cbd5f5', lineHeight: 1.5 }}>
                    Pick up where you left off or start a new plan with refreshed weather and performance data.
                  </p>
                  <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                    <Link
                      to="/aircraft"
                      style={{
                        padding: '12px 14px',
                        background: '#fff',
                        color: COLORS.primaryDark,
                        borderRadius: 12,
                        fontWeight: 800,
                        textDecoration: 'none',
                        boxShadow: '0 10px 30px rgba(15,23,42,0.28)',
                      }}
                    >
                      Open aircraft workspace
                    </Link>
                    <button
                      onClick={logout}
                      style={{
                        padding: '12px 14px',
                        background: 'rgba(255,255,255,0.08)',
                        color: '#fff',
                        border: '1px solid rgba(255,255,255,0.18)',
                        borderRadius: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Sign out
                    </button>
                  </div>
                </div>
              )}
            </div>
          </section>
        ) : null}

        <section style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18 }}>
          {[
            {
              title: 'Aircraft-aware planning',
              body: 'W&B, takeoff, landing, and navlogs stay aligned to the profile you saved—no rework.',
            },
            {
              title: 'Readable weather',
              body: 'Decoded METAR/TAF with the raw report one click away. Confidence without clutter.',
            },
            {
              title: 'Shareable briefs',
              body: 'Keep everything in one flow so you can brief your crew or instructor clearly.',
            },
          ].map((item) => (
            <div
              key={item.title}
              style={{
                background: COLORS.surface,
                border: `1px solid ${COLORS.border}`,
                borderRadius: 16,
                padding: 20,
                boxShadow: '0 10px 30px rgba(15,23,42,0.06)',
                display: 'flex',
                flexDirection: 'column',
                gap: 10,
              }}
            >
              <div style={{ width: 36, height: 36, borderRadius: 10, background: `${COLORS.primary}15`, display: 'grid', placeItems: 'center', color: COLORS.primary, fontWeight: 800 }}>
                •
              </div>
              <div style={{ fontSize: 17, fontWeight: 800 }}>{item.title}</div>
              <p style={{ margin: 0, color: COLORS.textLight, lineHeight: 1.6 }}>{item.body}</p>
            </div>
          ))}
        </section>

        {isAuthenticated && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 20, marginTop: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
              <div>
                <div style={{ fontSize: 14, letterSpacing: 0.6, textTransform: 'uppercase', color: COLORS.textLight, fontWeight: 700 }}>
                  Planning tools
                </div>
                <h2 style={{ margin: '4px 0 0 0', fontSize: 28, fontWeight: 900, color: COLORS.text }}>Choose your workflow</h2>
              </div>
              <div style={{ fontSize: 13, color: COLORS.textLight }}>Signed in as {user?.email}</div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 18 }}>
              {TOOLS.map((tool) => (
                <Link
                  key={tool.to}
                  to={tool.to}
                  style={{
                    padding: 22,
                    background: COLORS.surface,
                    borderRadius: 16,
                    textDecoration: 'none',
                    color: COLORS.text,
                    border: `1px solid ${COLORS.border}`,
                    boxShadow: '0 10px 30px rgba(15,23,42,0.08)',
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease, border 0.2s ease',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 10,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.transform = 'translateY(-4px)';
                    e.currentTarget.style.boxShadow = '0 14px 40px rgba(15,23,42,0.12)';
                    e.currentTarget.style.border = `1px solid ${COLORS.primary}`;
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 10px 30px rgba(15,23,42,0.08)';
                    e.currentTarget.style.border = `1px solid ${COLORS.border}`;
                  }}
                >
                  <div style={{ fontSize: 36, width: 48, height: 48, borderRadius: 12, background: `${COLORS.primary}15`, display: 'grid', placeItems: 'center', color: COLORS.primary }}>
                    {tool.icon}
                  </div>
                  <div>
                    <h3 style={{ fontSize: 18, fontWeight: 800, margin: '0 0 6px 0' }}>{tool.label}</h3>
                    <p style={{ margin: 0, color: COLORS.textLight, lineHeight: 1.5 }}>{tool.description}</p>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}
      </div>

      <div
        style={{
          background: '#fff',
          borderTop: `1px solid ${COLORS.border}`,
          padding: '22px 24px',
          textAlign: 'center',
          marginTop: 24,
        }}
      >
        <div style={{ maxWidth: 1600, margin: '0 auto' }}>
          <div style={{ fontSize: 14, color: COLORS.text, marginBottom: 8, fontWeight: 600 }}>
            Training aid only — Always verify results with official sources and your POH/AFM
          </div>
          <div style={{ fontSize: 13, color: COLORS.textLight }}>
            VFR planning • Not for commercial use • Built by{' '}
            <a
              href="https://flywithian.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: COLORS.primary, textDecoration: 'none', fontWeight: 700 }}
            >
              Fly With Ian
            </a>
          </div>
        </div>
      </div>
    </div>
  );
}
