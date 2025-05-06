import sys
import json
import os
import heapq
import logging
import numpy as np
import time
import multiprocessing as mp
from typing import List, Dict, Set, Tuple, Union
import dill

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'models')))

# importam modelele de difuzie
try:
    from propagation_models import OptimizedLinearThresholdModel, IndependentCascadeModel
    print("[DEBUG] Successfully pre-imported propagation_models", file=sys.stderr)
except ImportError as e:
    print(f"[DEBUG] Failed to pre-import propagation_models: {e}", file=sys.stderr)


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

# structura nodului pentru coada
class CELFNode:
    __slots__ = ['node_id', 'marginal_gain', 'last_checked']
    
    def __init__(self, node_id, marginal_gain=0):
        self.node_id = node_id
        self.marginal_gain = marginal_gain
        self.last_checked = 0
    
    def __lt__(self, other):
        return self.marginal_gain > other.marginal_gain  # Max-heap

# functia pentru simularile monte carlo
def monte_carlo_simulation(
    model,
    nodes: Set[Union[str, int]],
    seed_nodes: List[Union[str, int]],
    num_simulations: int = 10,
    max_steps: int = 5
) -> float:
    total_spread = 0
    for _ in range(num_simulations):
        activated = set(seed_nodes)
        current_frontier = set(seed_nodes)
        
        for _ in range(max_steps):
            if not current_frontier:
                break
                
            newly_activated = set(model.propagate(list(current_frontier))) - activated
            if not newly_activated:
                break
                
            activated.update(newly_activated)
            current_frontier = newly_activated
        
        total_spread += len(activated)
    
    return total_spread / num_simulations

def batch_evaluate_nodes(args):
    model, nodes, seed_set, candidates, num_simulations, max_steps = args
    
    results = []
    # daca multimea de seed e goala, calculam direct influenta fiecarui nod
    if not seed_set:
        for node in candidates:
            candidate_seeds = [node]
            spread = monte_carlo_simulation(model, nodes, candidate_seeds, num_simulations, max_steps)
            results.append((node, spread))
    else:
        # altfel calculam castigurile
        baseline_spread = monte_carlo_simulation(model, nodes, seed_set, num_simulations, max_steps)
        for node in candidates:
            if node in seed_set:
                continue
                
            candidate_seeds = seed_set + [node]
            spread = monte_carlo_simulation(model, nodes, candidate_seeds, num_simulations, max_steps)
            marginal_gain = spread - baseline_spread
            results.append((node, marginal_gain))
    
    return results

