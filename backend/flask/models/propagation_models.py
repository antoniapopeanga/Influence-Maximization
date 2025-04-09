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
    """Linear Threshold Model optimizat"""
    
    def __init__(self, nodes, edges, threshold_range=(0, 1)):
        self.nodes = nodes
        self.edges = edges
        self.node_indices = {node: i for i, node in enumerate(nodes)}
        self.num_nodes = len(nodes)
        
        #folosim matrici numpy pt a pastra valorile pragurilor
        self.adj_matrix = np.zeros((self.num_nodes, self.num_nodes))
        self.neighbors = [[] for _ in range(self.num_nodes)]
        
        # 1. setam ponderile random
        for u, v in edges:
            weight = random.uniform(0, 1)
            u_idx, v_idx = self.node_indices[u], self.node_indices[v]
            self.adj_matrix[u_idx, v_idx] = weight
            self.adj_matrix[v_idx, u_idx] = weight
            self.neighbors[u_idx].append(v_idx)
            self.neighbors[v_idx].append(u_idx)
        
        # 2. normalizam ponderile
        for node_idx in range(self.num_nodes):
            total_weight = sum(self.adj_matrix[neighbor_idx, node_idx] 
                            for neighbor_idx in self.neighbors[node_idx])
            if total_weight > 0:
                for neighbor_idx in self.neighbors[node_idx]:
                    self.adj_matrix[neighbor_idx, node_idx] /= total_weight
        
        # 3. setam pragurile random
        low, high = threshold_range
        self.thresholds = np.array([random.uniform(low, high) for _ in range(self.num_nodes)])

    def get_node_from_index(self, index):
        for node, idx in self.node_indices.items():
            if idx == index:
                return node
        return None
    
    def propagate(self, active_nodes):
        active_indices = {self.node_indices[node] for node in active_nodes if node in self.node_indices}
        
        # bitmap cu nodurile active
        active_bitmap = np.zeros(self.num_nodes, dtype=bool)
        for idx in active_indices:
            active_bitmap[idx] = True
        
        new_active_indices = set()
        
        #procesam toate nodurile
        for node_idx in range(self.num_nodes):
            if not active_bitmap[node_idx]:
                # calculam influenta totala
                total_influence = sum(self.adj_matrix[neighbor_idx, node_idx] 
                                      for neighbor_idx in self.neighbors[node_idx] 
                                      if active_bitmap[neighbor_idx])
                
                if total_influence >= self.thresholds[node_idx]:
                    new_active_indices.add(node_idx)
        
        all_active_indices = active_indices.union(new_active_indices)
        return [self.get_node_from_index(idx) for idx in all_active_indices]


class IndependentCascadeModel(PropagationModel):
    def __init__(self, nodes, edges, propagation_probability=0.1):
        super().__init__(nodes, edges)
        self.probabilities = {(u, v): propagation_probability for u, v in edges}
        self.probabilities.update({(v, u): p for (u, v), p in self.probabilities.items()}) 

    def propagate(self, A):
        new_active = set(A)
        frontier = set(A)

        while frontier:
            next_frontier = set()
            for node in frontier:
                neighbors = self.get_neighbors(node)
                probs = np.random.rand(len(neighbors))

                for neighbor, p in zip(neighbors, probs):
                    if neighbor not in new_active and p < self.probabilities.get((node, neighbor), 0):
                        new_active.add(neighbor)
                        next_frontier.add(neighbor)

            frontier = next_frontier

        return list(new_active)
