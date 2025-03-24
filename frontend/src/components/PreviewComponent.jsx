import React, { useRef, useEffect, useState } from "react";
import ForceGraph3D from "react-force-graph-3d";
import "../css/PreviewComponent.css";

const PreviewComponent = ({ graphData, isLoading, selectedAlgorithms }) => {
  const graphRef = useRef();
  const [currentStage, setCurrentStage] = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [highlightedNodes, setHighlightedNodes] = useState(new Set());
  const [activeAlgorithm, setActiveAlgorithm] = useState(null);
  const [comparisonResults, setComparisonResults] = useState([]);

  // Process graph data with support for multiple algorithms
  const processedGraphData = React.useMemo(() => {
    if (!graphData) return { nodes: [], links: [] };
    
    return {
      nodes: graphData.nodes.map((id) => ({
        id,
        color: "#4682B4", // steel blue
        __highlighted: false,
        __algorithm: null
      })),
      links: graphData.edges.map(([source, target]) => ({ source, target }))
    };
  }, [graphData]);

  const graphDataRef = useRef(processedGraphData);
  useEffect(() => {
    graphDataRef.current = processedGraphData;
  }, [processedGraphData]);

  // Initialize graph settings
  useEffect(() => {
    if (graphRef.current) {
      graphRef.current.zoomToFit(500);
      graphRef.current.d3Force("charge").strength(-800);
      graphRef.current.d3Force("link").distance(250);
    }
  }, [graphData]);

  // Update node colors based on highlighting and algorithm
  useEffect(() => {
    if (graphRef.current && graphDataRef.current.nodes.length > 0) {
      const graphNodes = graphDataRef.current.nodes;
      
      graphNodes.forEach(node => {
        const isHighlighted = highlightedNodes.has(node.id);
        const algorithmColor = getAlgorithmColor(node.__algorithm);
        
        node.color = isHighlighted 
          ? algorithmColor || "#FF0000" // red if no algorithm assigned
          : algorithmColor || "#4682B4"; // steel blue default
        
        node.__highlighted = isHighlighted;
      });

      graphRef.current.refresh();
    }
  }, [highlightedNodes]);

  // Color mapping for different algorithms
  const getAlgorithmColor = (algorithm) => {
    const colors = {
      classic_greedy: "#FF6347", // tomato
      random_selection: "#32CD32", // lime green
      degree_heuristic: "#9370DB", // medium purple
      centrality_heuristic: "#FFD700", // gold
      celf: "#FF69B4", // hot pink
      celf_plus: "#00BFFF" // deep sky blue
    };
    return algorithm ? colors[algorithm] : null;
  };

  const startAnimation = (algorithm) => {
    // Reset previous animation state
    setHighlightedNodes(new Set());
    setCurrentStage(null);
    
    // Clear previous algorithm assignments
    graphDataRef.current.nodes.forEach(node => {
      node.__algorithm = null;
    });
    graphRef.current.refresh();
  
    const algorithmResults = graphData?.algorithm_results?.[algorithm];
    console.log(algorithmResults);
    if (!algorithmResults) {
      console.warn(`No results found for algorithm ${algorithm}`);
      return;
    }
  
    const stages = algorithmResults.stages;
    if (!stages || stages.length === 0) {
      console.warn(`No stages found for algorithm ${algorithm}`);
      return;
    }
  
    setActiveAlgorithm(algorithm);
    setIsAnimating(true);
  
    let stageIndex = 0;
  
    const interval = setInterval(() => {
      if (stageIndex < stages.length) {
        const newStage = stages[stageIndex];
        setCurrentStage({...newStage, algorithm});
  
        setHighlightedNodes(prev => {
          const updatedNodes = new Set();
          
          // Handle selected nodes
          if (Array.isArray(newStage.selected_nodes)) {
            newStage.selected_nodes.forEach(node => {
              updatedNodes.add(node);
              const nodeObj = graphDataRef.current.nodes.find(n => n.id === node);
              if (nodeObj) nodeObj.__algorithm = algorithm;
            });
          }
          
          // Handle propagated nodes
          if (Array.isArray(newStage.propagated_nodes)) {
            newStage.propagated_nodes.forEach(node => updatedNodes.add(node));
          }
          
          return updatedNodes;
        });
  
        stageIndex++;
      } else {
        clearInterval(interval);
        setIsAnimating(false);
        
        // Store results for comparison
        if (algorithmResults.metrics) {
          setComparisonResults(prev => [
            ...prev.filter(r => r.algorithm !== algorithm),
            { 
              algorithm, 
              ...algorithmResults.metrics,
              seed_nodes: stages
                .flatMap(stage => stage.selected_nodes || [])
                .filter((v, i, a) => a.indexOf(v) === i)
            }
          ]);
        }
      }
    }, 2000);
  };
  

  // Render loading spinner or message when loading
  if (isLoading) {
    return (
      <div className="loading-overlay">
        <div className="spinner"></div>
        <p>Loading graph...</p>
      </div>
    );
  }

  if (!graphData || !graphData.nodes || !graphData.edges || !graphData.algorithm_results) {
    return <div className="loading-message">Please select options and run the algorithm to see the results.</div>;
  }

  return (
    <div className="preview-wrapper">
    <div className="preview-container">
      <div className="graph-container">
          <ForceGraph3D
            ref={graphRef}
            graphData={processedGraphData}
            nodeRelSize={30}
            linkWidth={7}
            linkDirectionalParticles={6}
            linkDirectionalArrowLength={6}
            nodeLabel={(node) => `Node ${node.id}`}
            backgroundColor="#1e1e1e"
          />
        </div>

      <div className="info-panel">
        {currentStage && (
          <div className="algorithm-stage-info">
            <h3>{activeAlgorithm} - {currentStage.stage}</h3>
            <div className="stage-details">
              <p>Selected Nodes: {currentStage.selected_nodes?.join(', ') || 'None'}</p>
              <p>Propagated Nodes: {currentStage.propagated_nodes?.join(', ') || 'None'}</p>
              <p>Total Activated: {currentStage.total_activated || 0}</p>
            </div>
          </div>
        )}

        {comparisonResults.length > 0 && (
          <div className="comparison-results">
            <h3>Algorithm Comparison</h3>
            <table>
              <thead>
                <tr>
                  <th>Algorithm</th>
                  <th>Spread</th>
                  <th>Runtime (ms)</th>
                  <th>Efficiency</th>
                </tr>
              </thead>
              <tbody>
                {comparisonResults.map((result, index) => (
                  <tr key={index}>
                    <td>{result.algorithm}</td>
                    <td>{result.spread}</td>
                    <td>{result.runtime}</td>
                    <td>{(result.spread / result.runtime).toFixed(2)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="control-panel">
        <div className="algorithm-buttons">
          {selectedAlgorithms?.map((algorithm) => (
            <button
              key={algorithm}
              onClick={() => startAnimation(algorithm)}
              className={`algorithm-button ${activeAlgorithm === algorithm ? 'active' : ''}`}
              disabled={isAnimating}
              style={{ backgroundColor: getAlgorithmColor(algorithm) }}
            >
              {algorithm.replace(/_/g, ' ')}
            </button>
          ))}
        </div>

      </div>
    </div>
    </div>

    
  );
};

export default PreviewComponent;