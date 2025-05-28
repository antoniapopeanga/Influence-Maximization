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


  const processedGraphData = React.useMemo(() => {
    if (!graphData) return { nodes: [], links: [] };
    
    return {
      nodes: graphData.nodes.map((id) => ({
        id,
        color: "#4682B4", 
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

  // initializam setarile grafului
  useEffect(() => {
    if (graphRef.current) {
      graphRef.current.zoomToFit(500);
      graphRef.current.d3Force("charge").strength(-300);
      graphRef.current.d3Force("link").distance(250);

      setTimeout(() => {
        graphRef.current.zoomToFit(400, 100, node => true);
        graphRef.current.cameraPosition({ z: 200}); // zoom out
      }, 100);
    }
  }, [graphData]);

  // actualizam culorile nodurilor pe masura ce ruleaza algo
  useEffect(() => {
    if (graphRef.current && graphDataRef.current.nodes.length > 0) {
      const graphNodes = graphDataRef.current.nodes;
      
      graphNodes.forEach(node => {
        const isHighlighted = highlightedNodes.has(node.id);
        const isSeedNode = seedNodes.has(node.id);
        const isActivated = activatedNodes.has(node.id);
        const algorithmColor = getAlgorithmColor(node.__algorithm);
        
        if (isSeedNode && activeAlgorithm) {
          // seed nodes= culoarea algortimului
          node.color = algorithmColor || "#4682B4";
        } else if (isActivated) {
          // altfel rosu
          node.color = algorithmColor 
            ? algorithmColor.replace(')', ', 0.5)').replace('rgb', 'rgba')
            : "#FF0000"; 
        }  else {
          node.color = "#4682B4";
        }
        
        node.__highlighted = isHighlighted;
      });

      graphRef.current.refresh();
    }
  }, [highlightedNodes, seedNodes, activatedNodes, activeAlgorithm]);

  useEffect(() => {
    if (currentSeedSize !== null) {
      const seedSizeElement = document.querySelector('.seed-size-info');
      if (seedSizeElement) {
        seedSizeElement.classList.add('show');
        setTimeout(() => {
          seedSizeElement.classList.remove('show');
        }, 1000); 
      }
    }
  }, [currentSeedSize]);
  
  const getAlgorithmColor = (algorithm) => {
    const colors = {
      classic_greedy: "rgb(255, 105, 180)", // hot pink
      random_selection: "rgb(50, 205, 50)", // lime green
      degree_heuristic: "rgb(79, 15, 206)", // medium purple
      centrality_heuristic: "rgb(255, 215, 0)", // gold
      celf: "rgb(19, 192, 169)", // turqoise
    };
    return algorithm ? colors[algorithm] : null;
  };

  const clearAnimationData = () => {
    setHighlightedNodes(new Set());
    setCurrentStage(null);
    setActivatedNodes(new Set());
    setCurrentSeedSize(null);
    setSeedNodes(new Set());
    
    // resetam datele grafului
    if (graphDataRef.current) {
      graphDataRef.current.nodes.forEach(node => {
        node.__algorithm = null;
        node.color = "#4682B4"; 
      });
    }
    
    if (graphRef.current) {
      graphRef.current.refresh();
    }
  };

// Replace your existing zoomToNodes function with this improved version
const zoomToNodes = (nodeIds, zoomDistance = 150) => {
  if (!graphRef.current || !graphDataRef.current || nodeIds.length === 0) return;

  setTimeout(() => {
    const nodes = graphDataRef.current.nodes.filter(n =>
      nodeIds.includes(n.id) && 
      typeof n.x === 'number' && 
      typeof n.y === 'number'
    );

    if (nodes.length === 0) {
      console.warn('No positioned nodes found for zoom');
      return;
    }

    const center = {
      x: nodes.reduce((sum, n) => sum + n.x, 0) / nodes.length,
      y: nodes.reduce((sum, n) => sum + n.y, 0) / nodes.length,
      z: nodes.reduce((sum, n) => sum + n.z, 0) / nodes.length
    };

    // Calculate bounding box for better zoom distance
    const bounds = {
      minX: Math.min(...nodes.map(n => n.x)),
      maxX: Math.max(...nodes.map(n => n.x)),
      minY: Math.min(...nodes.map(n => n.y)),
      maxY: Math.max(...nodes.map(n => n.y)),
      minZ: Math.min(...nodes.map(n => n.z)),
      maxZ: Math.max(...nodes.map(n => n.z))
    };

    // Adaptive zoom distance based on spread of nodes
    const spread = Math.max(
      bounds.maxX - bounds.minX,
      bounds.maxY - bounds.minY,
      bounds.maxZ - bounds.minZ
    );
    
    const adaptiveZoomDistance = Math.max(zoomDistance, spread * 1.5);

    console.log('Zooming to center:', center, 'with distance:', adaptiveZoomDistance);

    graphRef.current.cameraPosition(
      { x: center.x, y: center.y, z: center.z + adaptiveZoomDistance },
      center,
      1500 // Slower transition for smoother movement
    );
  }, 300); // Reduced delay
};


const sparkleNodes = async (nodeIds, color, duration = 1500, interval = 200) => {
  const nodes = graphDataRef.current.nodes.filter(n => nodeIds.includes(n.id));

  const sparkleSteps = Math.floor(duration / interval);
  for (let i = 0; i < sparkleSteps; i++) {
    nodes.forEach(node => {
      node.color = i % 2 === 0 
        ? color.replace('rgb', 'rgba').replace(')', ', 1)')
        : color.replace('rgb', 'rgba').replace(')', ', 0.3)');
    });
    graphRef.current.refresh();
    await new Promise(resolve => setTimeout(resolve, interval));
  }

  // Restore to full color after sparkle
  nodes.forEach(node => {
    node.color = color;
  });
  graphRef.current.refresh();
};


// Add this new function to zoom to all activated nodes
const zoomToActivatedNodes = (activatedNodeIds) => {
  if (activatedNodeIds.length === 0) return;
  
  // Use a larger zoom distance for activated nodes view
  zoomToNodes(activatedNodeIds, 200);
};

// Update your startAnimation function - replace the relevant section:
const startAnimation = async (algorithm) => {
  clearAnimationData();
  await new Promise(resolve => setTimeout(resolve, 500));

  const algorithmResults = graphData?.algorithm_results?.[algorithm];
  if (!algorithmResults) {
    console.warn(`No results found for algorithm ${algorithm}`);
    return;
  }

  setActiveAlgorithm(algorithm);
  setIsAnimating(true);

  const seedSizes = Object.keys(algorithmResults.stages_by_seed)
    .map(Number)
    .sort((a, b) => a - b);

  for (const seedSize of seedSizes) {
    clearAnimationData();
    setCurrentSeedSize(seedSize);
    
    await new Promise(resolve => setTimeout(resolve, 1000));

    const stages = algorithmResults.stages_by_seed[seedSize];
    
    if (!stages || stages.length === 0) {
      console.warn(`No stages found for seed size ${seedSize}`);
      continue;
    }

    const seedNodesSet = new Set();
    stages.forEach(stage => {
      if (stage.selected_nodes) {
        stage.selected_nodes.forEach(node => seedNodesSet.add(node));
      }
    });

    // Track all activated nodes throughout the process
    const allActivatedNodes = new Set();

    for (let stageIndex = 0; stageIndex < stages.length; stageIndex++) {
      const newStage = stages[stageIndex];
      setCurrentStage({...newStage, algorithm});

      // === SEED NODES PHASE ===
      const seedNodes = new Set();
      if (Array.isArray(newStage.selected_nodes)) {
        newStage.selected_nodes.forEach(node => {
          seedNodes.add(node);
          allActivatedNodes.add(node);
        });
      }
      
      // 1. First zoom to seed nodes WITHOUT coloring
      if (seedNodes.size > 0) {
        zoomToNodes([...seedNodes], 120);
        
        // Wait for zoom to complete
        await new Promise(resolve => setTimeout(resolve, 1500));
        
        // 2. Then color and sparkle the seed nodes
        const color = getAlgorithmColor(algorithm);
        seedNodes.forEach(node => {
          const nodeObj = graphDataRef.current.nodes.find(n => n.id === node);
          if (nodeObj) {
            nodeObj.__algorithm = algorithm;
          }
        });
        setSeedNodes(seedNodes);
        setHighlightedNodes(seedNodes);
        setActivatedNodes(prev => new Set([...prev, ...seedNodes]));

        // Sparkle effect before final color
        await sparkleNodes([...seedNodes], color);

        // Wait to show the colored seed nodes
        await new Promise(resolve => setTimeout(resolve, 1500));
      }

      // === PROPAGATION PHASE ===
      const propagatedNodes = new Set();
      if (Array.isArray(newStage.propagated_nodes)) {
        newStage.propagated_nodes.forEach(node => {
          if (!seedNodesSet.has(node)) {
            propagatedNodes.add(node);
            allActivatedNodes.add(node);
          }
        });
      }

      if (propagatedNodes.size > 0) {
        // 3. Zoom out to show all activated nodes (seed + propagated)
        zoomToActivatedNodes([...allActivatedNodes]);
        
        // Wait for zoom to complete
        await new Promise(resolve => setTimeout(resolve, 1200));
        
        // 4. Then color the propagated nodes
        setHighlightedNodes(propagatedNodes);
        setActivatedNodes(prev => new Set([...prev, ...propagatedNodes]));
        
        // The propagated nodes will be colored by the useEffect that watches state changes
        
        // Wait to show the propagation effect
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    await new Promise(resolve => setTimeout(resolve, 1500));
  }

  await new Promise(resolve => setTimeout(resolve, 1000));
  setIsAnimating(false);
  setCurrentSeedSize(null);
  
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
const rotateCamera = (direction = 'left') => {
  const distance = 400; // how far the camera stays from center
  const angleDelta = Math.PI / 12; // 15 degrees
  const angle = direction === 'left' ? angleDelta : -angleDelta;

  const curPos = graphRef.current.cameraPosition();
  const newX = curPos.x * Math.cos(angle) - curPos.z * Math.sin(angle);
  const newZ = curPos.x * Math.sin(angle) + curPos.z * Math.cos(angle);

  graphRef.current.cameraPosition({ x: newX, y: curPos.y, z: newZ }, undefined, 300);
};

const handleRotateLeft = () => rotateCamera('left');
const handleRotateRight = () => rotateCamera('right');



const zoomIn = () => {
  if (!graphRef.current) return;
  const camera = graphRef.current.camera();
  const factor = 0.8;
  graphRef.current.cameraPosition({
    x: camera.position.x * factor,
    y: camera.position.y * factor,
    z: camera.position.z * factor
  });
};

const zoomOut = () => {
  if (!graphRef.current) return;
  const camera = graphRef.current.camera();
  const factor = 1.2;
  graphRef.current.cameraPosition({
    x: camera.position.x * factor,
    y: camera.position.y * factor,
    z: camera.position.z * factor
  });
};


  return (
    <div className="preview-wrapper">
    <div className="preview-container">
      <div className="graph-container">
          <ForceGraph3D
            ref={graphRef}
            graphData={processedGraphData}
            nodeRelSize={20}
            linkWidth={1}
            linkDirectionalParticles={0}
            linkDirectionalArrowLength={0}
             nodeLabel={() => ''}
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

      {graphData && graphData.nodes.length > 0 && (
        <div className="graph-controls-container">
          <div className="graph-controls">
              <button onClick={zoomIn}>➕ Zoom In</button>
              <button onClick={zoomOut}>➖ Zoom Out</button>
              <button onClick={handleRotateLeft}>⟲ Rotate Left</button>
              <button onClick={handleRotateRight}>⟳ Rotate Right</button>

          </div>
        </div>
      )}

      
    </div>
    </div>
  );
};

export default PreviewComponent;