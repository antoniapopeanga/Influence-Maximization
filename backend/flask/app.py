import flask
from flask import Flask, request, jsonify
import networkx as nx
import pandas as pd
from flask_cors import CORS
import subprocess
import os
import json

app = Flask(__name__)
CORS(app, origins=["http://localhost:3000"])

DATASET_FOLDER = "../../datasets/csv_files"

@app.route("/run-algorithm", methods=["POST"])
def run_algorithm():

    #preluam parametrii din frontend
    data = request.json  

    #extragem si prelucram datele
    selected_dataset = data.get("dataset")
    dataset_name, dataset_number = selected_dataset.split(" ")

    selected_model = data.get("model") 
    selected_algorithm = data.get("algorithm")  

    dataset_filename_edges = f"{dataset_name}/{dataset_number}_edges.csv"
    dataset_filepath_edges = os.path.join(DATASET_FOLDER, dataset_filename_edges)

    if not os.path.exists(dataset_filepath_edges):
        return jsonify({"error": f"Dataset {selected_dataset} not found"}), 400

    df = pd.read_csv(dataset_filepath_edges)
    edges = list(zip(df['source'], df['target']))

    #cream graful
    G = nx.Graph()
    G.add_edges_from(edges)
    result = {
        "nodes": list(G.nodes()),
        "edges": list(G.edges())
    }

    # rulam scriptul portrivit
    try:
        result_process = subprocess.run(
            ['python', f'algorithms/{selected_algorithm}.py', 
             json.dumps(list(G.nodes())), 
             json.dumps(list(G.edges())), 
             selected_model],
            capture_output=True, 
            text=True, 
            check=True  
        )

        #debug
        print("Full stdout:", result_process.stdout)
        stdout_lines = [line.strip() for line in result_process.stdout.split('\n') if line.strip()]
        
        if stdout_lines:
            try:
                algorithm_stages = json.loads(stdout_lines[-1])
                result["algorithm_stages"] = algorithm_stages
            except json.JSONDecodeError:
                return jsonify({
                    "error": "Failed to parse algorithm output",
                    "stdout": result_process.stdout,
                    "stderr": result_process.stderr
                }), 500
        else:
            return jsonify({
                "error": "No output from algorithm script",
                "stdout": result_process.stdout,
                "stderr": result_process.stderr
            }), 500

        return jsonify(result)

    except subprocess.CalledProcessError as e:
      
        return jsonify({
            "error": "Algorithm execution failed",
            "stdout": e.stdout,
            "stderr": e.stderr
        }), 500
    except Exception as e:
        return jsonify({
            "error": str(e)
        }), 500

if __name__ == "__main__":
    app.run(port=5000, debug=True)