/**
 * Cloudflare Worker - Aviation Weather CORS Proxy
 *
 * This worker proxies requests to aviationweather.gov to bypass CORS restrictions.
 * Deploy this to Cloudflare Workers (free tier) and update VITE_WEATHER_API_URL in your .env.local
 *
 * Setup instructions:
 * 1. Create a free account at https://workers.cloudflare.com/
 * 2. Create a new Worker
 * 3. Paste this code
 * 4. Deploy
 * 5. Copy your worker URL (e.g., https://weather-proxy.your-username.workers.dev)
 * 6. Set VITE_WEATHER_API_URL to your worker URL in .env.local
 */

const AVIATION_WEATHER_BASE = 'https://aviationweather.gov/api/data';

// CORS headers for browser requests
const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Max-Age': '86400',
};

export default {
  async fetch(request, env, ctx) {
    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      return new Response(null, {
        headers: CORS_HEADERS,
      });
    }

    // Only allow GET requests
    if (request.method !== 'GET') {
      return new Response('Method not allowed', {
        status: 405,
        headers: CORS_HEADERS,
      });
    }

    const url = new URL(request.url);

    // Extract the path from the worker URL (e.g., /metar?ids=KJFK&format=json)
    const path = url.pathname.slice(1); // Remove leading /
    const params = url.search; // Include ? prefix

    if (!path) {
      return new Response(JSON.stringify({
        error: 'Missing path. Usage: /metar?ids=KJFK&format=json',
        examples: [
          '/metar?ids=KJFK&format=json',
          '/taf?ids=KLAX&format=json',
          '/metar?bbox=-90,30,-80,40&format=json'
        ]
      }), {
        status: 400,
        headers: {
          'Content-Type': 'application/json',
          ...CORS_HEADERS,
        },
      });
    }

    // Build the upstream URL
    const upstreamUrl = `${AVIATION_WEATHER_BASE}/${path}${params}`;

    try {
      // Fetch from aviationweather.gov
      const response = await fetch(upstreamUrl, {
        headers: {
          'User-Agent': 'ClearedToPlan/1.0 (Flight Planning App)',
        },
      });

      // Clone response and add CORS headers
      const responseBody = await response.text();

      return new Response(responseBody, {
        status: response.status,
        headers: {
          'Content-Type': response.headers.get('Content-Type') || 'application/json',
          ...CORS_HEADERS,
        },
      });
    } catch (error) {
      return new Response(JSON.stringify({
        error: 'Failed to fetch from aviationweather.gov',
        message: error.message,
      }), {
        status: 500,
        headers: {
          'Content-Type': 'application/json',
          ...CORS_HEADERS,
        },
      });
    }
  },
};
