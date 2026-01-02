const KEY = 'clear-to-plan:v1';

export type DbShape = {
  aircraftProfiles: unknown[];
};

export type StorageError = {
  type: 'quota_exceeded' | 'parse_error' | 'privacy_mode' | 'unknown';
  message: string;
};

let lastError: StorageError | null = null;

function readRaw(): DbShape {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return { aircraftProfiles: [] };
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') {
      lastError = {
        type: 'parse_error',
        message: 'Stored data is corrupted. Starting fresh.'
      };
      return { aircraftProfiles: [] };
    }
    return {
      aircraftProfiles: Array.isArray((parsed as any).aircraftProfiles)
        ? (parsed as any).aircraftProfiles
        : [],
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unknown error reading data';
    lastError = {
      type: err instanceof Error && err.name === 'SecurityError' ? 'privacy_mode' : 'unknown',
      message: `Failed to load data: ${message}`
    };
    return { aircraftProfiles: [] };
  }
}

function writeRaw(db: DbShape): StorageError | null {
  try {
    const serialized = JSON.stringify(db);

    // Check approximate quota usage (5MB typical limit)
    const estimatedSize = new Blob([serialized]).size;
    if (estimatedSize > 4.5 * 1024 * 1024) { // 4.5MB warning threshold
      lastError = {
        type: 'quota_exceeded',
        message: 'Data size approaching storage limit. Consider exporting and deleting old profiles.'
      };
      // Still try to save, but warn user
    }

    localStorage.setItem(KEY, serialized);
    return null;
  } catch (err) {
    if (err instanceof Error && err.name === 'QuotaExceededError') {
      lastError = {
        type: 'quota_exceeded',
        message: 'Storage quota exceeded. Please export your data and delete some profiles.'
      };
      return lastError;
    }

    if (err instanceof Error && err.name === 'SecurityError') {
      lastError = {
        type: 'privacy_mode',
        message: 'Cannot save data (privacy mode or cookies disabled).'
      };
      return lastError;
    }

    const message = err instanceof Error ? err.message : 'Unknown error';
    lastError = {
      type: 'unknown',
      message: `Failed to save data: ${message}`
    };
    return lastError;
  }
}

export const localDb = {
  getAircraftProfiles(): unknown[] {
    return readRaw().aircraftProfiles;
  },

  setAircraftProfiles(profiles: unknown[]): StorageError | null {
    const db = readRaw();
    db.aircraftProfiles = profiles;
    return writeRaw(db);
  },

  getLastError(): StorageError | null {
    return lastError;
  },

  clearLastError(): void {
    lastError = null;
  },

  exportData(): string {
    const db = readRaw();
    return JSON.stringify(db, null, 2);
  },

  importData(jsonString: string): { success: boolean; error?: string } {
    try {
      const parsed = JSON.parse(jsonString);
      if (!parsed || typeof parsed !== 'object') {
        return { success: false, error: 'Invalid data format' };
      }

      const db: DbShape = {
        aircraftProfiles: Array.isArray(parsed.aircraftProfiles) ? parsed.aircraftProfiles : []
      };

      const writeError = writeRaw(db);
      if (writeError) {
        return { success: false, error: writeError.message };
      }

      return { success: true };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Failed to parse import data'
      };
    }
  }
};
