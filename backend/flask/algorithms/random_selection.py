import sys
import json
import os
import random
from typing import List, Dict, Set, Tuple, Union

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'models')))

def random_selection_algorithm(
    nodes: List[Union[str, int]],
    edges: List[Tuple[Union[str, int], Union[str, int]]],
    model_name: str,
    params: Dict[str, Union[int, float]]
) -> List[Dict[str, Union[int, List[Union[str, int]], str]]]:
    
    params = params or {}
    k = max(1, min(params.get('seedSize', 10), len(nodes)))
    max_steps = max(1, min(params.get('maxSteps', 5), 20))
    
    # initializam modelul
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
    
    seed_nodes = random.sample(nodes, k) if nodes else []
    
    stages = [{
        "stage": 1,
        "selected_nodes": seed_nodes,
        "propagated_nodes": seed_nodes,
        "total_activated": len(seed_nodes)
    }]
    
    active_nodes = set(seed_nodes)
    for step in range(2, max_steps + 1):
        try:
            active_nodes = set(model.propagate(active_nodes))
            stages.append({
                "stage": step,
                "propagated_nodes": list(active_nodes),
                "total_activated": len(active_nodes)
            })
        except Exception as e:
            print(f"Error during propagation step {step}: {str(e)}")
            break
    
    return stages

if __name__ == "__main__":
    try:
        if len(sys.argv) != 5:
            raise ValueError("Usage: python random_selection.py <nodes_file_path> <edges_file_path> <model> <params_file_path>")
        
        # Read nodes from file path
        with open(sys.argv[1], 'r') as nodes_file:
            nodes = json.load(nodes_file)
        
        # Read edges from file path
        with open(sys.argv[2], 'r') as edges_file:
            edges = json.load(edges_file)
        
        # Get model name from command line
        model = sys.argv[3]
        
        # Read params from file path
        with open(sys.argv[4], 'r') as params_file:
            params = json.load(params_file)
        
        if not isinstance(nodes, list) or not isinstance(edges, list):
            raise ValueError("Nodes and edges must be lists")
        
        stages = random_selection_algorithm(nodes, edges, model, params)
        print(json.dumps(stages))
        
    except json.JSONDecodeError as e:
        print(f"JSON parsing error: {str(e)}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)