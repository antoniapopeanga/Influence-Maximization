import React, { useState, useEffect } from 'react';
import NetworkCard from './NetworkCard';
import '../css/NetworksPage.css';

const NetworksPage = () => {
  const [networks, setNetworks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    const fetchNetworks = async () => {
      try {
        const response = await fetch('http://127.0.0.1:5000/datasets-info');
        if (!response.ok) {
          throw new Error('Network response was not ok');
        }
        const data = await response.json();
        setNetworks(data.datasets);
        setLoading(false);
      } catch (error) {
        setError('Error fetching networks data: ' + error.message);
        setLoading(false);
      }
    };

    fetchNetworks();
  }, []);

  if (loading) {
    return (
      <div className="networks-loading-container">
        <div className="networks-loading-box">
          <div className="loading-spinner"></div>
          <p className="loading-text">Se încarcă datele rețelelor...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="networks-error-container">
        <div className="networks-error-box">
          <div className="error-icon">⚠️</div>
          <p className="error-message">{error}</p>
          <button className="retry-button" onClick={() => window.location.reload()}>
            Încearcă din nou
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="networks-page">
      <div className="networks-content">
        <div className="networks-header">
          <h1 className="networks-title">Statistici rețele de grafuri</h1>
          <p className="networks-subtitle">
            Vizualizează și analizează datele despre rețelele de grafuri
          </p>
        </div>

        <div className="networks-grid">
          {networks.map((network) => (
            <NetworkCard key={network.id} network={network} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default NetworksPage;
