from flask import Flask, jsonify, request
from flask_cors import CORS
import sqlite3
import os
import json
import urllib.request
from shapely.geometry import shape, Point

app = Flask(__name__)
CORS(app)

DB_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'stations.db')
GEOJSON_PATH = os.path.join(os.path.dirname(os.path.dirname(__file__)), 'dashboard', 'public', 'russia.geojson')

def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.text_factory = str
    conn.row_factory = sqlite3.Row
    return conn

regions_cache = []
if os.path.exists(GEOJSON_PATH):
    import io
    with io.open(GEOJSON_PATH, 'r', encoding='utf-8') as f:
        geojson = json.load(f)
        for feature in geojson['features']:
            geom = shape(feature['geometry'])
            name = feature['properties'].get('name', 'Unknown')
            regions_cache.append({'name': name, 'geom': geom})

@app.route('/api/regions', methods=['GET'])
def get_regions():
    res = []
    for r in regions_cache:
        bounds = r['geom'].bounds
        center_lon = (bounds[0] + bounds[2]) / 2
        center_lat = (bounds[1] + bounds[3]) / 2
        radius = max(bounds[2]-bounds[0], bounds[3]-bounds[1]) / 2
        res.append({'name': r['name'], 'lat': center_lat, 'lon': center_lon, 'radius': radius})
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
        for f in r['fuels_now'].split(','):
            if f.strip(): fuels_set.add(f.strip())
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
        query = """
        SELECT strftime('%Y-%m-%d %H:00:00', h.timestamp) as time_bucket,
               IFNULL(h.status,'unknown') as status,
               COUNT(DISTINCT h.id) as count
        FROM station_history h
        GROUP BY time_bucket, IFNULL(h.status,'unknown')
        ORDER BY time_bucket ASC
        """
        c.execute(query)
    else:
        query = """
        SELECT strftime('%Y-%m-%d %H:00:00', h.timestamp) as time_bucket,
               IFNULL(h.status,'unknown') as status,
               COUNT(DISTINCT h.id) as count
        FROM station_history h
        JOIN stations s ON h.id = s.id
        WHERE s.region = ?
        GROUP BY time_bucket, IFNULL(h.status,'unknown')
        ORDER BY time_bucket ASC
        """
        c.execute(query, (region,))
    rows = c.fetchall()
    conn.close()
    history_data = {}
    for r in rows:
        tb = r['time_bucket']
        if tb not in history_data:
            history_data[tb] = {'yes': 0, 'no': 0, 'low': 0, 'queue': 0, 'unknown': 0}
        history_data[tb][r['status']] = r['count']
    res = [{'time': k, **v} for k, v in history_data.items()]
    return jsonify(res)

@app.route('/api/stations_map', methods=['GET'])
def get_stations_map():
    """For city-level map: return lat/lon/status/brand of stations in region."""
    region = request.args.get('region')
    brand = request.args.get('brand')
    fuel = request.args.get('fuel')
    if not region or region in ('russia', 'Вся Россия'):
        return jsonify([])
    conn = get_db()
    c = conn.cursor()
    params = [region]
    where = " WHERE region = ?"
    if brand:
        where += " AND brand = ?"
        params.append(brand)
    if fuel:
        where += " AND fuels_now LIKE ?"
        params.append(f"%{fuel}%")
    c.execute(f"SELECT id, lat, lon, brand, status, fuels_now FROM stations{where} LIMIT 5000", params)
    rows = c.fetchall()
    conn.close()
    return jsonify([dict(r) for r in rows])

def fetch_views(ids):
    try:
        url = "https://gdebenz.ru/api/views?ids=" + ",".join(ids)
        req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0'})
        res = urllib.request.urlopen(req, timeout=5).read().decode('utf-8')
        return json.loads(res)
    except:
        return {}

@app.route('/api/stats', methods=['GET'])
def get_stats():
    conn = get_db()
    c = conn.cursor()
    region = request.args.get('region', 'russia')
    brands = request.args.getlist('brand')  # support multiple
    fuels = request.args.getlist('fuel')

    params = []
    where_clause = " WHERE 1=1"
    if region and region not in ('russia', 'Вся Россия'):
        where_clause += " AND region = ?"
        params.append(region)
    for brand in brands:
        if brand:
            where_clause += " AND brand = ?"
            params.append(brand)
    for fuel in fuels:
        if fuel:
            where_clause += " AND fuels_now LIKE ?"
            params.append(f"%{fuel}%")

    # Status counts
    c.execute(f"SELECT IFNULL(status,'unknown') as status, COUNT(*) as count FROM stations{where_clause} GROUP BY IFNULL(status,'unknown')", params)
    status_counts = {r['status']: r['count'] for r in c.fetchall()}

    # Top 10 brands by count, with breakdown
    c.execute(f"SELECT IFNULL(brand,'Unknown') as brand, COUNT(*) as count FROM stations{where_clause} GROUP BY IFNULL(brand,'Unknown') ORDER BY count DESC LIMIT 10", params)
    top_brands_rows = c.fetchall()
    top_brands = [row['brand'] for row in top_brands_rows]

    brand_breakdown = {}
    if top_brands:
        placeholders = ','.join(['?'] * len(top_brands))
        q = (f"SELECT IFNULL(brand,'Unknown') as brand, IFNULL(status,'unknown') as status, COUNT(*) as count "
             f"FROM stations{where_clause} AND IFNULL(brand,'Unknown') IN ({placeholders}) "
             f"GROUP BY IFNULL(brand,'Unknown'), IFNULL(status,'unknown')")
        c.execute(q, params + top_brands)
        for row in c.fetchall():
            b = row['brand']
            s = row['status']
            if b not in brand_breakdown:
                brand_breakdown[b] = {'total': 0, 'yes': 0, 'no': 0, 'queue': 0, 'low': 0, 'unknown': 0}
            brand_breakdown[b][s] = row['count']
            brand_breakdown[b]['total'] += row['count']

    # Region stats (for choropleth map on Russia view)
    region_stats = {}
    if region in ('russia', 'Вся Россия'):
        c.execute("SELECT region, IFNULL(status,'unknown') as status, COUNT(*) as count FROM stations GROUP BY region, IFNULL(status,'unknown')")
        for row in c.fetchall():
            r = row['region']
            if r not in region_stats:
                region_stats[r] = {'total': 0, 'yes': 0, 'no': 0, 'queue': 0, 'low': 0, 'unknown': 0}
            region_stats[r][row['status']] = row['count']
            region_stats[r]['total'] += row['count']

    # Confidence sampling (30 random stations, fetch views)
    avg_views = 0
    if region and region not in ('russia', 'Вся Россия'):
        c.execute(f"SELECT id FROM stations{where_clause} AND status != 'unknown' AND status IS NOT NULL ORDER BY RANDOM() LIMIT 30", params)
        sample_ids = [row['id'] for row in c.fetchall()]
        if sample_ids:
            views_data = fetch_views(sample_ids)
            if views_data:
                total_views = sum(views_data.values())
                avg_views = round(total_views / len(views_data))

    conn.close()
    return jsonify({
        'status': status_counts,
        'brands_breakdown': brand_breakdown,
        'regions': region_stats,
        'confidence_views': avg_views
    })

if __name__ == '__main__':
    app.run(debug=True, port=5000)
