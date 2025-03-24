import React, { useState } from 'react';
import '../css/Sidebar.css';

const Sidebar = ({ onSubmit }) => {
  const [datasets] = useState([
    'facebook 0', 'facebook 1', 'facebook 107', 'facebook 348', 
    'facebook 414', 'facebook 686', 'facebook 696', 'facebook 1684', 
    'facebook 1912', 'facebook 3437', 'facebook 3980'
  ]);
  
  const [diffusionModels] = useState([
    { value: 'linear_threshold', label: 'Linear Threshold (LT)' },
    { value: 'independent_cascade', label: 'Independent Cascade (IC)' }
  ]);
  
  const [algorithms] = useState([
    { value: 'classic_greedy', label: 'Classic Greedy' },
    { value: 'random_selection', label: 'Random Selection' },
    { value: 'degree_heuristic', label: 'Degree Heuristic' },
    { value: 'centrality_heuristic', label: 'Centrality Heuristic' },
    { value: 'celf', label: 'CEF' },
    { value: 'celf_plus', label: 'CELF++' }
  ]);

  const algorithmParameters = {
    classic_greedy: [
      { name: "seedSize", label: "Seed Set Size", type: "number", default: 5, min: 1, max: 50 },
      { name: "maxSteps", label: "Max Propagation Steps", type: "number", default: 5, min: 1, max: 10 }
    ],
    random_selection: [
      { name: "seedSize", label: "Number of Seeds", type: "number", default: 5, min: 1, max: 50 }
    ],
    degree_heuristic: [
      { name: "seedSize", label: "Number of Seeds", type: "number", default: 5, min: 1, max: 50 }
    ],
    centrality_heuristic: [
      { name: "seedSize", label: "Number of Seeds", type: "number", default: 5, min: 1, max: 50 }
    ],
    celf: [
      { name: "seedSize", label: "Number of Seeds", type: "number", default: 5, min: 1, max: 50 }
    ],
    celf_plus: [
      { name: "seedSize", label: "Number of Seeds", type: "number", default: 5, min: 1, max: 50 }
    ]
  };

  const [selectedDataset, setSelectedDataset] = useState('');
  const [selectedModel, setSelectedModel] = useState('');
  const [selectedAlgorithms, setSelectedAlgorithms] = useState([]);
  const [parameters, setParameters] = useState({});
  const [activeAlgorithm, setActiveAlgorithm] = useState(null);

  const handleDatasetChange = (event) => {
    setSelectedDataset(event.target.value);
  };

  const handleModelChange = (event) => {
    setSelectedModel(event.target.value);
  };

  const handleAlgorithmChange = (event) => {
    const value = event.target.value;
    const isChecked = event.target.checked;
    
    setSelectedAlgorithms(prev => 
      isChecked 
        ? [...prev, value]
        : prev.filter(alg => alg !== value)
    );
    
    // Set active algorithm for parameter display
    if (isChecked) {
      setActiveAlgorithm(value);
      // Initialize default parameters for this algorithm
      const defaultParams = {};
      algorithmParameters[value]?.forEach(param => {
        defaultParams[param.name] = param.default;
      });
      setParameters(prev => ({ ...prev, [value]: defaultParams }));
    }
  };

  const handleParamChange = (algorithm, name, value) => {
    setParameters(prev => ({
      ...prev,
      [algorithm]: {
        ...prev[algorithm],
        [name]: Number(value)  // Convert to number since inputs return strings
      }
    }));
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedDataset || !selectedModel || selectedAlgorithms.length === 0) {
      alert('Please select a dataset, model, and at least one algorithm');
      return;
    }
    
    // Prepare parameters for all selected algorithms
    const allParams = {};
    selectedAlgorithms.forEach(algorithm => {
      allParams[algorithm] = parameters[algorithm] || {};
    });
    
    onSubmit(selectedDataset, selectedModel, selectedAlgorithms, allParams);
  };

  return (
    <div className="sidebar">
      <h2>Control Panel</h2>
      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <h3>Select Dataset</h3>
          <select 
            onChange={handleDatasetChange} 
            value={selectedDataset}
            required
          >
            <option value="" disabled>Select Dataset</option>
            {datasets.map((dataset, index) => (
              <option key={index} value={dataset}>
                {dataset}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <h3>Diffusion Model</h3>
          <select 
            onChange={handleModelChange} 
            value={selectedModel}
            required
          >
            <option value="" disabled>Select Model</option>
            {diffusionModels.map((model, index) => (
              <option key={index} value={model.value}>
                {model.label}
              </option>
            ))}
          </select>
        </div>

        <div className="form-group">
          <h3>Select Algorithms (Multiple)</h3>
          <div className="algorithm-checkboxes">
            {algorithms.map((algorithm, index) => (
              <label key={index} className="checkbox-label">
                <input
                  type="checkbox"
                  value={algorithm.value}
                  checked={selectedAlgorithms.includes(algorithm.value)}
                  onChange={handleAlgorithmChange}
                />
                {algorithm.label}
              </label>
            ))}
          </div>
        </div>

        <div className="form-group">
          <h3>Algorithm Parameters</h3>
          {selectedAlgorithms.map(algorithm => (
            <div key={algorithm} className="algorithm-params">
              <h4>{algorithms.find(a => a.value === algorithm)?.label}</h4>
              {algorithmParameters[algorithm]?.map(param => (
                <div key={`${algorithm}-${param.name}`} className="param-control">
                  <label>{param.label}:</label>
                  <input
                    type={param.type}
                    value={parameters[algorithm]?.[param.name] ?? param.default}
                    min={param.min}
                    max={param.max}
                    onChange={(e) => handleParamChange(algorithm, param.name, e.target.value)}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>

        <button type="submit" className="submit-button">
          Run Comparison
        </button>
      </form>
    </div>
  );
};

export default Sidebar;