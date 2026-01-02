# Weather API Setup Guide

Cleared To Plan now integrates real-time aviation weather data (METAR/TAF) using the CheckWX Aviation Weather API.

## 🚀 Quick Setup (5 minutes)

### 1. Get a Free API Key

1. Visit [CheckWX API](https://www.checkwxapi.com/)
2. Click "Sign Up" or "Get Started"
3. Create a free account (no credit card required)
4. Copy your API key from the dashboard

### 2. Configure Your Environment

1. Create a file named `.env.local` in the project root:
   ```bash
   cp .env.example .env.local
   ```

2. Open `.env.local` and add your API key:
   ```env
   VITE_CHECKWX_API_KEY=your_actual_api_key_here
   ```

3. Restart your development server:
   ```bash
   npm run dev
   ```

## ✅ Verification

1. Navigate to the **Performance Calculator** page
2. Enter an ICAO code (e.g., `KJFK`, `KLAX`, `KORD`)
3. Click **Fetch** button
4. You should see:
   - ✅ METAR data displayed
   - Auto-populated temperature and altimeter settings
   - Flight category (VFR/MVFR/IFR/LIFR)

## 🌐 Features

### Current Implementation

- **Performance Page**: Real-time weather data auto-populates density altitude calculator
  - Fetches current METAR by ICAO code
  - Auto-fills field elevation, altimeter setting, and temperature
  - Displays raw METAR text and flight category
  - Color-coded VFR/MVFR/IFR/LIFR indicators

### Coming Soon

- **Navlog Page**: METAR/TAF for departure and destination
- **Airport Database**: Search airports by name, show info
- **Route Weather**: Weather along planned route

## 📚 API Documentation

- **Service**: CheckWX Aviation Weather API
- **Documentation**: https://www.checkwxapi.com/documentation
- **Rate Limits**: Check your plan details (free tier is generous)
- **Data Coverage**: Worldwide METAR and TAF data
- **Response Time**: Sub-100ms typical

## 🔧 Troubleshooting

### "No weather data available"
- Verify the ICAO code is correct (4 letters, e.g., KJFK not JFK)
- Some small airports may not report METAR
- Check your internet connection

### "CheckWX API key not configured"
- Ensure `.env.local` file exists in project root
- Verify the variable name is exactly `VITE_CHECKWX_API_KEY`
- Restart your dev server after creating `.env.local`
- DO NOT commit `.env.local` to git (already in .gitignore)

### API rate limits exceeded
- Free tier has generous limits but check your usage
- Consider caching frequent airports
- Upgrade plan if needed for high-volume use

## 🔐 Security Notes

- **Never commit** your `.env.local` file (already in .gitignore)
- **Never share** your API key publicly
- For production deployment, use environment variables in your hosting platform:
  - Vercel: Project Settings → Environment Variables
  - Netlify: Site Settings → Environment Variables
  - GitHub Pages: Use GitHub Secrets for build process

## 🎯 Alternative APIs

If you prefer a different weather data source, the code is designed to be API-agnostic. You can swap out the implementation in `src/services/aviationApi.ts` with:

- **AviationWeather.gov** (NOAA) - Free but requires CORS proxy
- **AVWX REST API** - Free for basic METAR/TAF
- **Aviation Edge** - Paid, comprehensive features

The service layer abstracts the API, so changing providers only requires updating one file.

## 📦 Production Build

When building for production:

```bash
# Ensure .env.local is configured locally for development
# For production, set VITE_CHECKWX_API_KEY in your hosting platform

npm run build
```

The app will work without the API key but weather features will be disabled (gracefully fails with helpful console warnings).
