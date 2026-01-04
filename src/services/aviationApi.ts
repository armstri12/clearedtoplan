/**
 * Aviation Weather API Service - Simplified
 *
 * Fetches METAR and TAF data from AviationWeather.gov via Cloudflare Worker proxy.
 * Normalizes API responses and handles pressure unit conversions.
 *
 * @module aviationApi
 */

// Raw API response types
type AvWxMetarRaw = {
  icaoId: string;
  receiptTime?: string;
  obsTime?: number;
  reportTime?: string;
  temp?: number;
  dewp?: number;
  wdir?: number;
  wspd?: number;
  wgst?: number;
  visib?: string;
  altim?: number;
  slp?: number;
  wxString?: string;
  rawOb: string;
  name?: string;
  lat?: number;
  lon?: number;
  elev?: number;
  fltcat?: string;
  clouds?: Array<{
    cover?: string;
    base?: number;
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

// Normalized data types for application use
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
  flight_category?: string;
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

const WORKER_URL = (import.meta?.env?.VITE_WEATHER_API_URL as string | undefined) || '';

// Helper functions
function celsiusToFahrenheit(c: number): number {
  return Math.round((c * 9 / 5 + 32) * 10) / 10;
}

function metersToFeet(m: number): number {
  return Math.round(m * 3.28084);
}

/**
 * Converts pressure and handles API inconsistencies (mb vs inHg)
 */
function convertPressure(altimInHg?: number, slpMb?: number) {
  let hgValue = altimInHg;
  let mbValue = slpMb;

  // API sometimes returns altim in mb instead of inHg - detect and convert
  if (altimInHg && altimInHg > 100) {
    mbValue = altimInHg;
    hgValue = altimInHg * 0.02953;
  }

  const hg = hgValue || (mbValue ? mbValue * 0.02953 : 29.92);
  const mb = mbValue || (hgValue ? hgValue / 0.02953 : 1013);

  return {
    hg: Math.round(hg * 100) / 100,
    hpa: Math.round(mb * 10) / 10,
    kpa: Math.round(mb * 0.1 * 100) / 100,
    mb: Math.round(mb * 10) / 10,
  };
}

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
 */
export async function getMetar(icao: string): Promise<MetarData | null> {
  if (!WORKER_URL) {
    console.warn('Weather API URL not configured. Set VITE_WEATHER_API_URL in .env.local');
    return null;
  }

  try {
    const url = `${WORKER_URL}/metar?ids=${icao.toUpperCase()}&format=json`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`API error: ${response.status}`);
      return null;
    }

    const data: AvWxMetarRaw[] = await response.json();

    if (!data || data.length === 0) {
      return null;
    }

    return normalizeMetar(data[0]);
  } catch (error) {
    console.error('Error fetching METAR:', error);
    return null;
  }
}

/**
 * Fetch TAF data for a given ICAO code
 */
export async function getTaf(icao: string): Promise<TafData | null> {
  if (!WORKER_URL) {
    console.warn('Weather API URL not configured. Set VITE_WEATHER_API_URL in .env.local');
    return null;
  }

  try {
    const url = `${WORKER_URL}/taf?ids=${icao.toUpperCase()}&format=json`;
    const response = await fetch(url);

    if (!response.ok) {
      console.error(`API error: ${response.status}`);
      return null;
    }

    const data: AvWxTafRaw[] = await response.json();

    if (!data || data.length === 0) {
      return null;
    }

    return normalizeTaf(data[0]);
  } catch (error) {
    console.error('Error fetching TAF:', error);
    return null;
  }
}

/**
 * Parse ICAO code from user input
 */
export function parseIcaoCode(input: string): string | null {
  const clean = input.trim().toUpperCase();
  if (clean.length === 3 || clean.length === 4) {
    return clean.length === 3 ? `K${clean}` : clean;
  }
  return null;
}
