const fs = require('fs');

async function run() {
    const res = await fetch("https://raw.githubusercontent.com/martynafford/natural-earth-geojson/master/110m/cultural/ne_110m_admin_1_states_provinces.json");
    const data = await res.json();
    let crimea = data.features.find(f => f.properties.name_ru === 'Крым' || f.properties.name === 'Crimea');
    if (!crimea) {
        console.log("Not found in natural earth 110m");
        const res2 = await fetch("https://raw.githubusercontent.com/martynafford/natural-earth-geojson/master/50m/cultural/ne_50m_admin_1_states_provinces.json");
        const data2 = await res2.json();
        crimea = data2.features.find(f => f.properties.name_ru === 'Крым' || f.properties.name === 'Crimea' || f.properties.name === 'Autonomous Republic of Crimea');
    }
    if (crimea) {
        const GEOJSON_PATH = 'dashboard/public/russia.geojson';
        let base = JSON.parse(fs.readFileSync(GEOJSON_PATH, 'utf8'));
        base.features = base.features.filter(f => f.properties.name !== 'Республика Крым');
        base.features.push({
            type: 'Feature',
            properties: { name: 'Республика Крым', name_latin: 'Republic of Crimea' },
            geometry: crimea.geometry
        });
        fs.writeFileSync(GEOJSON_PATH, JSON.stringify(base), 'utf8');
        console.log("Added Crimea from Natural Earth!");
    }
}
run();
