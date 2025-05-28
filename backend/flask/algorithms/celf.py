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
from functools import lru_cache

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

class CELFNode:
    __slots__ = ['node_id', 'marginal_gain', 'last_checked']

    def __init__(self, node_id, marginal_gain=0):
        self.node_id = node_id
        self.marginal_gain = marginal_gain
        self.last_checked = 0

    def __lt__(self, other):
        return self.marginal_gain > other.marginal_gain

mc_cache = {}

def monte_carlo_simulation(
    model,
    nodes: Set[Union[str, int]],
    seed_nodes: List[Union[str, int]],
    num_simulations: int = 10,
    max_steps: int = 5
) -> float:
    key = (frozenset(seed_nodes), num_simulations, max_steps)
    if key in mc_cache:
        return mc_cache[key]

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

    avg_spread = total_spread / num_simulations
    mc_cache[key] = avg_spread
    return avg_spread

def batch_evaluate_nodes(args):
    model, nodes, seed_set, candidates, num_simulations, max_steps = args

    results = []
    baseline_key = (frozenset(seed_set), num_simulations, max_steps)
    baseline_spread = mc_cache.get(baseline_key)
    if baseline_spread is None:
        baseline_spread = monte_carlo_simulation(model, nodes, seed_set, num_simulations, max_steps)

    for node in candidates:
        if node in seed_set:
            continue
        candidate_seeds = seed_set + [node]
        spread = monte_carlo_simulation(model, nodes, candidate_seeds, num_simulations, max_steps)
        marginal_gain = spread - baseline_spread
        results.append((node, marginal_gain))

    return results

def celf(
    nodes: List[Union[str, int]],
    edges: List[Tuple[Union[str, int], Union[str, int]]],
    model,
    params: Dict[str, Union[int, float]]
) -> List[Dict[str, Union[int, List[Union[str, int]], str]]]:

    start_time = time.time()
    logging.info("Starting optimized CELF algorithm")

    k = max(1, min(params.get('seedSize', 10), len(nodes)))
    max_steps = max(1, min(params.get('maxSteps', 5), 20))
    num_simulations = params.get('numSimulations', 50)
    num_processes = min(params.get('numProcesses', mp.cpu_count()), mp.cpu_count())
    coverage_threshold = 0.95
    min_marginal_gain_fraction = 0.02
    recent_gains = []
    grace_period = 4  # număr minim de etape înainte de a permite oprirea
    trend_window = 4  # ultimele N câștiguri marginale de analizat
    stagnation_threshold = len(nodes) * min_marginal_gain_fraction

    logging.info(f"Parameters: k={k}, num_simulations={num_simulations}, max_steps={max_steps}, processes={num_processes}")

    seed_set = []
    stages = []
    cumulative_activated = set()
    celf_queue = []
    nodes_set = set(nodes)

    batch_size = max(1, len(nodes) // (num_processes * 2))
    node_batches = [nodes[i:i+batch_size] for i in range(0, len(nodes), batch_size)]

    with mp.Pool(processes=num_processes) as pool:
        batch_args = [(model, nodes_set, seed_set, batch, num_simulations, max_steps) for batch in node_batches]
        batch_results = pool.map(batch_evaluate_nodes, batch_args)

    for batch_result in batch_results:
        for node_id, gain in batch_result:
            celf_node = CELFNode(node_id, gain)
            heapq.heappush(celf_queue, celf_node)

    baseline_spread = 0
    total_nodes = len(nodes)
    early_stop = False

    for iteration in range(k):
        recent_gains = []
        evaluation_count = 0
        best_node = None

        while celf_queue:
            evaluation_count += 1
            current_node = heapq.heappop(celf_queue)

            if current_node.node_id in seed_set:
                continue

            if current_node.last_checked == iteration:
                best_node = current_node
                break

            candidate_seeds = seed_set + [current_node.node_id]
            candidate_spread = monte_carlo_simulation(model, nodes_set, candidate_seeds, num_simulations, max_steps)

            current_node.marginal_gain = candidate_spread - baseline_spread
            current_node.last_checked = iteration
            heapq.heappush(celf_queue, current_node)

            if celf_queue and current_node.marginal_gain >= celf_queue[0].marginal_gain:
                best_node = current_node
                break

        if not best_node:
            break

        seed_set.append(best_node.node_id)

        activated = set(seed_set)
        for _ in range(max_steps):
            newly_activated = set(model.propagate(list(activated))) - activated
            if not newly_activated:
                break
            activated.update(newly_activated)

        previous_total = len(cumulative_activated)
        cumulative_activated.update(activated)
        new_total = len(cumulative_activated)
        gain_ratio = (new_total - previous_total) / total_nodes

        baseline_spread += best_node.marginal_gain

        recent_gains.append(best_node.marginal_gain)
        if len(recent_gains) > trend_window:
                recent_gains.pop(0)

        # Condiție 1: acoperire satisfăcătoare
        if new_total / total_nodes >= coverage_threshold:
            logging.info(f"Stopping early: reached {new_total}/{total_nodes} ({(new_total / total_nodes) * 100:.2f}%) coverage")
            early_stop = True
            break

        # Condiție 2: stagnare în câștig marginal după perioada de "grace"
        if iteration + 1 >= grace_period and all(g < stagnation_threshold for g in recent_gains):
            logging.info(f"Stopping early: marginal gain stagnant over last {trend_window} stages")
            early_stop = True
            break


        stage_data = {
            "stage": iteration + 1,
            "selected_nodes": seed_set.copy(),
            "propagated_nodes": list(cumulative_activated),
            "total_activated": new_total,
            "marginal_gain": best_node.marginal_gain,
            "evaluations": evaluation_count
        }
        stages.append(stage_data)

        logging.info(
            f"Stage {iteration+1}: Selected {best_node.node_id} "
            f"(mg={best_node.marginal_gain:.2f}), "
            f"Total activated: {new_total}, "
            f"Evaluations: {evaluation_count}/{len(nodes)}"
        )


    if early_stop:
        for fill_iter in range(iteration + 1, k):
            stage_data = {
                "stage": fill_iter + 1,
                "selected_nodes": seed_set.copy(),
                "propagated_nodes": list(cumulative_activated),
                "total_activated": len(cumulative_activated),
                "marginal_gain": 0.0,
                "evaluations": 0
            }
            stages.append(stage_data)

    runtime = time.time() - start_time
    logging.info(f"CELF completed in {runtime:.2f} seconds")

    return stages

if __name__ == "__main__":
    try:
        log_file = setup_logging()

        if len(sys.argv) != 5:
            raise ValueError("Usage: python optimized_celf.py <nodes_file_path> <edges_file_path> <model_file_path> <params_file_path>")

        with open(sys.argv[1], 'r') as nodes_file:
            nodes = json.load(nodes_file)

        with open(sys.argv[2], 'r') as edges_file:
            edges = json.load(edges_file)

        with open(sys.argv[3], 'rb') as model_file:
            model = dill.load(model_file)

        model_id = getattr(model, '_model_id', None)

        with open(sys.argv[4], 'r') as params_file:
            params = json.load(params_file)

        if not isinstance(nodes, list) or not isinstance(edges, list):
            raise ValueError("Nodes and edges must be lists")

        num_cpus = mp.cpu_count()
        logging.info(f"Running on machine with {num_cpus} CPUs")

        stages = celf(nodes, edges, model, params)

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