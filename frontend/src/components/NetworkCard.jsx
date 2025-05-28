import React, { useState } from 'react';
import { Bar } from 'react-chartjs-2';
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from 'chart.js';
import '../css/NetworkCard.css';
import networkLabels from '../utils/networkLabels';
import networkDescriptions from '../utils/networksDescription';


// Register Chart.js components
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

const NetworkCard = ({ network }) => {
  const [showDetails, setShowDetails] = useState(false);

  const getDegreeDistributionData = () => {
    const { degree_distribution } = network;
    return degree_distribution
      .map((count, degree) => ({ degree, count }))
      .filter(item => item.count > 0)
      .slice(0, 30);
  };

  // Prepare Chart.js data
  const chartData = {
    labels: getDegreeDistributionData().map(item => item.degree),
    datasets: [
      {
        label: 'Frequency',
        data: getDegreeDistributionData().map(item => item.count),
        backgroundColor: '#4f46e5',
        borderColor: '#4f46e5',
        borderWidth: 1,
      },
    ],
  };

 const chartOptions = {
  responsive: true,
  maintainAspectRatio: false, // This is crucial for fixed height containers
  plugins: {
    legend: {
      display: false,
    },
    tooltip: {
      callbacks: {
        label: (context) => `Degree ${context.label}: ${context.raw}`,
      },
    },
  },
  scales: {
    x: {
      title: {
        display: true,
        text: 'Degree',
      },
    },
    y: {
      title: {
        display: true,
        text: 'Frequency',
      },
      beginAtZero: true,
    },
  },
};

  const imagePath = `/networks/${network.name}.jpg`;

  return (
    <div className="network-card">
      <div className="network-card-header">
        <h2 className="network-card-title">
          {networkLabels[network.name] || network.name}
        </h2>
        {!showDetails && (
          <img
            src={imagePath}
            alt={`Vizualizare pentru ${network.name}`}
            className="network-card-image"
          />
        )}
        <button 
          className="details-button"
          onClick={() => setShowDetails(!showDetails)}
        >
          {showDetails ? 'Hide details' : 'Show details'}
        </button>
      </div>

      {showDetails && (
        <div className="network-card-details">
          {networkDescriptions[network.name] && (
              <p className="network-description">
                  <strong>Description: </strong>{networkDescriptions[network.name]}
              </p>
          )}
          <div className="network-stats-grid">

            <div className="stat-box blue">
              <p className="stat-label">Nodes</p>
              <p className="stat-value">{network.num_nodes}</p>
            </div>
            <div className="stat-box green">
              <p className="stat-label">Edges</p>
              <p className="stat-value">{network.num_edges}</p>
            </div>
            <div className="stat-box purple">
              <p className="stat-label">Average Degree</p>
              <p className="stat-value">{network.average_degree.toFixed(2)}</p>
            </div>
            <div className="stat-box yellow">
              <p className="stat-label">Clustering coef.</p>
              <p className="stat-value">{network.clustering_coeff.toFixed(3)}</p>
            </div>
          </div>

            <div className="chart-section">
              <h3 className="chart-title">Degree distribution</h3>
              <div className="chart-container">
                <Bar data={chartData} options={chartOptions} />
              </div>
            </div>

          <div className="network-metrics">
            <p><strong>Network density: </strong> {(2 * network.num_edges / (network.num_nodes * (network.num_nodes - 1))).toFixed(4)}</p>
            <p><strong>Nodes to edges ratio: </strong> {(network.num_edges / network.num_nodes).toFixed(2)}</p>
          </div>
        </div>
      )}
    </div>
  );
};

export default NetworkCard;