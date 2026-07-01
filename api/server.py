from flask import Flask, jsonify, request
from flask_cors import CORS
import sqlite3
import os
import io
import json
import urllib.request
import threading
import time
from shapely.geometry import shape, Point

app = Flask(__name__)
CORS(app)

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'stations.db')
GEOJSON_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'dashboard', 'public', 'russia.geojson')

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    return conn

@app.route('/api/time_bounds', methods=['GET'])
def get_time_bounds():
    conn = get_db()
    c = conn.cursor()
    c.execute("SELECT DISTINCT strftime('%Y-%m-%d %H:00:00', timestamp) as h FROM station_history WHERE timestamp IS NOT NULL ORDER BY h ASC")
    rows = c.fetchall()
    conn.close()
    timestamps = [r[0] for r in rows if r[0]]
    return jsonify({"timestamps": timestamps})

# Load GeoJSON regions (for API)
regions_cache = []
geojson_data = None
if os.path.exists(GEOJSON_PATH):
    with io.open(GEOJSON_PATH, 'r', encoding='utf-8') as f:
        geojson_data = json.load(f)
        for feature in geojson_data['features']:
            geom = shape(feature['geometry'])
            name = feature['properties'].get('name', 'Unknown')
            name_latin = feature['properties'].get('name_latin', name)
            # Compute centroid properly
            centroid = geom.centroid
            regions_cache.append({
                'name': name,
                'name_latin': name_latin,
                'geom': geom,
                'lat': centroid.y,
                'lon': centroid.x
            })

def fetch_station_comments(sid):
    try:
        url = f"https://gdebenz.ru/api/comments/{sid}"
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json', 'Accept-Charset': 'utf-8'})
        res = urllib.request.urlopen(req, timeout=5).read().decode('utf-8')
        return json.loads(res)
    except:
        return None

# ─── Endpoints ────────────────────────────────────────────────────────────────

@app.route('/api/regions', methods=['GET'])
def get_regions():
    res = []
    for r in regions_cache:
        bounds = r['geom'].bounds  # (minx, miny, maxx, maxy)
        res.append({
            'name': r['name'],
            'name_latin': r['name_latin'],
            'lat': r['lat'],
            'lon': r['lon'],
            'bounds': {'minLat': bounds[1], 'maxLat': bounds[3], 'minLon': bounds[0], 'maxLon': bounds[2]}
        })
    return jsonify(res)

@app.route('/api/brands', methods=['GET'])
def get_brands():
    region = request.args.get('region')
    conn = get_db()
    c = conn.cursor()
    if region and region not in ('russia', 'Вся Россия'):
        c.execute("""SELECT IFNULL(brand,'Unknown') as brand, COUNT(*) as cnt 
                     FROM stations WHERE region=? AND brand IS NOT NULL AND brand != ''
                     GROUP BY brand ORDER BY cnt DESC""", (region,))
    else:
        c.execute("""SELECT IFNULL(brand,'Unknown') as brand, COUNT(*) as cnt 
                     FROM stations WHERE brand IS NOT NULL AND brand != ''
                     GROUP BY brand ORDER BY cnt DESC""")
    brands = [{'name': r['brand'], 'count': r['cnt']} for r in c.fetchall()]
    conn.close()
    return jsonify(brands)

@app.route('/api/fuels', methods=['GET'])
def get_fuels():
    region = request.args.get('region')
    conn = get_db()
    c = conn.cursor()
    if region and region not in ('russia', 'Вся Россия'):
        c.execute("SELECT fuels_now FROM stations WHERE region=? AND fuels_now IS NOT NULL AND fuels_now != ''", (region,))
    else:
        c.execute("SELECT fuels_now FROM stations WHERE fuels_now IS NOT NULL AND fuels_now != ''")
    fuels_set = set()
    for r in c.fetchall():
        for f in (r['fuels_now'] or '').split(','):
            f = f.strip()
            if f:
                fuels_set.add(f)
    conn.close()
    return jsonify(sorted(list(fuels_set)))

