import { NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import { useMemo } from 'react';
import { useTripWizardCompletion, TRIP_WIZARD_PATHS, TRIP_WIZARD_STEPS, type TripWizardStep } from './StepGuard';
import './tripWizard.css';

const STEP_LABELS: Record<TripWizardStep, { title: string; description: string; icon: string }> = {
  basics: { title: 'Basics', description: 'Route, crew, timing', icon: '1' },
  weather: { title: 'Weather / NOTAMs', description: 'METARs, TAFs, notes', icon: '2' },
  performance: { title: 'Performance / Loading', description: 'DA, runway, payload', icon: '3' },
  export: { title: 'Export / Brief', description: 'Summaries & sharing', icon: '4' },
};

function getStepFromPath(pathname: string): TripWizardStep {
  if (pathname.startsWith(TRIP_WIZARD_PATHS.weather)) return 'weather';
  if (pathname.startsWith(TRIP_WIZARD_PATHS.performance)) return 'performance';
  if (pathname.startsWith(TRIP_WIZARD_PATHS.export)) return 'export';
  return 'basics';
}

export function TripWizardLayout() {
  const location = useLocation();
  const navigate = useNavigate();
  const { completion } = useTripWizardCompletion();

  const activeStep = getStepFromPath(location.pathname);
  const activeIndex = TRIP_WIZARD_STEPS.indexOf(activeStep);

  const progressPct = useMemo(() => {
    const total = TRIP_WIZARD_STEPS.length;
    const completedCount = TRIP_WIZARD_STEPS.filter((step) => completion[step]).length;
    return Math.round((completedCount / total) * 100);
  }, [completion]);

  const goToStep = (step: TripWizardStep) => {
    const targetIndex = TRIP_WIZARD_STEPS.indexOf(step);
    const locked = TRIP_WIZARD_STEPS.slice(0, targetIndex).some((prev) => !completion[prev]);
    if (locked) return;
    navigate(TRIP_WIZARD_PATHS[step]);
  };

  const handlePrev = () => {
    if (activeIndex <= 0) return;
    navigate(TRIP_WIZARD_PATHS[TRIP_WIZARD_STEPS[activeIndex - 1]]);
  };

  const handleNext = () => {
    if (activeIndex >= TRIP_WIZARD_STEPS.length - 1) return;
    const nextStep = TRIP_WIZARD_STEPS[activeIndex + 1];
    const locked = TRIP_WIZARD_STEPS.slice(0, TRIP_WIZARD_STEPS.indexOf(nextStep)).some((prev) => !completion[prev]);
    if (locked || !completion[activeStep]) return;
    navigate(TRIP_WIZARD_PATHS[nextStep]);
  };

  const nextLabel = activeStep === 'export' ? 'Finish' : 'Next';

  return (
    <div className="tripwizard-shell">
      <div className="tripwizard-heading">
        <h1>Trip Wizard</h1>
        <p>Guided planning for your next flight, step by step.</p>
      </div>

      <div className="tripwizard-stepper">
        {TRIP_WIZARD_STEPS.map((step) => {
          const stepIndex = TRIP_WIZARD_STEPS.indexOf(step);
          const locked = stepIndex > 0 && TRIP_WIZARD_STEPS.slice(0, stepIndex).some((prev) => !completion[prev]);
          const stateClass = [
            step === activeStep ? 'tripwizard-step--active' : '',
            completion[step] ? 'tripwizard-step--done' : '',
            locked ? 'tripwizard-step--locked' : '',
          ]
            .filter(Boolean)
            .join(' ');

          return (
            <NavLink
              key={step}
              to={TRIP_WIZARD_PATHS[step]}
              className={`tripwizard-step ${stateClass}`}
              onClick={(event) => {
                if (locked) {
                  event.preventDefault();
                } else {
                  event.preventDefault();
                  goToStep(step);
                }
              }}
            >
              <span className="tripwizard-step-icon">{STEP_LABELS[step].icon}</span>
              <span>
                <p className="tripwizard-step-title">{STEP_LABELS[step].title}</p>
                <p className="tripwizard-step-desc">{STEP_LABELS[step].description}</p>
              </span>
            </NavLink>
          );
        })}
      </div>

      <div className="tripwizard-progress">
        <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 700, color: '#0f172a' }}>
          <span>
            Step {activeIndex + 1} of {TRIP_WIZARD_STEPS.length}
          </span>
          <span>{progressPct}% ready</span>
        </div>
        <div className="tripwizard-progress-bar">
          <div className="tripwizard-progress-bar-fill" style={{ width: `${progressPct}%` }} />
        </div>
      </div>

      <div className="tripwizard-body">
        <Outlet />
        <div className="tripwizard-footer">
          <div className="wizard-footer-left">
            <span className="wizard-chip">
              {completion[activeStep] ? '✅ Ready to continue' : '📝 Complete this step to continue'}
            </span>
          </div>
          <div className="wizard-footer-right">
            <button
              type="button"
              className="wizard-button secondary"
              onClick={handlePrev}
              disabled={activeIndex === 0}
            >
              ← Previous
            </button>
            <button
              type="button"
              className="wizard-button primary"
              onClick={handleNext}
              disabled={activeIndex === TRIP_WIZARD_STEPS.length - 1 || !completion[activeStep]}
            >
              {nextLabel} →
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
