import { useNavigate } from 'react-router-dom';

const COLORS = {
  primary: '#2563eb',
  primaryDark: '#1e40af',
  background: '#f8fafc',
  text: '#1e293b',
  textLight: '#64748b',
};

const VERSION = '2.0.0';

export default function HomePage() {
  const navigate = useNavigate();

  return (
    <div style={{ background: COLORS.background, minHeight: '100vh' }}>
      {/* Hero Section */}
      <div
        style={{
          background: `linear-gradient(135deg, ${COLORS.primary} 0%, ${COLORS.primaryDark} 100%)`,
          color: '#fff',
          padding: '120px 24px 100px',
          textAlign: 'center',
        }}
      >
        <div style={{ maxWidth: 1200, margin: '0 auto' }}>
          <div style={{ fontSize: 48, fontWeight: 900, marginBottom: 16, lineHeight: 1.2 }}>
            Cleared to Plan
          </div>
          <div style={{ fontSize: 24, opacity: 0.95, marginBottom: 32, fontWeight: 300 }}>
            The simplest digital flight planning checklist for VFR pilots
          </div>
          <div style={{ display: 'flex', gap: 16, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={() => navigate('/trip-wizard')}
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
              href="https://donate.stripe.com/test_00000000"
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

      {/* Flight Planning Workflow */}
      <div style={{ maxWidth: 1200, margin: '0 auto', padding: '80px 24px' }}>
        <div style={{ textAlign: 'center', marginBottom: 48 }}>
          <h2 style={{ fontSize: 36, fontWeight: 900, color: COLORS.text, marginBottom: 12 }}>
            Simple 4-Step Wizard
          </h2>
          <p style={{ fontSize: 18, color: COLORS.textLight, maxWidth: 700, margin: '0 auto' }}>
            Everything you need for VFR flight planning, nothing you don't
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 24 }}>
          {[
            {
              step: '1',
              title: 'Flight Basics',
              description: 'Route, aircraft, departure & destination info',
              icon: '✈️',
            },
            {
              step: '2',
              title: 'Weather Check',
              description: 'Real-time METAR & TAF with decoded conditions',
              icon: '🌤️',
            },
            {
              step: '3',
              title: 'Performance',
              description: 'Weight & balance, density altitude, takeoff/landing distances',
              icon: '📊',
            },
            {
              step: '4',
              title: 'Export Brief',
              description: 'Generate PDF or Markdown briefing for your kneeboard',
              icon: '📄',
            },
          ].map((item) => (
            <div
              key={item.step}
              style={{
                padding: 24,
                background: '#fff',
                borderRadius: 16,
                boxShadow: '0 1px 3px rgba(0,0,0,0.1)',
                textDecoration: 'none',
                color: COLORS.text,
                border: '2px solid #e2e8f0',
                position: 'relative',
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
                  background: `linear-gradient(135deg, ${COLORS.primary}, #60a5fa)`,
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
            </div>
          ))}
        </div>

        <div
          style={{
            marginTop: 48,
            padding: 24,
            background: `linear-gradient(135deg, ${COLORS.primary}15, #60a5fa15)`,
            borderRadius: 12,
            border: `2px solid ${COLORS.primary}30`,
            textAlign: 'center',
          }}
        >
          <p style={{ fontSize: 18, marginBottom: 16, fontWeight: 600 }}>
            Ready to start your flight planning?
          </p>
          <button
            onClick={() => navigate('/trip-wizard')}
            style={{
              padding: '14px 28px',
              background: COLORS.primary,
              color: '#fff',
              borderRadius: 10,
              fontWeight: 700,
              fontSize: 16,
              border: 'none',
              cursor: 'pointer',
            }}
          >
            Launch Wizard →
          </button>
        </div>
      </div>

      {/* The Story */}
      <div
        style={{
          background: '#fff',
          padding: '80px 24px',
          borderTop: '1px solid #e2e8f0',
        }}
      >
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <h2
            style={{
              fontSize: 36,
              fontWeight: 900,
              color: COLORS.text,
              marginBottom: 32,
              textAlign: 'center',
            }}
          >
            Why I Built This
          </h2>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: 32, alignItems: 'center' }}>
            <div>
              <img
                src="https://flywithian.com/wp-content/uploads/2025/06/Dick-and-Ian_16_9.jpg"
                alt="Dick and Ian at the airport"
                style={{
                  width: '100%',
                  borderRadius: 12,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
                }}
              />
              <div style={{ fontSize: 13, color: COLORS.textLight, marginTop: 8, textAlign: 'center', fontStyle: 'italic' }}>
                With Dick Saxton, who sparked my love of aviation
              </div>
            </div>

            <div style={{ fontSize: 16, lineHeight: 1.7, color: COLORS.text }}>
              <p style={{ marginBottom: 16 }}>
                At 35, I'm finally pursuing the dream I've had since I was a teenager. It started with a broken RC airplane and afternoons at a small airport in Titusville, where I met pilots like Dick Saxton who shared their passion for flight.
              </p>
              <p style={{ marginBottom: 16 }}>
                Life took me through college, grad school, tough financial times, and a winding path back to aviation. My wife believed in this dream even when I couldn't afford to, surprising me with a discovery flight and later a Bose A20 headset.
              </p>
              <p style={{ marginBottom: 16 }}>
                Now, as a student pilot, I built Cleared to Plan because I needed better flight planning tools. It's free, open-source, and designed with simplicity in mind—because flight planning shouldn't be overcomplicated.
              </p>
              <p style={{ marginBottom: 0, fontStyle: 'italic', color: COLORS.primary, fontWeight: 600 }}>
                Dreams don't have expiration dates. Sometimes the path is longer than expected, but that doesn't make it any less worth taking.
              </p>
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
          <div style={{ fontSize: 11, opacity: 0.5, marginTop: 12, fontFamily: 'monospace' }}>
            v{VERSION}
          </div>
        </div>
      </div>
    </div>
  );
}
