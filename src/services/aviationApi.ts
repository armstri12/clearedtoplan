/**
 * Aviation Weather API Service
 *
 * This module provides integration with AviationWeather.gov (NOAA) for real-time aviation weather data.
 * It fetches METAR (surface observations) and TAF (terminal forecasts) for airports worldwide.
 *
 * Key Features:
 * - Fetches current METAR observations with decoded data (temperature, wind, pressure, etc.)
 * - Retrieves TAF forecasts with hourly breakdowns
 * - Automatically finds nearest TAF when primary airport doesn't have one
 * - Normalizes API responses to consistent format
 * - Handles pressure unit conversions (mb/hPa to inHg)
 * - Uses Cloudflare Worker proxy to bypass CORS restrictions
 *
 * Architecture:
 * 1. Raw API types (AvWxMetarRaw, AvWxTafRaw) - direct from AviationWeather.gov
 * 2. Normalized types (MetarData, TafData) - consistent interface for UI
 * 3. Helper functions for unit conversions and data normalization
 * 4. Public API functions (getMetar, getTaf, getNearestTaf)
 *
 * Important Fix (2026-01-03):
 * - The API sometimes returns altimeter in mb instead of inHg despite field docs
 * - convertPressure() now detects values >100 and converts mb→inHg automatically
 * - Example: 1016.7 mb is converted to 30.02 inHg
 *
 * External Documentation: https://aviationweather.gov/data/api/
 *
 * @module aviationApi
 */

/**
 * Raw METAR response type from AviationWeather.gov API
 * This represents the direct API response before normalization
 */
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

/**
 * Raw TAF (Terminal Aerodrome Forecast) response type from AviationWeather.gov API
 * Contains forecast periods and predicted conditions
 */
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

/**
 * Normalized METAR data type for application use
 * Provides a consistent interface regardless of API changes
 * Compatible with CheckWX format for potential future migration
 *
 * @property icao - 4-letter ICAO airport code (e.g., "KJFK")
 * @property name - Airport name (e.g., "John F Kennedy International Airport")
 * @property observed - Observation timestamp in ISO format
 * @property raw_text - Raw METAR text as transmitted
 * @property barometer - Pressure readings in multiple units (hg, hpa, kpa, mb)
 * @property temperature - Temperature in Celsius and Fahrenheit
 * @property dewpoint - Dewpoint in Celsius and Fahrenheit
 * @property wind - Wind direction (degrees), speed and gust (knots)
 * @property visibility - Visibility in statute miles
 * @property clouds - Cloud layer information (coverage and altitude)
 * @property flight_category - VFR, MVFR, IFR, or LIFR
 * @property elevation - Airport elevation in feet and meters
 */
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

/**
 * Normalized TAF (Terminal Aerodrome Forecast) data type
 *
 * @property icao - 4-letter ICAO airport code
 * @property raw_text - Raw TAF text as transmitted
 * @property name - Airport name
 * @property timestamp - Issue and bulletin times
 * @property forecast - Array of forecast periods with conditions
 */
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

// Configuration - Cloudflare Worker URL for proxying API requests
const WORKER_URL = import.meta.env.VITE_WEATHER_API_URL || '';

/**
 * Converts temperature from Celsius to Fahrenheit
 * @param c - Temperature in Celsius
 * @returns Temperature in Fahrenheit, rounded to 1 decimal place
 */
function celsiusToFahrenheit(c: number): number {
  return Math.round((c * 9 / 5 + 32) * 10) / 10;
}

/**
 * Converts distance from meters to feet
 * @param m - Distance in meters
 * @returns Distance in feet, rounded to nearest integer
 */
function metersToFeet(m: number): number {
  return Math.round(m * 3.28084);
}

