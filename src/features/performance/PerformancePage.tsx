import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useFlightSession } from '../../context/FlightSessionContext';
import { getMetar, parseIcaoCode, type MetarData } from '../../services/aviationApi';

// Standard atmosphere constants
const ISA_SEA_LEVEL_TEMP_C = 15; // °C
const ISA_LAPSE_RATE = 1.98; // °C per 1000 ft

function calculateISATemp(pressureAltFt: number): number {
  return ISA_SEA_LEVEL_TEMP_C - (ISA_LAPSE_RATE * (pressureAltFt / 1000));
}

function calculateDensityAltitude(pressureAltFt: number, tempC: number): number {
  const isaTemp = calculateISATemp(pressureAltFt);
  const tempDifference = tempC - isaTemp;
  // DA = PA + (120 ft per °C deviation from standard)
  return Math.round(pressureAltFt + (120 * tempDifference));
}

function calculatePressureAltitude(fieldElevationFt: number, altimeterInHg: number): number {
  // PA = Field Elevation + (29.92 - Altimeter Setting) × 1000
  const correction = (29.92 - altimeterInHg) * 1000;
  return Math.round(fieldElevationFt + correction);
}

type DensityAltitudeWarning = {
  level: 'info' | 'caution' | 'warning' | 'danger';
  message: string;
  color: string;
  bgColor: string;
};

function getDensityAltitudeWarning(densityAltFt: number): DensityAltitudeWarning {
  if (densityAltFt < 3000) {
    return {
      level: 'info',
      message: 'Normal density altitude - standard performance expected.',
      color: '#059669',
      bgColor: '#ecfdf5',
    };
  } else if (densityAltFt < 5000) {
    return {
      level: 'caution',
      message: 'Moderate density altitude - expect slight performance degradation (~5-10%).',
      color: '#d97706',
      bgColor: '#fffbeb',
    };
  } else if (densityAltFt < 8000) {
    return {
      level: 'warning',
      message: 'High density altitude - expect significant performance degradation (10-20%). Longer takeoff roll, reduced climb rate.',
      color: '#ea580c',
      bgColor: '#fff7ed',
    };
  } else {
    return {
      level: 'danger',
      message: '⛔ CRITICAL density altitude - severe performance degradation (>20%). Exercise extreme caution. Consider delaying flight or reducing weight.',
      color: '#dc2626',
      bgColor: '#fef2f2',
    };
  }
}

function celsiusToFahrenheit(c: number): number {
  return Math.round((c * 9/5) + 32);
}

function fahrenheitToCelsius(f: number): number {
  return Math.round((f - 32) * 5/9 * 10) / 10;
}

// ===== TAKEOFF/LANDING DISTANCE CALCULATOR =====

type CorrectionApplied = {
  factor: string;
  description: string;
  multiplier: number;
};

type DistanceResults = {
  groundRoll: number;
  over50ft: number;
  corrections: CorrectionApplied[];
  baselineGroundRoll: number;
  baselineOver50ft: number;
  safetyMargin: number;
};

// Correction factors based on FAA guidance and POH standards
const TAKEOFF_CORRECTIONS = {
  headwindFactor: -0.10 / 9,      // -10% per 9kt = -1.11% per kt
  tailwindFactor: 0.10 / 2,       // +10% per 2kt = +5% per kt
  grass: 1.15,                     // +15%
  gravel: 1.15,                    // +15%
  wetPaved: 1.15,                  // +15%
  wetGrass: 1.32,                  // +15% × +15% = +32%
  uphillFactor: 0.22,              // +22% per 1% upslope
  downhillFactor: -0.07,           // -7% per 1% downslope
  highHumidity: 1.10,              // +10%
  safetyMargin: 1.5,               // 1.5× (AOPA recommendation)
};

const LANDING_CORRECTIONS = {
  headwindFactor: -0.10 / 9,      // -10% per 9kt
  tailwindFactor: 0.10 / 2,       // +10% per 2kt
  grass: 1.15,                     // +15%
  gravel: 1.15,                    // +15%
  wetPaved: 1.35,                  // +35%
  wetGrass: 1.60,                  // +60%
  uphillFactor: -0.07,             // -7% per 1% upslope (helps landing)
  downhillFactor: 0.22,            // +22% per 1% downslope (hurts landing)
  safetyMargin: 1.5,               // 1.5×
};

function calculateTakeoffDistance(
  pohGroundRoll: number,
  pohOver50ft: number,
  windKts: number,
  runwayType: 'paved' | 'grass' | 'gravel',
  runwayCondition: 'dry' | 'wet',
  runwaySlope: number,
  humidity: 'normal' | 'high'
): DistanceResults {
  let groundRoll = pohGroundRoll;
  let over50ft = pohOver50ft;
  const corrections: CorrectionApplied[] = [];

  // 1. Wind correction
  if (windKts !== 0) {
    const windFactor = windKts > 0
      ? TAKEOFF_CORRECTIONS.headwindFactor * windKts
      : TAKEOFF_CORRECTIONS.tailwindFactor * Math.abs(windKts);
    const windMultiplier = 1 + windFactor;

    groundRoll *= windMultiplier;
    over50ft *= windMultiplier;

    corrections.push({
      factor: 'Wind',
      description: windKts > 0
        ? `${windKts}kt headwind`
        : `${Math.abs(windKts)}kt tailwind`,
      multiplier: windMultiplier,
    });
  }

  // 2. Runway surface/condition
  if (runwayType === 'grass') {
    const surfaceMultiplier = runwayCondition === 'wet'
      ? TAKEOFF_CORRECTIONS.wetGrass
      : TAKEOFF_CORRECTIONS.grass;

    groundRoll *= surfaceMultiplier;
    over50ft *= surfaceMultiplier;

    corrections.push({
      factor: 'Runway Surface',
      description: runwayCondition === 'wet' ? 'Wet grass' : 'Dry grass',
      multiplier: surfaceMultiplier,
    });
  } else if (runwayType === 'gravel') {
    groundRoll *= TAKEOFF_CORRECTIONS.gravel;
    over50ft *= TAKEOFF_CORRECTIONS.gravel;
    corrections.push({
      factor: 'Runway Surface',
      description: 'Gravel',
      multiplier: TAKEOFF_CORRECTIONS.gravel,
    });
  } else if (runwayCondition === 'wet') {
    groundRoll *= TAKEOFF_CORRECTIONS.wetPaved;
    over50ft *= TAKEOFF_CORRECTIONS.wetPaved;
    corrections.push({
      factor: 'Runway Condition',
      description: 'Wet paved',
      multiplier: TAKEOFF_CORRECTIONS.wetPaved,
    });
  }

  // 3. Runway slope
  if (runwaySlope !== 0) {
    const slopeFactor = runwaySlope > 0
      ? TAKEOFF_CORRECTIONS.uphillFactor * runwaySlope
      : TAKEOFF_CORRECTIONS.downhillFactor * Math.abs(runwaySlope);
    const slopeMultiplier = 1 + slopeFactor;

    groundRoll *= slopeMultiplier;
    over50ft *= slopeMultiplier;

    corrections.push({
      factor: 'Runway Slope',
      description: runwaySlope > 0
        ? `${runwaySlope}% upslope`
        : `${Math.abs(runwaySlope)}% downslope`,
      multiplier: slopeMultiplier,
    });
  }

  // 4. Humidity
  if (humidity === 'high') {
    groundRoll *= TAKEOFF_CORRECTIONS.highHumidity;
    over50ft *= TAKEOFF_CORRECTIONS.highHumidity;
    corrections.push({
      factor: 'Humidity',
      description: 'High humidity',
      multiplier: TAKEOFF_CORRECTIONS.highHumidity,
    });
  }

  // 5. Safety margin
  const finalGroundRoll = Math.round(groundRoll * TAKEOFF_CORRECTIONS.safetyMargin);
  const finalOver50ft = Math.round(over50ft * TAKEOFF_CORRECTIONS.safetyMargin);

  return {
    groundRoll: finalGroundRoll,
    over50ft: finalOver50ft,
    corrections,
    baselineGroundRoll: pohGroundRoll,
    baselineOver50ft: pohOver50ft,
    safetyMargin: TAKEOFF_CORRECTIONS.safetyMargin,
  };
}

