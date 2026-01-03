import { useState } from 'react';
import { getMetar, getTaf, getNearestTaf, parseIcaoCode, type MetarData, type TafData } from '../../services/aviationApi';

// Decode cloud coverage codes
function decodeCloudCoverage(code: string): string {
  const codes: Record<string, string> = {
    'SKC': 'Clear',
    'CLR': 'Clear',
    'FEW': 'Few',
    'SCT': 'Scattered',
    'BKN': 'Broken',
    'OVC': 'Overcast',
    'VV': 'Vertical Visibility',
  };
  return codes[code] || code;
}

// Decode weather phenomena
function decodeWeather(wx: string): string {
  const intensity: Record<string, string> = { '-': 'Light', '+': 'Heavy', 'VC': 'Vicinity' };
  const descriptor: Record<string, string> = {
    'MI': 'Shallow', 'BC': 'Patches', 'PR': 'Partial', 'DR': 'Drifting',
    'BL': 'Blowing', 'SH': 'Showers', 'TS': 'Thunderstorm', 'FZ': 'Freezing'
  };
  const precipitation: Record<string, string> = {
    'DZ': 'Drizzle', 'RA': 'Rain', 'SN': 'Snow', 'SG': 'Snow Grains',
    'IC': 'Ice Crystals', 'PL': 'Ice Pellets', 'GR': 'Hail', 'GS': 'Small Hail',
    'UP': 'Unknown Precip'
  };
  const obscuration: Record<string, string> = {
    'BR': 'Mist', 'FG': 'Fog', 'FU': 'Smoke', 'VA': 'Volcanic Ash',
    'DU': 'Dust', 'SA': 'Sand', 'HZ': 'Haze', 'PY': 'Spray'
  };
  const other: Record<string, string> = {
    'PO': 'Dust Whirls', 'SQ': 'Squalls', 'FC': 'Funnel Cloud', 'SS': 'Sandstorm', 'DS': 'Duststorm'
  };

  let result = '';
  let remaining = wx;

  // Check intensity
  if (intensity[wx[0]]) {
    result += intensity[wx[0]] + ' ';
    remaining = wx.slice(1);
  }

  // Check for 2-letter codes
  const all = { ...descriptor, ...precipitation, ...obscuration, ...other };
  for (let i = 0; i < remaining.length; i += 2) {
    const code = remaining.slice(i, i + 2);
    if (all[code]) {
      result += all[code] + ' ';
    }
  }

  return result.trim() || wx;
}

// Parse a single TAF group
type TafGroup = {
  type: string; // 'BASE', 'FM', 'BECMG', 'TEMPO', 'PROB'
  timeFrom: string;
  timeTo: string;
  wind: { dir: number; speed: number; gust?: number } | null;
  visibility: string | null;
  weather: string[];
  clouds: Array<{ coverage: string; altitude: number }>;
  raw: string;
};

