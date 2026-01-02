/**
 * Aviation Weather API Service
 * Integrates with AviationWeather.gov (NOAA) for real-time METAR and TAF data
 * Uses Cloudflare Worker proxy to bypass CORS restrictions
 *
 * Documentation: https://aviationweather.gov/data/api/
 */

// AviationWeather.gov raw response types
type AvWxMetarRaw = {
  icaoId: string;
  receiptTime?: string;
  obsTime?: number;
  reportTime?: string;
  temp?: number; // Celsius
  dewp?: number; // Celsius
  wdir?: number; // Wind direction in degrees
  wspd?: number; // Wind speed in knots
  wgst?: number; // Wind gust in knots
  visib?: string; // Visibility in statute miles
  altim?: number; // Altimeter in inHg
  slp?: number; // Sea level pressure in mb
  wxString?: string; // Weather phenomena
  rawOb: string; // Raw METAR text
  name?: string; // Airport name
  lat?: number;
  lon?: number;
  elev?: number; // Elevation in meters
  fltcat?: string; // Flight category: VFR, MVFR, IFR, LIFR
  clouds?: Array<{
    cover?: string; // SKC, FEW, SCT, BKN, OVC
    base?: number; // Cloud base in feet AGL
  }>;
};

type AvWxTafRaw = {
  icaoId: string;
  issueTime?: string;
  bulletinTime?: string;
  validTimeFrom?: string;
  validTimeTo?: string;
  rawTAF: string;
  lat?: number;
  lon?: number;
  elev?: number;
  name?: string;
  fcsts?: Array<{
    fcstTime?: string;
    timeFrom?: string;
    timeTo?: string;
    temp?: number;
    wspd?: number;
    wdir?: number;
    visib?: string;
    altim?: number;
    clouds?: Array<{
      cover?: string;
      base?: number;
    }>;
  }>;
};

// Normalized types for our UI (similar interface to CheckWX for compatibility)
export type MetarData = {
  icao: string;
  name?: string;
  observed?: string;
  raw_text: string;
  barometer?: {
    hg: number;
    hpa: number;
    kpa: number;
    mb: number;
  };
  temperature?: {
    celsius: number;
    fahrenheit: number;
  };
  dewpoint?: {
    celsius: number;
    fahrenheit: number;
  };
  wind?: {
    degrees: number;
    speed_kts: number;
    gust_kts?: number;
  };
  visibility?: {
    miles: string;
    miles_float: number;
  };
  clouds?: Array<{
    code: string;
    text: string;
    feet: number;
  }>;
  flight_category?: string; // VFR, MVFR, IFR, LIFR
  elevation?: {
    feet: number;
    meters: number;
  };
};

export type TafData = {
  icao: string;
  raw_text: string;
  name?: string;
  timestamp?: {
    issued: string;
    bulletin: string;
  };
  forecast?: Array<{
    timestamp: {
      from: string;
      to: string;
    };
    wind?: {
      degrees: number;
      speed_kts: number;
    };
    visibility?: {
      miles: string;
    };
  }>;
};

// Configuration
const WORKER_URL = import.meta.env.VITE_WEATHER_API_URL || '';

// Helper to convert Celsius to Fahrenheit
function celsiusToFahrenheit(c: number): number {
  return Math.round((c * 9 / 5 + 32) * 10) / 10;
}

// Helper to convert meters to feet
function metersToFeet(m: number): number {
  return Math.round(m * 3.28084);
}

// Helper to convert mb to various pressure units
function convertPressure(altimInHg?: number, slpMb?: number) {
  const hg = altimInHg || (slpMb ? slpMb * 0.02953 : 29.92);
  const mb = slpMb || (altimInHg ? altimInHg / 0.02953 : 1013);
  return {
    hg: Math.round(hg * 100) / 100,
    hpa: Math.round(mb * 10) / 10,
    kpa: Math.round(mb * 0.1 * 100) / 100,
    mb: Math.round(mb * 10) / 10,
  };
}

/**
 * Normalize AviationWeather.gov METAR response to our MetarData format
 */
function normalizeMetar(raw: AvWxMetarRaw): MetarData {
  return {
    icao: raw.icaoId,
    name: raw.name,
    observed: raw.reportTime,
    raw_text: raw.rawOb,
    barometer: raw.altim || raw.slp ? convertPressure(raw.altim, raw.slp) : undefined,
    temperature: raw.temp !== undefined ? {
      celsius: raw.temp,
      fahrenheit: celsiusToFahrenheit(raw.temp),
    } : undefined,
    dewpoint: raw.dewp !== undefined ? {
      celsius: raw.dewp,
      fahrenheit: celsiusToFahrenheit(raw.dewp),
    } : undefined,
    wind: raw.wspd !== undefined || raw.wdir !== undefined ? {
      degrees: raw.wdir || 0,
      speed_kts: raw.wspd || 0,
      gust_kts: raw.wgst,
    } : undefined,
    visibility: raw.visib ? {
      miles: raw.visib,
      miles_float: parseFloat(raw.visib) || 0,
    } : undefined,
    clouds: raw.clouds?.map(cloud => ({
      code: cloud.cover || 'UNK',
      text: cloud.cover || 'Unknown',
      feet: cloud.base || 0,
    })),
    flight_category: raw.fltcat,
    elevation: raw.elev !== undefined ? {
      feet: metersToFeet(raw.elev),
      meters: raw.elev,
    } : undefined,
  };
}

