export type CorrectionApplied = {
  factor: string;
  description: string;
  multiplier: number;
};

export type DistanceResults = {
  groundRoll: number;
  over50ft: number;
  corrections: CorrectionApplied[];
  baselineGroundRoll: number;
  baselineOver50ft: number;
  safetyMargin: number;
};

export type TakeoffInputs = {
  pohGroundRoll: number;
  pohDistanceOver50ft: number;
  currentWeight?: number;
  pohBaselineWeight?: number;
  windComponent: number;
  runwayType: 'paved' | 'grass' | 'gravel';
  runwayCondition: 'dry' | 'wet';
  runwaySlope: number;
  humidity: 'normal' | 'high';
};

export type LandingInputs = {
  pohGroundRoll: number;
  pohDistanceOver50ft: number;
  landingWeight?: number;
  pohBaselineWeight?: number;
  windComponent: number;
  runwayType: 'paved' | 'grass' | 'gravel';
  runwayCondition: 'dry' | 'wet';
  runwaySlope: number;
  safetyFactor?: number;
};

export type RunwaySafetyAssessment = {
  level: 'safe' | 'caution' | 'danger' | 'unknown';
  color: string;
  bgColor: string;
  message: string;
};

// Correction factors based on FAA/AOPA guidance (see TAKEOFF_LANDING_CALCULATOR_PLAN.md)
export const TAKEOFF_CORRECTIONS = {
  headwindFactor: -0.10 / 9, // -10% per 9kt
  tailwindFactor: 0.10 / 2,  // +10% per 2kt
  grass: 1.15,
  gravel: 1.15,
  wet: 1.15,
  uphillFactor: 0.22,
  downhillFactor: -0.07,
  highHumidity: 1.10,
  safetyMargin: 1.5,
};

export const LANDING_CORRECTIONS = {
  headwindFactor: -0.10 / 9,
  tailwindFactor: 0.10 / 2,
  grass: 1.15,
  gravel: 1.15,
  wet: 1.35,
  wetGrass: 1.60,
  uphillFactor: -0.07,
  downhillFactor: 0.22,
  safetyMargin: 1.5,
};

function applyWindCorrection(
  groundRoll: number,
  over50ft: number,
  windComponent: number,
  headwindFactor: number,
  tailwindFactor: number,
  corrections: CorrectionApplied[],
) {
  if (windComponent === 0) {
    return { groundRoll, over50ft };
  }

  const windFactor = windComponent > 0
    ? headwindFactor * windComponent
    : tailwindFactor * Math.abs(windComponent);

  const windMultiplier = 1 + windFactor;

  corrections.push({
    factor: 'Wind',
    description: windComponent > 0
      ? `${windComponent}kt headwind`
      : `${Math.abs(windComponent)}kt tailwind`,
    multiplier: windMultiplier,
  });

  return {
    groundRoll: groundRoll * windMultiplier,
    over50ft: over50ft * windMultiplier,
  };
}

function applyRunwaySurfaceCorrection(
  groundRoll: number,
  over50ft: number,
  runwayType: 'paved' | 'grass' | 'gravel',
  runwayCondition: 'dry' | 'wet',
  takeoff: boolean,
  corrections: CorrectionApplied[],
) {
  if (runwayType === 'grass') {
    const surfaceMultiplier = runwayCondition === 'wet'
      ? takeoff
        ? TAKEOFF_CORRECTIONS.grass * TAKEOFF_CORRECTIONS.wet
        : LANDING_CORRECTIONS.wetGrass
      : takeoff
        ? TAKEOFF_CORRECTIONS.grass
        : LANDING_CORRECTIONS.grass;

    corrections.push({
      factor: 'Runway Surface',
      description: runwayCondition === 'wet' ? 'Wet grass' : 'Dry grass',
      multiplier: surfaceMultiplier,
    });

    return {
      groundRoll: groundRoll * surfaceMultiplier,
      over50ft: over50ft * surfaceMultiplier,
    };
  }

  if (runwayType === 'gravel') {
    const gravelMultiplier = takeoff ? TAKEOFF_CORRECTIONS.gravel : LANDING_CORRECTIONS.gravel;
    corrections.push({
      factor: 'Runway Surface',
      description: 'Gravel',
      multiplier: gravelMultiplier,
    });

    return {
      groundRoll: groundRoll * gravelMultiplier,
      over50ft: over50ft * gravelMultiplier,
    };
  }

  if (runwayCondition === 'wet') {
    const wetMultiplier = takeoff ? TAKEOFF_CORRECTIONS.wet : LANDING_CORRECTIONS.wet;
    corrections.push({
      factor: 'Runway Condition',
      description: 'Wet paved',
      multiplier: wetMultiplier,
    });

    return {
      groundRoll: groundRoll * wetMultiplier,
      over50ft: over50ft * wetMultiplier,
    };
  }

  return { groundRoll, over50ft };
}

function applyRunwaySlopeCorrection(
  groundRoll: number,
  over50ft: number,
  runwaySlope: number,
  takeoff: boolean,
  corrections: CorrectionApplied[],
) {
  if (runwaySlope === 0) {
    return { groundRoll, over50ft };
  }

  const slopeFactor = runwaySlope > 0
    ? (takeoff ? TAKEOFF_CORRECTIONS.uphillFactor : LANDING_CORRECTIONS.uphillFactor) * runwaySlope
    : (takeoff ? TAKEOFF_CORRECTIONS.downhillFactor : LANDING_CORRECTIONS.downhillFactor) * Math.abs(runwaySlope);

  const slopeMultiplier = 1 + slopeFactor;

  corrections.push({
    factor: 'Runway Slope',
    description: runwaySlope > 0
      ? `${runwaySlope}% upslope${takeoff ? '' : ' (helps)'}`
      : `${Math.abs(runwaySlope)}% downslope${takeoff ? '' : ' (hurts)'}`,
    multiplier: slopeMultiplier,
  });

  return {
    groundRoll: groundRoll * slopeMultiplier,
    over50ft: over50ft * slopeMultiplier,
  };
}

