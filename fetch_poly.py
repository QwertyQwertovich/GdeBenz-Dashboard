import json, urllib.request

q = """
[out:json];
relation(id:3374224, 1574364, 71971, 71973, 71965, 71974);
out geom;
"""

req = urllib.request.Request("https://overpass-api.de/api/interpreter", data=q.encode('utf-8'))
data = json.loads(urllib.request.urlopen(req).read().decode('utf-8'))

names = {
    3374224: ['Республика Крым', 'Republic of Crimea'],
    1574364: ['Севастополь', 'Sevastopol'],
    71971: ['ДНР', "Donetsk People's Republic"],
    71973: ['ЛНР', "Luhansk People's Republic"],
    71965: ['Запорожская область', 'Zaporizhzhia Oblast'],
    71974: ['Херсонская область', 'Kherson Oblast']
}

features = []
for el in data.get('elements', []):
    if el['type'] == 'relation':
        ru_name, en_name = names[el['id']]
        
        # very simple conversion: collect all nodes from members of type way
        # and create a multipolygon structure. Note: proper osm2geojson is complex,
        # but since we just need points to draw on leaflet, we can extract rings.
        # Actually, Overpass `out geom` returns `geometry` on way members!
        
        poly_rings = []
        for mem in el.get('members', []):
            if mem['type'] == 'way' and 'geometry' in mem:
                ring = [[p['lon'], p['lat']] for p in mem['geometry']]
                if ring:
                    poly_rings.append(ring)
                    
        if poly_rings:
            features.append({
                "type": "Feature",
                "properties": {"name": ru_name, "name_latin": en_name},
                "geometry": {"type": "MultiPolygon", "coordinates": [poly_rings]}
            })

with open('dashboard/public/russia.geojson', 'r', encoding='utf-8') as f:
    base = json.load(f)

existing = [v[0] for v in names.values()]
base['features'] = [f for f in base['features'] if f['properties'].get('name') not in existing]
base['features'].extend(features)

with open('dashboard/public/russia.geojson', 'w', encoding='utf-8') as f:
    json.dump(base, f, ensure_ascii=False)

print(f"Added {len(features)} high poly regions.")
