import { useState } from 'react';
import { getMetar, getTaf, getNearestTaf, parseIcaoCode, type MetarData, type TafData } from '../../services/aviationApi';
import { parseTAFAsForecast, getCompositeForecastForDate } from 'metar-taf-parser';
import { eachHourOfInterval, format } from 'date-fns';

// Calculate flight category from visibility and ceiling
function calculateFlightCategory(visibilityMiles: number | undefined, ceilingFeet: number | undefined): string {
  const vis = visibilityMiles ?? 999;
  const ceil = ceilingFeet ?? 99999;

  if (vis >= 5 && ceil >= 3000) return 'VFR';
  if (vis >= 3 && ceil >= 1000) return 'MVFR';
  if (vis >= 1 && ceil >= 500) return 'IFR';
  return 'LIFR';
}

type AirportWeather = {
  icao: string;
  metar: MetarData | null;
  taf: TafData | null;
  tafIsNearby: boolean;
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

    if (airports.some(a => a.icao === icao)) {
      alert(`${icao} is already in your weather briefing`);
      return;
    }

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

    const metarData = await getMetar(icao);
    let tafData = await getTaf(icao);
    let tafIsNearby = false;

    if (!tafData && metarData) {
      tafData = await getNearestTaf(icao);
      if (tafData) {
        tafIsNearby = true;
      }
    }

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

                  {/* Hourly Forecast Table */}
                  {selected.taf.raw_text && (() => {
                    try {
                      // Parse issue time from raw TAF (format: TAF ICAO DDHHmmZ ...)
                      let issued = new Date();

                      if (selected.taf.timestamp?.issued) {
                        issued = new Date(selected.taf.timestamp.issued);
                      } else {
                        // Try to extract issue time from raw TAF text
                        // Format: TAF KENW 031120Z means issued on day 03 at 1120Z
                        const issueMatch = selected.taf.raw_text.match(/TAF\s+\w{4}\s+(\d{2})(\d{2})(\d{2})Z/);
                        if (issueMatch) {
                          const day = parseInt(issueMatch[1]);
                          const hour = parseInt(issueMatch[2]);
                          const minute = parseInt(issueMatch[3]);

                          // Use current month/year but set the day/hour/minute from TAF
                          const now = new Date();
                          issued = new Date(Date.UTC(
                            now.getUTCFullYear(),
                            now.getUTCMonth(),
                            day,
                            hour,
                            minute
                          ));
                        }
                      }

                      const report = parseTAFAsForecast(selected.taf.raw_text, { issued });

                      if (!report.start || !report.end) return null;

                      const hours = eachHourOfInterval({
                        start: report.start,
                        end: report.end,
                      });

                      return (
                        <div style={{ marginBottom: 16, overflowX: 'auto' }}>
                          <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.7, marginBottom: 12 }}>
                            HOURLY FORECAST
                          </div>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                            <thead>
                              <tr style={{ background: '#f3f4f6' }}>
                                <th style={{ padding: '8px 10px', textAlign: 'left', border: '1px solid #ddd', fontWeight: 800, minWidth: 100 }}>Time</th>
                                <th style={{ padding: '8px 10px', textAlign: 'center', border: '1px solid #ddd', fontWeight: 800, minWidth: 80 }}>Wind</th>
                                <th style={{ padding: '8px 10px', textAlign: 'center', border: '1px solid #ddd', fontWeight: 800, minWidth: 60 }}>Vis</th>
                                <th style={{ padding: '8px 10px', textAlign: 'left', border: '1px solid #ddd', fontWeight: 800, minWidth: 120 }}>Weather</th>
                                <th style={{ padding: '8px 10px', textAlign: 'left', border: '1px solid #ddd', fontWeight: 800, minWidth: 150 }}>Clouds</th>
                                <th style={{ padding: '8px 10px', textAlign: 'center', border: '1px solid #ddd', fontWeight: 800, minWidth: 60 }}>Cat</th>
                              </tr>
                            </thead>
                            <tbody>
                              {hours.map((hour, i) => {
                                const { prevailing } = getCompositeForecastForDate(hour, report);

                                if (!prevailing) return null;

                                // Wind
                                const wind = prevailing.wind;
                                const windStr = wind
                                  ? `${wind.degrees?.toString().padStart(3, '0') || 'VRB'}° ${wind.speed}${wind.gust ? `G${wind.gust}` : ''} kt`
                                  : '-';

                                // Visibility (convert to statute miles if in meters)
                                const vis = prevailing.visibility;
                                let visStr = '-';
                                if (vis) {
                                  if (vis.unit === 'SM') {
                                    // Already in statute miles
                                    visStr = vis.indicator === 'P' ? `${vis.value}+ SM` : `${vis.value} SM`;
                                  } else {
                                    // Convert meters to SM (1 SM = 1609.34 meters)
                                    const miles = Math.round((vis.value / 1609.34) * 10) / 10;
                                    visStr = `${miles} SM`;
                                  }
                                }

                                // Weather phenomena
                                const wxStr = prevailing.weatherConditions && prevailing.weatherConditions.length > 0
                                  ? prevailing.weatherConditions.map(w => {
                                      const parts = [];
                                      if (w.intensity) parts.push(w.intensity);
                                      if (w.descriptive) parts.push(w.descriptive);
                                      if (w.phenomenons) parts.push(...w.phenomenons);
                                      return parts.join(' ');
                                    }).join(', ')
                                  : '-';

                                // Clouds
                                const clouds = prevailing.clouds || [];
                                const cloudsStr = clouds.length > 0
                                  ? clouds.map(c => `${c.quantity} ${c.height}`).join(', ')
                                  : 'Clear';

                                // Flight category
                                const ceiling = clouds.find(c => c.quantity === 'BKN' || c.quantity === 'OVC')?.height;
                                // Convert visibility to miles for flight cat calculation
                                let visMiles: number | undefined;
                                if (vis) {
                                  if (vis.unit === 'SM') {
                                    visMiles = vis.value;
                                  } else {
                                    visMiles = vis.value / 1609.34;
                                  }
                                }
                                const flightCat = calculateFlightCategory(visMiles, ceiling);

                                // Determine row color based on hour
                                const now = new Date();
                                const isCurrent = hour <= now && now < new Date(hour.getTime() + 60 * 60 * 1000);
                                const bgColor = isCurrent ? '#dbeafe' : (i % 2 === 0 ? '#fff' : '#fafafa');

                                return (
                                  <tr key={i} style={{ background: bgColor }}>
                                    <td style={{ padding: '6px 10px', border: '1px solid #ddd', fontFamily: 'monospace', fontSize: 11, fontWeight: isCurrent ? 800 : 600 }}>
                                      {format(hour, 'EEE dd HH:mm')}z
                                      {isCurrent && <span style={{ marginLeft: 6, color: '#2563eb' }}>●</span>}
                                    </td>
                                    <td style={{ padding: '6px 10px', border: '1px solid #ddd', fontFamily: 'monospace', fontSize: 11, textAlign: 'center' }}>
                                      {windStr}
                                    </td>
                                    <td style={{ padding: '6px 10px', border: '1px solid #ddd', fontFamily: 'monospace', fontSize: 11, textAlign: 'center' }}>
                                      {visStr}
                                    </td>
                                    <td style={{ padding: '6px 10px', border: '1px solid #ddd', fontSize: 11 }}>
                                      {wxStr}
                                    </td>
                                    <td style={{ padding: '6px 10px', border: '1px solid #ddd', fontSize: 11 }}>
                                      {cloudsStr}
                                    </td>
                                    <td style={{ padding: '6px 10px', border: '1px solid #ddd', textAlign: 'center' }}>
                                      <span style={{
                                        padding: '2px 8px',
                                        borderRadius: 4,
                                        fontSize: 10,
                                        fontWeight: 800,
                                        background: flightCat === 'VFR' ? '#dcfce7' : flightCat === 'MVFR' ? '#fef3c7' : flightCat === 'IFR' ? '#fecaca' : '#fca5a5',
                                        color: flightCat === 'VFR' ? '#166534' : flightCat === 'MVFR' ? '#92400e' : '#991b1b',
                                      }}>
                                        {flightCat}
                                      </span>
                                    </td>
                                  </tr>
                                );
                              })}
                            </tbody>
                          </table>
                        </div>
                      );
                    } catch (error) {
                      console.error('Error parsing TAF:', error);
                      return (
                        <div style={{ padding: 12, borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', marginBottom: 16 }}>
                          Unable to parse TAF for hourly forecast. See raw TAF below.
                        </div>
                      );
                    }
                  })()}

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
                      ORIGINAL TAF
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
