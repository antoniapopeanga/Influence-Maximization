import sys
import json
import os
from typing import List, Dict, Set, Tuple, Union
from collections import defaultdict, deque
import dill

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'models')))

# importam modelele de difuzie
try:
    from propagation_models import OptimizedLinearThresholdModel, IndependentCascadeModel
    print("[DEBUG] Successfully pre-imported propagation_models", file=sys.stderr)
except ImportError as e:
    print(f"[DEBUG] Failed to pre-import propagation_models: {e}", file=sys.stderr)


def calculate_betweenness_centrality(
    nodes: List[Union[str, int]],
    edges: List[Tuple[Union[str, int], Union[str, int]]]
) -> Dict[Union[str, int], float]:
  
    graph = defaultdict(list)
    for u, v in edges:
        graph[u].append(v)
        graph[v].append(u)
    
    betweenness = defaultdict(float)
    
    for s in nodes:
        predecessors = defaultdict(list)
        shortest_paths = defaultdict(int)
        shortest_paths[s] = 1
        distances = {s: 0}
        queue = deque([s])
        
        while queue:
            v = queue.popleft()
            for w in graph[v]:
                if w not in distances:
                    distances[w] = distances[v] + 1
                    queue.append(w)
                if distances[w] == distances[v] + 1:
                    shortest_paths[w] += shortest_paths[v]
                    predecessors[w].append(v)
        
        delta = defaultdict(float)
        stack = []
        for node in sorted(distances.keys(), key=lambda x: -distances[x]):
            stack.append(node)
        
        while stack:
            w = stack.pop()
            for v in predecessors[w]:
                delta[v] += (shortest_paths[v] / shortest_paths[w]) * (1 + delta[w])
            if w != s:
                betweenness[w] += delta[w]
    
    for node in betweenness:
        betweenness[node] /= 2
    
    for node in nodes:
        if node not in betweenness:
            betweenness[node] = 0.0
    
    return betweenness

def centrality_heuristic_algorithm(
    nodes: List[Union[str, int]],
    edges: List[Tuple[Union[str, int], Union[str, int]]],
    model,
    params: Dict[str, Union[int, float]]
) -> List[Dict[str, Union[int, List[Union[str, int]], str]]]:

    params = params or {}
    k = max(1, min(params.get('seedSize', 10), len(nodes)))
    max_steps = max(1, min(params.get('maxSteps', 5), 20))

    betweenness = calculate_betweenness_centrality(nodes, edges)
    
    sorted_nodes = sorted(betweenness.keys(), key=lambda x: betweenness[x], reverse=True)
    seed_nodes = sorted_nodes[:k]

    stages = [{
        "stage": 1,
        "selected_nodes": seed_nodes,
        "propagated_nodes": seed_nodes,
        "total_activated": len(seed_nodes),
        "centrality_scores": {n: betweenness[n] for n in seed_nodes}
    }]

    A = set(seed_nodes)
    for step in range(2, max_steps + 1):
        try:
            A = set(model.propagate(A))
            stages.append({
                "stage": step,
                "propagated_nodes": list(A),
                "total_activated": len(A)
            })
        except Exception as e:
            break

    return stages

if __name__ == "__main__":
    try:
        
        if len(sys.argv) != 5:
            raise ValueError("Usage: python centrality_heuristic.py <nodes_file_path> <edges_file_path> <model_file_path> <params_file_path>")
            
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
            
        stages = centrality_heuristic_algorithm(nodes, edges, model, params)
        
        output = {
            "stages": stages,
            "model_id": model_id
        }
        
        print(json.dumps(output))
        
    except Exception as e:
        import traceback
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)