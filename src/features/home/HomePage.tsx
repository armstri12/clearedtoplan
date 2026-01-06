import { Link } from 'react-router-dom';
import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';

const COLORS = {
  primary: '#2563eb',
  primaryDark: '#1e40af',
  accent: '#10b981',
  background: '#f8fafc',
  text: '#1e293b',
  textLight: '#64748b',
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
      {/* Header with bigger logo and community feel */}
      <div
        style={{
          background: `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.primaryDark} 100%)`,
          color: '#fff',
          padding: '60px 32px',
          textAlign: 'center',
          position: 'relative',
          overflow: 'hidden',
        }}
      >
        {/* Subtle pattern overlay */}
        <div style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          backgroundImage: 'radial-gradient(circle at 20% 50%, rgba(255, 255, 255, 0.05) 0%, transparent 50%), radial-gradient(circle at 80% 80%, rgba(255, 255, 255, 0.05) 0%, transparent 50%)',
          pointerEvents: 'none'
        }} />

        <div style={{ maxWidth: 1600, margin: '0 auto', position: 'relative' }}>
          <img
            src="/images/logo.png"
            alt="Cleared To Plan"
            style={{ width: 120, height: 'auto', marginBottom: 24, filter: 'drop-shadow(0 4px 12px rgba(0,0,0,0.2))' }}
          />
          <h1 style={{ fontSize: 56, fontWeight: 900, marginBottom: 16, lineHeight: 1.1, letterSpacing: '-0.02em' }}>
            Cleared to Plan
          </h1>
          <p style={{ fontSize: 20, opacity: 0.95, fontWeight: 400, marginBottom: 24, maxWidth: 600, margin: '0 auto 24px' }}>
            Free flight planning tools for the VFR community
          </p>
          <div style={{ display: 'inline-flex', alignItems: 'center', gap: 12, background: 'rgba(255,255,255,0.15)', padding: '12px 20px', borderRadius: 999, backdropFilter: 'blur(10px)', border: '1px solid rgba(255,255,255,0.2)' }}>
            <span style={{ fontSize: 14, fontWeight: 600 }}>🛠️ Homebrew project</span>
            <span style={{ fontSize: 14, opacity: 0.7 }}>•</span>
            <span style={{ fontSize: 14, fontWeight: 600 }}>💚 Community-driven</span>
            <span style={{ fontSize: 14, opacity: 0.7 }}>•</span>
            <span style={{ fontSize: 14, fontWeight: 600 }}>✅ Always free</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div style={{ maxWidth: 1600, margin: '0 auto', padding: '60px 32px', flex: 1, width: '100%' }}>
        {!isAuthenticated ? (
          <div style={{ maxWidth: 520, margin: '0 auto' }}>
            {/* Community callout */}
            <div style={{
              background: 'linear-gradient(135deg, #ecfdf5 0%, #d1fae5 100%)',
              border: `2px solid ${COLORS.accent}`,
              borderRadius: 16,
              padding: 24,
              marginBottom: 32,
              textAlign: 'center'
            }}>
              <div style={{ fontSize: 32, marginBottom: 12 }}>✨</div>
              <h3 style={{ margin: '0 0 8px 0', fontSize: 20, fontWeight: 800, color: COLORS.text }}>
                Built by pilots, for pilots
              </h3>
              <p style={{ margin: 0, fontSize: 15, color: COLORS.textLight, lineHeight: 1.6 }}>
                This is a passion project to give back to the aviation community. No ads, no subscriptions, just helpful tools.
              </p>
            </div>

            {/* Sign in form */}
            <div style={{ textAlign: 'center', marginBottom: 28 }}>
              <h2 style={{ fontSize: 32, fontWeight: 900, color: COLORS.text, marginBottom: 12 }}>
                {isSignupMode ? 'Join the Community' : 'Welcome Back'}
              </h2>
              <p style={{ fontSize: 16, color: COLORS.textLight }}>
                {isSignupMode
                  ? 'Create a free account to save your aircraft profiles and plans'
                  : 'Sign in to access your planning tools'}
              </p>
            </div>

            <div style={{ background: '#fff', padding: 40, borderRadius: 20, boxShadow: '0 4px 24px rgba(0,0,0,0.08)', border: `1px solid ${COLORS.border}` }}>
              <form onSubmit={handleAuth}>
                {isSignupMode && (
                  <div style={{ marginBottom: 20 }}>
                    <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 600, color: COLORS.text }}>
                      Name (optional)
                    </label>
                    <input
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      style={{
                        width: '100%',
                        padding: '14px 16px',
                        fontSize: 15,
                        borderRadius: 10,
                        border: `2px solid ${COLORS.border}`,
                        boxSizing: 'border-box',
                        transition: 'border-color 0.2s',
                      }}
                      onFocus={(e) => e.currentTarget.style.borderColor = COLORS.primary}
                      onBlur={(e) => e.currentTarget.style.borderColor = COLORS.border}
                    />
                  </div>
                )}

                <div style={{ marginBottom: 20 }}>
                  <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 600, color: COLORS.text }}>
                    Email
                  </label>
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                    autoFocus
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      fontSize: 15,
                      borderRadius: 10,
                      border: `2px solid ${COLORS.border}`,
                      boxSizing: 'border-box',
                      transition: 'border-color 0.2s',
                    }}
                    onFocus={(e) => e.currentTarget.style.borderColor = COLORS.primary}
                    onBlur={(e) => e.currentTarget.style.borderColor = COLORS.border}
                  />
                </div>

                <div style={{ marginBottom: 24 }}>
                  <label style={{ display: 'block', marginBottom: 8, fontSize: 14, fontWeight: 600, color: COLORS.text }}>
                    Password
                  </label>
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                    minLength={6}
                    style={{
                      width: '100%',
                      padding: '14px 16px',
                      fontSize: 15,
                      borderRadius: 10,
                      border: `2px solid ${COLORS.border}`,
                      boxSizing: 'border-box',
                      transition: 'border-color 0.2s',
                    }}
                    onFocus={(e) => e.currentTarget.style.borderColor = COLORS.primary}
                    onBlur={(e) => e.currentTarget.style.borderColor = COLORS.border}
                  />
                  {isSignupMode && (
                    <p style={{ margin: '8px 0 0 0', fontSize: 12, color: COLORS.textLight }}>
                      Minimum 6 characters
                    </p>
                  )}
                </div>

                {error && (
                  <div style={{
                    padding: 14,
                    marginBottom: 20,
                    background: '#fef2f2',
                    border: '2px solid #fecaca',
                    borderRadius: 10,
                    fontSize: 14,
                    color: '#991b1b',
                    fontWeight: 600,
                  }}>
                    {error}
                  </div>
                )}

                <button
                  type="submit"
                  disabled={isLoading}
                  style={{
                    width: '100%',
                    padding: '16px 24px',
                    background: isLoading ? COLORS.textLight : COLORS.primary,
                    color: '#fff',
                    border: 'none',
                    borderRadius: 10,
                    fontSize: 16,
                    fontWeight: 700,
                    cursor: isLoading ? 'not-allowed' : 'pointer',
                    marginBottom: 20,
                    boxShadow: '0 4px 14px rgba(37,99,235,0.3)',
                    transition: 'all 0.2s',
                  }}
                  onMouseEnter={(e) => {
                    if (!isLoading) {
                      e.currentTarget.style.transform = 'translateY(-2px)';
                      e.currentTarget.style.boxShadow = '0 6px 20px rgba(37,99,235,0.4)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.transform = 'translateY(0)';
                    e.currentTarget.style.boxShadow = '0 4px 14px rgba(37,99,235,0.3)';
                  }}
                >
                  {isLoading ? 'Please wait...' : isSignupMode ? 'Create Free Account' : 'Sign In'}
                </button>

                <div style={{ textAlign: 'center', fontSize: 14, color: COLORS.textLight }}>
                  {isSignupMode ? (
                    <>
                      Already have an account?{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setIsSignupMode(false);
                          setError('');
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: COLORS.primary,
                          fontWeight: 700,
                          cursor: 'pointer',
                          textDecoration: 'underline',
                        }}
                      >
                        Sign in
                      </button>
                    </>
                  ) : (
                    <>
                      Don't have an account?{' '}
                      <button
                        type="button"
                        onClick={() => {
                          setIsSignupMode(true);
                          setError('');
                        }}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: COLORS.primary,
                          fontWeight: 700,
                          cursor: 'pointer',
                          textDecoration: 'underline',
                        }}
                      >
                        Sign up free
                      </button>
                    </>
                  )}
                </div>
              </form>
            </div>
          </div>
        ) : (
          /* Tools Grid - shown when authenticated */
          <>
            <div style={{ textAlign: 'center', marginBottom: 48, maxWidth: 700, margin: '0 auto 48px' }}>
              <div style={{
                display: 'inline-block',
                background: `linear-gradient(135deg, ${COLORS.primary}15 0%, ${COLORS.accent}15 100%)`,
                padding: '8px 16px',
                borderRadius: 999,
                marginBottom: 16,
                fontSize: 13,
                fontWeight: 700,
                color: COLORS.primary,
              }}>
                ✈️ Your Workspace
              </div>
              <h2 style={{ fontSize: 40, fontWeight: 900, color: COLORS.text, marginBottom: 12 }}>
                Welcome back, {user?.name || user?.email?.split('@')[0]}!
              </h2>
              <p style={{ fontSize: 18, color: COLORS.textLight, marginBottom: 20 }}>
                Select a planning tool below to get started
              </p>
              <button
                onClick={logout}
                style={{
                  padding: '10px 20px',
                  background: '#fff',
                  color: COLORS.text,
                  border: `2px solid ${COLORS.border}`,
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = COLORS.primary;
                  e.currentTarget.style.color = COLORS.primary;
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = COLORS.border;
                  e.currentTarget.style.color = COLORS.text;
                }}
              >
                Sign Out
              </button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 24, maxWidth: 1200, margin: '0 auto' }}>
              {TOOLS.map((tool) => (
                <Link
                  key={tool.to}
                  to={tool.to}
                  style={{
                    padding: 32,
                    background: '#fff',
                    borderRadius: 20,
                    boxShadow: '0 2px 8px rgba(0,0,0,0.06)',
                    textDecoration: 'none',
                    color: COLORS.text,
                    transition: 'all 0.3s',
                    border: `2px solid ${COLORS.border}`,
                    display: 'block',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.boxShadow = '0 12px 32px rgba(37,99,235,0.15)';
                    e.currentTarget.style.borderColor = COLORS.primary;
                    e.currentTarget.style.transform = 'translateY(-6px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)';
                    e.currentTarget.style.borderColor = COLORS.border;
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <div style={{ fontSize: 56, marginBottom: 20, textAlign: 'center' }}>{tool.icon}</div>
                  <h3 style={{ fontSize: 22, fontWeight: 900, marginBottom: 10, color: COLORS.text, textAlign: 'center' }}>
                    {tool.label}
                  </h3>
                  <p style={{ fontSize: 14, color: COLORS.textLight, lineHeight: 1.6, margin: 0, textAlign: 'center' }}>
                    {tool.description}
                  </p>
                </Link>
              ))}
            </div>
          </>
        )}
      </div>

      {/* Footer with community vibe */}
      <div
        style={{
          background: '#fff',
          borderTop: `1px solid ${COLORS.border}`,
          padding: '32px 24px',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: 1600, margin: '0 auto' }}>
          <div style={{ fontSize: 15, color: COLORS.text, marginBottom: 12, fontWeight: 700 }}>
            ⚠️ Training aid only — Always verify results with official sources and your POH/AFM
          </div>
          <div style={{ fontSize: 14, color: COLORS.textLight, marginBottom: 16 }}>
            VFR planning • Not for commercial use • No warranty expressed or implied
          </div>
          <div style={{ fontSize: 14, color: COLORS.textLight }}>
            Made with ❤️ for the pilot community by{' '}
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
