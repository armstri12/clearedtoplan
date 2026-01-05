import { useEffect, useState } from 'react';
import { airportClient } from '../services/supabaseClient';
import type { Runway, RunwayWithWind } from '../services/supabaseClient';

interface RunwaySelectorProps {
  airportIcao: string;
  windDirection: number | null;
  windSpeed: number | null;
  selectedRunway: Runway | null;
  onSelect: (runway: Runway | null) => void;
}

export function RunwaySelector({
  airportIcao,
  windDirection,
  windSpeed,
  selectedRunway,
  onSelect,
}: RunwaySelectorProps) {
  const [runways, setRunways] = useState<RunwayWithWind[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchRunways() {
      setIsLoading(true);
      setError(null);

      try {
        const fetchedRunways = await airportClient.getRunways(airportIcao);

        if (fetchedRunways.length === 0) {
          setError('No runways found for this airport');
          setRunways([]);
          onSelect(null);
          return;
        }

        // Calculate wind components if wind data available
        let runwaysWithWind: RunwayWithWind[];
        if (windDirection !== null && windSpeed !== null) {
          runwaysWithWind = airportClient.calculateWindComponents(
            fetchedRunways,
            windDirection,
            windSpeed
          );
          // Rank by wind favorability (best headwind first)
          runwaysWithWind = airportClient.rankRunwaysByWind(runwaysWithWind);
        } else {
          // No wind data, just show runways without wind info
          runwaysWithWind = fetchedRunways.map(rwy => ({
            ...rwy,
            headwind: null,
            crosswind: null,
          }));
        }

        setRunways(runwaysWithWind);

        // Auto-select first runway if none selected
        if (!selectedRunway && runwaysWithWind.length > 0) {
          onSelect(runwaysWithWind[0]);
        }
      } catch (err) {
        console.error('Error fetching runways:', err);
        setError('Failed to load runways');
        setRunways([]);
        onSelect(null);
      } finally {
        setIsLoading(false);
      }
    }

    fetchRunways();
  }, [airportIcao, windDirection, windSpeed]);

  if (isLoading) {
    return (
      <div className="text-sm text-gray-500 py-4">Loading runways...</div>
    );
  }

  if (error) {
    return (
      <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">
        {error}
      </div>
    );
  }

  if (runways.length === 0) {
    return (
      <div className="text-sm text-gray-500 py-4">
        No runways available
      </div>
    );
  }

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        Select Runway
        {windDirection !== null && windSpeed !== null && (
          <span className="ml-2 text-xs text-gray-500 font-normal">
            (ranked by wind favorability)
          </span>
        )}
      </label>

      <div className="space-y-2 max-h-64 overflow-y-auto">
        {runways.map((runway) => {
          const isSelected = selectedRunway?.identifier === runway.identifier;
          const hasWind = runway.headwind !== null && runway.crosswind !== null;

          return (
            <button
              key={`${runway.airportIcao}-${runway.identifier}`}
              onClick={() => onSelect(runway)}
              className={`w-full text-left px-4 py-3 rounded-md border transition-colors ${
                isSelected
                  ? 'border-blue-500 bg-blue-50'
                  : 'border-gray-200 bg-white hover:border-gray-300 hover:bg-gray-50'
              }`}
            >
              <div className="flex justify-between items-start">
                <div>
                  <div className="font-semibold text-gray-900">
                    Runway {runway.identifier}
                    {runway.headingDeg && (
                      <span className="ml-2 text-sm text-gray-500 font-normal">
                        ({runway.headingDeg}°)
                      </span>
                    )}
                  </div>

                  <div className="text-sm text-gray-600 mt-1 space-x-3">
                    {runway.lengthFt && (
                      <span>{runway.lengthFt.toLocaleString()} ft</span>
                    )}
                    {runway.widthFt && (
                      <span>× {runway.widthFt} ft</span>
                    )}
                    {runway.surface && (
                      <span className="uppercase">{runway.surface}</span>
                    )}
                  </div>

                  {hasWind && (
                    <div className="text-xs text-gray-500 mt-1">
                      Headwind: {Math.round(runway.headwind!)} kt
                      {' • '}
                      Crosswind: {Math.round(Math.abs(runway.crosswind!))} kt
                    </div>
                  )}
                </div>

                {isSelected && (
                  <svg
                    className="w-5 h-5 text-blue-600 flex-shrink-0"
                    fill="currentColor"
                    viewBox="0 0 20 20"
                  >
                    <path
                      fillRule="evenodd"
                      d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z"
                      clipRule="evenodd"
                    />
                  </svg>
                )}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
