import React, { useRef, useEffect, useState } from "react";
import ForceGraph3D from "react-force-graph-3d";
import {CurrentSimulationAnimator} from './CurrentSimulationAnimator';
import  {SavedRunAnimator} from './SavedRunAnimator';
import axios from 'axios';
import "../css/PreviewComponent.css";

const PreviewComponent = ({ graphData, isLoading, selectedAlgorithms,isShowingSavedRun,setIsShowingSavedRun }) => {
  const graphRef = useRef();
  const graphDataRef = useRef({ nodes: [], links: [] });
  let layoutReadyResolver = null;

  
  // State variables
  const [currentStage, setCurrentStage] = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [highlightedNodes, setHighlightedNodes] = useState(new Set());
  const [activeAlgorithm, setActiveAlgorithm] = useState(null);
  const [comparisonResults, setComparisonResults] = useState([]);
  const [seedNodes, setSeedNodes] = useState(new Set());
  const [activatedNodes, setActivatedNodes] = useState(new Set());
  const [selectedRunId, setSelectedRunId] = useState(null);
  const [currentSeedSize, setCurrentSeedSize] = useState(null);
  const [savedRuns, setSavedRuns] = useState([]);
  const [processedGraphData, setProcessedGraphData] = useState({ nodes: [], links: [] });
  const [originalGraphData, setOriginalGraphData] = useState({ nodes: [], links: [] });
  const [currentSavedRunData, setCurrentSavedRunData] = useState(null);
  const [showModal, setShowModal] = useState(false);
  const [filterNetwork, setFilterNetwork] = useState("");
  const [filterModel, setFilterModel] = useState("");
  const [filterAlgorithm, setFilterAlgorithm] = useState("");


  // Add these refs at the top of your component
  const layoutReadyResolverRef = useRef(null);
  const engineStoppedCountRef = useRef(0);

  // Create animators with state setters
  const stateSetters = {
    setCurrentStage,
    setIsAnimating,
    setHighlightedNodes,
    setActiveAlgorithm,
    setComparisonResults,
    setSeedNodes,
    setActivatedNodes,
    setCurrentSeedSize,

  };

  const currentSimAnimator = useRef(new CurrentSimulationAnimator(graphRef, graphDataRef, stateSetters));
  const savedRunAnimator = useRef(new SavedRunAnimator(graphRef, graphDataRef, stateSetters));

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


  // Process graph data
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

    setOriginalGraphData(formatted);
    setProcessedGraphData(formatted);
    graphDataRef.current = formatted;
    
    setIsShowingSavedRun(false);
    setCurrentSavedRunData(null);
  }, [graphData]);

  // Animation handlers
  const startAnimation = (algorithm) => {
    if (isShowingSavedRun) {
      restoreOriginalGraph();
    }
    currentSimAnimator.current.startAnimation(algorithm, graphData);
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

      // Remove duplicates from seedNodes
      const uniqueSeedNodes = [...new Set(seedNodes)];

      const formattedGraphData = {
        nodes: data.graph_data.nodes.map(id => ({
          id,
          color: "#4682B4",
          __highlighted: false,
          __algorithm: null
        })),
        links: data.graph_data.edges.map(([source, target]) => ({ source, target }))
      };
      
      graphDataRef.current = formattedGraphData;
      setProcessedGraphData(formattedGraphData);
      setIsShowingSavedRun(true);
      
      setCurrentSavedRunData({
        stages,
        seedNodes: uniqueSeedNodes,
        algorithm: data.algorithm
      });

      savedRunAnimator.current.clearAnimationData();
      
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      if (graphRef.current) {
        graphRef.current.refresh();
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
      
      savedRunAnimator.current.animateSavedRun(stages, seedNodes, data.algorithm);
      
    } catch (error) {
      console.error('Error loading saved run:', error);
      alert(`Failed to load saved run: ${error.message}`);
    }
  };

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
      currentSimAnimator.current.clearAnimationData();
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
                const count = ++engineStoppedCountRef.current;
                console.log(`Engine stop event #${count}`);
                
                const positionedNodes = graphDataRef.current.nodes.filter(n => 
                  typeof n.x === 'number' && 
                  typeof n.y === 'number' && 
                  typeof n.z === 'number' &&
                  !isNaN(n.x) && !isNaN(n.y) && !isNaN(n.z) &&
                  !(n.x === 0 && n.y === 0 && n.z === 0)
                );
                
                console.log(`Positioned nodes: ${positionedNodes.length}/${graphDataRef.current.nodes.length}`);
                
                // Only resolve if we have most nodes positioned
                if (positionedNodes.length > graphDataRef.current.nodes.length * 0.9) {
                  if (layoutReadyResolverRef.current) {
                    console.log('Resolving layout promise');
                    layoutReadyResolverRef.current();
                    layoutReadyResolverRef.current = null;
                  }
                } else if (count > 3) {
                  // After 3 engine stops, force completion
                  console.warn('Forcing layout completion after multiple engine stops');
                  if (layoutReadyResolverRef.current) {
                    layoutReadyResolverRef.current();
                    layoutReadyResolverRef.current = null;
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

            {!isShowingSavedRun && comparisonResults.length > 0 && (
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
        {!isShowingSavedRun &&
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
          }

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