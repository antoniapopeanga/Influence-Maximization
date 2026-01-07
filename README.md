# Influence Maximization – GraphNet App

This project is part of my bachelor’s thesis at the University of Bucharest. It implements and compares several algorithms for solving the **influence maximization** problem in social networks, inspired by the seminal work of Kempe, Kleinberg, and Tardos (2003).

##  Problem Overview

The influence maximization problem addresses a key question:  
**How do social networks shape opinions, behaviors, and decisions?**  

Building on the “six degrees of separation” theory, this research investigates how influence propagates through social networks and how it can be maximized strategically.

---

> *"Modeling and optimizing influence has transformative implications"* — Kempe, Kleinberg & Tardos (2003)

### Applications
- **Political Campaigns** – identifying key individuals for maximizing voter outreach  
- **Marketing** – viral advertising and product adoption strategies  
- **Epidemiology** – modeling disease spread and planning effective interventions  
- **Social Sciences** – analyzing social conformity and collective decision-making  


##  Mathematical Framework

The problem is formalized as follows:

Given a graph `G = (V, E)` and a parameter `k > 0`, we define the influence function:

```
σ : 2^V → ℝ⁺
```

This function maps each subset of nodes to the number of nodes they can activate. The goal is to find a seed set of `k` nodes that maximizes `σ(S)`.

**Note**: This is an NP-hard problem with no known polynomial-time solution.

##  Submodularity

A crucial property for efficiently solving the influence maximization problem is the submodularity of the σ function. This property embodies the principle of diminishing returns: adding a node to a smaller set always yields greater or equal marginal gain compared to adding the same node to a larger set that contains the smaller one. This fundamental insight enables greedy algorithms to achieve strong approximation guarantees while significantly reducing the computational burden of Monte Carlo simulations.

<img src="/images/submodularitate.png" alt="Submodularity" width="400"/>

##  Diffusion Models

### Linear Threshold (LT) Model
- **Concept**: Deterministic model based on social conformity
- **Mechanism**: Multiple nodes influence a target node through weighted connections
- **Activation**: Node activates when the sum of influences exceeds a threshold

```python

class OptimizedLinearThresholdModel:    
    def __init__(self, nodes, edges, threshold_range=(0, 1)):
        self.nodes = nodes
        self.edges = edges
        self.node_indices = {node: i for i, node in enumerate(nodes)}
        self.idx_to_node = {i: node for node, i in self.node_indices.items()}  # Reverse lookup cache
        self.num_nodes = len(nodes)

        # Matrice de adiacență (ponderi)
        self.adj_matrix = np.zeros((self.num_nodes, self.num_nodes))
        self.neighbors = [[] for _ in range(self.num_nodes)]
        
        # 1. Setăm ponderile random și construim vecinii
        for u, v in edges:
            weight = random.uniform(0, 1)
            u_idx, v_idx = self.node_indices[u], self.node_indices[v]
            self.adj_matrix[u_idx, v_idx] = weight
            self.adj_matrix[v_idx, u_idx] = weight
            self.neighbors[u_idx].append(v_idx)
            self.neighbors[v_idx].append(u_idx)
        
        # 2. Normalizăm ponderile
        for node_idx in range(self.num_nodes):
            incoming_neighbors = self.neighbors[node_idx]
            total_weight = sum(self.adj_matrix[neighbor_idx, node_idx] for neighbor_idx in incoming_neighbors)
            if total_weight > 0:
                for neighbor_idx in incoming_neighbors:
                    self.adj_matrix[neighbor_idx, node_idx] /= total_weight
        
        # 3. Praguri generate vectorizat
        low, high = threshold_range
        self.thresholds = np.random.uniform(low, high, size=self.num_nodes)

    def get_node_from_index(self, index):
        return self.idx_to_node.get(index)
    
    def propagate(self, active_nodes):
        # Bitmap pentru nodurile active
        active_bitmap = np.zeros(self.num_nodes, dtype=bool)
        for node in active_nodes:
            idx = self.node_indices.get(node)
            if idx is not None:
                active_bitmap[idx] = True

        # Vectorizat: influența totală primită de fiecare nod
        influence = self.adj_matrix.T @ active_bitmap  # shape: (num_nodes,)

        # Determinăm nodurile noi activate
        newly_active = ~active_bitmap & (influence >= self.thresholds)

        # Combinăm cu cele deja active
        all_active_indices = np.where(active_bitmap | newly_active)[0]

        return [self.idx_to_node[idx] for idx in all_active_indices]

    def get_model_params(self):
        return {
            "thresholds": self.thresholds.tolist()
        }


```

