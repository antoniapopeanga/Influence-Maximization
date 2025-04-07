import sys
import json
import os
from typing import List, Dict, Set, Tuple, Union
from collections import defaultdict, deque

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'models')))
from propagation_models import LinearThresholdModel, IndependentCascadeModel

#functia de calculare a scorului de betweeness
#calculeaza cate cele mai scurte drumuri trec printr-un nod v
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
            print(f"Error during propagation step {step}: {str(e)}")
            break

    return stages

if __name__ == "__main__":
    try:
        if len(sys.argv) != 5:
            raise ValueError("Usage: python centrality_heuristic.py <nodes_json> <edges_json> <model> <params_json>")
            
        nodes = json.loads(sys.argv[1])
        edges = json.loads(sys.argv[2])
        model = sys.argv[3]
        params = json.loads(sys.argv[4])
        
        if not isinstance(nodes, list) or not isinstance(edges, list):
            raise ValueError("Nodes and edges must be lists")
            
        stages = centrality_heuristic_algorithm(nodes, edges, model, params)
        print(json.dumps(stages))
        
    except json.JSONDecodeError as e:
        print(f"JSON parsing error: {str(e)}", file=sys.stderr)
        sys.exit(1)
    except Exception as e:
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)
