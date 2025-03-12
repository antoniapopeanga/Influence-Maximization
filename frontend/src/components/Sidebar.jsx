import React, { useState } from 'react';

  const Sidebar = ({ onSubmit }) => {
    const [datasets] = useState(['facebook 0', 'facebook 1','facebook 107', 'facebook 348', 'facebook 414','facebook 686','facebook 696','facebook 1684','facebook 1912', 'facebook 3437', 'facebook 3980']);
    const [diffusionModels] = useState(['linear_threshold', 'independent_cascade']);
    const [algorithms] = useState(['greedy', 'random_selection', 'CELF', 'Random Walk']);
  
    const [selectedDataset, setSelectedDataset] = useState('');
    const [selectedModel, setSelectedModel] = useState('');
    const [selectedAlgorithm, setSelectedAlgorithm] = useState('');
  

    const handleDatasetChange = (event) => {
      setSelectedDataset(event.target.value);
    };
  
    const handleModelChange = (event) => {
      setSelectedModel(event.target.value);
    };
  
    const handleAlgorithmChange = (event) => {
      setSelectedAlgorithm(event.target.value);
    };
  

    //transmite selectiile userului la componenta Main
    const handleSubmit = () => {
      console.log("Dataset:", selectedDataset);
      console.log("Model:", selectedModel);
      console.log("Algorithm:", selectedAlgorithm);
      onSubmit(selectedDataset, selectedModel, selectedAlgorithm); 
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
          Preview network
        </button>
      </div>
    );
  };
  
  export default Sidebar;
  