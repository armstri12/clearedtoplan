/**
 * Shared utility functions for the application
 */

/**
 * Round a number to a specified number of decimal places
 */
export function round(n: number, digits = 1): number {
  const p = Math.pow(10, digits);
  return Math.round(n * p) / p;
}

/**
 * Clamp a number between min and max values
 */
export function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

/**
 * Convert a string to a number, returning undefined if invalid
 */
export function toNumber(value: string): number | undefined {
  const v = value.trim();
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}

/**
 * Validation constraints for aviation-specific inputs
 */
export const AVIATION_LIMITS = {
  // Weight limits (pounds)
  MIN_WEIGHT: 0,
  MAX_WEIGHT: 100000,
  MAX_PASSENGER_WEIGHT: 700,

  // Altitude limits (feet)
  MIN_ALTITUDE: -1000, // Below sea level (e.g., Death Valley)
  MAX_ALTITUDE: 25000, // Typical for non-pressurized GA

  // Fuel limits
  MIN_FUEL: 0,
  MAX_FUEL_DENSITY: 7.0, // lb/gal (avgas ~6.0, jet-A ~6.7)

  // Speed limits (knots)
  MIN_SPEED: 0,
  MAX_SPEED: 500,

  // VFR fuel reserve requirements (minutes)
  VFR_DAY_RESERVE_MIN: 30,
  VFR_NIGHT_RESERVE_MIN: 45,
} as const;

/**
 * Validate and clamp weight input
 */
export function validateWeight(value: number, maxWeight = AVIATION_LIMITS.MAX_WEIGHT): number {
  return clamp(value, AVIATION_LIMITS.MIN_WEIGHT, maxWeight);
}

/**
 * Validate and clamp altitude input
 */
export function validateAltitude(value: number): number {
  return clamp(value, AVIATION_LIMITS.MIN_ALTITUDE, AVIATION_LIMITS.MAX_ALTITUDE);
}

/**
 * Validate and clamp passenger weight
 */
export function validatePassengerWeight(value: number): number {
  return clamp(value, AVIATION_LIMITS.MIN_WEIGHT, AVIATION_LIMITS.MAX_PASSENGER_WEIGHT);
}

/**
 * Check if fuel remaining meets VFR reserve requirements
 * @param fuelRemainingGal - Fuel remaining in gallons
 * @param fuelBurnGph - Fuel burn rate in gallons per hour
 * @param isNight - Whether it's a night flight
 * @returns Object with validation result and message
 */
export function checkFuelReserve(
  fuelRemainingGal: number,
  fuelBurnGph: number,
  isNight = false
): { ok: boolean; message: string } {
  if (fuelBurnGph <= 0) {
    return { ok: true, message: '' };
  }

  const reserveMin = isNight
    ? AVIATION_LIMITS.VFR_NIGHT_RESERVE_MIN
    : AVIATION_LIMITS.VFR_DAY_RESERVE_MIN;

  const requiredGal = (reserveMin / 60) * fuelBurnGph;
  const minutesRemaining = (fuelRemainingGal / fuelBurnGph) * 60;

  if (fuelRemainingGal < requiredGal) {
    return {
      ok: false,
      message: `Landing fuel (${round(fuelRemainingGal, 1)} gal = ${round(minutesRemaining, 0)} min) is below VFR ${isNight ? 'night' : 'day'} reserve requirement (${reserveMin} min = ${round(requiredGal, 1)} gal).`
    };
  }

  return { ok: true, message: '' };
}
