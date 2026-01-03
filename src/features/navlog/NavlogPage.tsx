import { useEffect, useMemo, useState } from 'react';
import type { CSSProperties } from 'react';
import { clamp } from '../../lib/utils';
import { useFlightSession } from '../../context/FlightSessionContext';

const COLORS = {
  primary: '#2563eb',
  primaryDark: '#1e40af',
  primaryLight: '#3b82f6',
  accent: '#60a5fa',
  background: '#f8fafc',
  text: '#1e293b',
  textLight: '#64748b',
  border: '#e2e8f0',
};

type VarDir = 'E' | 'W';

type Leg = {
  id: string;
  checkpoint: string;
  from: string;
  to: string;
  altitude: string;
  course: string;
  distNm: string;
  windDir: string;
  windSpd: string;
  varDeg: string;
  varDir: VarDir;
  devDeg: string;
  remarks: string;
};

type FlightPlanInfo = {
  aircraftType: string;
  aircraftIdent: string;
  pilotName: string;
  departure: string;
  destination: string;
  route: string;
  cruiseAlt: string;
  departureTime: string;
  ete: string;
  fuelOnboard: string;
};

function makeId(prefix = 'leg') {
  return `${prefix}_${Math.random().toString(16).slice(2)}_${Date.now().toString(16)}`;
}

