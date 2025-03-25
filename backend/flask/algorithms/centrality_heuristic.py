import sys
import json
import os
from typing import List, Dict, Set, Tuple, Union
from collections import defaultdict, deque

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'models')))
from propagation_models import LinearThresholdModel, IndependentCascadeModel

def calculate_betweenness_centrality(
    nodes: List[Union[str, int]],
    edges: List[Tuple[Union[str, int], Union[str, int]]]
) -> Dict[Union[str, int], float]:
    """
    Calculate betweenness centrality for all nodes in the graph.
    
    Args:
        nodes: List of node IDs
        edges: List of edge tuples (source, target)
    
    Returns:
        Dictionary of betweenness centrality scores for each node
    """
    graph = defaultdict(list)
    for u, v in edges:
        graph[u].append(v)
        graph[v].append(u)
    
    betweenness = defaultdict(float)
    
    for s in nodes:
        # Shortest paths from source node s
        predecessors = defaultdict(list)
        shortest_paths = defaultdict(int)
        shortest_paths[s] = 1
        distances = {s: 0}
        queue = deque([s])
        
        # BFS to find shortest paths
        while queue:
            v = queue.popleft()
            for w in graph[v]:
                if w not in distances:
                    distances[w] = distances[v] + 1
                    queue.append(w)
                if distances[w] == distances[v] + 1:
                    shortest_paths[w] += shortest_paths[v]
                    predecessors[w].append(v)
        
        # Accumulate betweenness
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
    
    # Normalize for undirected graphs
    for node in betweenness:
        betweenness[node] /= 2
    
    # Ensure all nodes have a score, even if 0
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
    """
    Centrality Heuristic algorithm for influence maximization using betweenness centrality
    
    Args:
        nodes: List of node IDs
        edges: List of edge tuples (source, target)
        model_name: Either 'linear_threshold' or 'independent_cascade'
        params: Dictionary of parameters including:
            - seedSize: Number of seed nodes to select (default: 10)
            - maxSteps: Maximum propagation steps (default: 5)
            - propagationProbability: For IC model (default: 0.1)
            - thresholdRange: For LT model (default: [0, 0.5])
    
    Returns:
        List of stage dictionaries showing the propagation process
    """
    # Validate parameters with defaults
    params = params or {}
    k = max(1, min(params.get('seedSize', 10), len(nodes)))
    max_steps = max(1, min(params.get('maxSteps', 5), 20))
    
    try:
        # Initialize model with parameters
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

    # Calculate betweenness centrality
    betweenness = calculate_betweenness_centrality(nodes, edges)
    
    # Sort nodes by betweenness (descending) and select top k
    sorted_nodes = sorted(betweenness.keys(), key=lambda x: betweenness[x], reverse=True)
    seed_nodes = sorted_nodes[:k]
    
    # Initialize stages
    stages = [{
        "stage": 1,
        "selected_nodes": seed_nodes,
        "propagated_nodes": seed_nodes,
        "total_activated": len(seed_nodes),
        "centrality_scores": {n: betweenness[n] for n in seed_nodes}
    }]

    # Propagation steps
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
