import flask
from flask import Flask, request, jsonify
import networkx as nx
import pandas as pd
from flask_cors import CORS
import subprocess
import os
import json
import time
import dill
import sys
import uuid
import hashlib

app = Flask(__name__)
CORS(app, origins=["http://localhost:3000"])

DATASET_FOLDER = "../../datasets/csv_files"

# Global model cache
MODEL_CACHE = {}

def get_cache_key(dataset, model_name, params):

    model_params = {}
    if model_name == "linear_threshold":
        model_params["threshold_range"] = params.get("thresholdRange", [0, 0.5])
    elif model_name == "independent_cascade":
        model_params["propagation_probability"] = params.get("propagationProbability", 0.1)
    
    # cheia pentru instanta modelului
    key_string = f"{dataset}_{model_name}_{json.dumps(model_params, sort_keys=True)}"
    
    return hashlib.md5(key_string.encode()).hexdigest()

def initialize_model(G, model_name, params):
    
    sys.path.append(os.path.abspath(os.path.join(os.path.dirname(__file__), 'models')))
    
    nodes = list(G.nodes())
    edges = list(G.edges())
    
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
    
    model_id = str(uuid.uuid4())
    model._model_id = model_id    
    return model

def run_single_algorithm(algorithm, G, initialized_model, params):
    try:

        start_time = time.time()
        
        # fisierele temporare pentru pregatirea datelor grafului
        import tempfile
        
        with tempfile.NamedTemporaryFile(mode='wb', suffix='.pkl', delete=False) as model_file:
            dill.dump(initialized_model, model_file)
            model_path = model_file.name
            
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as nodes_file:
            json.dump(list(G.nodes()), nodes_file)
            nodes_path = nodes_file.name
            
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as edges_file:
            json.dump(list(G.edges()), edges_file)
            edges_path = edges_file.name
            
        with tempfile.NamedTemporaryFile(mode='w', suffix='.json', delete=False) as params_file:
            json.dump(params, params_file)
            params_path = params_file.name
        
        python_path = sys.executable
        
        cmd = [
            python_path, f'algorithms/{algorithm}.py',
            nodes_path,
            edges_path,
            model_path,
            params_path
        ]
        
        # executarea scriptului ca sub-proces
        result_process = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            check=True,
            env=os.environ.copy()
        )
        
        
        runtime = (time.time() - start_time) * 1000

        # stergerea fisierelor temporare
        try:
            os.unlink(nodes_path)
            os.unlink(edges_path)
            os.unlink(model_path)
            os.unlink(params_path)
        except Exception as e:
            print(f"[DEBUG] Warning: Failed to clean up temp files: {e}")

        stdout_lines = [line.strip() for line in result_process.stdout.split('\n') if line.strip()]
        
        if not stdout_lines:
            return {
                "status": "error",
                "error": "Algorithm produced no output",
                "stdout": result_process.stdout,
                "stderr": result_process.stderr
            }
            
        # parsam rezultatul algoritmului
        try:
            algorithm_output = json.loads(stdout_lines[-1])
            algorithm_stages = algorithm_output.get("stages", [])
        except (json.JSONDecodeError, KeyError):
            algorithm_stages = json.loads(stdout_lines[-1])
        
        # calcularea metricilor
        seed_nodes = set()
        total_activated = 0
        for stage in algorithm_stages:
            if 'selected_nodes' in stage:
                seed_nodes.update(stage['selected_nodes'])
            if 'total_activated' in stage:
                total_activated = max(total_activated, stage['total_activated'])
        
        return {
            "status": "success",
            "stages": algorithm_stages,
            "metrics": {
                "spread": total_activated,
                "runtime": runtime,
                "seed_set_size": len(seed_nodes),
                "seed_nodes": list(seed_nodes)
            }
        }

    except subprocess.CalledProcessError as e:
        print(f"[DEBUG] Subprocess error: {e}")
        return {
            "status": "error",
            "error": "Algorithm execution failed",
            "stdout": e.stdout,
            "stderr": e.stderr
        }
    except Exception as e:
        return {
            "status": "error",
            "error": str(e)
        }

#endpoint pentru a rula pe rand toti algoritmii
@app.route("/run-algorithm", methods=["POST"])
def run_algorithm():
    global MODEL_CACHE
    
    try:
        data = request.json
        print(f"[DEBUG] Received request: {data}")
        
        required_fields = ['dataset', 'model', 'algorithm']
        if not all(field in data for field in required_fields):
            return jsonify({
                "status": "error",
                "error": f"Missing required fields. Need: {required_fields}"
            }), 400

        selected_dataset = data['dataset']
        selected_model = data['model']
        selected_algorithm = data['algorithm']
        parameters = data.get('parameters', {})
        
        # generarea cheii pentru a salva in cache modelul
        cache_key = get_cache_key(selected_dataset, selected_model, parameters)
        
        seed_sizes = parameters.get('seedSize', [5])
        if not isinstance(seed_sizes, list):
            seed_sizes = [seed_sizes]

        try:
            dataset_name, dataset_number = selected_dataset.split(' ')
        except ValueError:
            return jsonify({
                "status": "error",
                "error": "Dataset name must be in format 'name number'"
            }), 400

        dataset_filepath = os.path.join(DATASET_FOLDER, f"{dataset_name}/{dataset_number}_edges.csv")
        
        if not os.path.exists(dataset_filepath):
            return jsonify({
                "status": "error",
                "error": f"Dataset {selected_dataset} not found"
            }), 404

        try:
            df = pd.read_csv(dataset_filepath)
            G = nx.Graph()
            G.add_edges_from(list(zip(df['source'], df['target'])))
        except Exception as e:
            return jsonify({
                "status": "error",
                "error": f"Failed to load graph data: {str(e)}"
            }), 400

        # verificam daca modelul e in cache
        if cache_key in MODEL_CACHE:
            initialized_model = MODEL_CACHE[cache_key]
            model_id = getattr(initialized_model, '_model_id', 'Unknown')
        else:
            # initializam modelul O SINGURA DATA pentru toate scripturile
            try:
                initialized_model = initialize_model(G, selected_model, parameters)
                MODEL_CACHE[cache_key] = initialized_model
                model_id = getattr(initialized_model, '_model_id', 'Unknown')
            except Exception as e:
                return jsonify({
                    "status": "error",
                    "error": f"Failed to initialize model: {str(e)}"
                }), 400

        all_results = []
        seed_stages = {}
        
        # rulam algoritmii cu modelul deja initializat
        for seed_size in seed_sizes:
            current_params = parameters.copy()
            current_params['seedSize'] = seed_size
            
            algorithm_result = run_single_algorithm(
                selected_algorithm, 
                G, 
                initialized_model,
                current_params
            )
            
            if algorithm_result["status"] == "error":
                all_results.append({
                    "seed_size": seed_size,
                    "status": "error",
                    "error": algorithm_result["error"]
                })
                continue
            
            seed_stages[seed_size] = algorithm_result["stages"]
            
            all_results.append({
                "seed_size": seed_size,
                "status": "success",
                "metrics": algorithm_result["metrics"],
                "stages": algorithm_result["stages"]
            })

        response = {
            "status": "success",
            "nodes": list(G.nodes()),
            "edges": list(G.edges()),
            "algorithm": selected_algorithm,
            "results": all_results,
            "stages_by_seed": seed_stages,
            "model_id": model_id,
            "cache_key": cache_key
        }
        
        return jsonify(response)

    except Exception as e:
        return jsonify({
            "status": "error",
            "error": f"Unexpected server error: {str(e)}"
        }), 500

if __name__ == "__main__":
    app.run(port=5000, debug=True)