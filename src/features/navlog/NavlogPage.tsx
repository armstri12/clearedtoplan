import { useMemo, useState } from 'react';
import type { CSSProperties } from 'react';


type VarDir = 'E' | 'W';

type Leg = {
  id: string;
  from: string;
  to: string;

  distNm: string;     // keep as string for blanks/decimals
  tcDegT: string;

  altFt: string;

  windDirDegT: string; // direction wind is FROM (true)
  windSpdKt: string;

  // Optional per-leg overrides (blank = use trip defaults)
  varDeg: string;     // magnitude
  varDir: VarDir;
  devDeg: string;     // signed, e.g. "-2" or "1.5"
};

type PerfPreset = {
  rpm: number;
  altFt: number;
  tasKt: number;
  gph: number;
};

const PERF: PerfPreset[] = [
  // v1 presets (adjust later)
  { rpm: 2300, altFt: 3000, tasKt: 108, gph: 8.4 },
  { rpm: 2300, altFt: 4500, tasKt: 110, gph: 8.5 },
  { rpm: 2300, altFt: 6500, tasKt: 112, gph: 8.6 },

  { rpm: 2400, altFt: 3000, tasKt: 112, gph: 9.0 },
  { rpm: 2400, altFt: 4500, tasKt: 114, gph: 9.2 },
  { rpm: 2400, altFt: 6500, tasKt: 116, gph: 9.4 },
];

