const fs = require('fs');

async function fetchRegion(id, ru, en) {
    const query = `[out:json];relation(${id});out geom;`;
    const res = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST", body: query, headers: {'User-Agent': 'GdeBenz-Map/1.0'}
    });
    const data = await res.json();
    
    // Very simplified: extract outer rings from relation
    let poly_rings = [];
    for (let el of data.elements) {
        if (el.type === 'relation' && el.members) {
            for (let m of el.members) {
                if (m.type === 'way' && m.geometry && m.role !== 'inner') {
                    let ring = m.geometry.map(p => [p.lon, p.lat]);
                    poly_rings.push(ring);
                }
            }
        }
    }
    
    if (poly_rings.length > 0) {
        return {
            type: "Feature",
            properties: { name: ru, name_latin: en },
            geometry: { type: "MultiPolygon", coordinates: [poly_rings] }
        };
    }
    return null;
}

async function run() {
    const names = {
        '3374224': ['Республика Крым', 'Republic of Crimea'],
        '71965': ['Запорожская область', 'Zaporizhzhia Oblast'],
        '71974': ['Херсонская область', 'Kherson Oblast']
    };
    
    let features = [];
    for (let [id, [ru, en]] of Object.entries(names)) {
        console.log("Fetching " + ru);
        let f = await fetchRegion(id, ru, en);
        if (f) features.push(f);
        await new Promise(r => setTimeout(r, 2000));
    }
    
    const GEOJSON_PATH = 'public/russia.geojson';
    let base = JSON.parse(fs.readFileSync(GEOJSON_PATH, 'utf8'));
    const existing = Object.values(names).map(x=>x[0]);
    base.features = base.features.filter(f => !existing.includes(f.properties.name));
    base.features.push(...features);
    
    fs.writeFileSync(GEOJSON_PATH, JSON.stringify(base), 'utf8');
    console.log("Added " + features.length + " high poly regions.");
}
run();
