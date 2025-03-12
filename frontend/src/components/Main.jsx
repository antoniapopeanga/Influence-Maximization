import React, { useState } from 'react';
import Sidebar from './Sidebar';
import PreviewComponent from './PreviewComponent';
import axios from 'axios';

const Main = () => {
  const [graphData, setGraphData] = useState(null);
  const [error, setError] = useState(null);

  //trimitem selectiile utilizatorului catre backend
  const handleSubmit = async (selectedDataset, selectedModel, selectedAlgorithm) => {

    setGraphData(null);
    setError(null);

    try {
      const response = await axios.post("http://localhost:5000/run-algorithm", {
        dataset: selectedDataset,
        model: selectedModel,
        algorithm: selectedAlgorithm
      });

      
      setGraphData(response.data);
    } catch (error) {
      console.error("Error running the algorithm:", error.response?.data || error.message);
      

      setError({
        message: error.response?.data?.error || "An unexpected error occurred",
        details: error.response?.data || null
      });
    }
  };

  return (
    <div style={{ display: 'flex', height: '100vh' }}>
      <Sidebar onSubmit={handleSubmit} />

      {error && (
        <div style={{ 
          position: 'fixed', 
          zIndex: 1000 
        }}>
          <h3>Error: {error.message}</h3>
          {error.details && (
            <pre style={{ 
              overflowX: 'auto' 
            }}>
              {JSON.stringify(error.details, null, 2)}
            </pre>
          )}
        </div>
      )}
      <PreviewComponent graphData={graphData} />
    </div>
  );
};

export default Main;