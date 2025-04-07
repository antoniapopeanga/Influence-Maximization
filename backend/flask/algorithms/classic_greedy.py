import sys
import json
import os
import random
import logging
import numpy as np

from typing import List, Dict, Set, Tuple, Union
sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'models')))

# configuram progress logging
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

#functie de simulare monte carlo
#returneaza media propagarilor
def monte_carlo_simulation(
    model,
    nodes: Set[Union[str, int]],
    seed_nodes: List[Union[str, int]],
    num_simulations: int = 10
) -> float:
    spreads = []
    for i in range(num_simulations):

        if i % 10 == 0:
            logging.debug(f"Simulation progress: {i+1}/{num_simulations}")

        current_seed = seed_nodes.copy()
        
        # simulare propagare
        activated = set(current_seed)
        newly_activated = set(current_seed)
        
        while newly_activated:
            current_seed = list(newly_activated)
            newly_activated = set(model.propagate(current_seed)) - activated
            activated.update(newly_activated)
        
        spreads.append(len(activated))
    
    return np.mean(spreads)

#functia algoritmului greedy
#pentru fiecare nod efectueaza simulari montecarlo si adauga in seed_set nodurile care au cea mai mare influenta la pasul curent
def greedy_influence_maximization(
    nodes: List[Union[str, int]],
    edges: List[Tuple[Union[str, int], Union[str, int]]],
    model_name: str,
    params: Dict[str, Union[int, float]]
) -> List[Dict[str, Union[int, List[Union[str, int]], str]]]:

    logging.info("Starting greedy influence maximization algorithm")
    k = max(1, min(params.get('seedSize', 10), len(nodes)))
    max_steps = max(1, min(params.get('maxSteps', 5), 20))
    num_simulations = params.get('numSimulations', 50)

    #actualizam lista tuturor nodurilor activate pentru fiecare etapa
    cumulative_activated = set() 

    # initializam modelul selectat
    if model_name == "linear_threshold":
        from propagation_models import LinearThresholdModel
        model_params = {
            'threshold_range': params.get('thresholdRange', [0, 0.5])
        }
        model = LinearThresholdModel(nodes, edges, **model_params)
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

    for stage in range(k):
        max_node = None
        max_influence = -1
        evaluated_nodes = 0

        
        # evaluam functia de simulare pentru fiecare nod ramas
        for node in remaining_nodes:
            evaluated_nodes+=1

            if evaluated_nodes % 5 == 0: 
              logging.info(f"Stage {stage+1}: Evaluated {evaluated_nodes}/{len(remaining_nodes)} nodes")

            # calculam marginal gain
            candidate_seeds = seed_set + [node]
            influence = monte_carlo_simulation(
                model, 
                set(nodes), 
                candidate_seeds, 
                num_simulations
            )
            
            if influence > max_influence:
                max_influence = influence
                max_node = node
        
        if max_node is None:
            break
        
        # Update seed set
        seed_set.append(max_node)
        remaining_nodes.remove(max_node)
        
        activated = set(seed_set)
        for _ in range(max_steps):
            newly_activated = set(model.propagate(list(activated))) - activated
            activated.update(newly_activated)
        
        # Update activarea totala
        cumulative_activated.update(activated)
        
        # salvam datele fiecarei etape
        stage_data = {
            "stage": stage + 1,
            "selected_nodes": seed_set.copy(),
            "propagated_nodes": list(cumulative_activated),
            "total_activated": len(cumulative_activated),
            "marginal_gain": max_influence
        }
        stages.append(stage_data)
    
    return stages

def main():
    try:
        log_file = setup_logging()
        print(f"Logging to: {log_file}")
        
        if len(sys.argv) != 5:
            raise ValueError(
                "Usage: python influence_propagation.py "
                "<nodes_json> <edges_json> <model> <params_json>"
            )
        
        nodes = json.loads(sys.argv[1])
        edges = json.loads(sys.argv[2])
        model = sys.argv[3]
        params = json.loads(sys.argv[4])
        
        stages = greedy_influence_maximization(nodes, edges, model, params)
        
        print(json.dumps(stages))
        
    except Exception as e:
        logging.error(f"Error in main execution: {str(e)}")
        print(f"Error: {str(e)}", file=sys.stderr)
        sys.exit(1)

if __name__ == "__main__":
    main()