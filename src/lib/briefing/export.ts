import type {
  BriefContent,
  FlightPlanBasics,
  LoadingPlan,
  PerformancePlan,
  WeatherAndNotams,
  WeatherSnapshot,
} from '../../stores/flightPlan';
import type { DistanceResults } from '../performance/takeoffLanding';

export type BriefingSnapshot = {
  basics: FlightPlanBasics;
  weather: WeatherAndNotams;
  performance: PerformancePlan;
  loading: LoadingPlan;
  brief: BriefContent;
};

export type PrintableRow = {
  label: string;
  value: string;
};

export type PrintableSection = {
  title: string;
  rows: PrintableRow[];
};

function formatDate(value?: string) {
  if (!value) return '---';
  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? value : parsed.toLocaleString();
}

function formatNullableNumber(value?: number, suffix = '') {
  if (value === null || value === undefined || Number.isNaN(value)) return '---';
  return `${value.toLocaleString()}${suffix}`;
}

function formatCorrections(results?: DistanceResults) {
  if (!results) {
    return 'Waiting for POH inputs';
  }

  const parts = results.corrections.map((item) => `${item.factor}: ${item.description} (×${item.multiplier.toFixed(2)})`);
  parts.push(`Safety margin ×${results.safetyMargin}`);
  return parts.join('; ');
}

function formatNotams(snapshot: WeatherSnapshot) {
  if (!snapshot.notams || snapshot.notams.length === 0) return 'None captured';
  return snapshot.notams.join(' • ');
}

function formatWeatherSnippet(label: string, snapshot: WeatherSnapshot) {
  const metar = snapshot.metar?.raw_text ? `METAR ${snapshot.metar.raw_text}` : 'METAR not fetched';
  const taf = snapshot.taf?.raw_text ? `TAF ${snapshot.taf.raw_text}` : 'TAF not fetched';
  const notams = formatNotams(snapshot);
  const fetched = snapshot.fetchedAt ? `Updated ${new Date(snapshot.fetchedAt).toLocaleString()}` : 'Not cached';

  return `**${label} (${snapshot.icao ?? '----'})**\n- ${metar}\n- ${taf}\n- NOTAMs: ${notams}\n- ${fetched}`;
}

export function buildPrintableSections(snapshot: BriefingSnapshot): PrintableSection[] {
  const takeoffResults = snapshot.performance.takeoff?.results;
  const landingResults = snapshot.performance.landing?.results;

  return [
    {
      title: 'Route & Timing',
      rows: [
        { label: 'Title', value: snapshot.basics.title || 'Flight Brief' },
        { label: 'Pilot', value: snapshot.basics.pilot || '---' },
        { label: 'Route', value: snapshot.basics.route || '---' },
        { label: 'From', value: snapshot.basics.departure || '---' },
        { label: 'To', value: snapshot.basics.destination || '---' },
        { label: 'ETD', value: snapshot.basics.etd || formatDate(snapshot.basics.departureTime) },
        { label: 'ETA', value: snapshot.basics.eta || '---' },
        { label: 'Notes', value: snapshot.basics.notes || snapshot.brief.summary || '---' },
      ],
    },
    {
      title: 'Weather & NOTAMs',
      rows: [
        { label: 'Departure ICAO', value: snapshot.weather.departure.icao || snapshot.basics.departure || '---' },
        { label: 'Departure METAR', value: snapshot.weather.departure.metar?.raw_text || 'No METAR' },
        { label: 'Departure TAF', value: snapshot.weather.departure.taf?.raw_text || 'No TAF' },
        { label: 'Departure NOTAMs', value: formatNotams(snapshot.weather.departure) },
        { label: 'Destination ICAO', value: snapshot.weather.destination.icao || snapshot.basics.destination || '---' },
        { label: 'Destination METAR', value: snapshot.weather.destination.metar?.raw_text || 'No METAR' },
        { label: 'Destination TAF', value: snapshot.weather.destination.taf?.raw_text || 'No TAF' },
        { label: 'Destination NOTAMs', value: formatNotams(snapshot.weather.destination) },
        { label: 'Briefing notes', value: snapshot.weather.briefingNotes || '---' },
      ],
    },
    {
      title: 'Performance & Loading',
      rows: [
        { label: 'Pressure altitude', value: formatNullableNumber(snapshot.performance.pressureAltitudeFt, ' ft') },
        { label: 'Density altitude', value: formatNullableNumber(snapshot.performance.densityAltitudeFt, ' ft') },
        { label: 'Takeoff: 50 ft', value: takeoffResults ? `${takeoffResults.over50ft.toLocaleString()} ft` : '---' },
        { label: 'Takeoff corrections', value: formatCorrections(takeoffResults) },
        { label: 'Landing: 50 ft', value: landingResults ? `${landingResults.over50ft.toLocaleString()} ft` : '---' },
        { label: 'Landing corrections', value: formatCorrections(landingResults) },
        {
          label: 'Weights',
          value: [
            snapshot.loading.takeoffWeight ? `TO ${snapshot.loading.takeoffWeight} lb` : null,
            snapshot.loading.landingWeight ? `LDG ${snapshot.loading.landingWeight} lb` : null,
            snapshot.loading.centerOfGravity ? `CG ${snapshot.loading.centerOfGravity}"` : null,
          ]
            .filter(Boolean)
            .join(' • ') || '---',
        },
        { label: 'Fuel policy', value: snapshot.basics.fuelPolicy || '---' },
        { label: 'Payload notes', value: snapshot.loading.payloadNotes || snapshot.performance.remarks || '---' },
      ],
    },
  ];
}