function calculateLandingDistance(
  pohGroundRoll: number,
  pohOver50ft: number,
  windKts: number,
  runwayType: 'paved' | 'grass' | 'gravel',
  runwayCondition: 'dry' | 'wet',
  runwaySlope: number
): DistanceResults {
  let groundRoll = pohGroundRoll;
  let over50ft = pohOver50ft;
  const corrections: CorrectionApplied[] = [];

  // 1. Wind correction (same as takeoff)
  if (windKts !== 0) {
    const windFactor = windKts > 0
      ? LANDING_CORRECTIONS.headwindFactor * windKts
      : LANDING_CORRECTIONS.tailwindFactor * Math.abs(windKts);
    const windMultiplier = 1 + windFactor;

    groundRoll *= windMultiplier;
    over50ft *= windMultiplier;

    corrections.push({
      factor: 'Wind',
      description: windKts > 0
        ? `${windKts}kt headwind`
        : `${Math.abs(windKts)}kt tailwind`,
      multiplier: windMultiplier,
    });
  }

  // 2. Runway surface/condition
  if (runwayType === 'grass') {
    const surfaceMultiplier = runwayCondition === 'wet'
      ? LANDING_CORRECTIONS.wetGrass
      : LANDING_CORRECTIONS.grass;

    groundRoll *= surfaceMultiplier;
    over50ft *= surfaceMultiplier;

    corrections.push({
      factor: 'Runway Surface',
      description: runwayCondition === 'wet' ? 'Wet grass' : 'Dry grass',
      multiplier: surfaceMultiplier,
    });
  } else if (runwayType === 'gravel') {
    groundRoll *= LANDING_CORRECTIONS.gravel;
    over50ft *= LANDING_CORRECTIONS.gravel;
    corrections.push({
      factor: 'Runway Surface',
      description: 'Gravel',
      multiplier: LANDING_CORRECTIONS.gravel,
    });
  } else if (runwayCondition === 'wet') {
    groundRoll *= LANDING_CORRECTIONS.wetPaved;
    over50ft *= LANDING_CORRECTIONS.wetPaved;
    corrections.push({
      factor: 'Runway Condition',
      description: 'Wet paved',
      multiplier: LANDING_CORRECTIONS.wetPaved,
    });
  }

  // 3. Runway slope (opposite effect for landing)
  if (runwaySlope !== 0) {
    const slopeFactor = runwaySlope > 0
      ? LANDING_CORRECTIONS.uphillFactor * runwaySlope  // uphill HELPS landing
      : LANDING_CORRECTIONS.downhillFactor * Math.abs(runwaySlope);  // downhill HURTS landing
    const slopeMultiplier = 1 + slopeFactor;

    groundRoll *= slopeMultiplier;
    over50ft *= slopeMultiplier;

    corrections.push({
      factor: 'Runway Slope',
      description: runwaySlope > 0
        ? `${runwaySlope}% upslope (helps)`
        : `${Math.abs(runwaySlope)}% downslope (hurts)`,
      multiplier: slopeMultiplier,
    });
  }

  // 4. Safety margin
  const finalGroundRoll = Math.round(groundRoll * LANDING_CORRECTIONS.safetyMargin);
  const finalOver50ft = Math.round(over50ft * LANDING_CORRECTIONS.safetyMargin);

  return {
    groundRoll: finalGroundRoll,
    over50ft: finalOver50ft,
    corrections,
    baselineGroundRoll: pohGroundRoll,
    baselineOver50ft: pohOver50ft,
    safetyMargin: LANDING_CORRECTIONS.safetyMargin,
  };
}

function getRunwaySafetyLevel(requiredFt: number, availableFt: number | null) {
  if (!availableFt || availableFt === 0) {
    return {
      level: 'unknown',
      color: '#6b7280',
      bgColor: '#f3f4f6',
      message: 'Enter runway length to assess safety',
    };
  }

  const percentage = (requiredFt / availableFt) * 100;

  if (percentage <= 70) {
    return {
      level: 'safe',
      color: '#059669',
      bgColor: '#ecfdf5',
      message: `✅ SAFE: Using ${Math.round(percentage)}% of runway (≤70% recommended)`,
    };
  } else if (percentage <= 85) {
    return {
      level: 'caution',
      color: '#d97706',
      bgColor: '#fffbeb',
      message: `⚠️ CAUTION: Using ${Math.round(percentage)}% of runway. Limited margin - consider conditions carefully.`,
    };
  } else {
    return {
      level: 'danger',
      color: '#dc2626',
      bgColor: '#fef2f2',
      message: `⛔ DANGER: Requires ${Math.round(percentage)}% of runway. INSUFFICIENT - DO NOT ATTEMPT.`,
    };
  }
}

