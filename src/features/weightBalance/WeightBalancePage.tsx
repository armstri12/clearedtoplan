import React, { useEffect, useMemo, useState } from 'react';
import { localDb, type WBScenario } from '../../lib/storage/localDb';
import type { AircraftProfile, Station } from '../aircraft/types';
import { assistEnvelope, diagnoseEnvelope } from '../../lib/math/envelope';
import { round, clamp, validatePassengerWeight, checkFuelReserve } from '../../lib/utils';
import { useFlightSession } from '../../context/FlightSessionContext';

function makeId(prefix = 'scenario') {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}


type LoadItem = {
  label: string;
  weightLb: number;
  armIn: number;
  station?: Station; // if known, enables station max warnings
};

function loadProfiles(): AircraftProfile[] {
  const raw = localDb.getAircraftProfiles();
  if (!Array.isArray(raw)) return [];
  return raw as AircraftProfile[];
}

function compute(items: LoadItem[]) {
  const totalWeight = items.reduce((sum, i) => sum + i.weightLb, 0);
  const totalMoment = items.reduce((sum, i) => sum + i.weightLb * i.armIn, 0);
  const cgIn = totalWeight > 0 ? totalMoment / totalWeight : 0;
  return { totalWeight, totalMoment, cgIn };
}

function findStation(profile: AircraftProfile, nameIncludes: string): Station | undefined {
  const key = nameIncludes.toLowerCase();
  return profile.stations.find((s) => s.name.toLowerCase().includes(key));
}

type Phase = 'Ramp' | 'Takeoff' | 'Landing';

function ResultCard(props: {
  title: Phase;
  totalWeight: number;
  totalMoment: number;
  cgIn: number;
  weightLimit?: number;
  envelopeDiag?: 'inside' | 'forward' | 'aft' | 'overweight' | 'outside' | null;
  phase: 'ramp' | 'takeoff' | 'landing';
}) {

  const { title, totalWeight, totalMoment, cgIn, weightLimit, envelopeDiag, phase } = props;
  const withinWeight = weightLimit ? totalWeight <= weightLimit : true;

  const envelopeText =
  envelopeDiag == null
    ? 'Envelope: not defined'
    : envelopeDiag === 'inside'
      ? 'Envelope: ✅ inside'
      : envelopeDiag === 'forward'
        ? 'Envelope: ⛔ forward of envelope'
        : envelopeDiag === 'aft'
          ? 'Envelope: ⛔ aft of envelope'
          : envelopeDiag === 'overweight'
            ? 'Envelope: ⛔ overweight for envelope'
            : 'Envelope: ⛔ outside envelope';


            const bg =
            phase === 'ramp'
              ? 'rgba(17,24,39,0.06)'     // neutral gray
              : phase === 'takeoff'
              ? 'rgba(37,99,235,0.07)'    // blue
              : 'rgba(22,163,74,0.07)';   // green
          

              return (
                <div
                  style={{
                    border: '1px solid #ddd',
                    borderRadius: 12,
                    background: bg,
                    overflow: 'hidden',
                  }}
                >
                  {/* Top accent */}
                  <div
                    style={{
                      height: 6,
                      background:
                        phase === 'ramp'
                          ? '#111827'
                          : phase === 'takeoff'
                          ? '#2563eb'
                          : '#16a34a',
                    }}
                  />
              
                  {/* Inner padding wrapper */}
                  <div style={{ padding: 12 }}>
                    <div style={{ fontSize: 14, fontWeight: 900 }}>{title}</div>
              
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 10 }}>
                      <div>Total weight</div>
                      <div style={{ fontWeight: 700 }}>{round(totalWeight, 1)} lb</div>
                    </div>
              
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                      <div>Total moment</div>
                      <div style={{ fontWeight: 700 }}>{round(totalMoment, 1)} lb-in</div>
                    </div>
              
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 6 }}>
                      <div>CG</div>
                      <div style={{ fontWeight: 700 }}>{round(cgIn, 2)} in</div>
                    </div>
              
                    <hr style={{ margin: '12px 0' }} />
              
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <div>Weight limit</div>
                      <div style={{ fontWeight: 700 }}>{weightLimit ? `${weightLimit} lb` : '—'}</div>
                    </div>
              
                    <div style={{ marginTop: 8, fontWeight: 900 }}>
                      {withinWeight ? '✅ Within weight limit' : '⛔ Exceeds weight limit'}
                    </div>
              
                    {envelopeDiag != null && (
                      <div style={{ marginTop: 8, fontWeight: 800 }}>{envelopeText}</div>
                    )}
              
                    <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
                      Envelope check only appears when you enter a tail-specific polygon in the Aircraft profile.
                    </div>
                  </div>
                </div>
              );
            }              

function PhaseTabs(props: { value: Phase; onChange: (p: Phase) => void }) {
  const { value, onChange } = props;

  const tabStyle = (active: boolean): React.CSSProperties => ({
    padding: '8px 12px',
    borderRadius: 10,
    border: '1px solid #ddd',
    background: active ? '#f0f0f0' : '#fff',
    fontWeight: active ? 800 : 600,
    cursor: 'pointer',
  });

  return (
    <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
      {(['Ramp', 'Takeoff', 'Landing'] as Phase[]).map((p) => (
        <button key={p} onClick={() => onChange(p)} style={tabStyle(value === p)}>
          {p}
        </button>
      ))}
    </div>
  );
}

