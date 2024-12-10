import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import './index.css';

// Unmount existing React app
if (window.marsDashboard) {
  console.log('Unmounting existing React app');
  window.marsDashboard.unmount();
}

const root = ReactDOM.createRoot(document.getElementById('mars-dashboard'));
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
window.marsDashboard = root;