function makeId(prefix = 'leg') {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function toNum(s: string) {
  const x = Number(s);
  return Number.isFinite(x) ? x : 0;
}

function clamp(x: number, a: number, b: number) {
  return Math.max(a, Math.min(b, x));
}

function norm360(x: number) {
  const r = x % 360;
  return r < 0 ? r + 360 : r;
}

function rad(deg: number) {
  return (deg * Math.PI) / 180;
}
function deg(rad: number) {
  return (rad * 180) / Math.PI;
}

function pickPerf(rpm: number, altFt: number) {
  // nearest match by (rpm exact, altitude nearest)
  const sameRpm = PERF.filter((p) => p.rpm === rpm);
  if (!sameRpm.length) return { tasKt: 110, gph: 8.5 };

  let best = sameRpm[0];
  let bestD = Math.abs(best.altFt - altFt);
  for (const p of sameRpm) {
    const d = Math.abs(p.altFt - altFt);
    if (d < bestD) {
      best = p;
      bestD = d;
    }
  }
  return { tasKt: best.tasKt, gph: best.gph };
}

// Wind triangle planning math (manual navlog style)
// inputs: TC (true), wind dir FROM (true), wind speed, TAS
function computeWind(tc: number, windDirFrom: number, windSpd: number, tas: number) {
  if (tas <= 0) return { wca: 0, th: norm360(tc), gs: 0 };

  const rel = rad(norm360(windDirFrom - tc));
  const cross = windSpd * Math.sin(rel);
  const head = windSpd * Math.cos(rel); // + = headwind, - = tailwind

  const ratio = clamp(cross / tas, -1, 1);
  const wca = deg(Math.asin(ratio)); // signed
  const th = norm360(tc + wca);

  // planning GS approximation
  const gs = Math.max(0, tas - head);

  return { wca, th, gs };
}

function applyVariation(th: number, varDeg: number, varDir: VarDir) {
  // East is least: MH = TH - Var(E)
  // West is best: MH = TH + Var(W)
  const mh = varDir === 'E' ? th - varDeg : th + varDeg;
  return norm360(mh);
}

function applyDeviation(mh: number, devSigned: number) {
  // devSigned is signed (user enters -2, +1.5, etc.)
  return norm360(mh + devSigned);
}

export default function NavlogPage() {
  // Trip defaults
  const [rpm, setRpm] = useState<number>(2300);
  const [tripAltFt, setTripAltFt] = useState<string>('4500');

  const [tripWindDirDegT, setTripWindDirDegT] = useState<string>('270');
  const [tripWindSpdKt, setTripWindSpdKt] = useState<string>('15');

  const [tripVarDeg, setTripVarDeg] = useState<string>('2');
  const [tripVarDir, setTripVarDir] = useState<VarDir>('W');

  const [legs, setLegs] = useState<Leg[]>(() => [
    {
      id: makeId(),
      from: '',
      to: '',
      distNm: '',
      tcDegT: '',
      altFt: '',

      windDirDegT: '',
      windSpdKt: '',

      varDeg: '',
      varDir: 'W',
      devDeg: '',
    },
  ]);

  function addLeg() {
    setLegs((prev) => [
      ...prev,
      {
        id: makeId(),
        from: '',
        to: '',
        distNm: '',
        tcDegT: '',
        altFt: '',
        windDirDegT: '',
        windSpdKt: '',
        varDeg: '',
        varDir: tripVarDir,
        devDeg: '',
      },
    ]);
  }

  function removeLeg(id: string) {
    setLegs((prev) => prev.filter((l) => l.id !== id));
  }

  function updateLeg(id: string, patch: Partial<Leg>) {
    setLegs((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  const perf = useMemo(() => {
    const alt = toNum(tripAltFt);
    return pickPerf(rpm, alt);
  }, [rpm, tripAltFt]);

  const computed = useMemo(() => {
    const defaultAlt = toNum(tripAltFt);

    const defaultWindDir = toNum(tripWindDirDegT);
    const defaultWindSpd = toNum(tripWindSpdKt);

    const defaultVarDeg = toNum(tripVarDeg);
    const defaultVarDir = tripVarDir;

    const tas = perf.tasKt;
    const gph = perf.gph;

    const rows = legs.map((l) => {
      const tc = toNum(l.tcDegT);
      const dist = toNum(l.distNm);

      const alt = l.altFt.trim() ? toNum(l.altFt) : defaultAlt;

      const windDir = l.windDirDegT.trim() ? toNum(l.windDirDegT) : defaultWindDir;
      const windSpd = l.windSpdKt.trim() ? toNum(l.windSpdKt) : defaultWindSpd;

      const vDeg = l.varDeg.trim() ? toNum(l.varDeg) : defaultVarDeg;
      const vDir = l.varDeg.trim() ? l.varDir : defaultVarDir;

      const dev = l.devDeg.trim() ? toNum(l.devDeg) : 0;

      const { wca, th, gs } = computeWind(tc, windDir, windSpd, tas);

      const mh = applyVariation(th, vDeg, vDir);
      const ch = applyDeviation(mh, dev);

      const eteMin = gs > 0 && dist > 0 ? (dist / gs) * 60 : 0;
      const fuelGal = gph > 0 ? (eteMin / 60) * gph : 0;



      return {
        ...l,
        tc,
        dist,
        alt,
        windDir,
        windSpd,
        tas,
        gph,
        wca,
        th,
        mh,
        ch,
        gs,
        eteMin,
        fuelGal,
        varDegUsed: vDeg,
        varDirUsed: vDir,
        devUsed: dev,
      };
    });

    const totalDist = rows.reduce((a, r) => a + (r.dist || 0), 0);
    const totalMin = rows.reduce((a, r) => a + (r.eteMin || 0), 0);
    const totalFuel = rows.reduce((a, r) => a + (r.fuelGal || 0), 0);

    return { rows, totalDist, totalMin, totalFuel, tas, gph };
  }, [legs, tripAltFt, tripWindDirDegT, tripWindSpdKt, tripVarDeg, tripVarDir, perf.tasKt, perf.gph]);

        const cellInputStyle: CSSProperties = {
        height: 34,
        padding: '6px 8px',
        borderRadius: 8,
        border: '1px solid #ccc',
        fontSize: 12,
        };

  const gridBorder = '1.5px solid #111';
  const thinBorder = '1px solid #111';

  const thBase: CSSProperties = {
    border: gridBorder,
    padding: '6px 6px',
    fontSize: 11,
    fontWeight: 900,
    textTransform: 'uppercase',
    letterSpacing: 0.4,
    background: '#f3f4f6',
    whiteSpace: 'nowrap',
  };

  const thGroup: CSSProperties = {
    ...thBase,
    background: '#e5e7eb',
    textAlign: 'center',
    fontSize: 11,
  };

  const tdBase: CSSProperties = {
    border: thinBorder,
    padding: 6,
    fontSize: 12,
    verticalAlign: 'middle',
    background: '#fff',
  };

  const tdCenter: CSSProperties = { ...tdBase, textAlign: 'center' };
  const tdRight: CSSProperties = { ...tdBase, textAlign: 'right' };

  const cellText: CSSProperties = {
    display: 'inline-block',
    minWidth: 20,
  };

  const cellInput: CSSProperties = {
    ...cellInputStyle,
    height: 30,
    padding: '4px 6px',
    borderRadius: 6,
    border: '1px solid #111',
    fontSize: 12,
  };


  return (
    <div>
      <h2>Navlog</h2>
      <p style={{ marginTop: 4, opacity: 0.8 }}>
        Manual entry navlog. Enter TC + distance per leg. We compute WCA, TH, MH, CH, GS, ETE, and fuel.
      </p>

      <div className="no-print" style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <button onClick={() => window.print()}>Print / Save PDF</button>
        <button onClick={addLeg}>Add leg</button>
      </div>

      {/* Trip setup */}
      <div
        className="no-print"
        style={{
          border: '1px solid #ddd',
          borderRadius: 12,
          padding: 12,
          marginTop: 12,
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))',
          gap: 12,
          alignItems: 'end',
          overflow: 'hidden',
        }}
      >
        <div>
          <label>RPM</label>
          <select
            value={rpm}
            onChange={(e) => setRpm(Number(e.target.value))}
            style={{ width: '100%', padding: 8, borderRadius: 8 }}
          >
            {[2200, 2300, 2400, 2500].map((r) => (
              <option key={r} value={r}>{r}</option>
            ))}
          </select>
        </div>

        <div>
          <label>Trip altitude (ft)</label>
          <input
            type="number"
            step="100"
            value={tripAltFt}
            onChange={(e) => setTripAltFt(e.target.value)}
            style={{ width: '100%', padding: 8, borderRadius: 8 }}
          />
        </div>

        <div>
          <label>Wind dir (°T)</label>
          <input
            type="number"
            step="1"
            value={tripWindDirDegT}
            onChange={(e) => setTripWindDirDegT(e.target.value)}
            style={{ width: '100%', padding: 8, borderRadius: 8 }}
          />
        </div>

        <div>
          <label>Wind speed (kt)</label>
          <input
            type="number"
            step="0.1"
            value={tripWindSpdKt}
            onChange={(e) => setTripWindSpdKt(e.target.value)}
            style={{ width: '100%', padding: 8, borderRadius: 8 }}
          />
        </div>

        <div>
          <label>Variation</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              type="number"
              step="0.1"
              value={tripVarDeg}
              onChange={(e) => setTripVarDeg(e.target.value)}
              style={{ width: '60%', padding: 8, borderRadius: 8 }}
            />
            <select
              value={tripVarDir}
              onChange={(e) => setTripVarDir(e.target.value as VarDir)}
              style={{ width: '40%', padding: 8, borderRadius: 8 }}
            >
              <option value="E">E</option>
              <option value="W">W</option>
            </select>
          </div>
        </div>

        <div style={{ gridColumn: '1 / -1', fontSize: 12, opacity: 0.8 }}>
          Performance (v1 presets): <b>TAS {computed.tas.toFixed(0)} kt</b> @ <b>{rpm} RPM</b> — Fuel burn <b>{computed.gph.toFixed(1)} GPH</b>
        </div>
      </div>

            {/* Navlog table */}
      <div style={{ marginTop: 14, border: '1px solid #ddd', borderRadius: 12, overflow: 'hidden' }}>
        {/* Header strip */}
        <div
          style={{
            padding: 14,
            borderBottom: '2px solid #111',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
          }}
        >
          <div style={{ fontWeight: 900, letterSpacing: 1 }}>VFR NAVIGATION LOG</div>
          <div style={{ fontSize: 12, opacity: 0.85 }}>
            TAS <b>{computed.tas.toFixed(0)} kt</b> • Fuel <b>{computed.gph.toFixed(1)} GPH</b> • RPM <b>{rpm}</b>
          </div>
        </div>

        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 1200, borderCollapse: 'collapse', fontSize: 12 }}>
            <colgroup>
              <col style={{ width: 90 }} />
              <col style={{ width: 90 }} />
              <col style={{ width: 70 }} />
              <col style={{ width: 70 }} />
              <col style={{ width: 80 }} />
              <col style={{ width: 70 }} />
              <col style={{ width: 70 }} />
              <col style={{ width: 120 }} />
              <col style={{ width: 70 }} />
              <col style={{ width: 70 }} />
              <col style={{ width: 70 }} />
              <col style={{ width: 70 }} />
              <col style={{ width: 70 }} />
              <col style={{ width: 70 }} />
              <col style={{ width: 70 }} />
              <col style={{ width: 60 }} />
            </colgroup>

            <thead>
              <tr>
                <th colSpan={2} style={thGroup}>ROUTE</th>
                <th colSpan={3} style={thGroup}>COURSE / DISTANCE</th>
                <th colSpan={2} style={thGroup}>WIND (TRUE)</th>
                <th colSpan={2} style={thGroup}>MAG</th>
                <th colSpan={4} style={thGroup}>HEADINGS</th>
                <th style={thGroup}>GS</th>
                <th style={thGroup}>ETE</th>
                <th style={{ ...thGroup, borderRight: 'none' }}>FUEL</th>
              </tr>

              <tr>
                <th style={thBase}>FROM</th>
                <th style={thBase}>TO</th>

                <th style={thBase}>NM</th>
                <th style={thBase}>TC °T</th>
                <th style={thBase}>ALT FT</th>

                <th style={thBase}>DIR °T</th>
                <th style={thBase}>KT</th>

                <th style={thBase}>VAR</th>
                <th style={thBase}>DEV</th>

                <th style={thBase}>WCA</th>
                <th style={thBase}>TH °T</th>
                <th style={thBase}>MH °M</th>
                <th style={thBase}>CH °C</th>

                <th style={thBase}></th>
                <th style={thBase}></th>
                <th style={{ ...thBase, borderRight: 'none' }}></th>
              </tr>
            </thead>

            <tbody>
              {computed.rows.map((r) => (
                <tr key={r.id}>
                  <td style={tdBase}>
                    <input
                      className="no-print"
                      value={r.from}
                      onChange={(e) => updateLeg(r.id, { from: e.target.value.toUpperCase() })}
                      style={cellInput}
                    />
                    <span className="print-only">{r.from}</span>
                  </td>

                  <td style={tdBase}>
                    <input
                      className="no-print"
                      value={r.to}
                      onChange={(e) => updateLeg(r.id, { to: e.target.value.toUpperCase() })}
                      style={cellInput}
                    />
                    <span className="print-only">{r.to}</span>
                  </td>

                  <td style={tdRight}>
                    <input
                      className="no-print"
                      type="number"
                      step="0.1"
                      value={r.distNm}
                      onChange={(e) => updateLeg(r.id, { distNm: e.target.value })}
                      style={cellInput}
                    />
                    <span className="print-only">{r.distNm}</span>
                  </td>

                  <td style={tdRight}>
                    <input
                      className="no-print"
                      type="number"
                      step="0.1"
                      value={r.tcDegT}
                      onChange={(e) => updateLeg(r.id, { tcDegT: e.target.value })}
                      style={cellInput}
                    />
                    <span className="print-only">{r.tcDegT}</span>
                  </td>

                  <td style={tdRight}>
                    <input
                      className="no-print"
                      type="number"
                      step="100"
                      value={r.altFt}
                      onChange={(e) => updateLeg(r.id, { altFt: e.target.value })}
                      style={cellInput}
                      placeholder="(trip)"
                    />
                    <span className="print-only">{r.altFt || String(toNum(tripAltFt) || '')}</span>
                  </td>

                  <td style={tdRight}>
                    <input
                      className="no-print"
                      type="number"
                      step="1"
                      value={r.windDirDegT}
                      onChange={(e) => updateLeg(r.id, { windDirDegT: e.target.value })}
                      style={cellInput}
                      placeholder="(trip)"
                    />
                    <span className="print-only">{r.windDirDegT || tripWindDirDegT}</span>
                  </td>

                  <td style={tdRight}>
                    <input
                      className="no-print"
                      type="number"
                      step="0.1"
                      value={r.windSpdKt}
                      onChange={(e) => updateLeg(r.id, { windSpdKt: e.target.value })}
                      style={cellInput}
                      placeholder="(trip)"
                    />
                    <span className="print-only">{r.windSpdKt || tripWindSpdKt}</span>
                  </td>

                  <td style={tdCenter}>
                    <div className="no-print" style={{ display: 'flex', gap: 6, justifyContent: 'center' }}>
                      <input
                        type="number"
                        step="0.1"
                        value={r.varDeg}
                        onChange={(e) => updateLeg(r.id, { varDeg: e.target.value })}
                        style={{ ...cellInput, width: 60, textAlign: 'right' }}
                        placeholder="(trip)"
                      />
                      <select
                        value={r.varDir}
                        onChange={(e) => updateLeg(r.id, { varDir: e.target.value as VarDir })}
                        style={{ ...cellInput, width: 52, padding: '4px 6px' }}
                      >
                        <option value="E">E</option>
                        <option value="W">W</option>
                      </select>
                    </div>
                    <span className="print-only">
                      {(r.varDeg || tripVarDeg) + (r.varDeg ? r.varDir : tripVarDir)}
                    </span>
                  </td>

                  <td style={tdRight}>
                    <input
                      className="no-print"
                      type="number"
                      step="0.1"
                      value={r.devDeg}
                      onChange={(e) => updateLeg(r.id, { devDeg: e.target.value })}
                      style={cellInput}
                      placeholder="0"
                    />
                    <span className="print-only">{r.devDeg || '0'}</span>
                  </td>

                  <td style={tdRight}>{r.wca.toFixed(1)}</td>
                  <td style={tdRight}>{r.th.toFixed(0)}</td>
                  <td style={tdRight}>{r.mh.toFixed(0)}</td>
                  <td style={tdRight}>{r.ch.toFixed(0)}</td>

                  <td style={tdRight}>{r.gs.toFixed(0)}</td>
                  <td style={tdRight}>{r.eteMin.toFixed(0)}</td>
                  <td style={{ ...tdRight, borderRight: 'none' }}>{r.fuelGal.toFixed(1)}</td>
                </tr>
              ))}
            </tbody>

            <tfoot>
              <tr style={{ background: '#f9fafb' }}>
                <td colSpan={2} style={{ padding: 10, fontWeight: 900, borderTop: '2px solid #111', borderRight: thinBorder }}>
                  Totals
                </td>
                <td style={{ padding: 10, fontWeight: 900, textAlign: 'right', borderTop: '2px solid #111', borderRight: thinBorder }}>
                  {computed.totalDist.toFixed(1)}
                </td>
                <td colSpan={11} style={{ borderTop: '2px solid #111', borderRight: thinBorder }} />
                <td style={{ padding: 10, fontWeight: 900, textAlign: 'right', borderTop: '2px solid #111', borderRight: thinBorder }}>
                  {computed.totalMin.toFixed(0)}
                </td>
                <td style={{ padding: 10, fontWeight: 900, textAlign: 'right', borderTop: '2px solid #111', borderRight: 'none' }}>
                  {computed.totalFuel.toFixed(1)}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div style={{ padding: 12, fontSize: 12, opacity: 0.75, borderTop: '1px solid #ddd' }}>
          Planning aid — verify winds, variation, deviation, and performance with charts/POH.
        </div>
      </div>

      {/* Page footnote */}
      <div style={{ marginTop: 16, fontSize: 12, opacity: 0.75 }}>
        Training aid — verify all results with charts/POH.
      </div>
    </div>
  );
}
