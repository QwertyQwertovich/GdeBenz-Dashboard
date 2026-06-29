import json
from scraper.db import init_db, upsert_stations

init_db()
with open('spb_gas_stations.json', 'r', encoding='utf-8') as f:
    data = json.load(f)
    upsert_stations(data)
print("Seeded DB with SPB data")