@app.route('/api/history', methods=['GET'])
def get_history():
    conn = get_db()
    c = conn.cursor()
    region = request.args.get('region')
    if not region:
        return jsonify([])
    if region in ('russia', 'Вся Россия'):
        c.execute("""
            SELECT strftime('%Y-%m-%d %H:00:00', h.timestamp) as tb,
                   IFNULL(h.status,'unknown') as st, COUNT(DISTINCT h.id) as cnt
            FROM station_history h GROUP BY tb, st ORDER BY tb ASC
        """)
    else:
        c.execute("""
            SELECT strftime('%Y-%m-%d %H:00:00', h.timestamp) as tb,
                   IFNULL(h.status,'unknown') as st, COUNT(DISTINCT h.id) as cnt
            FROM station_history h JOIN stations s ON h.id=s.id
            WHERE s.region=? GROUP BY tb, st ORDER BY tb ASC
        """, (region,))
    rows = c.fetchall()
    conn.close()
    hist = {}
    for r in rows:
        tb = r['tb']
        if tb not in hist:
            hist[tb] = {'yes': 0, 'no': 0, 'low': 0, 'queue': 0, 'unknown': 0}
        hist[tb][r['st']] = r['cnt']
    return jsonify([{'time': k, **v} for k, v in hist.items()])

@app.route('/api/stations_map', methods=['GET'])
def get_stations_map():
    region = request.args.get('region')
    brands = request.args.getlist('brand')
    fuels = request.args.getlist('fuel')
    if not region or region in ('russia', 'Вся Россия'):
        return jsonify([])
    conn = get_db()
    c = conn.cursor()
    params = [region]
    where = " WHERE region=?"
    for b in brands:
        if b:
            where += " AND brand=?"; params.append(b)
    for f in fuels:
        if f:
            where += " AND fuels_now LIKE ?"; params.append(f'%{f}%')
    time_at = request.args.get('time_at')
    if time_at:
        query = f"""
            SELECT sub.id, sub.lat, sub.lon, sub.brand, sub.status, sub.fuels_now
            FROM (
                SELECT id, lat, lon, brand, fuels_now,
                       (SELECT status FROM station_history h WHERE h.id = s.id AND h.timestamp <= ? ORDER BY timestamp DESC LIMIT 1) as status
                FROM stations s {where}
            ) sub
            WHERE sub.status IS NOT NULL AND sub.status != ''
            LIMIT 5000
        """
        c.execute(query, [time_at] + params)
    else:
        c.execute(f"SELECT id, lat, lon, brand, status, fuels_now FROM stations{where} LIMIT 5000", params)
    rows = c.fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