export default function PerformancePage() {
  const navigate = useNavigate();
  const { currentSession, completeStep } = useFlightSession();

  // Input mode selection
  const [inputMode, setInputMode] = useState<'direct' | 'calculated'>('calculated');

  // Calculated mode inputs
  const [fieldElevation, setFieldElevation] = useState<string>('500');
  const [altimeter, setAltimeter] = useState<string>('29.92');

  // Direct mode input
  const [pressureAltDirect, setPressureAltDirect] = useState<string>('500');

  // Temperature inputs
  const [tempUnit, setTempUnit] = useState<'C' | 'F'>('F');
  const [temperature, setTemperature] = useState<string>('80');

  // Weather API integration
  const [icaoInput, setIcaoInput] = useState<string>('');
  const [metar, setMetar] = useState<MetarData | null>(null);
  const [isLoadingWeather, setIsLoadingWeather] = useState<boolean>(false);
  const [weatherError, setWeatherError] = useState<string>('');

  // Takeoff distance calculator inputs
  const [toPohGroundRoll, setToPohGroundRoll] = useState<string>('1200');
  const [toPohOver50ft, setToPohOver50ft] = useState<string>('2000');
  const [toWind, setToWind] = useState<string>('0');
  const [toRunwayType, setToRunwayType] = useState<'paved' | 'grass' | 'gravel'>('paved');
  const [toRunwayCondition, setToRunwayCondition] = useState<'dry' | 'wet'>('dry');
  const [toRunwaySlope, setToRunwaySlope] = useState<string>('0');
  const [toHumidity, setToHumidity] = useState<'normal' | 'high'>('normal');
  const [toRunwayLength, setToRunwayLength] = useState<string>('');

  // Landing distance calculator inputs
  const [landPohGroundRoll, setLandPohGroundRoll] = useState<string>('600');
  const [landPohOver50ft, setLandPohOver50ft] = useState<string>('1300');
  const [landWind, setLandWind] = useState<string>('0');
  const [landRunwayType, setLandRunwayType] = useState<'paved' | 'grass' | 'gravel'>('paved');
  const [landRunwayCondition, setLandRunwayCondition] = useState<'dry' | 'wet'>('dry');
  const [landRunwaySlope, setLandRunwaySlope] = useState<string>('0');
  const [landRunwayLength, setLandRunwayLength] = useState<string>('');

  async function fetchWeather() {
    const icao = parseIcaoCode(icaoInput);
    if (!icao) {
      setWeatherError('Please enter a valid 4-letter ICAO code (e.g., KJFK)');
      return;
    }

    setIsLoadingWeather(true);
    setWeatherError('');
    setMetar(null);

    const data = await getMetar(icao);

    setIsLoadingWeather(false);

    if (!data) {
      setWeatherError(`No weather data available for ${icao}. Check the ICAO code and try again.`);
      return;
    }

    setMetar(data);

    // Auto-populate fields from METAR
    if (data.barometer?.hg) {
      setAltimeter(data.barometer.hg.toFixed(2));
    }

    if (data.temperature) {
      const tempValue = tempUnit === 'F' ? data.temperature.fahrenheit : data.temperature.celsius;
      setTemperature(String(Math.round(tempValue)));
    }

    if (data.elevation?.feet && inputMode === 'calculated') {
      setFieldElevation(String(Math.round(data.elevation.feet)));
    }
  }

  const results = useMemo(() => {
    const fieldElev = Number(fieldElevation) || 0;
    const altim = Number(altimeter) || 29.92;
    const paDirect = Number(pressureAltDirect) || 0;
    const temp = Number(temperature) || 0;

    const pressureAlt = inputMode === 'calculated'
      ? calculatePressureAltitude(fieldElev, altim)
      : paDirect;

    const tempC = tempUnit === 'F' ? fahrenheitToCelsius(temp) : temp;
    const isaTemp = calculateISATemp(pressureAlt);
    const densityAlt = calculateDensityAltitude(pressureAlt, tempC);
    const warning = getDensityAltitudeWarning(densityAlt);

    // Performance approximations
    const tempDeviation = tempC - isaTemp;
    const perfDegradation = Math.min(Math.max(Math.round((densityAlt / 1000) * 2.5), 0), 50);
    const takeoffRollIncrease = Math.round(perfDegradation * 1.2); // Takeoff distance increases faster
    const climbRateDecrease = Math.round(perfDegradation * 0.8);

    return {
      pressureAlt,
      tempC,
      tempF: tempUnit === 'C' ? celsiusToFahrenheit(tempC) : temp,
      isaTemp,
      isaTempF: celsiusToFahrenheit(isaTemp),
      tempDeviation,
      densityAlt,
      warning,
      perfDegradation,
      takeoffRollIncrease,
      climbRateDecrease,
    };
  }, [inputMode, fieldElevation, altimeter, pressureAltDirect, temperature, tempUnit]);

  // Takeoff distance calculations
  const takeoffResults = useMemo(() => {
    return calculateTakeoffDistance(
      Number(toPohGroundRoll) || 0,
      Number(toPohOver50ft) || 0,
      Number(toWind) || 0,
      toRunwayType,
      toRunwayCondition,
      Number(toRunwaySlope) || 0,
      toHumidity
    );
  }, [toPohGroundRoll, toPohOver50ft, toWind, toRunwayType, toRunwayCondition, toRunwaySlope, toHumidity]);

  const takeoffSafety = useMemo(() => {
    return getRunwaySafetyLevel(takeoffResults.over50ft, Number(toRunwayLength) || null);
  }, [takeoffResults.over50ft, toRunwayLength]);

  // Landing distance calculations
  const landingResults = useMemo(() => {
    return calculateLandingDistance(
      Number(landPohGroundRoll) || 0,
      Number(landPohOver50ft) || 0,
      Number(landWind) || 0,
      landRunwayType,
      landRunwayCondition,
      Number(landRunwaySlope) || 0
    );
  }, [landPohGroundRoll, landPohOver50ft, landWind, landRunwayType, landRunwayCondition, landRunwaySlope]);

  const landingSafety = useMemo(() => {
    return getRunwaySafetyLevel(landingResults.over50ft, Number(landRunwayLength) || null);
  }, [landingResults.over50ft, landRunwayLength]);

  return (
    <div>
      <h2>Performance Calculator</h2>
      <p style={{ marginTop: 4, opacity: 0.8 }}>
        Calculate density altitude and estimated performance impact. Always verify with POH performance charts.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
        {/* Input Section */}
        <div style={{ border: '1px solid #ddd', borderRadius: 12, padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>Inputs</h3>

          {/* Real-time Weather */}
          <div
            style={{
              marginBottom: 16,
              padding: 12,
              borderRadius: 8,
              background: '#eff6ff',
              border: '1px solid #93c5fd',
            }}
          >
            <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8 }}>
              🌤️ Get Current Weather
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="text"
                value={icaoInput}
                onChange={(e) => setIcaoInput(e.target.value.toUpperCase())}
                onKeyDown={(e) => e.key === 'Enter' && fetchWeather()}
                placeholder="ICAO (e.g., KJFK)"
                maxLength={4}
                style={{
                  flex: 1,
                  padding: 8,
                  borderRadius: 8,
                  border: '1px solid #ddd',
                  textTransform: 'uppercase',
                }}
              />
              <button
                onClick={fetchWeather}
                disabled={isLoadingWeather}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: '1px solid #2563eb',
                  background: '#2563eb',
                  color: '#fff',
                  fontWeight: 700,
                  cursor: isLoadingWeather ? 'wait' : 'pointer',
                  opacity: isLoadingWeather ? 0.6 : 1,
                }}
              >
                {isLoadingWeather ? 'Loading...' : 'Fetch'}
              </button>
            </div>

            {weatherError && (
              <div
                style={{
                  marginTop: 8,
                  padding: 8,
                  borderRadius: 6,
                  background: '#fef2f2',
                  color: '#dc2626',
                  fontSize: 12,
                }}
              >
                {weatherError}
              </div>
            )}

            {metar && (
              <div
                style={{
                  marginTop: 8,
                  padding: 10,
                  borderRadius: 6,
                  background: '#f0fdf4',
                  border: '1px solid #86efac',
                }}
              >
                <div style={{ fontSize: 11, fontWeight: 800, color: '#059669', marginBottom: 4 }}>
                  ✅ METAR for {metar.icao}
                  {metar.name && ` - ${metar.name}`}
                </div>
                <div
                  style={{
                    fontSize: 11,
                    fontFamily: 'monospace',
                    color: '#065f46',
                    wordBreak: 'break-all',
                  }}
                >
                  {metar.raw_text}
                </div>
                {metar.flight_category && (
                  <div
                    style={{
                      marginTop: 6,
                      fontSize: 10,
                      fontWeight: 800,
                      color:
                        metar.flight_category === 'VFR'
                          ? '#059669'
                          : metar.flight_category === 'MVFR'
                          ? '#d97706'
                          : '#dc2626',
                    }}
                  >
                    {metar.flight_category} Conditions
                  </div>
                )}
                <div style={{ marginTop: 6, fontSize: 11, opacity: 0.8 }}>
                  Fields updated automatically ↓
                </div>
              </div>
            )}
          </div>

          <hr style={{ margin: '16px 0', opacity: 0.3 }} />

          {/* Pressure Altitude Input Mode */}
          <div style={{ marginBottom: 16 }}>
            <label style={{ fontSize: 12, fontWeight: 800, opacity: 0.8 }}>
              Pressure Altitude Input
            </label>
            <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
              <button
                onClick={() => setInputMode('calculated')}
                style={{
                  flex: 1,
                  padding: 8,
                  borderRadius: 8,
                  border: '1px solid #ddd',
                  background: inputMode === 'calculated' ? '#2563eb' : '#fff',
                  color: inputMode === 'calculated' ? '#fff' : '#000',
                  fontWeight: inputMode === 'calculated' ? 700 : 500,
                  cursor: 'pointer',
                }}
              >
                Calculate from altimeter
              </button>
              <button
                onClick={() => setInputMode('direct')}
                style={{
                  flex: 1,
                  padding: 8,
                  borderRadius: 8,
                  border: '1px solid #ddd',
                  background: inputMode === 'direct' ? '#2563eb' : '#fff',
                  color: inputMode === 'direct' ? '#fff' : '#000',
                  fontWeight: inputMode === 'direct' ? 700 : 500,
                  cursor: 'pointer',
                }}
              >
                Enter directly
              </button>
            </div>
          </div>

          {inputMode === 'calculated' ? (
            <>
              <div style={{ marginBottom: 12 }}>
                <label htmlFor="field-elevation">Field Elevation (ft MSL)</label>
                <input
                  id="field-elevation"
                  type="number"
                  value={fieldElevation}
                  onChange={(e) => setFieldElevation(e.target.value)}
                  style={{ width: '100%', padding: 8, borderRadius: 8, marginTop: 4 }}
                  placeholder="e.g. 500"
                />
              </div>

              <div style={{ marginBottom: 12 }}>
                <label htmlFor="altimeter" style={{ fontWeight: 700 }}>
                  Altimeter Setting (inHg)
                </label>
                <input
                  id="altimeter"
                  type="number"
                  step="0.01"
                  value={altimeter}
                  onChange={(e) => setAltimeter(e.target.value)}
                  style={{
                    width: '100%',
                    padding: 8,
                    borderRadius: 8,
                    marginTop: 4,
                    border: (Number(altimeter) < 27 || Number(altimeter) > 31) ? '2px solid #dc2626' : '1px solid #ddd'
                  }}
                  placeholder="e.g. 29.92"
                />
                <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>
                  Must be in inches of mercury (inHg), typically 28-31
                </div>
                {(Number(altimeter) > 100 || Number(altimeter) < 20) && (
                  <div
                    style={{
                      marginTop: 4,
                      padding: 6,
                      borderRadius: 6,
                      background: '#fef2f2',
                      border: '1px solid #fca5a5',
                      fontSize: 11,
                      color: '#dc2626',
                      fontWeight: 700
                    }}
                  >
                    ⚠️ This value looks incorrect. Use inHg (e.g., 29.92), not hPa.
                    {Number(altimeter) > 100 && ` ${Number(altimeter)} hPa = ${(Number(altimeter) * 0.02953).toFixed(2)} inHg`}
                  </div>
                )}
              </div>
            </>
          ) : (
            <div style={{ marginBottom: 12 }}>
              <label htmlFor="pressure-alt-direct">Pressure Altitude (ft)</label>
              <input
                id="pressure-alt-direct"
                type="number"
                value={pressureAltDirect}
                onChange={(e) => setPressureAltDirect(e.target.value)}
                style={{ width: '100%', padding: 8, borderRadius: 8, marginTop: 4 }}
                placeholder="e.g. 500"
              />
              <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
                Use field elevation if altimeter is set to 29.92
              </div>
            </div>
          )}

          <hr style={{ margin: '16px 0' }} />

          {/* Temperature Input */}
          <div style={{ marginBottom: 12 }}>
            <label htmlFor="temperature">Temperature</label>
            <div style={{ display: 'flex', gap: 8, marginTop: 4 }}>
              <input
                id="temperature"
                type="number"
                value={temperature}
                onChange={(e) => setTemperature(e.target.value)}
                style={{ flex: 1, padding: 8, borderRadius: 8 }}
                placeholder={tempUnit === 'F' ? 'e.g. 80' : 'e.g. 27'}
              />
              <select
                value={tempUnit}
                onChange={(e) => {
                  const newUnit = e.target.value as 'C' | 'F';
                  // Convert existing temperature value
                  const currentTemp = Number(temperature) || 0;
                  if (tempUnit === 'C' && newUnit === 'F') {
                    setTemperature(String(celsiusToFahrenheit(currentTemp)));
                  } else if (tempUnit === 'F' && newUnit === 'C') {
                    setTemperature(String(fahrenheitToCelsius(currentTemp)));
                  }
                  setTempUnit(newUnit);
                }}
                style={{ padding: 8, borderRadius: 8, minWidth: 60 }}
              >
                <option value="F">°F</option>
                <option value="C">°C</option>
              </select>
            </div>
          </div>
        </div>

        {/* Results Section */}
        <div style={{ border: '1px solid #ddd', borderRadius: 12, padding: 16 }}>
          <h3 style={{ marginTop: 0 }}>Results</h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <div
              style={{
                padding: 12,
                borderRadius: 8,
                background: '#f3f4f6',
                border: '1px solid #e5e7eb',
              }}
            >
              <div style={{ fontSize: 12, opacity: 0.8 }}>Pressure Altitude</div>
              <div style={{ fontSize: 24, fontWeight: 900 }}>
                {results.pressureAlt.toLocaleString()} ft
              </div>
            </div>

            <div
              style={{
                padding: 12,
                borderRadius: 8,
                background: '#dbeafe',
                border: '1px solid #93c5fd',
              }}
            >
              <div style={{ fontSize: 12, opacity: 0.8 }}>ISA Temperature at this altitude</div>
              <div style={{ fontSize: 20, fontWeight: 700 }}>
                {results.isaTemp.toFixed(1)}°C / {results.isaTempF}°F
              </div>
              <div style={{ fontSize: 12, marginTop: 4 }}>
                Actual temp is {results.tempDeviation > 0 ? '+' : ''}{results.tempDeviation.toFixed(1)}°C
                {results.tempDeviation > 0 ? ' warmer' : ' cooler'} than standard
              </div>
            </div>

            <div
              style={{
                padding: 16,
                borderRadius: 12,
                background: '#fef3c7',
                border: '2px solid #fbbf24',
              }}
            >
              <div style={{ fontSize: 12, opacity: 0.8, fontWeight: 800 }}>DENSITY ALTITUDE</div>
              <div style={{ fontSize: 32, fontWeight: 900, color: '#92400e' }}>
                {results.densityAlt.toLocaleString()} ft
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Warning Banner */}
      <div
        style={{
          marginTop: 16,
          padding: 16,
          borderRadius: 12,
          border: `2px solid ${results.warning.color}`,
          background: results.warning.bgColor,
        }}
      >
        <div style={{ fontWeight: 900, fontSize: 16, color: results.warning.color, marginBottom: 8 }}>
          {results.warning.level === 'info' && '✅ '}
          {results.warning.level === 'caution' && '⚠️ '}
          {results.warning.level === 'warning' && '⚠️ '}
          {results.warning.level === 'danger' && '⛔ '}
          {results.warning.level.toUpperCase()}
        </div>
        <div style={{ fontSize: 14, color: results.warning.color }}>
          {results.warning.message}
        </div>
      </div>

      {/* Performance Impact */}
      <div
        style={{
          marginTop: 16,
          border: '1px solid #ddd',
          borderRadius: 12,
          padding: 16,
        }}
      >
        <h3 style={{ marginTop: 0 }}>Estimated Performance Impact</h3>
        <p style={{ fontSize: 12, opacity: 0.8, marginTop: -8 }}>
          Approximations only — always verify with POH performance charts for your specific aircraft.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginTop: 12 }}>
          <div
            style={{
              padding: 12,
              borderRadius: 8,
              border: '1px solid #e5e7eb',
              background: '#fafafa',
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.8 }}>Overall Performance</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#dc2626' }}>
              -{results.perfDegradation}%
            </div>
          </div>

          <div
            style={{
              padding: 12,
              borderRadius: 8,
              border: '1px solid #e5e7eb',
              background: '#fafafa',
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.8 }}>Takeoff Roll Increase</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#dc2626' }}>
              +{results.takeoffRollIncrease}%
            </div>
          </div>

          <div
            style={{
              padding: 12,
              borderRadius: 8,
              border: '1px solid #e5e7eb',
              background: '#fafafa',
            }}
          >
            <div style={{ fontSize: 12, opacity: 0.8 }}>Climb Rate Decrease</div>
            <div style={{ fontSize: 24, fontWeight: 900, color: '#dc2626' }}>
              -{results.climbRateDecrease}%
            </div>
          </div>
        </div>

        <div
          style={{
            marginTop: 16,
            padding: 12,
            borderRadius: 8,
            background: '#fef3c7',
            border: '1px solid #fbbf24',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 800 }}>📋 Pilot Action Items:</div>
          <ul style={{ margin: '8px 0 0 20px', fontSize: 13 }}>
            <li>Verify runway length is adequate for increased takeoff roll</li>
            <li>Consider reducing weight if near max gross</li>
            <li>Plan for reduced climb performance over obstacles</li>
            <li>Use POH charts with actual DA, not pressure altitude</li>
            <li>Lean mixture properly for altitude (if applicable)</li>
          </ul>
        </div>
      </div>

      {/* Educational Footer */}
      <div style={{ marginTop: 16, fontSize: 12, opacity: 0.75, fontStyle: 'italic' }}>
        <strong>Note:</strong> Density altitude combines the effects of altitude, temperature, and humidity
        into a single number representing how the air "feels" to the aircraft. Higher DA = thinner air =
        reduced engine power, propeller efficiency, and wing lift. This calculator uses the standard formula
        DA = PA + 120(T - ISA). Always cross-check with POH performance charts.
      </div>

      {/* ===== TAKEOFF DISTANCE CALCULATOR ===== */}
      <div style={{ marginTop: 32, paddingTop: 24, borderTop: '2px solid #e5e7eb' }}>
        <h2 style={{ marginTop: 0 }}>Takeoff Distance Calculator</h2>
        <p style={{ marginTop: 4, opacity: 0.8, fontSize: 14 }}>
          Enter POH baseline distances and current conditions. Includes industry-standard corrections and 1.5× safety margin.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
          {/* Inputs */}
          <div style={{ border: '1px solid #ddd', borderRadius: 12, padding: 16 }}>
            <h3 style={{ marginTop: 0, fontSize: 16 }}>Inputs</h3>

            <div style={{ marginBottom: 12 }}>
              <label htmlFor="to-poh-ground" style={{ fontSize: 13, fontWeight: 700 }}>
                POH Ground Roll (ft)
              </label>
              <input
                id="to-poh-ground"
                type="number"
                value={toPohGroundRoll}
                onChange={(e) => setToPohGroundRoll(e.target.value)}
                style={{ width: '100%', padding: 8, borderRadius: 8, marginTop: 4, border: '1px solid #ddd' }}
                placeholder="e.g., 1200"
              />
              <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>
                From POH at current DA and weight
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label htmlFor="to-poh-50ft" style={{ fontSize: 13, fontWeight: 700 }}>
                POH Distance Over 50ft (ft)
              </label>
              <input
                id="to-poh-50ft"
                type="number"
                value={toPohOver50ft}
                onChange={(e) => setToPohOver50ft(e.target.value)}
                style={{ width: '100%', padding: 8, borderRadius: 8, marginTop: 4, border: '1px solid #ddd' }}
                placeholder="e.g., 2000"
              />
            </div>

            <hr style={{ margin: '16px 0', opacity: 0.3 }} />

            <div style={{ marginBottom: 12 }}>
              <label htmlFor="to-wind" style={{ fontSize: 13, fontWeight: 700 }}>
                Wind Component (kt)
              </label>
              <input
                id="to-wind"
                type="number"
                value={toWind}
                onChange={(e) => setToWind(e.target.value)}
                style={{ width: '100%', padding: 8, borderRadius: 8, marginTop: 4, border: '1px solid #ddd' }}
                placeholder="Positive = headwind, Negative = tailwind"
              />
              <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>
                + for headwind, - for tailwind
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label htmlFor="to-runway-type" style={{ fontSize: 13, fontWeight: 700 }}>
                  Runway Type
                </label>
                <select
                  id="to-runway-type"
                  value={toRunwayType}
                  onChange={(e) => setToRunwayType(e.target.value as 'paved' | 'grass' | 'gravel')}
                  style={{ width: '100%', padding: 8, borderRadius: 8, marginTop: 4, border: '1px solid #ddd' }}
                >
                  <option value="paved">Paved</option>
                  <option value="grass">Grass</option>
                  <option value="gravel">Gravel</option>
                </select>
              </div>

              <div>
                <label htmlFor="to-runway-condition" style={{ fontSize: 13, fontWeight: 700 }}>
                  Condition
                </label>
                <select
                  id="to-runway-condition"
                  value={toRunwayCondition}
                  onChange={(e) => setToRunwayCondition(e.target.value as 'dry' | 'wet')}
                  style={{ width: '100%', padding: 8, borderRadius: 8, marginTop: 4, border: '1px solid #ddd' }}
                >
                  <option value="dry">Dry</option>
                  <option value="wet">Wet</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label htmlFor="to-slope" style={{ fontSize: 13, fontWeight: 700 }}>
                Runway Slope (%)
              </label>
              <input
                id="to-slope"
                type="number"
                step="0.1"
                value={toRunwaySlope}
                onChange={(e) => setToRunwaySlope(e.target.value)}
                style={{ width: '100%', padding: 8, borderRadius: 8, marginTop: 4, border: '1px solid #ddd' }}
                placeholder="e.g., 1.0"
              />
              <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>
                + for upslope, - for downslope
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label htmlFor="to-humidity" style={{ fontSize: 13, fontWeight: 700 }}>
                Humidity
              </label>
              <select
                id="to-humidity"
                value={toHumidity}
                onChange={(e) => setToHumidity(e.target.value as 'normal' | 'high')}
                style={{ width: '100%', padding: 8, borderRadius: 8, marginTop: 4, border: '1px solid #ddd' }}
              >
                <option value="normal">Normal</option>
                <option value="high">High (&gt;70%)</option>
              </select>
            </div>

            <hr style={{ margin: '16px 0', opacity: 0.3 }} />

            <div style={{ marginBottom: 0 }}>
              <label htmlFor="to-runway-length" style={{ fontSize: 13, fontWeight: 700 }}>
                Available Runway Length (ft) - Optional
              </label>
              <input
                id="to-runway-length"
                type="number"
                value={toRunwayLength}
                onChange={(e) => setToRunwayLength(e.target.value)}
                style={{ width: '100%', padding: 8, borderRadius: 8, marginTop: 4, border: '1px solid #ddd' }}
                placeholder="For safety assessment"
              />
            </div>
          </div>

          {/* Results */}
          <div style={{ border: '1px solid #ddd', borderRadius: 12, padding: 16 }}>
            <h3 style={{ marginTop: 0, fontSize: 16 }}>Results</h3>

            <div
              style={{
                padding: 12,
                borderRadius: 8,
                background: '#dbeafe',
                border: '1px solid #93c5fd',
                marginBottom: 12,
              }}
            >
              <div style={{ fontSize: 11, opacity: 0.8, fontWeight: 700 }}>GROUND ROLL REQUIRED</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#1e40af' }}>
                {takeoffResults.groundRoll.toLocaleString()} ft
              </div>
              <div style={{ fontSize: 11, marginTop: 4, opacity: 0.8 }}>
                Baseline: {takeoffResults.baselineGroundRoll} ft
              </div>
            </div>

            <div
              style={{
                padding: 12,
                borderRadius: 8,
                background: '#fef3c7',
                border: '2px solid #fbbf24',
                marginBottom: 16,
              }}
            >
              <div style={{ fontSize: 11, opacity: 0.8, fontWeight: 700 }}>DISTANCE OVER 50FT OBSTACLE</div>
              <div style={{ fontSize: 32, fontWeight: 900, color: '#92400e' }}>
                {takeoffResults.over50ft.toLocaleString()} ft
              </div>
              <div style={{ fontSize: 11, marginTop: 4, opacity: 0.8 }}>
                Baseline: {takeoffResults.baselineOver50ft} ft
              </div>
            </div>

            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Corrections Applied:</div>
            {takeoffResults.corrections.length === 0 ? (
              <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 12 }}>
                None (standard conditions)
              </div>
            ) : (
              <div style={{ fontSize: 12, marginBottom: 12 }}>
                {takeoffResults.corrections.map((corr, i) => (
                  <div key={i} style={{ marginBottom: 4 }}>
                    • <strong>{corr.factor}:</strong> {corr.description} (×{corr.multiplier.toFixed(2)})
                  </div>
                ))}
              </div>
            )}
            <div style={{ fontSize: 12, marginBottom: 12 }}>
              • <strong>Safety Margin:</strong> ×{takeoffResults.safetyMargin} (AOPA recommended)
            </div>

            {/* Runway Safety Assessment */}
            {toRunwayLength && Number(toRunwayLength) > 0 && (
              <div
                style={{
                  marginTop: 16,
                  padding: 12,
                  borderRadius: 8,
                  border: `2px solid ${takeoffSafety.color}`,
                  background: takeoffSafety.bgColor,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 900, color: takeoffSafety.color }}>
                  {takeoffSafety.message}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Important Notes */}
        <div
          style={{
            marginTop: 16,
            padding: 12,
            borderRadius: 8,
            background: '#fef2f2',
            border: '1px solid #fca5a5',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 800, color: '#dc2626', marginBottom: 6 }}>
            ⚠️ IMPORTANT ASSUMPTIONS
          </div>
          <ul style={{ margin: '0 0 0 20px', padding: 0, fontSize: 11, color: '#991b1b' }}>
            <li>POH distances assume new engine and optimal technique</li>
            <li>Actual performance typically 10-15% worse than published</li>
            <li>This provides MINIMUM distances - actual conditions may vary</li>
            <li>Always verify runway length and obstacles before flight</li>
            <li>Consult POH performance charts for your specific aircraft</li>
          </ul>
        </div>
      </div>

      {/* ===== LANDING DISTANCE CALCULATOR ===== */}
      <div style={{ marginTop: 32, paddingTop: 24, borderTop: '2px solid #e5e7eb' }}>
        <h2 style={{ marginTop: 0 }}>Landing Distance Calculator</h2>
        <p style={{ marginTop: 4, opacity: 0.8, fontSize: 14 }}>
          Enter POH baseline distances and current conditions. Wet runway penalty is significantly higher for landing.
        </p>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
          {/* Inputs */}
          <div style={{ border: '1px solid #ddd', borderRadius: 12, padding: 16 }}>
            <h3 style={{ marginTop: 0, fontSize: 16 }}>Inputs</h3>

            <div style={{ marginBottom: 12 }}>
              <label htmlFor="land-poh-ground" style={{ fontSize: 13, fontWeight: 700 }}>
                POH Ground Roll (ft)
              </label>
              <input
                id="land-poh-ground"
                type="number"
                value={landPohGroundRoll}
                onChange={(e) => setLandPohGroundRoll(e.target.value)}
                style={{ width: '100%', padding: 8, borderRadius: 8, marginTop: 4, border: '1px solid #ddd' }}
                placeholder="e.g., 600"
              />
              <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>
                From POH at landing weight and DA
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label htmlFor="land-poh-50ft" style={{ fontSize: 13, fontWeight: 700 }}>
                POH Distance Over 50ft (ft)
              </label>
              <input
                id="land-poh-50ft"
                type="number"
                value={landPohOver50ft}
                onChange={(e) => setLandPohOver50ft(e.target.value)}
                style={{ width: '100%', padding: 8, borderRadius: 8, marginTop: 4, border: '1px solid #ddd' }}
                placeholder="e.g., 1300"
              />
            </div>

            <hr style={{ margin: '16px 0', opacity: 0.3 }} />

            <div style={{ marginBottom: 12 }}>
              <label htmlFor="land-wind" style={{ fontSize: 13, fontWeight: 700 }}>
                Wind Component (kt)
              </label>
              <input
                id="land-wind"
                type="number"
                value={landWind}
                onChange={(e) => setLandWind(e.target.value)}
                style={{ width: '100%', padding: 8, borderRadius: 8, marginTop: 4, border: '1px solid #ddd' }}
                placeholder="Positive = headwind, Negative = tailwind"
              />
              <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>
                + for headwind, - for tailwind
              </div>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 12 }}>
              <div>
                <label htmlFor="land-runway-type" style={{ fontSize: 13, fontWeight: 700 }}>
                  Runway Type
                </label>
                <select
                  id="land-runway-type"
                  value={landRunwayType}
                  onChange={(e) => setLandRunwayType(e.target.value as 'paved' | 'grass' | 'gravel')}
                  style={{ width: '100%', padding: 8, borderRadius: 8, marginTop: 4, border: '1px solid #ddd' }}
                >
                  <option value="paved">Paved</option>
                  <option value="grass">Grass</option>
                  <option value="gravel">Gravel</option>
                </select>
              </div>

              <div>
                <label htmlFor="land-runway-condition" style={{ fontSize: 13, fontWeight: 700 }}>
                  Condition
                </label>
                <select
                  id="land-runway-condition"
                  value={landRunwayCondition}
                  onChange={(e) => setLandRunwayCondition(e.target.value as 'dry' | 'wet')}
                  style={{ width: '100%', padding: 8, borderRadius: 8, marginTop: 4, border: '1px solid #ddd' }}
                >
                  <option value="dry">Dry</option>
                  <option value="wet">Wet (+35% paved, +60% grass)</option>
                </select>
              </div>
            </div>

            <div style={{ marginBottom: 12 }}>
              <label htmlFor="land-slope" style={{ fontSize: 13, fontWeight: 700 }}>
                Runway Slope (%)
              </label>
              <input
                id="land-slope"
                type="number"
                step="0.1"
                value={landRunwaySlope}
                onChange={(e) => setLandRunwaySlope(e.target.value)}
                style={{ width: '100%', padding: 8, borderRadius: 8, marginTop: 4, border: '1px solid #ddd' }}
                placeholder="e.g., 1.0"
              />
              <div style={{ fontSize: 11, opacity: 0.7, marginTop: 2 }}>
                + upslope helps, - downslope hurts
              </div>
            </div>

            <hr style={{ margin: '16px 0', opacity: 0.3 }} />

            <div style={{ marginBottom: 0 }}>
              <label htmlFor="land-runway-length" style={{ fontSize: 13, fontWeight: 700 }}>
                Available Runway Length (ft) - Optional
              </label>
              <input
                id="land-runway-length"
                type="number"
                value={landRunwayLength}
                onChange={(e) => setLandRunwayLength(e.target.value)}
                style={{ width: '100%', padding: 8, borderRadius: 8, marginTop: 4, border: '1px solid #ddd' }}
                placeholder="For safety assessment"
              />
            </div>
          </div>

          {/* Results */}
          <div style={{ border: '1px solid #ddd', borderRadius: 12, padding: 16 }}>
            <h3 style={{ marginTop: 0, fontSize: 16 }}>Results</h3>

            <div
              style={{
                padding: 12,
                borderRadius: 8,
                background: '#dbeafe',
                border: '1px solid #93c5fd',
                marginBottom: 12,
              }}
            >
              <div style={{ fontSize: 11, opacity: 0.8, fontWeight: 700 }}>GROUND ROLL REQUIRED</div>
              <div style={{ fontSize: 28, fontWeight: 900, color: '#1e40af' }}>
                {landingResults.groundRoll.toLocaleString()} ft
              </div>
              <div style={{ fontSize: 11, marginTop: 4, opacity: 0.8 }}>
                Baseline: {landingResults.baselineGroundRoll} ft
              </div>
            </div>

            <div
              style={{
                padding: 12,
                borderRadius: 8,
                background: '#fef3c7',
                border: '2px solid #fbbf24',
                marginBottom: 16,
              }}
            >
              <div style={{ fontSize: 11, opacity: 0.8, fontWeight: 700 }}>DISTANCE OVER 50FT OBSTACLE</div>
              <div style={{ fontSize: 32, fontWeight: 900, color: '#92400e' }}>
                {landingResults.over50ft.toLocaleString()} ft
              </div>
              <div style={{ fontSize: 11, marginTop: 4, opacity: 0.8 }}>
                Baseline: {landingResults.baselineOver50ft} ft
              </div>
            </div>

            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 8 }}>Corrections Applied:</div>
            {landingResults.corrections.length === 0 ? (
              <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 12 }}>
                None (standard conditions)
              </div>
            ) : (
              <div style={{ fontSize: 12, marginBottom: 12 }}>
                {landingResults.corrections.map((corr, i) => (
                  <div key={i} style={{ marginBottom: 4 }}>
                    • <strong>{corr.factor}:</strong> {corr.description} (×{corr.multiplier.toFixed(2)})
                  </div>
                ))}
              </div>
            )}
            <div style={{ fontSize: 12, marginBottom: 12 }}>
              • <strong>Safety Margin:</strong> ×{landingResults.safetyMargin} (AOPA recommended)
            </div>

            {/* Runway Safety Assessment */}
            {landRunwayLength && Number(landRunwayLength) > 0 && (
              <div
                style={{
                  marginTop: 16,
                  padding: 12,
                  borderRadius: 8,
                  border: `2px solid ${landingSafety.color}`,
                  background: landingSafety.bgColor,
                }}
              >
                <div style={{ fontSize: 12, fontWeight: 900, color: landingSafety.color }}>
                  {landingSafety.message}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Important Notes */}
        <div
          style={{
            marginTop: 16,
            padding: 12,
            borderRadius: 8,
            background: '#fef2f2',
            border: '1px solid #fca5a5',
          }}
        >
          <div style={{ fontSize: 12, fontWeight: 800, color: '#dc2626', marginBottom: 6 }}>
            ⚠️ CRITICAL LANDING FACTORS
          </div>
          <ul style={{ margin: '0 0 0 20px', padding: 0, fontSize: 11, color: '#991b1b' }}>
            <li>WET RUNWAY: +35% paved, +60% grass - plan conservatively</li>
            <li>Approach speed discipline critical - excess speed drastically increases distance</li>
            <li>Downslope runway significantly increases landing roll (+22% per 1% grade)</li>
            <li>Tailwind is 3-5× more detrimental than headwind is beneficial</li>
            <li>If using &gt;70% of available runway, consider alternate airport</li>
          </ul>
        </div>
      </div>

      {/* Continue Button */}
      <div
        style={{
          marginTop: 32,
          paddingTop: 24,
          borderTop: '2px solid #e2e8f0',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
        }}
      >
        <div style={{ fontSize: 14, color: '#64748b' }}>
          {currentSession && (
            <div>
              Flight Plan: <strong>{currentSession.name}</strong>
            </div>
          )}
        </div>
        <button
          onClick={() => {
            completeStep('performance');
            navigate('/weather');
          }}
          style={{
            padding: '12px 32px',
            background: '#2563eb',
            color: '#fff',
            border: 'none',
            borderRadius: 8,
            fontWeight: 700,
            fontSize: 16,
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.background = '#1e40af';
            e.currentTarget.style.transform = 'translateY(-1px)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.background = '#2563eb';
            e.currentTarget.style.transform = 'translateY(0)';
          }}
        >
          Continue to Weather →
        </button>
      </div>
    </div>
  );
}
