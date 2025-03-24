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
    
    def compute_influence(self, active_nodes):
        """Compute the total influence spread from the given active nodes"""
        # Create a copy of active nodes to track propagation
        activated = set(active_nodes)
        queue = list(activated)
        
        while queue:
            node = queue.pop(0)
            for neighbor in self.get_neighbors(node):
                if neighbor not in activated:
                    # Calculate total influence from all active neighbors
                    total_influence = sum(
                        self.weights.get((n, neighbor), 0) 
                        for n in activated if n in self.get_neighbors(neighbor)
                    )
                    if total_influence >= self.thresholds[neighbor]:
                        activated.add(neighbor)
                        queue.append(neighbor)
        
        return len(activated)

class IndependentCascadeModel(PropagationModel):
    """Independent Cascade Model"""
    
    def __init__(self, nodes, edges, propagation_probability=0.1):
        super().__init__(nodes, edges)
        self.probabilities = {(u, v): propagation_probability for u, v in edges}
        self.probabilities.update({(v, u): p for (u, v), p in self.probabilities.items()}) 

    def propagate(self, A):
        new_active = set(A)
        newly_activated = set(A)

        while newly_activated:
            next_activated = set()
            for node in newly_activated:
                for neighbor in self.get_neighbors(node):
                    if neighbor not in new_active and random.random() < self.probabilities.get((node, neighbor), 0):
                        next_activated.add(neighbor)
            new_active.update(next_activated)
            newly_activated = next_activated

        return list(new_active)
    
    def compute_influence(self, active_nodes):
        """Compute the expected influence spread from the given active nodes"""
        # For IC model, we need to simulate multiple times for accurate expectation
        # Here we use a simplified version that calculates potential reach
        activated = set(active_nodes)
        queue = list(activated)
        
        while queue:
            node = queue.pop(0)
            for neighbor in self.get_neighbors(node):
                if neighbor not in activated:
                    # In IC model, we consider the probability
                    if random.random() < self.probabilities.get((node, neighbor), 0):
                        activated.add(neighbor)
                        queue.append(neighbor)
        
        return len(activated)