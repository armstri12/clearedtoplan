import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import App from './App';
import { FlightSessionProvider } from './context/FlightSessionContext';
import './print.css';


ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <BrowserRouter>
      <FlightSessionProvider>
        <App />
      </FlightSessionProvider>
    </BrowserRouter>
  </React.StrictMode>,
);
