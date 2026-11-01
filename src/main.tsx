import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import 'leaflet/dist/leaflet.css';
import App from './App.tsx';
import { AppErrorBoundary } from './components/AppErrorBoundary';
import { startTelemetry } from './lib/telemetry';

// לוגים של תקופת ההרצה (01/11/2026): לפני הציור, כדי שגם קריסה בטעינה תירשם.
startTelemetry();

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </StrictMode>
);
