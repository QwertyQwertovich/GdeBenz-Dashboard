from curl_cffi import requests
import json
import platform
import time
import random
from db import init_db, upsert_stations, get_db
import os

# Границы РФ (примерно)
LAT_MIN, LAT_MAX = 41.0, 82.0
LON_MIN, LON_MAX = 19.0, 170.0

STEP_LAT = 5.0
STEP_LON = 5.0

CYCLE_INTERVAL_HOURS = 2  # парсинг раз в 2 часа

def fetch_stations_for_bbox(lat1, lon1, lat2, lon2):
    url = f'https://gdebenz.ru/api/stations?lat1={lat1}&lon1={lon1}&lat2={lat2}&lon2={lon2}'
    try:
        proxies = {"http": "socks5://127.0.0.1:9050", "https": "socks5://127.0.0.1:9050"} if platform.system() == 'Linux' else None
        response = requests.get(url, impersonate="chrome110", proxies=proxies, timeout=30)
        data = response.json()
        if isinstance(data, dict) and 'data' in data:
            data = data['data']
        if not isinstance(data, list):
            print(f"Unexpected response format: {data}")
            return []
        return data
    except Exception as e:
        print(f"Error fetching bbox ({lat1},{lon1} to {lat2},{lon2}): {e}")
        return []

def fetch_recursive(lat1, lon1, lat2, lon2, depth=0):
    stations = fetch_stations_for_bbox(lat1, lon1, lat2, lon2)
    # Subdivide if we hit >= 1000 items (assuming API might limit response size)
    if len(stations) >= 1000 and depth < 3:
        mid_lat = (lat1 + lat2) / 2.0
        mid_lon = (lon1 + lon2) / 2.0
        print(f"Subdividing grid {lat1},{lon1}-{lat2},{lon2} due to {len(stations)} items limit...")
        time.sleep(1)
        s1 = fetch_recursive(lat1, lon1, mid_lat, mid_lon, depth+1)
        time.sleep(1)
        s2 = fetch_recursive(mid_lat, lon1, lat2, mid_lon, depth+1)
        time.sleep(1)
        s3 = fetch_recursive(lat1, mid_lon, mid_lat, lon2, depth+1)
        time.sleep(1)
        s4 = fetch_recursive(mid_lat, mid_lon, lat2, lon2, depth+1)
        
        merged = {s['id']: s for s in s1 + s2 + s3 + s4}
        return list(merged.values())
    return stations

def run_cycle():
    total_found = 0
    # Increase base grid to 10x10 to heavily optimize requests over empty areas
    STEP_LAT_OPT = 10.0
    STEP_LON_OPT = 10.0
    
    lat = LAT_MIN
    while lat < LAT_MAX:
        lon = LON_MIN
        while lon < LON_MAX:
            lat2 = min(lat + STEP_LAT_OPT, LAT_MAX)
            lon2 = min(lon + STEP_LON_OPT, LON_MAX)

            print(f"Fetching grid: {lat},{lon} to {lat2},{lon2}")
            stations = fetch_recursive(lat, lon, lat2, lon2)

            if stations:
                print(f"Found {len(stations)} stations. Saving to DB...")
                upsert_stations(stations)
                total_found += len(stations)

            time.sleep(random.uniform(2.0, 4.0))
            lon += STEP_LON_OPT
        lat += STEP_LAT_OPT

    print(f"Cycle complete. Total stations processed: {total_found}")
    return total_found


def fetch_station_comments(sid):
    try:
        url = f"https://gdebenz.ru/api/comments/{sid}"
        proxies = {"http": "socks5://127.0.0.1:9050", "https": "socks5://127.0.0.1:9050"} if platform.system() == 'Linux' else None
        response = requests.get(url, impersonate="chrome110", proxies=proxies, timeout=30)
        return response.json()
    except:
        return None

# --- Background Thread for Region Confidence ---
region_avg_reports = {}

