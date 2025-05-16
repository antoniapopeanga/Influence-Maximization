import sys
import json
import os
import logging
import numpy as np
import multiprocessing as mp
from functools import partial
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
    log_file = os.path.join(log_dir, 'influence_propagation.log')
    logging.basicConfig(
        filename=log_file,
        level=logging.DEBUG,
        format='%(asctime)s - %(levelname)s - %(message)s'
    )
    return log_file

# Funcția Monte Carlo pentru o singură simulare - secvențială
def run_single_simulation(model, seed_nodes):
    # simulam o singura propagare
    current_seed = seed_nodes.copy()
    activated = set(current_seed)
    newly_activated = set(current_seed)
    
    while newly_activated:
        current_seed = list(newly_activated)
        newly_activated = set(model.propagate(current_seed)) - activated
        activated.update(newly_activated)
    
    return len(activated)

# Versiune optimizată a simulării Monte Carlo - evităm nested pools
def monte_carlo_simulation(
    model,
    nodes: Set[Union[str, int]],
    seed_nodes: List[Union[str, int]],
    num_simulations: int = 10
) -> float:
    # Executăm simulările secvențial pentru a evita probleme cu procese daemonice
    spreads = []
    for i in range(num_simulations):
        spread = run_single_simulation(model, seed_nodes)
        spreads.append(spread)
    
    return np.mean(spreads)

# Funcție paralelă pentru evaluarea influenței unui singur nod
def evaluate_node_influence(args):
    model, nodes, seed_set, node, num_simulations = args
    candidate_seeds = seed_set + [node]
    influence = monte_carlo_simulation(
        model, 
        set(nodes), 
        candidate_seeds, 
        num_simulations
    )
    return node, influence

# Funcție paralelă pentru evaluarea unui lot de noduri
def batch_evaluate_nodes(args):
    model, nodes, seed_set, candidate_nodes, num_simulations = args
    
    results = []
    for node in candidate_nodes:
        candidate_seeds = seed_set + [node]
        influence = monte_carlo_simulation(
            model, 
            set(nodes), 
            candidate_seeds, 
            num_simulations
        )
        results.append((node, influence))
    
    return results

# Algoritm greedy optimizat cu un singur nivel de paralelizare
def greedy_influence_maximization(
    nodes: List[Union[str, int]],
    edges: List[Tuple[Union[str, int], Union[str, int]]],
    model,  # Model pre-inițializat
    params: Dict[str, Union[int, float]]
) -> List[Dict[str, Union[int, List[Union[str, int]], str]]]:
    
    logging.info("Starting optimized greedy influence maximization algorithm")
    k = max(1, min(params.get('seedSize', 10), len(nodes)))
    max_steps = max(1, min(params.get('maxSteps', 5), 20))
    num_simulations = params.get('numSimulations', 50)
    
    # Optimizare: Un singur nivel de paralelizare pentru evaluarea nodurilor
    avail_cpus = mp.cpu_count()
    num_processes = min(params.get('numProcesses', avail_cpus), avail_cpus)
    
    # Conversia la set pentru verificări rapide de membership
    nodes_set = set(nodes)
    seed_set = []
    remaining_nodes = set(nodes)
    stages = []
    cumulative_activated = set()

    logging.info(f"Beginning seed selection for {len(nodes)} nodes, target {k} seeds")
    logging.info(f"Using {num_processes} processes for node evaluation")

    # Optimizare: Împărțim nodurile în loturi pentru procesare paralelă eficientă
    def create_node_batches(nodes_to_batch, num_batches):
        nodes_list = list(nodes_to_batch)
        batch_size = max(1, len(nodes_list) // num_batches)
        return [nodes_list[i:i + batch_size] for i in range(0, len(nodes_list), batch_size)]

    with mp.Pool(processes=num_processes) as pool:
        for stage in range(k):
            logging.info(f"Starting stage {stage+1}/{k}")
            
            # Creăm loturi de noduri pentru evaluare paralelă
            node_batches = create_node_batches(remaining_nodes, num_processes * 2)
            
            args_list = [
                (model, nodes, seed_set, batch, num_simulations) 
                for batch in node_batches
            ]
            
            # Evaluăm loturile de noduri în paralel
            batch_results = pool.map(batch_evaluate_nodes, args_list)
            
            # Combinăm rezultatele din toate loturile
            all_results = []
            for batch in batch_results:
                all_results.extend(batch)
            
            if not all_results:
                break
                
            max_node, max_influence = max(all_results, key=lambda x: x[1])
            
            # Actualizăm setul de seeds cu nodul cu influență maximă
            seed_set.append(max_node)
            remaining_nodes.remove(max_node)
            
            # Rulăm propagarea pentru a obține nodurile activate
            activated = set(seed_set)
            for step_idx in range(max_steps):
                newly_activated = set(model.propagate(list(activated))) - activated
                activated.update(newly_activated)
            
            # Actualizăm totalul de noduri activate
            cumulative_activated.update(activated)
            
            # Datele pentru fiecare etapă
            stage_data = {
                "stage": stage + 1,
                "selected_nodes": seed_set.copy(),
                "propagated_nodes": list(cumulative_activated),
                "total_activated": len(cumulative_activated),
                "marginal_gain": max_influence
            }
            stages.append(stage_data)
            logging.info(f"Completed stage {stage+1}: selected node {max_node}, total activated: {len(cumulative_activated)}")
    
    return stages

if __name__ == "__main__":
    try:
        log_file = setup_logging()
            
        if len(sys.argv) != 5:
            raise ValueError(
                "Usage: python greedy_algorithm.py "
                "<nodes_file_path> <edges_file_path> <model_file_path> <params_file_path>"
            )
        
        # Citim datele despre noduri și muchii din fișierele tmp
        with open(sys.argv[1], 'r') as nodes_file:
            nodes = json.load(nodes_file)
     
        with open(sys.argv[2], 'r') as edges_file:
            edges = json.load(edges_file)
        
        # Încărcăm modelul deja inițializat
        with open(sys.argv[3], 'rb') as model_file:
            model = dill.load(model_file)
        
        model_id = getattr(model, '_model_id', None)
        
        with open(sys.argv[4], 'r') as params_file:
            params = json.load(params_file)
        
        if not isinstance(nodes, list) or not isinstance(edges, list):
            raise ValueError("Nodes and edges must be lists")
            
        num_cpus = mp.cpu_count()
        logging.info(f"Running on machine with {num_cpus} CPUs")
        
        stages = greedy_influence_maximization(nodes, edges, model, params)
        
        # Include model ID in the output for verification
        output = {
            "stages": stages,
            "model_id": model_id
        }
        
        print(json.dumps(output))
        
    except Exception as e:
        logging.error(f"Error in main execution: {str(e)}")
        import traceback
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)