@app.route('/api/confidence', methods=['GET'])
def get_confidence():
    region = request.args.get('region')
    brands = request.args.getlist('brand')
    fuels = request.args.getlist('fuel')

    conn = get_db()
    c = conn.cursor()

    params = []
    where = " WHERE 1=1"
    if region and region not in ('russia', 'Вся Россия'):
        where += " AND region=?"; params.append(region)
    for b in brands:
        if b: where += " AND brand=?"; params.append(b)
    for f in fuels:
        if f: where += " AND fuels_now LIKE ?"; params.append(f'%{f}%')

    time_at = request.args.get('time_at')
    if time_at:
        c.execute(f"""
            SELECT COUNT(*) FROM (
                SELECT (SELECT status FROM station_history h WHERE h.id = s.id AND h.timestamp <= ? ORDER BY timestamp DESC LIMIT 1) as status
                FROM stations s {where}
            ) sub WHERE sub.status IS NOT NULL AND sub.status != ''
        """, [time_at] + params)
    else:
        c.execute(f"SELECT COUNT(*) FROM stations{where}", params)
    total_stations = c.fetchone()[0]

    # Sample up to 30 stations for confidence
    c.execute(f"SELECT id FROM stations{where} AND status IS NOT NULL AND status != '' ORDER BY RANDOM() LIMIT 30", params)
    sample_ids = [r['id'] for r in c.fetchall()]
    conn.close()

    total_real_count = 0
    total_conf_pct = 0
    valid_stations = 0

    import concurrent.futures
    import datetime

    if sample_ids:
        with concurrent.futures.ThreadPoolExecutor(max_workers=10) as executor:
            results = list(executor.map(fetch_station_comments, sample_ids))
            
        for data in results:
            if data:
                real_count = data.get('realCount', 0)
                cb = data.get('confidenceBase', 0)
                updated = data.get('updated', '')
                
                conf_pct = 0
                if cb and updated:
                    try:
                        # naive datetime from string
                        dt = datetime.datetime.strptime(updated, '%Y-%m-%d %H:%M:%S')
                        now = datetime.datetime.utcnow()
                        age_h = (now - dt).total_seconds() / 3600
                        if age_h <= 8: s = 1 - age_h/8*0.2
                        elif age_h <= 24: s = 0.8 - 0.45*(age_h-8)/16
                        else: s = max(0.15, 0.35-0.004*(age_h-24))
                        
                        raw = 5 * round(100 * cb * s / 5)
                        conf_pct = max(5, min(99, raw))
                    except:
                        pass
                
                total_real_count += real_count
                total_conf_pct += conf_pct
                valid_stations += 1

    avg_real = round(total_real_count / valid_stations, 1) if valid_stations > 0 else 0
    avg_conf = round(total_conf_pct / valid_stations) if valid_stations > 0 else 0
    
    # Cap total estimated at something reasonable to avoid absurd numbers for huge regions based on skewed tiny samples
    est_total_24h = int(avg_real * total_stations)

    return jsonify({
        'avg_real_count': avg_real,
        'total_real_estimated': est_total_24h,
        'avg_confidence_pct': avg_conf,
        'stations_sampled': valid_stations,
        'total_stations': total_stations
    })

# --- Background Thread for Region Confidence ---
region_avg_reports = {}

def update_region_confidence_loop():
    while True:
        try:
            conn = get_db()
            c = conn.cursor()
            # Get all unique regions
            c.execute("SELECT DISTINCT region FROM stations WHERE region IS NOT NULL AND region != ''")
            regions = [r['region'] for r in c.fetchall()]
            
            for r in regions:
                c.execute("SELECT id FROM stations WHERE region=? AND status IS NOT NULL AND status != '' ORDER BY RANDOM() LIMIT 10", (r,))
                sample_ids = [row['id'] for row in c.fetchall()]
                
                total_real = 0
                valid = 0
                for sid in sample_ids:
                    data = fetch_station_comments(sid)
                    if data:
                        total_real += data.get('realCount', 0)
                        valid += 1
                
                if valid > 0:
                    region_avg_reports[r] = round(total_real / valid, 1)
                else:
                    region_avg_reports[r] = 0
                    
                time.sleep(1) # Be gentle to the API
                
            conn.close()
        except Exception as e:
            print("Confidence Loop Error:", e)
            
        time.sleep(3600) # Update every hour

threading.Thread(target=update_region_confidence_loop, daemon=True).start()
# -----------------------------------------------

