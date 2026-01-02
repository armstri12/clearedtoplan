# Weather API Setup Guide

Cleared To Plan integrates real-time aviation weather data (METAR/TAF) from **AviationWeather.gov** (NOAA's official source). Since aviationweather.gov blocks direct browser access (CORS), we use a **free Cloudflare Worker** as a proxy.

## 🚀 Quick Setup (10 minutes)

### Step 1: Deploy Cloudflare Worker

1. **Create a free Cloudflare account**
   - Visit https://workers.cloudflare.com/
   - Sign up (no credit card required)
   - Verify your email

2. **Create a new Worker**
   - Click "Create a Service"
   - Name it something like `weather-proxy`
   - Click "Create Service"

3. **Deploy the proxy code**
   - Click "Quick Edit" in the top right
   - Delete the default code
   - Copy ALL code from `cloudflare-worker/weather-proxy.js`
   - Paste it into the editor
   - Click "Save and Deploy"

4. **Copy your Worker URL**
   - You'll see a URL like: `https://weather-proxy.YOUR-USERNAME.workers.dev`
   - Copy this entire URL

### Step 2: Configure Your App

1. **Create environment file**
   ```bash
   cp .env.example .env.local
   ```

2. **Add your Worker URL**

   Open `.env.local` and paste your Worker URL:
   ```env
   VITE_WEATHER_API_URL=https://weather-proxy.YOUR-USERNAME.workers.dev
   ```

3. **Restart dev server**
   ```bash
   npm run dev
   ```

### Step 3: Test It

1. Navigate to the **Performance Calculator** page
2. Enter an ICAO code (e.g., `KJFK`, `KLAX`, `KORD`)
3. Click **Fetch**
4. You should see:
   - ✅ METAR data displayed
   - Auto-populated temperature and altimeter settings
   - Flight category (VFR/MVFR/IFR/LIFR)

## ✅ What You Get

### Current Implementation

- **Performance Page**: Real-time weather auto-populates density altitude calculator
  - Fetches current METAR by ICAO code
  - Auto-fills field elevation, altimeter setting, and temperature
  - Displays raw METAR text and flight category
  - Color-coded VFR/MVFR/IFR/LIFR indicators

### Data Source Benefits

- ✅ **Official NOAA data** - Most authoritative source
- ✅ **100% free** - No API keys, no limits (within Cloudflare's 100k req/day)
- ✅ **Worldwide coverage** - All airports with METAR reporting
- ✅ **Real-world certified** - Actual aviation weather, not simulation data
- ✅ **Always up-to-date** - Live observations from weather stations

## 🌐 Production Deployment

### For GitHub Pages

Your setup already works! Just add the environment variable:

1. **During development**: `.env.local` file (already done ✅)

2. **For GitHub Pages build**:
   - Go to your repo → Settings → Secrets and variables → Actions
   - Click "New repository secret"
   - Name: `VITE_WEATHER_API_URL`
   - Value: Your Cloudflare Worker URL
   - Click "Add secret"

3. **Update `.github/workflows/deploy.yml`** to use the secret:
   ```yaml
   - run: npm run build
     env:
       VITE_WEATHER_API_URL: ${{ secrets.VITE_WEATHER_API_URL }}
   ```

### For Other Hosting Platforms

**Vercel:**
- Project Settings → Environment Variables
- Add `VITE_WEATHER_API_URL` with your Worker URL

**Netlify:**
- Site Settings → Environment Variables
- Add `VITE_WEATHER_API_URL` with your Worker URL

**Cloudflare Pages:**
- Settings → Environment Variables
- Add `VITE_WEATHER_API_URL` with your Worker URL

## 🔧 Troubleshooting

### "No weather data available"
- ✅ Verify the ICAO code is correct (4 letters, e.g., KJFK not JFK)
- ✅ Some small airports may not report METAR
- ✅ Check your Cloudflare Worker is deployed and accessible
- ✅ Check browser console for errors

### "Weather API URL not configured"
- ✅ Ensure `.env.local` file exists in project root
- ✅ Verify the variable name is exactly `VITE_WEATHER_API_URL`
- ✅ Restart your dev server after creating `.env.local`
- ✅ DO NOT commit `.env.local` to git (already in .gitignore)

### Worker not working
- ✅ Visit your Worker URL directly in browser - should show usage instructions
- ✅ Test with: `https://your-worker.workers.dev/metar?ids=KJFK&format=json`
- ✅ Check Cloudflare dashboard for error logs
- ✅ Ensure you copied the FULL worker code from `cloudflare-worker/weather-proxy.js`

### CORS errors
- ✅ Make sure you're calling the Worker URL, not aviationweather.gov directly
- ✅ Worker should have CORS headers enabled (already in the code)
- ✅ Check browser console for the exact error

## 📚 API Documentation

### Data Source
- **Service**: AviationWeather.gov (NOAA Aviation Weather Center)
- **Official Docs**: https://aviationweather.gov/data/api/
- **Coverage**: Worldwide METAR and TAF data
- **Update Frequency**: Real-time (typically every hour, more frequent for significant changes)
- **Historical Data**: Up to 15 days

### Rate Limits
- **Cloudflare Workers Free Tier**: 100,000 requests/day
- **AviationWeather.gov**: 100 requests/minute per IP
- For most GA flight planning use, you'll never hit these limits

### Example Requests

Via your Worker:
```bash
# Get METAR for JFK
https://your-worker.workers.dev/metar?ids=KJFK&format=json

# Get TAF for LAX
https://your-worker.workers.dev/taf?ids=KLAX&format=json

# Get METAR for multiple airports
https://your-worker.workers.dev/metar?ids=KJFK,KLAX,KORD&format=json
```

## 🔐 Security Notes

- **Never commit** your `.env.local` file (already in .gitignore ✅)
- **Worker URL is public** - that's fine! It only proxies public weather data
- **No authentication needed** - aviationweather.gov is free public data
- **Rate limiting** - Cloudflare provides DDoS protection automatically

## 🎯 Why This Setup?

**Why Cloudflare Workers?**
- Free tier is extremely generous (100k req/day)
- Global edge network = fast worldwide
- Takes 5 minutes to set up
- No credit card required
- Automatic HTTPS and DDoS protection

**Why AviationWeather.gov?**
- Official US government source (NOAA)
- Most authoritative weather data
- 100% free, no API keys
- Real-world certified data (not simulation)
- Worldwide coverage

**Why not direct API calls?**
- aviationweather.gov blocks CORS (can't call from browser)
- GitHub Pages is static-only (can't run server-side code)
- Worker acts as a thin proxy layer to solve this

## 🔄 Alternative: Run Your Own Proxy

If you prefer not to use Cloudflare Workers, you can run the proxy anywhere:

**Node.js/Express:**
```javascript
const express = require('express');
const cors = require('cors');
const fetch = require('node-fetch');

const app = express();
app.use(cors());

app.get('/:type', async (req, res) => {
  const { type } = req.params;
  const params = new URLSearchParams(req.query).toString();
  const url = `https://aviationweather.gov/api/data/${type}?${params}`;
  const response = await fetch(url);
  const data = await response.text();
  res.send(data);
});

app.listen(3001);
```

**Deno Deploy** (also free):
- Similar to Cloudflare Workers
- Paste the worker code with minor modifications
- Deploy to https://deno.com/deploy

## 📦 Advanced: Caching

The Worker code can be enhanced with caching to reduce API calls:

```javascript
// Add to worker code
const CACHE_TTL = 60 * 5; // 5 minutes

// In fetch handler:
const cache = caches.default;
const cacheKey = new Request(url.toString());
let response = await cache.match(cacheKey);

if (!response) {
  response = await fetch(upstreamUrl);
  ctx.waitUntil(cache.put(cacheKey, response.clone()));
}
```

This reduces load on aviationweather.gov and makes responses faster.

## 🆘 Still Having Issues?

Common issues and fixes:

1. **Worker 404**: Worker name in URL must match your deployed worker name
2. **CORS still blocked**: Make sure you're calling the worker, not aviationweather.gov
3. **Empty responses**: Check the ICAO code is valid (4 letters)
4. **Build fails**: Ensure environment variable is set in CI/CD settings

If you continue having issues, check:
- Browser console for errors
- Cloudflare Worker logs in dashboard
- Network tab to see what URLs are being called
