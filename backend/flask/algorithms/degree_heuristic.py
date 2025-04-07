import sys
import json
import os
from typing import List, Dict, Set, Tuple, Union

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'models')))
from propagation_models import LinearThresholdModel, IndependentCascadeModel

def degree_heuristic_algorithm(
    nodes: List[Union[str, int]],
    edges: List[Tuple[Union[str, int], Union[str, int]]],
    model_name: str,
    params: Dict[str, Union[int, float]]
) -> List[Dict[str, Union[int, List[Union[str, int]], str]]]:

    params = params or {}
    k = max(1, min(params.get('seedSize', 10), len(nodes)))
    max_steps = max(1, min(params.get('maxSteps', 5), 20))
    
    try:
        model_params = {}
        if model_name == "linear_threshold":
            model_params['threshold_range'] = params.get('thresholdRange', [0, 0.5])
            model = LinearThresholdModel(nodes, edges, **model_params)
        elif model_name == "independent_cascade":
            model_params['propagation_probability'] = params.get('propagationProbability', 0.1)
            model = IndependentCascadeModel(nodes, edges, **model_params)
        else:
            raise ValueError(f"Unknown model: {model_name}")
    except Exception as e:
        raise ValueError(f"Model initialization failed: {str(e)}")

    # calculam gradul pentru fiecare nod
    node_degrees = {node: 0 for node in nodes}
    for u, v in edges:
        node_degrees[u] += 1
        node_degrees[v] += 1
    
    # sortam descrescator si selectam primele k noduri
    sorted_nodes = sorted(node_degrees.keys(), key=lambda x: node_degrees[x], reverse=True)
    seed_nodes = sorted_nodes[:k]
    
    stages = [{
        "stage": 1,
        "selected_nodes": seed_nodes,
        "propagated_nodes": seed_nodes,
        "total_activated": len(seed_nodes),
        "average_degree": sum(node_degrees[n] for n in seed_nodes)/len(seed_nodes) if seed_nodes else 0
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
            raise ValueError("Usage: python simple_heuristic.py <nodes_json> <edges_json> <model> <params_json>")
            
        nodes = json.loads(sys.argv[1])
        edges = json.loads(sys.argv[2])
        model = sys.argv[3]
        params = json.loads(sys.argv[4])
        
        if not isinstance(nodes, list) or not isinstance(edges, list):
            raise ValueError("Nodes and edges must be lists")
            
        stages = degree_heuristic_algorithm(nodes, edges, model, params)
        print(json.dumps(stages))
        
    except json.JSONDecodeError as e:
        print(f"JSON parsing error: {str(e)}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)