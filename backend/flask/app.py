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
    """Run a single algorithm and return its results"""
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
    """Endpoint for running a single algorithm"""
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

        # Run algorithm
        algorithm_result = run_single_algorithm(selected_algorithm, G, selected_model, parameters)
        
        if algorithm_result["status"] == "error":
            return jsonify(algorithm_result), 500

        # Prepare successful response
        response = {
            "status": "success",
            "nodes": list(G.nodes()),
            "edges": list(G.edges()),
            "algorithm": selected_algorithm,
            "stages": algorithm_result["stages"],
            "metrics": algorithm_result["metrics"]
        }
        
        return jsonify(response)

    except Exception as e:
        return jsonify({
            "status": "error",
            "error": f"Unexpected server error: {str(e)}"
        }), 500

if __name__ == "__main__":
    app.run(port=5000, debug=True)