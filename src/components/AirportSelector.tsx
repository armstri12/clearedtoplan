import { useState } from 'react';
import { airportClient } from '../services/supabaseClient';
import type { Airport } from '../services/supabaseClient';

interface AirportSelectorProps {
  selectedAirport: Airport | null;
  onSelect: (airport: Airport | null) => void;
  label?: string;
  placeholder?: string;
}

export function AirportSelector({
  selectedAirport,
  onSelect,
  label = 'Airport',
  placeholder = 'Enter ICAO (e.g., KJFK)',
}: AirportSelectorProps) {
  const [icaoInput, setIcaoInput] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    const icao = icaoInput.trim().toUpperCase();

    if (!icao) {
      onSelect(null);
      setError(null);
      return;
    }

    if (icao.length !== 4) {
      setError('ICAO code must be 4 letters');
      return;
    }

    setIsLoading(true);
    setError(null);

    try {
      const airport = await airportClient.getAirport(icao);

      if (airport) {
        onSelect(airport);
        setError(null);
      } else {
        setError(`Airport ${icao} not found`);
        onSelect(null);
      }
    } catch (err) {
      console.error('Error fetching airport:', err);
      setError('Failed to fetch airport data');
      onSelect(null);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSearch();
    }
  };

  const handleClear = () => {
    setIcaoInput('');
    setError(null);
    onSelect(null);
  };

  return (
    <div className="space-y-2">
      <label className="block text-sm font-medium text-gray-700">
        {label}
      </label>

      <div className="flex gap-2">
        <div className="flex-1">
          <input
            type="text"
            value={icaoInput}
            onChange={(e) => setIcaoInput(e.target.value.toUpperCase())}
            onKeyPress={handleKeyPress}
            placeholder={placeholder}
            maxLength={4}
            className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono uppercase"
            disabled={isLoading}
          />
        </div>

        <button
          onClick={handleSearch}
          disabled={isLoading}
          className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors"
        >
          {isLoading ? 'Searching...' : 'Search'}
        </button>

        {selectedAirport && (
          <button
            onClick={handleClear}
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {error && (
        <div className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-md">
          {error}
        </div>
      )}

      {selectedAirport && (
        <div className="bg-blue-50 border border-blue-200 rounded-md p-3">
          <div className="flex justify-between items-start">
            <div>
              <div className="font-semibold text-gray-900">
                {selectedAirport.icao} - {selectedAirport.name}
              </div>
              <div className="text-sm text-gray-600 mt-1">
                {selectedAirport.municipality && `${selectedAirport.municipality}, `}
                {selectedAirport.region}
              </div>
            </div>
            {selectedAirport.elevationFt !== null && (
              <div className="text-right">
                <div className="text-sm text-gray-500">Elevation</div>
                <div className="font-semibold text-gray-900">
                  {selectedAirport.elevationFt.toLocaleString()} ft
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
