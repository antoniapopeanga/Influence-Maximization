import sys
import json
import os
import random

sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), '..', 'models')))

from propagation_models import LinearThresholdModel, IndependentCascadeModel

def random_selection_algorithm(nodes, edges, model_name, max_steps=5):
    stages = []
    print(model_name)
    # initializam modelul selectat de utilizator
    if model_name == "linear_threshold":
        model = LinearThresholdModel(nodes, edges)
    elif model_name == "independent_cascade":
        model = IndependentCascadeModel(nodes, edges)
    else:
        raise ValueError("Invalid model. Choose 'independent_cascade' or 'linear_threshold'.")

    # vom selecta nodurile initial active in mod random
    A = random.sample(nodes, min(10, len(nodes))) 
    stages.append({"stage": 1, "selected_nodes": A, "propagated_nodes": A})

    # din setul ales random de noduri active vom propaga catre celelalte noduri folosind functia coresp modelului ales
    # la fiecare pas memoram multimea nodurilor active pana in acel punct
    for step in range(2, max_steps + 1):
        A = model.propagate(A)
        stages.append({"stage": step, "propagated_nodes": A})

    return stages

if __name__ == "__main__":
    import sys
    import io
    sys.stderr = io.StringIO()

    nodes = json.loads(sys.argv[1])
    edges = json.loads(sys.argv[2])
    model = sys.argv[3]
    
    stages = random_selection_algorithm(nodes, edges, model)

    sys.stdout.write(json.dumps(stages))
    sys.stdout.flush()
