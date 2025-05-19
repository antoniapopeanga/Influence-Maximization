import random
import numpy as np
import random
from functools import lru_cache
import multiprocessing as mp

class PropagationModel:
    """Clasa de baza pentru modelele de propagare"""
    
    def __init__(self, nodes, edges):
        self.nodes = nodes
        self.edges = edges

    def propagate(self, A):
        """Functie de propagare de implementat in clasele mostenitoare"""
        raise NotImplementedError

    def get_neighbors(self, node):
        return [v for u, v in self.edges if u == node] + [u for v, u in self.edges if v == node]


class OptimizedLinearThresholdModel:
    """Linear Threshold Model optimizat (vectorizat și eficientizat)"""
    
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

class IndependentCascadeModel:
    """Independent Cascade Model optimizat cu performanță îmbunătățită"""
    
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
    
    def get_model_params(self):
        # Extragem probabilitățile din matricea de adiacență
        probabilities = {}
        for u_idx in range(self.num_nodes):
            for v_idx in self.neighbors[u_idx]:
                u = self.get_node_from_index(u_idx)
                v = self.get_node_from_index(v_idx)
                if u_idx < v_idx:
                    probabilities[f"{u}-{v}"] = float(self.adj_matrix[u_idx, v_idx])
        
        return {
            "probabilities": probabilities
        }