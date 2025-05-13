import sqlite3

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
