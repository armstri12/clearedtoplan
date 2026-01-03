import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { useFlightSession } from '../../context/FlightSessionContext';

const COLORS = {
  primary: '#2563eb', // blue-600
  primaryDark: '#1e40af', // blue-800
  primaryLight: '#3b82f6', // blue-500
  accent: '#60a5fa', // blue-400
  background: '#f8fafc', // slate-50
  text: '#1e293b', // slate-800
  textLight: '#64748b', // slate-500
};

export default function HomePage() {
  const navigate = useNavigate();
  const { currentSession, savedSessions, startNewSession, loadSession, deleteSession } = useFlightSession();
  const [showNewSessionModal, setShowNewSessionModal] = useState(false);
  const [newSessionName, setNewSessionName] = useState('');

  function handleStartNewSession() {
    if (!newSessionName.trim()) return;
    startNewSession(newSessionName);
    setShowNewSessionModal(false);
    setNewSessionName('');
    navigate('/aircraft');
  }

  function handleLoadSession(id: string) {
    loadSession(id);
    navigate('/aircraft');
  }

  return (
    <div style={{ background: COLORS.background, minHeight: '100vh' }}>
      {/* Hero Section */}
      <div
        style={{
          background: `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.primaryDark} 100%)`,
          color: '#fff',
          padding: '80px 24px',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ fontSize: 48, fontWeight: 900, marginBottom: 16, lineHeight: 1.2 }}>
            Cleared to Plan
          </div>
          <div style={{ fontSize: 24, opacity: 0.95, marginBottom: 32, fontWeight: 300 }}>
            Flight planning tools built by a student pilot, for pilots
          </div>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => setShowNewSessionModal(true)}
              style={{
                padding: '16px 32px',
                background: '#fff',
                color: COLORS.primary,
                borderRadius: 12,
                fontWeight: 700,
                fontSize: 18,
                border: 'none',
                cursor: 'pointer',
                transition: 'transform 0.2s, box-shadow 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.boxShadow = '0 8px 16px rgba(0,0,0,0.15)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.boxShadow = 'none';
              }}
            >
              Start Flight Planning →
            </button>
            <a
              href="https://donate.stripe.com/test_00000000" // Replace with actual donate link
              target="_blank"
              rel="noopener noreferrer"
              style={{
                padding: '16px 32px',
                background: 'rgba(255,255,255,0.2)',
                color: '#fff',
                border: '2px solid #fff',
                borderRadius: 12,
                fontWeight: 700,
                fontSize: 18,
                textDecoration: 'none',
                display: 'inline-block',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = '#fff';
                e.currentTarget.style.color = COLORS.primary;
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.2)';
                e.currentTarget.style.color = '#fff';
              }}
            >
              ☕ Support This Project
            </a>
          </div>
        </div>
      </div>

      {/* Current Session / Saved Sessions */}
      {(currentSession || savedSessions.length > 0) && (
        <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px 0' }}>
          {currentSession && (
            <div
              style={{
                background: '#fff',
                borderRadius: 16,
                padding: 24,
                marginBottom: 24,
                border: `2px solid ${COLORS.primary}`,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <h3 style={{ margin: 0, fontSize: 20, fontWeight: 800, color: COLORS.text }}>
                    Current Flight Plan: {currentSession.name}
                  </h3>
                  <div style={{ fontSize: 14, color: COLORS.textLight, marginTop: 4 }}>
                    Last updated: {new Date(currentSession.updatedAt).toLocaleString()}
                  </div>
                </div>
                <button
                  onClick={() => navigate('/aircraft')}
                  style={{
                    padding: '10px 20px',
                    background: COLORS.primary,
                    color: '#fff',
                    border: 'none',
                    borderRadius: 8,
                    fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  Continue →
                </button>
              </div>
              <div style={{ display: 'flex', gap: 12, fontSize: 14 }}>
                {Object.entries(currentSession.completed).map(([step, completed]) => (
                  <div
                    key={step}
                    style={{
                      padding: '6px 12px',
                      borderRadius: 6,
                      background: completed ? '#d1fae5' : '#f3f4f6',
                      color: completed ? '#065f46' : COLORS.textLight,
                      fontWeight: completed ? 700 : 500,
                    }}
                  >
                    {completed ? '✓' : '○'} {step}
                  </div>
                ))}
              </div>
            </div>
          )}

          {savedSessions.length > 0 && (
            <div>
              <h3 style={{ fontSize: 24, fontWeight: 800, color: COLORS.text, marginBottom: 16 }}>
                Saved Flight Plans
              </h3>
              <div style={{ display: 'grid', gap: 12 }}>
                {savedSessions.map((session) => (
                  <div
                    key={session.id}
                    style={{
                      background: '#fff',
                      borderRadius: 12,
                      padding: 16,
                      border: '1px solid #e2e8f0',
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ fontWeight: 700, fontSize: 16, color: COLORS.text }}>
                        {session.name}
                      </div>
                      <div style={{ fontSize: 13, color: COLORS.textLight, marginTop: 2 }}>
                        Updated: {new Date(session.updatedAt).toLocaleString()}
                      </div>
                    </div>
                    <div style={{ display: 'flex', gap: 8 }}>
                      <button
                        onClick={() => handleLoadSession(session.id)}
                        style={{
                          padding: '8px 16px',
                          background: COLORS.primary,
                          color: '#fff',
                          border: 'none',
                          borderRadius: 6,
                          fontWeight: 600,
                          cursor: 'pointer',
                          fontSize: 14,
                        }}
                      >
                        Load
                      </button>
                      <button
                        onClick={() => {
                          if (confirm(`Delete flight plan "${session.name}"?`)) {
                            deleteSession(session.id);
                          }
                        }}
                        style={{
                          padding: '8px 16px',
                          background: '#ef4444',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 6,
                          fontWeight: 600,
                          cursor: 'pointer',
                          fontSize: 14,
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Direct Tool Access (Debug Mode) */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '40px 24px 0' }}>
        <details style={{ marginBottom: 24 }}>
          <summary style={{
            cursor: 'pointer',
            padding: '12px 16px',
            background: '#f3f4f6',
            borderRadius: 8,
            fontWeight: 700,
            fontSize: 14,
            color: COLORS.text
          }}>
            🛠️ Debug Mode - Direct Tool Access
          </summary>
          <div style={{
            padding: '16px',
            marginTop: 8,
            background: '#fef3c7',
            border: '2px solid #fbbf24',
            borderRadius: 8
          }}>
            <p style={{ fontSize: 13, color: '#92400e', marginBottom: 12 }}>
              ⚠️ Bypass workflow enforcement - for debugging only
            </p>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <Link to="/aircraft?debug=true" style={{ padding: '6px 12px', background: COLORS.primary, color: '#fff', borderRadius: 6, textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
                Aircraft
              </Link>
              <Link to="/wb?debug=true" style={{ padding: '6px 12px', background: COLORS.primary, color: '#fff', borderRadius: 6, textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
                W&B
              </Link>
              <Link to="/performance?debug=true" style={{ padding: '6px 12px', background: COLORS.primary, color: '#fff', borderRadius: 6, textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
                Performance
              </Link>
              <Link to="/weather?debug=true" style={{ padding: '6px 12px', background: COLORS.primary, color: '#fff', borderRadius: 6, textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
                Weather
              </Link>
              <Link to="/navlog?debug=true" style={{ padding: '6px 12px', background: COLORS.primary, color: '#fff', borderRadius: 6, textDecoration: 'none', fontSize: 13, fontWeight: 600 }}>
                Navlog
              </Link>
            </div>
          </div>
        </details>
      </div>

      {/* Flight Planning Workflow */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '60px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h2 style={{ fontSize: 36, fontWeight: 900, color: COLORS.text, marginBottom: 12 }}>
            Your Flight Planning Workflow
          </h2>
          <p style={{ fontSize: 18, color: COLORS.textLight, maxWidth: 700, margin: '0 auto' }}>
            From aircraft setup to kneeboard-ready documents. Everything you need in one place.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
          {[
            {
              step: '1',
              title: 'Aircraft Profile',
              description: 'Configure your aircraft with W&B envelope, stations, and limits',
              icon: '✈️',
              link: '/aircraft',
            },
            {
              step: '2',
              title: 'Weight & Balance',
              description: 'Calculate loading, CG position, and verify envelope compliance',
              icon: '⚖️',
              link: '/weight-balance',
            },
            {
              step: '3',
              title: 'Performance',
              description: 'Density altitude, takeoff/landing distances with safety margins',
              icon: '📊',
              link: '/performance',
            },
            {
              step: '4',
              title: 'Weather Briefing',
              description: 'Real-time METAR & TAF with decoded conditions',
              icon: '🌤️',
              link: '/weather',
            },
          ].map((item) => (
            <Link
              key={item.step}
              to={item.link}
              style={{
                padding: 24,
                background: '#fff',
                borderRadius: 16,
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                textDecoration: 'none',
                color: COLORS.text,
                transition: 'all 0.3s',
                border: '2px solid transparent',
                position: 'relative',
                overflow: 'hidden',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.boxShadow = '0 8px 24px rgba(37,99,235,0.15)';
                e.currentTarget.style.borderColor = COLORS.primary;
                e.currentTarget.style.transform = 'translateY(-4px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.boxShadow = '0 1px 3px rgba(0,0,0,0.1)';
                e.currentTarget.style.borderColor = 'transparent';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <div
                style={{
                  position: 'absolute',
                  top: 16,
                  right: 16,
                  width: 40,
                  height: 40,
                  borderRadius: '50%',
                  background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.accent})`,
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontWeight: 900,
                  fontSize: 18,
                }}
              >
                {item.step}
              </div>
              <div style={{ fontSize: 40, marginBottom: 12 }}>{item.icon}</div>
              <h3 style={{ fontSize: 20, fontWeight: 800, marginBottom: 8, color: COLORS.text }}>
                {item.title}
              </h3>
              <p style={{ fontSize: 14, color: COLORS.textLight, lineHeight: 1.6, margin: 0 }}>
                {item.description}
              </p>
            </Link>
          ))}
        </div>
      </div>

      {/* The Story */}
      <div
        style={{
          background: '#fff',
          padding: '80px 24px',
          borderTop: `1px solid #e2e8f0`,
        }}
      >
        <div style={{ maxWidth: 800, margin: '0 auto' }}>
          <h2
            style={{
              fontSize: 36,
              fontWeight: 900,
              color: COLORS.text,
              marginBottom: 24,
              textAlign: 'center',
            }}
          >
            The Broken Airplane That Started It All
          </h2>

          <div style={{ fontSize: 16, lineHeight: 1.8, color: COLORS.text }}>
            <p style={{ marginBottom: 24, fontSize: 18, fontStyle: 'italic', color: COLORS.primary }}>
              "Life is not linear. It has a beginning, and an end. But, ultimately, it's a choose your own
              adventure story."
            </p>

            <p style={{ marginBottom: 20 }}>
              This is my story – and it starts with a dream that refused to die.
            </p>

            <h3 style={{ fontSize: 24, fontWeight: 700, marginTop: 40, marginBottom: 16, color: COLORS.primary }}>
              The Broken Beginning
            </h3>
            <p style={{ marginBottom: 20 }}>
              Picture this: early teens, and I'm handed an old, broken, incomplete radio control airplane. Most
              people would see junk. I saw possibility.
            </p>
            <p style={{ marginBottom: 20 }}>
              For years – my entire teenage years, actually – that plane never successfully flew for more than a
              few seconds. But I kept trying. I kept believing that somehow, someway, I'd figure it out.
            </p>
            <p style={{ marginBottom: 20 }}>
              It's funny how the universe works. That "failure" led me to discover the Titusville airport, where
              they had a grass runway that somehow – and I still don't know how they allowed this – let us fly
              our RC planes.
            </p>

            <h3 style={{ fontSize: 24, fontWeight: 700, marginTop: 40, marginBottom: 16, color: COLORS.primary }}>
              Finding My People
            </h3>
            <p style={{ marginBottom: 20 }}>
              That's where I met them. The older pilots who became my unexpected mentors and friends. Dick Saxton
              stands out among them. He had just jumped into the hobby himself, but his passion was infectious.
              While I shared my technical knowledge with him, he shared something more valuable – the pure joy of
              flight.
            </p>
            <p style={{ marginBottom: 20 }}>
              Those afternoons at Titusville changed everything. Being around real aircraft, hearing the stories,
              watching planes take off and land… it sparked something deeper. A desire to learn to fly real
              aircraft.
            </p>
            <p style={{ marginBottom: 20 }}>But life, as it tends to do, had other plans.</p>

            <h3 style={{ fontSize: 24, fontWeight: 700, marginTop: 40, marginBottom: 16, color: COLORS.primary }}>
              The Winding Path
            </h3>
            <p style={{ marginBottom: 20 }}>
              Fast forward through undergrad, grad school, divorce, and restarting life as an intern at Disney.
              Life became a rollercoaster – and not the fun kind.
            </p>
            <p style={{ marginBottom: 20 }}>
              The financial reality was harsh. There were weeks when squeezing money together for groceries was a
              challenge, let alone pursuing something as expensive as flight training. When you're counting every
              dollar just to make it through the week, a $15,000+ pilot's license feels like an impossible dream.
            </p>
            <p style={{ marginBottom: 20 }}>
              So I put the dream on the shelf. Not abandoned, just… waiting. Waiting for life to stabilize, for
              finances to improve, for the right moment when I could finally afford to chase what I'd always
              wanted.
            </p>
            <p style={{ marginBottom: 20, fontStyle: 'italic' }}>Dreams, it turns out, are patient. They wait.</p>

            <h3 style={{ fontSize: 24, fontWeight: 700, marginTop: 40, marginBottom: 16, color: COLORS.primary }}>
              The Gift That Changed Everything
            </h3>
            <p style={{ marginBottom: 20 }}>
              Christmas 2022. My fiancée (now wife) surprised me with a discovery flight out of BVY.
            </p>
            <p style={{ marginBottom: 20 }}>
              I can't adequately describe what it felt like to finally be in the left seat of a real airplane.
              That broken RC plane from my teens, those afternoons at Titusville, all those years of dreaming – it
              all came rushing back. But this time, it was real.
            </p>
            <p style={{ marginBottom: 20 }}>Then, Christmas 2023. Another surprise. A Bose A20 headset.</p>
            <p style={{ marginBottom: 20 }}>
              But here's the thing – it wasn't just the gifts. It was what they represented. For the first time in
              my life, I had someone who wasn't just tolerating my dreams but actively pushing me toward them.
              Someone who saw that this wasn't just a hobby or a whim – it was part of who I am.
            </p>
            <p
              style={{
                marginBottom: 20,
                fontWeight: 700,
                fontSize: 18,
                color: COLORS.primary,
                padding: '16px 24px',
                background: '#eff6ff',
                borderLeft: `4px solid ${COLORS.primary}`,
                borderRadius: 8,
              }}
            >
              She believed in this dream even when I couldn't afford to believe in it myself.
            </p>

            <h3 style={{ fontSize: 24, fontWeight: 700, marginTop: 40, marginBottom: 16, color: COLORS.primary }}>
              Why I Built This
            </h3>
            <p style={{ marginBottom: 20 }}>
              Now at 35, I'm working through my private pilot training. And like many pilots, I quickly realized
              that flight planning tools were either expensive, clunky, or missing features I needed as a student.
            </p>
            <p style={{ marginBottom: 20 }}>
              So I built Cleared to Plan. Free, open-source, and built with real student pilot workflows in mind.
              Weight & balance with visual envelopes. Performance calculations with safety margins. Real-time
              weather with decoded TAFs. Everything I wished I had when I started.
            </p>
            <p style={{ marginBottom: 20 }}>
              This isn't just a tool – it's part of my journey. Every feature comes from a real need I encountered
              during training. Every calculation is backed by FAA guidance and POH standards. Every safety warning
              is there because I know how easy it is to overlook details when you're learning.
            </p>

            <h3 style={{ fontSize: 24, fontWeight: 700, marginTop: 40, marginBottom: 16, color: COLORS.primary }}>
              What's Next
            </h3>
            <p style={{ marginBottom: 20 }}>
              I'm sharing this journey authentically – the struggles, setbacks, and small victories. If this tool
              helps you plan safer flights, that's amazing. If my story inspires you to chase your own aviation
              dream, that's even better.
            </p>
            <p style={{ marginBottom: 20, fontStyle: 'italic', fontSize: 18, color: COLORS.primary }}>
              Dreams don't have expiration dates. Life isn't linear. And sometimes the path to your destination is
              longer and more winding than you expected – but that doesn't make it any less worth taking.
            </p>

            <div
              style={{
                marginTop: 48,
                padding: 24,
                background: `linear-gradient(135deg, ${COLORS.primary}15, ${COLORS.accent}15)`,
                borderRadius: 12,
                border: `2px solid ${COLORS.primary}30`,
                textAlign: 'center',
              }}
            >
              <p style={{ fontSize: 18, marginBottom: 16, fontWeight: 600 }}>
                Ready to start your flight planning?
              </p>
              <Link
                to="/aircraft"
                style={{
                  padding: '14px 28px',
                  background: COLORS.primary,
                  color: '#fff',
                  borderRadius: 10,
                  fontWeight: 700,
                  fontSize: 16,
                  textDecoration: 'none',
                  display: 'inline-block',
                }}
              >
                Get Started →
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Footer */}
      <div
        style={{
          background: COLORS.primaryDark,
          color: '#fff',
          padding: '40px 24px',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ marginBottom: 16 }}>
            <a
              href="https://flywithian.com"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#fff', opacity: 0.9, textDecoration: 'none', marginRight: 24 }}
            >
              Fly With Ian Blog
            </a>
            <a
              href="https://github.com/armstri12/clearedtoplan"
              target="_blank"
              rel="noopener noreferrer"
              style={{ color: '#fff', opacity: 0.9, textDecoration: 'none', marginRight: 24 }}
            >
              GitHub
            </a>
            <a
              href="mailto:contact@flywithian.com"
              style={{ color: '#fff', opacity: 0.9, textDecoration: 'none' }}
            >
              Contact
            </a>
          </div>
          <div style={{ fontSize: 14, opacity: 0.7 }}>
            Built with ❤️ by a student pilot • Always verify with official sources and your POH
          </div>
          <div style={{ fontSize: 12, opacity: 0.6, marginTop: 8 }}>
            Not for commercial use • VFR only • Educational purposes
          </div>
        </div>
      </div>

      {/* New Session Modal */}
      {showNewSessionModal && (
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
          onClick={() => setShowNewSessionModal(false)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 16,
              padding: 32,
              maxWidth: 500,
              width: '90%',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <h2 style={{ margin: 0, marginBottom: 8, fontSize: 24, fontWeight: 900, color: COLORS.text }}>
              Start New Flight Plan
            </h2>
            <p style={{ margin: 0, marginBottom: 24, fontSize: 14, color: COLORS.textLight }}>
              Give your flight plan a name (e.g., "KDPA to KOSH", "Weekend Trip to KOSH")
            </p>
            <input
              type="text"
              value={newSessionName}
              onChange={(e) => setNewSessionName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleStartNewSession();
                if (e.key === 'Escape') setShowNewSessionModal(false);
              }}
              placeholder="Enter flight plan name..."
              autoFocus
              style={{
                width: '100%',
                padding: '12px 16px',
                fontSize: 16,
                borderRadius: 8,
                border: '2px solid #e2e8f0',
                marginBottom: 24,
                boxSizing: 'border-box',
              }}
            />
            <div style={{ display: 'flex', gap: 12, justifyContent: 'flex-end' }}>
              <button
                onClick={() => setShowNewSessionModal(false)}
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
                onClick={handleStartNewSession}
                disabled={!newSessionName.trim()}
                style={{
                  padding: '10px 20px',
                  background: newSessionName.trim() ? COLORS.primary : '#d1d5db',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontWeight: 600,
                  cursor: newSessionName.trim() ? 'pointer' : 'not-allowed',
                }}
              >
                Start Planning →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
