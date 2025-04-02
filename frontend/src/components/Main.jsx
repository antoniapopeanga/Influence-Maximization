import React, { useState } from 'react';
import { Modal, Button } from 'antd'; // Import Modal and Button from Ant Design
import Sidebar from './Sidebar';
import PreviewComponent from './PreviewComponent';
import axios from 'axios';
import '../css/Main.css';
import StatisticsComparison from './StatisticsComparison';
import { BarChartOutlined } from '@ant-design/icons';

const Main = () => {
  const [graphData, setGraphData] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedAlgorithms, setSelectedAlgorithms] = useState([]);
  const [comparisonMode, setComparisonMode] = useState(false);
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false); // Modal state

  const handleSubmit = async (selectedDataset, selectedModel, selectedAlgorithms, parameters) => {
    setGraphData(null);
    setError(null);
    setIsLoading(true);
    setSelectedAlgorithms(selectedAlgorithms);
    
    try {
      const responses = {};
      for (const algorithm of selectedAlgorithms) {
        const response = await axios.post("http://localhost:5000/run-algorithm", {
          dataset: selectedDataset,
          model: selectedModel,
          algorithm: algorithm,
          parameters: parameters[algorithm] || {}
        });
        responses[algorithm] = response.data;
      }
      
      setGraphData({
        nodes: responses[selectedAlgorithms[0]].nodes,
        edges: responses[selectedAlgorithms[0]].edges,
        algorithm_results: responses
      });
    } catch (error) {
      console.error("Error running the algorithm:", error.response?.data || error.message);
      setError({
        message: error.response?.data?.error || "An unexpected error occurred",
        details: error.response?.data || null
      });
    } finally {
      setIsLoading(false);
    }
  };

// Main.js (updated return section)
return (
  <div className="main-container">
    <div className="sidebar-container">
      <Sidebar onSubmit={handleSubmit} />
    </div>
    
    <div className="content-container">
        {/* Display error message if there is an error */}
        {error && (
          <div className="error-container">
            <h3>Error: {error.message}</h3>
            {error.details && (
              <pre className="error-details">
                {JSON.stringify(error.details, null, 2)}
              </pre>
            )}
          </div>
        )}

        {/* Loading Spinner */}
        {isLoading && (
          <div className="loading-overlay">
            <div className="spinner"></div>
            <p>Loading graph...</p>
          </div>
        )}


      {/* PreviewComponent now wrapped in a dedicated div */}
      <div className="preview-wrapper">
        <PreviewComponent 
          graphData={graphData} 
          isLoading={isLoading}
          selectedAlgorithms={selectedAlgorithms}
          comparisonMode={comparisonMode}
        />

      </div>

      {/* Fixed position stats button */}
      {graphData && (
        <div className="stats-button-container">
          <Button 
            type="primary" 
            onClick={() => setIsStatsModalOpen(true)}
            className="stats-button"
            icon={<BarChartOutlined />}
          >
            Stats
          </Button>
        </div>
      )}

      {/* Modal (unchanged) */}
      <Modal
        title="Algorithm Performance Comparison"
        open={isStatsModalOpen}
        onCancel={() => setIsStatsModalOpen(false)}
        footer={null}
        width="80%"
        centered
      >
        <StatisticsComparison algorithmResults={graphData?.algorithm_results} />
      </Modal>
    </div>
  </div>
);
};

export default Main;