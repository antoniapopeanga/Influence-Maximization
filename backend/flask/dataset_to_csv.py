import os
import pandas as pd

def convert_network_structure(input_dir, output_dir):
    os.makedirs(output_dir, exist_ok=True)
    
    edge_files = [f for f in os.listdir(input_dir) if f.endswith('.edges')]
    
    for edge_file in edge_files:
        ego_id = edge_file.split('.')[0]
        edges_csv = os.path.join(output_dir, f"{ego_id}_edges.csv")
        nodes_csv = os.path.join(output_dir, f"{ego_id}_nodes.csv")
        
      
        if os.path.exists(edges_csv) and os.path.exists(nodes_csv):
            print(f"Skipping {ego_id} (already converted)...")
            continue  
        
        print(f"Processing network for ego {ego_id}...")
        
        edges = []
        with open(os.path.join(input_dir, edge_file), 'r') as f:
            for line in f:
                source, target = map(int, line.strip().split())
                edges.append((source, target))
        
      
        edges_df = pd.DataFrame(edges, columns=['source', 'target'])
        
      
        nodes = set()
        for edge in edges:
            nodes.add(edge[0])
            nodes.add(edge[1])
        
        nodes.add(int(ego_id))
        
        nodes_df = pd.DataFrame(list(nodes), columns=['node_id'])
        
        edges_df.to_csv(edges_csv, index=False)
        nodes_df.to_csv(nodes_csv, index=False)
        
        print(f"  - Extracted {len(nodes)} nodes and {len(edges)} edges")
    
    print("All networks processed!")


input_directory = "../../datasets/facebook"  
output_directory = "../../datasets/csv_files/facebook"  
convert_network_structure(input_directory, output_directory)
