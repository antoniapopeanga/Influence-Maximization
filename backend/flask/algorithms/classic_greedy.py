import sys
import json
import os
import logging
import numpy as np
import multiprocessing as mp
from functools import partial
from typing import List, Dict, Set, Tuple, Union

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'models')))

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

# functia de simulare monte carlo- secventiala
def monte_carlo_simulation(
    model,
    nodes: Set[Union[str, int]],
    seed_nodes: List[Union[str, int]],
    num_simulations: int = 10
) -> float:
    spreads = []
    for i in range(num_simulations):
        # simulam propagarea
        current_seed = seed_nodes.copy()
        activated = set(current_seed)
        newly_activated = set(current_seed)
        
        while newly_activated:
            current_seed = list(newly_activated)
            newly_activated = set(model.propagate(current_seed)) - activated
            activated.update(newly_activated)
        
        spreads.append(len(activated))
    
    return np.mean(spreads)

# evaluarea candidatilor in paralel
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

# evaluarea simularilor in paralel
def parallel_simulations(args):
    model, nodes, seed_set, remaining_nodes, num_simulations = args
    
    results = []
    for node in remaining_nodes:
        candidate_seeds = seed_set + [node]
        influence = monte_carlo_simulation(
            model, 
            set(nodes), 
            candidate_seeds, 
            num_simulations
        )
        results.append((node, influence))
    
    return results

# algoritm greedy cu evaluarea nodurilor paralelizata
def greedy_influence_maximization(
    nodes: List[Union[str, int]],
    edges: List[Tuple[Union[str, int], Union[str, int]]],
    model_name: str,
    params: Dict[str, Union[int, float]]
) -> List[Dict[str, Union[int, List[Union[str, int]], str]]]:

    logging.info("Starting greedy influence maximization algorithm with parallelization")
    k = max(1, min(params.get('seedSize', 10), len(nodes)))
    max_steps = max(1, min(params.get('maxSteps', 5), 20))
    num_simulations = params.get('numSimulations', 50)
    num_processes = params.get('numProcesses', mp.cpu_count())
    
    # multimea de noduri activata per total
    cumulative_activated = set()

    # initializam modelul ales
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
    
    seed_set = []
    remaining_nodes = set(nodes)
    stages = []

    logging.info(f"Beginning seed selection for {len(nodes)} nodes, target {k} seeds")
    logging.info(f"Using {num_processes} processes for parallel evaluation")

    with mp.Pool(processes=num_processes) as pool:
        for stage in range(k):
            logging.info(f"Starting stage {stage+1}/{k}")
            
            args_list = [
                (model, nodes, seed_set, node, num_simulations) 
                for node in remaining_nodes
            ]
            
            # evaluam nodurile in paralel
            results = pool.map(evaluate_node_influence, args_list)
            
            if not results:
                break
                
            max_node, max_influence = max(results, key=lambda x: x[1])
            
            # update multimii de seed cu nodul cu influenta max
            seed_set.append(max_node)
            remaining_nodes.remove(max_node)
            
            # rulam propagarea pentru a activa nodurile
            activated = set(seed_set)
            for _ in range(max_steps):
                newly_activated = set(model.propagate(list(activated))) - activated
                activated.update(newly_activated)
            
            # update la totalul de noduri activate
            cumulative_activated.update(activated)
            
            # datele pentru fiecare etapa
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



def main():
    try:
        log_file = setup_logging()
        print(f"Logging to: {log_file}")
        
        if len(sys.argv) != 5:
            raise ValueError(
                "Usage: python influence_propagation.py "
                "<nodes_file_path> <edges_file_path> <model> <params_file_path>"
            )
        
        # Read from file paths instead of direct JSON strings
        with open(sys.argv[1], 'r') as nodes_file:
            nodes = json.load(nodes_file)
        
        with open(sys.argv[2], 'r') as edges_file:
            edges = json.load(edges_file)
        
        model = sys.argv[3]
        
        with open(sys.argv[4], 'r') as params_file:
            params = json.load(params_file)
        
        num_cpus = mp.cpu_count()
        logging.info(f"Running on machine with {num_cpus} CPUs")
        
        stages = greedy_influence_maximization(nodes, edges, model, params)
        
        print(json.dumps(stages))
        
    except Exception as e:
        logging.error(f"Error in main execution: {str(e)}")
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()