import sys
import json
import os
import heapq
import logging
import numpy as np
import time
from typing import List, Dict, Set, Tuple, Union
from collections import defaultdict


sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'models')))

def setup_logging():
    log_dir = os.path.join(os.path.dirname(__file__), 'logs')
    os.makedirs(log_dir, exist_ok=True)
    log_file = os.path.join(log_dir, 'optimized_celf.log')
    
    logging.basicConfig(
        filename=log_file,
        level=logging.INFO,
        format='%(asctime)s - %(levelname)s - %(message)s',
        filemode='w'
    )
    
    console_handler = logging.StreamHandler()
    console_handler.setLevel(logging.INFO)
    console_formatter = logging.Formatter('%(levelname)s - %(message)s')
    console_handler.setFormatter(console_formatter)
    logging.getLogger().addHandler(console_handler)
    
    return log_file

class CELFNode:
    __slots__ = ['node_id', 'marginal_gain', 'iteration', 'flag']
    
    def __init__(self, node_id):
        self.node_id = node_id
        self.marginal_gain = -1
        self.iteration = -1
        self.flag = False
    
    def __lt__(self, other):
        return self.marginal_gain > other.marginal_gain  # Max-heap

def monte_carlo_simulation(
    model,
    nodes: Set[Union[str, int]],
    seed_nodes: List[Union[str, int]],
    num_simulations: int = 10,
    early_stop_threshold: int = None
) -> float:
    spreads = []
    for i in range(num_simulations):
        current_seed = seed_nodes.copy()
        activated = set(current_seed)
        newly_activated = set(current_seed)
        
        while newly_activated:
            current_seed = list(newly_activated)
            newly_activated = set(model.propagate(current_seed)) - activated
            activated.update(newly_activated)
            
            if early_stop_threshold and len(activated) >= early_stop_threshold:
                break
        
        spreads.append(len(activated))
    
    return np.mean(spreads)

def celf_algorithm(
    nodes: List[Union[str, int]],
    edges: List[Tuple[Union[str, int], Union[str, int]]],
    model_name: str,
    params: Dict[str, Union[int, float]]
) -> List[Dict[str, Union[int, List[Union[str, int]], str]]]:

    start_time = time.time()
    logging.info("Starting OPTIMIZED CELF algorithm")
    
    k = max(1, min(params.get('seedSize', 10), len(nodes)))
    num_simulations = params.get('numSimulations', 50)
    early_stop_threshold = params.get('earlyStopThreshold', None)
    
    logging.info(f"Parameters: k={k}, num_simulations={num_simulations}")

    # initializam modelul de propagare
    model_params = {}
    if model_name == "linear_threshold":
        from propagation_models import LinearThresholdModel
        model_params['threshold_range'] = params.get('thresholdRange', [0, 0.5])
        model = LinearThresholdModel(nodes, edges, **model_params)
    elif model_name == "independent_cascade":
        from propagation_models import IndependentCascadeModel
        model_params['propagation_probability'] = params.get('propagationProbability', 0.1)
        model = IndependentCascadeModel(nodes, edges, **model_params)
    else:
        raise ValueError(f"Unknown model: {model_name}")

    heap = []
    node_data = {node: CELFNode(node) for node in nodes}
    seed_set = []
    stages = []
    total_spread = 0
    
    logging.info("Calculating initial marginal gains")
    for node in nodes:
        celf_node = node_data[node]
        celf_node.marginal_gain = monte_carlo_simulation(
            model, set(nodes), [node], 
            num_simulations=min(10, num_simulations),
            early_stop_threshold=early_stop_threshold
        )
        celf_node.iteration = 0
        heapq.heappush(heap, celf_node)
    
    #CELF loop
    for iteration in range(1, k + 1):
        while True:
            if not heap:
                logging.warning("Heap exhausted before reaching k seeds")
                break
            
            current_node = heap[0]
            
            if current_node.iteration != iteration:
                candidate_seeds = seed_set + [current_node.node_id]
                
                #calculam marginal gain
                current_node.marginal_gain = monte_carlo_simulation(
                    model, set(nodes), candidate_seeds, 
                    num_simulations=num_simulations,
                    early_stop_threshold=early_stop_threshold
                ) - total_spread
                
                current_node.iteration = iteration
                heapq.heapreplace(heap, current_node)
            else:
                break
        
        # adaugam nodul cu cel mai bun scor
        best_node = heapq.heappop(heap)
        seed_set.append(best_node.node_id)
        total_spread += best_node.marginal_gain
        
        # rulam procesul de propagare pentru a salva multimea nodurilor influentate
        activated = set(seed_set)
        newly_activated = set(seed_set)
        while newly_activated:
            current_seed = list(newly_activated)
            newly_activated = set(model.propagate(current_seed)) - activated
            activated.update(newly_activated)
        
        # stage data
        stage_data = {
            "stage": iteration,
            "selected_nodes": seed_set.copy(),
            "propagated_nodes": list(activated),
            "total_activated": len(activated),
            "marginal_gain": best_node.marginal_gain,
            "elapsed_time": time.time() - start_time
        }
        stages.append(stage_data)
        logging.info(
            f"Stage {iteration}: Selected {best_node.node_id} "
            f"(mg={best_node.marginal_gain:.2f}), "
            f"Total activated: {len(activated)}"
        )
    
    logging.info(f"CELF completed in {time.time() - start_time:.2f} seconds")
    return stages

if __name__ == "__main__":
    log_file = setup_logging()
    
    try:
        if len(sys.argv) != 5:
            raise ValueError("Usage: python optimized_celf.py <nodes_json> <edges_json> <model> <params_json>")
            
        nodes = json.loads(sys.argv[1])
        edges = json.loads(sys.argv[2])
        model = sys.argv[3]
        params = json.loads(sys.argv[4])
        
        stages = celf_algorithm(nodes, edges, model, params)
        
        result_file = os.path.join(os.path.dirname(log_file), 'optimized_celf_results.json')
        with open(result_file, 'w') as f:
            json.dump(stages, f, indent=2)
        
        print(json.dumps(stages))
    
    except Exception as e:
        logging.error(f"Error: {str(e)}", exc_info=True)
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)