# Cloudflare Worker - Weather API Proxy

This Cloudflare Worker acts as a CORS proxy for AviationWeather.gov API, allowing the Cleared To Plan app to fetch real-time METAR and TAF data from the browser.

## Why Do We Need This?

- **Problem**: AviationWeather.gov blocks CORS (Cross-Origin Resource Sharing)
- **Solution**: This worker runs on Cloudflare's edge network and proxies requests
- **Result**: Your static GitHub Pages site can fetch weather data

## Deployment

### Quick Setup (5 minutes)

1. **Sign up for Cloudflare Workers** (free, no credit card)
   - Visit: https://workers.cloudflare.com/
   - Create an account

2. **Create a new Worker**
   - Click "Create a Service"
   - Name it: `weather-proxy` (or any name you like)

3. **Paste the code**
   - Click "Quick Edit"
   - Delete the default code
   - Copy ALL code from `weather-proxy.js`
   - Paste it into the editor
   - Click "Save and Deploy"

4. **Copy your Worker URL**
   - Example: `https://weather-proxy.YOUR-USERNAME.workers.dev`
   - You'll use this in your `.env.local` file

5. **Configure your app**
   ```bash
   # In project root, create .env.local
   VITE_WEATHER_API_URL=https://weather-proxy.YOUR-USERNAME.workers.dev
   ```

## Testing Your Worker

### Test in Browser

Visit your worker URL directly:
```
https://weather-proxy.YOUR-USERNAME.workers.dev/metar?ids=KJFK&format=json
```

You should see JSON weather data for JFK airport.

### Test Other Endpoints

```bash
# Get TAF
https://your-worker.workers.dev/taf?ids=KLAX&format=json

# Get multiple airports
https://your-worker.workers.dev/metar?ids=KJFK,KLAX,KORD&format=json

# Get METAR within a bounding box
https://your-worker.workers.dev/metar?bbox=-90,30,-80,40&format=json
```

## How It Works

```
Browser → Cloudflare Worker → AviationWeather.gov
   ↑                              ↓
   └──────── JSON with CORS ──────┘
```

1. Your app makes a request to the Worker
2. Worker forwards request to aviationweather.gov
3. Worker receives response
4. Worker adds CORS headers
5. Worker returns data to your app

## Features

- ✅ **CORS Headers**: Allows browser requests from any origin
- ✅ **Error Handling**: Graceful errors if upstream fails
- ✅ **Preflight Support**: Handles OPTIONS requests
- ✅ **User Agent**: Identifies as "ClearedToPlan" to aviationweather.gov
- ✅ **Pass-Through**: All query parameters forwarded to upstream

## Limitations

### Cloudflare Workers Free Tier
- 100,000 requests per day
- 10ms CPU time per request
- 128 MB memory

For a flight planning app, you'll never hit these limits.

### AviationWeather.gov Limits
- 100 requests per minute per IP
- Maximum 400 results per request
- 15 days historical data max

## Advanced: Adding Cache

To reduce load and improve performance, add caching:

```javascript
const CACHE_TTL = 60 * 5; // 5 minutes

export default {
  async fetch(request, env, ctx) {
    // ... handle OPTIONS and validation ...

    const cache = caches.default;
    const cacheKey = new Request(upstreamUrl);

    // Check cache first
    let response = await cache.match(cacheKey);

    if (!response) {
      // Not in cache, fetch from upstream
      response = await fetch(upstreamUrl);

      // Cache the response
      const responseToCache = response.clone();
      ctx.waitUntil(
        cache.put(cacheKey, responseToCache, {
          expirationTtl: CACHE_TTL
        })
      );
    }

    // Add CORS headers and return
    return new Response(await response.text(), {
      headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' }
    });
  }
};
```

This caches responses for 5 minutes, reducing API calls and improving speed.

## Monitoring

View logs and analytics in Cloudflare dashboard:
- Request count
- Error rate
- CPU usage
- Response times

## Alternative Deployment Options

### Deno Deploy
```javascript
// Same code works with minor changes
import { serve } from "https://deno.land/std/http/server.ts";

serve(async (req) => {
  // ... same logic as worker ...
});
```

### AWS Lambda + API Gateway
- More complex setup
- Free tier: 1M requests/month
- Higher latency (cold starts)

### Vercel Edge Functions
- Similar to Cloudflare Workers
- Free tier: 100GB-hours/month
- Good if already using Vercel

## Security Notes

- ✅ Worker URL can be public - it only proxies public data
- ✅ No authentication needed
- ✅ Cloudflare provides DDoS protection
- ✅ Rate limiting handled by upstream

## Troubleshooting

### Worker returns 404
- Check the worker name in your URL matches the deployed name
- Ensure worker is deployed (not just saved)

### CORS errors persist
- Verify you're calling the worker, not aviationweather.gov directly
- Check CORS headers in network tab

### No data returned
- Test the upstream URL directly
- Check Cloudflare logs for errors
- Verify ICAO code is valid

## Cost

**Free tier is sufficient** for most users:
- 100k requests/day = ~3M requests/month
- Average flight planning session: ~10 requests
- Can support thousands of users

If you exceed free tier:
- $5/month for 10M requests
- Still extremely cheap

## Support

- Cloudflare Docs: https://developers.cloudflare.com/workers/
- AviationWeather API: https://aviationweather.gov/data/api/
- This project: See WEATHER_API_SETUP.md
