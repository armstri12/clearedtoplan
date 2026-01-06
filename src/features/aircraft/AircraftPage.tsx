import { useEffect, useMemo, useRef, useState } from 'react';
import { makeId } from './id';
import type { AircraftProfile, Station } from './types';
import { assistEnvelope } from '../../lib/math/envelope';
import { toNumber as toNum, validateWeight } from '../../lib/utils';
import { useFlightSession } from '../../context/FlightSessionContext';
import { useAircraft } from '../../context/AircraftContext';
import { AIRCRAFT_TEMPLATES } from './templates';


function nowIso() {
  return new Date().toISOString();
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
  const { updateAircraft, completeStep } = useFlightSession();
  const { profiles, createProfile, updateProfile, deleteProfile: deleteProfileFromDb } = useAircraft();
  const [selectedId, setSelectedId] = useState<string>('');
  const [draft, setDraft] = useState<AircraftProfile>(() => blankProfile());
  const [status, setStatus] = useState<string>('');
  const [envelopeCategory, setEnvelopeCategory] = useState<'normal' | 'utility'>('normal');
  const [showTemplateSelector, setShowTemplateSelector] = useState(false);

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
    if (profiles.length > 0 && !selectedId) {
      setSelectedId(profiles[0].id);
      setDraft(profiles[0]);
    }
  }, [profiles]);

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

  function loadTemplate(templateId: string) {
    const template = AIRCRAFT_TEMPLATES.find((t) => t.id === templateId);
    if (!template) return;

    const profile = template.createProfile();
    setDraft(profile);
    setSelectedId('');
    setShowTemplateSelector(false);
    setStatus(`Loaded ${template.name} template. Customize and save.`);
  }


  async function saveCurrent() {
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
    const result = exists
      ? await updateProfile(normalized.id, normalized)
      : await createProfile(normalized);

    if (!result.success) {
      setStatus(`Error saving: ${result.error}`);
      return;
    }

    setSelectedId(normalized.id);
    setDraft(normalized);
    setStatus('Saved.');

    // Sync flight session and mark the step complete so the header nav can progress the workflow
    updateAircraft({
      profileId: normalized.id,
      ident: normalized.tailNumber,
      type: normalized.makeModel,
      emptyWeight: normalized.emptyWeight.weightLb,
      emptyMoment: normalized.emptyWeight.momentLbIn,
      maxRampWeight: normalized.limits.maxRampLb,
      maxTakeoffWeight: normalized.limits.maxTakeoffLb,
      maxLandingWeight: normalized.limits.maxLandingLb,
      fuelCapacityUsable: normalized.fuel.usableGal,
      fuelDensity: normalized.fuel.densityLbPerGal,
      performance: {
        cruisePerformance: normalized.performance?.cruisePerformance || [],
        takeoffGroundRoll: normalized.performance?.takeoffGroundRoll || 0,
        takeoffOver50ft: normalized.performance?.takeoffOver50ft || 0,
        landingGroundRoll: normalized.performance?.landingGroundRoll || 0,
        landingOver50ft: normalized.performance?.landingOver50ft || 0,
      },
    });
    completeStep('aircraft');
  }

  async function deleteSelected() {
    if (!selectedId) return;

    const result = await deleteProfileFromDb(selectedId);

    if (!result.success) {
      setStatus(`Error deleting: ${result.error}`);
      return;
    }

    const remaining = profiles.filter((p) => p.id !== selectedId);
    setSelectedId(remaining[0]?.id ?? '');
    setDraft(remaining[0] ?? blankProfile());
    setStatus('Deleted.');
  }

  return (
    <div style={{ background: '#f8fafc', minHeight: '100vh', padding: '32px 24px' }}>
      <div style={{ maxWidth: 1600, margin: '0 auto' }}>
        {/* Page Header */}
        <div style={{ marginBottom: 32 }}>
          <div style={{
            display: 'inline-block',
            background: 'linear-gradient(135deg, #dbeafe 0%, #bfdbfe 100%)',
            padding: '6px 14px',
            borderRadius: 999,
            marginBottom: 12,
            fontSize: 12,
            fontWeight: 700,
            color: '#1e40af',
          }}>
            ✈️ Aircraft Configuration
          </div>
          <h2 style={{ fontSize: 36, fontWeight: 900, color: '#1e293b', marginBottom: 8 }}>Aircraft Profiles</h2>
          <p style={{ fontSize: 16, color: '#64748b', maxWidth: 700 }}>
            Create a profile per tail number. Use your POH/AFM and W&amp;B paperwork for exact arms and limits.
          </p>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: 24 }}>
          {/* Sidebar */}
          <div style={{
            background: '#fff',
            border: '2px solid #e2e8f0',
            borderRadius: 16,
            padding: 24,
            height: 'fit-content',
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}>
            <h3 style={{ fontSize: 16, fontWeight: 800, marginBottom: 16, color: '#1e293b' }}>Profile Management</h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
              <button
                onClick={newProfile}
                style={{
                  padding: '12px 16px',
                  background: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#1e40af'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#2563eb'}
              >
                + New Profile
              </button>
              <button
                onClick={() => setShowTemplateSelector(true)}
                style={{
                  padding: '12px 16px',
                  background: '#fff',
                  color: '#2563eb',
                  border: '2px solid #2563eb',
                  borderRadius: 10,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.background = '#eff6ff';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.background = '#fff';
                }}
              >
                📋 Load Template
              </button>
            </div>

            {status && (
              <div style={{
                marginBottom: 16,
                padding: 12,
                background: status.includes('Error') || status.includes('needs') ? '#fef2f2' : '#f0fdf4',
                border: `1px solid ${status.includes('Error') || status.includes('needs') ? '#fecaca' : '#bbf7d0'}`,
                borderRadius: 8,
                fontSize: 13,
                color: status.includes('Error') || status.includes('needs') ? '#991b1b' : '#166534',
                fontWeight: 600,
              }}>
                {status}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: '#64748b' }}>Saved Profiles</label>
              <select
                value={selectedId}
                onChange={(e) => setSelectedId(e.target.value)}
                style={{
                  padding: '12px 14px',
                  borderRadius: 10,
                  border: '2px solid #e2e8f0',
                  fontSize: 14,
                  background: '#fff',
                  cursor: 'pointer',
                }}
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
              <div style={{
                marginTop: 16,
                padding: 12,
                background: '#f8fafc',
                borderRadius: 8,
                fontSize: 12,
                color: '#64748b',
              }}>
                <div style={{ fontWeight: 600, marginBottom: 4 }}>Last updated</div>
                {new Date(selected.updatedAt).toLocaleString()}
              </div>
            )}

            <div style={{ display: 'flex', gap: 8, marginTop: 20 }}>
              <button
                onClick={saveCurrent}
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  background: '#10b981',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#059669'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#10b981'}
              >
                💾 Save
              </button>
              <button
                onClick={deleteSelected}
                disabled={!selectedId}
                aria-label="Delete selected profile"
                style={{
                  flex: 1,
                  padding: '10px 14px',
                  background: selectedId ? '#ef4444' : '#e2e8f0',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: selectedId ? 'pointer' : 'not-allowed',
                  opacity: selectedId ? 1 : 0.5,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (selectedId) e.currentTarget.style.background = '#dc2626';
                }}
                onMouseLeave={(e) => {
                  if (selectedId) e.currentTarget.style.background = '#ef4444';
                }}
              >
                🗑️ Delete
              </button>
            </div>
          </div>

          {/* Main Content Area */}
          <div style={{
            background: '#fff',
            border: '2px solid #e2e8f0',
            borderRadius: 16,
            padding: 32,
            boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
          }}>
            <h3 style={{ fontSize: 20, fontWeight: 900, marginBottom: 20, color: '#1e293b' }}>Basic Information</h3>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20, marginBottom: 24 }}>
              <div>
                <label style={{
                  display: 'block',
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#64748b',
                  marginBottom: 8
                }}>Tail number</label>
                <input
                  value={draft.tailNumber}
                  onChange={(e) => updateDraft({ tailNumber: e.target.value.toUpperCase() })}
                  placeholder="N123AB"
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: 10,
                    border: '2px solid #e2e8f0',
                    fontSize: 15,
                    fontWeight: 600,
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{
                  display: 'block',
                  fontSize: 13,
                  fontWeight: 700,
                  color: '#64748b',
                  marginBottom: 8
                }}>Make / Model</label>
                <input
                  value={draft.makeModel}
                  onChange={(e) => updateDraft({ makeModel: e.target.value })}
                  placeholder="C172S"
                  style={{
                    width: '100%',
                    padding: '12px 14px',
                    borderRadius: 10,
                    border: '2px solid #e2e8f0',
                    fontSize: 15,
                    boxSizing: 'border-box',
                  }}
                />
              </div>

              <div>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#64748b', marginBottom: 8 }}>
                  Empty weight (lb)
                </label>
                <input
                  id="empty-weight"
                  value={String(draft.emptyWeight.weightLb)}
                  onChange={(e) => updateEmptyWeight('weightLb', toNum(e.target.value) ?? 0)}
                  inputMode="decimal"
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '2px solid #e2e8f0', fontSize: 15, boxSizing: 'border-box' }}
                  aria-label="Empty weight in pounds"
                />
              </div>

              <div>
                <label htmlFor="empty-moment" style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#64748b', marginBottom: 8 }}>
                  Empty moment (lb-in)
                </label>
                <input
                  id="empty-moment"
                  value={String(draft.emptyWeight.momentLbIn)}
                  onChange={(e) => updateEmptyWeight('momentLbIn', toNum(e.target.value) ?? 0)}
                  inputMode="decimal"
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '2px solid #e2e8f0', fontSize: 15, boxSizing: 'border-box' }}
                  aria-label="Empty moment in pound-inches"
                />
              </div>

              <div>
                <label htmlFor="max-ramp" style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#64748b', marginBottom: 8 }}>
                  Max ramp (lb)
                </label>
                <input
                  id="max-ramp"
                  value={draft.limits.maxRampLb ?? ''}
                  onChange={(e) => updateLimits('maxRampLb', toNum(e.target.value))}
                  inputMode="decimal"
                  placeholder="Optional"
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '2px solid #e2e8f0', fontSize: 15, boxSizing: 'border-box' }}
                  aria-label="Maximum ramp weight in pounds"
                />
              </div>

              <div>
                <label htmlFor="max-takeoff" style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#64748b', marginBottom: 8 }}>
                  Max takeoff (lb)
                </label>
                <input
                  id="max-takeoff"
                  value={draft.limits.maxTakeoffLb ?? ''}
                  onChange={(e) => updateLimits('maxTakeoffLb', toNum(e.target.value))}
                  inputMode="decimal"
                  placeholder="Optional"
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '2px solid #e2e8f0', fontSize: 15, boxSizing: 'border-box' }}
                  aria-label="Maximum takeoff weight in pounds"
                />
              </div>

              <div>
                <label htmlFor="max-landing" style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#64748b', marginBottom: 8 }}>
                  Max landing (lb)
                </label>
                <input
                  id="max-landing"
                  value={draft.limits.maxLandingLb ?? ''}
                  onChange={(e) => updateLimits('maxLandingLb', toNum(e.target.value))}
                  inputMode="decimal"
                  placeholder="Optional"
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '2px solid #e2e8f0', fontSize: 15, boxSizing: 'border-box' }}
                  aria-label="Maximum landing weight in pounds"
                />
              </div>

              <div>
                <label htmlFor="usable-fuel" style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#64748b', marginBottom: 8 }}>
                  Usable fuel (gal)
                </label>
                <input
                  id="usable-fuel"
                  value={String(draft.fuel.usableGal)}
                  onChange={(e) => updateFuel('usableGal', toNum(e.target.value) ?? 0)}
                  inputMode="decimal"
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '2px solid #e2e8f0', fontSize: 15, boxSizing: 'border-box' }}
                  aria-label="Usable fuel in gallons"
                />
              </div>

              <div>
                <label htmlFor="fuel-density" style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#64748b', marginBottom: 8 }}>
                  Fuel density (lb/gal)
                </label>
                <input
                  id="fuel-density"
                  value={String(draft.fuel.densityLbPerGal)}
                  onChange={(e) => updateFuel('densityLbPerGal', toNum(e.target.value) ?? 6.0)}
                  aria-label="Fuel density in pounds per gallon"
                  inputMode="decimal"
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '2px solid #e2e8f0', fontSize: 15, boxSizing: 'border-box' }}
                />
              </div>

              <div style={{ gridColumn: '1 / -1' }}>
                <label style={{ display: 'block', fontSize: 13, fontWeight: 700, color: '#64748b', marginBottom: 8 }}>
                  Notes
                </label>
                <textarea
                  value={draft.notes ?? ''}
                  onChange={(e) => updateDraft({ notes: e.target.value })}
                  rows={3}
                  placeholder="Datum per POH/AFM. Verify station arms and limits from your aircraft documents."
                  style={{ width: '100%', padding: '12px 14px', borderRadius: 10, border: '2px solid #e2e8f0', fontSize: 14, boxSizing: 'border-box', fontFamily: 'inherit', lineHeight: 1.5 }}
                />
              </div>
            </div>

            <hr style={{ margin: '32px 0', border: 'none', borderTop: '2px solid #e2e8f0' }} />

            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <h3 style={{ fontSize: 20, fontWeight: 900, color: '#1e293b', margin: 0 }}>Stations</h3>
              <button
                onClick={addStation}
                style={{
                  padding: '10px 16px',
                  background: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#1e40af'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#2563eb'}
              >
                + Add station
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Header row */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1.6fr 0.8fr 0.8fr auto',
                gap: 12,
                fontSize: 12,
                fontWeight: 700,
                color: '#64748b',
                paddingBottom: 8,
              }}>
                <div>Station Name</div>
                <div>Arm (in)</div>
                <div>Max lb</div>
                <div></div>
              </div>

              {draft.stations.map((s) => (
                <div
                  key={s.id}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1.6fr 0.8fr 0.8fr auto',
                    gap: 12,
                    alignItems: 'center',
                  }}
                >
                  <input
                    value={s.name}
                    onChange={(e) => updateStation(s.id, { name: e.target.value })}
                    style={{ padding: '10px 12px', borderRadius: 8, border: '2px solid #e2e8f0', fontSize: 14, boxSizing: 'border-box' }}
                    aria-label={`Station name: ${s.name}`}
                  />
                  <input
                    value={String(s.armIn)}
                    onChange={(e) => updateStation(s.id, { armIn: toNum(e.target.value) ?? 0 })}
                    inputMode="decimal"
                    placeholder="37"
                    style={{ padding: '10px 12px', borderRadius: 8, border: '2px solid #e2e8f0', fontSize: 14, boxSizing: 'border-box' }}
                    aria-label={`Arm for ${s.name} in inches`}
                  />
                  <input
                    value={s.maxWeightLb ?? ''}
                    onChange={(e) => updateStation(s.id, { maxWeightLb: toNum(e.target.value) })}
                    inputMode="decimal"
                    placeholder="Optional"
                    style={{ padding: '10px 12px', borderRadius: 8, border: '2px solid #e2e8f0', fontSize: 14, boxSizing: 'border-box' }}
                    aria-label={`Maximum weight for ${s.name} in pounds`}
                  />
                  <button
                    onClick={() => removeStation(s.id)}
                    title="Remove station"
                    aria-label={`Remove station ${s.name}`}
                    style={{
                      padding: '10px 12px',
                      background: '#fee2e2',
                      color: '#dc2626',
                      border: 'none',
                      borderRadius: 8,
                      fontSize: 16,
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#fecaca'}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#fee2e2'}
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>


            <hr style={{ margin: '32px 0', border: 'none', borderTop: '2px solid #e2e8f0' }} />

            <h3 style={{ fontSize: 20, fontWeight: 900, color: '#1e293b', marginBottom: 12 }}>CG Envelope (optional)</h3>

            <p style={{ fontSize: 14, color: '#64748b', marginBottom: 16, lineHeight: 1.6 }}>
              Enter points from the POH/AFM envelope chart. CG is <b>inches aft of datum</b>. Use <b>Sort</b> to
              order points around the perimeter.
            </p>

            <div style={{ marginBottom: 16, display: 'flex', gap: 12, alignItems: 'center', background: '#f8fafc', padding: 16, borderRadius: 10 }}>
              <label style={{ fontSize: 13, fontWeight: 700, color: '#64748b' }}>Envelope category:</label>
              <select
                value={envelopeCategory}
                onChange={(e) => setEnvelopeCategory(e.target.value as 'normal' | 'utility')}
                style={{
                  padding: '10px 14px',
                  borderRadius: 8,
                  border: '2px solid #e2e8f0',
                  fontSize: 14,
                  fontWeight: 600,
                  background: '#fff',
                  cursor: 'pointer',
                }}
              >
                <option value="normal">Normal Category</option>
                <option value="utility">Utility Category</option>
              </select>
            </div>

            {/* Controls */}
            <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 16 }}>
              <button
                onClick={addEnvelopePoint}
                style={{
                  padding: '10px 16px',
                  background: '#2563eb',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: 'pointer',
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = '#1e40af'}
                onMouseLeave={(e) => e.currentTarget.style.background = '#2563eb'}
              >
                + Add point
              </button>
              <button
                onClick={sortEnvelope}
                disabled={getCategoryPoints().length < 3}
                style={{
                  padding: '10px 16px',
                  background: getCategoryPoints().length < 3 ? '#e2e8f0' : '#10b981',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: getCategoryPoints().length < 3 ? 'not-allowed' : 'pointer',
                  opacity: getCategoryPoints().length < 3 ? 0.5 : 1,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (getCategoryPoints().length >= 3) e.currentTarget.style.background = '#059669';
                }}
                onMouseLeave={(e) => {
                  if (getCategoryPoints().length >= 3) e.currentTarget.style.background = '#10b981';
                }}
              >
                📐 Sort points
              </button>
              <button
                onClick={clearEnvelope}
                disabled={getCategoryPoints().length === 0}
                style={{
                  padding: '10px 16px',
                  background: getCategoryPoints().length === 0 ? '#e2e8f0' : '#ef4444',
                  color: '#fff',
                  border: 'none',
                  borderRadius: 8,
                  fontSize: 13,
                  fontWeight: 700,
                  cursor: getCategoryPoints().length === 0 ? 'not-allowed' : 'pointer',
                  opacity: getCategoryPoints().length === 0 ? 0.5 : 1,
                  transition: 'all 0.2s',
                }}
                onMouseEnter={(e) => {
                  if (getCategoryPoints().length > 0) e.currentTarget.style.background = '#dc2626';
                }}
                onMouseLeave={(e) => {
                  if (getCategoryPoints().length > 0) e.currentTarget.style.background = '#ef4444';
                }}
              >
                🗑️ Clear envelope
              </button>
            </div>

            {/* Validation */}
            {(() => {
              const pts = getCategoryPoints();
              const report = assistEnvelope(pts).validation;
              const n = pts.length;

              if (n === 0) {
                return (
                  <div style={{
                    padding: 14,
                    background: '#f8fafc',
                    border: '2px dashed #cbd5e1',
                    borderRadius: 10,
                    fontSize: 13,
                    color: '#64748b',
                    textAlign: 'center',
                  }}>
                    No envelope points yet for <b>{envelopeCategory}</b>. Click <b>Add point</b> to start.
                  </div>
                );
              }

              if (n < 3) {
                return (
                  <div style={{
                    padding: 14,
                    background: '#fef3c7',
                    border: '2px solid #fbbf24',
                    borderRadius: 10,
                    fontSize: 13,
                    color: '#92400e',
                    fontWeight: 700,
                  }}>
                    ⚠️ Envelope inactive — add at least 3 points
                  </div>
                );
              }

              return report.ok ? (
                <div style={{
                  padding: 14,
                  background: '#d1fae5',
                  border: '2px solid #10b981',
                  borderRadius: 10,
                  fontSize: 13,
                  color: '#065f46',
                  fontWeight: 700,
                }}>
                  ✅ Envelope valid ({envelopeCategory})
                </div>
              ) : (
                <div style={{
                  padding: 14,
                  background: '#fee2e2',
                  border: '2px solid #ef4444',
                  borderRadius: 10,
                  fontSize: 13,
                  color: '#991b1b',
                }}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>⛔ Envelope needs fixes ({envelopeCategory})</div>
                  <ul style={{ margin: 0, paddingLeft: 20 }}>
                    {report.messages.map((m, idx) => (
                      <li key={idx}>{m}</li>
                    ))}
                  </ul>
                </div>
              );
            })()}

            {/* Header row */}
            {getCategoryPoints().length > 0 && (
              <div style={{
                display: 'grid',
                gridTemplateColumns: '1fr 1fr auto',
                gap: 12,
                fontSize: 12,
                fontWeight: 700,
                color: '#64748b',
                marginTop: 20,
                marginBottom: 12,
              }}>
                <div>Weight (lb)</div>
                <div>CG (in aft of datum)</div>
                <div></div>
              </div>
            )}

            {/* Points */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {getCategoryPoints().map((p, idx) => (
                <div
                  key={idx}
                  style={{
                    display: 'grid',
                    gridTemplateColumns: '1fr 1fr auto',
                    gap: 12,
                    alignItems: 'center',
                  }}
                >
                  <input
                    type="number"
                    step="1"
                    value={p.weightLb}
                    onChange={(e) => updateEnvelopePoint(idx, { weightLb: Number(e.target.value) || 0 })}
                    placeholder="e.g. 2550"
                    style={{ padding: '10px 12px', borderRadius: 8, border: '2px solid #e2e8f0', fontSize: 14, boxSizing: 'border-box' }}
                  />
                  <input
                    type="number"
                    step="0.01"
                    value={p.cgIn}
                    onChange={(e) => updateEnvelopePoint(idx, { cgIn: Number(e.target.value) || 0 })}
                    placeholder="e.g. 41.25"
                    style={{ padding: '10px 12px', borderRadius: 8, border: '2px solid #e2e8f0', fontSize: 14, boxSizing: 'border-box' }}
                  />
                  <button
                    onClick={() => removeEnvelopePoint(idx)}
                    title="Remove point"
                    style={{
                      padding: '10px 12px',
                      background: '#fee2e2',
                      color: '#dc2626',
                      border: 'none',
                      borderRadius: 8,
                      fontSize: 16,
                      fontWeight: 700,
                      cursor: 'pointer',
                      transition: 'all 0.2s',
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = '#fecaca'}
                    onMouseLeave={(e) => e.currentTarget.style.background = '#fee2e2'}
                  >
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

              const W = 300;
              const H = 180;
              const pad = 15;

              const sx = (x: number) => pad + ((x - minX) / (maxX - minX || 1)) * (W - pad * 2);
              const sy = (y: number) => pad + (1 - (y - minY) / (maxY - minY || 1)) * (H - pad * 2);

              const polyPts = sorted.map((p) => `${sx(p.cgIn)},${sy(p.weightLb)}`).join(' ');

              return (
                <div style={{
                  marginTop: 24,
                  background: '#f8fafc',
                  border: '2px solid #e2e8f0',
                  borderRadius: 12,
                  padding: 20,
                }}>
                  <div style={{ fontSize: 14, fontWeight: 900, marginBottom: 12, color: '#1e293b' }}>
                    Envelope Preview ({envelopeCategory}) {validation.ok ? '✅' : '⛔'}
                  </div>
                  <div style={{ background: '#fff', padding: 16, borderRadius: 10, marginBottom: 12 }}>
                    <svg width={W} height={H}>
                      <polygon
                        points={polyPts}
                        fill="rgba(37, 99, 235, 0.1)"
                        stroke="#2563eb"
                        strokeWidth={3}
                        strokeLinejoin="round"
                      />
                      {sorted.map((p, i) => (
                        <circle
                          key={i}
                          cx={sx(p.cgIn)}
                          cy={sy(p.weightLb)}
                          r={5}
                          fill="#2563eb"
                        />
                      ))}
                    </svg>
                  </div>
                  <div style={{ fontSize: 12, color: '#64748b', lineHeight: 1.5 }}>
                    This is a shape preview only (not to scale). Use W&amp;B page for the plotted ramp/TO/LDG points.
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      </div>

      {/* Template Selector Modal */}
      {showTemplateSelector && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            background: 'rgba(0, 0, 0, 0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
          }}
          onClick={() => setShowTemplateSelector(false)}
        >
          <div
            style={{
              background: '#fff',
              borderRadius: 16,
              padding: 32,
              maxWidth: 800,
              width: '90%',
              maxHeight: '80vh',
              overflow: 'auto',
              boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <h2 style={{ margin: 0, fontSize: 24, fontWeight: 900 }}>Load Aircraft Template</h2>
              <button
                onClick={() => setShowTemplateSelector(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: 24,
                  cursor: 'pointer',
                  padding: 8,
                  opacity: 0.6,
                }}
                aria-label="Close template selector"
              >
                ✕
              </button>
            </div>

            <p style={{ marginBottom: 24, opacity: 0.8, fontSize: 14 }}>
              Select a pre-configured aircraft profile based on standard POH values. You can customize and save it for your specific aircraft.
            </p>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))', gap: 16 }}>
              {AIRCRAFT_TEMPLATES.map((template) => (
                <div
                  key={template.id}
                  style={{
                    border: '2px solid #e2e8f0',
                    borderRadius: 12,
                    padding: 20,
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    background: '#fff',
                  }}
                  onClick={() => loadTemplate(template.id)}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.borderColor = '#2563eb';
                    e.currentTarget.style.boxShadow = '0 4px 12px rgba(37, 99, 235, 0.15)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.borderColor = '#e2e8f0';
                    e.currentTarget.style.boxShadow = 'none';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  <div style={{ fontSize: 32, marginBottom: 12, textAlign: 'center' }}>✈️</div>
                  <h3 style={{ margin: '0 0 8px 0', fontSize: 18, fontWeight: 900, textAlign: 'center' }}>
                    {template.name}
                  </h3>
                  <div style={{ fontSize: 12, opacity: 0.7, marginBottom: 12, textAlign: 'center' }}>
                    {template.manufacturer} {template.model}
                  </div>
                  <p style={{ margin: 0, fontSize: 13, opacity: 0.8, lineHeight: 1.5 }}>
                    {template.description}
                  </p>
                  <div
                    style={{
                      marginTop: 16,
                      padding: '8px 12px',
                      background: '#f0f9ff',
                      borderRadius: 8,
                      fontSize: 12,
                      fontWeight: 700,
                      color: '#2563eb',
                      textAlign: 'center',
                    }}
                  >
                    Click to Load
                  </div>
                </div>
              ))}
            </div>

            {AIRCRAFT_TEMPLATES.length === 0 && (
              <div style={{ textAlign: 'center', padding: 40, opacity: 0.6 }}>
                No templates available yet. Check back soon!
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
