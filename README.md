# Cleared to Plan

**The simplest digital flight planning checklist for VFR pilots**

## Overview

**Cleared to Plan** is a streamlined, browser-based flight planning tool that guides pilots through essential preflight planning. Version 2.0 represents a major simplification focused on core functionality through a clean 4-step wizard interface.

## What Changed in v2.0 (Simplification Update)

This version eliminates architectural complexity and refocuses on what matters:

### ✅ **What Was Removed**
- ❌ Dual state management systems (FlightSessionContext removed, Zustand kept)
- ❌ Dual user flows (old workflow removed, wizard-only now)
- ❌ Fake authentication system (no more login/logout)
- ❌ Workflow enforcement guards
- ❌ Complex weather API nearest-TAF search (150nm radius searches)
- ❌ Custom aircraft editor (template-based now)
- ❌ 5 separate workflow pages (Aircraft, W&B, Performance, Weather, Navlog)
- ❌ Excessive logging and debugging code

### ✅ **What Remains (The Good Stuff)**
- ✅ Clean 4-step wizard: Basics → Weather → Performance → Export
- ✅ Real-time METAR/TAF weather data
- ✅ Weight & balance calculations with envelope validation
- ✅ Density altitude and takeoff/landing distance calculations
- ✅ PDF and Markdown briefing export
- ✅ Browser-based storage (no server needed)

### 📊 **Impact**
- **~2,500 lines of code removed** (~50% reduction)
- **Reduced from 12K to ~9.5K LOC**
- **50% easier to maintain**
- **Single state system** (Zustand only)
- **One clear user flow** (wizard-based)
- **Weather API simplified** (597 → 297 lines)

## Technology Stack

- **Frontend**: React 19 with TypeScript 5.9 (strict mode)
- **Build Tool**: Vite 7
- **Routing**: React Router v7
- **State Management**: Zustand (lightweight)
- **Data Persistence**: Browser localStorage
- **Weather API**: AviationWeather.gov via Cloudflare Worker proxy
- **TAF Parsing**: metar-taf-parser library
- **Styling**: Inline styles

## Project Structure (Simplified)

```
src/
├── main.tsx                 # Application entry point
├── App.tsx                  # Root component with routing (simplified)
│
├── features/
│   └── home/
│       └── HomePage.tsx     # Landing page
│
├── components/
│   └── TripWizard/          # 4-step wizard interface
│       ├── TripWizardLayout.tsx
│       ├── StepGuard.tsx
│       └── steps/
│           ├── BasicsStep.tsx      # Step 1: Route & aircraft
│           ├── WeatherStep.tsx     # Step 2: METAR/TAF
│           ├── PerformanceStep.tsx # Step 3: W&B & performance
│           └── ExportBriefStep.tsx # Step 4: PDF/Markdown export
│
├── stores/
│   └── flightPlan.ts        # Zustand store (single state management)
│
├── services/
│   └── aviationApi.ts       # Weather API client (simplified)
│
└── lib/                     # Utilities
    ├── math/                # W&B envelope, geometry
    ├── performance/         # Takeoff/landing calculations
    ├── briefing/            # PDF/markdown export
    └── storage/             # localStorage helpers
```

## Architecture

### User Flow (Wizard-Based)

Simple 4-step wizard guides pilots through flight planning:

```
Home → Trip Wizard → [Basics → Weather → Performance → Export] → PDF/Markdown
```

### State Management

**Single Zustand Store** (`src/stores/flightPlan.ts`):
- Manages all flight planning data in one place
- 5 main slices: basics, weather, performance, loading, brief
- Automatic persistence to localStorage
- No workflow guards - wizard UI enforces order naturally

### Data Persistence

Browser localStorage (single simplified structure):
- **Flight plans**: Stored in Zustand store, auto-persisted
- **No user accounts**: Removed authentication complexity
- **No session management**: Wizard state is ephemeral (resets on reload)

No backend or database required - the app runs entirely client-side.

### Workflow Enforcement

The `WorkflowGuard` component wraps protected routes and checks:

1. Is a flight session active?
2. Have previous steps been completed?
3. Is debug mode enabled? (bypasses checks if `?debug=true` in URL)

If checks fail, user is redirected to the appropriate step.

## Features in Detail

### 1. Aircraft Management

**Location**: `src/features/aircraft/`

- Create and store aircraft profiles
- Define weight & balance parameters (empty weight, stations, CG envelope)
- Configure performance data (cruise, takeoff, landing)
- Support for multiple CG envelopes (normal, utility, aerobatic)
- Template library for common aircraft types

**Key Files:**
- `AircraftPage.tsx` - Main UI component
- `types.ts` - TypeScript type definitions
- `templates.ts` - Pre-configured aircraft templates

### 2. Weight & Balance Calculator