function CgDiagram(props: {
  normalPoints: { weightLb: number; cgIn: number }[];
  utilityPoints: { weightLb: number; cgIn: number }[];
  activeCategory: 'normal' | 'utility';
  ramp: { cgIn: number; totalWeight: number };
  takeoff: { cgIn: number; totalWeight: number };
  landing: { cgIn: number; totalWeight: number };
}) {
  const { normalPoints, utilityPoints, activeCategory, ramp, takeoff, landing } = props;


  const normal = assistEnvelope(normalPoints);
  const utility = assistEnvelope(utilityPoints);
  
  const normalOk = normal.sorted.length >= 3 && normal.validation.ok;
  const utilityOk = utility.sorted.length >= 3 && utility.validation.ok;
  

  
  if (!normalOk && !utilityOk) {
    return (
      <div style={{ border: '1px dashed #ccc', borderRadius: 12, padding: 12, opacity: 0.85 }}>
        <b>CG Envelope Diagram</b>
        <div style={{ marginTop: 6 }}>
          No envelope defined yet for this tail number. Add a polygon in <b>Aircraft</b> to enable
          envelope plotting.
        </div>
      </div>
    );
  }
  

  // Convert envelope points to plot coordinates
  const normalPoly = normal.sorted.map((p) => ({ x: p.cgIn, y: p.weightLb }));
  const utilityPoly = utility.sorted.map((p) => ({ x: p.cgIn, y: p.weightLb }));
  

  // Determine bounds including the three computed points
  const pts = [
    ...(normalOk ? normalPoly : []),
    ...(utilityOk ? utilityPoly : []),
    { x: ramp.cgIn, y: ramp.totalWeight },
    { x: takeoff.cgIn, y: takeoff.totalWeight },
    { x: landing.cgIn, y: landing.totalWeight },
  ];
  

  const minX = Math.min(...pts.map((p) => p.x));
  const maxX = Math.max(...pts.map((p) => p.x));
  const minY = Math.min(...pts.map((p) => p.y));
  const maxY = Math.max(...pts.map((p) => p.y));

  // Padding so points aren't on the edge
  const padX = (maxX - minX) * 0.12 || 1;
  const padY = (maxY - minY) * 0.12 || 50;

  const x0 = minX - padX;
  const x1 = maxX + padX;
  const y0 = minY - padY;
  const y1 = maxY + padY;

  // SVG setup
  const W = 520;
  const H = 360;
  const margin = { left: 50, right: 16, top: 16, bottom: 44 };

  const legendX = margin.left + 12;
  const legendY = margin.top + 12;

  const xTicks = 6; // vertical gridlines
  const yTicks = 6; // horizontal gridlines

  const sx = (x: number) => margin.left + ((x - x0) / (x1 - x0)) * (W - margin.left - margin.right);
  const sy = (y: number) =>
    margin.top + (1 - (y - y0) / (y1 - y0)) * (H - margin.top - margin.bottom);

  const normalPath = normalPoly.map((p) => `${sx(p.x)},${sy(p.y)}`).join(' ');
  const utilityPath = utilityPoly.map((p) => `${sx(p.x)},${sy(p.y)}`).join(' ');


  const plotPoint = (label: string, x: number, y: number, color = 'black') => (
    <g>
      <circle cx={sx(x)} cy={sy(y)} r={5} fill={color} />
      <text x={sx(x) + 8} y={sy(y) + 4} fontSize="12">
        {label}
      </text>
    </g>
  );
  

  return (
    <div style={{ border: '1px solid #ddd', borderRadius: 12, padding: 12 }}>
      <div style={{ fontWeight: 900, marginBottom: 8 }}>CG Envelope Diagram</div>

      <svg width={W} height={H} style={{ border: '1px solid #eee', borderRadius: 8 }}>
        {/* Axes */}
        <line x1={margin.left} y1={H - margin.bottom} x2={W - margin.right} y2={H - margin.bottom} />
        <line x1={margin.left} y1={margin.top} x2={margin.left} y2={H - margin.bottom} />

        {/* Axis labels */}
        <text x={(W - margin.left - margin.right) / 2 + margin.left} y={H - 12} fontSize="12">
          CG (in)
        </text>
        <text
          x={14}
          y={(H - margin.top - margin.bottom) / 2 + margin.top}
          fontSize="12"
          transform={`rotate(-90 14 ${(H - margin.top - margin.bottom) / 2 + margin.top})`}
        >
          Weight (lb)
        </text>

        {/* Gridlines + ticks */}
        {Array.from({ length: xTicks + 1 }).map((_, i) => {
          const t = i / xTicks;
          const xVal = x0 + t * (x1 - x0);
          const x = sx(xVal);

          return (
            <g key={`xgrid-${i}`}>
              {/* vertical grid line */}
              <line
                x1={x}
                y1={margin.top}
                x2={x}
                y2={H - margin.bottom}
                stroke="#e5e7eb"
                strokeWidth={1}
              />
              {/* tick label */}
              <text
                x={x}
                y={H - margin.bottom + 16}
                fontSize="11"
                textAnchor="middle"
                fill="#374151"
              >
                {round(xVal, 1)}
              </text>
            </g>
          );
        })}

{Array.from({ length: yTicks + 1 }).map((_, i) => {
  const t = i / yTicks;
  const yVal = y0 + t * (y1 - y0);
  const y = sy(yVal);

  return (
    <g key={`ygrid-${i}`}>
      <line
        x1={margin.left}
        y1={y}
        x2={W - margin.right}
        y2={y}
        stroke="#e5e7eb"
        strokeWidth={1}
      />
      <text
        x={margin.left - 8}
        y={y + 4}
        fontSize="11"
        textAnchor="end"
        fill="#374151"
      >
        {round(yVal, 0)}
      </text>
    </g>
  );
})}

{/* ✅ Legend (Normal vs Utility) */}
<g>
  {/* background */}
  <rect
    x={legendX - 8}
    y={legendY - 10}
    width={180}
    height={52}
    fill="white"
    stroke="#e5e7eb"
    rx={8}
  />

  {/* Normal */}
  <line
    x1={legendX}
    y1={legendY + 6}
    x2={legendX + 28}
    y2={legendY + 6}
    stroke="black"
    strokeWidth={activeCategory === 'normal' ? 3 : 2}
  />
  <text x={legendX + 36} y={legendY + 10} fontSize="12" fill="#111827">
    Normal{activeCategory === 'normal' ? ' (active)' : ''}
  </text>

  {/* Utility */}
  <line
    x1={legendX}
    y1={legendY + 26}
    x2={legendX + 28}
    y2={legendY + 26}
    stroke="blue"
    strokeWidth={activeCategory === 'utility' ? 3 : 2}
    strokeDasharray="6 4"
  />
  <text x={legendX + 36} y={legendY + 30} fontSize="12" fill="#111827">
    Utility{activeCategory === 'utility' ? ' (active)' : ''}
  </text>
</g>

{/* Envelope polygon */}

        {normalOk && (
  <polygon
    points={normalPath}
    fill="rgba(0,0,0,0.07)"
    stroke="black"
    strokeWidth={activeCategory === 'normal' ? 3 : 2}
  />
)}

{utilityOk && (
  <polygon
    points={utilityPath}
    fill="rgba(37,99,235,0.08)"
    stroke="blue"
    strokeWidth={activeCategory === 'utility' ? 3 : 2}
    strokeDasharray="6 4"
  />
)}


        {/* Ramp / Takeoff / Landing points */}
        {plotPoint('Ramp', ramp.cgIn, ramp.totalWeight, '#111827')}
        {plotPoint('TO', takeoff.cgIn, takeoff.totalWeight, '#2563eb')}
        {plotPoint('LDG', landing.cgIn, landing.totalWeight, '#16a34a')}

      </svg>

      <div style={{ marginTop: 8, fontSize: 12, opacity: 0.75 }}>
        Plot is for planning; enter envelope points exactly from POH/AFM for this tail number.
      </div>
    </div>
  );
}