@app.route('/api/stats', methods=['GET'])
def get_stats():
    conn = get_db()
    c = conn.cursor()
    region = request.args.get('region', 'russia')
    brands = request.args.getlist('brand')
    fuels = request.args.getlist('fuel')

    params = []
    where = " WHERE 1=1"
    if region and region not in ('russia', 'Вся Россия'):
        where += " AND region=?"; params.append(region)
    for b in brands:
        if b: where += " AND brand=?"; params.append(b)
    for f in fuels:
        if f: where += " AND fuels_now LIKE ?"; params.append(f'%{f}%')

    # Status counts
    time_at = request.args.get('time_at')
    if time_at:
        query = f"""
            SELECT IFNULL(sub.status, 'unknown') as st, COUNT(*) as cnt
            FROM (
                SELECT (SELECT status FROM station_history h WHERE h.id = s.id AND h.timestamp <= ? ORDER BY timestamp DESC LIMIT 1) as status
                FROM stations s {where}
            ) sub
            GROUP BY st
        """
        c.execute(query, [time_at] + params)
    else:
        c.execute(f"SELECT IFNULL(status,'unknown') as st, COUNT(*) as cnt FROM stations{where} GROUP BY st", params)
    status_counts = {r['st']: r['cnt'] for r in c.fetchall()}

    # Top 10 brands + breakdown
    if time_at:
        c.execute(f"""
            SELECT IFNULL(sub.brand,'Unknown') as brand, COUNT(*) as cnt 
            FROM (
                SELECT brand, (SELECT status FROM station_history h WHERE h.id = s.id AND h.timestamp <= ? ORDER BY timestamp DESC LIMIT 1) as status
                FROM stations s {where}
            ) sub
            WHERE sub.status IS NOT NULL AND sub.status != '' AND sub.status != 'unknown'
            GROUP BY brand ORDER BY cnt DESC LIMIT 10
        """, [time_at] + params)
    else:
        c.execute(f"SELECT IFNULL(brand,'Unknown') as brand, COUNT(*) as cnt FROM stations{where} GROUP BY brand ORDER BY cnt DESC LIMIT 10", params)
    top_brands = [r['brand'] for r in c.fetchall()]
    brand_breakdown = {}
    if top_brands:
        ph = ','.join(['?'] * len(top_brands))
        if time_at:
            query = f"""
                SELECT brand, st, COUNT(*) as cnt FROM (
                    SELECT IFNULL(brand,'Unknown') as brand, 
                           IFNULL((SELECT status FROM station_history h WHERE h.id = s.id AND h.timestamp <= ? ORDER BY timestamp DESC LIMIT 1), 'unknown') as st
                    FROM stations s {where} AND IFNULL(brand,'Unknown') IN ({ph})
                ) sub
                GROUP BY brand, st
            """
            c.execute(query, [time_at] + params + top_brands)
        else:
            c.execute(
                f"SELECT IFNULL(brand,'Unknown') as brand, IFNULL(status,'unknown') as st, COUNT(*) as cnt "
                f"FROM stations{where} AND IFNULL(brand,'Unknown') IN ({ph}) GROUP BY brand, st",
                params + top_brands
            )
        for row in c.fetchall():
            b = row['brand']
            if b not in brand_breakdown:
                brand_breakdown[b] = {'total': 0, 'yes': 0, 'no': 0, 'queue': 0, 'low': 0, 'unknown': 0}
            brand_breakdown[b][row['st']] = row['cnt']
            brand_breakdown[b]['total'] += row['cnt']

    # Region stats for choropleth map
    # Apply brand/fuel filters if set, otherwise global
    region_stats = {}
    if region in ('russia', 'Вся Россия'):
        region_filter_params = []
        region_filter = " WHERE 1=1"
        for b in brands:
            if b: region_filter += " AND brand=?"; region_filter_params.append(b)
        for f in fuels:
            if f: region_filter += " AND fuels_now LIKE ?"; region_filter_params.append(f'%{f}%')
        
        if time_at:
            query = f"""
                SELECT region, st, COUNT(*) as cnt FROM (
                    SELECT region, 
                           IFNULL((SELECT status FROM station_history h WHERE h.id = s.id AND h.timestamp <= ? ORDER BY timestamp DESC LIMIT 1), 'unknown') as st
                    FROM stations s {region_filter}
                ) sub
                WHERE region IS NOT NULL AND region != ''
                GROUP BY region, st
            """
            c.execute(query, [time_at] + region_filter_params)
        else:
            c.execute(
                f"SELECT region, IFNULL(status,'unknown') as st, COUNT(*) as cnt "
                f"FROM stations{region_filter} GROUP BY region, st",
                region_filter_params
            )
        for row in c.fetchall():
            r = row['region']
            if not r: continue
            if r not in region_stats:
                region_stats[r] = {'total': 0, 'yes': 0, 'no': 0, 'queue': 0, 'low': 0, 'unknown': 0, 'avg_reports': region_avg_reports.get(r, 0)}
            region_stats[r][row['st']] = row['cnt']
            region_stats[r]['total'] += row['cnt']

    conn.close()
    return jsonify({
        'status': status_counts,
        'brands_breakdown': brand_breakdown,
        'regions': region_stats,
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)
