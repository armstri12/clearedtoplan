import { useMemo, useState } from 'react';
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

export default function PerformancePage() {
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
                <label htmlFor="altimeter">Altimeter Setting (inHg)</label>
                <input
                  id="altimeter"
                  type="number"
                  step="0.01"
                  value={altimeter}
                  onChange={(e) => setAltimeter(e.target.value)}
                  style={{ width: '100%', padding: 8, borderRadius: 8, marginTop: 4 }}
                  placeholder="e.g. 29.92"
                />
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
    </div>
  );
}
