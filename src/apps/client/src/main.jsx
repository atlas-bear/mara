import React from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import App from './App';
import '@shared/components/print-styles.css';

// Note: We'll handle Mapbox telemetry issues differently to avoid readonly property errors

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)