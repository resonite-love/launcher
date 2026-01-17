import React from 'react';
import ReactDOM from 'react-dom/client';
import LogViewerApp from './components/LogViewerApp';
import './index.css';
import './i18n';

ReactDOM.createRoot(document.getElementById('root') as HTMLElement).render(
  <React.StrictMode>
    <LogViewerApp />
  </React.StrictMode>
);
