from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import xarray as xr
import numpy as np
import rioxarray 
from scipy import ndimage
from skimage import measure
from apscheduler.schedulers.background import BackgroundScheduler
from ecmwf.opendata import Client
import os
import glob
from fastapi.responses import StreamingResponse
import io
import datetime
import math
import requests
from pytz import timezone

import requests
import urllib.parse

app = FastAPI(title="MetOcean API Kalteng - Ultra Hemat RAM")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

print("Membuka 9 File Satelit (Laut & Udara) secara Lazy Load...")

# --- 1. BUKA FILE TANPA MEMBACA DATA KE RAM (HANYA MENGINTIP DAFTAR ISI) ---
ds_suhu = xr.open_dataset('data_nc/suhu_kalteng.nc')
ds_arus = xr.open_dataset('data_nc/arus_kalteng.nc')
ds_salinitas = xr.open_dataset('data_nc/salinitas_kalteng.nc')
ds_ssh = xr.open_dataset('data_nc/ssh_kalteng.nc')
ds_gelombang = xr.open_dataset('data_nc/gelombang_kalteng.nc')

def open_grib(file_path):
    ds = xr.open_dataset(file_path, engine='cfgrib')
    if 'time' in ds.coords or 'time' in ds.variables:
        ds = ds.drop_vars('time')
    if 'valid_time' in ds.coords and 'step' in ds.dims:
        ds = ds.swap_dims({'step': 'valid_time'}).rename({'valid_time': 'time'})
    return ds

# ==========================================
# ROBOT PENJADWALAN OTOMATIS (UPDATE ECMWF)
# ==========================================
from pytz import timezone # Pastikan ini di-import agar timezone Jakarta berfungsi

def update_cuaca_otomatis():
    print("\n⏳ [AUTO-UPDATE] Memulai download data cuaca ECMWF terbaru...")
    
    import glob, os
    idx_files = glob.glob("data_met/*.idx")
    for f in idx_files:
        try: os.remove(f)
        except: pass
            
    try:
        from ecmwf.opendata import Client
        client = Client(source="ecmwf")
        waktu_forecast = list(range(0, 145, 3)) + list(range(150, 241, 6))
        
        params = {
            "10u": "10u_kalteng.grib2", 
            "10v": "10v_kalteng.grib2", 
            "msl": "msl_kalteng.grib2", 
            "tp": "tp_kalteng.grib2"
        }
        
        for param, filename in params.items():
            print(f"  -> Mendownload {param.upper()} (Global Data)...")
            client.retrieve(
                type="fc", 
                param=param, 
                step=waktu_forecast, 
                target=f"data_met/{filename}"
            )
        print("✅ [AUTO-UPDATE] Selesai! WebGIS menggunakan data cuaca terbaru.")
    except Exception as e:
        print(f"  -> ERROR DOWNLOAD: {e}")

# --- PINTU DARURAT (API FORCE UPDATE) ---
# Ini yang baru! URL khusus untuk memaksa server download kapan saja.
@app.get("/api/force-update")
async def force_update():
    print("⚡ Menerima perintah PAKSA UPDATE dari browser!")
    update_cuaca_otomatis()
    return {"status": "Sukses", "message": "Proses download sedang berjalan! Silakan cek tab Logs di Render."}


# --- NYALAKAN MESIN PENJADWALAN ---
from apscheduler.schedulers.background import BackgroundScheduler
scheduler = BackgroundScheduler()

# KUNCI PERBAIKAN: Jadwal Jam 08:00 Pagi dengan Zona Waktu Asia/Jakarta
scheduler.add_job(update_cuaca_otomatis, 'cron', hour=8, minute=0, timezone='Asia/Jakarta')

scheduler.start()
# ==========================================

def load_batimetri(file_path):
    da = rioxarray.open_rasterio(file_path)
    da = da.squeeze('band') 
    
    # 1. PAKSA PENGENALAN SISTEM KOORDINAT BUMI (WGS84)
    da.rio.write_crs("EPSG:4326", inplace=True)
    
    # 2. Potong dan haluskan agar seragam dengan data satelit (0.033)
    min_lon, max_lon = 109.0, 116.0
    min_lat, max_lat = -5.5, -0.5
    da = da.rio.clip_box(minx=min_lon, miny=min_lat, maxx=max_lon, maxy=max_lat)
    
    da = da.where(da <= 0)
    
    new_lon = np.arange(min_lon, max_lon, 0.033)
    new_lat = np.arange(min_lat, max_lat, 0.033)
    
    return da.interp(x=new_lon, y=new_lat, method='linear').sortby('y', ascending=False)

