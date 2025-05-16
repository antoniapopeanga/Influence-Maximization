import React, { useState } from 'react';
import '../css/Sidebar.css';

const Sidebar = ({ onSubmit }) => {
const [datasets] = useState([
  { value: 'facebook 0', label: 'Facebook ego node 0' },
  { value: 'facebook 107', label: 'Facebook ego node 107' },
  { value: 'facebook 348', label: 'Facebook ego node 348' },
  { value: 'facebook 686', label: 'Facebook ego node 686' },
  { value: 'facebook 1684', label: 'Facebook ego node 1684' },
  { value: 'facebook 1912', label: 'Facebook ego node 1912' },
  { value: 'facebook 3437', label: 'Facebook ego node 3437' },
  { value: 'filmtrust 875', label: 'FilmTrust Project' },
  { value: 'pol_blogs 1225', label: 'Political Blogs' },
  { value: 'email 1006', label: 'Research Institution Email' },
  { value: 'physicians 242', label: 'Physician Trust Network' },
  { value: 'email_TarragonaUni 1134', label: 'Tarragona University Email' }
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
    { value: 'celf', label: 'CELF' },
  ]);

  const algorithmParameters = {
    classic_greedy: [
      { name: "seedSize", label: "Seed Set Size", type: "checkbox-group", options: [3, 5, 10, 15, 20] },
    ],
    random_selection: [
      { name: "seedSize", label: "Number of Seeds", type: "checkbox-group", options: [3, 5, 10, 15, 20] }
    ],
    degree_heuristic: [
      { name: "seedSize", label: "Number of Seeds", type: "checkbox-group", options: [3, 5, 10, 15, 20] }
    ],
    centrality_heuristic: [
      { name: "seedSize", label: "Number of Seeds", type: "checkbox-group", options: [3, 5, 10, 15, 20] }
    ],
    celf: [
      { name: "seedSize", label: "Number of Seeds", type: "checkbox-group", options: [3, 5, 10, 15, 20] }
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
    
    if (isChecked) {
      setActiveAlgorithm(value);
      const defaultParams = {};
      algorithmParameters[value]?.forEach(param => {
        if (param.type === "checkbox-group") {
          defaultParams[param.name] = [];
        } else {
          defaultParams[param.name] = param.default;
        }
      });
      setParameters(prev => ({ ...prev, [value]: defaultParams }));
    }
  };

  const handleParamChange = (algorithm, name, value) => {
    setParameters(prev => ({
      ...prev,
      [algorithm]: {
        ...prev[algorithm],
        [name]: value
      }
    }));
  };

  const handleCheckboxChange = (algorithm, paramName, optionValue, isChecked) => {
    const currentValues = parameters[algorithm]?.[paramName] || [];
    let newValues;
    
    if (isChecked) {
      newValues = [...currentValues, optionValue];
    } else {
      newValues = currentValues.filter(val => val !== optionValue);
    }
    
    if (newValues.length === 0) {
      newValues = [algorithmParameters[algorithm].find(p => p.name === paramName).options[0]];
    }
    
    handleParamChange(algorithm, paramName, newValues);
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    if (!selectedDataset || !selectedModel || selectedAlgorithms.length === 0) {
      alert('Please select a dataset, model, and at least one algorithm');
      return;
    }
    
    const allParams = {};
    selectedAlgorithms.forEach(algorithm => {
      allParams[algorithm] = parameters[algorithm] || {};
    });
    
    onSubmit(selectedDataset, selectedModel, selectedAlgorithms, allParams);
  };

  return (
    <div className="sidebar">
      <div className="sidebar-content">
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
                <option key={index} value={dataset.value}>
                  {dataset.label}
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
                    {param.type === "checkbox-group" ? (
                      <div className="checkbox-group">
                        {param.options.map(option => (
                          <label key={option} className="checkbox-label">
                            <input
                              type="checkbox"
                              checked={parameters[algorithm]?.[param.name]?.includes(option) || false}
                              onChange={(e) => handleCheckboxChange(
                                algorithm,
                                param.name,
                                option,
                                e.target.checked
                              )}
                            />
                            {option}
                          </label>
                        ))}
                      </div>
                    ) : (
                      <input
                        type={param.type}
                        value={parameters[algorithm]?.[param.name] ?? param.default}
                        min={param.min}
                        max={param.max}
                        onChange={(e) => handleParamChange(algorithm, param.name, Number(e.target.value))}
                      />
                    )}
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
    </div>
  );
};

export default Sidebar;