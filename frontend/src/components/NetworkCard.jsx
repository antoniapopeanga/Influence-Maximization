import React, { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import '../css/NetworkCard.css';

const NetworkCard = ({ network }) => {
  const [showDetails, setShowDetails] = useState(false);

  const getDegreeDistributionData = () => {
    const { degree_distribution } = network;
    return degree_distribution
      .map((count, degree) => ({ degree, count }))
      .filter(item => item.count > 0)
      .slice(0, 30);
  };

  return (
    <div className="network-card">
      <div className="network-card-header">
        <h2 className="network-card-title">{network.name}</h2>
        
        <div className="network-stats-grid">
          <div className="stat-box blue">
            <p className="stat-label">Noduri</p>
            <p className="stat-value">{network.num_nodes}</p>
          </div>
          <div className="stat-box green">
            <p className="stat-label">Muchii</p>
            <p className="stat-value">{network.num_edges}</p>
          </div>
          <div className="stat-box purple">
            <p className="stat-label">Grad mediu</p>
            <p className="stat-value">{network.average_degree.toFixed(2)}</p>
          </div>
          <div className="stat-box yellow">
            <p className="stat-label">Coef. clustering</p>
            <p className="stat-value">{network.clustering_coeff.toFixed(3)}</p>
          </div>
        </div>

      </div>

      {showDetails && (
        <div className="network-card-details">
          <div className="chart-section">
            <h3 className="chart-title">Distribuția gradelor</h3>
            <div className="chart-container">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={getDegreeDistributionData()} margin={{ top: 5, right: 5, bottom: 20, left: 0 }}>
                  <XAxis dataKey="degree" label={{ value: 'Grad', position: 'bottom', offset: 0 }} />
                  <YAxis label={{ value: 'Frecvență', angle: -90, position: 'insideLeft' }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#4f46e5" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="network-metrics">
            <p>Densitatea rețelei: {(2 * network.num_edges / (network.num_nodes * (network.num_nodes - 1))).toFixed(4)}</p>
            <p>Raportul muchii/noduri: {(network.num_edges / network.num_nodes).toFixed(2)}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default NetworkCard;
