from flask import Flask, request, jsonify
import networkx as nx
import pandas as pd
from flask_cors import CORS
import os

app = Flask(__name__)
CORS(app)  # Enable CORS to allow communication from React frontend

# Path to the datasets
DATASET_FOLDER = "../../datasets/csv_files"

@app.route("/run-algorithm", methods=["POST"])
def run_algorithm():
    data = request.json  # Get the data sent from React frontend

    # Extract dataset name and number from the request
    selected_dataset = data.get("dataset")
    dataset_name, dataset_number = selected_dataset.split(" ")

    selected_model = data.get("model")  # Diffusion model (not used yet)
    selected_algorithm = data.get("algorithm")  # Algorithm choice (not used yet)

    # Construct file name for dataset edges CSV
    dataset_filename_edges = f"{dataset_name}/{dataset_number}_edges.csv"
    dataset_filepath_edges = os.path.join(DATASET_FOLDER, dataset_filename_edges)

    print(dataset_filepath_edges)

    if not os.path.exists(dataset_filepath_edges):
        return jsonify({"error": f"Dataset {selected_dataset} not found"}), 400

    # Load the dataset (CSV) into a pandas DataFrame
    df = pd.read_csv(dataset_filepath_edges)

    # Assuming the CSV contains two columns: 'source' and 'target' for graph edges
    edges = list(zip(df['source'], df['target']))

    # Create a graph using NetworkX
    G = nx.Graph()
    G.add_edges_from(edges)

    # Example: Return nodes and edges of the graph as a result
    result = {
        "nodes": list(G.nodes()),
        "edges": list(G.edges())
    }

    return jsonify(result)  # Send the graph data back to React frontend

if __name__ == "__main__":
    app.run(port=5000, debug=True)
