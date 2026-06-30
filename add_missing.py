import json
import os

GEOJSON_PATH = 'dashboard/public/russia.geojson'
with open(GEOJSON_PATH, 'r', encoding='utf-8') as f:
    base = json.load(f)

existing = set(f['properties'].get('name') for f in base['features'])

missing = []

if 'Запорожская область' not in existing:
    missing.append({
        "type": "Feature",
        "properties": {"name": "Запорожская область", "name_latin": "Zaporizhzhia Oblast"},
        "geometry": {"type": "Polygon", "coordinates": [[[34.5, 46.3], [37.2, 46.3], [37.2, 47.8], [34.5, 47.8], [34.5, 46.3]]]}
    })
if 'Херсонская область' not in existing:
    missing.append({
        "type": "Feature",
        "properties": {"name": "Херсонская область", "name_latin": "Kherson Oblast"},
        "geometry": {"type": "Polygon", "coordinates": [[[31.5, 46.0], [34.5, 46.0], [34.5, 47.5], [31.5, 47.5], [31.5, 46.0]]]}
    })
if 'Республика Крым' not in existing:
    missing.append({
        "type": "Feature",
        "properties": {"name": "Республика Крым", "name_latin": "Republic of Crimea"},
        "geometry": {"type": "Polygon", "coordinates": [[[32.5, 44.3], [36.5, 44.3], [36.5, 46.1], [32.5, 46.1], [32.5, 44.3]]]}
    })

base['features'].extend(missing)
with open(GEOJSON_PATH, 'w', encoding='utf-8') as f:
    json.dump(base, f, ensure_ascii=False)
print("Restored low poly for missing regions.")
