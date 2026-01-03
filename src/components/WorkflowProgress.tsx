import { useFlightSession } from '../context/FlightSessionContext';

const COLORS = {
  primary: '#2563eb',
  primaryLight: '#3b82f6',
  success: '#10b981',
  text: '#1e293b',
  textLight: '#64748b',
  border: '#e2e8f0',
};

const STEP_NAMES: Record<string, string> = {
  aircraft: 'Aircraft',
  weightBalance: 'W&B',
  performance: 'Performance',
  weather: 'Weather',
  navlog: 'Navlog',
};

export function WorkflowProgress() {
  const { currentSession, saveSession } = useFlightSession();

  if (!currentSession) return null;

  const steps = Object.keys(currentSession.completed) as Array<keyof typeof currentSession.completed>;

  return (
    <div
      style={{
        background: '#fff',
        borderBottom: `1px solid ${COLORS.border}`,
        padding: '12px 24px',
      }}
    >
      <div style={{ maxWidth: 1400, margin: '0 auto', display: 'flex', alignItems: 'center', gap: 16 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text }}>
          {currentSession.name}
        </div>
        <div style={{ flex: 1, display: 'flex', gap: 8, alignItems: 'center' }}>
          {steps.map((step, idx) => (
            <div key={step} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div
                style={{
                  padding: '4px 12px',
                  borderRadius: 6,
                  background: currentSession.completed[step] ? COLORS.success : '#f3f4f6',
                  color: currentSession.completed[step] ? '#fff' : COLORS.textLight,
                  fontSize: 12,
                  fontWeight: 600,
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                <span>{currentSession.completed[step] ? '✓' : idx + 1}</span>
                <span>{STEP_NAMES[step]}</span>
              </div>
              {idx < steps.length - 1 && (
                <div style={{ color: COLORS.textLight, fontSize: 12 }}>→</div>
              )}
            </div>
          ))}
        </div>
        <button
          onClick={saveSession}
          style={{
            padding: '6px 12px',
            background: COLORS.primary,
            color: '#fff',
            border: 'none',
            borderRadius: 6,
            fontSize: 12,
            fontWeight: 600,
            cursor: 'pointer',
          }}
        >
          💾 Save
        </button>
      </div>
    </div>
  );
}