export default function WeightBalancePage() {
  const { currentSession, updateWeightBalance, completeStep } = useFlightSession();
  const [profiles, setProfiles] = useState<AircraftProfile[]>([]);
  const [selectedId, setSelectedId] = useState<string>('');

  const [phase, setPhase] = useState<Phase>('Ramp');

  // Payload inputs
  const [frontLb, setFrontLb] = useState<number>(170);
  const [rearLb, setRearLb] = useState<number>(0);
  const [baggageByStation, setBaggageByStation] = useState<Record<string, number>>({});



// Fuel inputs (strings so the user can type decimals / clear the box)
const [startFuelGal, setStartFuelGal] = useState<string>('30');
const [taxiFuelGal, setTaxiFuelGal] = useState<string>('1');
const [plannedBurnGal, setPlannedBurnGal] = useState<string>('10');


  const [activeCategory, setActiveCategory] = useState<'normal' | 'utility'>('normal');

  // Night flight toggle for fuel reserve calculations
  const [isNightFlight, setIsNightFlight] = useState<boolean>(false);

  // Scenario management
  const [scenarios, setScenarios] = useState<WBScenario[]>([]);
  const [scenarioName, setScenarioName] = useState<string>('');
  const [showSaveDialog, setShowSaveDialog] = useState<boolean>(false);

  useEffect(() => {
    const p = loadProfiles();
    setProfiles(p);
    if (p.length > 0) setSelectedId(p[0].id);

    // Load scenarios
    const s = localDb.getWBScenarios();
    setScenarios(s);
  }, []);

  function saveScenario() {
    if (!scenarioName.trim()) {
      alert('Please enter a scenario name');
      return;
    }
    if (!selectedId) {
      alert('Please select an aircraft first');
      return;
    }

    const scenario: WBScenario = {
      id: makeId('scenario'),
      name: scenarioName.trim(),
      aircraftId: selectedId,
      frontLb,
      rearLb,
      baggageByStation,
      startFuelGal,
      taxiFuelGal,
      plannedBurnGal,
      createdAt: new Date().toISOString(),
    };

    const updated = [...scenarios, scenario];
    setScenarios(updated);
    localDb.setWBScenarios(updated);
    setScenarioName('');
    setShowSaveDialog(false);
  }

  function loadScenario(scenario: WBScenario) {
    // Only load if same aircraft
    if (scenario.aircraftId !== selectedId) {
      if (!confirm(`This scenario is for a different aircraft. Load anyway?`)) {
        return;
      }
      setSelectedId(scenario.aircraftId);
    }

    setFrontLb(scenario.frontLb);
    setRearLb(scenario.rearLb);
    setBaggageByStation(scenario.baggageByStation);
    setStartFuelGal(scenario.startFuelGal);
    setTaxiFuelGal(scenario.taxiFuelGal);
    setPlannedBurnGal(scenario.plannedBurnGal);
  }

  function deleteScenario(id: string) {
    if (!confirm('Delete this scenario?')) return;
    const updated = scenarios.filter((s) => s.id !== id);
    setScenarios(updated);
    localDb.setWBScenarios(updated);
  }

  const profile = useMemo(
    () => profiles.find((p) => p.id === selectedId),
    [profiles, selectedId],
  );

  const stFront = useMemo(() => (profile ? findStation(profile, 'front') : undefined), [profile]);
  const stRear = useMemo(() => (profile ? findStation(profile, 'rear') : undefined), [profile]);
  const stFuel = useMemo(() => (profile ? findStation(profile, 'fuel') : undefined), [profile]);

  const baggageStations = useMemo(() => {
    if (!profile) return [];
    return profile.stations.filter((s) => s.name.toLowerCase().includes('baggage'));
  }, [profile]);
  
  // Initialize baggage map when profile changes
  useEffect(() => {
    if (!profile) return;
    setBaggageByStation((prev) => {
      const next: Record<string, number> = { ...prev };
      for (const s of baggageStations) {
        if (next[s.id] == null) next[s.id] = 0;
      }
      // remove keys that no longer exist
      for (const key of Object.keys(next)) {
        if (!baggageStations.some((s) => s.id === key)) delete next[key];
      }
      return next;
    });
  }, [profile, baggageStations]);
  


  const calc = useMemo(() => {
    if (!profile) return null;

    const density = profile.fuel.densityLbPerGal || 6.0;

    const usable = profile.fuel.usableGal ?? 0;
  // ✅ Parse string inputs (allow '' -> 0)
  const startRaw = Number(startFuelGal || 0);
  const taxiRaw = Number(taxiFuelGal || 0);
  const burnRaw = Number(plannedBurnGal || 0);


  // ✅ Apply clamp/guards to the parsed numbers
  const start = usable > 0 ? clamp(startRaw, 0, usable) : Math.max(0, startRaw);
  const roundFuel = (v: number) => Math.round(v * 10) / 10;
  const taxi = roundFuel(Math.max(0, taxiRaw));
  const burn = Math.max(0, burnRaw);
  const takeoffGal = roundFuel(Math.max(0, start - taxi));
  const landingGal = roundFuel(Math.max(0, takeoffGal - burn));
  
  

    const emptyArm =
      profile.emptyWeight.weightLb > 0 ? profile.emptyWeight.momentLbIn / profile.emptyWeight.weightLb : 0;

      const baggageItems: LoadItem[] = baggageStations.map((s) => ({
        label: s.name,
        weightLb: baggageByStation[s.id] ?? 0,
        armIn: s.armIn,
        station: s,
      }));
      
      const commonItems: LoadItem[] = [
        { label: 'Empty weight', weightLb: profile.emptyWeight.weightLb, armIn: emptyArm },
        { label: 'Front seats', weightLb: frontLb, armIn: stFront?.armIn ?? 0, station: stFront },
        { label: 'Rear seats', weightLb: rearLb, armIn: stRear?.armIn ?? 0, station: stRear },
        ...baggageItems,
      ];

    const rampItems: LoadItem[] = [
      ...commonItems,
      {
        label: `Fuel (start: ${round(start, 1)} gal)`,
        weightLb: start * density,
        armIn: stFuel?.armIn ?? 0,
        station: stFuel,
      },
    ];

    const takeoffItems: LoadItem[] = [
      ...commonItems,
      {
        label: `Fuel (takeoff: ${round(takeoffGal, 1)} gal)`,
        weightLb: takeoffGal * density,
        armIn: stFuel?.armIn ?? 0,
        station: stFuel,
      },
    ];

    const landingItems: LoadItem[] = [
      ...commonItems,
      {
        label: `Fuel (landing: ${round(landingGal, 1)} gal)`,
        weightLb: landingGal * density,
        armIn: stFuel?.armIn ?? 0,
        station: stFuel,
      },
    ];

    const ramp = compute(rampItems);
    const takeoff = compute(takeoffItems);
    const landing = compute(landingItems);


    //Test
    // --- Envelopes (Normal + Utility) ---
    const rawNormal =
      profile.cgEnvelopes?.normal?.points ??
      profile.cgEnvelope?.points ?? // legacy fallback
      [];

    const rawUtility = profile.cgEnvelopes?.utility?.points ?? [];

    const normal = assistEnvelope(rawNormal);
    const utility = assistEnvelope(rawUtility);

    const normalOk = normal.sorted.length >= 3 && normal.validation.ok;
    const utilityOk = utility.sorted.length >= 3 && utility.validation.ok;

    const normalPoly = normal.sorted.map((p) => ({ x: p.cgIn, y: p.weightLb }));
    const utilityPoly = utility.sorted.map((p) => ({ x: p.cgIn, y: p.weightLb }));

    const diagFor = (
      ok: boolean,
      poly: { x: number; y: number }[],
      cgIn: number,
      weightLb: number,
    ) => (ok ? diagnoseEnvelope(cgIn, weightLb, poly) : null);

    const normalDiag = {
      ramp: diagFor(normalOk, normalPoly, ramp.cgIn, ramp.totalWeight),
      takeoff: diagFor(normalOk, normalPoly, takeoff.cgIn, takeoff.totalWeight),
      landing: diagFor(normalOk, normalPoly, landing.cgIn, landing.totalWeight),
    };

    const utilityDiag = {
      ramp: diagFor(utilityOk, utilityPoly, ramp.cgIn, ramp.totalWeight),
      takeoff: diagFor(utilityOk, utilityPoly, takeoff.cgIn, takeoff.totalWeight),
      landing: diagFor(utilityOk, utilityPoly, landing.cgIn, landing.totalWeight),
    };

    // The “primary” diag used by ResultCard depends on your dropdown (#3)
    const primaryDiag = activeCategory === 'utility' ? utilityDiag : normalDiag;
    const hasAnyEnvelope = normalOk || utilityOk;



    // Station max warnings (B)
    const warnings: string[] = [];
    for (const item of commonItems) {
      const max = item.station?.maxWeightLb;
      if (max != null && item.weightLb > max) {
        warnings.push(`${item.label} exceeds station max (${round(item.weightLb)} > ${max} lb).`);
      }
    }

    // Fuel station max (if you store one)
    const fuelMax = stFuel?.maxWeightLb;
    const fuelRampLb = start * density;
    if (fuelMax != null && fuelRampLb > fuelMax) {
      warnings.push(`Fuel exceeds station max (${round(fuelRampLb)} > ${fuelMax} lb).`);
    }

    // VFR fuel reserve check with day/night flight support
    // Estimate GPH from total burn across flight (simplified - real flight plans would have more detail)
    const estimatedGph = burn / 1.5 || 8.0; // Rough estimate: assume 1.5 hr flight or default 8 GPH
    const fuelReserveCheck = checkFuelReserve(landingGal, estimatedGph, isNightFlight);

    return {
      density,
      usable,
      start,
      taxi,
      burn,
      takeoffGal,
      landingGal,
      rampItems,
      takeoffItems,
      landingItems,
      ramp,
      takeoff,
      landing,
      limits: profile.limits,
      warnings,
      fuelReserveCheck,
      envelope: {
        hasAnyEnvelope,

        // for drawing both on one graph
        normalPoints: normalOk ? normal.sorted : [],
        utilityPoints: utilityOk ? utility.sorted : [],

        // diagnostics for both categories
        normalDiag,
        utilityDiag,

        // diagnostics used as the "main" pass/fail text
        primaryDiag,
      },

    };
  }, [
    profile,
    frontLb,
    rearLb,
    baggageByStation,
    baggageStations,
    startFuelGal,
    taxiFuelGal,
    plannedBurnGal,
    stFront,
    stRear,
    stFuel,
    activeCategory,
    isNightFlight,
  ]);

  useEffect(() => {
    if (!currentSession || !profile || !calc) return;

    updateWeightBalance({
      profileId: profile.id,
      frontSeatsLb: frontLb,
      rearSeatsLb: rearLb,
      baggageLb: Object.values(baggageByStation).reduce((sum, w) => sum + w, 0),
      startFuelGal: Number(startFuelGal),
      taxiFuelGal: Number(taxiFuelGal),
      plannedBurnGal: Number(plannedBurnGal),
      rampWeight: calc.ramp.totalWeight,
      rampCG: calc.ramp.cgIn,
      takeoffWeight: calc.takeoff.totalWeight,
      takeoffCG: calc.takeoff.cgIn,
      landingWeight: calc.landing.totalWeight,
      landingCG: calc.landing.cgIn,
    });

    if (!currentSession.completed.weightBalance) {
      completeStep('weightBalance');
    }
  }, [
    baggageByStation,
    calc,
    completeStep,
    currentSession,
    frontLb,
    plannedBurnGal,
    profile,
    rearLb,
    startFuelGal,
    taxiFuelGal,
    updateWeightBalance,
  ]);

  if (!profile) {
    return (
      <div>

<style>{`
  @media print {
    /* Make backgrounds + accents actually print */
    * { -webkit-print-color-adjust: exact; print-color-adjust: exact; }

    /* Hide interactive UI */
    .no-print { display: none !important; }

    /* Show print-only section */
    .print-only { display: block !important; }

    /* Tighten spacing */
    body { margin: 0; }
    h2 { margin: 0 0 6px 0; }
    hr { margin: 10px 0; }

    /* Avoid awkward splits */
    .print-card { break-inside: avoid; page-break-inside: avoid; }
  }

  /* default on screen */
  .print-only { display: none; }
`}</style>


        <h2>Weight &amp; Balance</h2>
        <p>
          No aircraft profiles found yet. Create one in <b>Aircraft</b> first.
        </p>


      </div>
    );
  }

  const limitRamp = calc?.limits.maxRampLb;
  const limitTO = calc?.limits.maxTakeoffLb;
  const limitLDG = calc?.limits.maxLandingLb;

  const breakdown =
    phase === 'Ramp' ? calc?.rampItems : phase === 'Takeoff' ? calc?.takeoffItems : calc?.landingItems;

  return (
    
    <div>

<div className="print-only" style={{ marginBottom: 12 }}>
  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12 }}>
    <div>
      <div style={{ fontWeight: 900 }}>Cleared To Plan — Weight & Balance</div>
      <div>Tail: <b>{profile.tailNumber}</b> — {profile.makeModel}</div>
    </div>
    <div style={{ textAlign: 'right' }}>
      <div>{new Date().toLocaleString()}</div>
      <div>Category: <b>{activeCategory}</b></div>
    </div>
  </div>
  <hr style={{ margin: '10px 0' }} />
