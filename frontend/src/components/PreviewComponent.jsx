
import React, { useRef, useEffect, useState } from "react";
import ForceGraph3D from "react-force-graph-3d";
import "../css/PreviewComponent.css";
import axios from'axios'

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
  const [savedRuns, setSavedRuns] = useState([]);
  const [selectedRunId, setSelectedRunId] = useState(null);
  const [processedGraphData, setProcessedGraphData] = useState({ nodes: [], links: [] });
  const [showModal, setShowModal] = useState(false);
  const [filterNetwork, setFilterNetwork] = useState("");
  const [filterModel, setFilterModel] = useState("");
  const [filterAlgorithm, setFilterAlgorithm] = useState("");

  let layoutReadyResolver = null;
  let layoutReadyPromise = null;
  
  // ADD: Keep track of original graph data
  const [originalGraphData, setOriginalGraphData] = useState({ nodes: [], links: [] });
  const [isShowingSavedRun, setIsShowingSavedRun] = useState(false);
  // ADDED: Store current saved run data for animation
  const [currentSavedRunData, setCurrentSavedRunData] = useState(null);

  const graphDataRef = useRef({ nodes: [], links: [] });

  // FIXED: Store original graph data and set up processed data
  useEffect(() => {
    if (!graphData) return;

    const formatted = {
      nodes: graphData.nodes.map((id) => ({
        id,
        color: "#4682B4",
        __highlighted: false,
        __algorithm: null
      })),
      links: graphData.edges.map(([source, target]) => ({ source, target }))
    };

    // Store original data for restoration
    setOriginalGraphData(formatted);
    setProcessedGraphData(formatted);
    graphDataRef.current = formatted;
    
    // Reset saved run state when new graph data comes in
    setIsShowingSavedRun(false);
    setCurrentSavedRunData(null);
  }, [graphData]);

  useEffect(() => {
    const fetchSavedRuns = async () => {
      try {
        const response = await axios.get("http://localhost:5000/saved-runs");
        console.log('Fetched saved runs:', response.data);
        setSavedRuns(response.data);
      } catch (error) {
        console.error('Error fetching saved runs:', error);
        setSavedRuns([]);
      }
    };

    fetchSavedRuns();
  }, []);

  // ADD: Function to restore original graph data
  const restoreOriginalGraph = () => {
    if (originalGraphData.nodes.length > 0) {
      const restoredData = {
        nodes: originalGraphData.nodes.map(node => ({
          ...node,
          color: "#4682B4",
          __highlighted: false,
          __algorithm: null
        })),
        links: [...originalGraphData.links]
      };
      
      graphDataRef.current = restoredData;
      setProcessedGraphData(restoredData);
      setIsShowingSavedRun(false);
      setCurrentSavedRunData(null);
      clearAnimationData();
    }
  };

// Function to create a new layout promise
const createLayoutPromise = () => {
  layoutReadyPromise = new Promise(resolve => {
    layoutReadyResolver = resolve;
    console.log("Created new layout promise");
  });
  return layoutReadyPromise;
};

const loadSavedRun = async (runId) => {
  try {
    const response = await axios.get(`http://localhost:5000/saved-runs/${runId}`);
    const data = response.data;

    if (!data || !data.stages || !data.seed_nodes || !data.algorithm || !data.graph_data) {
      throw new Error('Incomplete saved run data structure');
    }

    const stages = typeof data.stages === 'string' ? JSON.parse(data.stages) : data.stages;
    const seedNodes = typeof data.seed_nodes === 'string' ? JSON.parse(data.seed_nodes) : data.seed_nodes;

    const loadedNodes = data.graph_data.nodes;
    const loadedEdges = data.graph_data.edges;

    const formattedGraphData = {
      nodes: loadedNodes.map(id => ({
        id,
        color: "#4682B4",
        __highlighted: false,
        __algorithm: null
      })),
      links: loadedEdges.map(([source, target]) => ({ source, target }))
    };
    
    console.log("Setting new graph data for saved run");
    graphDataRef.current = formattedGraphData;
    setProcessedGraphData(formattedGraphData);
    setIsShowingSavedRun(true);
    
    // ADDED: Store the saved run data for animation
    setCurrentSavedRunData({
      stages,
      seedNodes,
      algorithm: data.algorithm
    });

    clearAnimationData();
    
    // Wait for the graph to process the new data
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Force refresh and wait for layout
    if (graphRef.current) {
      graphRef.current.refresh();
      console.log("Graph refreshed, waiting for layout...");
      
      // Wait for the simulation to run
      await new Promise(resolve => setTimeout(resolve, 3000));
    }
    
    console.log("Starting animation after layout wait");
    animateSavedRun(stages, seedNodes, data.algorithm);
    
  } catch (error) {
    console.error('Error loading saved run:', error);
    alert(`Failed to load saved run: ${error.message}`);
  }
};

  // initializam setarile grafului
