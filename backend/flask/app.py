import flask
from flask import Flask, request, jsonify
import networkx as nx
import pandas as pd
from flask_cors import CORS
import subprocess
import os
import json
import time

app = Flask(__name__)
CORS(app, origins=["http://localhost:3000"])

DATASET_FOLDER = "../../datasets/csv_files"

def run_single_algorithm(algorithm, G, model, params):
    """Run a single algorithm with specific parameters and return its results"""
    try:
        start_time = time.time()
        
        # Prepare the algorithm command
        cmd = [
            'python', f'algorithms/{algorithm}.py',
            json.dumps(list(G.nodes())),
            json.dumps(list(G.edges())),
            model,
            json.dumps(params)
        ]
        
        # Execute the algorithm
        result_process = subprocess.run(
            cmd,
            capture_output=True,
            text=True,
            check=True
        )
        
        runtime = (time.time() - start_time) * 1000  # Convert to milliseconds

        # Process the output
        stdout_lines = [line.strip() for line in result_process.stdout.split('\n') if line.strip()]
        
        if not stdout_lines:
            return {
                "status": "error",
                "error": "Algorithm produced no output",
                "stdout": result_process.stdout,
                "stderr": result_process.stderr
            }
            
        algorithm_stages = json.loads(stdout_lines[-1])
        
        # Calculate metrics
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

@app.route("/run-algorithm", methods=["POST"])
def run_algorithm():
    """Endpoint for running algorithms with multiple seed sizes"""
    try:
        data = request.json
        
        # Validate required parameters
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
        
        # Get seed sizes (default to [5] if not provided)
        seed_sizes = parameters.get('seedSize', [5])
        if not isinstance(seed_sizes, list):
            seed_sizes = [seed_sizes]

        # Load and validate dataset
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

        # Load graph data
        try:
            df = pd.read_csv(dataset_filepath)
            G = nx.Graph()
            G.add_edges_from(list(zip(df['source'], df['target'])))
        except Exception as e:
            return jsonify({
                "status": "error",
                "error": f"Failed to load graph data: {str(e)}"
            }), 400

        all_results = []
        seed_stages = {}  # Dictionary to store stages by seed size
        
        # Run algorithm for each seed size
        for seed_size in seed_sizes:
            # Create copy of parameters with current seed size
            current_params = parameters.copy()
            current_params['seedSize'] = seed_size
            
            algorithm_result = run_single_algorithm(
                selected_algorithm, 
                G, 
                selected_model, 
                current_params
            )
            
            if algorithm_result["status"] == "error":
                all_results.append({
                    "seed_size": seed_size,
                    "status": "error",
                    "error": algorithm_result["error"]
                })
                continue
            
            # Store stages with seed size as key
            seed_stages[seed_size] = algorithm_result["stages"]
            
            all_results.append({
                "seed_size": seed_size,
                "status": "success",
                "metrics": algorithm_result["metrics"],
                "stages": algorithm_result["stages"]  # Include stages with each result
            })

        # Prepare successful response
        response = {
            "status": "success",
            "nodes": list(G.nodes()),
            "edges": list(G.edges()),
            "algorithm": selected_algorithm,
            "results": all_results,  # Each result contains its own stages
            "stages_by_seed": seed_stages  # Alternative organization of stages
        }
        
        return jsonify(response)

    except Exception as e:
        return jsonify({
            "status": "error",
            "error": f"Unexpected server error: {str(e)}"
        }), 500

if __name__ == "__main__":
    app.run(port=5000, debug=True)