**Location**: `src/features/weightBalance/`

Calculates and validates W&B for three phases:

- **Ramp Weight** - With all fuel before taxi
- **Takeoff Weight** - After taxi burn
- **Landing Weight** - After planned enroute burn

Features:
- Real-time calculations as you type
- Visual CG envelope graph
- Multiple baggage compartment support
- Automatic envelope validation
- Warning indicators for out-of-limits conditions

**Formula:**
```
CG (inches) = Total Moment (lb-in) / Total Weight (lb)
```

### 3. Performance Calculator

**Location**: `src/features/performance/`

Calculates density altitude and performance impact:

**Pressure Altitude**:
```
PA = Field Elevation + (29.92 - Altimeter Setting) × 1000
```

**Density Altitude**:
```
DA = PA + 120 × (Temperature - ISA Temperature)
```

Features:
- Fetch live METAR weather for auto-fill
- Input validation (warns if hPa entered instead of inHg)
- Takeoff/landing distance calculator with corrections for:
  - Wind (headwind/tailwind)
  - Runway surface (paved/grass/gravel)
  - Runway condition (dry/wet)
  - Runway slope
  - Humidity
  - Safety margins (1.5× AOPA recommendation)

**Critical Fix (2026-01-03):**
The AviationWeather.gov API sometimes returns altimeter in mb instead of inHg. The code now auto-detects values >100 and converts:
```
1016.7 mb × 0.02953 = 30.02 inHg
```

### 4. Weather Briefing

**Location**: `src/features/weather/`

Integrated weather using AviationWeather.gov (NOAA):

- Fetches current METAR observations
- Retrieves TAF forecasts
- Displays hourly forecast breakdown using `metar-taf-parser`
- Automatically finds nearest TAF if primary airport doesn't have one
- Shows flight category (VFR/MVFR/IFR/LIFR)
- Decodes all weather phenomena
- Multiple airport support (departure, destination, alternates)

**API Integration:**
- Uses Cloudflare Worker proxy to bypass CORS
- Normalizes API responses to consistent format
- Handles missing/incomplete data gracefully

### 5. Navigation Log

**Location**: `src/features/navlog/`

Build detailed navigation logs:

- Create route legs with waypoints
- Calculate magnetic heading with wind correction
- Estimate groundspeed and fuel burn
- Track checkpoints and cumulative totals
- Visual route display
- Export capabilities

## Getting Started

### Prerequisites

- Node.js 18+ and npm
- Modern web browser (Chrome, Firefox, Safari, Edge)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/clearedtoplan.git

# Navigate to project directory
cd clearedtoplan

# Install dependencies
npm install
```

### Configuration

Create a `.env.local` file in the project root:

```env
# Weather API Configuration
VITE_WEATHER_API_URL=https://your-cloudflare-worker.workers.dev
```

The weather API requires a Cloudflare Worker proxy to bypass CORS restrictions. See `WEATHER_API_SETUP.md` for details.

### Development

```bash
# Start development server
npm run dev

# Open browser to http://localhost:5173
```

### Building for Production

```bash
# Create production build
npm run build

# Preview production build
npm run preview
```

## Usage

### Quick Start

1. **Login** - Use credentials: `pilot` / `cleared2024`
2. **Start Session** - Click "New Flight Plan" and give it a name
3. **Follow Workflow:**
   - **Aircraft** - Select or create aircraft profile
   - **Weight & Balance** - Enter payload and fuel
   - **Performance** - Calculate density altitude and distances
   - **Weather** - Fetch current weather for route
   - **Navlog** - Build navigation log

### Debug Mode

Add `?debug=true` to any URL to bypass workflow enforcement and access tools directly:

```
http://localhost:5173/performance?debug=true
```

This is useful for testing individual features.

### Default Credentials

**Username**: `pilot`
**Password**: `cleared2024`

*These are hardcoded for development. Replace with backend authentication in production.*

## API Documentation

### Aviation Weather API

**Service**: `src/services/aviationApi.ts`

**Functions:**

```typescript
// Fetch METAR for airport
const metar = await getMetar('KJFK');

// Fetch TAF forecast
const taf = await getTaf('KJFK');

// Find nearest TAF if primary doesn't have one
const nearbyTaf = await getNearestTaf('KENW');