/**
 * Normalize AviationWeather.gov TAF response to our TafData format
 */
function normalizeTaf(raw: AvWxTafRaw): TafData {
  return {
    icao: raw.icaoId,
    name: raw.name,
    raw_text: raw.rawTAF,
    timestamp: raw.issueTime || raw.bulletinTime ? {
      issued: raw.issueTime || '',
      bulletin: raw.bulletinTime || '',
    } : undefined,
    forecast: raw.fcsts?.map(fcst => ({
      timestamp: {
        from: fcst.timeFrom || '',
        to: fcst.timeTo || '',
      },
      wind: fcst.wspd !== undefined || fcst.wdir !== undefined ? {
        degrees: fcst.wdir || 0,
        speed_kts: fcst.wspd || 0,
      } : undefined,
      visibility: fcst.visib ? {
        miles: fcst.visib,
      } : undefined,
    })),
  };
}

/**
 * Fetch METAR data for a given ICAO code
 * @param icao - 4-letter ICAO airport code (e.g., 'KJFK')
 * @returns METAR data or null if unavailable
 */
export async function getMetar(icao: string): Promise<MetarData | null> {
  if (!WORKER_URL) {
    console.warn(
      'Weather API URL not configured. Set VITE_WEATHER_API_URL in .env.local to your Cloudflare Worker URL.\n' +
      'See WEATHER_API_SETUP.md for setup instructions.'
    );
    return null;
  }

  try {
    const url = `${WORKER_URL}/metar?ids=${icao.toUpperCase()}&format=json`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`AviationWeather.gov API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data: AvWxMetarRaw[] = await response.json();

    if (!data || data.length === 0) {
      console.warn(`No METAR data available for ${icao}`);
      return null;
    }

    return normalizeMetar(data[0]);
  } catch (error) {
    console.error('Error fetching METAR data:', error);
    return null;
  }
}

/**
 * Fetch TAF (Terminal Aerodrome Forecast) data for a given ICAO code
 * If no TAF is available, attempts to find the nearest airport with a TAF
 * @param icao - 4-letter ICAO airport code (e.g., 'KJFK')
 * @returns TAF data or null if unavailable
 */
export async function getTaf(icao: string): Promise<TafData | null> {
  if (!WORKER_URL) {
    console.warn(
      'Weather API URL not configured. Set VITE_WEATHER_API_URL in .env.local to your Cloudflare Worker URL.\n' +
      'See WEATHER_API_SETUP.md for setup instructions.'
    );
    return null;
  }

  try {
    const url = `${WORKER_URL}/taf?ids=${icao.toUpperCase()}&format=json`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`AviationWeather.gov API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data: AvWxTafRaw[] = await response.json();

    if (!data || data.length === 0) {
      console.warn(`No TAF data available for ${icao}`);
      return null;
    }

    return normalizeTaf(data[0]);
  } catch (error) {
    console.error('Error fetching TAF data:', error);
    return null;
  }
}

/**
 * Fetch nearest TAF when primary airport doesn't have one
 * Uses radial search around the METAR location
 * @param icao - 4-letter ICAO airport code
 * @returns TAF data from nearest airport or null
 */
export async function getNearestTaf(icao: string): Promise<TafData | null> {
  if (!WORKER_URL) {
    return null;
  }

  try {
    // First get METAR to get coordinates
    const metar = await getMetar(icao);
    if (!metar || !metar.elevation) {
      return null;
    }

    // Try to get TAF within a radius (using radialDistance parameter)
    // This searches for TAFs within ~50nm of the airport
    const url = `${WORKER_URL}/taf?radialDistance=50;${icao.toUpperCase()}&format=json`;
    const response = await fetch(url);

    if (!response.ok) {
      return null;
    }

    const data: AvWxTafRaw[] = await response.json();

    if (!data || data.length === 0) {
      return null;
    }

    // Return the first (nearest) TAF found
    const nearestTaf = normalizeTaf(data[0]);
    return nearestTaf;
  } catch (error) {
    console.error('Error fetching nearest TAF:', error);
    return null;
  }
}

/**
 * Parse ICAO code from user input (handles uppercase conversion and validation)
 * @param input - User input (e.g., 'kjfk', 'KJFK')
 * @returns Uppercase ICAO code or null if invalid
 */
export function parseIcaoCode(input: string): string | null {
  const clean = input.trim().toUpperCase();

  // Basic validation: 4 letters
  if (!/^[A-Z]{4}$/.test(clean)) {
    return null;
  }

  return clean;
}