### Independent Cascade (IC) Model  
- **Concept**: Non-deterministic model based on personal uncertain choices
- **Mechanism**: Each active node has an independent probability to activate its neighbors
- **Activation**: Probabilistic activation attempts occur once per edge

```python

class IndependentCascadeModel:    
    def __init__(self, nodes, edges, propagation_probability=0.1):
        self.nodes = nodes
        self.edges = edges
        self.node_indices = {node: i for i, node in enumerate(nodes)}
        self.idx_to_node = {i: node for node, i in self.node_indices.items()}  # Optimizare: cache invers
        self.num_nodes = len(nodes)
        
        # Folosim array vectorizat pentru probabilități
        self.adj_matrix = np.zeros((self.num_nodes, self.num_nodes))
        
        # Optimizare: Folosim liste compacte pentru vecini
        self.neighbors = [[] for _ in range(self.num_nodes)]
        
        # Setăm probabilitățile de propagare în matricea de adiacență
        for u, v in edges:
            u_idx, v_idx = self.node_indices[u], self.node_indices[v]
            self.adj_matrix[u_idx, v_idx] = propagation_probability
            self.adj_matrix[v_idx, u_idx] = propagation_probability
            self.neighbors[u_idx].append(v_idx)
            self.neighbors[v_idx].append(u_idx)
        
        # Pre-calculăm array-uri numpy pentru vecini pentru procesare vectorială
        self.neighbors_array = [np.array(n) for n in self.neighbors]
        
        # Optimizare: Pre-alocăm structuri de date folosite în propagare
        self._active_bitmap = np.zeros(self.num_nodes, dtype=bool)

    def get_node_from_index(self, index):
        return self.idx_to_node.get(index)  # Folosim caching pentru mapare inversă
    
    def propagate(self, active_nodes):
        # Resetăm și inițializăm bitmap-ul activ
        self._active_bitmap.fill(False)
        
        # Convertim nodurile active la indici
        active_indices = {self.node_indices[node] for node in active_nodes if node in self.node_indices}
        for idx in active_indices:
            self._active_bitmap[idx] = True
        
        # Păstrăm nodurile nou activate în fiecare pas
        new_active = set(active_indices)
        frontier = set(active_indices)
        
        # Continuăm până când nu mai avem activări noi
        while frontier:
            next_frontier = set()
            
            # Pentru fiecare nod activ din frontiera actuală
            for node_idx in frontier:
                neighbors_idx = self.neighbors_array[node_idx]
                
                if len(neighbors_idx) == 0:  # Verificăm dacă nodul are vecini
                    continue
                
                # Filtrăm doar vecinii inactivi
                inactive_neighbors = neighbors_idx[~self._active_bitmap[neighbors_idx]]
                
                if len(inactive_neighbors) == 0:
                    continue
                
                # Optimizare: Generăm toate numerele aleatorii deodată
                random_probs = np.random.random(len(inactive_neighbors))
                
                # Verificăm activarea pentru fiecare vecin
                for idx, neighbor_idx in enumerate(inactive_neighbors):
                    if random_probs[idx] < self.adj_matrix[node_idx, neighbor_idx]:
                        next_frontier.add(neighbor_idx)
                        self._active_bitmap[neighbor_idx] = True
                        new_active.add(neighbor_idx)
            
            # Actualizăm frontiera pentru următoarea iterație
            frontier = next_frontier
        
        # Convertim indicii înapoi la nume de noduri
        return [self.get_node_from_index(idx) for idx in new_active]
```

##  Implemented Algorithms

### 1. Greedy Algorithm
- **Approach**: Selects the node with maximum marginal gain at each step
- **Approximation**: Guarantees ≥63% of optimal solution
- **Complexity**: High computational cost due to Monte Carlo simulations
- **Implementation**: Parallelized using Python's `multiprocessing.Pool`
  
```
Input: Graph G = (V,E), number of nodes k, Monte Carlo simulations R
Output: Seed set A of size k

1: A ← ∅
2: for i = 1 to k do
3:     for all v ∈ V \ A do
4:         gain[v] ← estimate_influence(A ∪ {v}, R) − estimate_influence(A, R)
5:     v* ← arg max_{v∈V\A} gain[v]
6:     A ← A ∪ {v*}
7: return A

```

