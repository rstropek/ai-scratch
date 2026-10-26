// TEMPORARY (Digitalferien 2026): the event page at /digiferien-2026-live (src/server/live.ts).
import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '../index.css';
import './live.css';
import { LiveApp } from './LiveApp.tsx';

const root = document.getElementById('root');
if (!root) throw new Error('#root missing');
createRoot(root).render(
  <StrictMode>
    <LiveApp />
  </StrictMode>,
);
