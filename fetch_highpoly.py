import json
import urllib.request
import time

RELATIONS = {
    'Республика Крым': (3374224, 'Republic of Crimea'),
    'Севастополь': (1574364, 'Sevastopol'),
    'ДНР': (71971, "Donetsk People's Republic"),
    'ЛНР': (71973, "Luhansk People's Republic"),
    'Запорожская область': (71965, 'Zaporizhzhia Oblast'),
    'Херсонская область': (71974, 'Kherson Oblast')
}

features = []
headers = {'User-Agent': 'GdeBenz-Dashboard/1.0 (contact@example.com)'}

for ru_name, (osm_id, en_name) in RELATIONS.items():
    url = f"https://nominatim.openstreetmap.org/details.php?osmtype=R&osmid={osm_id}&polygon_geojson=1&format=json"
    req = urllib.request.Request(url, headers=headers)
    print(f"Fetching {ru_name}...")
    resp = urllib.request.urlopen(req).read().decode('utf-8')
    data = json.loads(resp)
    geom = data.get('geometry')
    if geom:
        features.append({
            "type": "Feature",
            "properties": {
                "name": ru_name,
                "name_latin": en_name
            },
            "geometry": geom
        })
    time.sleep(1.5)

GEOJSON_PATH = 'dashboard/public/russia.geojson'
with open(GEOJSON_PATH, 'r', encoding='utf-8') as f:
    base = json.load(f)

# Remove old low-poly
existing_names = set(RELATIONS.keys())
base['features'] = [f for f in base['features'] if f['properties'].get('name') not in existing_names]
# Add high-poly
base['features'].extend(features)

with open(GEOJSON_PATH, 'w', encoding='utf-8') as f:
    json.dump(base, f, ensure_ascii=False)

print(f"Added {len(features)} high-poly regions.")
