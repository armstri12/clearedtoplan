import { useEffect, useState } from 'react';
import { useFlightSession } from '../../context/FlightSessionContext';
import { AirportSelector } from '../../components/AirportSelector';
import { RunwaySelector } from '../../components/RunwaySelector';
import { getMetar, type MetarData } from '../../services/aviationApi';
import type { Airport, Runway } from '../../services/supabaseClient';

// Standard atmosphere constants
const ISA_SEA_LEVEL_TEMP_C = 15;
const ISA_LAPSE_RATE = 1.98; // °C per 1000 ft

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

  // Airport and runway selection
  const [airport, setAirport] = useState<Airport | null>(null);
  const [runway, setRunway] = useState<Runway | null>(null);

  // Weather data
  const [metar, setMetar] = useState<MetarData | null>(null);
  const [isLoadingMetar, setIsLoadingMetar] = useState(false);

  // Manual inputs (override METAR)
  const [altimeter, setAltimeter] = useState<string>('29.92');
  const [temperature, setTemperature] = useState<string>('15');

  useEffect(() => {
    if (!currentSession) return;
    if (!currentSession.completed.performance) {
      completeStep('performance');
    }
  }, [completeStep, currentSession]);

  // Auto-fetch METAR when airport selected
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

        // Auto-populate from METAR if available
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

  // Calculations
  const elevationFt = airport?.elevationFt ?? 0;
  const altimeterValue = parseFloat(altimeter) || 29.92;
  const tempC = parseFloat(temperature) || 15;

  const pressureAlt = calculatePressureAltitude(elevationFt, altimeterValue);
  const densityAlt = calculateDensityAltitude(pressureAlt, tempC);

  // Wind data from METAR
  const windDir = metar?.wind?.direction ?? null;
  const windSpeed = metar?.wind?.speed ?? null;

  const tabs = [
    { id: 'density-altitude' as Tab, label: 'Density Altitude' },
    { id: 'takeoff' as Tab, label: 'Takeoff' },
    { id: 'landing' as Tab, label: 'Landing' },
  ];

  return (
    <div className="max-w-6xl mx-auto p-6 space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Performance Planning</h1>
        <p className="text-gray-600 mt-2">
          Calculate takeoff and landing performance for your departure and arrival airports
        </p>
      </div>

      {/* Airport Selection */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <h2 className="text-xl font-semibold text-gray-900 mb-4">Airport Selection</h2>

        <div className="grid md:grid-cols-2 gap-6">
          <AirportSelector
            selectedAirport={airport}
            onSelect={setAirport}
            label="Airport"
            placeholder="Enter ICAO (e.g., KJFK)"
          />

          {metar && (
            <div className="bg-gray-50 rounded-md p-4">
              <div className="text-sm font-medium text-gray-700 mb-2">Current METAR</div>
              <div className="text-xs font-mono text-gray-600 break-words">
                {metar.raw}
              </div>
              {isLoadingMetar && (
                <div className="text-xs text-gray-500 mt-2">Updating...</div>
              )}
            </div>
          )}
        </div>

        {airport && (
          <div className="mt-6">
            <RunwaySelector
              airportIcao={airport.icao}
              windDirection={windDir}
              windSpeed={windSpeed}
              selectedRunway={runway}
              onSelect={setRunway}
            />
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {/* Tab Headers */}
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`py-4 px-6 text-sm font-medium border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-600 text-blue-600'
                    : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
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
              runway={runway}
              densityAlt={densityAlt}
              windDir={windDir}
              windSpeed={windSpeed}
            />
          )}

          {activeTab === 'landing' && (
            <LandingTab
              airport={airport}
              runway={runway}
              densityAlt={densityAlt}
              windDir={windDir}
              windSpeed={windSpeed}
            />
          )}
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
      <div className="text-center py-12 text-gray-500">
        <p className="text-lg">Select an airport to calculate density altitude</p>
      </div>
    );
  }

  const warning = getDensityAltitudeWarning(densityAlt);

  return (
    <div className="space-y-6">
      {/* Inputs */}
      <div className="grid md:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Altimeter Setting (inHg)
            {metar?.altimeter && <span className="ml-2 text-xs text-blue-600">(from METAR)</span>}
          </label>
          <input
            type="number"
            step="0.01"
            value={altimeter}
            onChange={(e) => setAltimeter(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">
            Temperature (°C)
            {metar?.temperature !== undefined && <span className="ml-2 text-xs text-blue-600">(from METAR)</span>}
          </label>
          <input
            type="number"
            step="1"
            value={temperature}
            onChange={(e) => setTemperature(e.target.value)}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>
      </div>

      {/* Results */}
      <div className="grid md:grid-cols-3 gap-4">
        <div className="bg-gray-50 rounded-lg p-4">
          <div className="text-sm text-gray-600">Field Elevation</div>
          <div className="text-3xl font-bold text-gray-900 mt-1">
            {elevationFt.toLocaleString()} ft
          </div>
        </div>

        <div className="bg-blue-50 rounded-lg p-4">
          <div className="text-sm text-blue-600">Pressure Altitude</div>
          <div className="text-3xl font-bold text-blue-900 mt-1">
            {pressureAlt.toLocaleString()} ft
          </div>
        </div>

        <div className="bg-purple-50 rounded-lg p-4">
          <div className="text-sm text-purple-600">Density Altitude</div>
          <div className="text-3xl font-bold text-purple-900 mt-1">
            {densityAlt.toLocaleString()} ft
          </div>
        </div>
      </div>

      {/* Warning */}
      <div
        className="rounded-lg p-4 border-l-4"
        style={{
          backgroundColor: warning.bgColor,
          borderLeftColor: warning.color,
          color: warning.color,
        }}
      >
        <div className="font-semibold mb-1">{warning.level.toUpperCase()}</div>
        <div className="text-sm">{warning.message}</div>
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

// ============================================================================
// TAKEOFF TAB (Placeholder)
// ============================================================================
interface TakeoffTabProps {
  airport: Airport | null;
  runway: Runway | null;
  densityAlt: number;
  windDir: number | null;
  windSpeed: number | null;
}

function TakeoffTab({ airport, runway, densityAlt }: TakeoffTabProps) {
  if (!airport || !runway) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-lg">Select an airport and runway to calculate takeoff performance</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-blue-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Takeoff from Runway {runway.identifier}
        </h3>
        <div className="text-sm text-gray-600">
          <p>Airport: {airport.icao} - {airport.name}</p>
          <p>Runway Length: {runway.lengthFt?.toLocaleString()} ft</p>
          <p>Density Altitude: {densityAlt.toLocaleString()} ft</p>
        </div>
      </div>

      <div className="text-center py-8 text-gray-400">
        Takeoff performance calculations coming soon...
      </div>
    </div>
  );
}

// ============================================================================
// LANDING TAB (Placeholder)
// ============================================================================
interface LandingTabProps {
  airport: Airport | null;
  runway: Runway | null;
  densityAlt: number;
  windDir: number | null;
  windSpeed: number | null;
}

function LandingTab({ airport, runway, densityAlt }: LandingTabProps) {
  if (!airport || !runway) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p className="text-lg">Select an airport and runway to calculate landing performance</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="bg-green-50 rounded-lg p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          Landing on Runway {runway.identifier}
        </h3>
        <div className="text-sm text-gray-600">
          <p>Airport: {airport.icao} - {airport.name}</p>
          <p>Runway Length: {runway.lengthFt?.toLocaleString()} ft</p>
          <p>Density Altitude: {densityAlt.toLocaleString()} ft</p>
        </div>
      </div>

      <div className="text-center py-8 text-gray-400">
        Landing performance calculations coming soon...
      </div>
    </div>
  );
}
