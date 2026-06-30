const fs = require('fs');

const crimeaCoords = [
    [33.0, 45.2], [33.6, 45.8], [34.5, 46.1], [34.8, 45.8], [35.1, 45.2],
    [36.0, 45.4], [36.6, 45.4], [36.3, 45.1], [35.5, 44.9], [35.1, 44.8],
    [34.3, 44.7], [33.5, 44.4], [33.0, 44.6], [32.5, 45.3], [33.0, 45.2]
];

const GEOJSON_PATH = 'dashboard/public/russia.geojson';
let base = JSON.parse(fs.readFileSync(GEOJSON_PATH, 'utf8'));
base.features = base.features.filter(f => f.properties.name !== 'Республика Крым');
base.features.push({
    type: 'Feature',
    properties: { name: 'Республика Крым', name_latin: 'Republic of Crimea' },
    geometry: { type: 'Polygon', coordinates: [crimeaCoords] }
});
fs.writeFileSync(GEOJSON_PATH, JSON.stringify(base), 'utf8');
console.log("Added Manual Crimea!");
