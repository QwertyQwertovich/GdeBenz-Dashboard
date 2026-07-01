import urllib.request, json
import time
import random
from db import init_db, upsert_stations

# Границы РФ (примерно)
LAT_MIN, LAT_MAX = 41.0, 82.0
LON_MIN, LON_MAX = 19.0, 170.0

STEP_LAT = 5.0
STEP_LON = 5.0

CYCLE_INTERVAL_HOURS = 1  # парсинг раз в час

def fetch_stations_for_bbox(lat1, lon1, lat2, lon2):
    url = f'https://gdebenz.ru/api/stations?lat1={lat1}&lon1={lon1}&lat2={lat2}&lon2={lon2}'
    req = urllib.request.Request(url, headers={'User-Agent': 'Mozilla/5.0', 'Accept': 'application/json', 'Accept-Charset': 'utf-8'})
    try:
        response = urllib.request.urlopen(req, timeout=10).read().decode('utf-8')
        data = json.loads(response)
        return data
    except Exception as e:
        print(f"Error fetching bbox ({lat1},{lon1} to {lat2},{lon2}): {e}")
        return []

def run_cycle():
    total_found = 0
    lat = LAT_MIN
    while lat < LAT_MAX:
        lon = LON_MIN
        while lon < LON_MAX:
            lat2 = min(lat + STEP_LAT, LAT_MAX)
            lon2 = min(lon + STEP_LON, LON_MAX)

            print(f"Fetching grid: {lat},{lon} to {lat2},{lon2}")
            stations = fetch_stations_for_bbox(lat, lon, lat2, lon2)

            if stations:
                print(f"Found {len(stations)} stations. Saving to DB...")
                upsert_stations(stations)
                total_found += len(stations)

            # Пауза 1-3 секунды, чтобы не забанили
            time.sleep(random.uniform(1.0, 3.0))

            lon += STEP_LON
        lat += STEP_LAT

    print(f"Cycle complete. Total stations processed: {total_found}")
    return total_found

def main():
    init_db()
    cycle = 0
    while True:
        cycle += 1
        print(f"\n=== Starting cycle #{cycle} at {time.strftime('%Y-%m-%d %H:%M:%S')} ===")
        run_cycle()
        next_run = time.strftime('%Y-%m-%d %H:%M:%S', time.localtime(time.time() + CYCLE_INTERVAL_HOURS * 3600))
        print(f"Next cycle at: {next_run}. Sleeping for {CYCLE_INTERVAL_HOURS} hours...\n")
        time.sleep(CYCLE_INTERVAL_HOURS * 3600)

if __name__ == '__main__':
    main()
