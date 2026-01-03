import { useEffect, useMemo, useState } from 'react';
import { useFlightSession } from '../../context/FlightSessionContext';
import { getMetar, getTaf, getNearestTaf, parseIcaoCode, type MetarData, type TafData } from '../../services/aviationApi';
import { parseTAFAsForecast, getCompositeForecastForDate } from 'metar-taf-parser';
import { eachHourOfInterval, format } from 'date-fns';
import { getRunwaysForAirport, type Runway } from '../../services/runwaysApi';

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
  runways: Runway[];
  runwaysLoading: boolean;
  runwaysError?: string;
  loading: boolean;
  error: string;
};

type WindComponents = {
  headwind: number;
  crosswind: number;
};

type RunwayVisualization = {
  id: string;
  heading: number | null;
  length: number | null;
  width: number | null;
  surface?: string;
  bestEnd?: 'le' | 'he';
  headwind?: number;
  crosswind?: number;
  labels: {
    start: string;
    end: string;
  };
};

function normalizeHeading(heading: number | null | undefined): number | null {
  if (heading === null || heading === undefined || Number.isNaN(heading)) return null;
  const normalized = heading % 360;
  return normalized === 0 ? 360 : normalized < 0 ? normalized + 360 : normalized;
}

function headingFromIdent(ident?: string): number | null {
  if (!ident) return null;
  const match = ident.match(/(\d{2})/);
  if (!match) return null;
  const numeric = parseInt(match[1], 10);
  const heading = numeric === 36 ? 360 : numeric * 10;
  return normalizeHeading(heading);
}

function calculateWindComponents(runwayHeading: number, windDirection: number, windSpeed: number): WindComponents {
  const angleDiff = (((windDirection - runwayHeading) % 360) + 360) % 360;
  const theta = (Math.PI / 180) * angleDiff;
  return {
    headwind: Math.round(windSpeed * Math.cos(theta)),
    crosswind: Math.round(windSpeed * Math.sin(theta)),
  };
}

function deriveRunwayHeading(runway: Runway): number | null {
  const leHeading = normalizeHeading(runway.le.heading ?? headingFromIdent(runway.le.ident));
  if (leHeading !== null) return leHeading;

  const heHeading = normalizeHeading(runway.he.heading ?? headingFromIdent(runway.he.ident));
  if (heHeading !== null) {
    const reciprocal = (heHeading + 180) % 360 || 360;
    return reciprocal;
  }

  return null;
}

function pickBestEnd(
  leHeading: number | null,
  heHeading: number | null,
  windDir: number,
  windSpeed: number
): { end?: 'le' | 'he'; components?: WindComponents } {
  const leComponents = leHeading !== null ? calculateWindComponents(leHeading, windDir, windSpeed) : null;
  const heComponents = heHeading !== null ? calculateWindComponents(heHeading, windDir, windSpeed) : null;

  if (leComponents && heComponents) {
    if (leComponents.headwind === heComponents.headwind) {
      return Math.abs(leComponents.crosswind) <= Math.abs(heComponents.crosswind)
        ? { end: 'le', components: leComponents }
        : { end: 'he', components: heComponents };
    }
    return leComponents.headwind > heComponents.headwind
      ? { end: 'le', components: leComponents }
      : { end: 'he', components: heComponents };
  }

  if (leComponents) return { end: 'le', components: leComponents };
  if (heComponents) return { end: 'he', components: heComponents };

  return {};
}

