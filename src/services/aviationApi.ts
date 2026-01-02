/**
 * Aviation Weather API Service
 * Integrates with CheckWX API for real-time METAR and TAF data
 * Documentation: https://www.checkwxapi.com/documentation
 */

// Type definitions for API responses
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
  humidity?: {
    percent: number;
  };
  wind?: {
    degrees: number;
    speed_kts: number;
    speed_mph: number;
    gust_kts?: number;
    gust_mph?: number;
  };
  visibility?: {
    miles: string;
    miles_float: number;
    meters: string;
    meters_float: number;
  };
  conditions?: Array<{
    code: string;
    text: string;
  }>;
  clouds?: Array<{
    code: string;
    text: string;
    feet: number;
    meters: number;
  }>;
  ceiling?: {
    code: string;
    feet: number;
    meters: number;
    text: string;
  };
  flight_category?: string; // VFR, MVFR, IFR, LIFR
  elevation?: {
    feet: number;
    meters: number;
  };
};

export type MetarResponse = {
  results: number;
  data: MetarData[];
};

export type TafData = {
  icao: string;
  raw_text: string;
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
    conditions?: Array<{
      code: string;
      text: string;
    }>;
  }>;
};

export type TafResponse = {
  results: number;
  data: TafData[];
};

const API_BASE_URL = 'https://api.checkwx.com';
const API_KEY = import.meta.env.VITE_CHECKWX_API_KEY;

/**
 * Fetch METAR data for a given ICAO code
 * @param icao - 4-letter ICAO airport code (e.g., 'KJFK')
 * @returns METAR data or null if unavailable
 */
export async function getMetar(icao: string): Promise<MetarData | null> {
  if (!API_KEY) {
    console.warn('CheckWX API key not configured. Set VITE_CHECKWX_API_KEY in .env.local');
    return null;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/metar/${icao.toUpperCase()}/decoded`, {
      headers: {
        'X-API-Key': API_KEY,
      },
    });

    if (!response.ok) {
      console.error(`CheckWX API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data: MetarResponse = await response.json();

    if (data.results === 0 || !data.data || data.data.length === 0) {
      console.warn(`No METAR data available for ${icao}`);
      return null;
    }

    return data.data[0];
  } catch (error) {
    console.error('Error fetching METAR data:', error);
    return null;
  }
}

/**
 * Fetch TAF (Terminal Aerodrome Forecast) data for a given ICAO code
 * @param icao - 4-letter ICAO airport code (e.g., 'KJFK')
 * @returns TAF data or null if unavailable
 */
export async function getTaf(icao: string): Promise<TafData | null> {
  if (!API_KEY) {
    console.warn('CheckWX API key not configured. Set VITE_CHECKWX_API_KEY in .env.local');
    return null;
  }

  try {
    const response = await fetch(`${API_BASE_URL}/taf/${icao.toUpperCase()}/decoded`, {
      headers: {
        'X-API-Key': API_KEY,
      },
    });

    if (!response.ok) {
      console.error(`CheckWX API error: ${response.status} ${response.statusText}`);
      return null;
    }

    const data: TafResponse = await response.json();

    if (data.results === 0 || !data.data || data.data.length === 0) {
      console.warn(`No TAF data available for ${icao}`);
      return null;
    }

    return data.data[0];
  } catch (error) {
    console.error('Error fetching TAF data:', error);
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
