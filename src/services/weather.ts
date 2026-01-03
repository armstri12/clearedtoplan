import { getMetar, getTaf, parseIcaoCode, type MetarData, type TafData } from './aviationApi';

const WEATHER_API_URL = import.meta.env.VITE_WEATHER_API_URL;

export type WeatherPackage = {
  icao: string;
  metar: MetarData | null;
  taf: TafData | null;
  workerUrl: string;
  requestedAt: string;
};

function assertWeatherConfigured() {
  if (!WEATHER_API_URL) {
    throw new Error(
      'Weather API URL not configured. Set VITE_WEATHER_API_URL to your Cloudflare Worker URL. ' +
      'See WEATHER_API_SETUP.md for details.',
    );
  }
}

export async function fetchMetarFromWorker(icao: string): Promise<MetarData | null> {
  assertWeatherConfigured();
  const cleaned = parseIcaoCode(icao);
  if (!cleaned) {
    throw new Error('Invalid ICAO code. Please provide a 4-letter ICAO (e.g., KJFK).');
  }

  return getMetar(cleaned);
}

export async function fetchTafFromWorker(icao: string): Promise<TafData | null> {
  assertWeatherConfigured();
  const cleaned = parseIcaoCode(icao);
  if (!cleaned) {
    throw new Error('Invalid ICAO code. Please provide a 4-letter ICAO (e.g., KJFK).');
  }

  return getTaf(cleaned);
}

export async function fetchWeatherPackage(icao: string): Promise<WeatherPackage> {
  assertWeatherConfigured();
  const cleaned = parseIcaoCode(icao);
  if (!cleaned) {
    throw new Error('Invalid ICAO code. Please provide a 4-letter ICAO (e.g., KJFK).');
  }

  const [metar, taf] = await Promise.all([
    getMetar(cleaned),
    getTaf(cleaned),
  ]);

  return {
    icao: cleaned,
    metar,
    taf,
    workerUrl: WEATHER_API_URL as string,
    requestedAt: new Date().toISOString(),
  };
}

export async function fetchWorkerProbe(endpoint: 'metar' | 'taf', icao: string) {
  assertWeatherConfigured();
  const cleaned = parseIcaoCode(icao);
  if (!cleaned) {
    throw new Error('Invalid ICAO code. Please provide a 4-letter ICAO (e.g., KJFK).');
  }

  const url = `${WEATHER_API_URL}/${endpoint}?ids=${cleaned}&format=json`;
  const response = await fetch(url);
  const body = await response.text();

  return {
    ok: response.ok,
    status: response.status,
    statusText: response.statusText,
    url,
    body,
  };
}