function applyWeightAdjustment(
  groundRoll: number,
  over50ft: number,
  currentWeight: number | undefined,
  baselineWeight: number | undefined,
  corrections: CorrectionApplied[],
) {
  if (!currentWeight || !baselineWeight || baselineWeight === 0) {
    return { groundRoll, over50ft };
  }

  const delta = (currentWeight - baselineWeight) / baselineWeight;
  if (delta === 0) {
    return { groundRoll, over50ft };
  }

  // Simple proportional adjustment: 10% distance change for 10% weight change
  const weightMultiplier = 1 + delta;

  corrections.push({
    factor: 'Weight',
    description: delta > 0
      ? `+${Math.round(delta * 100)}% heavier than POH baseline`
      : `${Math.round(Math.abs(delta) * 100)}% lighter than POH baseline`,
    multiplier: weightMultiplier,
  });

  return {
    groundRoll: groundRoll * weightMultiplier,
    over50ft: over50ft * weightMultiplier,
  };
}

export function calculateTakeoffDistance(inputs: TakeoffInputs): DistanceResults {
  const corrections: CorrectionApplied[] = [];
  let groundRoll = inputs.pohGroundRoll;
  let over50ft = inputs.pohDistanceOver50ft;

  ({ groundRoll, over50ft } = applyWeightAdjustment(
    groundRoll,
    over50ft,
    inputs.currentWeight,
    inputs.pohBaselineWeight,
    corrections,
  ));

  ({ groundRoll, over50ft } = applyWindCorrection(
    groundRoll,
    over50ft,
    inputs.windComponent,
    TAKEOFF_CORRECTIONS.headwindFactor,
    TAKEOFF_CORRECTIONS.tailwindFactor,
    corrections,
  ));

  ({ groundRoll, over50ft } = applyRunwaySurfaceCorrection(
    groundRoll,
    over50ft,
    inputs.runwayType,
    inputs.runwayCondition,
    true,
    corrections,
  ));

  ({ groundRoll, over50ft } = applyRunwaySlopeCorrection(
    groundRoll,
    over50ft,
    inputs.runwaySlope,
    true,
    corrections,
  ));

  if (inputs.humidity === 'high') {
    corrections.push({
      factor: 'Humidity',
      description: 'High humidity',
      multiplier: TAKEOFF_CORRECTIONS.highHumidity,
    });

    groundRoll *= TAKEOFF_CORRECTIONS.highHumidity;
    over50ft *= TAKEOFF_CORRECTIONS.highHumidity;
  }

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

export function calculateLandingDistance(inputs: LandingInputs): DistanceResults {
  const corrections: CorrectionApplied[] = [];
  let groundRoll = inputs.pohGroundRoll;
  let over50ft = inputs.pohDistanceOver50ft;

  ({ groundRoll, over50ft } = applyWeightAdjustment(
    groundRoll,
    over50ft,
    inputs.landingWeight,
    inputs.pohBaselineWeight,
    corrections,
  ));

  ({ groundRoll, over50ft } = applyWindCorrection(
    groundRoll,
    over50ft,
    inputs.windComponent,
    LANDING_CORRECTIONS.headwindFactor,
    LANDING_CORRECTIONS.tailwindFactor,
    corrections,
  ));

  ({ groundRoll, over50ft } = applyRunwaySurfaceCorrection(
    groundRoll,
    over50ft,
    inputs.runwayType,
    inputs.runwayCondition,
    false,
    corrections,
  ));

  ({ groundRoll, over50ft } = applyRunwaySlopeCorrection(
    groundRoll,
    over50ft,
    inputs.runwaySlope,
    false,
    corrections,
  ));

  const safety = inputs.safetyFactor ?? LANDING_CORRECTIONS.safetyMargin;
  const finalGroundRoll = Math.round(groundRoll * safety);
  const finalOver50ft = Math.round(over50ft * safety);

  return {
    groundRoll: finalGroundRoll,
    over50ft: finalOver50ft,
    corrections,
    baselineGroundRoll: inputs.pohGroundRoll,
    baselineOver50ft: inputs.pohDistanceOver50ft,
    safetyMargin: safety,
  };
}

export function getRunwaySafetyLevel(requiredFt: number, availableFt: number | null | undefined): RunwaySafetyAssessment {
  if (!availableFt || availableFt === 0) {
    return {
      level: 'unknown',
      color: '#6b7280',
      bgColor: '#f3f4f6',
      message: 'Enter runway length to assess safety',
    };
  }

  const percentage = (requiredFt / availableFt) * 100;

  if (percentage <= 70) {
    return {
      level: 'safe',
      color: '#059669',
      bgColor: '#ecfdf5',
      message: `✅ SAFE: Using ${Math.round(percentage)}% of runway (≤70% recommended)`,
    };
  }

  if (percentage <= 85) {
    return {
      level: 'caution',
      color: '#d97706',
      bgColor: '#fffbeb',
      message: `⚠️ CAUTION: Using ${Math.round(percentage)}% of runway. Limited margin - consider conditions carefully.`,
    };
  }

  return {
    level: 'danger',
    color: '#dc2626',
    bgColor: '#fef2f2',
    message: `⛔ DANGER: Requires ${Math.round(percentage)}% of runway. INSUFFICIENT - DO NOT ATTEMPT.`,
  };
}
