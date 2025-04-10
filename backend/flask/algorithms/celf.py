import sys
import json
import os
import heapq
import logging
import numpy as np
import time
import multiprocessing as mp
from typing import List, Dict, Set, Tuple, Union

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'models')))

def setup_logging():
    log_dir = os.path.join(os.path.dirname(__file__), 'logs')
    os.makedirs(log_dir, exist_ok=True)
    log_file = os.path.join(log_dir, 'hyper_optimized_celf.log')
    
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

# Simplified node for the heap - minimal overhead
class CELFNode:
    __slots__ = ['node_id', 'marginal_gain', 'last_checked']
    
    def __init__(self, node_id, marginal_gain=0):
        self.node_id = node_id
        self.marginal_gain = marginal_gain
        self.last_checked = 0
    
    def __lt__(self, other):
        return self.marginal_gain > other.marginal_gain  # Max-heap

# Monte Carlo simulation function - batch version for faster evaluation
def batch_evaluate_nodes(args):
    model, nodes, seed_set, candidates, num_simulations, max_steps = args
    
    # Calculate spread of current seed set once (baseline)
    baseline_spread = monte_carlo_simulation(model, nodes, seed_set, num_simulations, max_steps)
    
    results = []
    for node in candidates:
        # Skip if already in seed set
        if node in seed_set:
            continue
            
        # Evaluate the node's marginal gain
        candidate_seeds = seed_set + [node]
        spread = monte_carlo_simulation(model, nodes, candidate_seeds, num_simulations, max_steps)
        marginal_gain = spread - baseline_spread
        
        results.append((node, marginal_gain))
    
    return results

# Simplified Monte Carlo with bounded propagation steps
def monte_carlo_simulation(
    model,
    nodes: Set[Union[str, int]],
    seed_nodes: List[Union[str, int]],
    num_simulations: int = 10,
    max_steps: int = 5
) -> float:
    """Run bounded Monte Carlo simulations to estimate influence spread."""
    spreads = []
    for _ in range(num_simulations):
        # Initialize with seed nodes
        activated = set(seed_nodes)
        current_frontier = set(seed_nodes)
        
        # Run propagation for limited steps
        for _ in range(max_steps):
            if not current_frontier:
                break
                
            newly_activated = set(model.propagate(list(current_frontier))) - activated
            if not newly_activated:
                break
                
            activated.update(newly_activated)
            current_frontier = newly_activated
        
        spreads.append(len(activated))
    
    return np.mean(spreads)