</div>


      <h2>Weight &amp; Balance</h2>
      <p style={{ marginTop: 4, opacity: 0.8 }}>
        Computes Ramp / Takeoff / Landing using taxi fuel and planned burn. Enter tail-specific limits and envelope for real pass/fail.
      </p>

      <div className="no-print" style={{ display: 'flex', gap: 8, marginTop: 10 }}>
  <button onClick={() => window.print()}>Print / Save PDF</button>
</div>


    <div className="no-print">
      <div style={{ marginTop: 12 }}>
        <label style={{ fontSize: 12, opacity: 0.8 }}>Aircraft profile</label>
        <select
          value={selectedId}
          onChange={(e) => setSelectedId(e.target.value)}
          style={{ display: 'block', padding: 8, borderRadius: 8, marginTop: 6 }}
        >
          {profiles.map((p) => (
            <option key={p.id} value={p.id}>
              {p.tailNumber} — {p.makeModel}
            </option>
          ))}
        </select>
      </div>

      {/* Scenario Management */}
      <div style={{ marginTop: 16, padding: 16, border: '1px solid #ddd', borderRadius: 12, background: '#fafafa' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h3 style={{ margin: 0, fontSize: 16 }}>💾 Saved Scenarios</h3>
          <button
            onClick={() => setShowSaveDialog(!showSaveDialog)}
            style={{
              padding: '6px 12px',
              borderRadius: 8,
              background: '#2563eb',
              color: '#fff',
              border: 'none',
              fontWeight: 700,
              cursor: 'pointer',
            }}
          >
            {showSaveDialog ? 'Cancel' : '+ Save Current'}
          </button>
        </div>

        {showSaveDialog && (
          <div style={{ marginBottom: 12, padding: 12, border: '1px solid #2563eb', borderRadius: 8, background: '#eff6ff' }}>
            <label htmlFor="scenario-name" style={{ fontSize: 14, fontWeight: 700, display: 'block', marginBottom: 6 }}>
              Scenario Name
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                id="scenario-name"
                type="text"
                value={scenarioName}
                onChange={(e) => setScenarioName(e.target.value)}
                placeholder="e.g., Solo training, Family trip with bags"
                style={{ flex: 1, padding: 8, borderRadius: 8, border: '1px solid #ddd' }}
                onKeyDown={(e) => e.key === 'Enter' && saveScenario()}
              />
              <button
                onClick={saveScenario}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  background: '#16a34a',
                  color: '#fff',
                  border: 'none',
                  fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                Save
              </button>
            </div>
          </div>
        )}

        {scenarios.length === 0 ? (
          <div style={{ fontSize: 14, opacity: 0.7, fontStyle: 'italic' }}>
            No saved scenarios yet. Click "+ Save Current" to save your current configuration.
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {scenarios
              .filter((s) => s.aircraftId === selectedId)
              .map((scenario) => (
                <div
                  key={scenario.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                    padding: 12,
                    border: '1px solid #e5e7eb',
                    borderRadius: 8,
                    background: '#fff',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{scenario.name}</div>
                    <div style={{ fontSize: 12, opacity: 0.7, marginTop: 2 }}>
                      Front: {scenario.frontLb} lb | Rear: {scenario.rearLb} lb | Fuel: {scenario.startFuelGal} gal
                    </div>
                    <div style={{ fontSize: 11, opacity: 0.6, marginTop: 2 }}>
                      Saved: {new Date(scenario.createdAt).toLocaleString()}
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button
                      onClick={() => loadScenario(scenario)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 6,
                        background: '#2563eb',
                        color: '#fff',
                        border: 'none',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                    >
                      Load
                    </button>
                    <button
                      onClick={() => deleteScenario(scenario.id)}
                      style={{
                        padding: '6px 12px',
                        borderRadius: 6,
                        background: '#dc2626',
                        color: '#fff',
                        border: 'none',
                        fontSize: 12,
                        fontWeight: 700,
                        cursor: 'pointer',
                      }}
                      title="Delete scenario"
                    >
                      ✕
                    </button>
                  </div>
                </div>
              ))}
            {scenarios.filter((s) => s.aircraftId === selectedId).length === 0 && (
              <div style={{ fontSize: 14, opacity: 0.7, fontStyle: 'italic' }}>
                No scenarios for this aircraft. Switch to another aircraft or save a new scenario.
              </div>
            )}
          </div>
        )}
      </div>

      {/* Station max warnings (B) */}
      {calc?.warnings?.length ? (
        <div style={{ marginTop: 12, border: '1px solid #f0c36d', borderRadius: 12, padding: 12 }}>
          <div style={{ fontWeight: 900 }}>⚠️ Station limit warnings</div>
          <ul style={{ margin: '8px 0 0 18px' }}>
            {calc.warnings.map((w, idx) => (
              <li key={idx}>{w}</li>
            ))}
          </ul>
        </div>
      ) : null}

      {/* Fuel reserve warning */}
      {calc?.fuelReserveCheck && !calc.fuelReserveCheck.ok && (
        <div
          style={{
            marginTop: 12,
            border: '2px solid #dc2626',
            borderRadius: 12,
            padding: 12,
            background: '#fef2f2',
          }}
        >
          <div style={{ fontWeight: 900, marginBottom: 6 }}>⛔ VFR Fuel Reserve Warning</div>
          <div style={{ fontSize: 14 }}>{calc.fuelReserveCheck.message}</div>
        </div>
      )}

<div style={{ marginTop: 12 }}>
  <label style={{ fontSize: 12, opacity: 0.8 }}>Active category</label>
  <select
    value={activeCategory}
    onChange={(e) => setActiveCategory(e.target.value as 'normal' | 'utility')}
    style={{ display: 'block', padding: 8, borderRadius: 8, marginTop: 6 }}
  >
    <option value="normal">Normal</option>
    <option value="utility">Utility</option>
  </select>

  <div style={{ marginTop: 6, fontSize: 12, opacity: 0.75 }}>
    We’ll draw both envelopes on the graph. The active category controls which envelope is used for the main pass/fail text.
  </div>
</div>


<div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 16 }}>
  <div>
    <label htmlFor="front-seats-weight">Front seats (lb)</label>
    <input
      id="front-seats-weight"
      type="number"
      min="0"
      max="700"
      value={frontLb}
      onChange={(e) => setFrontLb(validatePassengerWeight(Number(e.target.value) || 0))}
      inputMode="decimal"
      style={{ width: '100%', padding: 8, borderRadius: 8 }}
      aria-label="Front seats weight in pounds"
    />
  </div>

  <div>
    <label htmlFor="rear-seats-weight">Rear seats (lb)</label>
    <input
      id="rear-seats-weight"
      type="number"
      min="0"
      max="700"
      value={rearLb}
      onChange={(e) => setRearLb(validatePassengerWeight(Number(e.target.value) || 0))}
      inputMode="decimal"
      style={{ width: '100%', padding: 8, borderRadius: 8 }}
      aria-label="Rear seats weight in pounds"
    />
  </div>

  <div style={{ gridColumn: '1 / -1' }}>
    <div style={{ fontWeight: 800, marginBottom: 6 }}>Baggage</div>

    {baggageStations.length === 0 ? (
      <div style={{ fontSize: 12, opacity: 0.7 }}>
        No baggage stations found in this aircraft profile.
      </div>




    ) : (
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12 }}>
        {baggageStations.map((s) => (
          <div key={s.id}>
            <label>{s.name} (lb)</label>
            <input
              value={baggageByStation[s.id] ?? 0}
              onChange={(e) =>
                setBaggageByStation((prev) => ({
                  ...prev,
                  [s.id]: Number(e.target.value) || 0,
                }))
              }
              inputMode="decimal"
              style={{ width: '100%', padding: 8, borderRadius: 8 }}
            />
            {s.maxWeightLb != null && (
              <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
                Max: {s.maxWeightLb} lb
              </div>
            )}
          </div>
        ))}
      </div>
    )}
  </div>

  <div>
    <label>Fuel density (lb/gal)</label>
    <input
      value={calc?.density ?? 6.0}
      readOnly
      style={{ width: '100%', padding: 8, borderRadius: 8, background: '#f7f7f7' }}
    />
  </div>
