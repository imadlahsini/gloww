import React, { useState, useEffect } from 'react'
import ReactDOM from 'react-dom/client'
import SalonMenu from './App'
import AdminPanel from './Admin'
import './index.css'

function Router() {
  const [route, setRoute] = useState(window.location.hash);

  useEffect(() => {
    const onHash = () => setRoute(window.location.hash);
    window.addEventListener("hashchange", onHash);
    return () => window.removeEventListener("hashchange", onHash);
  }, []);

  if (route === "#admin") return <AdminPanel />;
  return <SalonMenu />;
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Router />
  </React.StrictMode>,
)