ds_bathy = load_batimetri('data_nc/batimetri_kalteng.tif')

print("✅ Mesin MetOcean Aktif! (Mode Ultra Hemat RAM)")

# --- 2. FUNGSI SNIPER: POTONG DATA TEPAT SASARAN ---
def extract_time_slice(ds, var_name, time_index, depth_index=None):
    # Cari waktu mulai (jam ke-0)
    start_time = ds.time.values[0]
    # Tambah X jam sesuai posisi slider di Web
    target_time = start_time + np.timedelta64(time_index, 'h')
    
    # Potong lapis kedalaman dulu agar semakin ringan
    if depth_index is not None and 'depth' in ds[var_name].dims:
        safe_depth = min(depth_index, len(ds['depth']) - 1)
        ds_sliced = ds[var_name].isel(depth=safe_depth)
    else:
        ds_sliced = ds[var_name]
        
    # KEAJAIBAN DI SINI: Xarray hanya akan menghitung data 
    # tepat di detik yang diminta, tanpa membebani RAM global!
    return ds_sliced.interp(time=target_time, method='linear')

# --- 3. FUNGSI PENGHALUS PIXEL PETA ---
# --- 3. FUNGSI PENGHALUS & PEMOTONG PIXEL PETA ---
def spatial_interp_2d(slice_2d):
    # 1. BATASI AREA HANYA KALIMANTAN TENGAH! 
    # (Ini mencegah RAM jebol karena data ECMWF ukurannya sebesar Planet Bumi)
    min_lon, max_lon = 109.0, 116.0
    min_lat, max_lat = -5.5, -0.5
    
    # Menangani sifat satelit ECMWF yang garis lintangnya terbalik (90 ke -90)
    lats_raw = slice_2d.latitude.values
    if lats_raw[0] > lats_raw[-1]: 
        slice_2d = slice_2d.sel(latitude=slice(max_lat, min_lat), longitude=slice(min_lon, max_lon))
    else:
        slice_2d = slice_2d.sel(latitude=slice(min_lat, max_lat), longitude=slice(min_lon, max_lon))

    # Rapikan urutan kordinat
    slice_2d = slice_2d.sortby('longitude').sortby('latitude')
    
    # 2. HALUSKAN PIXEL (HANYA UNTUK KOTAK KALTENG SAJA)
    new_lon = np.arange(min_lon, max_lon, 0.033)
    new_lat = np.arange(min_lat, max_lat, 0.033)
    
    return slice_2d.interp(latitude=new_lat, longitude=new_lon, method='linear').sortby('latitude', ascending=False)
# --- 4. RAKIT DATA JADI JSON API ---
def get_grid_data(ds, time_index, depth_index=None):
    var_name = list(ds.data_vars)[0]
    slice_2d = extract_time_slice(ds, var_name, time_index, depth_index)
    refined_slice = spatial_interp_2d(slice_2d)
    
    data = refined_slice.values
    data_flat = [round(float(v), 2) if v is not None else None for v in np.where(np.isnan(data), None, data).flatten().tolist()]
    lats, lons = refined_slice.latitude.values, refined_slice.longitude.values
    
    return {
        "nx": len(lons), "ny": len(lats), 
        "lo1": float(lons[0]), "la1": float(lats[0]), 
        "dx": float(np.round(lons[1] - lons[0], 3)), "dy": float(np.round(abs(lats[1] - lats[0]), 3)), 
        "zs": data_flat
    }

