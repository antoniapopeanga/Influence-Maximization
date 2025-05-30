import sqlite3
import json

def init_db():
    conn = sqlite3.connect('networks.db')
    cursor = conn.cursor()
    cursor.execute('''
        CREATE TABLE IF NOT EXISTS network_stats (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            name TEXT,
            num_nodes INTEGER,
            num_edges INTEGER,
            average_degree REAL,
            clustering_coeff REAL,
            degree_distribution TEXT
        )
    ''')

    cursor.execute('''
        CREATE TABLE IF NOT EXISTS algorithm_runs (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            model_id TEXT,
            algorithm TEXT,
            cache_key TEXT,
            seed_size INTEGER,
            runtime REAL,
            spread INTEGER,
            seed_nodes TEXT,
            stages TEXT,
            network_name TEXT,
            diffusion_model TEXT,
            model_params TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()

def insert_network_stats(name, num_nodes, num_edges, avg_degree, clustering, deg_dist):
    conn = sqlite3.connect('networks.db')
    cursor = conn.cursor()
    
    # Verifică dacă există deja un rând cu același nume
    cursor.execute('SELECT id FROM network_stats WHERE name = ?', (name,))
    existing_row = cursor.fetchone()
    
    if existing_row:
        # Dacă există, actualizează rândul
        cursor.execute('''
            UPDATE network_stats 
            SET num_nodes = ?, num_edges = ?, average_degree = ?, clustering_coeff = ?, degree_distribution = ?
            WHERE name = ?
        ''', (num_nodes, num_edges, avg_degree, clustering, deg_dist, name))
    else:
        # Dacă nu există, inserează un nou rând
        cursor.execute('''
            INSERT INTO network_stats (name, num_nodes, num_edges, average_degree, clustering_coeff, degree_distribution)
            VALUES (?, ?, ?, ?, ?, ?)
        ''', (name, num_nodes, num_edges, avg_degree, clustering, deg_dist))
    
    conn.commit()
    conn.close()

def get_all_network_stats():
    conn = sqlite3.connect('networks.db')
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM network_stats')
    rows = cursor.fetchall()
    conn.close()
    return rows

#salvam simularile precedente
def insert_algorithm_run(
    model_id, algorithm, cache_key, seed_size, runtime, spread,
    seed_nodes, stages, network_name, diffusion_model, model_params
):
    conn = sqlite3.connect('networks.db')
    cursor = conn.cursor()

    cursor.execute('''
        INSERT INTO algorithm_runs 
        (model_id, algorithm, cache_key, seed_size, runtime, spread,
         seed_nodes, stages, network_name, diffusion_model, model_params)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ''', (
        model_id,
        algorithm,
        cache_key,
        seed_size,
        runtime,
        spread,
        json.dumps(seed_nodes),
        json.dumps(stages),
        network_name,
        diffusion_model,
        json.dumps(model_params)
    ))

    conn.commit()
    conn.close()

def get_all_algorithm_runs():
    conn = sqlite3.connect('networks.db')
    cursor = conn.cursor()
    cursor.execute('SELECT * FROM algorithm_runs')
    rows = cursor.fetchall()
    conn.close()
    return rows