### 2. CELF (Cost-Effective Lazy Forward)
- **Optimization**: Enhanced greedy with lazy evaluation
- **Mechanism**: Uses priority queue to avoid unnecessary recalculations
- **Key Insight**: Exploits submodularity property to reduce computations
- **Performance**: Same approximation guarantee as greedy, faster

```
Input: Graph G = (V,E), number of nodes k, Monte Carlo simulations R
Output: Seed set S of size k

1: function CELF(G, R, k)
2:     S ← ∅
3:     for all s ∈ V do
4:         δ_s ← +∞
5:     while ∃s ∈ V \ S such that |S| + 1 ≤ k do
6:         for all s ∈ V \ S do
7:             evaluated_s ← false
8:         while true do
9:             s* ← arg max_{s∈V\S} δ_s
10:            if evaluated_s* then
11:                S ← S ∪ {s*}
12:                break
13:            else
14:                δ_s* ← R(S ∪ {s*}) − R(S)
15:                evaluated_s* ← true
16:    return S
```

### 3. Heuristic Algorithms

#### Degree-Based Heuristic
- Selects nodes with the highest number of direct connections
- Fast execution, good for well-connected networks

#### Betweenness Centrality Heuristic
- Chooses nodes that act as bridges between communities
- Effective for networks with distinct community structures

  ```
  Input: Graph G = (V,E)
  Output: Betweenness centrality scores for all nodes
  
  1: for all nodes v ∈ V do
  2:     betweenness[v] ← 0
  3: for all source s ∈ V do
  4:     Apply BFS from s to find shortest paths to all nodes
  5:     Store: number of paths, distances, and predecessors for each node
  6:     Traverse resulting tree in reverse to accumulate centrality scores
  7:     Update betweenness[v] for each v ≠ s
  8: return betweenness scores
  ```

#### Random Heuristic
- Random node selection (baseline for comparison)
- Used primarily for performance benchmarking

##  System Architecture

### GraphNet Application
**Frontend**: React.js with `react-force-graph-3d` for network visualization

**Backend**: Python with optimized diffusion model implementations

**Database**: SQLite for storing network data and simulation results



``` python
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
        if 'propagationProbability' in data:
         propagation_prob=data['propagationProbability']

        else:
            propagation_prob=0.1

        # generarea cheii pentru a salva in cache modelul
        cache_key = get_cache_key(selected_dataset, selected_model, parameters)
```
``` python
# endpoint pentru a returna o simulare salvata dupa id-ul ei
@app.route('/saved-runs/<int:run_id>', methods=['GET'])
def get_saved_run(run_id):
    conn = sqlite3.connect('networks.db')
    cursor = conn.cursor()
    cursor.execute('SELECT seed_nodes, stages, algorithm, network_name FROM algorithm_runs WHERE id = ?', (run_id,))
    row = cursor.fetchone()
    conn.close()

    if row:
        project_root = "C:/Users/Antonia/Desktop/Influence Maximization models/Influence-Maximization"
        network, network_id = row[3].split()
        base_path = os.path.join(project_root, "datasets", "csv_files", network)

        nodes_file = os.path.join(base_path, f"{network_id}_nodes.csv")
        edges_file = os.path.join(base_path, f"{network_id}_edges.csv")

        nodes = []
        edges = []
        with open(nodes_file, newline='') as f:
            reader = csv.DictReader(f)
            for r in reader:
                nodes.append(r['node_id'])

        with open(edges_file, newline='') as f:
            reader = csv.DictReader(f)
            for r in reader:
                edges.append([r['source'], r['target']])

        return jsonify({
            "seed_nodes": eval(row[0]),
            "stages": eval(row[1]),
            "algorithm": row[2],
            "graph_data": {
                "nodes": nodes,
                "edges": edges
            }
        })

    return jsonify({"error": "Not found"}), 404
```

##  Experimental Results

### Test Networks
- **Facebook Networks**: Ego-user friendship networks
- **Political Blogs**: 2004 US election blog network
- **Email Networks**: Research institution and university email networks
- **Trust Network**: Movie rating trust relationships
- **Medical Network**: Physician connections

### Performance Metrics
- **Coverage**: Percentage of nodes activated
- **Efficiency**: Quality-to-runtime ratio
- **Consistency**: Result stability across runs
- **Saturation**: Proximity to best achieved coverage
- **Scalability**: Performance on varying network sizes

