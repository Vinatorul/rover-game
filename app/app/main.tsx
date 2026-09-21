import React from 'react';
import { createRoot } from 'react-dom/client';
import { GameApp } from './components/game-app';
import './globals.css';
import './minimal.css';

const view = new URLSearchParams(window.location.search).get('view');
const mode = view === 'player' || view === 'screen' ? view : 'host';
createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <GameApp mode={mode} />
  </React.StrictMode>,
);
