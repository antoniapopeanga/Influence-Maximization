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
  const [seedNodes, setSeedNodes] = useState(new Set());
  const [activatedNodes, setActivatedNodes] = useState(new Set());

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
        const isSeedNode = seedNodes.has(node.id);
        const isActivated = activatedNodes.has(node.id);
        const algorithmColor = getAlgorithmColor(node.__algorithm);
        
        // Priority-based color assignment
        if (isSeedNode && activeAlgorithm) {
          // Seed nodes get the algorithm's color
          node.color = algorithmColor || "#4682B4";
        } else if (isActivated) {
          // Activated nodes get a darker version of the algorithm color
          node.color = algorithmColor 
            ? algorithmColor.replace(')', ', 0.5)').replace('rgb', 'rgba')
            : "#FF0000"; // dark gray
        }  else {
          // Default to steel blue
          node.color = "#4682B4";
        }
        
        node.__highlighted = isHighlighted;
      });

      graphRef.current.refresh();
    }
  }, [highlightedNodes, seedNodes, activatedNodes, activeAlgorithm]);

  // Color mapping for different algorithms
  const getAlgorithmColor = (algorithm) => {
    const colors = {
      classic_greedy: "rgb(255, 105, 180)", // hot pink
      random_selection: "rgb(50, 205, 50)", // lime green
      degree_heuristic: "rgb(79, 15, 206)", // medium purple
      centrality_heuristic: "rgb(255, 215, 0)", // gold
      celf: "rgb(255, 105, 180)", // hot pink
      celf_plus: "rgb(0, 191, 255)" // deep sky blue
    };
    return algorithm ? colors[algorithm] : null;
  };

  const startAnimation = (algorithm) => {
    // Reset previous animation state
    setHighlightedNodes(new Set());
    setCurrentStage(null);
    setActivatedNodes(new Set());
    
    // Clear previous algorithm assignments
    graphDataRef.current.nodes.forEach(node => {
      node.__algorithm = null;
    });
    graphRef.current.refresh();
  
    const algorithmResults = graphData?.algorithm_results?.[algorithm];
    if (!algorithmResults) {
      console.warn(`No results found for algorithm ${algorithm}`);
      return;
    }
  
    const stages = algorithmResults.stages;
    if (!stages || stages.length === 0) {
      console.warn(`No stages found for algorithm ${algorithm}`);
      return;
    }
  
    // Set seed nodes
    const seedNodesSet = new Set(algorithmResults.metrics.seed_nodes);
    setSeedNodes(seedNodesSet);
  
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
            newStage.propagated_nodes.forEach(node => {
              // Only add non-seed nodes to highlighted nodes
              if (!seedNodesSet.has(node)) {
                updatedNodes.add(node);
              }
            });
          }
          
          return updatedNodes;
        });

        // Update activated nodes
        setActivatedNodes(prev => {
          const updatedActivated = new Set(prev);
          
          // Add selected nodes
          if (Array.isArray(newStage.selected_nodes)) {
            newStage.selected_nodes.forEach(node => updatedActivated.add(node));
          }
          
          // Add propagated nodes
          if (Array.isArray(newStage.propagated_nodes)) {
            newStage.propagated_nodes.forEach(node => updatedActivated.add(node));
          }
          
          return updatedActivated;
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

  // Rest of the component remains the same...
  // (Rendering methods are unchanged from the previous version)

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

      {/* Rest of the previous rendering code remains the same */}
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