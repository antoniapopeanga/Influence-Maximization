import React from 'react';

export class AnimationController {
  constructor(graphRef, graphDataRef) {
    this.graphRef = graphRef;
    this.graphDataRef = graphDataRef;
  }

  getAlgorithmColor = (algorithm) => {
    const colors = {
      classic_greedy: "rgb(255, 105, 180)", // hot pink
      random_selection: "rgb(50, 205, 50)", // lime green
      degree_heuristic: "rgb(79, 15, 206)", // medium purple
      centrality_heuristic: "rgb(255, 215, 0)", // gold
      celf: "rgb(19, 192, 169)", // turquoise
    };
    return algorithm ? colors[algorithm] : null;
  };

  //zoom automat pentru realizarea animatiei
  zoomToNodes = (nodeIds, zoomDistance = 150) => {
    if (!this.graphRef.current || !this.graphDataRef.current || nodeIds.length === 0) {
      console.warn("Missing graph reference or node IDs");
      return;
    }

    console.log('Attempting to zoom to', nodeIds.length, 'nodes:', nodeIds);

    const attemptZoom = (attempt = 1, maxAttempts = 15) => {
      setTimeout(() => {
        const allNodes = this.graphDataRef.current.nodes;
        const targetNodeIds = nodeIds.map(id => String(id));
        const targetNodes = allNodes.filter(n => targetNodeIds.includes(String(n.id)));
        
        if (targetNodes.length === 0) {
          console.error("No target nodes found in graph data");
          return;
        }

        const positionedNodes = targetNodes.filter(n => {
          const hasPosition = n.x !== undefined && n.y !== undefined && n.z !== undefined;
          const isValidPosition = typeof n.x === 'number' && typeof n.y === 'number' && typeof n.z === 'number';
          const isFinitePosition = isFinite(n.x) && isFinite(n.y) && isFinite(n.z);
          const isNonZero = !(n.x === 0 && n.y === 0 && n.z === 0);
          
          return hasPosition && isValidPosition && isFinitePosition && isNonZero;
        });

        if (positionedNodes.length > 0) {
          const center = {
            x: positionedNodes.reduce((sum, n) => sum + n.x, 0) / positionedNodes.length,
            y: positionedNodes.reduce((sum, n) => sum + n.y, 0) / positionedNodes.length,
            z: positionedNodes.reduce((sum, n) => sum + n.z, 0) / positionedNodes.length
          };

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

          try {
            this.graphRef.current.cameraPosition(
              { x: center.x, y: center.y, z: center.z + adaptiveZoomDistance },
              center,
              1500
            );
          } catch (error) {
            console.error("Error during zoom:", error);
          }
          
          return;
        }

        if (attempt < maxAttempts) {
          if (attempt === 3 && this.graphRef.current) {
            this.graphRef.current.refresh();
          }
          attemptZoom(attempt + 1, maxAttempts);
        } else {
          console.error(`Failed to find positioned nodes after ${maxAttempts} attempts`);
          if (this.graphRef.current) {
            this.graphRef.current.zoomToFit(2000);
          }
        }
      }, attempt === 1 ? 500 : 1000);
    };

    attemptZoom();
  };

  //functie pentru a face nodurile sa palpaie
  sparkleNodes = async (nodeIds, color, duration = 1500, interval = 200) => {
    const nodeIdsStr = nodeIds.map(id => String(id));
    const nodes = this.graphDataRef.current.nodes.filter(n => nodeIdsStr.includes(String(n.id)));

    const sparkleSteps = Math.floor(duration / interval);
    for (let i = 0; i < sparkleSteps; i++) {
      nodes.forEach(node => {
        node.color = i % 2 === 0 
          ? color.replace('rgb', 'rgba').replace(')', ', 1)')
          : color.replace('rgb', 'rgba').replace(')', ', 0.3)');
      });
      this.graphRef.current.refresh();
      await new Promise(resolve => setTimeout(resolve, interval));
    }

    nodes.forEach(node => {
      node.color = color;
    });
    this.graphRef.current.refresh();
  };
}