function toNum(s: string) {
  const x = Number(s);
  return Number.isFinite(x) ? x : 0;
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

// Wind triangle calculations
function computeWind(tc: number, windDirFrom: number, windSpd: number, tas: number) {
  if (tas <= 0) return { wca: 0, th: norm360(tc), gs: 0 };

  const rel = rad(norm360(windDirFrom - tc));
  const cross = windSpd * Math.sin(rel);
  const head = windSpd * Math.cos(rel);

  const ratio = clamp(cross / tas, -1, 1);
  const wca = deg(Math.asin(ratio));
  const th = norm360(tc + wca);
  const gs = Math.max(0, tas - head);

  return { wca, th, gs };
}

function applyVariation(th: number, varDeg: number, varDir: VarDir) {
  const mh = varDir === 'E' ? th - varDeg : th + varDeg;
  return norm360(mh);
}

function applyDeviation(mh: number, devSigned: number) {
  return norm360(mh + devSigned);
}

function formatTime(minutes: number): string {
  if (!minutes) return '0:00';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}:${m.toString().padStart(2, '0')}` : `0:${m.toString().padStart(2, '0')}`;
}

function computeEta(departureTime: string, eteMinutes: number): string {
  if (!departureTime || !eteMinutes) return '';
  const [hourStr, minuteStr] = departureTime.split(':');
  const depMinutes = Number(hourStr) * 60 + Number(minuteStr);
  if (!Number.isFinite(depMinutes)) return '';

  const totalMinutes = depMinutes + Math.round(eteMinutes);
  const hours = Math.floor((totalMinutes % (24 * 60)) / 60);
  const minutes = Math.floor(totalMinutes % 60);
  return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
}

export default function NavlogPage() {
  const { currentSession, updateMetadata } = useFlightSession();

  // Flight plan information
  const [flightPlan, setFlightPlan] = useState<FlightPlanInfo>({
    aircraftType: 'C172S',
    aircraftIdent: 'N12345',
    pilotName: '',
    departure: currentSession?.metadata.departure ?? '',
    destination: currentSession?.metadata.destination ?? '',
    route: currentSession?.metadata.route ?? '',
    cruiseAlt: '4500',
    departureTime: currentSession?.metadata.etd ?? '',
    ete: '',
    fuelOnboard: '40.0',
  });

  // Trip defaults
  const [tas, setTas] = useState<string>('110');
  const [fuelBurn, setFuelBurn] = useState<string>('8.5');
  const [tripWindDir, setTripWindDir] = useState<string>('270');
  const [tripWindSpd, setTripWindSpd] = useState<string>('15');
  const [tripVarDeg, setTripVarDeg] = useState<string>('2');
  const [tripVarDir, setTripVarDir] = useState<VarDir>('W');

  const [legs, setLegs] = useState<Leg[]>(() => [
    {
      id: makeId(),
      checkpoint: 'DEP',
      from: '',
      to: '',
      altitude: '',
      course: '',
      distNm: '',
      windDir: '',
      windSpd: '',
      varDeg: '',
      varDir: 'W',
      devDeg: '',
      remarks: '',
    },
  ]);

  function addLeg() {
    setLegs((prev) => [
      ...prev,
      {
        id: makeId(),
        checkpoint: '',
        from: prev[prev.length - 1]?.to || '',
        to: '',
        altitude: '',
        course: '',
        distNm: '',
        windDir: '',
        windSpd: '',
        varDeg: '',
        varDir: tripVarDir,
        devDeg: '',
        remarks: '',
      },
    ]);
  }

  function removeLeg(id: string) {
    if (legs.length > 1) {
      setLegs((prev) => prev.filter((l) => l.id !== id));
    }
  }

  function updateLeg(id: string, patch: Partial<Leg>) {
    setLegs((prev) => prev.map((l) => (l.id === id ? { ...l, ...patch } : l)));
  }

  function updateFlightPlan(patch: Partial<FlightPlanInfo>) {
    setFlightPlan((prev) => ({ ...prev, ...patch }));
  }

  const computed = useMemo(() => {
    const cruiseTas = toNum(tas);
    const gph = toNum(fuelBurn);

    const rows = legs.map((l) => {
      const tc = toNum(l.course);
      const dist = toNum(l.distNm);

      const windDir = l.windDir.trim() ? toNum(l.windDir) : toNum(tripWindDir);
      const windSpd = l.windSpd.trim() ? toNum(l.windSpd) : toNum(tripWindSpd);

      const vDeg = l.varDeg.trim() ? toNum(l.varDeg) : toNum(tripVarDeg);
      const vDir = l.varDeg.trim() ? l.varDir : tripVarDir;
      const dev = l.devDeg.trim() ? toNum(l.devDeg) : 0;

      const { wca, th, gs } = computeWind(tc, windDir, windSpd, cruiseTas);
      const mh = applyVariation(th, vDeg, vDir);
      const ch = applyDeviation(mh, dev);

      const eteMin = gs > 0 && dist > 0 ? (dist / gs) * 60 : 0;
      const fuelGal = gph > 0 ? (eteMin / 60) * gph : 0;

      return {
        ...l,
        tc,
        dist,
        windDir,
        windSpd,
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

    return { rows, totalDist, totalMin, totalFuel };
  }, [legs, tas, fuelBurn, tripWindDir, tripWindSpd, tripVarDeg, tripVarDir]);

  // Auto-update flight plan ETE
  useEffect(() => {
    updateFlightPlan({ ete: formatTime(computed.totalMin) });
  }, [computed.totalMin]);

  useEffect(() => {
    const eta = computeEta(flightPlan.departureTime, computed.totalMin);
    updateMetadata({
      route: flightPlan.route || undefined,
      departure: flightPlan.departure || undefined,
      destination: flightPlan.destination || undefined,
      etd: flightPlan.departureTime || undefined,
      eta: eta || undefined,
    });
  }, [
    computed.totalMin,
    flightPlan.departure,
    flightPlan.departureTime,
    flightPlan.destination,
    flightPlan.route,
    updateMetadata,
  ]);

  const cellInput: CSSProperties = {
    width: '100%',
    height: 28,
    padding: '4px 6px',
    borderRadius: 4,
    border: `1px solid ${COLORS.border}`,
    fontSize: 11,
    fontFamily: 'monospace',
  };

  return (
    <div>
      {/* Header */}
      <div style={{ marginBottom: 24 }}>
        <h2 style={{ fontSize: 28, fontWeight: 900, color: COLORS.primary, marginBottom: 8 }}>
          VFR Navigation Log
        </h2>
        <p style={{ color: COLORS.textLight, marginBottom: 16 }}>
          Complete cross-country flight planning with wind corrections, headings, and fuel calculations
        </p>

        {/* Action Buttons */}
        <div className="no-print" style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
          <button
            onClick={() => window.print()}
            style={{
              padding: '10px 20px',
              background: COLORS.primary,
              color: '#fff',
              border: 'none',
              borderRadius: 8,
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            🖨️ Print / Save PDF
          </button>
          <button
            onClick={addLeg}
            style={{
              padding: '10px 20px',
              background: '#fff',
              color: COLORS.primary,
              border: `2px solid ${COLORS.primary}`,
              borderRadius: 8,
              fontWeight: 700,
              cursor: 'pointer',
              fontSize: 14,
            }}
          >
            + Add Leg
          </button>
        </div>
      </div>

      {/* Flight Plan Information */}
      <div
        className="no-print"
        style={{
          background: '#fff',
          border: `1px solid ${COLORS.border}`,
          borderRadius: 12,
          padding: 20,
          marginBottom: 20,
        }}
      >
        <h3 style={{ fontSize: 16, fontWeight: 800, color: COLORS.text, marginBottom: 16 }}>
          Flight Plan Information
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.textLight, marginBottom: 4, display: 'block' }}>
              Aircraft Type
            </label>
            <input
              value={flightPlan.aircraftType}
              onChange={(e) => updateFlightPlan({ aircraftType: e.target.value })}
              style={{ width: '100%', padding: 8, borderRadius: 8, border: `1px solid ${COLORS.border}` }}
              placeholder="C172S"
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.textLight, marginBottom: 4, display: 'block' }}>
              Aircraft Ident
            </label>
            <input
              value={flightPlan.aircraftIdent}
              onChange={(e) => updateFlightPlan({ aircraftIdent: e.target.value.toUpperCase() })}
              style={{ width: '100%', padding: 8, borderRadius: 8, border: `1px solid ${COLORS.border}` }}
              placeholder="N12345"
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.textLight, marginBottom: 4, display: 'block' }}>
              Pilot Name
            </label>
            <input
              value={flightPlan.pilotName}
              onChange={(e) => updateFlightPlan({ pilotName: e.target.value })}
              style={{ width: '100%', padding: 8, borderRadius: 8, border: `1px solid ${COLORS.border}` }}
              placeholder="Your Name"
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.textLight, marginBottom: 4, display: 'block' }}>
              Departure
            </label>
            <input
              value={flightPlan.departure}
              onChange={(e) => updateFlightPlan({ departure: e.target.value.toUpperCase() })}
              style={{ width: '100%', padding: 8, borderRadius: 8, border: `1px solid ${COLORS.border}` }}
              placeholder="KDPA"
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.textLight, marginBottom: 4, display: 'block' }}>
              Destination
            </label>
            <input
              value={flightPlan.destination}
              onChange={(e) => updateFlightPlan({ destination: e.target.value.toUpperCase() })}
              style={{ width: '100%', padding: 8, borderRadius: 8, border: `1px solid ${COLORS.border}` }}
              placeholder="KORD"
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.textLight, marginBottom: 4, display: 'block' }}>
              Route
            </label>
            <input
              value={flightPlan.route}
              onChange={(e) => updateFlightPlan({ route: e.target.value.toUpperCase() })}
              style={{ width: '100%', padding: 8, borderRadius: 8, border: `1px solid ${COLORS.border}` }}
              placeholder="Direct"
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.textLight, marginBottom: 4, display: 'block' }}>
              Cruise Alt (ft)
            </label>
            <input
              value={flightPlan.cruiseAlt}
              onChange={(e) => updateFlightPlan({ cruiseAlt: e.target.value })}
              style={{ width: '100%', padding: 8, borderRadius: 8, border: `1px solid ${COLORS.border}` }}
              placeholder="4500"
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.textLight, marginBottom: 4, display: 'block' }}>
              Departure Time (Local)
            </label>
            <input
              type="time"
              value={flightPlan.departureTime}
              onChange={(e) => updateFlightPlan({ departureTime: e.target.value })}
              style={{ width: '100%', padding: 8, borderRadius: 8, border: `1px solid ${COLORS.border}` }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.textLight, marginBottom: 4, display: 'block' }}>
              ETE (calculated)
            </label>
            <input
              value={flightPlan.ete}
              disabled
              style={{
                width: '100%',
                padding: 8,
                borderRadius: 8,
                border: `1px solid ${COLORS.border}`,
                background: '#f3f4f6',
              }}
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.textLight, marginBottom: 4, display: 'block' }}>
              Fuel Onboard (gal)
            </label>
            <input
              type="number"
              step="0.1"
              value={flightPlan.fuelOnboard}
              onChange={(e) => updateFlightPlan({ fuelOnboard: e.target.value })}
              style={{ width: '100%', padding: 8, borderRadius: 8, border: `1px solid ${COLORS.border}` }}
              placeholder="40.0"
            />
          </div>
        </div>
      </div>

      {/* Performance & Wind Defaults */}
      <div
        className="no-print"
        style={{
          background: '#fff',
          border: `1px solid ${COLORS.border}`,
          borderRadius: 12,
          padding: 20,
          marginBottom: 20,
        }}
      >
        <h3 style={{ fontSize: 16, fontWeight: 800, color: COLORS.text, marginBottom: 16 }}>
          Performance & Wind (Defaults)
        </h3>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12 }}>
          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.textLight, marginBottom: 4, display: 'block' }}>
              True Airspeed (kt)
            </label>
            <input
              type="number"
              step="1"
              value={tas}
              onChange={(e) => setTas(e.target.value)}
              style={{ width: '100%', padding: 8, borderRadius: 8, border: `1px solid ${COLORS.border}` }}
              placeholder="110"
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.textLight, marginBottom: 4, display: 'block' }}>
              Fuel Burn (GPH)
            </label>
            <input
              type="number"
              step="0.1"
              value={fuelBurn}
              onChange={(e) => setFuelBurn(e.target.value)}
              style={{ width: '100%', padding: 8, borderRadius: 8, border: `1px solid ${COLORS.border}` }}
              placeholder="8.5"
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.textLight, marginBottom: 4, display: 'block' }}>
              Wind Dir (°T)
            </label>
            <input
              type="number"
              step="1"
              value={tripWindDir}
              onChange={(e) => setTripWindDir(e.target.value)}
              style={{ width: '100%', padding: 8, borderRadius: 8, border: `1px solid ${COLORS.border}` }}
              placeholder="270"
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.textLight, marginBottom: 4, display: 'block' }}>
              Wind Speed (kt)
            </label>
            <input
              type="number"
              step="1"
              value={tripWindSpd}
              onChange={(e) => setTripWindSpd(e.target.value)}
              style={{ width: '100%', padding: 8, borderRadius: 8, border: `1px solid ${COLORS.border}` }}
              placeholder="15"
            />
          </div>

          <div>
            <label style={{ fontSize: 12, fontWeight: 600, color: COLORS.textLight, marginBottom: 4, display: 'block' }}>
              Variation
            </label>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="number"
                step="0.1"
                value={tripVarDeg}
                onChange={(e) => setTripVarDeg(e.target.value)}
                style={{ flex: 1, padding: 8, borderRadius: 8, border: `1px solid ${COLORS.border}` }}
                placeholder="2"
              />
              <select
                value={tripVarDir}
                onChange={(e) => setTripVarDir(e.target.value as VarDir)}
                style={{ width: 60, padding: 8, borderRadius: 8, border: `1px solid ${COLORS.border}` }}
              >
                <option value="E">E</option>
                <option value="W">W</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      {/* Navigation Log Table */}
      <div
        style={{
          background: '#fff',
          border: `2px solid ${COLORS.primary}`,
          borderRadius: 12,
          overflow: 'hidden',
          marginBottom: 20,
        }}
      >
        {/* Header Banner */}
        <div
          style={{
            padding: 16,
            background: `linear-gradient(135deg, ${COLORS.primary}, ${COLORS.primaryDark})`,
            color: '#fff',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            flexWrap: 'wrap',
            gap: 12,
          }}
        >
          <div>
            <div style={{ fontSize: 18, fontWeight: 900, letterSpacing: 1 }}>VFR NAVIGATION LOG</div>
            <div style={{ fontSize: 12, opacity: 0.9, marginTop: 2 }}>
              {flightPlan.aircraftIdent} • {flightPlan.departure} → {flightPlan.destination}
            </div>
          </div>
          <div style={{ textAlign: 'right', fontSize: 12 }}>
            <div>
              <strong>TAS:</strong> {tas} kt • <strong>Fuel:</strong> {fuelBurn} GPH
            </div>
            <div style={{ marginTop: 2, opacity: 0.9 }}>
              <strong>Total:</strong> {computed.totalDist.toFixed(1)} nm • {formatTime(computed.totalMin)} •{' '}
              {computed.totalFuel.toFixed(1)} gal
            </div>
          </div>
        </div>

        {/* Table */}
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', minWidth: 1400, borderCollapse: 'collapse', fontSize: 11 }}>
            <thead>
              <tr style={{ background: '#f8fafc' }}>
                <th style={{ padding: 8, borderBottom: `2px solid ${COLORS.primary}`, fontWeight: 700, textAlign: 'left' }}>
                  CKPT
                </th>
                <th style={{ padding: 8, borderBottom: `2px solid ${COLORS.primary}`, fontWeight: 700 }}>FROM</th>
                <th style={{ padding: 8, borderBottom: `2px solid ${COLORS.primary}`, fontWeight: 700 }}>TO</th>
                <th style={{ padding: 8, borderBottom: `2px solid ${COLORS.primary}`, fontWeight: 700 }}>ALT</th>
                <th style={{ padding: 8, borderBottom: `2px solid ${COLORS.primary}`, fontWeight: 700 }}>TC</th>
                <th style={{ padding: 8, borderBottom: `2px solid ${COLORS.primary}`, fontWeight: 700 }}>DIST</th>
                <th style={{ padding: 8, borderBottom: `2px solid ${COLORS.primary}`, fontWeight: 700 }}>WND°</th>
                <th style={{ padding: 8, borderBottom: `2px solid ${COLORS.primary}`, fontWeight: 700 }}>WND kt</th>
                <th style={{ padding: 8, borderBottom: `2px solid ${COLORS.primary}`, fontWeight: 700 }}>VAR</th>
                <th style={{ padding: 8, borderBottom: `2px solid ${COLORS.primary}`, fontWeight: 700 }}>DEV</th>
                <th style={{ padding: 8, borderBottom: `2px solid ${COLORS.primary}`, fontWeight: 700, background: '#eff6ff' }}>
                  WCA
                </th>
                <th style={{ padding: 8, borderBottom: `2px solid ${COLORS.primary}`, fontWeight: 700, background: '#eff6ff' }}>
                  TH
                </th>
                <th style={{ padding: 8, borderBottom: `2px solid ${COLORS.primary}`, fontWeight: 700, background: '#eff6ff' }}>
                  MH
                </th>
                <th style={{ padding: 8, borderBottom: `2px solid ${COLORS.primary}`, fontWeight: 700, background: '#eff6ff' }}>
                  CH
                </th>
                <th style={{ padding: 8, borderBottom: `2px solid ${COLORS.primary}`, fontWeight: 700, background: '#fef3c7' }}>
                  GS
                </th>
                <th style={{ padding: 8, borderBottom: `2px solid ${COLORS.primary}`, fontWeight: 700, background: '#fef3c7' }}>
                  ETE
                </th>
                <th style={{ padding: 8, borderBottom: `2px solid ${COLORS.primary}`, fontWeight: 700, background: '#fef3c7' }}>
                  FUEL
                </th>
                <th style={{ padding: 8, borderBottom: `2px solid ${COLORS.primary}`, fontWeight: 700 }}>REMARKS</th>
                <th className="no-print" style={{ padding: 8, borderBottom: `2px solid ${COLORS.primary}` }}></th>
              </tr>
            </thead>

            <tbody>
              {computed.rows.map((r, idx) => (
                <tr key={r.id} style={{ background: idx % 2 === 0 ? '#fff' : '#f9fafb' }}>
                  <td style={{ padding: 6, borderBottom: `1px solid ${COLORS.border}` }}>
                    <input
                      className="no-print"
                      value={r.checkpoint}
                      onChange={(e) => updateLeg(r.id, { checkpoint: e.target.value.toUpperCase() })}
                      style={{ ...cellInput, fontWeight: 700 }}
                      placeholder="WPT"
                    />
                    <span className="print-only" style={{ fontWeight: 700 }}>{r.checkpoint}</span>
                  </td>
                  <td style={{ padding: 6, borderBottom: `1px solid ${COLORS.border}` }}>
                    <input
                      className="no-print"
                      value={r.from}
                      onChange={(e) => updateLeg(r.id, { from: e.target.value.toUpperCase() })}
                      style={cellInput}
                    />
                    <span className="print-only">{r.from}</span>
                  </td>
                  <td style={{ padding: 6, borderBottom: `1px solid ${COLORS.border}` }}>
                    <input
                      className="no-print"
                      value={r.to}
                      onChange={(e) => updateLeg(r.id, { to: e.target.value.toUpperCase() })}
                      style={cellInput}
                    />
                    <span className="print-only">{r.to}</span>
                  </td>
                  <td style={{ padding: 6, borderBottom: `1px solid ${COLORS.border}` }}>
                    <input
                      className="no-print"
                      type="number"
                      value={r.altitude}
                      onChange={(e) => updateLeg(r.id, { altitude: e.target.value })}
                      style={cellInput}
                      placeholder={flightPlan.cruiseAlt}
                    />
                    <span className="print-only">{r.altitude || flightPlan.cruiseAlt}</span>
                  </td>
                  <td style={{ padding: 6, borderBottom: `1px solid ${COLORS.border}` }}>
                    <input
                      className="no-print"
                      type="number"
                      value={r.course}
                      onChange={(e) => updateLeg(r.id, { course: e.target.value })}
                      style={cellInput}
                    />
                    <span className="print-only">{r.course}</span>
                  </td>
                  <td style={{ padding: 6, borderBottom: `1px solid ${COLORS.border}` }}>
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
                  <td style={{ padding: 6, borderBottom: `1px solid ${COLORS.border}` }}>
                    <input
                      className="no-print"
                      type="number"
                      value={r.windDir}
                      onChange={(e) => updateLeg(r.id, { windDir: e.target.value })}
                      style={cellInput}
                      placeholder={tripWindDir}
                    />
                    <span className="print-only">{r.windDir || tripWindDir}</span>
                  </td>
                  <td style={{ padding: 6, borderBottom: `1px solid ${COLORS.border}` }}>
                    <input
                      className="no-print"
                      type="number"
                      value={r.windSpd}
                      onChange={(e) => updateLeg(r.id, { windSpd: e.target.value })}
                      style={cellInput}
                      placeholder={tripWindSpd}
                    />
                    <span className="print-only">{r.windSpd || tripWindSpd}</span>
                  </td>
                  <td style={{ padding: 6, borderBottom: `1px solid ${COLORS.border}` }}>
                    <div className="no-print" style={{ display: 'flex', gap: 4 }}>
                      <input
                        type="number"
                        step="0.1"
                        value={r.varDeg}
                        onChange={(e) => updateLeg(r.id, { varDeg: e.target.value })}
                        style={{ ...cellInput, width: 40 }}
                        placeholder={tripVarDeg}
                      />
                      <select
                        value={r.varDir}
                        onChange={(e) => updateLeg(r.id, { varDir: e.target.value as VarDir })}
                        style={{ ...cellInput, width: 35, padding: 2 }}
                      >
                        <option value="E">E</option>
                        <option value="W">W</option>
                      </select>
                    </div>
                    <span className="print-only">
                      {(r.varDeg || tripVarDeg) + (r.varDeg ? r.varDir : tripVarDir)}
                    </span>
                  </td>
                  <td style={{ padding: 6, borderBottom: `1px solid ${COLORS.border}` }}>
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
                  <td style={{ padding: 6, borderBottom: `1px solid ${COLORS.border}`, textAlign: 'right', background: '#eff6ff' }}>
                    {r.wca.toFixed(1)}°
                  </td>
                  <td style={{ padding: 6, borderBottom: `1px solid ${COLORS.border}`, textAlign: 'right', background: '#eff6ff' }}>
                    {r.th.toFixed(0)}°
                  </td>
                  <td style={{ padding: 6, borderBottom: `1px solid ${COLORS.border}`, textAlign: 'right', background: '#eff6ff' }}>
                    {r.mh.toFixed(0)}°
                  </td>
                  <td style={{ padding: 6, borderBottom: `1px solid ${COLORS.border}`, textAlign: 'right', background: '#eff6ff' }}>
                    {r.ch.toFixed(0)}°
                  </td>
                  <td style={{ padding: 6, borderBottom: `1px solid ${COLORS.border}`, textAlign: 'right', background: '#fef3c7' }}>
                    {r.gs.toFixed(0)}
                  </td>
                  <td style={{ padding: 6, borderBottom: `1px solid ${COLORS.border}`, textAlign: 'right', background: '#fef3c7' }}>
                    {r.eteMin.toFixed(0)}
                  </td>
                  <td style={{ padding: 6, borderBottom: `1px solid ${COLORS.border}`, textAlign: 'right', background: '#fef3c7' }}>
                    {r.fuelGal.toFixed(1)}
                  </td>
                  <td style={{ padding: 6, borderBottom: `1px solid ${COLORS.border}` }}>
                    <input
                      className="no-print"
                      value={r.remarks}
                      onChange={(e) => updateLeg(r.id, { remarks: e.target.value })}
                      style={{ ...cellInput, width: 120 }}
                      placeholder="Notes..."
                    />
                    <span className="print-only">{r.remarks}</span>
                  </td>
                  <td className="no-print" style={{ padding: 6, borderBottom: `1px solid ${COLORS.border}` }}>
                    {legs.length > 1 && (
                      <button
                        onClick={() => removeLeg(r.id)}
                        style={{
                          padding: '4px 8px',
                          background: '#fee2e2',
                          color: '#dc2626',
                          border: 'none',
                          borderRadius: 4,
                          cursor: 'pointer',
                          fontSize: 11,
                          fontWeight: 700,
                        }}
                      >
                        ×
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>

            <tfoot>
              <tr style={{ background: `${COLORS.primary}15` }}>
                <td colSpan={5} style={{ padding: 10, fontWeight: 900, borderTop: `2px solid ${COLORS.primary}` }}>
                  TOTALS
                </td>
                <td style={{ padding: 10, fontWeight: 900, textAlign: 'right', borderTop: `2px solid ${COLORS.primary}` }}>
                  {computed.totalDist.toFixed(1)}
                </td>
                <td colSpan={9} style={{ borderTop: `2px solid ${COLORS.primary}` }} />
                <td style={{ padding: 10, fontWeight: 900, textAlign: 'right', borderTop: `2px solid ${COLORS.primary}`, background: '#fef3c7' }}>
                  {formatTime(computed.totalMin)}
                </td>
                <td style={{ padding: 10, fontWeight: 900, textAlign: 'right', borderTop: `2px solid ${COLORS.primary}`, background: '#fef3c7' }}>
                  {computed.totalFuel.toFixed(1)}
                </td>
                <td colSpan={2} style={{ borderTop: `2px solid ${COLORS.primary}` }} />
              </tr>
            </tfoot>
          </table>
        </div>

        {/* Footer Info */}
        <div
          style={{
            padding: 12,
            background: '#f8fafc',
            borderTop: `1px solid ${COLORS.border}`,
            fontSize: 11,
            color: COLORS.textLight,
          }}
        >
          <div style={{ marginBottom: 4 }}>
            <strong>Legend:</strong> CKPT = Checkpoint • TC = True Course • WCA = Wind Correction Angle • TH = True
            Heading • MH = Magnetic Heading • CH = Compass Heading • GS = Ground Speed • ETE = Estimated Time Enroute
          </div>
          <div>
            <strong>Note:</strong> Verify all headings, winds, and performance with current charts and POH. This is a
            planning aid only.
          </div>
        </div>
      </div>

      {/* Print-only Flight Plan Summary */}
      <div className="print-only" style={{ marginTop: 20, pageBreakBefore: 'auto' }}>
        <div style={{ border: '2px solid #000', borderRadius: 8, padding: 16 }}>
          <h3 style={{ marginTop: 0, marginBottom: 12, fontSize: 16 }}>FLIGHT PLAN SUMMARY</h3>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontSize: 12 }}>
            <div>
              <strong>Aircraft Type:</strong> {flightPlan.aircraftType}
            </div>
            <div>
              <strong>Aircraft Ident:</strong> {flightPlan.aircraftIdent}
            </div>
            <div>
              <strong>Pilot:</strong> {flightPlan.pilotName}
            </div>
            <div>
              <strong>Departure:</strong> {flightPlan.departure}
            </div>
            <div>
              <strong>Destination:</strong> {flightPlan.destination}
            </div>
            <div>
              <strong>Route:</strong> {flightPlan.route}
            </div>
            <div>
              <strong>Cruise Altitude:</strong> {flightPlan.cruiseAlt} ft
            </div>
            <div>
              <strong>Departure Time:</strong> {flightPlan.departureTime}
            </div>
            <div>
              <strong>ETE:</strong> {flightPlan.ete}
            </div>
            <div>
              <strong>Fuel Onboard:</strong> {flightPlan.fuelOnboard} gal
            </div>
            <div>
              <strong>Total Distance:</strong> {computed.totalDist.toFixed(1)} nm
            </div>
            <div>
              <strong>Total Fuel Required:</strong> {computed.totalFuel.toFixed(1)} gal
            </div>
          </div>
        </div>
      </div>

      {/* Print Styles */}
      <style>{`
        @media print {
          .no-print {
            display: none !important;
          }
          .print-only {
            display: block !important;
          }
          @page {
            margin: 0.5in;
          }
        }
        @media screen {
          .print-only {
            display: none !important;
          }
        }
      `}</style>
    </div>
  );
}