useEffect(() => {
  if (graphRef.current && processedGraphData.nodes.length > 0) {
    console.log("Initializing graph with", processedGraphData.nodes.length, "nodes");
    
    // Force the graph to restart its simulation
    graphRef.current.refresh();
    
    // Configure forces
    graphRef.current.d3Force("charge").strength(-300);
    graphRef.current.d3Force("link").distance(250);
    
    // Initial zoom
    setTimeout(() => {
      if (graphRef.current) {
        graphRef.current.zoomToFit(1000, 100);
        graphRef.current.cameraPosition({ z: 400 }); // zoom out more
      }
    }, 500);
  }
}, [processedGraphData]);

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

const zoomToNodes = (nodeIds, zoomDistance = 150) => {
  if (!graphRef.current || !graphDataRef.current || nodeIds.length === 0) {
    console.warn("Missing graph reference or node IDs");
    return;
  }

  console.log('Attempting to zoom to', nodeIds.length, 'nodes:', nodeIds);

  const attemptZoom = (attempt = 1, maxAttempts = 15) => {
    setTimeout(() => {
      // Get all nodes from the graph
      const allNodes = graphDataRef.current.nodes;
      console.log(`Attempt ${attempt}: Checking ${allNodes.length} total nodes`);
      
      // FIXED: Find target nodes by converting both to strings for comparison
      const targetNodeIds = nodeIds.map(id => String(id));
      const targetNodes = allNodes.filter(n => targetNodeIds.includes(String(n.id)));
      console.log(`Found ${targetNodes.length} target nodes out of ${nodeIds.length} requested`);
      
      if (targetNodes.length === 0) {
        console.error("No target nodes found in graph data");
        console.log("Available node IDs (first 10):", allNodes.slice(0, 10).map(n => n.id));
        console.log("Requested node IDs:", nodeIds);
        return;
      }

      // Check which nodes have valid positions
      const positionedNodes = targetNodes.filter(n => {
        const hasPosition = n.x !== undefined && n.y !== undefined && n.z !== undefined;
        const isValidPosition = typeof n.x === 'number' && typeof n.y === 'number' && typeof n.z === 'number';
        const isFinitePosition = isFinite(n.x) && isFinite(n.y) && isFinite(n.z);
        const isNonZero = !(n.x === 0 && n.y === 0 && n.z === 0); // Sometimes nodes start at origin
        
        if (hasPosition && isValidPosition && isFinitePosition) {
          console.log(`Node ${n.id} position:`, { x: n.x, y: n.y, z: n.z });
        }
        
        return hasPosition && isValidPosition && isFinitePosition && isNonZero;
      });

      console.log(`Attempt ${attempt}: Found ${positionedNodes.length} positioned nodes`);

      // If we have positioned nodes, zoom to them
      if (positionedNodes.length > 0) {
        const center = {
          x: positionedNodes.reduce((sum, n) => sum + n.x, 0) / positionedNodes.length,
          y: positionedNodes.reduce((sum, n) => sum + n.y, 0) / positionedNodes.length,
          z: positionedNodes.reduce((sum, n) => sum + n.z, 0) / positionedNodes.length
        };

        // Calculate adaptive zoom distance
        const bounds = {
          minX: Math.min(...positionedNodes.map(n => n.x)),
          maxX: Math.max(...positionedNodes.map(n => n.x)),
          minY: Math.min(...positionedNodes.map(n => n.y)),
          maxY: Math.max(...positionedNodes.map(n => n.y)),
          minZ: Math.min(...positionedNodes.map(n => n.z)),
          maxZ: Math.max(...positionedNodes.map(n => n.z))
        };

        const spread = Math.max(
          bounds.maxX - bounds.minX,
          bounds.maxY - bounds.minY,
          bounds.maxZ - bounds.minZ
        );
        
        const adaptiveZoomDistance = Math.max(zoomDistance, spread * 2);

        console.log(`Zooming to center:`, center, `with distance:`, adaptiveZoomDistance);

        try {
          graphRef.current.cameraPosition(
            { x: center.x, y: center.y, z: center.z + adaptiveZoomDistance },
            center,
            1500
          );
          console.log("Zoom completed successfully");
        } catch (error) {
          console.error("Error during zoom:", error);
        }
        
        return;
      }

      // If no positioned nodes and haven't exceeded attempts, try again
      if (attempt < maxAttempts) {
        console.warn(`No positioned nodes found. Trying again in 1 second... (attempt ${attempt}/${maxAttempts})`);
        
        // Try to force the simulation to run
        if (attempt === 3 && graphRef.current) {
          console.log("Forcing graph refresh...");
          graphRef.current.refresh();
        }
        
        attemptZoom(attempt + 1, maxAttempts);
      } else {
        console.error(`Failed to find positioned nodes after ${maxAttempts} attempts`);
        // Final fallback
        if (graphRef.current) {
          console.log("Using fallback zoom to fit");
          graphRef.current.zoomToFit(2000);
        }
      }
    }, attempt === 1 ? 500 : 1000);
  };

  attemptZoom();
};

  const sparkleNodes = async (nodeIds, color, duration = 1500, interval = 200) => {
    // FIXED: Convert nodeIds to strings for comparison
    const nodeIdsStr = nodeIds.map(id => String(id));
    const nodes = graphDataRef.current.nodes.filter(n => nodeIdsStr.includes(String(n.id)));

    console.log(`Sparkling ${nodes.length} nodes out of ${nodeIds.length} requested`);

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

  // FIXED: Update startAnimation to ensure we're using current graph data
  const startAnimation = async (algorithm) => {
    // FIXED: Restore original graph if we were showing a saved run
    if (isShowingSavedRun) {
      restoreOriginalGraph();
      // Wait for graph to be restored
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    // FIXED: Ensure we have the current graph data
    if (!graphData?.algorithm_results?.[algorithm]) {
      console.warn(`No results found for algorithm ${algorithm} in current graph data`);
      return;
    }

    clearAnimationData();
    await new Promise(resolve => setTimeout(resolve, 500));

    const algorithmResults = graphData.algorithm_results[algorithm];
    
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
            const nodeObj = graphDataRef.current.nodes.find(n => String(n.id) === String(node));
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

const animateSavedRun = async (stages, seedNodes, algorithm) => {
  if (!stages || !seedNodes || !algorithm) {
    console.error('Invalid saved run data:', { stages, seedNodes, algorithm });
    return;
  }

  console.log('Starting animation with data:', {
    stagesCount: stages.length,
    seedNodesCount: seedNodes.length,
    algorithm,
    seedNodes: seedNodes
  });

  clearAnimationData();
  setActiveAlgorithm(algorithm);
  setIsAnimating(true);
  setCurrentSeedSize(seedNodes.length);

  // FIXED: Convert seed nodes to strings and ensure they exist in current graph
  const seedNodesStr = seedNodes.map(id => String(id));
  const availableNodes = graphDataRef.current.nodes.map(n => String(n.id));
  const validSeedNodes = seedNodesStr.filter(id => availableNodes.includes(id));
  
  console.log(`Valid seed nodes: ${validSeedNodes.length}/${seedNodes.length}`);
  console.log('Seed nodes:', validSeedNodes);
  
  if (validSeedNodes.length === 0) {
    console.error('No valid seed nodes found in current graph');
    setIsAnimating(false);
    return;
  }

  const seedNodesSet = new Set(validSeedNodes);
  const algorithmColor = getAlgorithmColor(algorithm);
  
  // Apply colors to nodes
  graphDataRef.current.nodes.forEach(node => {
    if (seedNodesSet.has(String(node.id))) {
      node.__algorithm = algorithm;
      node.color = algorithmColor;
    }
  });
  
  setSeedNodes(seedNodesSet);
  setActivatedNodes(seedNodesSet);
  
  // Force graph refresh to show colors
  if (graphRef.current) {
    graphRef.current.refresh();
  }

  console.log("Waiting for graph layout before starting zoom...");
  
  // Wait longer for the layout to complete
  await new Promise(resolve => setTimeout(resolve, 3000));
  
  // Check if any nodes are positioned
  const positionedNodes = graphDataRef.current.nodes.filter(n => 
    typeof n.x === 'number' && typeof n.y === 'number' && typeof n.z === 'number' &&
    isFinite(n.x) && isFinite(n.y) && isFinite(n.z) &&
    !(n.x === 0 && n.y === 0 && n.z === 0)
  );
  
  console.log(`Before animation: ${positionedNodes.length}/${graphDataRef.current.nodes.length} nodes are positioned`);
  
  if (positionedNodes.length === 0) {
    console.warn("No nodes are positioned - forcing layout");
    if (graphRef.current) {
      graphRef.current.zoomToFit(2000);
      await new Promise(resolve => setTimeout(resolve, 2000));
    }
  }

  // Start the actual animation
  console.log("Starting seed node zoom...");
  zoomToNodes([...validSeedNodes], 120);
  await new Promise(resolve => setTimeout(resolve, 3000));

  // Animate through stages
  const allActivatedNodes = new Set([...validSeedNodes]);

  for (let stageIndex = 0; stageIndex < stages.length; stageIndex++) {
    const stage = stages[stageIndex];
    if (!stage) continue;

    console.log(`Processing stage ${stageIndex + 1}:`, stage);

    setCurrentStage({
      stage: `Stage ${stage.stage || stageIndex + 1}`,
      selected_nodes: stage.selected_nodes || [],
      propagated_nodes: stage.propagated_nodes || [],
      total_activated: stage.total_activated || 0,
      marginal_gain: stage.marginal_gain || 0,
      evaluations: stage.evaluations || 0
    });

    if (stage.propagated_nodes?.length) {
      // FIXED: Convert propagated nodes to strings and filter valid ones
      const propagatedNodesStr = stage.propagated_nodes
        .map(id => String(id))
        .filter(id => availableNodes.includes(id) && !seedNodesSet.has(id));

      if (propagatedNodesStr.length > 0) {
        console.log(`Adding ${propagatedNodesStr.length} propagated nodes`);
        propagatedNodesStr.forEach(n => allActivatedNodes.add(n));
        setActivatedNodes(new Set(allActivatedNodes));

        // Zoom to show all activated nodes
        zoomToNodes([...allActivatedNodes], 200);
        await new Promise(resolve => setTimeout(resolve, 2000));

        // Sparkle effect for new nodes
        await sparkleNodes([...propagatedNodesStr], "#FF0000", 1200);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    
    await new Promise(resolve => setTimeout(resolve, 500));
  }

  console.log("Animation sequence complete");
  setIsAnimating(false);
};

  // ADDED: Function to replay current saved run
  const replaySavedRun = () => {
    if (currentSavedRunData && isShowingSavedRun) {
      const { stages, seedNodes, algorithm } = currentSavedRunData;
      animateSavedRun(stages, seedNodes, algorithm);
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

  const handleRotateLeft = () => rotateCamera('right');
  const handleRotateRight = () => rotateCamera('left');

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

  const filteredRuns = savedRuns.filter(run =>
    (!filterNetwork || run.network_name === filterNetwork) &&
    (!filterModel || run.diffusion_model === filterModel) &&
    (!filterAlgorithm || run.algorithm === filterAlgorithm)
  );

  return (
    <>
      {showModal && (
        <div className="modal-overlay">
          <div className="modal-content">
            <h2>Select Saved Simulation</h2>
            
            <div className="filters">
              <select value={filterNetwork} onChange={(e) => setFilterNetwork(e.target.value)}>
                <option value="">All Networks</option>
                {[...new Set(savedRuns.map(run => run.network_name))].map(net => (
                  <option key={net} value={net}>{net}</option>
                ))}
              </select>

              <select value={filterModel} onChange={(e) => setFilterModel(e.target.value)}>
                <option value="">All Models</option>
                {[...new Set(savedRuns.map(run => run.diffusion_model))].map(model => (
                  <option key={model} value={model}>{model}</option>
                ))}
              </select>

              <select value={filterAlgorithm} onChange={(e) => setFilterAlgorithm(e.target.value)}>
                <option value="">All Algorithms</option>
                {[...new Set(savedRuns.map(run => run.algorithm))].map(algo => (
                  <option key={algo} value={algo}>{algo.replace(/_/g, ' ')}</option>
                ))}
              </select>
            </div>

            <div className="saved-runs-list">
              {filteredRuns.length === 0 ? (
                <div className="no-runs">No saved runs match your filters</div>
              ) : (
                filteredRuns.map(run => (
                  <div key={run.id} className="saved-run-item">
                    <div className="run-info">
                      <div className="run-header">
                        <div className="run-algorithm" style={{ 
                          backgroundColor: getAlgorithmColor(run.algorithm),
                          color: 'white',
                          padding: '4px 8px',
                          borderRadius: '4px',
                          fontWeight: 'bold'
                        }}>
                          {run.algorithm.replace(/_/g, ' ').toUpperCase()}
                        </div>
                        <div className="run-metrics">
                          <span className="spread">Spread: {run.spread}</span>
                          <span className="runtime">Runtime: {(run.runtime / 1000).toFixed(2)}s</span>
                        </div>
                      </div>
                      <div className="run-details">
                        <div className="detail-row">
                          <span><strong>Network:</strong> {run.network_name}</span>
                          <span><strong>Model:</strong> {run.diffusion_model}</span>
                        </div>
                        <div className="detail-row">
                          <span><strong>Seed Size:</strong> {run.seed_size}</span>
                          <span><strong>Date:</strong> {new Date(run.timestamp).toLocaleDateString()}</span>
                        </div>
                        {run.model_params && (
                          <div className="model-params">
                            <strong>Parameters:</strong> {
                              typeof run.model_params === 'string' 
                                ? run.model_params 
                                : JSON.stringify(run.model_params)
                            }
                          </div>
                        )}
                      </div>
                    </div>
                    <button 
                      className="load-run-button"
                      onClick={() => {
                        setSelectedRunId(run.id);
                        loadSavedRun(run.id);
                        setShowModal(false);
                      }}
                    >
                      Load Simulation
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="modal-actions">
              <button 
                className="close-button"
                onClick={() => setShowModal(false)}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="preview-wrapper">
        <div className="preview-container">
          <div className="graph-container">
            <ForceGraph3D
              ref={graphRef}
              graphData={processedGraphData}
              nodeRelSize={12}
              linkWidth={1}
              linkDirectionalParticles={0}
              linkDirectionalArrowLength={0}
              nodeLabel={() => ''}
              backgroundColor="#1e1e1e"
              enableNodeDrag={false}
              enableNavigationControls={true}
              showNavInfo={false}
              onEngineStop={() => {
                console.log("ForceGraph3D engine stopped - layout should be complete");
                const positionedCount = graphDataRef.current.nodes.filter(n => 
                  typeof n.x === 'number' && typeof n.y === 'number' && typeof n.z === 'number' &&
                  isFinite(n.x) && isFinite(n.y) && isFinite(n.z) &&
                  !(n.x === 0 && n.y === 0 && n.z === 0)
                ).length;
                console.log(`Engine stopped: ${positionedCount}/${graphDataRef.current.nodes.length} nodes positioned`);
                
                if (layoutReadyResolver) {
                  try {
                    layoutReadyResolver();
                    layoutReadyResolver = null; // Clear to prevent multiple calls
                  } catch (error) {
                    console.error("Error resolving layout promise:", error);
                  }
                }
              }}
            />

          </div>

          <div className="info-panel">
            {/* ADDED: Show current mode */}
            {isShowingSavedRun && (
              <div className="mode-indicator">
                <span className="saved-run-indicator">📁 Viewing Saved Run</span>
                <button 
                  className="restore-button"
                  onClick={restoreOriginalGraph}
                  disabled={isAnimating}
                >
                  ↩️ Back to Current Graph
                </button>
              </div>
            )}

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
              <div className="seed-size-info show">
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

          {processedGraphData && processedGraphData.nodes.length > 0 && (
            <div className="graph-controls-container">
              <div className="graph-controls">
                <button onClick={zoomIn}>➕ Zoom In</button>
                <button onClick={zoomOut}>➖ Zoom Out</button>
                <button onClick={handleRotateLeft}>⟲ Rotate Left</button>
                <button onClick={handleRotateRight}>⟳ Rotate Right</button>
              </div>
            </div>
          )}

          <div className="saved-run-controls">
            <div className="saved-run-buttons">
              <button onClick={() => setShowModal(true)}>
                Select a previous simulation
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default PreviewComponent;