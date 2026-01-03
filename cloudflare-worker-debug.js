/**
 * Cloudflare Worker - Aviation Weather CORS Proxy (DEBUG VERSION)
 *
 * This version includes extensive console.log statements to debug the TAF issue.
 * Deploy this temporarily to see what's happening in Cloudflare Worker logs.
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
    console.log('=== WORKER REQUEST ===');
    console.log('Method:', request.method);
    console.log('URL:', request.url);

    // Handle CORS preflight requests
    if (request.method === 'OPTIONS') {
      console.log('CORS preflight - returning OPTIONS response');
      return new Response(null, {
        headers: CORS_HEADERS,
      });
    }

    // Only allow GET requests
    if (request.method !== 'GET') {
      console.log('Non-GET method rejected');
      return new Response('Method not allowed', {
        status: 405,
        headers: CORS_HEADERS,
      });
    }

    const url = new URL(request.url);
    console.log('Parsed URL pathname:', url.pathname);
    console.log('Parsed URL search params:', url.search);

    // Extract the path from the worker URL (e.g., /metar?ids=KJFK&format=json)
    const path = url.pathname.slice(1); // Remove leading /
    const params = url.search; // Include ? prefix

    console.log('Extracted path:', path);
    console.log('Extracted params:', params);

    if (!path) {
      console.log('No path provided - returning usage info');
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
    console.log('=== UPSTREAM FETCH ===');
    console.log('Upstream URL:', upstreamUrl);

    try {
      console.log('Starting fetch to AviationWeather.gov...');

      // Fetch from aviationweather.gov
      const response = await fetch(upstreamUrl, {
        headers: {
          'User-Agent': 'ClearedToPlan/1.0 (Flight Planning App)',
        },
      });

      console.log('Fetch completed!');
      console.log('Response status:', response.status);
      console.log('Response statusText:', response.statusText);
      console.log('Response headers:', Object.fromEntries(response.headers));

      // Clone response and add CORS headers
      const responseBody = await response.text();
      console.log('Response body length:', responseBody.length, 'bytes');
      console.log('Response body preview (first 200 chars):', responseBody.substring(0, 200));

      if (responseBody.length === 0) {
        console.error('⚠️ EMPTY RESPONSE FROM AVIATIONWEATHER.GOV!');
        console.error('This means the upstream API returned nothing');
        console.error('Possible causes:');
        console.error('  1. API endpoint has changed');
        console.error('  2. API is rejecting our request');
        console.error('  3. API is down/timeout');
      }

      console.log('=== RETURNING RESPONSE ===');
      console.log('Returning', responseBody.length, 'bytes to client');

      return new Response(responseBody, {
        status: response.status,
        headers: {
          'Content-Type': response.headers.get('Content-Type') || 'application/json',
          ...CORS_HEADERS,
        },
      });
    } catch (error) {
      console.error('=== FETCH ERROR ===');
      console.error('Error type:', error.name);
      console.error('Error message:', error.message);
      console.error('Error stack:', error.stack);

      return new Response(JSON.stringify({
        error: 'Failed to fetch from aviationweather.gov',
        message: error.message,
        upstreamUrl: upstreamUrl,
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