</div>


      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 12, marginTop: 12 }}>
        <div>
          <label>Start fuel (gal)</label>
          <input
  type="number"
  step="0.1"
  value={startFuelGal}
  onChange={(e) => setStartFuelGal(e.target.value)}
  placeholder="e.g. 1.0"
  inputMode="decimal"
  style={{ width: '100%', padding: 8, borderRadius: 8 }}
/>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
            {calc?.usable ? `Usable: ${calc.usable} gal` : 'Usable not set in profile'}
          </div>
        </div>
        <div>
          <label>Taxi fuel (gal)</label>
          <input
  type="number"
  step="0.1"
  value={taxiFuelGal}
  onChange={(e) => setTaxiFuelGal(e.target.value)}
  placeholder="e.g. 1.0"
  inputMode="decimal"
  style={{ width: '100%', padding: 8, borderRadius: 8 }}
/>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
            Takeoff fuel: {round(calc?.takeoffGal ?? 0, 1)} gal
          </div>
        </div>
        <div>
          <label>Planned burn (gal)</label>
          <input
  type="number"
  step="0.1"
  value={plannedBurnGal}
  onChange={(e) => setPlannedBurnGal(e.target.value)}
  placeholder="e.g. 1.0"
  inputMode="decimal"
  style={{ width: '100%', padding: 8, borderRadius: 8 }}
