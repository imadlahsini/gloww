import React, { useState, useEffect, lazy, Suspense } from 'react'
import ReactDOM from 'react-dom/client'
import SalonMenu from './App'
import './index.css'

const AdminPanel = lazy(() => import('./Admin'))

function Router() {
  const [route, setRoute] = useState(window.location.hash);

  useEffect(() => {
    const onHash = () => setRoute(window.location.hash);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  if (route === "#admin") {
    return (
      <Suspense fallback={<div style={{ height: '100vh', background: '#000' }} />}>
        <AdminPanel />
      </Suspense>
    );
  }
  return <SalonMenu />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Router />
  </React.StrictMode>,
)
