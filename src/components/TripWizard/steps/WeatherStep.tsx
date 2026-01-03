import { useEffect, useMemo, useState, type ChangeEvent } from 'react';
import { getMetar, getTaf, parseIcaoCode, type MetarData, type TafData } from '../../../services/aviationApi';
import { useFlightPlan, useFlightPlanUpdater } from '../../../stores/flightPlan';

type WeatherKey = 'departure' | 'destination';

const EMPTY_NOTE = '';

export function WeatherStep() {
  const weather = useFlightPlan((state) => state.weather);
  const { updateWeather } = useFlightPlanUpdater();
  const [notamDrafts, setNotamDrafts] = useState<Record<WeatherKey, string>>({
    departure: (weather.departure.notams ?? []).join('\n') || EMPTY_NOTE,
    destination: (weather.destination.notams ?? []).join('\n') || EMPTY_NOTE,
  });
  const [loading, setLoading] = useState<Record<WeatherKey, boolean>>({
    departure: false,
    destination: false,
  });
  const [errors, setErrors] = useState<Record<WeatherKey, string>>({
    departure: '',
    destination: '',
  });

  const workerConfigured = useMemo(() => Boolean(import.meta.env.VITE_WEATHER_API_URL), []);

  useEffect(() => {
    setNotamDrafts({
      departure: (weather.departure.notams ?? []).join('\n') || EMPTY_NOTE,
      destination: (weather.destination.notams ?? []).join('\n') || EMPTY_NOTE,
    });
  }, [weather.departure.notams, weather.destination.notams]);

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = event.target;
    if (name === 'departure') {
      updateWeather({ departure: { ...weather.departure, icao: value.toUpperCase() } });
      return;
    }
    if (name === 'destination') {
      updateWeather({ destination: { ...weather.destination, icao: value.toUpperCase() } });
      return;
    }
    updateWeather({ briefingNotes: value });
  };

  const handleNotamChange = (key: WeatherKey, value: string) => {
    setNotamDrafts((prev) => ({ ...prev, [key]: value }));
    const parsed = value
      .split('\n')
      .map((line) => line.trim())
      .filter(Boolean);
    updateWeather({ [key]: { ...weather[key], notams: parsed } });
  };

  const handleFetch = async (key: WeatherKey) => {
    const snapshot = weather[key];
    const icao = parseIcaoCode(snapshot.icao ?? '');
    if (!icao) {
      setErrors((prev) => ({ ...prev, [key]: 'Enter a 4-letter ICAO code (e.g., KJFK)' }));
      return;
    }

    if (!workerConfigured) {
      setErrors((prev) => ({
        ...prev,
        [key]: 'Weather proxy not configured. Set VITE_WEATHER_API_URL (see WEATHER_API_SETUP.md).',
      }));
      return;
    }

    setLoading((prev) => ({ ...prev, [key]: true }));
    setErrors((prev) => ({ ...prev, [key]: '' }));

    const [metar, taf] = await Promise.all([
      getMetar(icao),
      getTaf(icao),
    ]);

    if (!metar && !taf) {
      setErrors((prev) => ({ ...prev, [key]: 'No METAR/TAF returned. Check ICAO and worker URL.' }));
    }

    updateWeather({
      [key]: {
        ...snapshot,
        icao,
        metar: metar as MetarData | null,
        taf: taf as TafData | null,
        fetchedAt: new Date().toISOString(),
      },
    });

    setLoading((prev) => ({ ...prev, [key]: false }));
  };

  const renderStatus = (key: WeatherKey, label: string) => {
    const snapshot = weather[key];
    const category = snapshot.metar?.flight_category;
    const badgeColor =
      category === 'VFR' ? '#22c55e' :
      category === 'MVFR' ? '#eab308' :
      category ? '#ef4444' : '#cbd5e1';

    return (
      <div className="wizard-field" style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: 12 }}>
        <div className="wizard-inline" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div style={{ fontWeight: 700 }}>{label}</div>
            <div className="wizard-helper">
              {snapshot.icao ? snapshot.icao.toUpperCase() : 'No ICAO entered'}
            </div>
          </div>
          <div
            style={{
              minWidth: 90,
              textAlign: 'center',
              background: `${badgeColor}20`,
              color: badgeColor,
              borderRadius: 999,
              padding: '4px 8px',
              fontWeight: 800,
              fontSize: 12,
            }}
          >
            {category || '---'}
          </div>
        </div>

        <div className="wizard-inline" style={{ gap: 8, marginTop: 8 }}>
          <button
            type="button"
            className="wizard-button primary"
            onClick={() => handleFetch(key)}
            disabled={loading[key]}
          >
            {loading[key] ? 'Fetching...' : 'Fetch METAR/TAF'}
          </button>
          {!workerConfigured && (
            <span className="wizard-chip" style={{ background: '#fef9c3', color: '#854d0e' }}>
              Needs VITE_WEATHER_API_URL
            </span>
          )}
        </div>

        {errors[key] && (
          <div style={{ marginTop: 8, color: '#b91c1c', fontSize: 12 }}>
            {errors[key]}
          </div>
        )}

        {snapshot.metar && (
          <div style={{ marginTop: 12, fontSize: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>METAR</div>
            <div style={{ fontFamily: 'monospace', background: '#f8fafc', padding: 8, borderRadius: 6, border: '1px solid #e2e8f0' }}>
              {snapshot.metar.raw_text}
            </div>
          </div>
        )}

        {snapshot.taf && (
          <div style={{ marginTop: 12, fontSize: 12 }}>
            <div style={{ fontWeight: 700, marginBottom: 4 }}>TAF</div>
            <div style={{ fontFamily: 'monospace', background: '#f8fafc', padding: 8, borderRadius: 6, border: '1px solid #e2e8f0' }}>
              {snapshot.taf.raw_text}
            </div>
          </div>
        )}

        <div style={{ marginTop: 12 }}>
          <label htmlFor={`${key}-notams`} style={{ fontWeight: 700, display: 'block' }}>NOTAMs</label>
          <textarea
            id={`${key}-notams`}
            name={`${key}-notams`}
            value={notamDrafts[key]}
            onChange={(event) => handleNotamChange(key, event.target.value)}
            placeholder="RWY closed? LLWAS OTS? Enter one per line."
          />
        </div>

        {snapshot.fetchedAt && (
          <p className="wizard-helper" style={{ marginTop: 6 }}>
            Cached for export: {new Date(snapshot.fetchedAt).toLocaleString()}
          </p>
        )}
      </div>
    );
  };

  return (
    <div className="wizard-section">
      <h3>Weather & NOTAMs</h3>
      <p className="wizard-helper">
        Fetch live METAR/TAF via the Cloudflare worker, capture flight category, and keep NOTAMs alongside your plan.
      </p>

      {!workerConfigured && (
        <div className="wizard-summary-card" style={{ background: '#fef3c7', border: '1px solid #fcd34d' }}>
          <p style={{ margin: 0, fontWeight: 700, color: '#854d0e' }}>Weather proxy not configured</p>
          <p className="wizard-helper" style={{ margin: '4px 0 0' }}>
            Set <code>VITE_WEATHER_API_URL</code> in your <code>.env.local</code> (see WEATHER_API_SETUP.md). The step will keep working with manual NOTAMs.
          </p>
        </div>
      )}

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
        <label htmlFor="briefingNotes">Briefing notes / remarks</label>
        <textarea
          id="briefingNotes"
          name="briefingNotes"
          value={weather.briefingNotes ?? ''}
          onChange={handleChange}
          placeholder="Surface winds, ceilings, PIREPs, alternates..."
        />
      </div>

      <div className="wizard-grid">
        {renderStatus('departure', 'Departure')}
        {renderStatus('destination', 'Destination')}
      </div>
    </div>
  );
}