/>
          <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4 }}>
            Landing fuel: {round(calc?.landingGal ?? 0, 1)} gal
          </div>
        </div>
        <div>
          <label>Fuel sanity</label>
          <input
            value={`Start ${round(calc?.start ?? 0, 1)} / TO ${round(calc?.takeoffGal ?? 0, 1)} / LDG ${round(calc?.landingGal ?? 0, 1)} gal`}
            readOnly
            style={{ width: '100%', padding: 8, borderRadius: 8, background: '#f7f7f7' }}
          />
        </div>
      </div>

      {/* Night Flight Toggle */}
      <div style={{ marginTop: 16 }}>
        <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }}>
          <input
            type="checkbox"
            checked={isNightFlight}
            onChange={(e) => setIsNightFlight(e.target.checked)}
            style={{ cursor: 'pointer', width: 18, height: 18 }}
          />
          <span style={{ fontSize: 14, fontWeight: 600 }}>
            Night Flight (VFR fuel reserve: {isNightFlight ? '45' : '30'} minutes)
          </span>
        </label>
        <div style={{ fontSize: 12, opacity: 0.7, marginTop: 4, marginLeft: 26 }}>
          FAR 91.151: VFR requires {isNightFlight ? '45 minutes at night' : '30 minutes during day'}
        </div>
      </div>
      </div> {/* end .no-print */}

      <hr style={{ margin: '16px 0' }} />

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        <ResultCard
          title="Ramp"
          phase="ramp"
          totalWeight={calc?.ramp.totalWeight ?? 0}
          totalMoment={calc?.ramp.totalMoment ?? 0}
          cgIn={calc?.ramp.cgIn ?? 0}
          weightLimit={limitRamp}
          envelopeDiag={calc?.envelope.primaryDiag.ramp ?? null}

        />