function parseSingleGroup(rawText: string, validPeriod?: string): TafGroup | null {
  const parts = rawText.trim().split(/\s+/);

  let type = 'BASE';
  let timeFrom = '';
  let timeTo = '';
  let partIndex = 0;

  // Check for group type
  if (parts[0]?.match(/^FM\d{6}$/)) {
    type = 'FM';
    const time = parts[0].slice(2); // Remove 'FM'
    timeFrom = time.slice(0, 4);
    timeTo = '';
    partIndex = 1;
  } else if (parts[0]?.match(/^BECMG/)) {
    type = 'BECMG';
    const timeMatch = parts[1]?.match(/(\d{4})\/(\d{4})/);
    if (timeMatch) {
      timeFrom = timeMatch[1];
      timeTo = timeMatch[2];
      partIndex = 2;
    }
  } else if (parts[0]?.match(/^TEMPO/)) {
    type = 'TEMPO';
    const timeMatch = parts[1]?.match(/(\d{4})\/(\d{4})/);
    if (timeMatch) {
      timeFrom = timeMatch[1];
      timeTo = timeMatch[2];
      partIndex = 2;
    }
  } else if (parts[0]?.match(/^PROB\d{2}/)) {
    type = 'PROB';
    const timeMatch = parts[1]?.match(/(\d{4})\/(\d{4})/);
    if (timeMatch) {
      timeFrom = timeMatch[1];
      timeTo = timeMatch[2];
      partIndex = 2;
    }
  } else if (validPeriod) {
    const [from, to] = validPeriod.split('/');
    timeFrom = from;
    timeTo = to;
  }

  let wind = null;
  let visibility = null;
  const weather: string[] = [];
  const clouds: Array<{ coverage: string; altitude: number }> = [];

  for (let i = partIndex; i < parts.length; i++) {
    const part = parts[i];

    // Wind: 30006KT, VRB03KT
    if (part.match(/^(\d{3}|VRB)\d{2,3}(G\d{2,3})?KT$/)) {
      const match = part.match(/^(\d{3}|VRB)(\d{2,3})(G(\d{2,3}))?KT$/);
      if (match) {
        wind = {
          dir: match[1] === 'VRB' ? 0 : parseInt(match[1]),
          speed: parseInt(match[2]),
          gust: match[4] ? parseInt(match[4]) : undefined
        };
      }
    }
    // Visibility: P6SM, 10SM, 1/2SM
    else if (part.match(/^(P?\d+)?(\/\d+)?SM$/)) {
      visibility = part.replace('P', '6+').replace('SM', ' SM');
    }
    // Weather phenomena: -SN, RA, TSRA
    else if (part.match(/^(\+|-|VC)?(MI|BC|PR|DR|BL|SH|TS|FZ)?(DZ|RA|SN|SG|IC|PL|GR|GS|UP|BR|FG|FU|VA|DU|SA|HZ|PY|PO|SQ|FC|SS|DS)+$/)) {
      weather.push(part);
    }
    // Clouds: FEW250, SCT015, BKN005, OVC010
    else if (part.match(/^(SKC|CLR|FEW|SCT|BKN|OVC|VV)(\d{3})?$/)) {
      const match = part.match(/^(SKC|CLR|FEW|SCT|BKN|OVC|VV)(\d{3})?$/);
      if (match) {
        clouds.push({
          coverage: match[1],
          altitude: match[2] ? parseInt(match[2]) * 100 : 0
        });
      }
    }
  }

  return {
    type,
    timeFrom,
    timeTo,
    wind,
    visibility,
    weather,
    clouds,
    raw: rawText
  };
}

function parseTafGroups(rawTaf: string): TafGroup[] {
  if (!rawTaf) return [];

  const groups: TafGroup[] = [];

  // Extract valid period
  const validMatch = rawTaf.match(/\d{6}Z\s+(\d{4}\/\d{4})/);
  const validPeriod = validMatch ? validMatch[1] : '';

  // Find start of forecast data (after valid period)
  let forecastStart = rawTaf.indexOf(validPeriod) + validPeriod.length;
  if (forecastStart < validPeriod.length) forecastStart = 0;

  const forecastText = rawTaf.substring(forecastStart).trim();

  // Split on FM, BECMG, TEMPO, PROB
  const changeRegex = /\b(FM\d{6}|BECMG\s+\d{4}\/\d{4}|TEMPO\s+\d{4}\/\d{4}|PROB\d{2}\s+(?:TEMPO\s+)?\d{4}\/\d{4})/g;
  const matches = [...forecastText.matchAll(changeRegex)];

  if (matches.length === 0) {
    // No change groups, entire thing is base forecast
    const baseGroup = parseSingleGroup(forecastText, validPeriod);
    if (baseGroup) groups.push(baseGroup);
  } else {
    // Parse base forecast (before first change group)
    if (matches[0].index && matches[0].index > 0) {
      const baseText = forecastText.substring(0, matches[0].index).trim();
      if (baseText) {
        const baseGroup = parseSingleGroup(baseText, validPeriod);
        if (baseGroup) groups.push(baseGroup);
      }
    }

    // Parse each change group
    for (let i = 0; i < matches.length; i++) {
      const match = matches[i];
      const startIdx = match.index! + match[0].length;
      const endIdx = matches[i + 1]?.index ?? forecastText.length;
      const groupText = match[0] + ' ' + forecastText.substring(startIdx, endIdx).trim();
      const group = parseSingleGroup(groupText);
      if (group) groups.push(group);
    }
  }

  return groups;
}

