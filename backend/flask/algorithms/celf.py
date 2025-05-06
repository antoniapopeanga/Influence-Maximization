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

# heap node
class CELFNode:
    __slots__ = ['node_id', 'marginal_gain', 'last_checked']
    
    def __init__(self, node_id, marginal_gain=0):
        self.node_id = node_id
        self.marginal_gain = marginal_gain
        self.last_checked = 0
    
    def __lt__(self, other):
        return self.marginal_gain > other.marginal_gain  # Max-heap

# functie pentru simularea Monte Carlo pe bucati
def batch_evaluate_nodes(args):
    model, nodes, seed_set, candidates, num_simulations, max_steps = args
    
    baseline_spread = monte_carlo_simulation(model, nodes, seed_set, num_simulations, max_steps)
    
    results = []
    for node in candidates:
        if node in seed_set:
            continue
            
        candidate_seeds = seed_set + [node]
        spread = monte_carlo_simulation(model, nodes, candidate_seeds, num_simulations, max_steps)
        marginal_gain = spread - baseline_spread
        
        results.append((node, marginal_gain))
    
    return results

def monte_carlo_simulation(
    model,
    nodes: Set[Union[str, int]],
    seed_nodes: List[Union[str, int]],
    num_simulations: int = 10,
    max_steps: int = 5
) -> float:
    spreads = []
    for _ in range(num_simulations):
      
        activated = set(seed_nodes)
        current_frontier = set(seed_nodes)
        
        # rulam propagarea pentru max_steps
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

def celf(
    nodes: List[Union[str, int]],
    edges: List[Tuple[Union[str, int], Union[str, int]]],
    model,  # Now accepting a pre-initialized model object
    params: Dict[str, Union[int, float]]
) -> List[Dict[str, Union[int, List[Union[str, int]], str]]]:
   
    start_time = time.time()
    logging.info("Starting CELF algorithm")
    
    # Parametrii
    k = max(1, min(params.get('seedSize', 10), len(nodes)))
    max_steps = max(1, min(params.get('maxSteps', 5), 20))
    num_simulations = params.get('numSimulations', 50)
    num_processes = min(params.get('numProcesses', mp.cpu_count()), mp.cpu_count())
    
    logging.info(f"Parameters: k={k}, num_simulations={num_simulations}, max_steps={max_steps}")

    seed_set = []
    remaining_nodes = set(nodes)
    stages = []
    cumulative_activated = set()
    celf_queue = []

    logging.info("Calculating initial marginal gains")
    
    #calculam castigurile initiale folosind varianta batch size a simularii monte carlo
    batch_size = min(len(nodes) // num_processes, 100) 
    if batch_size < 1:
        batch_size = 1
        
    node_batches = [list(remaining_nodes)[i:i+batch_size] for i in range(0, len(remaining_nodes), batch_size)]
    
    with mp.Pool(processes=num_processes) as pool:
        batch_args = [(model, set(nodes), seed_set, batch, num_simulations, max_steps) for batch in node_batches]
        batch_results = pool.map(batch_evaluate_nodes, batch_args)
    
    # construim heap-ul
    for batch_result in batch_results:
        for node_id, gain in batch_result:
            celf_node = CELFNode(node_id, gain)
            heapq.heappush(celf_queue, celf_node)
    
    
    #vom recalcula castigurile doar atunci cand adaugam un nod nou in seed set
    for iteration in range(k):
        if not celf_queue:
            logging.warning("Queue exhausted before reaching k seeds")
            break
            
        best_node = None
        evaluations = 0
        
        while celf_queue:
            evaluations += 1
            current_node = heapq.heappop(celf_queue)
            
            if current_node.node_id in seed_set:
                continue
                
            # daca nodul din capul heap-ului a ramas acelasi este considerat cel cu castigul cel mai mare
            if current_node.last_checked == iteration:
                best_node = current_node
                break
                
            #daca heap head s-a schimbat vom recalcula spread-ul curent
            #vom recalcula si spread-ul ce contine si nodul curent
            candidate_seeds = seed_set + [current_node.node_id]
            
            current_spread = monte_carlo_simulation(
                model, set(nodes), seed_set, num_simulations, max_steps
            )
            
            candidate_spread = monte_carlo_simulation(
                model, set(nodes), candidate_seeds, num_simulations, max_steps
            )
            
            # re-actualizam castigul nodului curent
            current_node.marginal_gain = candidate_spread - current_spread
            current_node.last_checked = iteration
                        
            # il adaugam inapoi in heap
            heapq.heappush(celf_queue, current_node)
            
        if not best_node:
            break
            
        # adaugam in seed set nodul cu castigul cel mai mare daca a fost gasit
        seed_set.append(best_node.node_id)
        remaining_nodes.remove(best_node.node_id)
                
        # rulam propagarea pentru a vedea cate noduri au fost activate la aceasta etapa
        activated = set(seed_set)
        for step_idx in range(max_steps):
            newly_activated = set(model.propagate(list(activated))) - activated
            if not newly_activated:
                break
            activated.update(newly_activated)
        
        # actualizam multimea totala de noduri activate
        cumulative_activated.update(activated)
        
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
    
    runtime = time.time() - start_time
    logging.info(f"CELF completed in {runtime:.2f} seconds")
    
    return stages

if __name__ == "__main__":
    try:
        log_file = setup_logging()
        
        if len(sys.argv) != 5:
            raise ValueError("Usage: python celf.py <nodes_file_path> <edges_file_path> <model_file_path> <params_file_path>")
            
        # citim datele despre noduri si muchii din fisierele tmp
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
        stages = celf(nodes, edges, model, params)

        output = {
            "stages": stages,
            "model_id": model_id
        }
        
        result_file = os.path.join(os.path.dirname(log_file), 'celf_results.json')
        with open(result_file, 'w') as f:
            json.dump(output, f, indent=2)

        
        print(json.dumps(output))
    
    except Exception as e:
        logging.error(f"Error: {str(e)}", exc_info=True)
        import traceback
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)