export function buildBriefingMarkdown(snapshot: BriefingSnapshot) {
  const title = snapshot.basics.title || 'Flight Brief';
  const summaryLine = snapshot.brief.summary || `Route: ${snapshot.basics.departure ?? '---'} → ${snapshot.basics.destination ?? '---'}`;
  const takeoffResults = snapshot.performance.takeoff?.results;
  const landingResults = snapshot.performance.landing?.results;

  const lines = [
    `# ${title}`,
    '',
    summaryLine,
    '',
    '## Route & Timing',
    `- From: ${snapshot.basics.departure || '---'}`,
    `- To: ${snapshot.basics.destination || '---'}`,
    `- Route: ${snapshot.basics.route || '---'}`,
    `- ETD: ${snapshot.basics.etd || formatDate(snapshot.basics.departureTime)}`,
    `- ETA: ${snapshot.basics.eta || '---'}`,
    `- Aircraft: ${snapshot.basics.aircraftIdent || snapshot.basics.aircraftType || '---'}`,
    '',
    '## Weather & NOTAMs',
    formatWeatherSnippet('Departure', snapshot.weather.departure),
    '',
    formatWeatherSnippet('Destination', snapshot.weather.destination),
    '',
  ];

  if (snapshot.weather.briefingNotes) {
    lines.push('Briefing notes:', snapshot.weather.briefingNotes, '');
  }

  lines.push('## Performance & Loading');
  lines.push(`- Pressure altitude: ${formatNullableNumber(snapshot.performance.pressureAltitudeFt, ' ft')}`);
  lines.push(`- Density altitude: ${formatNullableNumber(snapshot.performance.densityAltitudeFt, ' ft')}`);

  if (takeoffResults) {
    lines.push(
      `- Takeoff over 50 ft: ${takeoffResults.over50ft.toLocaleString()} ft (baseline ${takeoffResults.baselineOver50ft.toLocaleString()} ft; ${formatCorrections(takeoffResults)})`,
    );
  }

  if (landingResults) {
    lines.push(
      `- Landing over 50 ft: ${landingResults.over50ft.toLocaleString()} ft (baseline ${landingResults.baselineOver50ft.toLocaleString()} ft; ${formatCorrections(landingResults)})`,
    );
  }

  lines.push(
    `- Weights: ${
      [
        snapshot.loading.rampWeight ? `Ramp ${snapshot.loading.rampWeight} lb` : null,
        snapshot.loading.takeoffWeight ? `TO ${snapshot.loading.takeoffWeight} lb` : null,
        snapshot.loading.landingWeight ? `LDG ${snapshot.loading.landingWeight} lb` : null,
        snapshot.loading.centerOfGravity ? `CG ${snapshot.loading.centerOfGravity}"` : null,
      ]
        .filter(Boolean)
        .join(' • ') || '---'
    }`,
  );

  lines.push(`- Fuel policy: ${snapshot.basics.fuelPolicy || '---'}`);
  lines.push(`- Payload notes: ${snapshot.loading.payloadNotes || snapshot.performance.remarks || '---'}`);

  return lines.join('\n');
}
