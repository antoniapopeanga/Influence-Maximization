import { AnimationController } from './AnimationController';

export class SavedRunAnimator extends AnimationController {
  constructor(graphRef, graphDataRef, stateSetters) {
    super(graphRef, graphDataRef);
    this.stateSetters = stateSetters;
  }

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

  //animatia pentru simulari precedente
  animateSavedRun = async (stages, seedNodes, algorithm) => {
    if (!stages || !seedNodes || !algorithm) {
      console.error('Invalid saved run data:', { stages, seedNodes, algorithm });
      return;
    }

    console.log('Starting saved run animation');

    this.clearAnimationData();
    this.stateSetters.setActiveAlgorithm(algorithm);
    this.stateSetters.setIsAnimating(true);
    this.stateSetters.setCurrentSeedSize(seedNodes.length);

    const seedNodesStr = seedNodes.map(id => String(id));
    const availableNodes = this.graphDataRef.current.nodes.map(n => String(n.id));
    const validSeedNodes = seedNodesStr.filter(id => availableNodes.includes(id));
    
    if (validSeedNodes.length === 0) {
      console.error('No valid seed nodes found in current graph');
      this.stateSetters.setIsAnimating(false);
      return;
    }

    const seedNodesSet = new Set(validSeedNodes);
    const algorithmColor = this.getAlgorithmColor(algorithm);
    
    // coloram seed nodes
    this.graphDataRef.current.nodes.forEach(node => {
      if (seedNodesSet.has(String(node.id))) {
        node.__algorithm = algorithm;
        node.color = algorithmColor;
      }
    });
    
    this.stateSetters.setSeedNodes(seedNodesSet);
    this.stateSetters.setActivatedNodes(seedNodesSet);
    
    if (this.graphRef.current) {
      this.graphRef.current.refresh();
    }

    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // se verifica daca nodurile au fost pozitionate
    const positionedNodes = this.graphDataRef.current.nodes.filter(n => 
      typeof n.x === 'number' && typeof n.y === 'number' && typeof n.z === 'number' &&
      isFinite(n.x) && isFinite(n.y) && isFinite(n.z) &&
      !(n.x === 0 && n.y === 0 && n.z === 0)
    );
    
    if (positionedNodes.length === 0) {
      console.warn("No nodes are positioned - forcing layout");
      if (this.graphRef.current) {
        this.graphRef.current.zoomToFit(2000);
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    }

    // inceperea animatiei
    if (validSeedNodes.length > 0) {
      this.zoomToNodes(validSeedNodes, 120);
      await new Promise(resolve => setTimeout(resolve, 1500));
      
      // evidentierea nodurilor de seed
      await this.sparkleNodes(validSeedNodes, algorithmColor, 1500);
      this.stateSetters.setHighlightedNodes(seedNodesSet);
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    const allActivatedNodes = new Set([...validSeedNodes]);

    for (let stageIndex = 0; stageIndex < stages.length; stageIndex++) {
      const stage = stages[stageIndex];
      if (!stage) continue;

      this.stateSetters.setCurrentStage({
        stage: `Stage ${stage.stage || stageIndex + 1}`,
        selected_nodes: stage.selected_nodes || [],
        propagated_nodes: stage.propagated_nodes || [],
        total_activated: stage.total_activated || 0,
        marginal_gain: stage.marginal_gain || 0,
        evaluations: stage.evaluations || 0
      });

      if (stage.propagated_nodes?.length) {
        const propagatedNodesStr = stage.propagated_nodes
          .map(id => String(id))
          .filter(id => availableNodes.includes(id) && !seedNodesSet.has(id));

        if (propagatedNodesStr.length > 0) {
          propagatedNodesStr.forEach(n => allActivatedNodes.add(n));
          this.stateSetters.setActivatedNodes(new Set(allActivatedNodes));

          this.zoomToNodes([...allActivatedNodes], 200);
          await new Promise(resolve => setTimeout(resolve, 2000));

          await this.sparkleNodes([...propagatedNodesStr], "#FF0000", 1200);
          await new Promise(resolve => setTimeout(resolve, 1000));
        }
      }
      
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log("Animation ended")
    this.stateSetters.setIsAnimating(false);
    this.stateSetters.setCurrentSeedSize(null);
  };
}