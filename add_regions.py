import json
from shapely.geometry import Polygon

GEOJSON_PATH = 'dashboard/public/russia.geojson'

EXTRA_REGIONS = [
  {
    'name': 'Республика Крым',
    'name_latin': 'Republic of Crimea',
    'coords': [[44.4, 33.6], [45.4, 32.5], [46.1, 33.8], [45.3, 35.5], [45.3, 36.6], [44.8, 35.5], [44.6, 34.3], [44.4, 33.6]]
  },
  {
    'name': 'Севастополь',
    'name_latin': 'Sevastopol',
    'coords': [[44.4, 33.6], [44.8, 33.5], [44.8, 33.7], [44.6, 33.9], [44.4, 33.8], [44.4, 33.6]]
  },
  {
    'name': 'ДНР',
    'name_latin': 'Donetsk People\'s Republic',
    'coords': [[48.6,37.3],[48.7,38.3],[48.3,38.7],[47.8,38.9],[47.5,38.1],[47.6,37.4],[48.0,37.1],[48.6,37.3]]
  },
  {
    'name': 'ЛНР',
    'name_latin': 'Luhansk People\'s Republic',
    'coords': [[49.3,38.3],[49.5,39.3],[49.0,39.8],[48.7,39.4],[48.3,38.7],[48.7,38.3],[49.3,38.3]]
  },
  {
    'name': 'Запорожская область',
    'name_latin': 'Zaporizhzhia Oblast',
    'coords': [[47.7,34.1],[47.5,35.5],[47.0,36.2],[46.6,35.8],[46.3,34.6],[46.7,33.7],[47.2,33.9],[47.7,34.1]]
  },
  {
    'name': 'Херсонская область',
    'name_latin': 'Kherson Oblast',
    'coords': [[47.2,33.2],[47.2,34.2],[46.6,34.0],[46.0,33.5],[45.7,32.8],[46.0,32.2],[46.5,32.0],[47.0,32.4],[47.2,33.2]]
  }
]

with open(GEOJSON_PATH, 'r', encoding='utf-8') as f:
    data = json.load(f)

existing_names = set(f['properties'].get('name') for f in data['features'])

added = 0
for reg in EXTRA_REGIONS:
    if reg['name'] not in existing_names:
        # Note: GeoJSON uses [longitude, latitude]
        poly_coords = [[[lon, lat] for lat, lon in reg['coords']]]
        feature = {
            "type": "Feature",
            "properties": {
                "name": reg['name'],
                "name_latin": reg['name_latin']
            },
            "geometry": {
                "type": "Polygon",
                "coordinates": poly_coords
            }
        }
        data['features'].append(feature)
        added += 1

if added > 0:
    with open(GEOJSON_PATH, 'w', encoding='utf-8') as f:
        json.dump(data, f, ensure_ascii=False)
    print(f"Added {added} regions to geojson.")
else:
    print("Regions already exist.")
