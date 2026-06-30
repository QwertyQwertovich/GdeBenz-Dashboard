const fs = require('fs');

async function run() {
    const names = {
        '3374224': ['Республика Крым', 'Republic of Crimea'],
        '1574364': ['Севастополь', 'Sevastopol'],
        '71971': ['ДНР', "Donetsk People's Republic"],
        '71973': ['ЛНР', "Luhansk People's Republic"],
        '71965': ['Запорожская область', 'Zaporizhzhia Oblast'],
        '71974': ['Херсонская область', 'Kherson Oblast']
    };
    
    let features = [];
    for (const [id, [ru, en]] of Object.entries(names)) {
        console.log("Fetching " + ru);
        const res = await fetch(`https://nominatim.openstreetmap.org/details.php?osmtype=R&osmid=${id}&polygon_geojson=1&format=json`, {
            headers: { 'User-Agent': 'curl/7.88.1' }
        });
        const data = await res.json();
        if (data.geometry) {
            features.push({
                type: 'Feature',
                properties: { name: ru, name_latin: en },
                geometry: data.geometry
            });
        }
        await new Promise(r => setTimeout(r, 1500));
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
