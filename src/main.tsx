import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './app.css';

const rootElement = document.getElementById('root');

if (!rootElement) {
  throw new Error('FNDRY Price Widget: Root element with id "root" not found. Ensure your HTML contains <div id="root"></div>.');
}

ReactDOM.createRoot(rootElement).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