def load_views_cache():
    if os.path.exists('views_cache.json'):
        try:
            with open('views_cache.json', 'r') as f:
                return json.load(f)
        except:
            return {}
    return {}

def save_views_cache(cache):
    try:
        with open('views_cache.json', 'w') as f:
            json.dump(cache, f)
    except:
        pass


def load_views_cache():
    if os.path.exists('views_cache.json'):
        try:
            with open('views_cache.json', 'r') as f:
                return json.load(f)
        except:
            return {}
    return {}

def save_views_cache(cache):
    try:
        with open('views_cache.json', 'w') as f:
            json.dump(cache, f)
    except:
        pass

def update_region_confidence_loop():
    while True:
        try:
            conn = get_db()
            c = conn.cursor()
            # Get all unique regions
            c.execute("SELECT DISTINCT region FROM stations WHERE region IS NOT NULL AND region != ''")
            regions = [r['region'] for r in c.fetchall()]
            
            views_cache = load_views_cache()
            new_views_cache = {}
            region_avg_growth = {}

            for r in regions:
                old_sids = views_cache.get(r, {})
                t_growth = 0
                v_growth = 0
                if old_sids:
                    for sid, old_v in old_sids.items():
                        data = fetch_station_comments(sid)
                        if data:
                            v = data.get('views', 0)
                            if v >= old_v:
                                t_growth += (v - old_v)
                                v_growth += 1
                
                region_avg_growth[r] = round(t_growth / v_growth, 1) if v_growth > 0 else 0
                
                c.execute("SELECT id FROM stations WHERE region=? AND status IS NOT NULL AND status != '' ORDER BY RANDOM() LIMIT 10", (r,))
                sample_ids = [row['id'] for row in c.fetchall()]
                
                total_real = 0
                valid = 0
                new_views_cache[r] = {}
                for sid in sample_ids:
                    data = fetch_station_comments(sid)
                    if data:
                        total_real += data.get('realCount', 0)
                        valid += 1
                        new_views_cache[r][sid] = data.get('views', 0)
                
                if valid > 0:
                    region_avg_reports[r] = round(total_real / valid, 1)
                else:
                    region_avg_reports[r] = 0
                    
                time.sleep(1) # Be gentle to the API
                
            # Russia overall sample
            old_sids = views_cache.get('russia', {})
            t_growth = 0
            v_growth = 0
            if old_sids:
                for sid, old_v in old_sids.items():
                    data = fetch_station_comments(sid)
                    if data:
                        v = data.get('views', 0)
                        if v >= old_v:
                            t_growth += (v - old_v)
                            v_growth += 1
            region_avg_growth['russia'] = round(t_growth / v_growth, 1) if v_growth > 0 else 0

            russia_total_real = 0
            russia_valid = 0
            new_views_cache['russia'] = {}
            c.execute("SELECT id FROM stations WHERE status IS NOT NULL AND status != '' ORDER BY RANDOM() LIMIT 20")
            russia_sample_ids = [row['id'] for row in c.fetchall()]
            for sid in russia_sample_ids:
                data = fetch_station_comments(sid)
                if data:
                    russia_total_real += data.get('realCount', 0)
                    russia_valid += 1
                    new_views_cache['russia'][sid] = data.get('views', 0)
            if russia_valid > 0:
                region_avg_reports['russia'] = round(russia_total_real / russia_valid, 1)

            save_views_cache(new_views_cache)

            for r, val in region_avg_reports.items():
                growth = region_avg_growth.get(r, 0)
                c.execute("INSERT INTO region_metrics_history (region, avg_reports, avg_views_growth) VALUES (?, ?, ?)", (r, val, growth))
            
            conn.commit()
            conn.close()
        except Exception as e:
            print("Confidence Loop Error:", e)
            
        time.sleep(CYCLE_INTERVAL_HOURS * 3600)


import threading
threading.Thread(target=update_region_confidence_loop, daemon=True).start()

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
