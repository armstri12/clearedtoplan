import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { FlightPlanProvider } from './stores/flightPlan';
import './print.css';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <FlightPlanProvider>
        <App />
      </FlightPlanProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