def optimized_celf(
    nodes: List[Union[str, int]],
    edges: List[Tuple[Union[str, int], Union[str, int]]],
    model,
    params: Dict[str, Union[int, float]]
) -> List[Dict[str, Union[int, List[Union[str, int]], str]]]:
   
    start_time = time.time()
    logging.info("Starting optimized CELF algorithm")
    
    # Parametrii
    k = max(1, min(params.get('seedSize', 10), len(nodes)))
    max_steps = max(1, min(params.get('maxSteps', 5), 20))
    num_simulations = params.get('numSimulations', 50)
    num_processes = min(params.get('numProcesses', mp.cpu_count()), mp.cpu_count())
    
    logging.info(f"Parameters: k={k}, num_simulations={num_simulations}, max_steps={max_steps}, processes={num_processes}")

    seed_set = []
    stages = []
    cumulative_activated = set()
    celf_queue = []
    nodes_set = set(nodes)

    # la primul pas selectam nodul cu cea mai mare influenta
    if k == 1:
        logging.info("Fast path for single seed selection")
        batch_size = max(1, min(len(nodes) // (num_processes * 2), 50))
        node_batches = [nodes[i:i+batch_size] for i in range(0, len(nodes), batch_size)]
        
        with mp.Pool(processes=num_processes) as pool:
            batch_args = [(model, nodes_set, [], batch, num_simulations, max_steps) for batch in node_batches]
            batch_results = pool.map(batch_evaluate_nodes, batch_args)
        
        best_node = None
        best_influence = -float('inf')
        
        for batch_result in batch_results:
            for node_id, influence in batch_result:
                if influence > best_influence:
                    best_influence = influence
                    best_node = node_id
        
        if best_node is not None:
            seed_set.append(best_node)
            
            # rulam propagarea pentru a vedea nodurile activate la pasul curent
            activated = set(seed_set)
            for _ in range(max_steps):
                newly_activated = set(model.propagate(list(activated))) - activated
                if not newly_activated:
                    break
                activated.update(newly_activated)
            
            cumulative_activated.update(activated)
            
            stages.append({
                "stage": 1,
                "selected_nodes": seed_set.copy(),
                "propagated_nodes": list(cumulative_activated),
                "total_activated": len(cumulative_activated),
                "marginal_gain": best_influence
            })
            
            runtime = time.time() - start_time
            logging.info(f"CELF completed in {runtime:.2f} seconds (fast path)")
            return stages
    
    # completam multimea de seed conform logicii algoritmului CELF
    logging.info("Calculating initial node influences")
    
    batch_size = max(1, min(len(nodes) // (num_processes * 2), 50))
    node_batches = [nodes[i:i+batch_size] for i in range(0, len(nodes), batch_size)]
    
    with mp.Pool(processes=num_processes) as pool:
        batch_args = [(model, nodes_set, seed_set, batch, num_simulations, max_steps) for batch in node_batches]
        batch_results = pool.map(batch_evaluate_nodes, batch_args)
    
    # construim coada de prioritati
    for batch_result in batch_results:
        for node_id, gain in batch_result:
            celf_node = CELFNode(node_id, gain)
            heapq.heappush(celf_queue, celf_node)
    
    baseline_spread = 0
    
    for iteration in range(k):
        evaluation_count = 0
        best_node = None
        
        while celf_queue:
            evaluation_count += 1
            current_node = heapq.heappop(celf_queue)
            
            if current_node.node_id in seed_set:
                continue
                
            # daca in capul cozii se afla nodul din iteratia precedenta este considerat ca cel mai bun
            if current_node.last_checked == iteration:
                best_node = current_node
                break
                
            # recalculam castigurile marginale doar atunci cand e nevoie
            candidate_seeds = seed_set + [current_node.node_id]
            candidate_spread = monte_carlo_simulation(
                model, nodes_set, candidate_seeds, num_simulations, max_steps
            )
            
            current_node.marginal_gain = candidate_spread - baseline_spread
            current_node.last_checked = iteration
            heapq.heappush(celf_queue, current_node)
            
            # daca castigul marginal al nodului curent este mai mare ca a celui din capul cozii putem sa il consideram cel mai influent
            if celf_queue and current_node.marginal_gain >= celf_queue[0].marginal_gain:
                best_node = current_node
                break
                
        if not best_node:
            logging.warning(f"No more beneficial nodes found at iteration {iteration+1}")
            break
            
        # adaugam in multimea de seed nodul cel mai influent
        seed_set.append(best_node.node_id)
        
        # rulam propagarea pentru a vedea cate noduri au fost activate la pasul curent
        activated = set(seed_set)
        for _ in range(max_steps):
            newly_activated = set(model.propagate(list(activated))) - activated
            if not newly_activated:
                break
            activated.update(newly_activated)
        
        # dam update multimii de noduri active
        cumulative_activated.update(activated)

        baseline_spread = monte_carlo_simulation(model, nodes_set, seed_set, num_simulations, max_steps)
        
        # datele pentru fiecare etapa
        stage_data = {
            "stage": iteration + 1,
            "selected_nodes": seed_set.copy(),
            "propagated_nodes": list(cumulative_activated),
            "total_activated": len(cumulative_activated),
            "marginal_gain": best_node.marginal_gain,
            "evaluations": evaluation_count
        }
        stages.append(stage_data)
        
        logging.info(
            f"Stage {iteration+1}: Selected {best_node.node_id} "
            f"(mg={best_node.marginal_gain:.2f}), "
            f"Total activated: {len(cumulative_activated)}, "
            f"Evaluations: {evaluation_count}/{len(nodes)}"
        )
    
    runtime = time.time() - start_time
    logging.info(f"CELF completed in {runtime:.2f} seconds")
    
    return stages

if __name__ == "__main__":
    try:
        log_file = setup_logging()
        
        if len(sys.argv) != 5:
            raise ValueError("Usage: python optimized_celf.py <nodes_file_path> <edges_file_path> <model_file_path> <params_file_path>")
            
        # incarcam nodurile si muchiile din temp files
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
        
        num_cpus = mp.cpu_count()
        logging.info(f"Running on machine with {num_cpus} CPUs")
        
        stages = optimized_celf(nodes, edges, model, params)

        output = {
            "stages": stages,
            "model_id": model_id
        }
        
        result_file = os.path.join(os.path.dirname(log_file), 'optimized_celf_results.json')
        with open(result_file, 'w') as f:
            json.dump(output, f, indent=2)
        
        print(json.dumps(output))
    
    except Exception as e:
        logging.error(f"Error: {str(e)}", exc_info=True)
        import traceback
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)