// Calculate flight category from visibility and ceiling
function calculateFlightCategory(vis: string | null, ceiling: number | null): string {
  const visMiles = vis ? parseFloat(vis.replace(/[^\d.]/g, '')) : 999;
  const ceilFt = ceiling ?? 99999;

  if (visMiles >= 5 && ceilFt >= 3000) return 'VFR';
  if (visMiles >= 3 && ceilFt >= 1000) return 'MVFR';
  if (visMiles >= 1 && ceilFt >= 500) return 'IFR';
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

                  {/* TAF Table */}
                  {selected.taf.raw_text && (() => {
                    const groups = parseTafGroups(selected.taf.raw_text);
                    if (groups.length === 0) return null;

                    return (
                      <div style={{ marginBottom: 16, overflowX: 'auto' }}>
                        <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.7, marginBottom: 12 }}>
                          FORECAST
                        </div>
                        <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                          <thead>
                            <tr style={{ background: '#f3f4f6' }}>
                              <th style={{ padding: '8px 12px', textAlign: 'left', border: '1px solid #ddd', fontWeight: 800 }}>Period</th>
                              <th style={{ padding: '8px 12px', textAlign: 'left', border: '1px solid #ddd', fontWeight: 800 }}>Type</th>
                              <th style={{ padding: '8px 12px', textAlign: 'left', border: '1px solid #ddd', fontWeight: 800 }}>Wind</th>
                              <th style={{ padding: '8px 12px', textAlign: 'left', border: '1px solid #ddd', fontWeight: 800 }}>Vis</th>
                              <th style={{ padding: '8px 12px', textAlign: 'left', border: '1px solid #ddd', fontWeight: 800 }}>Weather</th>
                              <th style={{ padding: '8px 12px', textAlign: 'left', border: '1px solid #ddd', fontWeight: 800 }}>Clouds</th>
                              <th style={{ padding: '8px 12px', textAlign: 'left', border: '1px solid #ddd', fontWeight: 800 }}>Cat</th>
                            </tr>
                          </thead>
                          <tbody>
                            {groups.map((group, i) => {
                              const ceiling = group.clouds.find(c => ['BKN', 'OVC', 'VV'].includes(c.coverage))?.altitude || null;
                              const flightCat = calculateFlightCategory(group.visibility, ceiling);

                              return (
                                <tr key={i} style={{ background: i % 2 === 0 ? '#fff' : '#fafafa' }}>
                                  <td style={{ padding: '8px 12px', border: '1px solid #ddd', fontFamily: 'monospace', fontSize: 12, fontWeight: 700 }}>
                                    {group.timeFrom}/{group.timeTo || '----'}
                                  </td>
                                  <td style={{ padding: '8px 12px', border: '1px solid #ddd', fontSize: 11, fontWeight: 700, color: '#2563eb' }}>
                                    {group.type}
                                  </td>
                                  <td style={{ padding: '8px 12px', border: '1px solid #ddd', fontFamily: 'monospace', fontSize: 12 }}>
                                    {group.wind ? (
                                      <>
                                        {group.wind.dir === 0 ? 'VRB' : group.wind.dir.toString().padStart(3, '0')}°
                                        {' @ '}
                                        {group.wind.speed} kt
                                        {group.wind.gust ? ` G${group.wind.gust}` : ''}
                                      </>
                                    ) : '-'}
                                  </td>
                                  <td style={{ padding: '8px 12px', border: '1px solid #ddd', fontFamily: 'monospace', fontSize: 12 }}>
                                    {group.visibility || '-'}
                                  </td>
                                  <td style={{ padding: '8px 12px', border: '1px solid #ddd', fontSize: 12 }}>
                                    {group.weather.length > 0 ? group.weather.map(w => decodeWeather(w)).join(', ') : '-'}
                                  </td>
                                  <td style={{ padding: '8px 12px', border: '1px solid #ddd', fontSize: 12 }}>
                                    {group.clouds.length > 0 ? group.clouds.map(c =>
                                      `${decodeCloudCoverage(c.coverage)}${c.altitude ? ' ' + c.altitude.toLocaleString() : ''}`
                                    ).join(', ') : 'Clear'}
                                  </td>
                                  <td style={{ padding: '8px 12px', border: '1px solid #ddd' }}>
                                    <span style={{
                                      padding: '2px 8px',
                                      borderRadius: 4,
                                      fontSize: 11,
                                      fontWeight: 800,
                                      background: flightCat === 'VFR' ? '#dcfce7' : flightCat === 'MVFR' ? '#fef3c7' : '#fecaca',
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
