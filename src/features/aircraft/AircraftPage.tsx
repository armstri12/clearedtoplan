import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { localDb, type StorageError } from '../../lib/storage/localDb';
import { makeId } from './id';
import type { AircraftProfile, Station} from './types';
import { assistEnvelope } from '../../lib/math/envelope';
import { toNumber as toNum, validateWeight } from '../../lib/utils';
import { useFlightSession } from '../../context/FlightSessionContext';


function nowIso() {
  return new Date().toISOString();
}

function loadProfiles(): AircraftProfile[] {
  const raw = localDb.getAircraftProfiles();
  // Minimal trust: coerce into expected array shape
  if (!Array.isArray(raw)) return [];
  return raw as AircraftProfile[];
}

function saveProfiles(next: AircraftProfile[]): StorageError | null {
  return localDb.setAircraftProfiles(next);
}

const defaultStations: Station[] = [
  { id: makeId('st'), name: 'Front seats', armIn: 37 },
  { id: makeId('st'), name: 'Rear seats', armIn: 73 },
  { id: makeId('st'), name: 'Baggage', armIn: 95 },
  { id: makeId('st'), name: 'Fuel (usable)', armIn: 48 },
];

function blankProfile(): AircraftProfile {
    const t = nowIso();
    return {
      id: makeId('ac'),
      tailNumber: '',
      makeModel: '',
      notes: 'Datum per POH/AFM. Verify station arms and limits from your aircraft documents.',
      emptyWeight: { weightLb: 0, momentLbIn: 0 },
      limits: { maxRampLb: undefined, maxTakeoffLb: undefined, maxLandingLb: undefined },
      fuel: { usableGal: 0, densityLbPerGal: 6.0 },
      stations: defaultStations,
  
      // Initialize both categories (empty by default)
      cgEnvelopes: {
        normal: { points: [] },
        utility: { points: [] },
      },
  
      createdAt: t,
      updatedAt: t,
    };
  }
  

