import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFlightPlan } from '../../stores/flightPlan';

export type TripWizardStep = 'basics' | 'weather' | 'performance' | 'export';

export const TRIP_WIZARD_STEPS: TripWizardStep[] = ['basics', 'weather', 'performance', 'export'];

export const TRIP_WIZARD_PATHS: Record<TripWizardStep, string> = {
  basics: '/trip-wizard',
  weather: '/trip-wizard/weather',
  performance: '/trip-wizard/performance',
  export: '/trip-wizard/export',
};

type CompletionMap = Record<TripWizardStep, boolean>;

export function useTripWizardCompletion(): { completion: CompletionMap } {
  return useFlightPlan((state) => {
    const basicsComplete = Boolean(state.basics.departure && state.basics.destination && state.basics.route);

    const weatherComplete = Boolean(
      basicsComplete &&
        (state.weather.departure.icao || state.weather.destination.icao) &&
        (state.weather.departure.metar || state.weather.departure.taf || state.weather.briefingNotes),
    );

    const performanceComplete = Boolean(
      (state.performance.pressureAltitudeFt && state.performance.densityAltitudeFt) ||
        (state.performance.takeoff?.inputs && state.performance.landing?.inputs) ||
        (state.loading.takeoffWeight && state.loading.landingWeight),
    );

    const exportComplete = Boolean(basicsComplete && weatherComplete && performanceComplete);

    return {
      completion: {
        basics: basicsComplete,
        weather: weatherComplete,
        performance: performanceComplete,
        export: exportComplete,
      },
    };
  });
}

export function StepGuard({ step, children }: { step: TripWizardStep; children: React.ReactNode }) {
  const navigate = useNavigate();
  const { completion } = useTripWizardCompletion();

  useEffect(() => {
    const targetIndex = TRIP_WIZARD_STEPS.indexOf(step);
    if (targetIndex < 0) return;

    const blocker = TRIP_WIZARD_STEPS.slice(0, targetIndex).find((wizardStep) => !completion[wizardStep]);
    if (blocker) {
      navigate(TRIP_WIZARD_PATHS[blocker]);
    }
  }, [step, completion, navigate]);

  return <>{children}</>;
}
