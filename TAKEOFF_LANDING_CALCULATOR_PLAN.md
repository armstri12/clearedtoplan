# Takeoff and Landing Distance Calculator Implementation Plan

## Overview
Add comprehensive takeoff and landing distance calculations to the Performance Calculator page. Uses **baseline + corrections** approach where users input POH baseline values and the calculator applies standard correction factors.

## Architecture

### Location
- **File**: `src/features/performance/PerformancePage.tsx`
- **Integration**: Add as new sections below the existing Density Altitude calculator
- **Data Flow**: Use existing DA calculations as input to distance calculations

### Calculation Approach
**Baseline + Corrections** (NOT pure formulas)
- User enters POH baseline distances from their aircraft's charts
- System applies industry-standard correction factors
- Final output includes 1.5× safety margin
- Transparent breakdown of all corrections

## Feature Specifications

### 1. Input Fields

#### Takeoff Distance Calculator Inputs:
```typescript
interface TakeoffInputs {
  // POH Baseline (required)
  pohGroundRoll: number;          // feet - from POH at current DA/weight
  pohDistanceOver50ft: number;     // feet - from POH at current DA/weight

  // Weight (auto-filled from DA calculator or manual)
  currentWeight: number;           // lbs
  pohBaselineWeight: number;       // lbs - weight used in POH lookup

  // Wind (optional)
  windComponent: number;           // knots (positive = headwind, negative = tailwind)

  // Runway Conditions
  runwayType: 'paved' | 'grass' | 'gravel';
  runwayCondition: 'dry' | 'wet';
  runwaySlope: number;             // % grade (positive = uphill, negative = downhill)

  // Optional
  humidity: 'normal' | 'high';
}
```

#### Landing Distance Calculator Inputs:
```typescript
interface LandingInputs {
  // POH Baseline (required)
  pohGroundRoll: number;           // feet - from POH at current DA/weight
  pohDistanceOver50ft: number;     // feet - from POH at current DA/weight

  // Weight
  landingWeight: number;           // lbs (usually less than takeoff due to fuel burn)
  pohBaselineWeight: number;       // lbs

  // Wind
  windComponent: number;           // knots

  // Runway Conditions
  runwayType: 'paved' | 'grass' | 'gravel';
  runwayCondition: 'dry' | 'wet';
  runwaySlope: number;             // % grade (positive = uphill hurts landing, downhill helps)

  // Safety buffer
  safetyFactor: number;            // default 1.5
}
```

### 2. Correction Factors

#### Takeoff Distance Corrections:
```typescript
const TAKEOFF_CORRECTIONS = {
  // Wind (per knot)
  headwindFactor: -0.10 / 9,      // -10% per 9kt = -1.11% per kt
  tailwindFactor: 0.10 / 2,       // +10% per 2kt = +5% per kt

  // Runway Surface (multiplicative)
  grass: 1.15,                     // +15%
  gravel: 1.15,                    // +15%
  wet: 1.15,                       // +15% on paved, more on grass

  // Runway Slope (per 1% grade)
  uphillFactor: 0.22,              // +22% per 1% upslope
  downhillFactor: -0.07,           // -7% per 1% downslope

  // Environmental
  highHumidity: 1.10,              // +10%

  // Safety
  safetyMargin: 1.5,               // 1.5× final result (AOPA recommendation)
};
```

#### Landing Distance Corrections:
```typescript
const LANDING_CORRECTIONS = {
  // Wind (per knot)
  headwindFactor: -0.10 / 9,      // -10% per 9kt
  tailwindFactor: 0.10 / 2,       // +10% per 2kt

  // Runway Surface (multiplicative)
  grass: 1.15,                     // +15%
  gravel: 1.15,                    // +15%
  wet: 1.35,                       // +35% (1.3-1.4 range, use conservative 1.35)
  wetGrass: 1.60,                  // +60% (wet + grass combined)

  // Runway Slope (opposite effect of takeoff)
  uphillFactor: -0.07,             // -7% per 1% upslope (helps landing)
  downhillFactor: 0.22,            // +22% per 1% downslope (hurts landing)

  // Safety
  safetyMargin: 1.5,               // 1.5× final result
};
```

### 3. Calculation Logic

