export type EnvelopePoint = {
    weightLb: number;
    cgIn: number;
  };
  
  export type CategoryEnvelopes = {
    normal?: { points: EnvelopePoint[] };
    utility?: { points: EnvelopePoint[] };
  };
  
  export type Station = {
    id: string;
    name: string;
    armIn: number;
    maxWeightLb?: number;
  };
  
  export type AircraftProfile = {
    id: string;
    tailNumber: string;
    makeModel: string;
    notes?: string;
  
    emptyWeight: { weightLb: number; momentLbIn: number };
    limits: { maxRampLb?: number; maxTakeoffLb?: number; maxLandingLb?: number };
    fuel: { usableGal: number; densityLbPerGal: number };
  
    stations: Station[];
  
    // New (preferred)
    cgEnvelopes?: CategoryEnvelopes;
  
    // Legacy (optional, for migration only — safe to keep for now)
    cgEnvelope?: { points: EnvelopePoint[] };
  
    createdAt: string;
    updatedAt: string;
  };
  