def hyper_optimized_celf(
    nodes: List[Union[str, int]],
    edges: List[Tuple[Union[str, int], Union[str, int]]],
    model_name: str,
    params: Dict[str, Union[int, float]]
) -> List[Dict[str, Union[int, List[Union[str, int]], str]]]:
    """
    Fully optimized CELF implementation that matches greedy's efficiency.
    
    Key optimizations:
    1. Bounded propagation with max_steps (like greedy)
    2. Simplified, efficient data structures
    3. Optimized parallelization strategy
    4. Batched node evaluation
    5. Minimal heap operations
    """
    start_time = time.time()
    logging.info("Starting Hyper-Optimized CELF algorithm")
    
    # Parameters
    k = max(1, min(params.get('seedSize', 10), len(nodes)))
    max_steps = max(1, min(params.get('maxSteps', 5), 20))
    num_simulations = params.get('numSimulations', 50)
    num_processes = min(params.get('numProcesses', mp.cpu_count()), mp.cpu_count())
    
    logging.info(f"Parameters: k={k}, num_simulations={num_simulations}, max_steps={max_steps}")

    # Initialize the propagation model
    if model_name == "linear_threshold":
        from propagation_models import OptimizedLinearThresholdModel
        model_params = {
            'threshold_range': params.get('thresholdRange', [0, 0.5])
        }
        model = OptimizedLinearThresholdModel(nodes, edges, **model_params)
    elif model_name == "independent_cascade":
        from propagation_models import IndependentCascadeModel
        model_params = {
            'propagation_probability': params.get('propagationProbability', 0.1)
        }
        model = IndependentCascadeModel(nodes, edges, **model_params)
    else:
        raise ValueError(f"Unsupported model: {model_name}")

    # Initialize for CELF algorithm
    seed_set = []
    remaining_nodes = set(nodes)
    stages = []
    cumulative_activated = set()
    celf_queue = []
    
    # Calculate initial marginal gains for all nodes using batched parallel evaluation
    logging.info("Calculating initial marginal gains")
    
    # Process nodes in batches for better parallelization
    batch_size = min(len(nodes) // num_processes, 100) 
    if batch_size < 1:
        batch_size = 1
        
    node_batches = [list(remaining_nodes)[i:i+batch_size] for i in range(0, len(remaining_nodes), batch_size)]
    
    with mp.Pool(processes=num_processes) as pool:
        batch_args = [(model, set(nodes), seed_set, batch, num_simulations, max_steps) for batch in node_batches]
        batch_results = pool.map(batch_evaluate_nodes, batch_args)
    
    # Combine results and build the queue
    for batch_result in batch_results:
        for node_id, gain in batch_result:
            celf_node = CELFNode(node_id, gain)
            heapq.heappush(celf_queue, celf_node)
    
    # Main CELF loop
    for iteration in range(k):
        if not celf_queue:
            logging.warning("Queue exhausted before reaching k seeds")
            break
            
        best_node = None
        evaluations = 0
        
        # Find the best node using lazy forward evaluation
        while celf_queue:
            evaluations += 1
            current_node = heapq.heappop(celf_queue)
            
            # Skip nodes already in seed set
            if current_node.node_id in seed_set:
                continue
                
            # If node was already evaluated in this iteration, it's the best one
            if current_node.last_checked == iteration:
                best_node = current_node
                break
                
            # Otherwise, reevaluate the node's marginal gain
            # Calculate new spread with this node added to seed set
            candidate_seeds = seed_set + [current_node.node_id]
            
            # Calculate current spread and candidate spread
            current_spread = monte_carlo_simulation(
                model, set(nodes), seed_set, num_simulations, max_steps
            )
            
            candidate_spread = monte_carlo_simulation(
                model, set(nodes), candidate_seeds, num_simulations, max_steps
            )
            
            # Update node's marginal gain
            current_node.marginal_gain = candidate_spread - current_spread
            current_node.last_checked = iteration
            
            # Re-insert into the queue
            heapq.heappush(celf_queue, current_node)
            
        # If we couldn't find a best node, break
        if not best_node:
            break
            
        # Add the best node to the seed set
        seed_set.append(best_node.node_id)
        remaining_nodes.remove(best_node.node_id)
        
        # Run propagation to get current activated nodes
        # Using bounded propagation (max_steps) like in greedy
        activated = set(seed_set)
        for _ in range(max_steps):
            newly_activated = set(model.propagate(list(activated))) - activated
            if not newly_activated:
                break
            activated.update(newly_activated)
        
        # Update cumulative activated set
        cumulative_activated.update(activated)
        
        # Record stage results
        stage_data = {
            "stage": iteration + 1,
            "selected_nodes": seed_set.copy(),
            "propagated_nodes": list(cumulative_activated),
            "total_activated": len(cumulative_activated),
            "marginal_gain": best_node.marginal_gain
        }
        stages.append(stage_data)
        
        logging.info(
            f"Stage {iteration+1}: Selected {best_node.node_id} "
            f"(mg={best_node.marginal_gain:.2f}), "
            f"Total activated: {len(cumulative_activated)}, "
            f"Evaluations: {evaluations}"
        )
    
    logging.info(f"CELF completed in {time.time() - start_time:.2f} seconds")
    
    return stages

if __name__ == "__main__":
    log_file = setup_logging()
    
    try:
        if len(sys.argv) != 5:
            raise ValueError("Usage: python hyper_optimized_celf.py <nodes_json> <edges_json> <model> <params_json>")
            
        nodes = json.loads(sys.argv[1])
        edges = json.loads(sys.argv[2])
        model = sys.argv[3]
        params = json.loads(sys.argv[4])
        
        stages = hyper_optimized_celf(nodes, edges, model, params)
        
        result_file = os.path.join(os.path.dirname(log_file), 'hyper_optimized_celf_results.json')
        with open(result_file, 'w') as f:
            json.dump(stages, f, indent=2)
        
        print(json.dumps(stages))
    
    except Exception as e:
        logging.error(f"Error: {str(e)}", exc_info=True)
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)