#### Takeoff Distance Algorithm:
```typescript
function calculateTakeoffDistance(inputs: TakeoffInputs): TakeoffResults {
  let groundRoll = inputs.pohGroundRoll;
  let over50ft = inputs.pohDistanceOver50ft;

  const corrections = [];

  // 1. Wind correction
  if (inputs.windComponent !== 0) {
    const windFactor = inputs.windComponent > 0
      ? TAKEOFF_CORRECTIONS.headwindFactor * inputs.windComponent
      : TAKEOFF_CORRECTIONS.tailwindFactor * Math.abs(inputs.windComponent);

    const windMultiplier = 1 + windFactor;
    groundRoll *= windMultiplier;
    over50ft *= windMultiplier;

    corrections.push({
      factor: 'Wind',
      description: inputs.windComponent > 0
        ? `${inputs.windComponent}kt headwind`
        : `${Math.abs(inputs.windComponent)}kt tailwind`,
      multiplier: windMultiplier,
    });
  }

  // 2. Runway surface correction
  if (inputs.runwayType === 'grass') {
    const surfaceMultiplier = inputs.runwayCondition === 'wet'
      ? TAKEOFF_CORRECTIONS.grass * TAKEOFF_CORRECTIONS.wet
      : TAKEOFF_CORRECTIONS.grass;

    groundRoll *= surfaceMultiplier;
    over50ft *= surfaceMultiplier;

    corrections.push({
      factor: 'Runway Surface',
      description: inputs.runwayCondition === 'wet' ? 'Wet grass' : 'Dry grass',
      multiplier: surfaceMultiplier,
    });
  } else if (inputs.runwayType === 'gravel') {
    groundRoll *= TAKEOFF_CORRECTIONS.gravel;
    over50ft *= TAKEOFF_CORRECTIONS.gravel;
    corrections.push({
      factor: 'Runway Surface',
      description: 'Gravel',
      multiplier: TAKEOFF_CORRECTIONS.gravel,
    });
  } else if (inputs.runwayCondition === 'wet') {
    groundRoll *= TAKEOFF_CORRECTIONS.wet;
    over50ft *= TAKEOFF_CORRECTIONS.wet;
    corrections.push({
      factor: 'Runway Surface',
      description: 'Wet paved',
      multiplier: TAKEOFF_CORRECTIONS.wet,
    });
  }

  // 3. Runway slope correction
  if (inputs.runwaySlope !== 0) {
    const slopeFactor = inputs.runwaySlope > 0
      ? TAKEOFF_CORRECTIONS.uphillFactor * inputs.runwaySlope
      : TAKEOFF_CORRECTIONS.downhillFactor * Math.abs(inputs.runwaySlope);

    const slopeMultiplier = 1 + slopeFactor;
    groundRoll *= slopeMultiplier;
    over50ft *= slopeMultiplier;

    corrections.push({
      factor: 'Runway Slope',
      description: inputs.runwaySlope > 0
        ? `${inputs.runwaySlope}% upslope`
        : `${Math.abs(inputs.runwaySlope)}% downslope`,
      multiplier: slopeMultiplier,
    });
  }

  // 4. Humidity correction
  if (inputs.humidity === 'high') {
    groundRoll *= TAKEOFF_CORRECTIONS.highHumidity;
    over50ft *= TAKEOFF_CORRECTIONS.highHumidity;
    corrections.push({
      factor: 'Humidity',
      description: 'High humidity',
      multiplier: TAKEOFF_CORRECTIONS.highHumidity,
    });
  }

  // 5. Apply safety margin
  const finalGroundRoll = Math.round(groundRoll * TAKEOFF_CORRECTIONS.safetyMargin);
  const finalOver50ft = Math.round(over50ft * TAKEOFF_CORRECTIONS.safetyMargin);

  return {
    groundRoll: finalGroundRoll,
    over50ft: finalOver50ft,
    corrections,
    baselineGroundRoll: inputs.pohGroundRoll,
    baselineOver50ft: inputs.pohDistanceOver50ft,
    safetyMargin: TAKEOFF_CORRECTIONS.safetyMargin,
  };
}
```

### 4. UI Design

#### Layout:
```
┌─────────────────────────────────────────────────────────┐
│ Performance Calculator                                   │
│ (Existing Density Altitude section)                      │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Takeoff Distance Calculator                              │
│ ┌─────────────────────┐ ┌───────────────────────────┐  │
│ │ Inputs              │ │ Results                   │  │
│ │                     │ │                           │  │
│ │ POH Baseline:       │ │ Ground Roll:    2,100 ft │  │
│ │  Ground: [1200] ft  │ │ Over 50ft:      3,500 ft │  │
│ │  Over 50: [2000] ft │ │                           │  │
│ │                     │ │ Corrections Applied:      │  │
│ │ Wind: [+10] kt      │ │ • Headwind: -11%          │  │
│ │ Surface: [Grass ▼]  │ │ • Grass: +15%             │  │
│ │ Condition: [Dry ▼]  │ │ • Upslope: +22%           │  │
│ │ Slope: [1.0] %      │ │ • Safety: ×1.5            │  │
│ └─────────────────────┘ └───────────────────────────┘  │
│                                                          │
│ ⚠️  CAUTION: 3,500 ft requires 2,800 ft runway minimum │
│     (70% rule of thumb for safety)                      │
└─────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────┐
│ Landing Distance Calculator                              │
│ (Similar layout to takeoff)                              │
└─────────────────────────────────────────────────────────┘
```

