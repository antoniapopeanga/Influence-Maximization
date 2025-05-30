// CurrentSimulationAnimator.js - Handles current graph data animations
import { AnimationController } from './AnimationController';

export class CurrentSimulationAnimator extends AnimationController {
  constructor(graphRef, graphDataRef, stateSetters) {
    super(graphRef, graphDataRef);
    this.stateSetters = stateSetters;
  }

  // Helper function to compare two sets for equality
  setsEqual = (set1, set2) => {
    if (set1.size !== set2.size) return false;
    for (let item of set1) {
      if (!set2.has(item)) return false;
    }
    return true;
  };

  // Helper function to find the last unique stage index
  findLastUniqueStageIndex = (stages) => {
    if (stages.length <= 1) return stages.length - 1;
    
    let lastUniqueIndex = 0;
    let previousSeedNodes = new Set();
    let previousPropagatedNodes = new Set();
    
    for (let i = 0; i < stages.length; i++) {
      const currentSeedNodes = new Set(stages[i].selected_nodes || []);
      const currentPropagatedNodes = new Set(stages[i].propagated_nodes || []);
      
      // If this stage is different from the previous one, update last unique index
      if (i === 0 || 
          !this.setsEqual(currentSeedNodes, previousSeedNodes) || 
          !this.setsEqual(currentPropagatedNodes, previousPropagatedNodes)) {
        lastUniqueIndex = i;
      }
      
      previousSeedNodes = currentSeedNodes;
      previousPropagatedNodes = currentPropagatedNodes;
    }
    
    return lastUniqueIndex;
  };

  clearAnimationData = () => {
    this.stateSetters.setHighlightedNodes(new Set());
    this.stateSetters.setCurrentStage(null);
    this.stateSetters.setActivatedNodes(new Set());
    this.stateSetters.setCurrentSeedSize(null);
    this.stateSetters.setSeedNodes(new Set());
    
    if (this.graphDataRef.current) {
      this.graphDataRef.current.nodes.forEach(node => {
        node.__algorithm = null;
        node.color = "#4682B4"; 
      });
    }
    
    if (this.graphRef.current) {
      this.graphRef.current.refresh();
    }
  };

