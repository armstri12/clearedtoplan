import type { ChangeEvent } from 'react';
import { useFlightPlan, useFlightPlanUpdater } from '../../../stores/flightPlan';

export function PerformanceStep() {
  const performance = useFlightPlan((state) => state.performance);
  const loading = useFlightPlan((state) => state.loading);
  const { updatePerformance, updateLoading } = useFlightPlanUpdater();

  const handlePerformanceChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    updatePerformance({ [name]: value ? Number(value) : undefined });
  };

  const handleLoadingChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    updateLoading({ [name]: value ? Number(value) : undefined });
  };

  return (
    <div className="wizard-section">
      <h3>Performance & Loading</h3>
      <p className="wizard-helper">Quick capture of density altitude, runway checks, and payload highlights.</p>

      <div className="wizard-grid">
        <div className="wizard-field">
          <label htmlFor="pressureAltitudeFt">Pressure altitude (ft)</label>
          <input
            id="pressureAltitudeFt"
            name="pressureAltitudeFt"
            type="number"
            value={performance.pressureAltitudeFt ?? ''}
            onChange={handlePerformanceChange}
            placeholder="1500"
          />
        </div>
        <div className="wizard-field">
          <label htmlFor="densityAltitudeFt">Density altitude (ft)</label>
          <input
            id="densityAltitudeFt"
            name="densityAltitudeFt"
            type="number"
            value={performance.densityAltitudeFt ?? ''}
            onChange={handlePerformanceChange}
            placeholder="2000"
          />
        </div>
      </div>

      <div className="wizard-grid">
        <div className="wizard-field">
          <label htmlFor="takeoffWeight">Takeoff weight (lb)</label>
          <input
            id="takeoffWeight"
            name="takeoffWeight"
            type="number"
            value={loading.takeoffWeight ?? ''}
            onChange={handleLoadingChange}
            placeholder="2550"
          />
        </div>
        <div className="wizard-field">
          <label htmlFor="landingWeight">Landing weight (lb)</label>
          <input
            id="landingWeight"
            name="landingWeight"
            type="number"
            value={loading.landingWeight ?? ''}
            onChange={handleLoadingChange}
            placeholder="2450"
          />
        </div>
        <div className="wizard-field">
          <label htmlFor="runwayAvailableFt">Runway available (ft)</label>
          <input
            id="runwayAvailableFt"
            name="runwayAvailableFt"
            type="number"
            value={performance.takeoff?.runwayAvailableFt ?? ''}
            onChange={(event) =>
              updatePerformance({ takeoff: { ...performance.takeoff, runwayAvailableFt: Number(event.target.value) || undefined } })
            }
            placeholder="4000"
          />
        </div>
      </div>

      <div className="wizard-summary-card">
        <p style={{ margin: 0, fontWeight: 700 }}>Payload snapshot</p>
        <div className="wizard-inline" style={{ marginTop: 8 }}>
          <span className="wizard-chip">TO weight: {loading.takeoffWeight ? `${loading.takeoffWeight} lb` : 'Unset'}</span>
          <span className="wizard-chip">LDG weight: {loading.landingWeight ? `${loading.landingWeight} lb` : 'Unset'}</span>
          <span className="wizard-chip">
            Density Alt: {performance.densityAltitudeFt ? `${performance.densityAltitudeFt} ft` : 'Unset'}
          </span>
        </div>
      </div>
    </div>
  );
}
