import sys
import json
import os
from typing import List, Dict, Set, Tuple, Union
import dill

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'models')))

#importam modelelor de difuzie
try:
    from propagation_models import OptimizedLinearThresholdModel, IndependentCascadeModel
    print("[DEBUG] Successfully pre-imported propagation_models", file=sys.stderr)
except ImportError as e:
    print(f"[DEBUG] Failed to pre-import propagation_models: {e}", file=sys.stderr)

def degree_heuristic_algorithm(
    nodes: List[Union[str, int]],
    edges: List[Tuple[Union[str, int], Union[str, int]]],
    model,
    params: Dict[str, Union[int, float]]
) -> List[Dict[str, Union[int, List[Union[str, int]], str]]]:

    params = params or {}
    k = max(1, min(params.get('seedSize', 10), len(nodes)))
    max_steps = max(1, min(params.get('maxSteps', 5), 20))
    
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
            break

    return stages

if __name__ == "__main__":
    try:

        with open(sys.argv[1], 'r') as nodes_file:
            nodes = json.load(nodes_file)

        with open(sys.argv[2], 'r') as edges_file:
            edges = json.load(edges_file)

        # incarcam modelul deja initializat
        with open(sys.argv[3], 'rb') as model_file:
            model = dill.load(model_file)
        
        model_id = getattr(model, '_model_id', None)

        with open(sys.argv[4], 'r') as params_file:
            params = json.load(params_file)
        
        if not isinstance(nodes, list) or not isinstance(edges, list):
            raise ValueError("Nodes and edges must be lists")
            
        stages = degree_heuristic_algorithm(nodes, edges, model, params)
 
        output = {
            "stages": stages,
            "model_id": model_id
        }
        
        print(json.dumps(output))
        
    except json.JSONDecodeError as e:

        sys.exit(1)
    except Exception as e:
        import traceback
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)