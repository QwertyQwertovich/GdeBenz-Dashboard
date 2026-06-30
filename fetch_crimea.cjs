const fs = require('fs');

async function run() {
    console.log("Fetching Crimea");
    const res = await fetch("https://nominatim.openstreetmap.org/details.php?osmtype=R&osmid=3374224&polygon_geojson=1&polygon_threshold=0.01&format=json", {
        headers: { 'User-Agent': 'curl/7.88.1' }
    });
    const data = await res.json();
    if (data.geometry) {
        const GEOJSON_PATH = 'dashboard/public/russia.geojson';
        let base = JSON.parse(fs.readFileSync(GEOJSON_PATH, 'utf8'));
        base.features = base.features.filter(f => f.properties.name !== 'Республика Крым');
        base.features.push({
            type: 'Feature',
            properties: { name: 'Республика Крым', name_latin: 'Republic of Crimea' },
            geometry: data.geometry
        });
        fs.writeFileSync(GEOJSON_PATH, JSON.stringify(base), 'utf8');
        console.log("Added Crimea!");
    } else {
        console.log("No geometry found");
    }
}
run();