<p>
  <img src="/images/euristicile.jpg" alt="Heuristic performance" width="340"/>
  <img src="/images/greedyVScelf.jpg" alt="Greedy performance" width="350"/>
</p>
  

### Key Findings

#### Algorithm Performance
| Algorithm | Average Coverage | Efficiency Score | Best Use Case |
|-----------|------------------|------------------|---------------|
| Greedy | 74-77% | 0.15 | High-quality solutions |
| CELF | 74-77% | 0.32 | Balanced quality-speed |
| Degree Heuristic | 60.5% | **0.42** | Fast, good networks |
| Centrality Heuristic | 50% | 0.23 | Bridge-heavy networks |
| Random | ~45% | 0.25 | Baseline comparison |

#### Network Structure Impact
- **Low Clustering Coefficient**: All algorithms perform poorly (55-63% coverage)
- **Dispersed Networks**: Heuristics struggle significantly (<50% coverage)
- **Well-Connected Networks**: Degree heuristic performs surprisingly well

<img src="/images/algoritmi_coef_clustering.jpg" alt="Low clustering coefficient performance" width="600"/>

##  Tech Stack & Scale

- **Total Simulations Conducted**: ~550  
- **Networks Analyzed**: 15  
- **Languages**: Python, JavaScript (React.js)  
- **Key Libraries**: NumPy, Pandas, NetworkX, SQLite, Flask, React Force Graph 3D

##  Usage

### Running the Application

#### Backend Setup
```bash
# Navigate to backend directory and activate virtual environment
cd backend/flask
source venv/bin/activate  # Linux/Mac
# OR
venv\Scripts\activate     # Windows

# Start Flask server
python app.py
```
#### Frontend Setup

```bash
# Navigate to frontend directory (separate terminal)
cd frontend

# Install dependencies (first time only)
npm install

# Start React development server
npm start

```

### Web Interface

- Select test network and diffusion model
- Choose algorithms and seed set parameters
- View real-time propagation animation
- Analyze performance statistics

<table>
  <tr>
    <td align="center">
      <img src="/images/ss_aplicatie.jpg" alt="Web interface" width="400"/><br/>
      <sub>Web interface</sub>
    </td>
    <td align="center">
      <img src="/images/ss-animatie_curenta.jpg" alt="Current animation" width="400"/><br/>
      <sub>Current animation</sub>
    </td>
    <td align="center">
      <img src="/images/statistici_curente.jpg" alt="Statistics" width="400"/><br/>
      <sub>Statistics</sub>
    </td>
  </tr>
</table>


##  Project Structure

```
influence-maximization/
├── backend/
│   └── flask/
│       ├── algorithms/
│       │   ├── classic_greedy.py      # Greedy algorithm implementation
│       │   ├── celf.py                # CELF optimization algorithm
│       │   ├── centrality_heuristic.py # Betweenness centrality heuristic
│       │   ├── degree_heuristic.py    # Degree-based node selection
│       │   └── random_selection.py    # Random baseline algorithm
│       ├── models/
│       │   └── propagation_models.py  # LT and IC diffusion models
│       ├── app.py                     # Flask API server
│       ├── database.py                # Database operations
│       ├── dataset_to_csv.py          # Data preprocessing utilities
│       └── networks.db                # SQLite database
├── datasets/
│   ├── csv_files/                     # Processed network data
│   ├── email/                         # Email communication networks
│   ├── email_TarragonaUni/           # University email network
│   ├── facebook/                      # Facebook ego networks
│   ├── filmtrust/                     # Movie rating trust network
│   ├── physicians/                    # Medical professional network
│   └── pol_blogs/                     # Political blog network (2004)
├── frontend/
│   ├── public/                        # Static assets
│   └── src/
│       ├── components/                # React UI components
│       ├── css/                       # Styling files
│       ├── utils/                     # Frontend utilities
│       ├── App.css                    # Main application styles
│       └── App.js                     # Main React component
├── requirements.txt                   # Python dependencies
└── README.md

```

##  Future Directions

### Modern Approaches
- **Graph Neural Networks (GCNs)**: Learn node representations for importance prediction
- **Machine Learning**: Hybrid approaches combining heuristics with learned features
- **Dynamic Networks**: Algorithms for time-evolving social networks

### Optimization Opportunities
- **Advanced Sampling**: Reduce Monte Carlo simulation requirements
- **GPU Acceleration**: CUDA implementations for large-scale networks