/**
 * Converts pressure between units and handles API inconsistencies
 *
 * CRITICAL FIX: The AviationWeather.gov API sometimes returns the altimeter
 * field in mb/hPa instead of inHg, despite documentation stating otherwise.
 * This function detects values >100 (which must be mb) and converts them.
 *
 * @param altimInHg - Altimeter setting (supposed to be inHg, but may be mb)
 * @param slpMb - Sea level pressure in millibars
 * @returns Object with pressure in all units: hg, hpa, kpa, mb
 *
 * @example
 * // When API incorrectly returns mb as altim:
 * convertPressure(1016.7) // Detects >100, converts: { hg: 30.02, mb: 1016.7, ... }
 *
 * // Normal case with correct inHg:
 * convertPressure(29.92) // { hg: 29.92, mb: 1013.2, ... }
 */
function convertPressure(altimInHg?: number, slpMb?: number) {
  // Bug fix: API sometimes returns altim in mb instead of inHg
  // Detect if altim looks like mb (>100) and convert it
  let hgValue = altimInHg;
  let mbValue = slpMb;

  if (altimInHg && altimInHg > 100) {
    // Value is in mb/hPa, not inHg - convert it
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
 * Calculate distance between two lat/lon points using Haversine formula
 * @returns distance in nautical miles
 */
function calculateDistance(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3440.065; // Earth's radius in nautical miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

/**
 * Fetch nearest TAF when primary airport doesn't have one
 * Searches within expanding radius (50nm, then 100nm, then 150nm)
 * @param icao - 4-letter ICAO airport code
 * @returns TAF data from nearest airport or null
 */
export async function getNearestTaf(icao: string): Promise<TafData | null> {
  if (!WORKER_URL) {
    return null;
  }

  try {
    // First get METAR to get coordinates
    const metarUrl = `${WORKER_URL}/metar?ids=${icao.toUpperCase()}&format=json`;
    const metarResponse = await fetch(metarUrl);

    if (!metarResponse.ok) {
      console.warn(`Failed to fetch METAR for ${icao} to find nearby TAF`);
      return null;
    }

    const metarData: AvWxMetarRaw[] = await metarResponse.json();

    if (!metarData || metarData.length === 0 || !metarData[0].lat || !metarData[0].lon) {
      console.warn(`No coordinates available for ${icao} to search for nearby TAF`);
      return null;
    }

    const { lat, lon } = metarData[0];

    // Try expanding search radii: 50nm, 100nm, 150nm
    const searchRadii = [0.75, 1.5, 2.25]; // degrees (roughly 50nm, 100nm, 150nm)

    for (const degreeOffset of searchRadii) {
      const minLat = lat - degreeOffset;
      const maxLat = lat + degreeOffset;
      const minLon = lon - degreeOffset;
      const maxLon = lon + degreeOffset;

      const tafUrl = `${WORKER_URL}/taf?bbox=${minLon},${minLat},${maxLon},${maxLat}&format=json`;
      console.log(`Searching for nearby TAF for ${icao} at (${lat}, ${lon}) with ${degreeOffset * 67}nm radius`);

      const response = await fetch(tafUrl);

      if (!response.ok) {
        console.warn(`Failed to fetch nearby TAFs: ${response.status}`);
        continue;
      }

      const data: AvWxTafRaw[] = await response.json();
      console.log(`Found ${data?.length || 0} TAFs in area:`, data?.map(t => t.icaoId));

      if (!data || data.length === 0) {
        continue;
      }

      // Filter out the original airport and calculate distances
      const nearbyTafsWithDistance = data
        .filter(taf => taf.icaoId !== icao.toUpperCase() && taf.lat !== undefined && taf.lon !== undefined)
        .map(taf => ({
          taf,
          distance: calculateDistance(lat, lon, taf.lat!, taf.lon!)
        }))
        .sort((a, b) => a.distance - b.distance);

      console.log(`Nearby TAFs with distances:`, nearbyTafsWithDistance.map(t =>
        `${t.taf.icaoId} (${Math.round(t.distance)}nm)`
      ));

      if (nearbyTafsWithDistance.length > 0) {
        const nearest = nearbyTafsWithDistance[0];
        console.log(`Using nearest TAF from ${nearest.taf.icaoId} (${Math.round(nearest.distance)}nm away)`);
        return normalizeTaf(nearest.taf);
      }
    }

    console.warn(`No TAFs found within 150nm of ${icao}`);
    return null;
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