def get_vector_data(ds_u, ds_v, time_index, depth_index=None):
    var_u, var_v = list(ds_u.data_vars)[0], list(ds_v.data_vars)[0]
    
    u_slice = extract_time_slice(ds_u, var_u, time_index, depth_index)
    v_slice = extract_time_slice(ds_v, var_v, time_index, depth_index)
    
    u_ref, v_ref = spatial_interp_2d(u_slice), spatial_interp_2d(v_slice)
    u_data, v_data = u_ref.values, v_ref.values
    lats, lons = u_ref.latitude.values, u_ref.longitude.values
    dx, dy = float(np.round(lons[1] - lons[0], 3)), float(np.round(abs(lats[1] - lats[0]), 3))
    
    return [
        {"header": {"parameterCategory": 2, "parameterNumber": 2, "lo1": float(lons[0]), "la1": float(lats[0]), "dx": dx, "dy": dy, "nx": len(lons), "ny": len(lats), "refTime": "0"}, "data": np.where(np.isnan(u_data), None, u_data).flatten().tolist()},
        {"header": {"parameterCategory": 2, "parameterNumber": 3, "lo1": float(lons[0]), "la1": float(lats[0]), "dx": dx, "dy": dy, "nx": len(lons), "ny": len(lats), "refTime": "0"}, "data": np.where(np.isnan(v_data), None, v_data).flatten().tolist()}
    ]

# --- 5. ENDPOINTS PELAYAN RESTORAN ---
@app.get("/api/depths")
def get_depths(): return {"depths": [round(float(d), 1) for d in ds_suhu['depth'].values.tolist()]} if 'depth' in ds_suhu.dims else {"depths": [0.0]}

@app.get("/api/suhu/{time_index}/{depth_index}")
def api_suhu(time_index: int, depth_index: int): return get_grid_data(ds_suhu, time_index, depth_index)

@app.get("/api/salinitas/{time_index}/{depth_index}")
def api_salinitas(time_index: int, depth_index: int): return get_grid_data(ds_salinitas, time_index, depth_index)

@app.get("/api/gelombang/{time_index}")
def api_gelombang(time_index: int): return get_grid_data(ds_gelombang, time_index)

@app.get("/api/ssh/{time_index}")
def api_ssh(time_index: int): return get_grid_data(ds_ssh, time_index)

@app.get("/api/arus/{time_index}/{depth_index}")
def api_arus(time_index: int, depth_index: int): return get_vector_data(ds_arus, ds_arus, time_index, depth_index)

@app.get("/api/msl/{time_index}")
def api_msl(time_index: int):
    with open_grib('data_met/msl_kalteng.grib2') as ds:
        data = get_grid_data(ds, time_index)
        data['zs'] = [round(v / 100, 1) if v is not None else None for v in data['zs']]
        return data

@app.get("/api/hujan/{time_index}")
def api_hujan(time_index: int):
    with open_grib('data_met/tp_kalteng.grib2') as ds:
        data = get_grid_data(ds, time_index)
        data['zs'] = [round(v * 1000, 2) if v is not None else None for v in data['zs']]
        return data

@app.get("/api/angin/{time_index}")
def api_angin(time_index: int):
    with open_grib('data_met/10u_kalteng.grib2') as ds_u, open_grib('data_met/10v_kalteng.grib2') as ds_v:
        return get_vector_data(ds_u, ds_v, time_index)

@app.get("/api/batimetri")
def api_batimetri():
    data = ds_bathy.values
    data_flat = [round(float(v), 1) if not np.isnan(v) else None for v in data.flatten().tolist()]
    lats, lons = ds_bathy.y.values, ds_bathy.x.values
    return {
        "nx": len(lons), "ny": len(lats), 
        "lo1": float(lons[0]), "la1": float(lats[0]), 
        "dx": 0.033, "dy": 0.033, 
        "zs": data_flat
    }
