import sys
import json
import os
import random
import logging

from typing import List, Dict, Set, Tuple, Union

# Configure logging once at the top level
log_dir = os.path.join(os.path.dirname(__file__), 'logs')
os.makedirs(log_dir, exist_ok=True)
log_file = os.path.join(log_dir, 'debug.log')
logging.basicConfig(
    filename=log_file,
    level=logging.DEBUG,
    format='%(asctime)s - %(levelname)s - %(message)s'
)

# Log the location of the debug file for convenience
print(f"Logging to: {log_file}")

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'models')))
from propagation_models import LinearThresholdModel, IndependentCascadeModel

def greedy_algorithm(
    nodes: List[Union[str, int]],
    edges: List[Tuple[Union[str, int], Union[str, int]]],
    model_name: str,
    params: Dict[str, Union[int, float]]
) -> List[Dict[str, Union[int, List[Union[str, int]], str]]]:
    """
    Greedy algorithm with influence calculated based on parallel edges count,
    but keeping the propagation models for the actual spread.
    """
    logging.debug(f"Starting greedy algorithm (parallel edges version) with model: {model_name}, params: {params}")
    
    # Validate parameters with defaults
    params = params or {}
    k = max(1, min(params.get('seedSize', 10), len(nodes)))
    max_steps = max(1, min(params.get('maxSteps', 5), 20))
    
    logging.debug(f"Using k={k}, max_steps={max_steps}")
    
    try:
        if model_name == "linear_threshold":
            model = LinearThresholdModel(nodes, edges)
            logging.debug("Initialized LinearThresholdModel")
        elif model_name == "independent_cascade":
            model = IndependentCascadeModel(nodes, edges)
            logging.debug("Initialized IndependentCascadeModel")
        else:
            raise ValueError(f"Unknown model: {model_name}")
    except Exception as e:
        logging.error(f"Model initialization failed: {str(e)}")
        raise ValueError(f"Model initialization failed: {str(e)}")

    # Precompute parallel edges and node degrees for influence calculation
    parallel_edges = {}
    in_degree = {node: 0 for node in nodes}
    
    for u, v in edges:
        parallel_edges[(u, v)] = parallel_edges.get((u, v), 0) + 1
        in_degree[v] += 1

    # Greedy selection of seed nodes using parallel edges for influence estimation
    A: Set[Union[str, int]] = set()
    remaining_nodes = set(nodes)
    stages = []
    
    logging.debug(f"Starting seed selection, target seed size: {k}")

    for i in range(k):
        if not remaining_nodes:
            logging.debug("No remaining nodes to select from")
            break
            
        max_node = None
        max_influence = -1
        
        logging.debug(f"Iteration {i+1}/{k}, evaluating {len(remaining_nodes)} candidate nodes")
        
        for node in remaining_nodes:
            # Calculate influence based on parallel edges
            influence = 0
            neighbors = set()
            
            # Find all neighbors this node can influence
            for (u, v), count in parallel_edges.items():
                if u == node and v not in A:
                    neighbors.add(v)
            
            # Model-specific influence calculation
            if model_name == "linear_threshold":
                for v in neighbors:
                    if in_degree[v] > 0:
                        influence += parallel_edges.get((node, v), 0) / in_degree[v]
            elif model_name == "independent_cascade":
                p = params.get('propagationProbability', 0.1)
                for v in neighbors:
                    influence += 1 - (1 - p) ** parallel_edges.get((node, v), 0)
            
            logging.debug(f"Node {node} has influence {influence}")
                
            if influence > max_influence:
                max_influence = influence
                max_node = node
                logging.debug(f"New max influence: {max_influence} from node {max_node}")
                
        if max_node is None:
            logging.debug("No node with positive influence found")
            break
            
        A.add(max_node)
        remaining_nodes.remove(max_node)
        
        # ACTUAL PROPAGATION with the selected seed set
        activated = set(A)
        current_A = set(A)
        
        for step in range(max_steps):
            current_A = set(model.propagate(current_A))
            activated.update(current_A)
        
        stage_data = {
            "stage": len(stages) + 1,
            "selected_nodes": list(A),
            "propagated_nodes": list(activated),
            "total_activated": len(activated),
            "marginal_gain": len(activated)  # Or use max_influence if preferred
        }
        
        stages.append(stage_data)
        logging.debug(f"Added node {max_node} to seed set, current seed set: {list(A)}")

    logging.debug(f"Greedy algorithm completed, returning {len(stages)} stages")
    return stages


if __name__ == "__main__":
    try:
        logging.debug("Script started")
        
        if len(sys.argv) != 5:
            error_msg = "Usage: python classic_greedy.py <nodes_json> <edges_json> <model> <params_json>"
            logging.error(error_msg)
            raise ValueError(error_msg)
            
        nodes = json.loads(sys.argv[1])
        edges = json.loads(sys.argv[2])
        model = sys.argv[3]
        params = json.loads(sys.argv[4])
        
        logging.debug(f"Input params: model={model}, nodes={len(nodes)}, edges={len(edges)}, params={params}")
        
        if not isinstance(nodes, list) or not isinstance(edges, list):
            error_msg = "Nodes and edges must be lists"
            logging.error(error_msg)
            raise ValueError(error_msg)
            
        # Extract model-specific parameters
        model_params = {}
        if model == "linear_threshold":
            model_params['threshold_range'] = params.get('thresholdRange', [0, 0.5])
        elif model == "independent_cascade":
            model_params['propagation_probability'] = params.get('propagationProbability', 0.1)
            
        logging.debug(f"Calling greedy_algorithm with model_params: {model_params}")
        stages = greedy_algorithm(nodes, edges, model, params)
        
        logging.debug("Algorithm completed, printing JSON result")
        print(json.dumps(stages))
        logging.debug("Script completed successfully")
        
    except Exception as e:
        error_msg = f"Error: {str(e)}"
        logging.error(error_msg)
        print(error_msg, file=sys.stderr)
        sys.exit(1)