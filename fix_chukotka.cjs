const fs = require('fs');
const GEOJSON_PATH = 'dashboard/public/russia.geojson';
let base = JSON.parse(fs.readFileSync(GEOJSON_PATH, 'utf8'));

function fixRings(rings) {
    for (let r of rings) {
        for (let pt of r) {
            if (pt[0] < 0 && pt[0] > -180) {
                // If it's part of Russia and has negative longitude, add 360
                pt[0] += 360;
            }
        }
    }
}

for (let f of base.features) {
    if (f.properties.name === 'Чукотский автономный округ' || f.properties.name === 'Республика Саха (Якутия)') {
        if (f.geometry.type === 'Polygon') fixRings(f.geometry.coordinates);
        if (f.geometry.type === 'MultiPolygon') {
            for (let p of f.geometry.coordinates) fixRings(p);
        }
    }
}

fs.writeFileSync(GEOJSON_PATH, JSON.stringify(base), 'utf8');
console.log("Fixed Chukotka longitude wrapping");
