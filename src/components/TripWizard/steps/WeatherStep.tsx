import type { ChangeEvent } from 'react';
import { useFlightPlan, useFlightPlanUpdater } from '../../../stores/flightPlan';

export function WeatherStep() {
  const weather = useFlightPlan((state) => state.weather);
  const { updateWeather } = useFlightPlanUpdater();

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    if (name === 'departure') {
      updateWeather({ departure: { ...weather.departure, icao: value } });
      return;
    }
    if (name === 'destination') {
      updateWeather({ destination: { ...weather.destination, icao: value } });
      return;
    }
    updateWeather({ briefingNotes: value });
  };

  return (
    <div className="wizard-section">
      <h3>Weather & NOTAMs</h3>
      <p className="wizard-helper">Capture quick weather context for departure, destination, and notes.</p>

      <div className="wizard-grid">
        <div className="wizard-field">
          <label htmlFor="departureWx">Departure ICAO</label>
          <input
            id="departureWx"
            name="departure"
            value={weather.departure.icao ?? ''}
            onChange={handleChange}
            placeholder="KJYO"
          />
        </div>
        <div className="wizard-field">
          <label htmlFor="destinationWx">Destination ICAO</label>
          <input
            id="destinationWx"
            name="destination"
            value={weather.destination.icao ?? ''}
            onChange={handleChange}
            placeholder="KHEF"
          />
        </div>
      </div>

      <div className="wizard-field">
        <label htmlFor="briefingNotes">Briefing notes / NOTAMs</label>
        <textarea
          id="briefingNotes"
          name="briefingNotes"
          value={weather.briefingNotes ?? ''}
          onChange={handleChange}
          placeholder="Surface winds, ceilings, notable NOTAMs..."
        />
      </div>

      <div className="wizard-summary-card">
        <p style={{ margin: 0, fontWeight: 700 }}>Status</p>
        <p className="wizard-helper" style={{ margin: '4px 0 0' }}>
          METAR/TAF ingestion hooks are coming soon. For now, keep critical notes handy here.
        </p>
      </div>
    </div>
  );
}
