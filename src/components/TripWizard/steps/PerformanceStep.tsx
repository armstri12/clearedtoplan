import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import {
  calculateLandingDistance,
  calculateTakeoffDistance,
  getRunwaySafetyLevel,
  type LandingInputs,
  type TakeoffInputs,
} from '../../../lib/performance/takeoffLanding';
import { useFlightPlan, useFlightPlanUpdater } from '../../../stores/flightPlan';

const defaultTakeoff: TakeoffInputs = {
  pohGroundRoll: 0,
  pohDistanceOver50ft: 0,
  currentWeight: undefined,
  pohBaselineWeight: undefined,
  windComponent: 0,
  runwayType: 'paved',
  runwayCondition: 'dry',
  runwaySlope: 0,
  humidity: 'normal',
};

const defaultLanding: LandingInputs = {
  pohGroundRoll: 0,
  pohDistanceOver50ft: 0,
  landingWeight: undefined,
  pohBaselineWeight: undefined,
  windComponent: 0,
  runwayType: 'paved',
  runwayCondition: 'dry',
  runwaySlope: 0,
  safetyFactor: 1.5,
};

function toNumber(value: string) {
  return value === '' ? undefined : Number(value);
}

export function PerformanceStep() {
  const performance = useFlightPlan((state) => state.performance);
  const loading = useFlightPlan((state) => state.loading);
  const { updatePerformance, updateLoading, setTakeoffPlan, setLandingPlan } = useFlightPlanUpdater();

  const normalizedTakeoff = useMemo(
    () => ({
      ...defaultTakeoff,
      ...performance.takeoff?.inputs,
      currentWeight: performance.takeoff?.inputs?.currentWeight ?? loading.takeoffWeight,
      pohBaselineWeight: performance.takeoff?.inputs?.pohBaselineWeight ?? loading.takeoffWeight,
    }),
    [loading.takeoffWeight, performance.takeoff?.inputs],
  );

  const normalizedLanding = useMemo(
    () => ({
      ...defaultLanding,
      ...performance.landing?.inputs,
      landingWeight: performance.landing?.inputs?.landingWeight ?? loading.landingWeight,
      pohBaselineWeight: performance.landing?.inputs?.pohBaselineWeight ?? loading.landingWeight,
      safetyFactor: performance.landing?.inputs?.safetyFactor ?? 1.5,
    }),
    [loading.landingWeight, performance.landing?.inputs],
  );

  const [takeoffInputs, setTakeoffInputs] = useState<TakeoffInputs>(normalizedTakeoff);
  const [landingInputs, setLandingInputs] = useState<LandingInputs>(normalizedLanding);
  const [takeoffRunwayLength, setTakeoffRunwayLength] = useState<string>(
    performance.takeoff?.runwayAvailableFt ? String(performance.takeoff.runwayAvailableFt) : '',
  );
  const [landingRunwayLength, setLandingRunwayLength] = useState<string>(
    performance.landing?.runwayAvailableFt ? String(performance.landing.runwayAvailableFt) : '',
  );

  useEffect(() => {
    setTakeoffInputs((prev) => {
      if (JSON.stringify(prev) === JSON.stringify(normalizedTakeoff)) return prev;
      return normalizedTakeoff;
    });
  }, [normalizedTakeoff]);

  useEffect(() => {
    setLandingInputs((prev) => {
      if (JSON.stringify(prev) === JSON.stringify(normalizedLanding)) return prev;
      return normalizedLanding;
    });
  }, [normalizedLanding]);

  useEffect(() => {
    const results = calculateTakeoffDistance(takeoffInputs);
    setTakeoffPlan(takeoffInputs, results);
  }, [setTakeoffPlan, takeoffInputs]);

  useEffect(() => {
    const results = calculateLandingDistance(landingInputs);
    setLandingPlan(landingInputs, results);
  }, [landingInputs, setLandingPlan]);

  useEffect(() => {
    const numeric = toNumber(takeoffRunwayLength);
    if (performance.takeoff?.runwayAvailableFt !== numeric) {
      updatePerformance({
        takeoff: { ...performance.takeoff, runwayAvailableFt: numeric },
      });
    }
  }, [performance.takeoff, takeoffRunwayLength, updatePerformance]);

  useEffect(() => {
    const numeric = toNumber(landingRunwayLength);
    if (performance.landing?.runwayAvailableFt !== numeric) {
      updatePerformance({
        landing: { ...performance.landing, runwayAvailableFt: numeric },
      });
    }
  }, [landingRunwayLength, performance.landing, updatePerformance]);

  const takeoffResults = useMemo(() => calculateTakeoffDistance(takeoffInputs), [takeoffInputs]);
  const landingResults = useMemo(() => calculateLandingDistance(landingInputs), [landingInputs]);
  const takeoffSafety = useMemo(
    () => getRunwaySafetyLevel(takeoffResults.over50ft, toNumber(takeoffRunwayLength) ?? null),
    [takeoffResults.over50ft, takeoffRunwayLength],
  );
  const landingSafety = useMemo(
    () => getRunwaySafetyLevel(landingResults.over50ft, toNumber(landingRunwayLength) ?? null),
    [landingResults.over50ft, landingRunwayLength],
  );

  const handlePerformanceChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    updatePerformance({ [name]: value ? Number(value) : undefined });
  };

  const handleLoadingChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    updateLoading({ [name]: value ? Number(value) : undefined });
  };

  const updateTakeoffField = <K extends keyof TakeoffInputs>(field: K, value: TakeoffInputs[K]) => {
    setTakeoffInputs((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const updateLandingField = <K extends keyof LandingInputs>(field: K, value: LandingInputs[K]) => {
    setLandingInputs((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  return (
    <div className="wizard-section">
      <h3>Performance & Loading</h3>
      <p className="wizard-helper">
        Baseline + corrections model with 1.5× safety margin. Feed in POH numbers, weights, runway factors, and keep CG notes handy.
      </p>

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
          <label htmlFor="centerOfGravity">CG (in)</label>
          <input
            id="centerOfGravity"
            name="centerOfGravity"
            type="number"
            value={loading.centerOfGravity ?? ''}
            onChange={handleLoadingChange}
            placeholder="34.5"
          />
          <p className="wizard-helper">Pulls from W&amp;B; edit here to keep the snippet fresh.</p>
        </div>
      </div>

      <div className="wizard-grid" style={{ marginTop: 12 }}>
        <div className="wizard-field">
          <label htmlFor="takeoff-runway">Takeoff runway available (ft)</label>
          <input
            id="takeoff-runway"
            name="takeoff-runway"
            type="number"
            value={takeoffRunwayLength}
            onChange={(event) => setTakeoffRunwayLength(event.target.value)}
            placeholder="4000"
          />
          <p className="wizard-helper">Used for 70/85% safety callouts.</p>
        </div>
        <div className="wizard-field">
          <label htmlFor="landing-runway">Landing runway available (ft)</label>
          <input
            id="landing-runway"
            name="landing-runway"
            type="number"
            value={landingRunwayLength}
            onChange={(event) => setLandingRunwayLength(event.target.value)}
            placeholder="4000"
          />
        </div>
      </div>

      <div className="wizard-grid" style={{ marginTop: 24 }}>
        <div className="wizard-field">
          <h4 style={{ margin: '0 0 8px' }}>Takeoff (baseline + corrections)</h4>
          <div className="wizard-grid">
            <div className="wizard-field">
              <label htmlFor="to-poh-ground">POH ground roll (ft)</label>
              <input
                id="to-poh-ground"
                name="to-poh-ground"
                type="number"
                value={takeoffInputs.pohGroundRoll || ''}
                onChange={(event) => updateTakeoffField('pohGroundRoll', Number(event.target.value) || 0)}
                placeholder="1200"
              />
            </div>
            <div className="wizard-field">
              <label htmlFor="to-poh-50">POH over 50 ft (ft)</label>
              <input
                id="to-poh-50"
                name="to-poh-50"
                type="number"
                value={takeoffInputs.pohDistanceOver50ft || ''}
                onChange={(event) => updateTakeoffField('pohDistanceOver50ft', Number(event.target.value) || 0)}
                placeholder="2000"
              />
            </div>
          </div>
          <div className="wizard-grid">
            <div className="wizard-field">
              <label htmlFor="to-weight">Current weight (lb)</label>
              <input
                id="to-weight"
                name="to-weight"
                type="number"
                value={takeoffInputs.currentWeight ?? ''}
                onChange={(event) => updateTakeoffField('currentWeight', Number(event.target.value) || undefined)}
                placeholder="2550"
              />
              <p className="wizard-helper">Defaults to W&amp;B takeoff weight.</p>
            </div>
            <div className="wizard-field">
              <label htmlFor="to-baseline-weight">POH baseline weight (lb)</label>
              <input
                id="to-baseline-weight"
                name="to-baseline-weight"
                type="number"
                value={takeoffInputs.pohBaselineWeight ?? ''}
                onChange={(event) => updateTakeoffField('pohBaselineWeight', Number(event.target.value) || undefined)}
                placeholder="2550"
              />
            </div>
          </div>
          <div className="wizard-grid">
            <div className="wizard-field">
              <label htmlFor="to-wind">Wind component (kt)</label>
              <input
                id="to-wind"
                name="to-wind"
                type="number"
                value={takeoffInputs.windComponent}
                onChange={(event) => updateTakeoffField('windComponent', Number(event.target.value) || 0)}
                placeholder="Positive=headwind"
              />
            </div>
            <div className="wizard-field">
              <label htmlFor="to-slope">Runway slope (%)</label>
              <input
                id="to-slope"
                name="to-slope"
                type="number"
                step="0.1"
                value={takeoffInputs.runwaySlope}
                onChange={(event) => updateTakeoffField('runwaySlope', Number(event.target.value) || 0)}
                placeholder="1.0"
              />
            </div>
          </div>
          <div className="wizard-grid">
            <div className="wizard-field">
              <label htmlFor="to-surface">Runway surface</label>
              <select
                id="to-surface"
                name="to-surface"
                value={takeoffInputs.runwayType}
                onChange={(event) => updateTakeoffField('runwayType', event.target.value as TakeoffInputs['runwayType'])}
              >
                <option value="paved">Paved</option>
                <option value="grass">Grass</option>
                <option value="gravel">Gravel</option>
              </select>
            </div>
            <div className="wizard-field">
              <label htmlFor="to-condition">Condition</label>
              <select
                id="to-condition"
                name="to-condition"
                value={takeoffInputs.runwayCondition}
                onChange={(event) =>
                  updateTakeoffField('runwayCondition', event.target.value as TakeoffInputs['runwayCondition'])
                }
              >
                <option value="dry">Dry</option>
                <option value="wet">Wet</option>
              </select>
            </div>
            <div className="wizard-field">
              <label htmlFor="to-humidity">Humidity</label>
              <select
                id="to-humidity"
                name="to-humidity"
                value={takeoffInputs.humidity}
                onChange={(event) => updateTakeoffField('humidity', event.target.value as TakeoffInputs['humidity'])}
              >
                <option value="normal">Normal</option>
                <option value="high">High (&gt;70%)</option>
              </select>
            </div>
          </div>

          <div className="wizard-summary-card" style={{ marginTop: 12 }}>
            <p style={{ margin: 0, fontWeight: 700 }}>Results (includes 1.5× safety)</p>
            <div className="wizard-inline" style={{ marginTop: 8, flexWrap: 'wrap', gap: 8 }}>
              <span className="wizard-chip">Ground roll: {takeoffResults.groundRoll.toLocaleString()} ft</span>
              <span className="wizard-chip">Over 50 ft: {takeoffResults.over50ft.toLocaleString()} ft</span>
              <span className="wizard-chip">Baseline: {takeoffResults.baselineOver50ft.toLocaleString()} ft</span>
            </div>
            <div style={{ marginTop: 8, fontSize: 13 }}>
              <div style={{ fontWeight: 700 }}>Corrections applied</div>
              {takeoffResults.corrections.length === 0 ? (
                <p className="wizard-helper">Standard day, no corrections.</p>
              ) : (
                <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
                  {takeoffResults.corrections.map((item, idx) => (
                    <li key={idx}>
                      <strong>{item.factor}</strong>: {item.description} (×{item.multiplier.toFixed(2)})
                    </li>
                  ))}
                  <li><strong>Safety margin</strong>: ×{takeoffResults.safetyMargin}</li>
                </ul>
              )}
            </div>
            <div
              className="wizard-summary-card"
              style={{ marginTop: 12, background: takeoffSafety.bgColor, color: takeoffSafety.color, borderColor: takeoffSafety.color }}
            >
              {takeoffSafety.message}
            </div>
          </div>
        </div>

        <div className="wizard-field">
          <h4 style={{ margin: '0 0 8px' }}>Landing (baseline + corrections)</h4>
          <div className="wizard-grid">
            <div className="wizard-field">
              <label htmlFor="ldg-poh-ground">POH ground roll (ft)</label>
              <input
                id="ldg-poh-ground"
                name="ldg-poh-ground"
                type="number"
                value={landingInputs.pohGroundRoll || ''}
                onChange={(event) => updateLandingField('pohGroundRoll', Number(event.target.value) || 0)}
                placeholder="600"
              />
            </div>
            <div className="wizard-field">
              <label htmlFor="ldg-poh-50">POH over 50 ft (ft)</label>
              <input
                id="ldg-poh-50"
                name="ldg-poh-50"
                type="number"
                value={landingInputs.pohDistanceOver50ft || ''}
                onChange={(event) => updateLandingField('pohDistanceOver50ft', Number(event.target.value) || 0)}
                placeholder="1300"
              />
            </div>
          </div>
          <div className="wizard-grid">
            <div className="wizard-field">
              <label htmlFor="ldg-weight">Landing weight (lb)</label>
              <input
                id="ldg-weight"
                name="ldg-weight"
                type="number"
                value={landingInputs.landingWeight ?? ''}
                onChange={(event) => updateLandingField('landingWeight', Number(event.target.value) || undefined)}
                placeholder="2450"
              />
            </div>
            <div className="wizard-field">
              <label htmlFor="ldg-baseline-weight">POH baseline weight (lb)</label>
              <input
                id="ldg-baseline-weight"
                name="ldg-baseline-weight"
                type="number"
                value={landingInputs.pohBaselineWeight ?? ''}
                onChange={(event) => updateLandingField('pohBaselineWeight', Number(event.target.value) || undefined)}
                placeholder="2450"
              />
            </div>
            <div className="wizard-field">
              <label htmlFor="ldg-safety">Safety factor</label>
              <input
                id="ldg-safety"
                name="ldg-safety"
                type="number"
                step="0.1"
                value={landingInputs.safetyFactor ?? 1.5}
                onChange={(event) => updateLandingField('safetyFactor', Number(event.target.value) || 1.5)}
              />
              <p className="wizard-helper">Defaults to 1.5×</p>
            </div>
          </div>
          <div className="wizard-grid">
            <div className="wizard-field">
              <label htmlFor="ldg-wind">Wind component (kt)</label>
              <input
                id="ldg-wind"
                name="ldg-wind"
                type="number"
                value={landingInputs.windComponent}
                onChange={(event) => updateLandingField('windComponent', Number(event.target.value) || 0)}
                placeholder="Positive=headwind"
              />
            </div>
            <div className="wizard-field">
              <label htmlFor="ldg-slope">Runway slope (%)</label>
              <input
                id="ldg-slope"
                name="ldg-slope"
                type="number"
                step="0.1"
                value={landingInputs.runwaySlope}
                onChange={(event) => updateLandingField('runwaySlope', Number(event.target.value) || 0)}
                placeholder="1.0"
              />
              <p className="wizard-helper">Positive = upslope helps landing.</p>
            </div>
          </div>
          <div className="wizard-grid">
            <div className="wizard-field">
              <label htmlFor="ldg-surface">Runway surface</label>
              <select
                id="ldg-surface"
                name="ldg-surface"
                value={landingInputs.runwayType}
                onChange={(event) => updateLandingField('runwayType', event.target.value as LandingInputs['runwayType'])}
              >
                <option value="paved">Paved</option>
                <option value="grass">Grass</option>
                <option value="gravel">Gravel</option>
              </select>
            </div>
            <div className="wizard-field">
              <label htmlFor="ldg-condition">Condition</label>
              <select
                id="ldg-condition"
                name="ldg-condition"
                value={landingInputs.runwayCondition}
                onChange={(event) =>
                  updateLandingField('runwayCondition', event.target.value as LandingInputs['runwayCondition'])
                }
              >
                <option value="dry">Dry</option>
                <option value="wet">Wet</option>
              </select>
            </div>
          </div>

          <div className="wizard-summary-card" style={{ marginTop: 12 }}>
            <p style={{ margin: 0, fontWeight: 700 }}>Results (includes safety factor)</p>
            <div className="wizard-inline" style={{ marginTop: 8, flexWrap: 'wrap', gap: 8 }}>
              <span className="wizard-chip">Ground roll: {landingResults.groundRoll.toLocaleString()} ft</span>
              <span className="wizard-chip">Over 50 ft: {landingResults.over50ft.toLocaleString()} ft</span>
              <span className="wizard-chip">Baseline: {landingResults.baselineOver50ft.toLocaleString()} ft</span>
            </div>
            <div style={{ marginTop: 8, fontSize: 13 }}>
              <div style={{ fontWeight: 700 }}>Corrections applied</div>
              {landingResults.corrections.length === 0 ? (
                <p className="wizard-helper">Standard day, no corrections.</p>
              ) : (
                <ul style={{ margin: '6px 0 0 16px', padding: 0 }}>
                  {landingResults.corrections.map((item, idx) => (
                    <li key={idx}>
                      <strong>{item.factor}</strong>: {item.description} (×{item.multiplier.toFixed(2)})
                    </li>
                  ))}
                  <li><strong>Safety margin</strong>: ×{landingResults.safetyMargin}</li>
                </ul>
              )}
            </div>
            <div
              className="wizard-summary-card"
              style={{ marginTop: 12, background: landingSafety.bgColor, color: landingSafety.color, borderColor: landingSafety.color }}
            >
              {landingSafety.message}
            </div>
          </div>
        </div>
      </div>

      <div className="wizard-summary-card" style={{ marginTop: 16 }}>
        <p style={{ margin: 0, fontWeight: 700 }}>Loading / balance snippet</p>
        <div className="wizard-inline" style={{ marginTop: 8, flexWrap: 'wrap', gap: 8 }}>
          <span className="wizard-chip">TO weight: {loading.takeoffWeight ? `${loading.takeoffWeight} lb` : 'Unset'}</span>
          <span className="wizard-chip">LDG weight: {loading.landingWeight ? `${loading.landingWeight} lb` : 'Unset'}</span>
          <span className="wizard-chip">
            CG: {loading.centerOfGravity ? `${loading.centerOfGravity} in` : 'TODO: add CG from W&B'}
          </span>
        </div>
        <p className="wizard-helper" style={{ marginTop: 8 }}>
          Hooked to the trip store so summary/exports can reuse this snapshot. Update from W&amp;B or type a quick note.
        </p>
      </div>
    </div>
  );
}
