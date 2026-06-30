const fs = require('fs');

const GEOJSON_PATH = 'dashboard/public/russia.geojson';
let base = JSON.parse(fs.readFileSync(GEOJSON_PATH, 'utf8'));

for (let f of base.features) {
    if (f.properties.name === 'ДНР') {
        f.properties.name = 'Донецкая область';
        f.properties.name_latin = 'Donetsk Oblast';
    }
    if (f.properties.name === 'ЛНР') {
        f.properties.name = 'Луганская область';
        f.properties.name_latin = 'Luhansk Oblast';
    }
}

fs.writeFileSync(GEOJSON_PATH, JSON.stringify(base), 'utf8');
console.log("Renamed in GeoJSON");