<ResultCard
  title="Takeoff"
  phase="takeoff"
  totalWeight={calc?.takeoff.totalWeight ?? 0}
  totalMoment={calc?.takeoff.totalMoment ?? 0}
  cgIn={calc?.takeoff.cgIn ?? 0}
  weightLimit={limitTO}
  envelopeDiag={calc?.envelope.primaryDiag.takeoff ?? null}

/>

<ResultCard
  title="Landing"
  phase="landing"
  totalWeight={calc?.landing.totalWeight ?? 0}
  totalMoment={calc?.landing.totalMoment ?? 0}
  cgIn={calc?.landing.cgIn ?? 0}
  weightLimit={limitLDG}
  envelopeDiag={calc?.envelope.primaryDiag.landing ?? null}

/>
</div>
      <div style={{ marginTop: 16 }}>
      <CgDiagram
  normalPoints={calc?.envelope.normalPoints ?? []}
  utilityPoints={calc?.envelope.utilityPoints ?? []}
  activeCategory={activeCategory}
  ramp={{ cgIn: calc?.ramp.cgIn ?? 0, totalWeight: calc?.ramp.totalWeight ?? 0 }}
  takeoff={{ cgIn: calc?.takeoff.cgIn ?? 0, totalWeight: calc?.takeoff.totalWeight ?? 0 }}
  landing={{ cgIn: calc?.landing.cgIn ?? 0, totalWeight: calc?.landing.totalWeight ?? 0 }}
