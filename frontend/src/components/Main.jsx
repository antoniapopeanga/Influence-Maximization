import React, { useState } from 'react';
import { Modal, Button } from 'antd';
import Sidebar from './Sidebar';
import PreviewComponent from './PreviewComponent';
import axios from 'axios';
import '../css/Main.css';
import StatisticsComparison from './StatisticsComparison';
import { BarChartOutlined, LineChartOutlined } from '@ant-design/icons';
import InfluenceSpreadChart from './InfluenceSpreadChart';


const Main = () => {
  const [graphData, setGraphData] = useState(null);
  const [error, setError] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedAlgorithms, setSelectedAlgorithms] = useState([]);
  const [comparisonMode, setComparisonMode] = useState(false);
  const [isStatsModalOpen, setIsStatsModalOpen] = useState(false); // Modal state
  const [isChartsModalOpen, setIsChartsModalOpen] = useState(false);
  const [isShowingSavedRun, setIsShowingSavedRun] = useState(false);


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
          propagationProbability: parameters.propagationProbability,
          parameters: parameters[algorithm] || {}
        });
  
        console.log(`Algorithm: ${algorithm}`, response.data);
  
        responses[algorithm] = response.data;
      }
      
      setGraphData({
        nodes: responses[selectedAlgorithms[0]].nodes,
        edges: responses[selectedAlgorithms[0]].edges,
        algorithm_results: responses
      });
  
      console.log("Final algorithm results:", responses);
  
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
  

return (
  <div className="main-container">
    <div className="sidebar-container">
      <Sidebar onSubmit={handleSubmit} />
    </div>
    
    <div className="content-container">
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


      <div className="preview-wrapper">
        <PreviewComponent 
          graphData={graphData} 
          isLoading={isLoading}
          selectedAlgorithms={selectedAlgorithms}
          comparisonMode={comparisonMode}
          isShowingSavedRun={isShowingSavedRun}
          setIsShowingSavedRun={setIsShowingSavedRun}
        />

      </div>

        {/* Button container*/}
        {graphData&& !isShowingSavedRun && (
          <div className="action-buttons-container">
            <Button 
              type="primary" 
              onClick={() => setIsChartsModalOpen(true)}
              className="action-button"
              icon={<LineChartOutlined />}
            >
              Charts
            </Button>
            <Button 
              type="primary" 
              onClick={() => setIsStatsModalOpen(true)}
              className="action-button"
              icon={<BarChartOutlined />}
            >
              Stats
            </Button>
          </div>
        )}

        {/* Statistics Modal */}
        <Modal
          title="Algorithm Performance Comparison"
          open={isStatsModalOpen}
          onCancel={() => setIsStatsModalOpen(false)}
          footer={null}
          width="65%"
          centered
        >
          <StatisticsComparison algorithmResults={graphData?.algorithm_results} />
        </Modal>

        {/*Charts Modal */}
        <Modal
          title="Influence Spread Visualization"
          open={isChartsModalOpen}
          onCancel={() => setIsChartsModalOpen(false)}
          footer={null}
          width="65%"
          centered
          style={{ top: 20 }}
        >
          <InfluenceSpreadChart algorithmResults={graphData?.algorithm_results} />
        </Modal>
    </div>
  </div>
);
};

export default Main;