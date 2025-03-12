import React, { useRef, useEffect, useState } from "react";
import ForceGraph3D from "react-force-graph-3d";

const PreviewComponent = ({ graphData }) => {
  const graphRef = useRef();
  const [currentStage, setCurrentStage] = useState(null);
  const [isAnimating, setIsAnimating] = useState(false);
  const [highlightedNodes, setHighlightedNodes] = useState(new Set());

  // Create processed graph data only once when graphData changes
  const processedGraphData = React.useMemo(() => {
    return graphData
      ? {
          nodes: graphData.nodes.map((id) => ({
            id,
            color: "blue", // Default color
            __highlighted: false // Add a flag to track highlight state
          })),
          links: graphData.edges.map(([source, target]) => ({ source, target })),
        }
      : { nodes: [], links: [] };
  }, [graphData]);

  // Store a reference to the processed data so we can modify it directly
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
  }, [graphData]); // Runs only when `graphData` changes

  // Update node colors directly without recreating the graph data
  useEffect(() => {
    if (graphRef.current && graphDataRef.current.nodes.length > 0) {
      // Get the nodes directly from our reference
      const graphNodes = graphDataRef.current.nodes;
      
      // Update each node's color based on whether it's highlighted
      graphNodes.forEach(node => {
        const isHighlighted = highlightedNodes.has(node.id);
        
        // Only update if the highlight state changed
        if (isHighlighted !== node.__highlighted) {
          node.color = isHighlighted ? "red" : "blue";
          node.__highlighted = isHighlighted;
        }
      });
      
      // Force the graph to re-render without rebuilding the data structure
      graphRef.current.refresh();
    }
  }, [highlightedNodes]);

  // Function to start animation
  const startAnimation = () => {
    if (!graphData?.algorithm_stages || isAnimating) return; // Prevent multiple intervals

    setIsAnimating(true);
    setCurrentStage(null); // Reset current stage
    setHighlightedNodes(new Set()); // Reset highlighted nodes

    let stageIndex = 0;
    const interval = setInterval(() => {
      if (stageIndex < graphData.algorithm_stages.length) {
        const newStage = graphData.algorithm_stages[stageIndex];
        setCurrentStage(newStage);

        setHighlightedNodes((prev) => {
          const updatedNodes = new Set(prev);

          // Check for 'selected_nodes' in the first stage
          if (newStage.selected_nodes) {
            newStage.selected_nodes.forEach((node) => updatedNodes.add(node));
          }

          // Check for 'propagated_nodes' in all stages
          if (newStage.propagated_nodes) {
            newStage.propagated_nodes.forEach((node) => updatedNodes.add(node));
          }

          return updatedNodes;
        });

        stageIndex++;
      } else {
        clearInterval(interval);
        setIsAnimating(false);
      }
    }, 2000);
  };

  // Handle button click to start animation
  const handleRunAlgorithm = () => {
    startAnimation();
  };

  if (!graphData || !graphData.nodes || !graphData.edges) {
    return (
      <div
        style={{
          display: "flex",
          justifyContent: "center",
          alignItems: "center",
          height: "100%",
        }}
      >
        Please select options and run the algorithm to see the results.
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>
      <div style={{ display: "flex", flex: 1 }}>
        <div style={{ flex: 1, background: "#1e1e1e" }}>
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

        {/* Display algorithm stages */}
        {currentStage && (
          <div
            style={{
              flex: 1,
              padding: 20,
              color: "#fff",
              background: "#2d2d2d",
              overflowY: "auto",
            }}
          >
            <h3>Current Stage: {currentStage.stage}</h3>
            <pre>{JSON.stringify(currentStage, null, 2)}</pre>
          </div>
        )}
      </div>

      <div
        style={{
          padding: "10px",
          background: "#2d2d2d",
          display: "flex",
          justifyContent: "center",
        }}
      >
        <button
          onClick={handleRunAlgorithm}
          style={{
            padding: "10px 20px",
            fontSize: "16px",
            backgroundColor: "#4CAF50",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
          disabled={isAnimating || !graphData?.algorithm_stages}
        >
          {isAnimating ? "Running..." : "Run Algorithm Animation"}
        </button>
      </div>
    </div>
  );
};

export default PreviewComponent;