// Parse ICAO code
const icao = parseIcaoCode('kjfk'); // Returns 'KJFK' or null
```

**Types:**

```typescript
type MetarData = {
  icao: string;
  name?: string;
  observed?: string;
  raw_text: string;
  barometer?: { hg: number; hpa: number; kpa: number; mb: number };
  temperature?: { celsius: number; fahrenheit: number };
  dewpoint?: { celsius: number; fahrenheit: number };
  wind?: { degrees: number; speed_kts: number; gust_kts?: number };
  visibility?: { miles: string; miles_float: number };
  clouds?: Array<{ code: string; text: string; feet: number }>;
  flight_category?: string; // VFR, MVFR, IFR, LIFR
  elevation?: { feet: number; meters: number };
};
```

### Flight Session Context

**Hook**: `useFlightSession()`

```typescript
const {
  currentSession,      // Current active session
  savedSessions,       // List of saved sessions

  // Session management
  startNewSession,     // (name: string) => void
  loadSession,         // (id: string) => void
  saveSession,         // () => void
  deleteSession,       // (id: string) => void
  clearSession,        // () => void

  // Update data
  updateAircraft,      // (data: FlightSessionAircraft) => void
  updateWeightBalance, // (data: FlightSessionWB) => void
  updatePerformance,   // (data: FlightSessionPerformance) => void
  updateWeather,       // (data: FlightSessionWeather) => void
  updateNavlog,        // (data: FlightSessionNavlog) => void

  // Workflow
  completeStep,        // (step: keyof FlightSession['completed']) => void
  canAccessStep,       // (step: keyof FlightSession['completed']) => boolean
  getNextStep,         // () => keyof FlightSession['completed'] | null
} = useFlightSession();
```

### Authentication Context

**Hook**: `useAuth()`

```typescript
const {
  user,            // User | null
  isAuthenticated, // boolean
  login,           // (username: string, password: string) => boolean
  logout,          // () => void
} = useAuth();
```

## Code Style & Conventions

### TypeScript

- Strict mode enabled
- Explicit types for all public APIs
- Interfaces for complex objects
- Type exports from modules

### Component Structure

```typescript
// 1. Imports
import { useState } from 'react';

// 2. Types
type MyProps = {
  value: number;
};

// 3. Helper functions (outside component)
function calculateSomething(x: number): number {
  return x * 2;
}

// 4. Component
export default function MyComponent({ value }: MyProps) {
  const [state, setState] = useState(0);

  // Event handlers
  function handleClick() {
    setState(value);
  }

  // Render
  return (
    <div onClick={handleClick}>
      {state}
    </div>
  );
}
```

### Styling

- Inline styles using React `style` prop
- Consistent color palette (blues for primary, reds for warnings)
- No external CSS framework
- Responsive design via flexbox and grid

## Contributing

### Adding a New Feature

1. Create feature directory in `src/features/`
2. Add types in `types.ts`
3. Create main component (e.g., `MyFeaturePage.tsx`)
4. Add route in `App.tsx`
5. Update `FlightSessionContext` if part of workflow
6. Add to workflow progress if needed

### Testing

```bash
# Run TypeScript type checker
npx tsc --noEmit

# Run linter
npm run lint
```

## Troubleshooting

### Weather not loading

**Issue**: "No weather data available" errors

**Solution**:
1. Check `.env.local` has `VITE_WEATHER_API_URL` set
2. Verify Cloudflare Worker is deployed and accessible
3. Check browser console for CORS errors

### Incorrect pressure altitude

**Issue**: Pressure altitude shows large negative value (e.g., -986,068 ft)

**Cause**: Altimeter entered in hPa/mb instead of inHg

**Solution**: The app now auto-detects this and shows a warning. Enter altimeter in inHg (e.g., 29.92, not 1013).

### Workflow stuck

**Issue**: Can't access next workflow step

**Cause**: Previous step not marked complete

**Solution**: Go back and click "Continue" button on previous step. Or use debug mode: `?debug=true`

### Data lost

**Issue**: Flight plans disappeared

**Cause**: localStorage cleared (browser cache clear, incognito mode, etc.)

**Solution**: Data is stored locally only. Export important flight plans or implement backend sync (future enhancement).

## Roadmap

### Near-term
- [ ] Export flight plans to PDF
- [ ] Print-optimized formats
- [ ] More aircraft templates
- [ ] Winds aloft integration
- [ ] NOTAM briefings

### Medium-term
- [ ] Backend API integration
- [ ] Real user authentication
- [ ] Cloud sync for flight plans
- [ ] Mobile app (React Native)
- [ ] Flight tracking integration

### Long-term
- [ ] AI-powered route optimization
- [ ] Integration with EFB apps
- [ ] Real-time weather updates during flight
- [ ] Collaborative flight planning
- [ ] ATC flight plan filing

## License

[To be determined]

## Contact

[Your contact information]

## Acknowledgments

- **AviationWeather.gov** - Free weather data from NOAA
- **metar-taf-parser** - Excellent TAF parsing library
- **React Router** - Client-side routing
- **Vite** - Fast build tool
- Aviation community for testing and feedback

---

**Version**: 1.0.0
**Last Updated**: 2026-01-03
**Author**: [Your name]
