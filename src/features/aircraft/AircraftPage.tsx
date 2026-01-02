import { useEffect, useMemo, useState } from 'react';
import { localDb } from '../../lib/storage/localDb';
import { makeId } from './id';
import type { AircraftProfile, Station} from './types';
import { assistEnvelope } from '../../lib/math/envelope';


function nowIso() {
  return new Date().toISOString();
}

function toNumber(value: string): number | undefined {
  const v = value.trim();
  if (!v) return undefined;
  const n = Number(v);
  return Number.isFinite(n) ? n : undefined;
}


function loadProfiles(): AircraftProfile[] {
  const raw = localDb.getAircraftProfiles();
  // Minimal trust: coerce into expected array shape
  if (!Array.isArray(raw)) return [];
  return raw as AircraftProfile[];
}

function saveProfiles(next: AircraftProfile[]) {
  localDb.setAircraftProfiles(next);
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
  const [profiles, setProfiles] = useState<AircraftProfile[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');
  const [draft, setDraft] = useState<AircraftProfile>(() => blankProfile());
  const [status, setStatus] = useState<string>('');
  const [envelopeCategory, setEnvelopeCategory] = useState<'normal' | 'utility'>('normal');

  useEffect(() => {
    const legacyLen = draft.cgEnvelope?.points?.length ?? 0;
    const normalLen = draft.cgEnvelopes?.normal?.points?.length ?? 0;
  
    if (normalLen === 0 && legacyLen > 0) {
      updateDraft({
        cgEnvelopes: {
          ...(draft.cgEnvelopes ?? {}),
          normal: { points: draft.cgEnvelope!.points },
        },
      });
    }
  }, [draft.cgEnvelope, draft.cgEnvelopes]);
  
  

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
    updateDraft({ emptyWeight: { ...draft.emptyWeight, [field]: value } });
  }

  function updateLimits(field: 'maxRampLb' | 'maxTakeoffLb' | 'maxLandingLb', value?: number) {
    updateDraft({ limits: { ...draft.limits, [field]: value } });
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
    saveProfiles(next);
    setSelectedId(normalized.id);
    setDraft(normalized);
    setStatus('Saved.');
  }
  
  

  function deleteSelected() {
    if (!selectedId) return;
    const next = profiles.filter((p) => p.id !== selectedId);
    setProfiles(next);
    saveProfiles(next);
    setSelectedId(next[0]?.id ?? '');
    setDraft(next[0] ?? blankProfile());
    setStatus('Deleted.');
  }

  return (
    <div>
      <h2>Aircraft Profiles</h2>
      <p style={{ marginTop: 4, opacity: 0.8 }}>
        Create a profile per tail number. Use your POH/AFM and W&amp;B paperwork for exact arms and
        limits.
      </p>

      <div style={{ display: 'grid', gridTemplateColumns: '260px 1fr', gap: 16, marginTop: 16 }}>
        <div style={{ border: '1px solid #ddd', borderRadius: 12, padding: 12 }}>
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <button onClick={newProfile}>New</button>
            <button onClick={saveCurrent}>Save</button>
            <button onClick={deleteSelected} disabled={!selectedId}>
              Delete
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
                value={String(draft.emptyWeight.weightLb)}
                onChange={(e) =>
                  updateEmptyWeight('weightLb', toNumber(e.target.value) ?? 0)
                }
                inputMode="decimal"
                style={{ width: '100%', padding: 8, borderRadius: 8 }}
              />
            </div>

            <div>
              <label>Empty moment (lb-in)</label>
              <input
                value={String(draft.emptyWeight.momentLbIn)}
                onChange={(e) =>
                  updateEmptyWeight('momentLbIn', toNumber(e.target.value) ?? 0)
                }
                inputMode="decimal"
                style={{ width: '100%', padding: 8, borderRadius: 8 }}
              />
            </div>

            <div>
              <label>Max ramp (lb)</label>
              <input
                value={draft.limits.maxRampLb ?? ''}
                onChange={(e) => updateLimits('maxRampLb', toNumber(e.target.value))}
                inputMode="decimal"
                style={{ width: '100%', padding: 8, borderRadius: 8 }}
              />
            </div>

            <div>
              <label>Max takeoff (lb)</label>
              <input
                value={draft.limits.maxTakeoffLb ?? ''}
                onChange={(e) => updateLimits('maxTakeoffLb', toNumber(e.target.value))}
                inputMode="decimal"
                style={{ width: '100%', padding: 8, borderRadius: 8 }}
              />
            </div>

            <div>
              <label>Max landing (lb)</label>
              <input
                value={draft.limits.maxLandingLb ?? ''}
                onChange={(e) => updateLimits('maxLandingLb', toNumber(e.target.value))}
                inputMode="decimal"
                style={{ width: '100%', padding: 8, borderRadius: 8 }}
              />
            </div>

            <div>
              <label>Usable fuel (gal)</label>
              <input
                value={String(draft.fuel.usableGal)}
                onChange={(e) => updateFuel('usableGal', toNumber(e.target.value) ?? 0)}
                inputMode="decimal"
                style={{ width: '100%', padding: 8, borderRadius: 8 }}
              />
            </div>

            <div>
              <label>Fuel density (lb/gal)</label>
              <input
                value={String(draft.fuel.densityLbPerGal)}
                onChange={(e) =>
                  updateFuel('densityLbPerGal', toNumber(e.target.value) ?? 6.0)
                }
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
                />
                <input
                  value={String(s.armIn)}
                  onChange={(e) =>
                    updateStation(s.id, { armIn: toNumber(e.target.value) ?? 0 })
                  }
                  inputMode="decimal"
                  placeholder="Arm (in)"
                  style={{ padding: 8, borderRadius: 8 }}
                />
                <input
                  value={s.maxWeightLb ?? ''}
                  onChange={(e) =>
                    updateStation(s.id, { maxWeightLb: toNumber(e.target.value) })
                  }
                  inputMode="decimal"
                  placeholder="Max lb"
                  style={{ padding: 8, borderRadius: 8 }}
                />
                <button onClick={() => removeStation(s.id)} title="Remove station">
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




        </div>
      </div>
    </div>
  );
}