#Thermal Front
@app.get("/api/thermal-front/{hour_index}")
def get_thermal_front(hour_index: int):
    try:
        # 1. Buka dataset Suhu Air Laut
        ds = xr.open_dataset('data_nc/suhu_kalteng.nc')
        
        # --- KUNCI PERBAIKAN ERROR DI SINI ---
        # Konversi indeks jam (0-239) menjadi indeks hari (0-9) dengan pembulatan ke bawah (// 24)
        time_idx = hour_index // 24
        
        # Pengaman: Pastikan time_idx tidak pernah melebihi batas maksimal data di file .nc
        max_time_idx = len(ds['time']) - 1
        if time_idx > max_time_idx:
            time_idx = max_time_idx
        # -------------------------------------

        # 2. Ambil matriks Suhu menggunakan time_idx yang sudah dikonversi
        sst = ds['thetao'].isel(time=time_idx, depth=0).values
        lons = ds.longitude.values
        lats = ds.latitude.values
        
        # 3. Mencegah Tepi Daratan (Pesisir) terdeteksi sebagai Front
        land_mask = np.isnan(sst) 
        coastal_mask = ndimage.binary_dilation(land_mask, iterations=2) 
        
        sst_filled = np.nan_to_num(sst, nan=np.nanmean(sst))
        
        # 4. ALGORITMA MATEMATIKA: Hitung Gradien Suhu
        dy, dx = np.gradient(sst_filled)
        G = np.hypot(dx, dy) 
        G[coastal_mask] = 0
        
        # 5. THRESHOLDING: Ambang batas 0.25 derajat
        threshold = 0.5
        contours = measure.find_contours(G, threshold)
        
        # 6. Konversi ke GeoJSON (Lat/Lon)
        lines = []
        for contour in contours:
            line_coords = []
            for point in contour:
                y_idx, x_idx = point 
                x_safe = int(np.clip(round(x_idx), 0, len(lons)-1))
                y_safe = int(np.clip(round(y_idx), 0, len(lats)-1))
                
                lon_val = float(lons[x_safe])
                lat_val = float(lats[y_safe])
                line_coords.append([lon_val, lat_val])
            
            if len(line_coords) > 3: 
                lines.append(line_coords)
                
        # 7. Format sebagai GeoJSON MultiLineString
        geojson = {
            "type": "FeatureCollection",
            "features": [{
                "type": "Feature",
                "geometry": {
                    "type": "MultiLineString",
                    "coordinates": lines
                },
                "properties": {"name": "Thermal Front"}
            }]
        }
        return geojson

    except Exception as e:
        return {"error": str(e)}


# ==========================================
# API PROFIL KEDALAMAN (DEPTH PROFILE) 100% REAL DATA
# ==========================================
@app.get("/api/profile")
def get_depth_profile(lat: float, lon: float, param: str, time_index: int = 0): # <-- Tambahan time_index di sini
    # 1. Pilih dataset
    if param == 'suhu': ds = ds_suhu
    elif param == 'salinitas': ds = ds_salinitas
    elif param == 'arus': ds = ds_arus
    else: return {"error": "Parameter tidak memiliki profil kedalaman"}

    try:
        var_name = list(ds.data_vars)[0]

        # 2. Cari titik koordinat terdekat
        point_data = ds[var_name].sel(latitude=lat, longitude=lon, method='nearest')
        
        # 3. KUNCI PERBAIKAN: Potong waktu sesuai slider
        if 'time' in point_data.dims:
            start_time = ds.time.values[0]
            target_time = start_time + np.timedelta64(time_index, 'h')
            # Ambil data TEPAT pada jam tersebut
            point_data = point_data.interp(time=target_time, method='nearest')
            
        if 'depth' not in ds.dims and 'depth' not in ds.coords:
             return {"error": "Data tidak memiliki dimensi kedalaman"}

        depths_raw = ds['depth'].values.tolist()
        values_raw = point_data.values.tolist()
        
        depths = []
        values = []
        
        # 4. Filter kedalaman maksimal
        for d, v in zip(depths_raw, values_raw):
            if float(d) <= 92.33:
                depths.append(round(float(d), 2))
                val = None if np.isnan(v) else round(float(v), 2)
                values.append(val)

        return {"depths": depths, "values": values}

    except Exception as e:
        return {"error": str(e)}


@app.get("/api/export-csv")
def export_data_csv(lat: float, lon: float, param: str, mode: str):
    """
    mode: 'timeseries' atau 'depth'
    """
    if param == 'suhu': ds = ds_suhu
    elif param == 'salinitas': ds = ds_salinitas
    elif param == 'arus': ds = ds_arus
    else: return {"error": "Parameter tidak didukung untuk ekspor CSV"}

    var_name = list(ds.data_vars)[0]
    output = io.StringIO()
    
    # 1. LOGIKA EKSPOR TIME SERIES (Deret Waktu di Permukaan)
    if mode == 'timeseries':
        point_data = ds[var_name].sel(latitude=lat, longitude=lon, method='nearest')
        if 'depth' in point_data.dims:
            point_data = point_data.isel(depth=0)
            
        output.write("Waktu,Nilai,Latitude,Longitude\n")
        for t in range(len(point_data.time)):
            val = point_data.isel(time=t).values
            time_str = str(point_data.time.values[t])
            output.write(f"{time_str},{val:.2f},{lat:.4f},{lon:.4f}\n")
            
    # 2. LOGIKA EKSPOR PROFIL KEDALAMAN (Rata-rata Waktu)
    elif mode == 'depth':
        point_data = ds[var_name].sel(latitude=lat, longitude=lon, method='nearest').mean(dim='time')
        output.write("Kedalaman(m),Nilai,Latitude,Longitude\n")
        depths = ds['depth'].values
        for i in range(len(depths)):
            val = point_data.isel(depth=i).values
            if not np.isnan(val):
                output.write(f"{depths[i]:.2f},{val:.2f},{lat:.4f},{lon:.4f}\n")

    output.seek(0)
    filename = f"export_{param}_{mode}_{lat:.2f}_{lon:.2f}.csv"
    return StreamingResponse(output, media_type="text/csv", headers={"Content-Disposition": f"attachment; filename={filename}"})



