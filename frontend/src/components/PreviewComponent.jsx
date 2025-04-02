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
  const [currentSeedSize, setCurrentSeedSize] = useState(null);


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

      setTimeout(() => {
        graphRef.current.zoomToFit(400, 100, node => true);
        graphRef.current.cameraPosition({ z: 700 }); // Move camera further back
      }, 100);
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

  useEffect(() => {
    if (currentSeedSize !== null) {
      // Add "show" class to display the seed size text
      const seedSizeElement = document.querySelector('.seed-size-info');
      if (seedSizeElement) {
        seedSizeElement.classList.add('show');
        setTimeout(() => {
          seedSizeElement.classList.remove('show');
        }, 1000); // Keep the seed size displayed for 1 second
      }
    }
  }, [currentSeedSize]);
  

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

  const clearAnimationData = () => {
    setHighlightedNodes(new Set());
    setCurrentStage(null);
    setActivatedNodes(new Set());
    setCurrentSeedSize(null);
    setSeedNodes(new Set());
    
    // Reset node colors and algorithm assignments
    if (graphDataRef.current) {
      graphDataRef.current.nodes.forEach(node => {
        node.__algorithm = null;
        node.color = "#4682B4"; // Reset to default color
      });
    }
    
    // Force graph refresh if available
    if (graphRef.current) {
      graphRef.current.refresh();
    }
  };

  const startAnimation = async (algorithm) => {
    // Clear ALL previous animation data including seed nodes
    clearAnimationData();
    await new Promise(resolve => setTimeout(resolve, 500)); // Brief pause after clear
  
    const algorithmResults = graphData?.algorithm_results?.[algorithm];
    if (!algorithmResults) {
      console.warn(`No results found for algorithm ${algorithm}`);
      return;
    }
  
    setActiveAlgorithm(algorithm);
    setIsAnimating(true);
  
    // Get all seed sizes and sort them numerically
    const seedSizes = Object.keys(algorithmResults.stages_by_seed)
      .map(Number)
      .sort((a, b) => a - b);
  
    // Process each seed size sequentially
    for (const seedSize of seedSizes) {
      // COMPLETE RESET - Clear everything including previous seed nodes
      clearAnimationData();
      setCurrentSeedSize(seedSize);
      
      // Visual pause before new seed size starts (1 second)
      await new Promise(resolve => setTimeout(resolve, 1000));
  
      const stages = algorithmResults.stages_by_seed[seedSize];
      
      if (!stages || stages.length === 0) {
        console.warn(`No stages found for seed size ${seedSize}`);
        continue;
      }
  
      // Collect seed nodes for this seed size
      const seedNodesSet = new Set();
      stages.forEach(stage => {
        if (stage.selected_nodes) {
          stage.selected_nodes.forEach(node => seedNodesSet.add(node));
        }
      });
  
      for (let stageIndex = 0; stageIndex < stages.length; stageIndex++) {
        const newStage = stages[stageIndex];
        setCurrentStage({...newStage, algorithm});

        const seedNodes = new Set();
        if (Array.isArray(newStage.selected_nodes)) {
          newStage.selected_nodes.forEach(node => {
            seedNodes.add(node);
            const nodeObj = graphDataRef.current.nodes.find(n => n.id === node);
            if (nodeObj) {
              nodeObj.__algorithm = algorithm;
              nodeObj.color = getAlgorithmColor(algorithm); // Force color update
            }
          });
        }
        
        setSeedNodes(seedNodes);
        setHighlightedNodes(seedNodes);
        setActivatedNodes(prev => new Set([...prev, ...seedNodes]));

        // Pause after showing seed nodes (1.5 seconds)
        await new Promise(resolve => setTimeout(resolve, 1500));
            
  
        // Update visualization - only propagated nodes
        const propagatedNodes = new Set();
        if (Array.isArray(newStage.propagated_nodes)) {
          newStage.propagated_nodes.forEach(node => {
            if (!seedNodesSet.has(node)) {
              propagatedNodes.add(node);
            }
          });
        }
  
        setHighlightedNodes(propagatedNodes);
        setActivatedNodes(prev => new Set([...prev, ...propagatedNodes]));
  
        // Longer pause between stages (3 seconds)
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
  
      // Extended pause between different seed sizes (2 seconds)
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  
    // Final pause before ending animation (1 second)
    await new Promise(resolve => setTimeout(resolve, 1000));
    setIsAnimating(false);
    setCurrentSeedSize(null);
    
    // Update comparison results
    if (algorithmResults.metrics) {
      setComparisonResults(prev => [
        ...prev.filter(r => r.algorithm !== algorithm),
        { 
          algorithm, 
          ...algorithmResults.metrics,
          seed_nodes: Array.from(
            new Set(
              seedSizes.flatMap(size => 
                algorithmResults.stages_by_seed[size]
                  .flatMap(stage => stage.selected_nodes || [])
              )
            )
          )
        }
      ]);
    }
  };
  
  

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

          {currentSeedSize !== null && (
              <div className="seed-size-info">
                <h4>Current Seed Size: {currentSeedSize}</h4>
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