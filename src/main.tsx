import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { FlightSessionProvider } from './context/FlightSessionContext';
import { AuthProvider } from './context/AuthContext';
import { AircraftProvider } from './context/AircraftContext';
import './print.css';


ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <AircraftProvider>
          <FlightSessionProvider>
            <App />
          </FlightSessionProvider>
        </AircraftProvider>
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
