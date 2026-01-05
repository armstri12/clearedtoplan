import { useEffect, useState } from 'react';
import { useFlightSession } from '../../context/FlightSessionContext';
import { AirportSelector } from '../../components/AirportSelector';
import { getMetar, type MetarData } from '../../services/aviationApi';
import { airportClient } from '../../services/supabaseClient';
import type { Airport, Runway, RunwayWithWind } from '../../services/supabaseClient';

// Standard atmosphere constants
const ISA_SEA_LEVEL_TEMP_C = 15;
const ISA_LAPSE_RATE = 1.98;

function calculateISATemp(pressureAltFt: number): number {
  return ISA_SEA_LEVEL_TEMP_C - (ISA_LAPSE_RATE * (pressureAltFt / 1000));
}

function calculateDensityAltitude(pressureAltFt: number, tempC: number): number {
  const isaTemp = calculateISATemp(pressureAltFt);
  const tempDifference = tempC - isaTemp;
  return Math.round(pressureAltFt + (120 * tempDifference));
}

function calculatePressureAltitude(fieldElevationFt: number, altimeterInHg: number): number {
  const correction = (29.92 - altimeterInHg) * 1000;
  return Math.round(fieldElevationFt + correction);
}

type Tab = 'density-altitude' | 'takeoff' | 'landing';

