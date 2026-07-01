import sqlite3
import os
import json
from shapely.geometry import shape, Point

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'stations.db')
GEOJSON_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'dashboard', 'public', 'russia.geojson')

regions_cache = []
if os.path.exists(GEOJSON_PATH):
    with open(GEOJSON_PATH, 'r', encoding='utf-8') as f:
        geojson = json.load(f)
        for feature in geojson['features']:
            geom = shape(feature['geometry'])
            name = feature['properties'].get('name', 'Unknown')
            regions_cache.append({'name': name, 'geom': geom})

def get_region_for_point(lat, lon):
    p = Point(lon, lat)
    for r in regions_cache:
        if r['geom'].contains(p):
            return r['name']
    return "Unknown"


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

def init_db():
    conn = get_db()
    c = conn.cursor()
    c.execute('''
        CREATE TABLE IF NOT EXISTS stations (
            id TEXT PRIMARY KEY,
            name TEXT,
            brand TEXT,
            lat REAL,
            lon REAL,
            status TEXT,
            fuels_now TEXT,
            region TEXT DEFAULT 'Unknown',
            last_updated DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS station_history (
            id TEXT,
            status TEXT,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    c.execute('''
        CREATE TABLE IF NOT EXISTS region_metrics_history (
            region TEXT,
            avg_reports REAL,
            avg_views_growth REAL DEFAULT 0,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
        )
    ''')
    conn.commit()
    conn.close()

def upsert_stations(stations):
    conn = get_db()
    c = conn.cursor()
    
    for s in stations:
        sid = s.get('osm_id') or s.get('id', '')
        status = s.get('status', '')
        lat = s.get('lat', 0)
        lon = s.get('lon', 0)
        region = get_region_for_point(lat, lon)
        
        c.execute('''
            INSERT INTO stations (id, name, brand, lat, lon, status, fuels_now, region, last_updated)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, datetime('now'))
            ON CONFLICT(id) DO UPDATE SET
                name=excluded.name,
                brand=excluded.brand,
                lat=excluded.lat,
                lon=excluded.lon,
                status=excluded.status,
                fuels_now=excluded.fuels_now,
                region=excluded.region,
                last_updated=datetime('now')
        ''', (
            sid,
            s.get('name', ''),
            s.get('brand', ''),
            lat,
            lon,
            status,
            s.get('fuels_now', ''),
            region
        ))
        
        # Insert history snapshot
        c.execute('''
            INSERT INTO station_history (id, status, timestamp) 
            VALUES (?, ?, datetime('now'))
        ''', (sid, status))
    
    conn.commit()
    conn.close()

if __name__ == '__main__':
    init_db()
    print("Database initialized at", DB_PATH)
