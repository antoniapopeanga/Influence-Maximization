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
              nodeObj.color = getAlgorithmColor(algorithm);
            }
          });
        }
        
        setSeedNodes(seedNodes);
        setHighlightedNodes(seedNodes);
        setActivatedNodes(prev => new Set([...prev, ...seedNodes]));

        await new Promise(resolve => setTimeout(resolve, 1500));
            
  
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
  
        await new Promise(resolve => setTimeout(resolve, 3000));
      }
  
      await new Promise(resolve => setTimeout(resolve, 2000));
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
  
  

  return (
    <div className="preview-wrapper">
    <div className="preview-container">
      <div className="graph-container">
          <ForceGraph3D
            ref={graphRef}
            graphData={processedGraphData}
            nodeRelSize={18}
            linkWidth={4}
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
    </div>
    </div>
  );
};

export default PreviewComponent;