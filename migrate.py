import sqlite3
import os
import json
from shapely.geometry import shape, Point

DB_PATH = 'stations.db'
GEOJSON_PATH = 'dashboard/public/russia.geojson'

def main():
    # Verify geojson reads correctly
    print("Loading GeoJSON...")
    regions = []
    with open(GEOJSON_PATH, 'r', encoding='utf-8') as f:
        geojson = json.load(f)
        for feature in geojson['features']:
            geom = shape(feature['geometry'])
            name = feature['properties'].get('name', 'Unknown')
            regions.append({'name': name, 'geom': geom})
    
    # Print first 5 regions to verify encoding
    print("Regions sample:", [r['name'] for r in regions[:5]])
    
    def get_region(lat, lon):
        p = Point(lon, lat)
        for r in regions:
            if r['geom'].contains(p):
                return r['name']
        return 'Unknown'
    
    conn = sqlite3.connect(DB_PATH)
    c = conn.cursor()
    
    # Re-add region column if needed
    try:
        c.execute("ALTER TABLE stations ADD COLUMN region TEXT DEFAULT 'Unknown'")
    except:
        pass
    
    # Now update all stations with correct region names
    print("Fetching all stations...")
    c.execute("SELECT id, lat, lon FROM stations")
    rows = c.fetchall()
    print(f"Found {len(rows)} stations, updating regions...")
    
    updates = []
    for i, (sid, lat, lon) in enumerate(rows):
        reg = get_region(lat, lon)
        updates.append((reg, sid))
        if i % 1000 == 0:
            print(f"Progress: {i}/{len(rows)}")
    
    c.executemany("UPDATE stations SET region = ? WHERE id = ?", updates)
    conn.commit()
    
    # Verify
    c.execute("SELECT DISTINCT region FROM stations LIMIT 5")
    sample = c.fetchall()
    print("Sample regions in DB:", [r[0] for r in sample])
    
    conn.close()
    print("Migration complete!")

if __name__ == '__main__':
    main()
