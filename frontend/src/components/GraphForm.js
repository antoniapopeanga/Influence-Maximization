import React, { useState } from 'react';
import axios from 'axios';

const GraphForm = () => {
  const [graph, setGraph] = useState('');
  const [algorithm, setAlgorithm] = useState('random');
  const [result, setResult] = useState(null);
  const [graphError, setGraphError] = useState(null);

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    
    // Validate the graph input as JSON when submitting
    let parsedGraph;
    try {
      parsedGraph = JSON.parse(graph);  // Try parsing the graph input
    } catch (error) {
      setGraphError('Invalid JSON input');  // Set an error message if the JSON is invalid
      return;  // Stop the form submission if JSON is invalid
    }

    // Send request to Node.js backend only if the graph is valid
    try {
      const response = await axios.post('http://localhost:3000/trigger-algorithm', {
        graph: parsedGraph,
        algorithm: algorithm
      });

      setResult(response.data);  // Set result to display
      setGraphError(null);  // Clear any previous errors
    } catch (error) {
      console.error('Error during request:', error);
    }
  };

  return (
    <div>
      <h2>Run Algorithm</h2>
      <form onSubmit={handleSubmit}>
        <label>
          Graph (e.g., [[1, 2], [2, 3], [3, 4]]):
          <input
            type="text"
            value={graph}
            onChange={(e) => setGraph(e.target.value)}
          />
        </label>
        <br />
        {graphError && <div style={{ color: 'red' }}>{graphError}</div>}  {/* Show error message if JSON is invalid */}
        <label>
          Algorithm:
          <select value={algorithm} onChange={(e) => setAlgorithm(e.target.value)}>
            <option value="random">Random</option>
            <option value="greedy">Greedy</option>
            <option value="linear-threshold">Linear Threshold</option>
            <option value="cascade">Cascade</option>
          </select>
        </label>
        <br />
        <button type="submit">Run Algorithm</button>
      </form>

      {result && (
        <div>
          <h3>Results:</h3>
          <pre>{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  );
};

export default GraphForm;