/>

      </div>

      <hr style={{ margin: '16px 0' }} />

      {/* Breakdown tabs (A) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
        <h3 style={{ margin: 0 }}>Breakdown</h3>
        <PhaseTabs value={phase} onChange={setPhase} />
      </div>

      <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 12 }}>
        <thead>
          <tr style={{ textAlign: 'left' }}>
            <th style={{ padding: 8, borderBottom: '1px solid #ddd' }}>Item</th>
            <th style={{ padding: 8, borderBottom: '1px solid #ddd' }}>Weight (lb)</th>
            <th style={{ padding: 8, borderBottom: '1px solid #ddd' }}>Arm (in)</th>
            <th style={{ padding: 8, borderBottom: '1px solid #ddd' }}>Moment (lb-in)</th>
            <th style={{ padding: 8, borderBottom: '1px solid #ddd' }}>Station max</th>
          </tr>
        </thead>
        <tbody>
          {breakdown?.map((i) => {
            const max = i.station?.maxWeightLb;
            const over = max != null && i.weightLb > max;
            return (
              <tr key={i.label}>
                <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0' }}>{i.label}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0' }}>{round(i.weightLb, 1)}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0' }}>{round(i.armIn, 2)}</td>
                <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0' }}>
                  {round(i.weightLb * i.armIn, 1)}
                </td>
                <td style={{ padding: 8, borderBottom: '1px solid #f0f0f0', fontWeight: over ? 900 : 600 }}>
                  {max != null ? `${max} lb${over ? ' ⛔' : ''}` : '—'}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>

    </div>
  );
}
