const fs = require('fs');
const osmtogeojson = require('osmtogeojson');

async function run() {
    const query = `
    [out:json];
    relation(id:3374224, 1574364, 71971, 71973, 71965, 71974);
    out geom;
    `;
    const res = await fetch("https://overpass-api.de/api/interpreter", {
        method: "POST",
        body: query
    });
    const data = await res.json();
    const geo = osmtogeojson(data);
    
    // Map OSM IDs to our names
    const names = {
        '3374224': ['Республика Крым', 'Republic of Crimea'],
        '1574364': ['Севастополь', 'Sevastopol'],
        '71971': ['ДНР', "Donetsk People's Republic"],
        '71973': ['ЛНР', "Luhansk People's Republic"],
        '71965': ['Запорожская область', 'Zaporizhzhia Oblast'],
        '71974': ['Херсонская область', 'Kherson Oblast']
    };
    
    const GEOJSON_PATH = 'public/russia.geojson';
    let base = JSON.parse(fs.readFileSync(GEOJSON_PATH, 'utf8'));
    
    // Remove old low poly
    base.features = base.features.filter(f => !Object.values(names).map(x=>x[0]).includes(f.properties.name));
    
    // Add new high poly
    for (const f of geo.features) {
        if (f.geometry.type === 'Polygon' || f.geometry.type === 'MultiPolygon') {
            const idMatch = f.id.match(/relation\/(\d+)/);
            if (idMatch && names[idMatch[1]]) {
                f.properties = {
                    name: names[idMatch[1]][0],
                    name_latin: names[idMatch[1]][1]
                };
                base.features.push(f);
            }
        }
    }
    
    fs.writeFileSync(GEOJSON_PATH, JSON.stringify(base), 'utf8');
    console.log("Updated russia.geojson with high-poly relations!");
}
run();
