import React, { useState } from 'react';
import Sidebar from './Sidebar';
import PreviewComponent from './PreviewComponent';
import axios from 'axios';

const Main = () => {
  const [graphData, setGraphData] = useState(null);

  // Function to handle the submission of the selected options (dataset, model, algorithm)
  const handleSubmit = async (selectedDataset, selectedModel, selectedAlgorithm) => {
    try {
      const response = await axios.post("http://localhost:5000/run-algorithm", {
        dataset: selectedDataset,
        model: selectedModel,
        algorithm: selectedAlgorithm
      });

      // Pass the result back to the graphData state
      setGraphData(response.data);
    } catch (error) {
      console.error("Error running the algorithm:", error);
    }
  };

  return (
    <div style={{ display: 'flex' }}>
      {/* Sidebar component */}
      <Sidebar onSubmit={handleSubmit} />

      {/* PreviewComponent to display the graph */}
      <PreviewComponent graphData={graphData} />
    </div>
  );
};

export default Main;