  startAnimation = async (algorithm, graphData) => {
    if (!graphData?.algorithm_results?.[algorithm]) {
      console.warn(`No results found for algorithm ${algorithm} in current graph data`);
      return;
    }

    this.clearAnimationData();
    await new Promise(resolve => setTimeout(resolve, 500));

    console.log("Starting animation")

    const algorithmResults = graphData.algorithm_results[algorithm];
    
    this.stateSetters.setActiveAlgorithm(algorithm);
    this.stateSetters.setIsAnimating(true);

    const seedSizes = Object.keys(algorithmResults.stages_by_seed)
      .map(Number)
      .sort((a, b) => a - b);

    for (const seedSize of seedSizes) {
      this.clearAnimationData();
      this.stateSetters.setCurrentSeedSize(seedSize);
      
      await new Promise(resolve => setTimeout(resolve, 1000));

      const stages = algorithmResults.stages_by_seed[seedSize];
      
      if (!stages || stages.length === 0) {
        console.warn(`No stages found for seed size ${seedSize}`);
        continue;
      }

      // Find the last unique stage to avoid animating repetitive data
      const lastUniqueStageIndex = this.findLastUniqueStageIndex(stages);
      console.log(`Animating ${lastUniqueStageIndex + 1} out of ${stages.length} stages for seed size ${seedSize}`);

      // Collect all seed nodes for this seed size (from unique stages only)
      const seedNodesSet = new Set();
      for (let i = 0; i <= lastUniqueStageIndex; i++) {
        if (stages[i].selected_nodes) {
          stages[i].selected_nodes.forEach(node => seedNodesSet.add(node));
        }
      }

      // Color all seed nodes with algorithm color BEFORE starting stage animation
      if (seedNodesSet.size > 0) {
        const color = this.getAlgorithmColor(algorithm);
        seedNodesSet.forEach(node => {
          const nodeObj = this.graphDataRef.current.nodes.find(n => String(n.id) === String(node));
          if (nodeObj) {
            nodeObj.__algorithm = algorithm;
            nodeObj.color = color;
          }
        });
        
        // Update state and refresh graph
        this.stateSetters.setSeedNodes(seedNodesSet);
        this.stateSetters.setActivatedNodes(prev => new Set([...prev, ...seedNodesSet]));
        
        if (this.graphRef.current) {
          this.graphRef.current.refresh();
        }
        
        await new Promise(resolve => setTimeout(resolve, 500));
      }

      const allActivatedNodes = new Set([...seedNodesSet]);

      // Only animate up to the last unique stage
      for (let stageIndex = 0; stageIndex <= lastUniqueStageIndex; stageIndex++) {
        const newStage = stages[stageIndex];
        this.stateSetters.setCurrentStage({...newStage, algorithm});

        // Seed nodes phase - just highlight them (they're already colored)
        const seedNodes = new Set();
        if (Array.isArray(newStage.selected_nodes)) {
          newStage.selected_nodes.forEach(node => {
            seedNodes.add(node);
          });
        }
        
        if (seedNodes.size > 0) {
          this.zoomToNodes([...seedNodes], 120);
          await new Promise(resolve => setTimeout(resolve, 1500));
          
          // Sparkle the seed nodes
          const algorithmColor = this.getAlgorithmColor(algorithm);
          await this.sparkleNodes([...seedNodes], algorithmColor, 1500);
          this.stateSetters.setHighlightedNodes(seedNodes);
          await new Promise(resolve => setTimeout(resolve, 1500));
        }

        // Propagation phase
        console.log("--- Stage Debug ---");
        console.log("Current stage:", newStage);
        console.log("Propagated nodes in stage data:", newStage.propagated_nodes);
        console.log("Seed nodes in stage data:", newStage.selected_nodes);

        const propagatedNodes = new Set();
        if (Array.isArray(newStage.propagated_nodes)) {
          console.log("Processing propagated nodes..."); // Should appear if array exists
          newStage.propagated_nodes.forEach(node => {
            if (!seedNodesSet.has(node)) {
              propagatedNodes.add(node);
              allActivatedNodes.add(node);
            }
          });
        }
        console.log("Final propagatedNodes Set:", propagatedNodes); // Check if populated

        if (propagatedNodes.size > 0) {
          this.zoomToNodes([...allActivatedNodes], 200);
          await new Promise(resolve => setTimeout(resolve, 1200));
          
          this.stateSetters.setHighlightedNodes(propagatedNodes);
          // In the propagation phase:
          console.log("All nodes in graph:", this.graphDataRef.current.nodes); // Debug all nodes
          propagatedNodes.forEach(node => {
            const nodeObj = this.graphDataRef.current.nodes.find(n => String(n.id) === String(node));
            console.log(`Searching for node ${node} - Found:`, nodeObj); // Debug node lookup
            if (nodeObj) {
              nodeObj.color = "#FF0000"; // Force red
              nodeObj.__algorithm = algorithm;
              console.log(`Set color for node ${node} to red`); // Debug color assignment
            } else {
              console.warn(`Node ${node} not found in graph data!`); // Debug missing nodes
            }
          });
          this.graphRef.current.refresh();
          await new Promise(resolve => setTimeout(resolve, 100));
          
          this.stateSetters.setActivatedNodes(prev => new Set([...prev, ...propagatedNodes]));
          
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      await new Promise(resolve => setTimeout(resolve, 1500));
    }

    await new Promise(resolve => setTimeout(resolve, 1000));
    this.stateSetters.setIsAnimating(false);
    this.stateSetters.setCurrentSeedSize(null);
    
    if (algorithmResults.metrics) {
      this.stateSetters.setComparisonResults(prev => [
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
}