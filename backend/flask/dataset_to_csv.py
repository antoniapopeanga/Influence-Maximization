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


def convert_to_csv(input_file, output_edges_file, output_nodes_file):
    edges = []
    nodes = set()  # Folosim un set pentru a evita duplicatele

    # Citim fișierul de intrare și adăugăm perechile de noduri într-o listă
    with open(input_file, 'r') as f:
        for line in f:
            # Ignorăm liniile care încep cu '%'
            if line.startswith('%') or not line.strip():  # Adăugăm și verificarea pentru linii goale
                continue
            
            try:
                source, target = map(int, line.strip().split())
                edges.append((source, target))
                nodes.add(source)  # Adăugăm nodul source
                nodes.add(target)  # Adăugăm nodul target
            except ValueError:
                # În cazul în care linia nu poate fi convertită în 2 numere, o ignorăm
                continue
    
    # Creăm DataFrame pentru muchii
    edges_df = pd.DataFrame(edges, columns=['source', 'target'])
    
    # Creăm DataFrame pentru noduri
    nodes_df = pd.DataFrame(sorted(nodes), columns=['node_id'])
    
    # Salvăm DataFrame-urile în fișiere CSV
    edges_df.to_csv(output_edges_file, index=False)
    nodes_df.to_csv(output_nodes_file, index=False)



# input_directory = "../../datasets/facebook"  
# output_directory = "../../datasets/csv_files/facebook"  
# convert_network_structure(input_directory, output_directory)

# input_directory = "../../datasets/filmtrust/filmtrust.librec"
# output_directory = "../../datasets/csv_files/filmtrust/"

# input_directory = "../../datasets/pol_blogs/pol_blogs"
# output_directory = "../../datasets/csv_files/pol_blogs/"


# input_directory = "../../datasets/email/email.txt"
# output_directory = "../../datasets/csv_files/email/"

# input_directory = "../../datasets/physicians/physicians_inovation"
# output_directory = "../../datasets/csv_files/physicians/"

input_directory = "../../datasets/email_TarragonaUni/arenas-email"
output_directory = "../../datasets/csv_files/email_Tarragona/"

os.makedirs(output_directory, exist_ok=True)
nodes_file = os.path.join(output_directory, "nodes.csv")
edges_file = os.path.join(output_directory, "edges.csv")

convert_to_csv(input_directory, edges_file, nodes_file)

