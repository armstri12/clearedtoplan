import { useState } from 'react';
import { getMetar, getTaf, getNearestTaf, parseIcaoCode, type MetarData, type TafData } from '../../services/aviationApi';

// Helper to format TAF times in Zulu
function formatTafTime(isoString: string): string {
  if (!isoString) return 'N/A';
  try {
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return 'N/A';

    // Format as "DD HH:mm" in UTC
    const day = date.getUTCDate().toString().padStart(2, '0');
    const hours = date.getUTCHours().toString().padStart(2, '0');
    const minutes = date.getUTCMinutes().toString().padStart(2, '0');

    return `${day}/${hours}${minutes}Z`;
  } catch {
    return 'N/A';
  }
}

type AirportWeather = {
  icao: string;
  metar: MetarData | null;
  taf: TafData | null;
  tafIsNearby: boolean; // True if TAF is from a nearby airport
  loading: boolean;
  error: string;
};

export default function WeatherPage() {
  const [airports, setAirports] = useState<AirportWeather[]>([]);
  const [icaoInput, setIcaoInput] = useState<string>('');
  const [selectedIndex, setSelectedIndex] = useState<number>(0);

  async function addAirport() {
    const icao = parseIcaoCode(icaoInput);
    if (!icao) {
      alert('Please enter a valid 4-letter ICAO code (e.g., KJFK)');
      return;
    }

    // Check if already added
    if (airports.some(a => a.icao === icao)) {
      alert(`${icao} is already in your weather briefing`);
      return;
    }

    // Add placeholder while loading
    const newAirport: AirportWeather = {
      icao,
      metar: null,
      taf: null,
      tafIsNearby: false,
      loading: true,
      error: '',
    };

    setAirports([...airports, newAirport]);
    setSelectedIndex(airports.length);
    setIcaoInput('');

    // Fetch METAR and TAF
    const metarData = await getMetar(icao);
    let tafData = await getTaf(icao);
    let tafIsNearby = false;

    // If no TAF available, try to get nearest TAF
    if (!tafData && metarData) {
      tafData = await getNearestTaf(icao);
      if (tafData) {
        tafIsNearby = true;
      }
    }

    // Update with results
    setAirports(prev => prev.map((a, i) =>
      i === airports.length ? {
        ...a,
        metar: metarData,
        taf: tafData,
        tafIsNearby,
        loading: false,
        error: !metarData && !tafData ? `No weather data available for ${icao}` : '',
      } : a
    ));
  }

  function removeAirport(index: number) {
    setAirports(prev => prev.filter((_, i) => i !== index));
    if (selectedIndex >= index && selectedIndex > 0) {
      setSelectedIndex(selectedIndex - 1);
    }
  }

  const selected = airports[selectedIndex];

  return (
    <div>
      <h2>Weather Briefing</h2>
      <p style={{ marginTop: 4, opacity: 0.8 }}>
        Get current METAR observations and TAF forecasts for your route. Add departure, destination, and alternates.
      </p>

      {/* Add Airport */}
      <div
        style={{
          marginTop: 16,
          padding: 16,
          borderRadius: 12,
          background: '#eff6ff',
          border: '1px solid #93c5fd',
        }}
      >
        <div style={{ fontSize: 12, fontWeight: 800, marginBottom: 8 }}>
          🌤️ Add Airport to Briefing
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            type="text"
            value={icaoInput}
            onChange={(e) => setIcaoInput(e.target.value.toUpperCase())}
            onKeyDown={(e) => e.key === 'Enter' && addAirport()}
            placeholder="ICAO (e.g., KJFK)"
            maxLength={4}
            style={{
              flex: 1,
              padding: 8,
              borderRadius: 8,
              border: '1px solid #ddd',
              textTransform: 'uppercase',
              fontSize: 14,
            }}
          />
          <button
            onClick={addAirport}
            style={{
              padding: '8px 20px',
              borderRadius: 8,
              border: '1px solid #2563eb',
              background: '#2563eb',
              color: '#fff',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            + Add
          </button>
        </div>
      </div>

      {/* Airport Tabs */}
      {airports.length > 0 && (
        <div style={{ marginTop: 16, display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {airports.map((airport, index) => (
            <div key={airport.icao} style={{ position: 'relative' }}>
              <button
                onClick={() => setSelectedIndex(index)}
                style={{
                  padding: '8px 32px 8px 12px',
                  borderRadius: 8,
                  border: selectedIndex === index ? '2px solid #2563eb' : '1px solid #ddd',
                  background: selectedIndex === index ? '#dbeafe' : '#fff',
                  fontWeight: selectedIndex === index ? 800 : 600,
                  cursor: 'pointer',
                  fontSize: 14,
                }}
              >
                {airport.icao}
                {airport.metar?.flight_category && (
                  <span
                    style={{
                      marginLeft: 8,
                      fontSize: 10,
                      padding: '2px 6px',
                      borderRadius: 4,
                      background:
                        airport.metar.flight_category === 'VFR' ? '#dcfce7' :
                        airport.metar.flight_category === 'MVFR' ? '#fef3c7' :
                        '#fecaca',
                      color:
                        airport.metar.flight_category === 'VFR' ? '#166534' :
                        airport.metar.flight_category === 'MVFR' ? '#92400e' :
                        '#991b1b',
                      fontWeight: 800,
                    }}
                  >
                    {airport.metar.flight_category}
                  </span>
                )}
              </button>
              <button
                onClick={() => removeAirport(index)}
                style={{
                  position: 'absolute',
                  top: 4,
                  right: 4,
                  width: 20,
                  height: 20,
                  borderRadius: '50%',
                  border: 'none',
                  background: '#ef4444',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 800,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  padding: 0,
                }}
                title="Remove"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Weather Display */}
      {selected && (
        <div style={{ marginTop: 16 }}>
          {selected.loading && (
            <div
              style={{
                padding: 32,
                textAlign: 'center',
                border: '1px solid #ddd',
                borderRadius: 12,
                opacity: 0.7,
              }}
            >
              Loading weather data for {selected.icao}...
            </div>
          )}

          {selected.error && (
            <div
              style={{
                padding: 16,
                borderRadius: 12,
                background: '#fef2f2',
                border: '1px solid #fecaca',
                color: '#991b1b',
              }}
            >
              {selected.error}
            </div>
          )}

          {!selected.loading && !selected.error && (
            <>
              {/* METAR Section */}
              {selected.metar && (
                <div
                  style={{
                    border: '1px solid #ddd',
                    borderRadius: 12,
                    padding: 20,
                    marginBottom: 16,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 16 }}>
                    <div>
                      <h3 style={{ margin: 0, fontSize: 20 }}>
                        METAR - {selected.metar.icao}
                      </h3>
                      {selected.metar.name && (
                        <div style={{ fontSize: 14, opacity: 0.7, marginTop: 4 }}>
                          {selected.metar.name}
                        </div>
                      )}
                    </div>
                    {selected.metar.flight_category && (
                      <div
                        style={{
                          padding: '8px 16px',
                          borderRadius: 8,
                          fontSize: 18,
                          fontWeight: 900,
                          background:
                            selected.metar.flight_category === 'VFR' ? '#dcfce7' :
                            selected.metar.flight_category === 'MVFR' ? '#fef3c7' :
                            selected.metar.flight_category === 'IFR' ? '#fecaca' :
                            '#fca5a5',
                          color:
                            selected.metar.flight_category === 'VFR' ? '#166534' :
                            selected.metar.flight_category === 'MVFR' ? '#92400e' :
                            '#991b1b',
                        }}
                      >
                        {selected.metar.flight_category}
                      </div>
                    )}
                  </div>

                  {/* Weather Data Grid */}
                  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12, marginBottom: 16 }}>
                    {/* Temperature */}
                    {selected.metar.temperature && (
                      <div style={{ padding: 12, borderRadius: 8, background: '#fef3c7', border: '1px solid #fbbf24' }}>
                        <div style={{ fontSize: 11, fontWeight: 800, opacity: 0.7, marginBottom: 4 }}>
                          🌡️ TEMPERATURE
                        </div>
                        <div style={{ fontSize: 20, fontWeight: 900 }}>
                          {selected.metar.temperature.celsius}°C
                        </div>
                        <div style={{ fontSize: 12, opacity: 0.8 }}>
                          {selected.metar.temperature.fahrenheit}°F
                        </div>
                        {selected.metar.dewpoint && (
                          <div style={{ fontSize: 11, marginTop: 4, opacity: 0.8 }}>
                            Dewpoint: {selected.metar.dewpoint.celsius}°C
                          </div>
                        )}
                      </div>
                    )}

                    {/* Wind */}
                    {selected.metar.wind && (
                      <div style={{ padding: 12, borderRadius: 8, background: '#dbeafe', border: '1px solid #60a5fa' }}>
                        <div style={{ fontSize: 11, fontWeight: 800, opacity: 0.7, marginBottom: 4 }}>
                          💨 WIND
                        </div>
                        <div style={{ fontSize: 20, fontWeight: 900 }}>
                          {selected.metar.wind.degrees.toString().padStart(3, '0')}°
                        </div>
                        <div style={{ fontSize: 14 }}>
                          {selected.metar.wind.speed_kts} kts
                          {selected.metar.wind.gust_kts && ` G${selected.metar.wind.gust_kts}`}
                        </div>
                      </div>
                    )}

                    {/* Visibility */}
                    {selected.metar.visibility && (
                      <div style={{ padding: 12, borderRadius: 8, background: '#e0e7ff', border: '1px solid #818cf8' }}>
                        <div style={{ fontSize: 11, fontWeight: 800, opacity: 0.7, marginBottom: 4 }}>
                          👁️ VISIBILITY
                        </div>
                        <div style={{ fontSize: 20, fontWeight: 900 }}>
                          {selected.metar.visibility.miles}
                        </div>
                        <div style={{ fontSize: 12, opacity: 0.8 }}>
                          statute miles
                        </div>
                      </div>
                    )}

                    {/* Altimeter */}
                    {selected.metar.barometer && (
                      <div style={{ padding: 12, borderRadius: 8, background: '#fce7f3', border: '1px solid #f9a8d4' }}>
                        <div style={{ fontSize: 11, fontWeight: 800, opacity: 0.7, marginBottom: 4 }}>
                          🔽 ALTIMETER
                        </div>
                        <div style={{ fontSize: 20, fontWeight: 900 }}>
                          {selected.metar.barometer.hg.toFixed(2)}
                        </div>
                        <div style={{ fontSize: 12, opacity: 0.8 }}>
                          inHg ({selected.metar.barometer.mb.toFixed(0)} mb)
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Clouds */}
                  {selected.metar.clouds && selected.metar.clouds.length > 0 && (
                    <div style={{ padding: 12, borderRadius: 8, background: '#f3f4f6', border: '1px solid #d1d5db', marginBottom: 12 }}>
                      <div style={{ fontSize: 11, fontWeight: 800, opacity: 0.7, marginBottom: 6 }}>
                        ☁️ CLOUDS
                      </div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                        {selected.metar.clouds.map((cloud, i) => (
                          <div
                            key={i}
                            style={{
                              padding: '4px 10px',
                              borderRadius: 6,
                              background: '#fff',
                              border: '1px solid #e5e7eb',
                              fontSize: 12,
                            }}
                          >
                            {cloud.code} {cloud.feet.toLocaleString()}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Raw METAR */}
                  <div
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      background: '#f9fafb',
                      border: '1px solid #e5e7eb',
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 800, opacity: 0.7, marginBottom: 6 }}>
                      RAW METAR
                    </div>
                    <div
                      style={{
                        fontFamily: 'monospace',
                        fontSize: 12,
                        wordBreak: 'break-all',
                        lineHeight: 1.5,
                      }}
                    >
                      {selected.metar.raw_text}
                    </div>
                  </div>
                </div>
              )}

              {/* TAF Section */}
              {selected.taf && (
                <div
                  style={{
                    border: '1px solid #ddd',
                    borderRadius: 12,
                    padding: 20,
                  }}
                >
                  <h3 style={{ margin: 0, fontSize: 20, marginBottom: 4 }}>
                    TAF - {selected.taf.icao}
                  </h3>
                  {selected.taf.name && (
                    <div style={{ fontSize: 14, opacity: 0.7, marginBottom: 8 }}>
                      {selected.taf.name}
                    </div>
                  )}

                  {/* Nearby TAF Notice */}
                  {selected.tafIsNearby && selected.taf.icao !== selected.icao && (
                    <div
                      style={{
                        padding: 10,
                        borderRadius: 8,
                        background: '#fef3c7',
                        border: '1px solid #fbbf24',
                        marginBottom: 16,
                        fontSize: 13,
                      }}
                    >
                      ℹ️ No TAF available for {selected.icao}. Showing TAF from nearest airport ({selected.taf.icao}).
                    </div>
                  )}

                  {/* Forecast Periods */}
                  {selected.taf.forecast && selected.taf.forecast.length > 0 && (
                    <div style={{ marginBottom: 16 }}>
                      <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.7, marginBottom: 12 }}>
                        FORECAST PERIODS
                      </div>
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: 12 }}>
                        {selected.taf.forecast.map((period, i) => (
                          <div
                            key={i}
                            style={{
                              padding: 12,
                              borderRadius: 8,
                              border: '2px solid #e5e7eb',
                              background: '#fafafa',
                            }}
                          >
                            <div style={{ fontSize: 13, fontWeight: 800, marginBottom: 8 }}>
                              {formatTafTime(period.timestamp.from)}
                              {' → '}
                              {formatTafTime(period.timestamp.to)}
                            </div>

                            {period.wind && (
                              <div style={{ fontSize: 12, marginBottom: 4 }}>
                                💨 {period.wind.degrees.toString().padStart(3, '0')}° @ {period.wind.speed_kts} kts
                              </div>
                            )}

                            {period.visibility && (
                              <div style={{ fontSize: 12, marginBottom: 4 }}>
                                👁️ {period.visibility.miles} SM
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Raw TAF */}
                  <div
                    style={{
                      padding: 12,
                      borderRadius: 8,
                      background: '#f9fafb',
                      border: '1px solid #e5e7eb',
                    }}
                  >
                    <div style={{ fontSize: 11, fontWeight: 800, opacity: 0.7, marginBottom: 6 }}>
                      RAW TAF
                    </div>
                    <div
                      style={{
                        fontFamily: 'monospace',
                        fontSize: 12,
                        wordBreak: 'break-all',
                        lineHeight: 1.5,
                      }}
                    >
                      {selected.taf.raw_text}
                    </div>
                  </div>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {/* Empty State */}
      {airports.length === 0 && (
        <div
          style={{
            marginTop: 32,
            padding: 48,
            textAlign: 'center',
            border: '2px dashed #ddd',
            borderRadius: 12,
            opacity: 0.6,
          }}
        >
          <div style={{ fontSize: 48, marginBottom: 16 }}>🌤️</div>
          <div style={{ fontSize: 16, fontWeight: 600, marginBottom: 8 }}>
            No airports added yet
          </div>
          <div style={{ fontSize: 14 }}>
            Add departure, destination, and alternate airports to get a complete weather briefing
          </div>
        </div>
      )}
    </div>
  );
}
