import type { ChangeEvent } from 'react';
import { useFlightPlan, useFlightPlanUpdater } from '../../../stores/flightPlan';
import { useNavigate } from 'react-router-dom';
import { TRIP_WIZARD_PATHS } from '../StepGuard';

export function BasicsStep() {
  const basics = useFlightPlan((state) => state.basics);
  const { updateBasics } = useFlightPlanUpdater();
  const navigate = useNavigate();

  const handleChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    const sanitized =
      name === 'departure' || name === 'destination'
        ? value.toUpperCase()
        : value;
    updateBasics({ [name]: sanitized });
  };

  return (
    <div className="wizard-section">
      <h3>Flight Basics</h3>
      <p className="wizard-helper">Fill in your core routing info to unlock weather and performance tools.</p>

      <div className="wizard-grid">
        <div className="wizard-field">
          <label htmlFor="title">Plan title</label>
          <input id="title" name="title" value={basics.title ?? ''} onChange={handleChange} placeholder="$100 burger run" />
        </div>
        <div className="wizard-field">
          <label htmlFor="pilot">Pilot</label>
          <input id="pilot" name="pilot" value={basics.pilot ?? ''} onChange={handleChange} placeholder="Pilot name" />
        </div>
        <div className="wizard-field">
          <label htmlFor="lessonType">Lesson type</label>
          <select id="lessonType" name="lessonType" value={basics.lessonType ?? ''} onChange={handleChange}>
            <option value="">Select</option>
            <option value="training">Training</option>
            <option value="checkride">Checkride Prep</option>
            <option value="xc">Cross-country</option>
            <option value="proficiency">Proficiency</option>
          </select>
        </div>
      </div>

      <div className="wizard-grid">
        <div className="wizard-field">
          <label htmlFor="departure">Departure</label>
          <input
            id="departure"
            name="departure"
            value={basics.departure ?? ''}
            onChange={handleChange}
            placeholder="KJYO"
          />
          <p className="wizard-helper">ICAO or airport code</p>
        </div>
        <div className="wizard-field">
          <label htmlFor="destination">Destination</label>
          <input
            id="destination"
            name="destination"
            value={basics.destination ?? ''}
            onChange={handleChange}
            placeholder="KHEF"
          />
        </div>
        <div className="wizard-field">
          <label htmlFor="route">Route</label>
          <input id="route" name="route" value={basics.route ?? ''} onChange={handleChange} placeholder="Direct or V routes" />
          <p className="wizard-helper">Required to continue</p>
        </div>
      </div>

      <div className="wizard-grid">
        <div className="wizard-field">
          <label htmlFor="departureTime">Departure time</label>
          <input
            id="departureTime"
            name="departureTime"
            type="datetime-local"
            value={basics.departureTime ?? ''}
            onChange={handleChange}
          />
          <p className="wizard-helper">UTC or local — be consistent with your weather brief</p>
        </div>
        <div className="wizard-field">
          <label htmlFor="etd">ETD</label>
          <input id="etd" name="etd" value={basics.etd ?? ''} onChange={handleChange} placeholder="2024-12-01T14:00" />
          <p className="wizard-helper">Keep a plain-text ETD for quick export</p>
        </div>
        <div className="wizard-field">
          <label htmlFor="eta">ETA</label>
          <input id="eta" name="eta" value={basics.eta ?? ''} onChange={handleChange} placeholder="2024-12-01T16:00" />
        </div>
      </div>

      <div className="wizard-grid">
        <div className="wizard-field">
          <label htmlFor="aircraftIdent">Aircraft</label>
          <input
            id="aircraftIdent"
            name="aircraftIdent"
            value={basics.aircraftIdent ?? ''}
            onChange={handleChange}
            placeholder="N12345"
          />
          <p className="wizard-helper">Syncs with aircraft selection, if loaded</p>
        </div>
        <div className="wizard-field">
          <label htmlFor="fuelPolicy">Fuel policy</label>
          <select id="fuelPolicy" name="fuelPolicy" value={basics.fuelPolicy ?? ''} onChange={handleChange}>
            <option value="">Select</option>
            <option value="full">Full fuel</option>
            <option value="tabs">Tabs / partial fuel</option>
            <option value="min-fuel">Minimum legal + reserve</option>
            <option value="custom">Custom / instructor brief</option>
          </select>
          <p className="wizard-helper">Document how you plan to launch</p>
        </div>
        <div className="wizard-field">
          <label htmlFor="notes">Notes</label>
          <textarea
            id="notes"
            name="notes"
            value={basics.notes ?? ''}
            onChange={handleChange}
            placeholder="Fuel receipt? Pattern direction? Passenger needs?"
          />
        </div>
      </div>

      <div className="wizard-summary-card">
        <div className="wizard-inline">
          <span className="wizard-chip">Route: {basics.route || 'Not set'}</span>
          <span className="wizard-chip">From: {basics.departure || '---'}</span>
          <span className="wizard-chip">To: {basics.destination || '---'}</span>
        </div>
        <button
          type="button"
          className="wizard-button primary"
          style={{ marginTop: 12 }}
          onClick={() => navigate(TRIP_WIZARD_PATHS.weather)}
          disabled={!basics.route || !basics.departure || !basics.destination}
        >
          Continue to Weather →
        </button>
      </div>
    </div>
  );
}