# ==========================================
# API PASANG SURUT (SCRAPING SRGI BIG)
# ==========================================
@app.get("/api/tide")
def get_tide_srgi(station_code: str):
    """
    Contoh station_code: 'TSGT' (Teluk Segintung), 'KLJL' (Kuala Jelai)
    Karena SRGI pakai kode stasiun, WebGIS harus mengirim kode ini, bukan Lat/Lon.
    """
    print(f"🌊 [PASUT BIG] Mencoba menembus server SRGI untuk stasiun: {station_code}...")
    
    # 1. Buat 'Browser Bohongan' (Session) agar bisa menyimpan Cookie
    session = requests.Session()
    headers_awal = {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
    }

    try:
        # 2. Ketuk pintu depan SRGI untuk minta tiket masuk (Cookies & Token)
        print("  -> Meminta tiket sesi (Token XSRF)...")
        response_awal = session.get("https://srgi.big.go.id/tides", headers=headers_awal, timeout=10)
        
        # Ekstrak token rahasia dari Cookie
        raw_token = session.cookies.get('XSRF-TOKEN')
        if not raw_token:
            return {"error": "Gagal menembus keamanan SRGI (Token tidak ditemukan)."}
            
        xsrf_token = urllib.parse.unquote(raw_token) # Bersihkan teks token

        # 3. Siapkan tanggal hari ini (Format: YYYY/M/D)
        now = datetime.datetime.now()
        date_str = f"{now.year}/{now.month}/{now.day}"
        timestamp = int(now.timestamp())
        
        # 4. Bangun URL API Rahasia BIG
        api_url = f"https://srgi.big.go.id/tides_data/pasut_{station_code}?new=true&date={date_str}&timestamp={timestamp}"
        
        # 5. Serang API-nya dengan membawa Token resmi
        headers_api = {
            "User-Agent": headers_awal["User-Agent"],
            "X-XSRF-TOKEN": xsrf_token,
            "Accept": "application/json",
            "Referer": "https://srgi.big.go.id/tides"
        }
        
        print(f"  -> Mengambil data pasut {station_code}...")
        res_data = session.get(api_url, headers=headers_api, timeout=15)
        
        # Cek jika server BIG sedang mati (seperti kasus Kuala Jelai - Error 500)
        if res_data.status_code == 500:
            return {"error": "Server SRGI BIG sedang down atau sensor stasiun ini mati (Error 500)."}
        elif res_data.status_code != 200:
            return {"error": f"Ditolak oleh server SRGI (Kode: {res_data.status_code})"}

# 6. Terjemahkan Datanya! (Membongkar brankas SRGI)
        raw_json = res_data.json()
        
        times = []
        elevations = []
        
        data_array = raw_json.get('predictions', [])
        if not data_array:
            data_array = raw_json.get('results', [])
                
        for item in data_array:
            if isinstance(item, dict):
                # 1. Ambil Waktu dari laci 'ts'
                waktu = item.get('ts', 'Unknown')
                
                # 2. Ambil Tinggi Air
                # BIG biasanya pakai sensor Radar (RAD1/RAD2) atau Pressure (PRS).
                # Kita prioritaskan RAD1. Kalau mati/kosong, pakai RAD2, dst.
                raw_val = item.get('RAD1') or item.get('RAD2') or item.get('PRS') or 0
                
                try:
                    val = float(raw_val)
                except (ValueError, TypeError):
                    val = 0.0
                    
                times.append(waktu)
                elevations.append(round(val, 2))
        
        if not elevations:
             return {"error": f"Sensor di stasiun {station_code} sedang mati atau tidak ada data hari ini."}

        print(f"✅ [PASUT BIG] Sukses memproses {len(elevations)} baris data resmi untuk {station_code}!")
        return {
            "station": station_code,
            "times": times,
            "elevations": elevations,
            "hat": round(max(elevations), 2),
            "lat": round(min(elevations), 2)
        }

    except requests.exceptions.Timeout:
        return {"error": "Koneksi ke SRGI Timeout (Server pemerintah sedang lambat)."}
    except Exception as e:
        return {"error": f"Error Sistem: {str(e)}"}


