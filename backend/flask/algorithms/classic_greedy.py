import sys
import json
import os
import logging
import numpy as np
import multiprocessing as mp
from typing import List, Dict, Set, Tuple, Union
import dill

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'models')))

try:
    from propagation_models import OptimizedLinearThresholdModel, IndependentCascadeModel
except ImportError as e:
    print(f"[DEBUG] Failed to import propagation_models: {e}", file=sys.stderr)

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

def run_single_simulation(model, seed_nodes):
    current_seed = seed_nodes.copy()
    activated = set(current_seed)
    newly_activated = set(current_seed)

    while newly_activated:
        current_seed = list(newly_activated)
        newly_activated = set(model.propagate(current_seed)) - activated
        activated.update(newly_activated)

    return len(activated)

#folosim cache pentru simularile monte carlo
#refolosim din rezultate mai vechi
monte_carlo_cache = {}
def monte_carlo_simulation(
    model,
    nodes: Set[Union[str, int]],
    seed_nodes: List[Union[str, int]],
    num_simulations: int = 10
) -> float:
    cache_key = (tuple(sorted(seed_nodes)), num_simulations)
    if cache_key in monte_carlo_cache:
        return monte_carlo_cache[cache_key]

    spreads = [run_single_simulation(model, seed_nodes) for _ in range(num_simulations)]
    result = np.mean(spreads)
    monte_carlo_cache[cache_key] = result
    return result

# evaluam nodurile in batch-uri pt eficienta
def batch_evaluate_nodes(args):
    model, nodes, seed_set, candidate_nodes, num_simulations = args
    results = []
    for node in candidate_nodes:
        candidate_seeds = seed_set + [node]
        influence = monte_carlo_simulation(model, set(nodes), candidate_seeds, num_simulations)
        results.append((node, influence))
    return results

# validam nodul ales dintr-un seed set precedent prin simulari
def evaluate_previous_node(args):
    model, nodes, partial_seed_set, node, num_simulations = args
    candidate_seeds = partial_seed_set + [node]
    influence = monte_carlo_simulation(model, set(nodes), candidate_seeds, num_simulations)
    return (node, influence)

# var globala pentru a pastra seed set-uri anterioare
previous_seed_sets = {}