function RunwayDiagram({
  runways,
  wind,
  loading,
  error,
  icao,
}: {
  runways: Runway[];
  wind: NonNullable<MetarData['wind']>;
  loading: boolean;
  error?: string;
  icao: string;
}) {
  const windDir = wind.degrees;
  const windSpeed = wind.speed_kts;

  const visuals = useMemo(() => runways.map((runway, idx): RunwayVisualization => {
    const leHeading = normalizeHeading(runway.le.heading ?? headingFromIdent(runway.le.ident));
    const heHeading = normalizeHeading(runway.he.heading ?? headingFromIdent(runway.he.ident));
    const axisHeading = deriveRunwayHeading(runway);
    const best = pickBestEnd(leHeading, heHeading, windDir, windSpeed);

    return {
      id: runway.le.ident && runway.he.ident ? `${runway.le.ident}/${runway.he.ident}` : `Runway ${idx + 1}`,
      heading: axisHeading,
      length: runway.lengthFt,
      width: runway.widthFt,
      surface: runway.surface,
      bestEnd: best.end,
      headwind: best.components?.headwind,
      crosswind: best.components?.crosswind,
      labels: {
        start: runway.le.ident || 'LE',
        end: runway.he.ident || 'HE',
      },
    };
  }), [runways, windDir, windSpeed]);

  const highlighted = useMemo(() => visuals.reduce<RunwayVisualization | null>((best, current) => {
    if (current.bestEnd === undefined || current.headwind === undefined || current.crosswind === undefined) {
      return best;
    }

    if (!best || best.headwind === undefined || best.crosswind === undefined) {
      return current;
    }

    if (current.headwind > best.headwind) return current;
    if (current.headwind === best.headwind && Math.abs(current.crosswind) < Math.abs(best.crosswind)) return current;

    return best;
  }, null), [visuals]);

  const center = 120;
  const radius = 90;

  return (
    <div style={{ padding: 12, borderRadius: 8, background: '#f0fdf4', border: '1px solid #86efac', marginBottom: 12 }}>
      <div style={{ fontSize: 11, fontWeight: 800, opacity: 0.7, marginBottom: 8 }}>
        🛬 Runway configuration ({icao}) with live wind from {windDir.toString().padStart(3, '0')}° @ {windSpeed} kt
      </div>

      {loading && (
        <div style={{ padding: 12, background: '#fff', border: '1px dashed #bbf7d0', borderRadius: 8, marginBottom: 8 }}>
          Loading runway data...
        </div>
      )}

      {error && (
        <div style={{ padding: 12, background: '#fef2f2', border: '1px solid #fecaca', borderRadius: 8, color: '#991b1b', marginBottom: 8 }}>
          {error}
        </div>
      )}

      {!loading && !error && visuals.length === 0 && (
        <div style={{ padding: 12, background: '#fff', border: '1px dashed #bbf7d0', borderRadius: 8 }}>
          No runway configuration found for {icao}.
        </div>
      )}

      {visuals.length > 0 && (
        <>
          <svg viewBox="0 0 240 240" style={{ width: '100%', background: '#fff', borderRadius: 8, border: '1px solid #d1d5db' }}>
            <circle cx={center} cy={center} r={radius + 18} fill="#f8fafc" stroke="#e2e8f0" strokeWidth={1} />
            <text x={center} y={28} textAnchor="middle" fontSize="10" fill="#64748b">N</text>
            <text x={center} y={234} textAnchor="middle" fontSize="10" fill="#64748b">S</text>
            <text x={20} y={center + 3} textAnchor="middle" fontSize="10" fill="#64748b">W</text>
            <text x={220} y={center + 3} textAnchor="middle" fontSize="10" fill="#64748b">E</text>

            {/* Wind arrow (coming from) */}
            <g transform={`translate(${center}, ${center}) rotate(${windDir - 90})`}>
              <line x1={0} y1={-radius} x2={0} y2={radius * 0.2} stroke="#16a34a" strokeWidth={4} strokeLinecap="round" />
              <polygon points={`0,${-radius - 6} 7,${-radius + 8} -7,${-radius + 8}`} fill="#16a34a" />
              <circle cx={0} cy={0} r={4} fill="#16a34a" />
            </g>

            {visuals.map(runway => {
              if (runway.heading === null) return null;

              const axis = (runway.heading * Math.PI) / 180;
              const visualLength = 70 + Math.min(90, (runway.length ?? 5000) / 120);
              const half = visualLength / 2;
              const dx = Math.sin(axis) * half;
              const dy = Math.cos(axis) * half;
              const baseStroke = runway.id === highlighted?.id ? '#16a34a' : '#475569';
              const overlayStroke = runway.id === highlighted?.id ? '#22c55e' : '#94a3b8';
              const strokeWidth = 6 + Math.min(4, ((runway.width ?? 150) - 75) / 75);

              const startX = center - dx;
              const startY = center + dy;
              const endX = center + dx;
              const endY = center - dy;
              const labelOffsetX = Math.cos(axis) * 10;
              const labelOffsetY = Math.sin(axis) * 10;

              return (
                <g key={runway.id}>
                  <line
                    x1={startX}
                    y1={startY}
                    x2={endX}
                    y2={endY}
                    stroke={overlayStroke}
                    strokeWidth={strokeWidth + 4}
                    strokeLinecap="round"
                    opacity={0.35}
                  />
                  <line
                    x1={startX}
                    y1={startY}
                    x2={endX}
                    y2={endY}
                    stroke={baseStroke}
                    strokeWidth={strokeWidth}
                    strokeLinecap="round"
                  />
                  <text
                    x={startX - labelOffsetX}
                    y={startY - labelOffsetY}
                    fontSize="10"
                    fontWeight="700"
                    textAnchor="middle"
                    fill={runway.bestEnd === 'le' && runway.id === highlighted?.id ? '#166534' : '#0f172a'}
                  >
                    {runway.labels.start}
                  </text>
                  <text
                    x={endX + labelOffsetX}
                    y={endY + labelOffsetY}
                    fontSize="10"
                    fontWeight="700"
                    textAnchor="middle"
                    fill={runway.bestEnd === 'he' && runway.id === highlighted?.id ? '#166534' : '#0f172a'}
                  >
                    {runway.labels.end}
                  </text>
                </g>
              );
            })}
          </svg>

          {highlighted && highlighted.headwind !== undefined && highlighted.crosswind !== undefined && (
            <div style={{ marginTop: 8, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
              <div style={{ padding: '8px 12px', borderRadius: 8, background: '#dcfce7', color: '#166534', fontWeight: 800 }}>
                Best: {highlighted.bestEnd === 'le'
                  ? highlighted.labels.start
                  : highlighted.bestEnd === 'he'
                    ? highlighted.labels.end
                    : `${highlighted.labels.start}/${highlighted.labels.end}`}
              </div>
              <div style={{ padding: '8px 12px', borderRadius: 8, background: '#eef2ff', color: '#3730a3', fontWeight: 700 }}>
                Headwind: {highlighted.headwind} kt
              </div>
              <div style={{ padding: '8px 12px', borderRadius: 8, background: '#e0f2fe', color: '#075985', fontWeight: 700 }}>
                Crosswind: {highlighted.crosswind} kt ({highlighted.crosswind >= 0 ? 'from right' : 'from left'})
              </div>
            </div>
          )}

          <div style={{ marginTop: 10, display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 8 }}>
            {visuals.map(runway => (
              <div key={`${runway.id}-summary`} style={{ padding: 10, borderRadius: 8, border: '1px solid #e2e8f0', background: '#fff' }}>
                <div style={{ fontWeight: 800, marginBottom: 4 }}>{runway.id}</div>
                <div style={{ fontSize: 12, color: '#475569' }}>
                  {runway.heading ? `Heading: ${runway.heading.toFixed(0)}°/${((runway.heading + 180) % 360 || 360).toFixed(0)}°` : 'Heading unavailable'}
                </div>
                <div style={{ fontSize: 12, color: '#475569' }}>
                  {runway.length ? `${Math.round(runway.length).toLocaleString()} ft` : 'Length unknown'}
                  {runway.surface && ` · ${runway.surface}`}
                </div>
                {runway.headwind !== undefined && runway.crosswind !== undefined && (
                  <div style={{ fontSize: 12, marginTop: 6 }}>
                    <span style={{ fontWeight: 700, color: '#166534' }}>{runway.headwind} kt</span> headwind /
                    <span style={{ fontWeight: 700, color: '#0f172a' }}> {runway.crosswind} kt</span> crosswind
                  </div>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function WeatherPage() {
  const { currentSession, completeStep, updateMetadata } = useFlightSession();

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
      runways: [],
      runwaysLoading: true,
      loading: true,
      error: '',
    };

    const insertIndex = airports.length;

    setAirports([...airports, newAirport]);
    setSelectedIndex(insertIndex);
    setIcaoInput('');

    console.log(`=== FETCHING WEATHER FOR ${icao} ===`);

    const metarData = await getMetar(icao);
    console.log('METAR data received:', metarData);

    let tafData = await getTaf(icao);
    console.log('TAF data received:', tafData);

    let tafIsNearby = false;
    let runwayData: Runway[] = [];
    let runwayError = '';

    if (!tafData && metarData) {
      console.log('No TAF available, searching for nearest TAF...');
      tafData = await getNearestTaf(icao);
      console.log('Nearest TAF result:', tafData);
      if (tafData) {
        tafIsNearby = true;
      }
    }

    try {
      runwayData = await getRunwaysForAirport(icao);
      if (runwayData.length === 0) {
        runwayError = `No runway data available for ${icao}`;
      }
    } catch (err) {
      console.error('Error fetching runways', err);
      runwayError = `Unable to load runway configuration for ${icao}`;
    }

    console.log('Final TAF data to be displayed:', tafData);
    console.log('TAF is from nearby airport:', tafIsNearby);

    setAirports(prev => prev.map((a, i) =>
      i === insertIndex ? {
        ...a,
        metar: metarData,
        taf: tafData,
        tafIsNearby,
        runways: runwayData,
        runwaysError: runwayError,
        runwaysLoading: false,
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

  useEffect(() => {
    const alternates = airports.slice(2).map((a) => a.icao);
    updateMetadata({ alternates });
  }, [airports, updateMetadata]);

  useEffect(() => {
    if (!currentSession || airports.length === 0) return;

    if (!currentSession.completed.weather) {
      completeStep('weather');
    }
  }, [airports.length, completeStep, currentSession]);

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

                  {/* Runway Favored Based on Wind */}
                  {selected.metar.wind && (
                    <RunwayDiagram
                      runways={selected.runways}
                      wind={selected.metar.wind}
                      loading={selected.runwaysLoading}
                      error={selected.runwaysError}
                      icao={selected.icao}
                    />
                  )}

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
                      console.log('=== TAF PARSING DEBUG ===');
                      console.log('Raw TAF text:', selected.taf.raw_text);
                      console.log('TAF timestamp from API:', selected.taf.timestamp);

                      // Parse issue time from raw TAF (format: TAF ICAO DDHHmmZ ...)
                      let issued = new Date();

                      if (selected.taf.timestamp?.issued) {
                        issued = new Date(selected.taf.timestamp.issued);
                        console.log('Using timestamp.issued from API:', selected.taf.timestamp.issued);
                        console.log('Parsed as Date:', issued);
                      } else {
                        console.log('No timestamp.issued from API, extracting from raw text...');
                        // Try to extract issue time from raw TAF text
                        // Format: TAF KENW 031120Z means issued on day 03 at 1120Z
                        const issueMatch = selected.taf.raw_text.match(/TAF\s+\w{4}\s+(\d{2})(\d{2})(\d{2})Z/);
                        console.log('Regex match result:', issueMatch);
                        if (issueMatch) {
                          const day = parseInt(issueMatch[1]);
                          const hour = parseInt(issueMatch[2]);
                          const minute = parseInt(issueMatch[3]);
                          console.log('Extracted - Day:', day, 'Hour:', hour, 'Minute:', minute);

                          // Use current month/year but set the day/hour/minute from TAF
                          const now = new Date();
                          issued = new Date(Date.UTC(
                            now.getUTCFullYear(),
                            now.getUTCMonth(),
                            day,
                            hour,
                            minute
                          ));
                          console.log('Constructed issued date:', issued);
                        } else {
                          console.warn('Could not extract issue time from TAF, using current time');
                        }
                      }

                      console.log('Final issued date for parsing:', issued);
                      console.log('Calling parseTAFAsForecast with options:', { issued });

                      const report = parseTAFAsForecast(selected.taf.raw_text, { issued });

                      console.log('parseTAFAsForecast result:', report);
                      console.log('Report start:', report.start);
                      console.log('Report end:', report.end);

                      if (!report.start || !report.end) {
                        console.warn('Report missing start or end time');
                        return null;
                      }

                      // Generate all hours in the TAF validity period
                      const allHours = eachHourOfInterval({
                        start: report.start,
                        end: report.end,
                      });

                      console.log('Total hours in TAF period:', allHours.length);
                      console.log('First hour:', allHours[0]);
                      console.log('Last hour:', allHours[allHours.length - 1]);

                      // Filter to only show next 24-30 hours from now for practical use
                      const now = new Date();
                      const maxHours = 30;
                      const relevantHours = allHours
                        .filter(hour => hour >= now) // Only future hours
                        .slice(0, maxHours); // Limit to next 30 hours

                      console.log('Current time:', now);
                      console.log('Filtered to relevant hours:', relevantHours.length);

                      if (relevantHours.length === 0) {
                        console.warn('No relevant future hours in TAF');
                        return (
                          <div style={{ padding: 12, borderRadius: 8, background: '#fffbeb', border: '1px solid #fbbf24', color: '#92400e', marginBottom: 16 }}>
                            <div style={{ fontWeight: 700, marginBottom: 4 }}>TAF Expired</div>
                            <div style={{ fontSize: 11 }}>
                              This TAF is no longer valid (ended {format(report.end, 'MMM d HH:mm')} UTC). See raw TAF below.
                            </div>
                          </div>
                        );
                      }

                      const hours = relevantHours;

                      return (
                        <div style={{ marginBottom: 16, overflowX: 'auto' }}>
                          <div style={{ fontSize: 12, fontWeight: 800, opacity: 0.7, marginBottom: 12 }}>
                            HOURLY FORECAST
                          </div>
                          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                            <thead>
                              <tr style={{ background: '#f3f4f6' }}>
                                <th style={{ padding: '8px 10px', textAlign: 'left', border: '1px solid #ddd', fontWeight: 800, minWidth: 80 }}>Zulu</th>
                                <th style={{ padding: '8px 10px', textAlign: 'left', border: '1px solid #ddd', fontWeight: 800, minWidth: 80 }}>Local</th>
                                <th style={{ padding: '8px 10px', textAlign: 'center', border: '1px solid #ddd', fontWeight: 800, minWidth: 80 }}>Wind</th>
                                <th style={{ padding: '8px 10px', textAlign: 'center', border: '1px solid #ddd', fontWeight: 800, minWidth: 60 }}>Vis</th>
                                <th style={{ padding: '8px 10px', textAlign: 'left', border: '1px solid #ddd', fontWeight: 800, minWidth: 120 }}>Weather</th>
                                <th style={{ padding: '8px 10px', textAlign: 'left', border: '1px solid #ddd', fontWeight: 800, minWidth: 150 }}>Clouds</th>
                                <th style={{ padding: '8px 10px', textAlign: 'center', border: '1px solid #ddd', fontWeight: 800, minWidth: 60 }}>Cat</th>
                              </tr>
                            </thead>
                            <tbody>
                              {hours.map((hour, i) => {
                                try {
                                  const { prevailing } = getCompositeForecastForDate(hour, report);

                                  if (!prevailing) {
                                    console.warn('No prevailing forecast for hour:', hour);
                                    return null;
                                  }

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
                                    {/* Zulu Time */}
                                    <td style={{ padding: '6px 10px', border: '1px solid #ddd', fontFamily: 'monospace', fontSize: 11, fontWeight: isCurrent ? 800 : 600 }}>
                                      {format(new Date(hour.toUTCString()), 'dd HH:mm')}Z
                                      {isCurrent && <span style={{ marginLeft: 6, color: '#2563eb' }}>●</span>}
                                    </td>
                                    {/* Local Time */}
                                    <td style={{ padding: '6px 10px', border: '1px solid #ddd', fontFamily: 'monospace', fontSize: 11, fontWeight: isCurrent ? 800 : 600, color: '#64748b' }}>
                                      {format(hour, 'dd HH:mm')}
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
                                } catch (hourError) {
                                  console.error('Error getting forecast for hour:', hour, hourError);
                                  return null;
                                }
                              })}
                            </tbody>
                          </table>
                        </div>
                      );
                    } catch (error) {
                      console.error('=== TAF PARSING ERROR ===');
                      console.error('Error object:', error);
                      console.error('Error message:', error instanceof Error ? error.message : String(error));
                      console.error('Error stack:', error instanceof Error ? error.stack : 'No stack trace');
                      console.error('TAF text that failed:', selected.taf.raw_text);
                      return (
                        <div style={{ padding: 12, borderRadius: 8, background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', marginBottom: 16 }}>
                          <div style={{ fontWeight: 700, marginBottom: 8 }}>Unable to parse TAF for hourly forecast</div>
                          <div style={{ fontSize: 11, fontFamily: 'monospace', opacity: 0.8 }}>
                            Error: {error instanceof Error ? error.message : String(error)}
                          </div>
                          <div style={{ fontSize: 11, marginTop: 8 }}>
                            Check browser console for details. Raw TAF shown below.
                          </div>
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
