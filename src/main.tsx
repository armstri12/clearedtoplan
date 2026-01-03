import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { FlightSessionProvider } from './context/FlightSessionContext';
import { AuthProvider } from './context/AuthContext';
import { FlightPlanProvider } from './stores/flightPlan';
import './print.css';


ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <FlightSessionProvider>
          <FlightPlanProvider>
            <App />
          </FlightPlanProvider>
        </FlightSessionProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
