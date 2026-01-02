const KEY = 'clear-to-plan:v1';

export type DbShape = {
  aircraftProfiles: unknown[];
};

function readRaw(): DbShape {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { aircraftProfiles: [] };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return { aircraftProfiles: [] };
    return {
      aircraftProfiles: Array.isArray((parsed as any).aircraftProfiles)
        ? (parsed as any).aircraftProfiles
        : [],
    };
  } catch {
    return { aircraftProfiles: [] };
  }
}

function writeRaw(db: DbShape) {
  localStorage.setItem(KEY, JSON.stringify(db));
}

export const localDb = {
  getAircraftProfiles(): unknown[] {
    return readRaw().aircraftProfiles;
  },
  setAircraftProfiles(profiles: unknown[]) {
    const db = readRaw();
    db.aircraftProfiles = profiles;
    writeRaw(db);
  },
};