export default function AircraftPage() {
  const navigate = useNavigate();
  const { currentSession, updateAircraft, completeStep } = useFlightSession();
  const [profiles, setProfiles] = useState<AircraftProfile[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [draft, setDraft] = useState<AircraftProfile>(() => blankProfile());
  const [status, setStatus] = useState<string>('');
  const [storageError, setStorageError] = useState<StorageError | null>(null);
  const [envelopeCategory, setEnvelopeCategory] = useState<'normal' | 'utility'>('normal');

  // Track if migration has been performed for current profile to avoid re-running on every draft change
  const migrationDoneRef = useRef<Set<string>>(new Set());

  // One-time migration from legacy cgEnvelope to cgEnvelopes.normal
  useEffect(() => {
    const legacyLen = draft.cgEnvelope?.points?.length ?? 0;
    const normalLen = draft.cgEnvelopes?.normal?.points?.length ?? 0;

    if (normalLen === 0 && legacyLen > 0 && !migrationDoneRef.current.has(draft.id)) {
      migrationDoneRef.current.add(draft.id);
      updateDraft({
        cgEnvelopes: {
          ...(draft.cgEnvelopes ?? {}),
          normal: { points: draft.cgEnvelope!.points },
        },
      });
    }
  }, [draft.id, draft.cgEnvelope, draft.cgEnvelopes]);
  
  

  useEffect(() => {
    const loaded = loadProfiles();
    setProfiles(loaded);
    if (loaded.length > 0) {
      setSelectedId(loaded[0].id);
      setDraft(loaded[0]);
    }
  }, []);

  const selected = useMemo(
    () => profiles.find((p) => p.id === selectedId),
    [profiles, selectedId],
  );

  useEffect(() => {
    if (selected) setDraft(selected);
  }, [selectedId]); // intentionally not including selected to avoid extra sets

  function updateDraft(patch: Partial<AircraftProfile>) {
    setDraft((d) => ({ ...d, ...patch, updatedAt: nowIso() }));
    setStatus('');
  }

  function updateEmptyWeight(field: 'weightLb' | 'momentLbIn', value: number) {
    const validated = field === 'weightLb' ? validateWeight(value) : value;
    updateDraft({ emptyWeight: { ...draft.emptyWeight, [field]: validated } });
  }

  function updateLimits(field: 'maxRampLb' | 'maxTakeoffLb' | 'maxLandingLb', value?: number) {
    const validated = value !== undefined ? validateWeight(value) : undefined;
    updateDraft({ limits: { ...draft.limits, [field]: validated } });
  }

  function updateFuel(field: 'usableGal' | 'densityLbPerGal', value: number) {
    updateDraft({ fuel: { ...draft.fuel, [field]: value } });
  }

  function addStation() {
    updateDraft({
      stations: [
        ...draft.stations,
        { id: makeId('st'), name: 'New station', armIn: 0, maxWeightLb: undefined },
      ],
    });
  }

  function updateStation(id: string, patch: Partial<Station>) {
    updateDraft({
      stations: draft.stations.map((s) => (s.id === id ? { ...s, ...patch } : s)),
    });
  }

  function removeStation(id: string) {
    updateDraft({ stations: draft.stations.filter((s) => s.id !== id) });
  }

  function getCategoryPoints() {
    const envs = draft.cgEnvelopes ?? {};
    const pts = envs[envelopeCategory]?.points ?? [];
    return pts;
  }
  
  function setCategoryPoints(points: { weightLb: number; cgIn: number }[]) {
    updateDraft({
      cgEnvelopes: {
        ...(draft.cgEnvelopes ?? {}),
        [envelopeCategory]: { points },
      },
    });
  }
  
  
  function addEnvelopePoint() {
    const pts = getCategoryPoints();
    setCategoryPoints([...pts, { weightLb: 0, cgIn: 0 }]);
  }
  
  
  
  function updateEnvelopePoint(idx: number, patch: Partial<{ weightLb: number; cgIn: number }>) {
    const pts = getCategoryPoints();
    const next = pts.map((p, i) => (i === idx ? { ...p, ...patch } : p));
    setCategoryPoints(next);
  }
  
  
  function removeEnvelopePoint(idx: number) {
    const pts = getCategoryPoints();
    setCategoryPoints(pts.filter((_, i) => i !== idx));
  }
  
  
  function clearEnvelope() {
    updateDraft({
      cgEnvelopes: {
        ...(draft.cgEnvelopes ?? {}),
        [envelopeCategory]: { points: [] },
      },
    });
  }
  
  
  function sortEnvelope() {
    const pts = getCategoryPoints();
    const { sorted, validation } = assistEnvelope(pts);
    setCategoryPoints(sorted);
  
    setStatus(validation.ok ? 'Envelope sorted.' : `Envelope sorted, but needs attention: ${validation.messages[0]}`);
  }
  
  function newProfile() {
    const p = blankProfile();
    setDraft(p);
    setSelectedId('');
    setStatus('New profile (not saved yet).');
  }


  function saveCurrent() {
    if (!draft.tailNumber.trim()) {
      setStatus('Tail number is required.');
      return;
    }

    // Normalize/migrate on save: legacy cgEnvelope -> cgEnvelopes.normal
    const normalized: AircraftProfile = (() => {
      const next = { ...draft };

      const legacy = next.cgEnvelope?.points ?? [];
      const normalPts = next.cgEnvelopes?.normal?.points ?? [];

      if (normalPts.length === 0 && legacy.length > 0) {
        next.cgEnvelopes = {
          ...(next.cgEnvelopes ?? {}),
          normal: { points: legacy },
        };
      }

      // Now that categories are live, stop persisting legacy (recommended)
      next.cgEnvelope = undefined;

      return next;
    })();

    const exists = profiles.some((p) => p.id === normalized.id);
    const next = exists
      ? profiles.map((p) => (p.id === normalized.id ? normalized : p))
      : [normalized, ...profiles];

    setProfiles(next);
    const error = saveProfiles(next);
    if (error) {
      setStorageError(error);
      setStatus(`Error saving: ${error.message}`);
      return;
    }
    setStorageError(null);
    setSelectedId(normalized.id);
    setDraft(normalized);
    setStatus('Saved.');
  }

  function deleteSelected() {
    if (!selectedId) return;
    const next = profiles.filter((p) => p.id !== selectedId);
    setProfiles(next);
    const error = saveProfiles(next);
    if (error) {
      setStorageError(error);
      setStatus(`Error deleting: ${error.message}`);
      return;
    }
    setStorageError(null);
    setSelectedId(next[0]?.id ?? '');
    setDraft(next[0] ?? blankProfile());
    setStatus('Deleted.');
  }

  function exportData() {
    try {
      const dataStr = localDb.exportData();
      const blob = new Blob([dataStr], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `clear-to-plan-backup-${new Date().toISOString().slice(0, 10)}.json`;
      link.click();
      URL.revokeObjectURL(url);
      setStatus('Data exported successfully.');
    } catch (err) {
      setStatus('Failed to export data.');
    }
  }

  function importData() {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json';
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (!file) return;

      const reader = new FileReader();
      reader.onload = (e) => {
        const text = e.target?.result as string;
        const result = localDb.importData(text);
        if (result.success) {
          const loaded = loadProfiles();
          setProfiles(loaded);
          if (loaded.length > 0) {
            setSelectedId(loaded[0].id);
            setDraft(loaded[0]);
          }
          setStatus('Data imported successfully.');
          setStorageError(null);
        } else {
          setStatus(`Import failed: ${result.error}`);
        }
      };
      reader.readAsText(file);
    };
    input.click();
  }

  function continueToWeightBalance() {
    if (!draft.tailNumber.trim()) {
      setStatus('Please enter a tail number before continuing.');
      return;
    }

    if (!draft.makeModel.trim()) {
      setStatus('Please enter make/model before continuing.');
      return;
    }

    // Save aircraft data to flight session
    updateAircraft({
      profileId: draft.id,
      ident: draft.tailNumber,
      type: draft.makeModel,
      emptyWeight: draft.emptyWeight.weightLb,
      emptyMoment: draft.emptyWeight.momentLbIn,
      maxRampWeight: draft.limits.maxRampLb,
      maxTakeoffWeight: draft.limits.maxTakeoffLb,
      maxLandingWeight: draft.limits.maxLandingLb,
      fuelCapacityUsable: draft.fuel.usableGal,
      fuelDensity: draft.fuel.densityLbPerGal,
      performance: {
        cruisePerformance: draft.performance?.cruisePerformance || [],
        takeoffGroundRoll: draft.performance?.takeoffGroundRoll || 0,
        takeoffOver50ft: draft.performance?.takeoffOver50ft || 0,
        landingGroundRoll: draft.performance?.landingGroundRoll || 0,
        landingOver50ft: draft.performance?.landingOver50ft || 0,
      },
    });

    // Mark aircraft step as complete
    completeStep('aircraft');

    // Navigate to weight & balance
    navigate('/wb');
  }

  return (
    <div>
      <h2>Aircraft Profiles</h2>
      <p style={{ marginTop: 4, opacity: 0.8 }}>
        Create a profile per tail number. Use your POH/AFM and W&amp;B paperwork for exact arms and
        limits.
      </p>

      {storageError && storageError.type === 'quota_exceeded' && (
        <div
          style={{
            marginTop: 12,
            padding: 12,
            border: '2px solid #f59e0b',
            borderRadius: 12,
            background: '#fffbeb',
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: 6 }}>⚠️ Storage Warning</div>
          <div style={{ fontSize: 14 }}>{storageError.message}</div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16, marginTop: 16 }}>
        <div style={{ border: '1px solid #ddd', borderRadius: 12, padding: 12 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <button onClick={newProfile}>New</button>
            <button onClick={saveCurrent}>Save</button>
            <button onClick={deleteSelected} disabled={!selectedId} aria-label="Delete selected profile">
              Delete
            </button>
          </div>

          <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
            <button onClick={exportData} aria-label="Export all data to JSON file">
              Export
            </button>
            <button onClick={importData} aria-label="Import data from JSON file">
              Import
            </button>
          </div>

          <div style={{ marginBottom: 8, fontSize: 12, opacity: 0.8 }}>{status}</div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <label style={{ fontSize: 12, opacity: 0.8 }}>Saved profiles</label>
            <select
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
              style={{ padding: 8, borderRadius: 8 }}
            >
              <option value="">(editing unsaved)</option>
              {profiles.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.tailNumber || '(no tail)'} — {p.makeModel || '(no model)'}
                </option>
              ))}
            </select>
          </div>

          {selected && (
            <div style={{ marginTop: 12, fontSize: 12, opacity: 0.7 }}>
              Updated: {new Date(selected.updatedAt).toLocaleString()}
            </div>
          )}
        </div>

        <div style={{ border: '1px solid #ddd', borderRadius: 12, padding: 12 }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div>
              <label>Tail number</label>
              <input
                value={draft.tailNumber}
                onChange={(e) => updateDraft({ tailNumber: e.target.value.toUpperCase() })}
                placeholder="N123AB"
                style={{ width: '100%', padding: 8, borderRadius: 8 }}
              />
            </div>

            <div>
              <label>Make / Model</label>
              <input
                value={draft.makeModel}
                onChange={(e) => updateDraft({ makeModel: e.target.value })}
                placeholder="C172S"
                style={{ width: '100%', padding: 8, borderRadius: 8 }}
              />
            </div>

            <div>
              <label>Empty weight (lb)</label>
              <input
                id="empty-weight"
                value={String(draft.emptyWeight.weightLb)}
                onChange={(e) =>
                  updateEmptyWeight('weightLb', toNum(e.target.value) ?? 0)
                }
                inputMode="decimal"
                style={{ width: '100%', padding: 8, borderRadius: 8 }}
                aria-label="Empty weight in pounds"
              />
            </div>

            <div>
              <label htmlFor="empty-moment">Empty moment (lb-in)</label>
              <input
                id="empty-moment"
                value={String(draft.emptyWeight.momentLbIn)}
                onChange={(e) =>
                  updateEmptyWeight('momentLbIn', toNum(e.target.value) ?? 0)
                }
                inputMode="decimal"
                style={{ width: '100%', padding: 8, borderRadius: 8 }}
                aria-label="Empty moment in pound-inches"
              />
            </div>

            <div>
              <label htmlFor="max-ramp">Max ramp (lb)</label>
              <input
                id="max-ramp"
                value={draft.limits.maxRampLb ?? ''}
                onChange={(e) => updateLimits('maxRampLb', toNum(e.target.value))}
                inputMode="decimal"
                style={{ width: '100%', padding: 8, borderRadius: 8 }}
                aria-label="Maximum ramp weight in pounds"
              />
            </div>

            <div>
              <label htmlFor="max-takeoff">Max takeoff (lb)</label>
              <input
                id="max-takeoff"
                value={draft.limits.maxTakeoffLb ?? ''}
                onChange={(e) => updateLimits('maxTakeoffLb', toNum(e.target.value))}
                inputMode="decimal"
                style={{ width: '100%', padding: 8, borderRadius: 8 }}
                aria-label="Maximum takeoff weight in pounds"
              />
            </div>

            <div>
              <label htmlFor="max-landing">Max landing (lb)</label>
              <input
                id="max-landing"
                value={draft.limits.maxLandingLb ?? ''}
                onChange={(e) => updateLimits('maxLandingLb', toNum(e.target.value))}
                inputMode="decimal"
                style={{ width: '100%', padding: 8, borderRadius: 8 }}
                aria-label="Maximum landing weight in pounds"
              />
            </div>

            <div>
              <label htmlFor="usable-fuel">Usable fuel (gal)</label>
              <input
                id="usable-fuel"
                value={String(draft.fuel.usableGal)}
                onChange={(e) => updateFuel('usableGal', toNum(e.target.value) ?? 0)}
                inputMode="decimal"
                style={{ width: '100%', padding: 8, borderRadius: 8 }}
                aria-label="Usable fuel in gallons"
              />
            </div>

            <div>
              <label htmlFor="fuel-density">Fuel density (lb/gal)</label>
              <input
                id="fuel-density"
                value={String(draft.fuel.densityLbPerGal)}
                onChange={(e) =>
                  updateFuel('densityLbPerGal', toNum(e.target.value) ?? 6.0)
                }
                aria-label="Fuel density in pounds per gallon"
                inputMode="decimal"
                style={{ width: '100%', padding: 8, borderRadius: 8 }}
              />
            </div>

            <div style={{ gridColumn: '1 / -1' }}>
              <label>Notes</label>
              <textarea
                value={draft.notes ?? ''}
                onChange={(e) => updateDraft({ notes: e.target.value })}
                rows={3}
                style={{ width: '100%', padding: 8, borderRadius: 8 }}
              />
            </div>
          </div>

          <hr style={{ margin: '16px 0' }} />

          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <h3 style={{ margin: 0 }}>Stations</h3>
            <button onClick={addStation}>Add station</button>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 12 }}>
            {draft.stations.map((s) => (
              <div
                key={s.id}
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1.4fr 0.6fr 0.6fr auto',
                  gap: 8,
                  alignItems: 'center',
                }}
              >
                <input
                  value={s.name}
                  onChange={(e) => updateStation(s.id, { name: e.target.value })}
                  style={{ padding: 8, borderRadius: 8 }}
                  aria-label={`Station name: ${s.name}`}
                />
                <input
                  value={String(s.armIn)}
                  onChange={(e) =>
                    updateStation(s.id, { armIn: toNum(e.target.value) ?? 0 })
                  }
                  inputMode="decimal"
                  placeholder="Arm (in)"
                  style={{ padding: 8, borderRadius: 8 }}
                  aria-label={`Arm for ${s.name} in inches`}
                />
                <input
                  value={s.maxWeightLb ?? ''}
                  onChange={(e) =>
                    updateStation(s.id, { maxWeightLb: toNum(e.target.value) })
                  }
                  inputMode="decimal"
                  placeholder="Max lb"
                  style={{ padding: 8, borderRadius: 8 }}
                  aria-label={`Maximum weight for ${s.name} in pounds`}
                />
                <button
                  onClick={() => removeStation(s.id)}
                  title="Remove station"
                  aria-label={`Remove station ${s.name}`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>


<hr style={{ margin: '16px 0' }} />

<h3 style={{ margin: 0 }}>CG Envelope (optional)</h3>

<p style={{ marginTop: 8, fontSize: 12, opacity: 0.8 }}>
  Enter points from the POH/AFM envelope chart. CG is <b>inches aft of datum</b>. Use <b>Sort</b> to
  order points around the perimeter.
</p>

<div style={{ marginTop: 12, display: 'flex', gap: 12, alignItems: 'center' }}>
  <label style={{ fontSize: 12, opacity: 0.8 }}>Envelope category</label>
  <select
    value={envelopeCategory}
    onChange={(e) => setEnvelopeCategory(e.target.value as 'normal' | 'utility')}
    style={{ padding: 8, borderRadius: 8 }}
  >
    <option value="normal">Normal</option>
    <option value="utility">Utility</option>
  </select>
</div>

{/* Controls */}
<div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 10 }}>
  <button onClick={addEnvelopePoint}>Add point</button>
  <button onClick={sortEnvelope} disabled={getCategoryPoints().length < 3}>
    Sort points
  </button>
  <button onClick={clearEnvelope} disabled={getCategoryPoints().length === 0}>
    Clear envelope
  </button>
</div>

{/* Validation */}
{(() => {
  const pts = getCategoryPoints();
  const report = assistEnvelope(pts).validation;
  const n = pts.length;

  if (n === 0) {
    return (
      <div style={{ marginTop: 10, fontSize: 12, opacity: 0.75 }}>
        No envelope points yet for <b>{envelopeCategory}</b>. Click <b>Add point</b> to start.
      </div>
    );
  }

  if (n < 3) {
    return (
      <div style={{ marginTop: 10, fontSize: 12, fontWeight: 800, opacity: 0.8 }}>
        Envelope inactive — add at least 3 points
      </div>
    );
  }

  return report.ok ? (
    <div style={{ marginTop: 10, fontSize: 12, fontWeight: 900 }}>
      Envelope status: ✅ valid ({envelopeCategory})
    </div>
  ) : (
    <div style={{ marginTop: 10, fontSize: 12 }}>
      <div style={{ fontWeight: 900 }}>Envelope status: ⛔ needs fixes ({envelopeCategory})</div>
      <ul style={{ margin: '6px 0 0 18px' }}>
        {report.messages.map((m, idx) => (
          <li key={idx}>{m}</li>
        ))}
      </ul>
    </div>
  );
})()}

{/* Header row */}
<div
  style={{
    display: 'grid',
    gridTemplateColumns: '0.7fr 0.7fr auto',
    gap: 8,
    fontSize: 12,
    fontWeight: 800,
    opacity: 0.85,
    marginTop: 12,
    paddingLeft: 2,
  }}
>
  <div>Weight (lb)</div>
  <div>CG (in aft of datum)</div>
  <div></div>
</div>

{/* Points */}
<div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
  {getCategoryPoints().map((p, idx) => (
    <div
      key={idx}
      style={{
        display: 'grid',
        gridTemplateColumns: '0.7fr 0.7fr auto',
        gap: 8,
        alignItems: 'center',
      }}
    >
      <input
        type="number"
        step="1"
        value={p.weightLb}
        onChange={(e) => updateEnvelopePoint(idx, { weightLb: Number(e.target.value) || 0 })}
        placeholder="e.g. 2550"
        style={{ padding: 8, borderRadius: 8 }}
      />
      <input
        type="number"
        step="0.01"
        value={p.cgIn}
        onChange={(e) => updateEnvelopePoint(idx, { cgIn: Number(e.target.value) || 0 })}
        placeholder="e.g. 41.25"
        style={{ padding: 8, borderRadius: 8 }}
      />
      <button onClick={() => removeEnvelopePoint(idx)} title="Remove point">
        ✕
      </button>
    </div>
  ))}
</div>

{/* Tiny preview */}
{(() => {
  const ptsRaw = getCategoryPoints();
  const { sorted, validation } = assistEnvelope(ptsRaw);
  if (sorted.length < 3) return null;

  const xs = sorted.map((p) => p.cgIn);
  const ys = sorted.map((p) => p.weightLb);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);

  const W = 240;
  const H = 140;
  const pad = 10;

  const sx = (x: number) => pad + ((x - minX) / (maxX - minX || 1)) * (W - pad * 2);
  const sy = (y: number) => pad + (1 - (y - minY) / (maxY - minY || 1)) * (H - pad * 2);

  const polyPts = sorted.map((p) => `${sx(p.cgIn)},${sy(p.weightLb)}`).join(' ');

  return (
    <div style={{ marginTop: 12, border: '1px solid #eee', borderRadius: 12, padding: 10 }}>
      <div style={{ fontSize: 12, fontWeight: 900, marginBottom: 6 }}>
        Preview ({envelopeCategory}) {validation.ok ? '✅' : '⛔'}
      </div>
      <svg width={W} height={H} style={{ border: '1px solid #f0f0f0', borderRadius: 8 }}>
        <polygon points={polyPts} fill="none" stroke="black" strokeWidth={2} />
      </svg>
      <div style={{ marginTop: 6, fontSize: 11, opacity: 0.75 }}>
        This is a shape preview only (not to scale). Use W&amp;B page for the plotted ramp/TO/LDG points.
      </div>
    </div>
  );
})()}

{/* Continue Button */}
<div
  style={{
    marginTop: 32,
    paddingTop: 24,
    borderTop: '2px solid #e2e8f0',
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
  }}
>
  <div style={{ fontSize: 14, color: '#64748b' }}>
    {currentSession && (
      <div>
        Flight Plan: <strong>{currentSession.name}</strong>
      </div>
    )}
  </div>
  <button
    onClick={continueToWeightBalance}
    style={{
      padding: '12px 32px',
      background: '#2563eb',
      color: '#fff',
      border: 'none',
      borderRadius: 8,
      fontWeight: 700,
      fontSize: 16,
      cursor: 'pointer',
      transition: 'all 0.2s',
    }}
    onMouseEnter={(e) => {
      e.currentTarget.style.background = '#1e40af';
      e.currentTarget.style.transform = 'translateY(-1px)';
    }}
    onMouseLeave={(e) => {
      e.currentTarget.style.background = '#2563eb';
      e.currentTarget.style.transform = 'translateY(0)';
    }}
  >
    Continue to Weight & Balance →
  </button>
</div>


        </div>
      </div>
    </div>
  );
}
