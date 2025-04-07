import random

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


class LinearThresholdModel(PropagationModel):
    """Linear Threshold Model"""
    
    def __init__(self, nodes, edges, threshold_range=(0, 0.5)):
        super().__init__(nodes, edges)
        low, high = threshold_range
        self.thresholds = {node: random.uniform(low, high) for node in nodes}
        self.weights = {(u, v): random.uniform(0, 1) for u, v in edges}
        self.weights.update({(v, u): w for (u, v), w in self.weights.items()})

    def propagate(self, A):
        new_active = set(A)
        for node in self.nodes:
            if node not in A:
                total_influence = sum(self.weights.get((neighbor, node), 0) 
                                   for neighbor in A if neighbor in self.get_neighbors(node))
                if total_influence >= self.thresholds[node]:
                    new_active.add(node)
        return list(new_active)
    


class IndependentCascadeModel(PropagationModel):
    """Independent Cascade Model"""
    
    def __init__(self, nodes, edges, propagation_probability=0.1):
        super().__init__(nodes, edges)
        self.probabilities = {(u, v): propagation_probability for u, v in edges}
        self.probabilities.update({(v, u): p for (u, v), p in self.probabilities.items()}) 

    def propagate(self, A):
        new_active = set(A)
        frontier = set(A)  # noduri care inca nu au incercat sa isi activeze vecinii
        
        while frontier:
            next_frontier = set()
            for node in frontier:
                for neighbor in self.get_neighbors(node):
                    if neighbor not in new_active and random.random() < self.probabilities.get((node, neighbor), 0):
                        new_active.add(neighbor)
                        next_frontier.add(neighbor)
            frontier = next_frontier
        
        return list(new_active)