export default function PerformancePageV2() {
  const { currentSession, completeStep } = useFlightSession();
  const [activeTab, setActiveTab] = useState<Tab>('density-altitude');

  const [airport, setAirport] = useState<Airport | null>(null);
  const [runways, setRunways] = useState<RunwayWithWind[]>([]);
  const [selectedRunway, setSelectedRunway] = useState<Runway | null>(null);
  const [isLoadingRunways, setIsLoadingRunways] = useState(false);

  const [metar, setMetar] = useState<MetarData | null>(null);
  const [isLoadingMetar, setIsLoadingMetar] = useState(false);

  const [altimeter, setAltimeter] = useState<string>('29.92');
  const [temperature, setTemperature] = useState<string>('15');

  useEffect(() => {
    if (!currentSession) return;
    if (!currentSession.completed.performance) {
      completeStep('performance');
    }
  }, [completeStep, currentSession]);

  // Fetch METAR when airport selected
  useEffect(() => {
    if (!airport) {
      setMetar(null);
      return;
    }

    async function fetchMetar() {
      setIsLoadingMetar(true);
      try {
        const data = await getMetar(airport!.icao);
        setMetar(data);

        if (data?.altimeter) {
          setAltimeter(data.altimeter.toFixed(2));
        }
        if (data?.temperature !== undefined) {
          setTemperature(data.temperature.toString());
        }
      } catch (error) {
        console.error('Error fetching METAR:', error);
        setMetar(null);
      } finally {
        setIsLoadingMetar(false);
      }
    }

    fetchMetar();
  }, [airport]);

  // Fetch runways when airport or wind changes
  useEffect(() => {
    if (!airport) {
      setRunways([]);
      setSelectedRunway(null);
      return;
    }

    async function fetchRunways() {
      setIsLoadingRunways(true);

      try {
        const fetchedRunways = await airportClient.getRunways(airport!.icao);

        if (fetchedRunways.length === 0) {
          setRunways([]);
          setSelectedRunway(null);
          return;
        }

        const windDir = metar?.wind?.direction ?? null;
        const windSpeed = metar?.wind?.speed ?? null;

        let runwaysWithWind: RunwayWithWind[];
        if (windDir !== null && windSpeed !== null) {
          runwaysWithWind = airportClient.calculateWindComponents(
            fetchedRunways,
            windDir,
            windSpeed
          );
          runwaysWithWind = airportClient.rankRunwaysByWind(runwaysWithWind);
        } else {
          runwaysWithWind = fetchedRunways.map(rwy => ({
            ...rwy,
            headwind: null,
            crosswind: null,
          }));
        }

        setRunways(runwaysWithWind);

        if (!selectedRunway && runwaysWithWind.length > 0) {
          setSelectedRunway(runwaysWithWind[0]);
        }
      } catch (err) {
        console.error('Error fetching runways:', err);
        setRunways([]);
        setSelectedRunway(null);
      } finally {
        setIsLoadingRunways(false);
      }
    }

    fetchRunways();
  }, [airport, metar?.wind?.direction, metar?.wind?.speed]);

  const elevationFt = airport?.elevationFt ?? 0;
  const altimeterValue = parseFloat(altimeter) || 29.92;
  const tempC = parseFloat(temperature) || 15;

  const pressureAlt = calculatePressureAltitude(elevationFt, altimeterValue);
  const densityAlt = calculateDensityAltitude(pressureAlt, tempC);

  const windDir = metar?.wind?.direction ?? null;
  const windSpeed = metar?.wind?.speed ?? null;

  const tabs = [
    { id: 'density-altitude' as Tab, label: 'Density Altitude' },
    { id: 'takeoff' as Tab, label: 'Takeoff' },
    { id: 'landing' as Tab, label: 'Landing' },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold text-gray-900 mb-3">Performance Planning</h1>
        <p className="text-lg text-gray-600">
          Calculate takeoff and landing performance based on actual airport and weather data
        </p>
      </div>

      {/* Main Grid */}
      <div className="grid lg:grid-cols-3 gap-6">
        {/* Left Column - Airport & Weather */}
        <div className="lg:col-span-1 space-y-6">
          {/* Airport Selection */}
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Airport</h2>
            <AirportSelector
              selectedAirport={airport}
              onSelect={setAirport}
              label=""
              placeholder="ICAO (e.g., KJFK)"
            />
          </div>

          {/* Weather Card */}
          {metar && (
            <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl shadow-lg border border-blue-200 p-6">
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-lg font-bold text-gray-900">Current Weather</h3>
                {isLoadingMetar && (
                  <span className="text-xs text-blue-600">Updating...</span>
                )}
              </div>

              {/* Wind Display */}
              {metar.wind && (
                <div className="bg-white rounded-lg p-4 mb-4 border border-blue-100">
                  <div className="text-sm font-semibold text-gray-700 mb-2">Wind</div>
                  <div className="flex items-baseline gap-3">
                    <div className="text-3xl font-bold text-blue-900">
                      {metar.wind.direction}°
                    </div>
                    <div className="text-2xl font-semibold text-blue-700">
                      @ {metar.wind.speed} kt
                    </div>
                  </div>
                  {metar.wind.gust && (
                    <div className="text-sm text-orange-600 mt-1">
                      Gusts to {metar.wind.gust} kt
                    </div>
                  )}
                </div>
              )}

              {/* Temperature & Altimeter */}
              <div className="grid grid-cols-2 gap-3 mb-4">
                <div className="bg-white rounded-lg p-3 border border-blue-100">
                  <div className="text-xs text-gray-600 mb-1">Temperature</div>
                  <div className="text-2xl font-bold text-gray-900">{metar.temperature}°C</div>
                </div>
                <div className="bg-white rounded-lg p-3 border border-blue-100">
                  <div className="text-xs text-gray-600 mb-1">Altimeter</div>
                  <div className="text-2xl font-bold text-gray-900">
                    {metar.altimeter?.toFixed(2)}
                  </div>
                </div>
              </div>

              {/* Raw METAR */}
              <div className="bg-white rounded-lg p-3 border border-blue-100">
                <div className="text-xs font-semibold text-gray-700 mb-1">METAR</div>
                <div className="text-xs font-mono text-gray-600 leading-relaxed break-words">
                  {metar.raw}
                </div>
              </div>
            </div>
          )}

          {/* Runway Selection */}
          {airport && (
            <div className="bg-white rounded-xl shadow-lg border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-xl font-bold text-gray-900">Runways</h3>
                {windDir !== null && windSpeed !== null && (
                  <span className="text-xs text-green-600 font-medium">
                    ✓ Ranked by wind
                  </span>
                )}
              </div>

              {isLoadingRunways ? (
                <div className="text-center py-8 text-gray-400">Loading runways...</div>
              ) : runways.length === 0 ? (
                <div className="text-center py-8 text-gray-400">No runways found</div>
              ) : (
                <div className="space-y-3 max-h-96 overflow-y-auto">
                  {runways.map((runway) => {
                    const isSelected = selectedRunway?.identifier === runway.identifier;
                    const hasWind = runway.headwind !== null && runway.crosswind !== null;

                    return (
                      <button
                        key={`${runway.airportIcao}-${runway.identifier}`}
                        onClick={() => setSelectedRunway(runway)}
                        className={`w-full text-left rounded-lg border-2 p-4 transition-all ${
                          isSelected
                            ? 'border-blue-500 bg-blue-50 shadow-md'
                            : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm'
                        }`}
                      >
                        <div className="flex justify-between items-start mb-2">
                          <div>
                            <div className="text-xl font-bold text-gray-900">
                              Runway {runway.identifier}
                            </div>
                            {runway.headingDeg && (
                              <div className="text-sm text-gray-500">
                                Heading {runway.headingDeg}°
                              </div>
                            )}
                          </div>
                          {isSelected && (
                            <svg className="w-6 h-6 text-blue-600 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                            </svg>
                          )}
                        </div>

                        <div className="text-sm text-gray-600 space-y-1">
                          {runway.lengthFt && (
                            <div>Length: {runway.lengthFt.toLocaleString()} ft × {runway.widthFt} ft</div>
                          )}
                          {runway.surface && (
                            <div>Surface: <span className="uppercase font-medium">{runway.surface}</span></div>
                          )}
                        </div>

                        {hasWind && (
                          <div className="mt-3 pt-3 border-t border-gray-200">
                            <div className="grid grid-cols-2 gap-2">
                              <div className={`text-sm ${runway.headwind! >= 0 ? 'text-green-700 font-semibold' : 'text-red-700 font-semibold'}`}>
                                {runway.headwind! >= 0 ? '↑' : '↓'} Headwind: {Math.round(runway.headwind!)} kt
                              </div>
                              <div className={`text-sm ${Math.abs(runway.crosswind!) > 10 ? 'text-orange-600 font-semibold' : 'text-gray-600'}`}>
                                ↔ Crosswind: {Math.round(Math.abs(runway.crosswind!))} kt
                              </div>
                            </div>
                          </div>
                        )}
                      </button>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right Column - Tabs */}
        <div className="lg:col-span-2">
          <div className="bg-white rounded-xl shadow-lg border border-gray-200 overflow-hidden">
            {/* Tab Headers */}
            <div className="border-b border-gray-200 bg-gray-50">
              <nav className="flex">
                {tabs.map((tab) => (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex-1 py-4 px-6 text-base font-semibold border-b-4 transition-all ${
                      activeTab === tab.id
                        ? 'border-blue-600 text-blue-600 bg-white'
                        : 'border-transparent text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                    }`}
                  >
                    {tab.label}
                  </button>
                ))}
              </nav>
            </div>

            {/* Tab Content */}
            <div className="p-8">
              {activeTab === 'density-altitude' && (
                <DensityAltitudeTab
                  airport={airport}
                  metar={metar}
                  altimeter={altimeter}
                  setAltimeter={setAltimeter}
                  temperature={temperature}
                  setTemperature={setTemperature}
                  elevationFt={elevationFt}
                  pressureAlt={pressureAlt}
                  densityAlt={densityAlt}
                />
              )}

              {activeTab === 'takeoff' && (
                <TakeoffTab
                  airport={airport}
                  runway={selectedRunway}
                  densityAlt={densityAlt}
                />
              )}

              {activeTab === 'landing' && (
                <LandingTab
                  airport={airport}
                  runway={selectedRunway}
                  densityAlt={densityAlt}
                />
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================================
// DENSITY ALTITUDE TAB
// ============================================================================
interface DensityAltitudeTabProps {
  airport: Airport | null;
  metar: MetarData | null;
  altimeter: string;
  setAltimeter: (value: string) => void;
  temperature: string;
  setTemperature: (value: string) => void;
  elevationFt: number;
  pressureAlt: number;
  densityAlt: number;
}

function DensityAltitudeTab({
  airport,
  metar,
  altimeter,
  setAltimeter,
  temperature,
  setTemperature,
  elevationFt,
  pressureAlt,
  densityAlt,
}: DensityAltitudeTabProps) {
  if (!airport) {
    return (
      <div className="text-center py-16">
        <div className="text-6xl mb-4">🛩️</div>
        <p className="text-xl text-gray-500">Select an airport to calculate density altitude</p>
      </div>
    );
  }

  const warning = getDensityAltitudeWarning(densityAlt);

  return (
    <div className="space-y-8">
      {/* Manual Override Inputs */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Conditions</h3>
        <div className="grid md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Altimeter Setting (inHg)
              {metar?.altimeter && <span className="ml-2 text-xs text-blue-600 font-normal">(from METAR)</span>}
            </label>
            <input
              type="number"
              step="0.01"
              value={altimeter}
              onChange={(e) => setAltimeter(e.target.value)}
              className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-2">
              Temperature (°C)
              {metar?.temperature !== undefined && <span className="ml-2 text-xs text-blue-600 font-normal">(from METAR)</span>}
            </label>
            <input
              type="number"
              step="1"
              value={temperature}
              onChange={(e) => setTemperature(e.target.value)}
              className="w-full px-4 py-3 text-lg border-2 border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
        </div>
      </div>

      {/* Results */}
      <div>
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Calculated Altitudes</h3>
        <div className="grid md:grid-cols-3 gap-4">
          <div className="bg-gradient-to-br from-gray-50 to-gray-100 rounded-xl p-6 border-2 border-gray-200">
            <div className="text-sm font-semibold text-gray-600 mb-2">Field Elevation</div>
            <div className="text-4xl font-bold text-gray-900">
              {elevationFt.toLocaleString()}
            </div>
            <div className="text-sm text-gray-500 mt-1">ft MSL</div>
          </div>

          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-xl p-6 border-2 border-blue-200">
            <div className="text-sm font-semibold text-blue-700 mb-2">Pressure Altitude</div>
            <div className="text-4xl font-bold text-blue-900">
              {pressureAlt.toLocaleString()}
            </div>
            <div className="text-sm text-blue-600 mt-1">ft</div>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-xl p-6 border-2 border-purple-200">
            <div className="text-sm font-semibold text-purple-700 mb-2">Density Altitude</div>
            <div className="text-4xl font-bold text-purple-900">
              {densityAlt.toLocaleString()}
            </div>
            <div className="text-sm text-purple-600 mt-1">ft</div>
          </div>
        </div>
      </div>

      {/* Warning */}
      <div
        className="rounded-xl p-6 border-l-4 shadow-md"
        style={{
          backgroundColor: warning.bgColor,
          borderLeftColor: warning.color,
        }}
      >
        <div className="flex items-start gap-3">
          <div className="text-2xl">{warning.icon}</div>
          <div className="flex-1">
            <div className="font-bold text-lg mb-1" style={{ color: warning.color }}>
              {warning.level.toUpperCase()}
            </div>
            <div className="text-sm leading-relaxed" style={{ color: warning.color }}>
              {warning.message}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function getDensityAltitudeWarning(densityAltFt: number) {
  if (densityAltFt < 3000) {
    return {
      level: 'info',
      message: 'Normal density altitude - standard performance expected.',
      color: '#059669',
      bgColor: '#ecfdf5',
      icon: 'ℹ️',
    };
  } else if (densityAltFt < 5000) {
    return {
      level: 'caution',
      message: 'Moderate density altitude - expect slight performance degradation (~5-10%).',
      color: '#d97706',
      bgColor: '#fffbeb',
      icon: '⚠️',
    };
  } else if (densityAltFt < 8000) {
    return {
      level: 'warning',
      message: 'High density altitude - expect significant performance degradation (10-20%). Longer takeoff roll, reduced climb rate.',
      color: '#ea580c',
      bgColor: '#fff7ed',
      icon: '⚠️',
    };
  } else {
    return {
      level: 'danger',
      message: 'CRITICAL density altitude - severe performance degradation (>20%). Exercise extreme caution. Consider delaying flight or reducing weight.',
      color: '#dc2626',
      bgColor: '#fef2f2',
      icon: '⛔',
    };
  }
}

// ============================================================================
// TAKEOFF TAB
// ============================================================================
interface TakeoffTabProps {
  airport: Airport | null;
  runway: Runway | null;
  densityAlt: number;
}

function TakeoffTab({ airport, runway, densityAlt }: TakeoffTabProps) {
  if (!airport || !runway) {
    return (
      <div className="text-center py-16">
        <div className="text-6xl mb-4">🛫</div>
        <p className="text-xl text-gray-500">Select an airport and runway for takeoff calculations</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-green-50 to-emerald-50 rounded-xl p-8 border-2 border-green-200">
        <h3 className="text-2xl font-bold text-gray-900 mb-4">
          Takeoff from Runway {runway.identifier}
        </h3>
        <div className="space-y-2 text-gray-700">
          <p className="text-lg"><strong>Airport:</strong> {airport.icao} - {airport.name}</p>
          <p className="text-lg"><strong>Runway Length:</strong> {runway.lengthFt?.toLocaleString()} ft</p>
          <p className="text-lg"><strong>Density Altitude:</strong> {densityAlt.toLocaleString()} ft</p>
        </div>
      </div>

      <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
        <div className="text-4xl mb-3">📊</div>
        <p className="text-lg text-gray-500">Takeoff performance calculations coming soon...</p>
        <p className="text-sm text-gray-400 mt-2">Will include takeoff distance, climb rate, and runway safety analysis</p>
      </div>
    </div>
  );
}

// ============================================================================
// LANDING TAB
// ============================================================================
interface LandingTabProps {
  airport: Airport | null;
  runway: Runway | null;
  densityAlt: number;
}

function LandingTab({ airport, runway, densityAlt }: LandingTabProps) {
  if (!airport || !runway) {
    return (
      <div className="text-center py-16">
        <div className="text-6xl mb-4">🛬</div>
        <p className="text-xl text-gray-500">Select an airport and runway for landing calculations</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl p-8 border-2 border-blue-200">
        <h3 className="text-2xl font-bold text-gray-900 mb-4">
          Landing on Runway {runway.identifier}
        </h3>
        <div className="space-y-2 text-gray-700">
          <p className="text-lg"><strong>Airport:</strong> {airport.icao} - {airport.name}</p>
          <p className="text-lg"><strong>Runway Length:</strong> {runway.lengthFt?.toLocaleString()} ft</p>
          <p className="text-lg"><strong>Density Altitude:</strong> {densityAlt.toLocaleString()} ft</p>
        </div>
      </div>

      <div className="text-center py-12 bg-gray-50 rounded-xl border-2 border-dashed border-gray-300">
        <div className="text-4xl mb-3">📊</div>
        <p className="text-lg text-gray-500">Landing performance calculations coming soon...</p>
        <p className="text-sm text-gray-400 mt-2">Will include landing distance and runway safety analysis</p>
      </div>
    </div>
  );
}