import os
import datetime

@app.get("/api/cek-radar")
def cek_file_server():
    try:
        files = os.listdir("data_met")
        hasil = {}
        for f in files:
            path_file = f"data_met/{f}"
            waktu_modifikasi = os.path.getmtime(path_file)
            waktu_nyata = datetime.datetime.fromtimestamp(waktu_modifikasi).strftime('%Y-%m-%d %H:%M:%S')
            hasil[f] = waktu_nyata
        return {"status": "Radar Aktif", "isi_folder_render": hasil}
    except Exception as e:
        return {"error": str(e)}

# ==========================================
# API TIME SERIES (DATA ASLI 10 HARI KE DEPAN)
# ==========================================
@app.get("/api/timeseries")
def get_timeseries(lat: float, lon: float, param: str, depth_index: int = 0):
    is_grib = False
    if param == 'suhu': ds = ds_suhu
    elif param == 'salinitas': ds = ds_salinitas
    elif param == 'ssh': ds = ds_ssh
    elif param == 'gelombang': ds = ds_gelombang
    elif param == 'msl': 
        ds = open_grib('data_met/msl_kalteng.grib2')
        is_grib = True
    elif param == 'hujan': 
        ds = open_grib('data_met/tp_kalteng.grib2')
        is_grib = True
    elif param == 'arus': 
        ds_u, ds_v = ds_arus, ds_arus
        var_u, var_v = list(ds_u.data_vars)[0], list(ds_v.data_vars)[1] if len(ds_v.data_vars)>1 else list(ds_v.data_vars)[0]
    elif param == 'angin':
        ds_u = open_grib('data_met/10u_kalteng.grib2')
        ds_v = open_grib('data_met/10v_kalteng.grib2')
        var_u, var_v = list(ds_u.data_vars)[0], list(ds_v.data_vars)[0]
        is_grib = True
    else: return {"error": "Parameter tidak didukung"}

    try:
        # LOGIKA KHUSUS VEKTOR (ARUS & ANGIN)
        if param in ['arus', 'angin']:
            pt_u = ds_u[var_u].sel(latitude=lat, longitude=lon, method='nearest')
            pt_v = ds_v[var_v].sel(latitude=lat, longitude=lon, method='nearest')
            
            if 'depth' in pt_u.dims:
                safe_depth = min(depth_index, len(ds_u['depth']) - 1)
                pt_u = pt_u.isel(depth=safe_depth)
                pt_v = pt_v.isel(depth=safe_depth)
                
            u_vals = pt_u.values
            v_vals = pt_v.values
            
            mag_vals = np.sqrt(u_vals**2 + v_vals**2)
            values = [None if np.isnan(v) else round(float(v), 2) for v in mag_vals]
            return {"values": values}

        # LOGIKA UNTUK SKALAR
        var_name = list(ds.data_vars)[0]
        point_data = ds[var_name].sel(latitude=lat, longitude=lon, method='nearest')
        
        if 'depth' in point_data.dims:
            safe_depth = min(depth_index, len(ds['depth']) - 1)
            point_data = point_data.isel(depth=safe_depth)
            
        values_raw = point_data.values.tolist()
        
        if param == 'msl': values = [None if np.isnan(v) else round(float(v) / 100, 1) for v in values_raw]
        elif param == 'hujan': values = [None if np.isnan(v) else round(float(v) * 1000, 2) for v in values_raw]
        else: values = [None if np.isnan(v) else round(float(v), 2) for v in values_raw]

        return {"values": values}

    except Exception as e:
        return {"error": str(e)}
    finally:
        # KUNCI PERBAIKAN: Tutup data GRIB setelah selesai dipakai!
        if is_grib:
            if param == 'angin':
                ds_u.close()
                ds_v.close()
            else:
                ds.close()