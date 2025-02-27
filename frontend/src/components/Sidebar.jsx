import React, { useState } from 'react';

  const Sidebar = ({ onSubmit }) => {
    const [datasets] = useState(['facebook 0', 'facebook 107', 'facebook 348', 'facebook 414']);
    const [diffusionModels] = useState(['Linear Threshold', 'Independent Cascade']);
    const [algorithms] = useState(['Greedy', 'Random', 'CELF', 'Random Walk']);
  
    const [selectedDataset, setSelectedDataset] = useState('');
    const [selectedModel, setSelectedModel] = useState('');
    const [selectedAlgorithm, setSelectedAlgorithm] = useState('');
  
    // Handlers for input changes
    const handleDatasetChange = (event) => {
      setSelectedDataset(event.target.value);
    };
  
    const handleModelChange = (event) => {
      setSelectedModel(event.target.value);
    };
  
    const handleAlgorithmChange = (event) => {
      setSelectedAlgorithm(event.target.value);
    };
  
    // Function to handle the submit action
    const handleSubmit = () => {
      onSubmit(selectedDataset, selectedModel, selectedAlgorithm); // Pass data to Main component
    };
  
    return (
      <div style={{ padding: '20px', width: '250px', backgroundColor: '#2c3e50', color: 'white' }}>
        <h2 style={{ textAlign: 'center', marginBottom: '20px' }}>Control Panel</h2>
  
        <div>
          <h3>Select Dataset</h3>
          <select onChange={handleDatasetChange} value={selectedDataset}>
            <option value="" disabled>Select Dataset</option>
            {datasets.map((dataset, index) => (
              <option key={index} value={dataset}>{dataset}</option>
            ))}
          </select>
        </div>
  
        <div>
          <h3>Select Diffusion Model</h3>
          <select onChange={handleModelChange} value={selectedModel}>
            <option value="" disabled>Select Model</option>
            {diffusionModels.map((model, index) => (
              <option key={index} value={model}>{model}</option>
            ))}
          </select>
        </div>
  
        <div>
          <h3>Select Influence Maximization Algorithm</h3>
          <select onChange={handleAlgorithmChange} value={selectedAlgorithm}>
            <option value="" disabled>Select Algorithm</option>
            {algorithms.map((algorithm, index) => (
              <option key={index} value={algorithm}>{algorithm}</option>
            ))}
          </select>
        </div>
  
        <button onClick={handleSubmit} style={{ marginTop: '20px', padding: '10px' }}>
          Run Algorithm
        </button>
      </div>
    );
  };
  
  export default Sidebar;
  