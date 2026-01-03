export type RunwayEnd = {
  ident: string;
  heading: number | null;
};

export type Runway = {
  le: RunwayEnd;
  he: RunwayEnd;
  lengthFt: number | null;
  widthFt: number | null;
  surface?: string;
};

const RUNWAYS_DATA_URL = import.meta.env.VITE_RUNWAYS_DATA_URL || 'https://davidmegginson.github.io/ourairports-data/runways.csv';

let runwayDatasetPromise: Promise<Map<string, Runway[]>> | null = null;

function parseCsvLine(line: string): string[] {
  const values: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i += 1) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      values.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  values.push(current);
  return values;
}

function parseNumber(value: string | undefined): number | null {
  if (!value) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
}

function normalizeHeading(heading: number | null): number | null {
  if (heading === null) return null;
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

async function loadRunwayDataset(): Promise<Map<string, Runway[]>> {
  if (runwayDatasetPromise) {
    return runwayDatasetPromise;
  }

  runwayDatasetPromise = (async () => {
    const response = await fetch(RUNWAYS_DATA_URL);
    if (!response.ok) {
      throw new Error(`Failed to load runway dataset (${response.status})`);
    }

    const text = await response.text();
    const lines = text.split('\n').filter(Boolean);

    // OurAirports runways.csv header:
    // id,airport_ref,airport_ident,length_ft,width_ft,surface,lighted,closed,le_ident,...,le_heading_degT,...,he_ident,...,he_heading_degT,...
    const dataset = new Map<string, Runway[]>();

    for (const line of lines.slice(1)) {
      const columns = parseCsvLine(line);
      if (columns.length < 19) continue;

      const airportIdent = columns[2]?.trim().toUpperCase();
      if (!airportIdent) continue;

      const leIdent = columns[8]?.trim();
      const heIdent = columns[14]?.trim();

      const leHeading = normalizeHeading(parseNumber(columns[12])) ?? headingFromIdent(leIdent);
      const heHeading = normalizeHeading(parseNumber(columns[18])) ?? headingFromIdent(heIdent);

      const runway: Runway = {
        le: {
          ident: leIdent || '',
          heading: leHeading,
        },
        he: {
          ident: heIdent || '',
          heading: heHeading,
        },
        lengthFt: parseNumber(columns[3]),
        widthFt: parseNumber(columns[4]),
        surface: columns[5]?.trim(),
      };

      const existing = dataset.get(airportIdent) || [];
      existing.push(runway);
      dataset.set(airportIdent, existing);
    }

    return dataset;
  })();

  return runwayDatasetPromise;
}

export async function getRunwaysForAirport(icao: string): Promise<Runway[]> {
  if (!icao) return [];

  const dataset = await loadRunwayDataset();
  const runways = dataset.get(icao.toUpperCase()) || [];

  return runways.map(runway => ({
    ...runway,
    le: {
      ...runway.le,
      heading: runway.le.heading ?? headingFromIdent(runway.le.ident),
    },
    he: {
      ...runway.he,
      heading: runway.he.heading ?? headingFromIdent(runway.he.ident),
    },
  }));
}
