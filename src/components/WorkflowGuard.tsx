import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFlightSession, type FlightSession } from '../context/FlightSessionContext';

const COLORS = {
  primary: '#2563eb',
  primaryDark: '#1e40af',
  background: '#fffbeb',
  text: '#1e293b',
  textLight: '#64748b',
};

type WorkflowGuardProps = {
  step: keyof FlightSession['completed'];
  children: React.ReactNode;
};

export function WorkflowGuard({ step, children }: WorkflowGuardProps) {
  const navigate = useNavigate();
  const { currentSession, canAccessStep, getNextStep } = useFlightSession();

  useEffect(() => {
    if (!currentSession) {
      // No active session - redirect to home
      navigate('/');
      return;
    }

    if (!canAccessStep(step)) {
      // Can't access this step yet - redirect to next incomplete step
      const nextStep = getNextStep();
      if (nextStep) {
        const stepRoutes: Record<keyof FlightSession['completed'], string> = {
          aircraft: '/aircraft',
          weightBalance: '/wb',
          performance: '/performance',
          weather: '/weather',
          navlog: '/navlog',
        };
        navigate(stepRoutes[nextStep]);
      } else {
        navigate('/');
      }
    }
  }, [currentSession, step, canAccessStep, getNextStep, navigate]);

  // Show warning if trying to access locked step
  if (!currentSession) {
    return (
      <div
        style={{
          padding: 32,
          textAlign: 'center',
          background: COLORS.background,
          borderRadius: 12,
          border: '2px solid #f59e0b',
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 16 }}>🔒</div>
        <h2 style={{ margin: 0, marginBottom: 8, fontSize: 24, fontWeight: 900, color: COLORS.text }}>
          No Active Flight Plan
        </h2>
        <p style={{ margin: 0, marginBottom: 24, fontSize: 16, color: COLORS.textLight }}>
          Please start a new flight plan or load a saved one from the home page.
        </p>
        <button
          onClick={() => navigate('/')}
          style={{
            padding: '12px 24px',
            background: COLORS.primary,
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontWeight: 700,
            fontSize: 16,
            cursor: 'pointer',
          }}
        >
          Go to Home
        </button>
      </div>
    );
  }

  if (!canAccessStep(step)) {
    return (
      <div
        style={{
          padding: 32,
          textAlign: 'center',
          background: COLORS.background,
          borderRadius: 12,
          border: '2px solid #f59e0b',
        }}
      >
        <div style={{ fontSize: 48, marginBottom: 16 }}>⚠️</div>
        <h2 style={{ margin: 0, marginBottom: 8, fontSize: 24, fontWeight: 900, color: COLORS.text }}>
          Complete Previous Steps First
        </h2>
        <p style={{ margin: 0, marginBottom: 24, fontSize: 16, color: COLORS.textLight }}>
          You must complete the workflow in order. Please finish the previous steps first.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
