import type { ChangeEvent } from 'react';
import { useFlightPlan, useFlightPlanUpdater } from '../../../stores/flightPlan';

export function ExportStep() {
  const brief = useFlightPlan((state) => state.brief);
  const basics = useFlightPlan((state) => state.basics);
  const { updateBrief } = useFlightPlanUpdater();

  const handleChange = (event: ChangeEvent<HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    updateBrief({ [name]: value });
  };

  return (
    <div className="wizard-section">
      <h3>Export & Brief</h3>
      <p className="wizard-helper">Polish your summary, choose audience tone, and capture export-ready text.</p>

      <div className="wizard-grid">
        <div className="wizard-field">
          <label htmlFor="audience">Audience</label>
          <select id="audience" name="audience" value={brief.audience ?? 'pilot'} onChange={handleChange}>
            <option value="pilot">Pilot</option>
            <option value="student">Student</option>
            <option value="instructor">Instructor</option>
          </select>
          <p className="wizard-helper">Adjusts tone for your briefing copy.</p>
        </div>
        <div className="wizard-field">
          <label htmlFor="summary">Summary</label>
          <textarea
            id="summary"
            name="summary"
            value={brief.summary ?? ''}
            onChange={handleChange}
            placeholder="Route: ..." 
          />
        </div>
      </div>

      <div className="wizard-field">
        <label htmlFor="exportReadyText">Export-ready text</label>
        <textarea
          id="exportReadyText"
          name="exportReadyText"
          value={brief.exportReadyText ?? ''}
          onChange={handleChange}
          placeholder="Paste into email, clipboard, or EFB notes"
        />
      </div>

      <div className="wizard-summary-card">
        <p style={{ margin: 0, fontWeight: 700 }}>Final snapshot</p>
        <div className="wizard-inline" style={{ marginTop: 8 }}>
          <span className="wizard-chip">From: {basics.departure || '---'}</span>
          <span className="wizard-chip">To: {basics.destination || '---'}</span>
          <span className="wizard-chip">Route: {basics.route || '---'}</span>
        </div>
      </div>
    </div>
  );
}
