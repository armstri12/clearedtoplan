import { useMemo, useCallback } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useFlightSession } from '../context/FlightSessionContext';

const COLORS = {
  primary: '#2563eb',
  primaryLight: '#dbeafe',
  border: '#e2e8f0',
  text: '#1e293b',
  textLight: '#64748b',
  warning: '#f59e0b',
};

const STEP_LABELS: Record<string, string> = {
  aircraft: 'Aircraft',
  weightBalance: 'W&B',
  performance: 'Performance',
  weather: 'Weather',
  navlog: 'Navlog',
};

const STEP_ROUTES: Record<keyof typeof STEP_LABELS, string> = {
  aircraft: '/aircraft',
  weightBalance: '/wb',
  performance: '/performance',
  weather: '/weather',
  navlog: '/navlog',
};

const STEP_ORDER: Array<keyof typeof STEP_LABELS> = ['aircraft', 'weightBalance', 'performance', 'weather', 'navlog'];

function getStepFromPath(pathname: string): keyof typeof STEP_LABELS | null {
  const match = (Object.entries(STEP_ROUTES) as Array<[keyof typeof STEP_LABELS, string]>).find(([, path]) =>
    pathname.startsWith(path),
  );
  return match ? match[0] : null;
}

export function TripHeader() {
  const { currentSession, getNextStep, completeStep } = useFlightSession();
  const navigate = useNavigate();
  const location = useLocation();

  const nextStep = currentSession ? getNextStep() : null;
  const activeStep = useMemo(() => getStepFromPath(location.pathname), [location.pathname]);

  const incomplete = useMemo(() => {
    if (!currentSession) return [];
    return (Object.entries(currentSession.completed) as Array<[keyof typeof STEP_LABELS, boolean]>)
      .filter(([, done]) => !done)
      .map(([key]) => key);
  }, [currentSession]);

  const getNextStepAfterCompleting = useCallback(
    (completedStep: keyof typeof STEP_LABELS | null) => {
      if (!currentSession) return null;

      return (
        STEP_ORDER.find((step) => {
          const isComplete = step === completedStep ? true : currentSession.completed[step];
          return !isComplete;
        }) ?? null
      );
    },
    [currentSession],
  );

  const handleNavigate = (step: keyof typeof STEP_LABELS) => {
    if (!currentSession) return;

    if (activeStep) {
      completeStep(activeStep);
    }

    const destinationStep = activeStep ? getNextStepAfterCompleting(activeStep) ?? step : step;
    navigate(STEP_ROUTES[destinationStep]);
  };

  if (!currentSession) return null;

  const { metadata } = currentSession;
  const alternates = metadata.alternates?.filter(Boolean) ?? [];

  const routeDisplay =
    metadata.route ||
    (metadata.departure && metadata.destination ? `${metadata.departure} → ${metadata.destination}` : '');

  return (
    <div
      style={{
        maxWidth: 1400,
        margin: '12px auto 0',
        padding: 16,
        borderRadius: 12,
        border: `1px solid ${COLORS.border}`,
        background: '#fff',
        boxShadow: '0 1px 2px rgba(0,0,0,0.04)',
      }}
    >
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'center' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, flex: 1 }}>
          <InfoPill label="Route" value={routeDisplay || 'Add route in Navlog'} />
          <InfoPill label="ETD" value={metadata.etd || 'Set ETD'} />
          <InfoPill label="ETA" value={metadata.eta || 'Set ETA'} />
          <InfoPill label="Lesson" value={metadata.lessonType || 'Add lesson type'} />
          {alternates.length > 0 && (
            <InfoPill label="Alternates" value={alternates.join(', ')} />
          )}
        </div>

        <div
          style={{
            display: 'flex',
            gap: 12,
            alignItems: 'center',
            padding: 12,
            borderRadius: 10,
            background: COLORS.primaryLight,
            border: `1px solid ${COLORS.border}`,
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 800, color: COLORS.textLight, textTransform: 'uppercase' }}>
            Next Step
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <div style={{ fontSize: 14, fontWeight: 800, color: COLORS.text }}>
              {nextStep ? STEP_LABELS[nextStep] : 'All steps complete'}
            </div>
            {nextStep && (
              <button
                onClick={() => handleNavigate(nextStep)}
                style={{
                  padding: '8px 12px',
                  background: COLORS.primary,
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontWeight: 700,
                  fontSize: 12,
                  cursor: 'pointer',
                  whiteSpace: 'nowrap',
                }}
              >
                Go to {STEP_LABELS[nextStep]} →
              </button>
            )}
            <div
              style={{ fontSize: 11, color: COLORS.textLight, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 6 }}
              aria-label="Navigation controls are available in the header above."
            >
              <span aria-hidden="true">⬆️</span>
              Navigation lives in the header above.
            </div>
            {!nextStep && (
              <div style={{ fontSize: 12, color: COLORS.textLight, fontWeight: 600 }}>
                You can still adjust any step before exporting.
              </div>
            )}
          </div>
        </div>
      </div>

      {incomplete.length > 0 && (
        <div style={{ marginTop: 12, display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ fontSize: 12, fontWeight: 800, color: COLORS.warning, display: 'flex', gap: 6, alignItems: 'center' }}>
            ⚠️ Incomplete
          </div>
          {incomplete.map((step) => (
            <span
              key={step}
              style={{
                padding: '6px 10px',
                borderRadius: 999,
                background: '#fff7ed',
                border: `1px solid ${COLORS.border}`,
                fontSize: 12,
                fontWeight: 700,
                color: COLORS.text,
              }}
            >
              {STEP_LABELS[step]}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function InfoPill({ label, value }: { label: string; value: string }) {
  return (
    <div
      style={{
        padding: 12,
        borderRadius: 10,
        border: `1px solid ${COLORS.border}`,
        background: '#f8fafc',
        minWidth: 0,
      }}
    >
      <div style={{ fontSize: 11, fontWeight: 800, color: COLORS.textLight, textTransform: 'uppercase', marginBottom: 4 }}>
        {label}
      </div>
      <div style={{ fontSize: 14, fontWeight: 700, color: COLORS.text, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {value}
      </div>
    </div>
  );
}