#### Safety Color Coding:
```typescript
function getRunwaySafetyLevel(required: number, available?: number) {
  if (!available) return { level: 'unknown', color: '#6b7280' };

  const percentage = (required / available) * 100;

  if (percentage <= 70) {
    return {
      level: 'safe',
      color: '#059669',
      bgColor: '#ecfdf5',
      message: '✅ SAFE: Well within runway limits'
    };
  } else if (percentage <= 85) {
    return {
      level: 'caution',
      color: '#d97706',
      bgColor: '#fffbeb',
      message: '⚠️ CAUTION: Limited margin. Consider conditions carefully.'
    };
  } else {
    return {
      level: 'danger',
      color: '#dc2626',
      bgColor: '#fef2f2',
      message: '⛔ DANGER: Insufficient runway. DO NOT ATTEMPT.'
    };
  }
}
```

### 5. Educational Warnings

Display prominently:
```markdown
⚠️ IMPORTANT ASSUMPTIONS:
- POH distances assume new engine and optimal technique
- Actual performance typically 10-15% worse than published
- This calculator provides MINIMUM distances - add margin
- Always verify runway length before flight
- Consult POH for your specific aircraft

📋 CORRECTIONS NOT INCLUDED:
- Soft field technique (increases distance)
- Obstacle clearance beyond 50ft
- Engine degradation/wear
- Pilot proficiency variations
- Gusts and wind shear
```

### 6. Optional Enhancements (Phase 2)

1. **Runway Database Integration**
   - Auto-populate available runway length from ICAO
   - Show real-time runway analysis

2. **Aircraft Profile Integration**
   - Save POH baseline distances in aircraft profile
   - Auto-fill based on selected aircraft + current weight

3. **Weight Integration**
   - Pull from W&B calculator
   - Auto-calculate landing weight (takeoff - fuel burn)

4. **Multiple Runways**
   - Compare multiple runway options
   - Show which runways are suitable

5. **Advanced Factors**
   - Flap settings (normal vs short-field)
   - Brake effectiveness
   - Tire condition

## Implementation Steps

1. ✅ Research correction factors and safety guidelines
2. Create types and interfaces for calculator inputs/outputs
3. Implement calculation functions with correction factors
4. Build UI components for inputs and results
5. Add safety warnings and color coding
6. Integrate with existing DA calculator
7. Add educational tooltips and help text
8. Test with known POH values (Cessna 172S as reference)
9. Add runway length input for safety level calculation
10. Document usage instructions

## Testing Plan

### Test Cases:
1. **Baseline (no corrections)**
   - Input: 1,200 ft ground roll, 2,000 ft over 50ft
   - Expected: 1,800 ft ground roll (×1.5), 3,000 ft over 50ft (×1.5)

2. **Headwind benefit**
   - Input: 1,200 ft + 9kt headwind
   - Correction: -10% = 1,080 ft
   - Expected: 1,620 ft (×1.5)

3. **Tailwind penalty**
   - Input: 1,200 ft + 6kt tailwind
   - Correction: +30% = 1,560 ft
   - Expected: 2,340 ft (×1.5)

4. **Grass runway**
   - Input: 1,200 ft on grass
   - Correction: +15% = 1,380 ft
   - Expected: 2,070 ft (×1.5)

5. **Combined worst case**
   - Input: 1,200 ft, 5kt tailwind, wet grass, 2% upslope, high humidity
   - Corrections:
     - Tailwind: +25%
     - Wet grass: +15% × +15% = +32%
     - Upslope: +44%
     - Humidity: +10%
   - Expected: Significant increase (test calculation accuracy)

6. **Cessna 172S Validation**
   - Use actual POH data at specific DA/weight
   - Compare output to known safe values
   - Verify correction factors match POH footnotes

## Success Criteria

- ✅ Calculations match industry-standard correction factors
- ✅ UI is intuitive and matches existing design patterns
- ✅ Safety warnings are prominent and accurate
- ✅ Results match manual POH calculations (within 5%)
- ✅ Code is well-documented with source citations
- ✅ Mobile-responsive layout
- ✅ Accessible (keyboard navigation, screen readers)

## Sources and References

- FAA Advisory Circular AC 91-79B (Weight & Balance)
- FAA Safety Briefings (Density Altitude)
- ForeFlight Technical Articles (Factored Landing Distances)
- NBAA Best Practices (Runway Landing Distance)
- AOPA Air Safety Institute (1.5× safety margin)
- SKYbrary Aviation Safety (Landing Distances, Tailwind Operations)
- Aircraft POHs (Cessna 172S, Piper PA-28 for validation)