def greedy_influence_maximization(
    nodes: List[Union[str, int]],
    edges: List[Tuple[Union[str, int], Union[str, int]]],
    model,
    params: Dict[str, Union[int, float]]
) -> List[Dict[str, Union[int, List[Union[str, int]], str]]]:

    logging.info("Starting optimized greedy influence maximization algorithm")
    k = max(1, min(params.get('seedSize', 10), len(nodes)))
    max_steps = max(1, min(params.get('maxSteps', 5), 20))
    num_simulations = params.get('numSimulations', 50)
    validation_simulations = params.get('validationSimulations', max(5, num_simulations // 5))  # 1/5 din numarul complet de simulari
    avail_cpus = mp.cpu_count()
    num_processes = min(params.get('numProcesses', avail_cpus), avail_cpus)
    run_id = params.get('runId', 'default')  # un id pentru a identifica simularile
    validation_candidates = params.get('validationCandidates', 10)  # numar de candidati alternativi
    coverage_threshold = 0.95
    min_marginal_gain_fraction = 0.02
    recent_gains = []
    grace_period = 3  # număr minim de etape înainte de a permite oprirea
    trend_window = 3  # ultimele N câștiguri marginale de analizat
    stagnation_threshold = len(nodes) * min_marginal_gain_fraction
    logging.info(f"Beginning seed selection for {len(nodes)} nodes, target {k} seeds")
    logging.info(f"Using {num_processes} processes for node evaluation")
    
    # verificare daca exista seed set-uri anterioare pt simularea curenta
    seed_set = []
    start_stage = 0
    cumulative_activated = set()
    stages = []
    
    # folosim rezultatele precedente doar in urma validarilor
    if run_id in previous_seed_sets:
        prev_stages = previous_seed_sets[run_id]
        logging.info(f"Found previous seed sets for run {run_id} with {len(prev_stages)} stages")
        
        with mp.Pool(processes=num_processes) as pool:
            for stage in range(len(prev_stages)):
                if stage + 1 > k:
                    break
                    
                prev_seed = prev_stages[stage]['selected_nodes'][-1]
                partial_seed_set = seed_set.copy()
                
                logging.info(f"Validating stage {stage+1}: Evaluating previous node {prev_seed}")
                
                # selectam noduri pentru a compara cu selectia precedenta
                remaining_nodes = set(nodes) - set(partial_seed_set + [prev_seed])
                validation_set = list(remaining_nodes)
                np.random.shuffle(validation_set)
                validation_set = validation_set[:validation_candidates]
                
                # adaugam selectia in setul de validare
                validation_set.append(prev_seed)
                
                # evaluam candidatii
                args_list = [
                    (model, nodes, partial_seed_set, node, validation_simulations)
                    for node in validation_set
                ]
                
                validation_results = pool.map(evaluate_previous_node, args_list)
                
                # alegem cel mai bun nod din setul de validare
                best_node, best_influence = max(validation_results, key=lambda x: x[1])
                
                # daca nodul ales precedent are castigul marginal max sau intr-un range mic, il folosim
                prev_node_result = next((res for res in validation_results if res[0] == prev_seed), None)
                
                if prev_node_result:
                    prev_node_influence = prev_node_result[1]
                    margin = 0.98
                    
                    if prev_node_influence >= best_influence * margin:
                        # nodul precdent este tot cel mai optim
                        logging.info(f"Validated: Previous node {prev_seed} is still optimal (influence: {prev_node_influence})")
                        best_node = prev_seed
                        best_influence = prev_node_influence
                    else:
                        # am gasit alt nod mai bun prin validare
                        logging.info(f"Found better node {best_node} (influence: {best_influence}) than previous {prev_seed} (influence: {prev_node_influence})")
                
                # update la seed set cu nodul cel mai bun
                seed_set.append(best_node)
                
                # calculam nodurile activate de nodul selectat
                activated = set(seed_set)
                for _ in range(max_steps):
                    newly_activated = set(model.propagate(list(activated))) - activated
                    if not newly_activated:
                        break
                    activated.update(newly_activated)
                
                cumulative_activated = activated
                
                # salvam datele pentru etapa curenta
                stage_data = {
                    "stage": stage + 1,
                    "selected_nodes": seed_set.copy(),
                    "propagated_nodes": list(cumulative_activated),
                    "total_activated": len(cumulative_activated),
                    "marginal_gain": best_influence
                }
                stages.append(stage_data)
                
                logging.info(f"Completed validation for stage {stage+1}: Selected node {best_node}, total activated: {len(cumulative_activated)}")
            
            start_stage = len(stages)
    
    remaining_nodes = set(nodes) - set(seed_set)

    def create_node_batches(nodes_to_batch, num_batches):
        nodes_list = list(nodes_to_batch)
        batch_size = max(1, len(nodes_list) // num_batches)
        return [nodes_list[i:i + batch_size] for i in range(0, len(nodes_list), batch_size)]

    # pentru stage-urile ramase paralelizam evaluarile nodurilor in batch-uri
    with mp.Pool(processes=num_processes) as pool:
            for stage in range(start_stage, k):
                logging.info(f"Starting stage {stage+1}/{k}")
                node_batches = create_node_batches(remaining_nodes, num_processes * 2)

                args_list = [
                    (model, nodes, seed_set, batch, num_simulations)
                    for batch in node_batches
                ]

                batch_results = pool.map(batch_evaluate_nodes, args_list)
                all_results = [item for batch in batch_results for item in batch]
                if not all_results:
                    break

                max_node, max_influence = max(all_results, key=lambda x: x[1])
                seed_set.append(max_node)
                remaining_nodes.remove(max_node)

                activated = set(seed_set)
                for _ in range(max_steps):
                    newly_activated = set(model.propagate(list(activated))) - activated
                    if not newly_activated:
                        break
                    activated.update(newly_activated)

                prev_total = len(cumulative_activated)
                cumulative_activated.update(activated)
                total_activated = len(cumulative_activated)
                marginal_gain = total_activated - prev_total

                stage_data = {
                    "stage": stage + 1,
                    "selected_nodes": seed_set.copy(),
                    "propagated_nodes": list(cumulative_activated),
                    "total_activated": total_activated,
                    "marginal_gain": marginal_gain
                }
                stages.append(stage_data)

                logging.info(f"Completed stage {stage+1}: selected node {max_node}, total activated: {total_activated}")

                # Verificăm condițiile de oprire
                recent_gains.append(marginal_gain)
                if len(recent_gains) > trend_window:
                    recent_gains.pop(0)

                # Condiție 1: acoperire satisfăcătoare
                if total_activated / len(nodes) >= coverage_threshold:
                    logging.info(f"Stopping early: reached {total_activated}/{len(nodes)} ({(total_activated / len(nodes))*100:.2f}%) coverage")
                    break

                # Condiție 2: stagnare în câștig marginal după perioada de "grace"
                if stage + 1 >= grace_period and all(g < stagnation_threshold for g in recent_gains):
                    logging.info(f"Stopping early: marginal gain stagnant over last {trend_window} stages")
                    break

    # Completăm restul etapelor cu ultima selecție validă
    last_stage = stages[-1] if stages else None
    for stage in range(len(stages), k):
        if last_stage:
            duplicated_stage = {
                "stage": stage + 1,
                "selected_nodes": last_stage["selected_nodes"].copy(),
                "propagated_nodes": last_stage["propagated_nodes"].copy(),
                "total_activated": last_stage["total_activated"],
                "marginal_gain": 0  # Nicio îmbunătățire nouă
            }
            stages.append(duplicated_stage)
            logging.info(f"Filled stage {stage+1} with previous results due to early stopping")

    # salvam seed set-urile pentru o utilizare viitoare
    previous_seed_sets[run_id] = stages
    
    # salvam rezultatele pe disc
    try:
        seed_cache_path = os.path.join(os.path.dirname(__file__), 'seed_cache')
        os.makedirs(seed_cache_path, exist_ok=True)
        cache_file = os.path.join(seed_cache_path, f'{run_id}_seed_sets.json')
        with open(cache_file, 'w') as f:
            json_data = []
            for stage in stages:
                json_data.append({
                    "stage": stage["stage"],
                    "selected_nodes": stage["selected_nodes"],
                    "propagated_nodes": stage["propagated_nodes"],
                    "total_activated": stage["total_activated"],
                    "marginal_gain": stage["marginal_gain"]
                })
            json.dump(json_data, f)
        logging.info(f"Saved seed set results to {cache_file}")
    except Exception as e:
        logging.warning(f"Failed to save seed cache: {str(e)}")

    return stages

def load_previous_seed_sets():
    global previous_seed_sets
    seed_cache_path = os.path.join(os.path.dirname(__file__), 'seed_cache')
    if not os.path.exists(seed_cache_path):
        return
    
    for filename in os.listdir(seed_cache_path):
        if filename.endswith('_seed_sets.json'):
            run_id = filename.replace('_seed_sets.json', '')
            try:
                with open(os.path.join(seed_cache_path, filename), 'r') as f:
                    previous_seed_sets[run_id] = json.load(f)
                logging.info(f"Loaded previous seed sets for run {run_id}")
            except Exception as e:
                logging.warning(f"Failed to load seed cache {filename}: {str(e)}")

if __name__ == "__main__":
    try:
        log_file = setup_logging()

        if len(sys.argv) != 5 and len(sys.argv) != 6:
            raise ValueError("Usage: python greedy_algorithm.py <nodes_file_path> <edges_file_path> <model_file_path> <params_file_path> [run_id]")

        with open(sys.argv[1], 'r') as nodes_file:
            nodes = json.load(nodes_file)

        with open(sys.argv[2], 'r') as edges_file:
            edges = json.load(edges_file)

        with open(sys.argv[3], 'rb') as model_file:
            model = dill.load(model_file)

        model_id = getattr(model, '_model_id', None)

        with open(sys.argv[4], 'r') as params_file:
            params = json.load(params_file)
        
        if len(sys.argv) == 6:
            params['runId'] = sys.argv[5]
        else:
            params['runId'] = f"{model_id if model_id else 'default'}"
        
        load_previous_seed_sets()
        
        stages = greedy_influence_maximization(nodes, edges, model, params)

        print(json.dumps({
            "stages": stages,
            "model_id": model_id
        }))

    except Exception as e:
        logging.error(f"Error in main execution: {str(e)}")
        import traceback
        traceback.print_exc(file=sys.stderr)
        sys.exit(1)