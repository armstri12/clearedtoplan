import { useMemo, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { buildBriefingMarkdown, buildPrintableSections, type BriefingSnapshot } from '../../../lib/briefing/export';
import { downloadElementAsPdf } from '../../../lib/briefing/pdf';
import { useFlightPlan, useFlightPlanUpdater } from '../../../stores/flightPlan';
import { TRIP_WIZARD_PATHS } from '../StepGuard';

export function ExportBriefStep() {
  const navigate = useNavigate();
  const { updateBrief } = useFlightPlanUpdater();
  const printRef = useRef<HTMLDivElement | null>(null);
  const [copyStatus, setCopyStatus] = useState<'idle' | 'copied' | 'error'>('idle');
  const [pdfStatus, setPdfStatus] = useState<'idle' | 'working' | 'error'>('idle');

  const snapshot = useFlightPlan<BriefingSnapshot>((state) => ({
    basics: state.basics,
    weather: state.weather,
    performance: state.performance,
    loading: state.loading,
    brief: state.brief,
  }));

  const sections = useMemo(() => buildPrintableSections(snapshot), [snapshot]);
  const markdown = useMemo(() => buildBriefingMarkdown(snapshot), [snapshot]);
  const subtitle = snapshot.brief.summary || `Route: ${snapshot.basics.departure ?? '---'} → ${snapshot.basics.destination ?? '---'}`;

  const handleCopyMarkdown = async () => {
    try {
      await navigator.clipboard.writeText(markdown);
      updateBrief({ summary: subtitle, exportReadyText: markdown });
      setCopyStatus('copied');
      setTimeout(() => setCopyStatus('idle'), 1500);
    } catch (error) {
      console.error(error);
      setCopyStatus('error');
    }
  };

  const handleDownloadPdf = async () => {
    if (!printRef.current) return;
    setPdfStatus('working');
    try {
      await downloadElementAsPdf(printRef.current, `${snapshot.basics.title || 'flight-brief'}.pdf`);
      setPdfStatus('idle');
    } catch (error) {
      console.error(error);
      setPdfStatus('error');
    }
  };

  const handlePrint = () => {
    updateBrief({ summary: subtitle, exportReadyText: markdown });
    window.print();
  };

  const renderEditCard = (
    title: string,
    description: string,
    onEdit: () => void,
    chips: Array<string | null>,
  ) => (
    <div className="briefing-edit-card no-print">
      <div className="wizard-inline" style={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <div style={{ fontWeight: 800, color: '#0f172a' }}>{title}</div>
          <div className="wizard-helper">{description}</div>
        </div>
        <button type="button" className="wizard-button secondary" onClick={onEdit}>
          Edit
        </button>
      </div>
      <div className="wizard-inline" style={{ marginTop: 8 }}>
        {chips.filter((chip): chip is string => Boolean(chip)).map((chip) => (
          <span key={chip} className="wizard-chip">
            {chip}
          </span>
        ))}
      </div>
    </div>
  );

  return (
    <div className="wizard-section">
      <h3>Export & Brief</h3>
      <p className="wizard-helper">
        Aggregate your plan into a print- and clipboard-ready brief. Edits flow from each step, so tap an edit link if something looks off.
      </p>

      <div className="briefing-actions no-print">
        <div className="wizard-inline" style={{ flexWrap: 'wrap' }}>
          <span className="wizard-chip">Audience: {snapshot.brief.audience ?? 'pilot'}</span>
          <span className="wizard-chip">Route: {snapshot.basics.route || '---'}</span>
          <span className="wizard-chip">Updated: {snapshot.brief.updatedAt ? new Date(snapshot.brief.updatedAt).toLocaleString() : '---'}</span>
        </div>
        <div className="wizard-inline" style={{ gap: 8, flexWrap: 'wrap' }}>
          <button type="button" className="wizard-button secondary" onClick={handleCopyMarkdown}>
            {copyStatus === 'copied' ? 'Copied!' : 'Copy Markdown'}
          </button>
          <button
            type="button"
            className="wizard-button secondary"
            onClick={handleDownloadPdf}
            disabled={pdfStatus === 'working'}
          >
            {pdfStatus === 'working' ? 'Building PDF...' : 'Download PDF'}
          </button>
          <button type="button" className="wizard-button primary" onClick={handlePrint}>
            Print Brief
          </button>
        </div>
      </div>

      <div className="briefing-edit-grid">
        {renderEditCard(
          'Basics',
          'Route, crew, timing',
          () => navigate(TRIP_WIZARD_PATHS.basics),
          [
            snapshot.basics.departure && snapshot.basics.destination
              ? `${snapshot.basics.departure} → ${snapshot.basics.destination}`
              : null,
            snapshot.basics.route || null,
            snapshot.basics.etd ? `ETD ${snapshot.basics.etd}` : snapshot.basics.departureTime ? `ETD ${snapshot.basics.departureTime}` : null,
          ],
        )}
        {renderEditCard(
          'Weather & NOTAMs',
          'METAR, TAF, notes',
          () => navigate(TRIP_WIZARD_PATHS.weather),
          [
            snapshot.weather.departure.metar?.flight_category
              ? `DEP ${snapshot.weather.departure.metar.flight_category}`
              : snapshot.weather.departure.icao || null,
            snapshot.weather.destination.metar?.flight_category
              ? `DEST ${snapshot.weather.destination.metar.flight_category}`
              : snapshot.weather.destination.icao || null,
            snapshot.weather.briefingNotes || null,
          ],
        )}
        {renderEditCard(
          'Performance & Loading',
          'Runway & weight corrections',
          () => navigate(TRIP_WIZARD_PATHS.performance),
          [
            snapshot.performance.takeoff?.results
              ? `TO 50 ft: ${snapshot.performance.takeoff.results.over50ft.toLocaleString()} ft`
              : null,
            snapshot.performance.landing?.results
              ? `LDG 50 ft: ${snapshot.performance.landing.results.over50ft.toLocaleString()} ft`
              : null,
            snapshot.loading.takeoffWeight ? `TO WT: ${snapshot.loading.takeoffWeight} lb` : null,
          ],
        )}
      </div>

      <div className="briefing-printable print-card" ref={printRef}>
        <div className="briefing-printable__header">
          <div>
            <p className="briefing-eyebrow">Flight brief</p>
            <h4>{snapshot.basics.title || 'Flight Brief'}</h4>
            <p className="wizard-helper" style={{ marginTop: 4 }}>{subtitle}</p>
          </div>
          <div className="briefing-meta">
            <span className="wizard-chip">Pilot: {snapshot.basics.pilot || '---'}</span>
            <span className="wizard-chip">Aircraft: {snapshot.basics.aircraftIdent || snapshot.basics.aircraftType || '---'}</span>
          </div>
        </div>

        <div className="briefing-section-grid">
          {sections.map((section) => (
            <div key={section.title} className="briefing-card print-card">
              <p className="briefing-card__title">{section.title}</p>
              <dl className="briefing-list">
                {section.rows.map((row) => (
                  <div key={row.label} className="briefing-list__row">
                    <dt>{row.label}</dt>
                    <dd>{row.value}</dd>
                  </div>
                ))}
              </dl>
            </div>
          ))}
        </div>
      </div>

      {copyStatus === 'error' && (
        <p className="wizard-helper" style={{ color: '#b91c1c' }}>
          Clipboard was blocked. Try again after granting permission.
        </p>
      )}

      {pdfStatus === 'error' && (
        <p className="wizard-helper" style={{ color: '#b91c1c' }}>
          Unable to generate a PDF from this browser. Printing will still work.
        </p>
      )}
    </div>
  );
}
