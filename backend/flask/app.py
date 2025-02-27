from flask import Flask, request, jsonify
import networkx as nx
from flask_cors import CORS  # Import CORS

app = Flask(__name__)
CORS(app)

@app.route("/run-algorithm", methods=["POST"])
def run_algorithm():
    data = request.json  # Prinde datele primite
    graph_data = data.get("graph", [])  # Lista de muchii
    algorithm = data.get("algorithm", "random")  # Algoritm ales

    G = nx.Graph()
    G.add_edges_from(graph_data)

    result = {"nodes": []}
    if algorithm == "random":
        result["nodes"] = list(G.nodes())[:5]  # Exemplu simplu

    return jsonify(result)

if __name__ == "__main__":
    app.run(port=5000, debug=True)
