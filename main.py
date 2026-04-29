from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import xarray as xr
import numpy as np
import rioxarray 
from scipy import ndimage
from skimage import measure
import requests
import datetime
import urllib.parse
import math

app = FastAPI(title="MetOcean API Kalteng - Master Hybrid")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

print("🚀 Server Booting: Membuka Data ECMWF & Batimetri...")
# File Udara (Tetap menggunakan file ECMWF asli)
ds_10u = xr.open_dataset('data_nc/10u_kalteng.nc')
ds_10v = xr.open_dataset('data_nc/10v_kalteng.nc')
ds_msl = xr.open_dataset('data_nc/msl_kalteng.nc')
ds_tp = xr.open_dataset('data_nc/tp_kalteng.nc')

def load_batimetri(file_path):
    try:
        da = rioxarray.open_rasterio(file_path)
        da = da.squeeze('band') 
        da.rio.write_crs("EPSG:4326", inplace=True)
        da = da.rio.clip_box(minx=109.0, miny=-5.5, maxx=116.0, maxy=-0.5)
        da = da.where(da <= 0)
        return da.interp(x=np.arange(109.0, 116.0, 0.033), y=np.arange(-5.5, -0.5, 0.033), method='linear').sortby('y', ascending=False)
    except:
        return None

ds_bathy = load_batimetri('data_nc/batimetri_kalteng.tif')
print("✅ Server Booting Sukses!")

# ==========================================
# FUNGSI SATPAM HYBRID & PARSER
# ==========================================
def get_dataset(param, depth_index=0):
    if param == 'gelombang': return xr.open_dataset("data_nc/gelombang_hybrid.nc")
    if param == 'ssh': return xr.open_dataset("data_nc/surface_hourly.nc")
    if depth_index == 0: return xr.open_dataset("data_nc/surface_hourly.nc")
    return xr.open_dataset("data_nc/3d_daily.nc")

def convert_to_webgis_json(data_slice):
    # KUNCI PERBAIKAN: Putar Latitude dari Utara ke Selatan agar tidak tergambar di Antartika!
    if data_slice.latitude.values[0] < data_slice.latitude.values[-1]:
        data_slice = data_slice.sortby('latitude', ascending=False)
        
    lats, lons = data_slice.latitude.values, data_slice.longitude.values
    dx = float(abs(lons[1] - lons[0])) if len(lons) > 1 else 0.083
    dy = float(abs(lats[1] - lats[0])) if len(lats) > 1 else 0.083
    return {
        "nx": len(lons), "ny": len(lats),
        "lo1": float(lons[0]), "la1": float(lats[0]),
        "dx": dx, "dy": dy,
        "zs": [None if np.isnan(v) else float(v) for v in data_slice.values.flatten()]
    }

def convert_to_velocity_json(data_slice, param_name, is_u):
    # KUNCI PERBAIKAN: Putar Latitude dari Utara ke Selatan untuk data Arus Laut
    if data_slice.latitude.values[0] < data_slice.latitude.values[-1]:
        data_slice = data_slice.sortby('latitude', ascending=False)
        
    lats, lons = data_slice.latitude.values, data_slice.longitude.values
    dx = float(abs(lons[1] - lons[0])) if len(lons) > 1 else 0.083
    dy = float(abs(lats[1] - lats[0])) if len(lats) > 1 else 0.083
    return {
        "header": {
            "parameterCategory": 2, "parameterNumber": 2 if is_u else 3,
            "nx": len(lons), "ny": len(lats),
            "lo1": float(lons[0]), "la1": float(lats[0]),
            "dx": dx, "dy": dy,
            "parameterName": param_name
        },
        "data": [0 if np.isnan(v) else float(v) for v in data_slice.values.flatten()]
    }

# ==========================================
# API ECMWF (UDARA)
# ==========================================
def spatial_interp_2d(slice_2d):
    min_lon, max_lon, min_lat, max_lat = 109.0, 116.0, -5.5, -0.5
    lats_raw = slice_2d.latitude.values
    if lats_raw[0] > lats_raw[-1]: slice_2d = slice_2d.sel(latitude=slice(max_lat, min_lat), longitude=slice(min_lon, max_lon))
    else: slice_2d = slice_2d.sel(latitude=slice(min_lat, max_lat), longitude=slice(min_lon, max_lon))
    slice_2d = slice_2d.sortby('longitude').sortby('latitude')
    return slice_2d.interp(latitude=np.arange(min_lat, max_lat, 0.033), longitude=np.arange(min_lon, max_lon, 0.033), method='linear').sortby('latitude', ascending=False)

def get_grid_ecmwf(ds, time_index):
    var_name = list(ds.data_vars)[0]
    target_time = ds.time.values[0] + np.timedelta64(time_index, 'h')
    slice_2d = ds[var_name].interp(time=target_time, method='nearest')
    refined = spatial_interp_2d(slice_2d)
    return {"nx": len(refined.longitude.values), "ny": len(refined.latitude.values), "lo1": float(refined.longitude.values[0]), "la1": float(refined.latitude.values[0]), "dx": 0.033, "dy": 0.033, "zs": [round(float(v), 2) if not np.isnan(v) else None for v in refined.values.flatten()]}

@app.get("/api/msl/{time_index}")
def api_msl(time_index: int):
    data = get_grid_ecmwf(ds_msl, time_index)
    data['zs'] = [round(v / 100, 1) if v is not None else None for v in data['zs']]
    return data

@app.get("/api/hujan/{time_index}")
def api_hujan(time_index: int):
    curr = get_grid_ecmwf(ds_tp, time_index)
    if time_index == 0:
        curr['zs'] = [round(v * 1000, 2) if v is not None else None for v in curr['zs']]
    else:
        prev = get_grid_ecmwf(ds_tp, time_index - 1)
        curr['zs'] = [round(max(0, (c - p) * 1000), 2) if c is not None and p is not None else None for c, p in zip(curr['zs'], prev['zs'])]
    return curr

@app.get("/api/angin/{time_index}")
def api_angin(time_index: int):
    target_time = ds_10u.time.values[0] + np.timedelta64(time_index, 'h')
    u_ref = spatial_interp_2d(ds_10u[list(ds_10u.data_vars)[0]].interp(time=target_time, method='nearest'))
    v_ref = spatial_interp_2d(ds_10v[list(ds_10v.data_vars)[0]].interp(time=target_time, method='nearest'))
    lats, lons = u_ref.latitude.values, u_ref.longitude.values
    return [
        {"header": {"parameterCategory": 2, "parameterNumber": 2, "lo1": float(lons[0]), "la1": float(lats[0]), "dx": 0.033, "dy": 0.033, "nx": len(lons), "ny": len(lats)}, "data": [0 if np.isnan(v) else float(v) for v in u_ref.values.flatten()]},
        {"header": {"parameterCategory": 2, "parameterNumber": 3, "lo1": float(lons[0]), "la1": float(lats[0]), "dx": 0.033, "dy": 0.033, "nx": len(lons), "ny": len(lats)}, "data": [0 if np.isnan(v) else float(v) for v in v_ref.values.flatten()]}
    ]

# ==========================================
# API OCEAN (HYBRID) - ANTI CRASH
# ==========================================
def safe_get_ocean(ds, var_name, t_idx, d_idx):
    """Fungsi pelindung agar Python tidak crash jika Copernicus mengubah format file"""
    # 1. Aman dari Time Index Out of Bounds (Kelebihan Jam)
    safe_t = min(t_idx, len(ds['time']) - 1) if 'time' in ds.dims else 0
    
    # 2. Aman dari Depth Index Missing (Kedalaman Hilang)
    if 'depth' in ds.dims or 'depth' in ds.coords:
        safe_d = min(d_idx, len(ds['depth']) - 1)
        return ds[var_name].isel(time=safe_t, depth=safe_d)
    else:
        # Jika file dari Copernicus tidak punya dimensi 'depth', ambil langsung waktunya
        return ds[var_name].isel(time=safe_t)

@app.get("/api/suhu/{time_index}/{depth_index}")
def api_suhu(time_index: int, depth_index: int):
    ds = get_dataset('suhu', depth_index)
    t_idx = time_index // 24 if depth_index > 0 else time_index
    res = convert_to_webgis_json(safe_get_ocean(ds, 'thetao', t_idx, depth_index))
    ds.close()
    return res

@app.get("/api/salinitas/{time_index}/{depth_index}")
def api_salinitas(time_index: int, depth_index: int):
    ds = get_dataset('salinitas', depth_index)
    t_idx = time_index // 24 if depth_index > 0 else time_index
    res = convert_to_webgis_json(safe_get_ocean(ds, 'so', t_idx, depth_index))
    ds.close()
    return res

@app.get("/api/ssh/{time_index}")
def api_ssh(time_index: int):
    ds = get_dataset('ssh')
    res = convert_to_webgis_json(safe_get_ocean(ds, 'zos', time_index, 0))
    ds.close()
    return res

@app.get("/api/gelombang/{time_index}")
def api_gelombang(time_index: int):
    ds = get_dataset('gelombang')
    w_idx = time_index // 3 # Gelombang pakai interval 3 jam
    res = convert_to_webgis_json(safe_get_ocean(ds, 'VHM0', w_idx, 0))
    ds.close()
    return res

@app.get("/api/arus/{time_index}/{depth_index}")
def api_arus(time_index: int, depth_index: int):
    ds = get_dataset('arus', depth_index)
    t_idx = time_index // 24 if depth_index > 0 else time_index
    u = safe_get_ocean(ds, 'uo', t_idx, depth_index)
    v = safe_get_ocean(ds, 'vo', t_idx, depth_index)
    res = [
        convert_to_velocity_json(u, "Eastward Velocity", True), 
        convert_to_velocity_json(v, "Northward Velocity", False)
    ]
    ds.close()
    return res
# ==========================================
# FITUR LAINNYA (BATIMETRI, PROFIL, TIME SERIES)
# ==========================================
@app.get("/api/depths")
def get_depths():
    try:
        ds = xr.open_dataset('data_nc/3d_daily.nc')
        d = [round(float(v), 1) for v in ds['depth'].values.tolist()]
        ds.close()
        return {"depths": d}
    except: return {"depths": [0.0]}

@app.get("/api/batimetri")
def api_batimetri():
    if ds_bathy is None: return {"zs": []}
    data_flat = [round(float(v), 1) if not np.isnan(v) else None for v in ds_bathy.values.flatten().tolist()]
    return {"nx": len(ds_bathy.x.values), "ny": len(ds_bathy.y.values), "lo1": float(ds_bathy.x.values[0]), "la1": float(ds_bathy.y.values[0]), "dx": 0.033, "dy": 0.033, "zs": data_flat}

@app.get("/api/profile/{param}/{lat}/{lon}/{time_index}")
def api_profile(param: str, lat: float, lon: float, time_index: int):
    if param not in ['suhu', 'salinitas', 'arus']: return {"error": "Invalid param"}
    try:
        ds = xr.open_dataset("data_nc/3d_daily.nc")
        var_name = 'thetao' if param == 'suhu' else 'so' if param == 'salinitas' else 'uo'
        pt = ds[var_name].isel(time=time_index // 24).sel(latitude=lat, longitude=lon, method="nearest")
        res = [{"depth": round(d, 1), "value": round(float(v), 3)} for d, v in zip(pt.depth.values.tolist(), pt.values.tolist()) if not math.isnan(v)]
        ds.close()
        return {"profile": res}
    except: return {"profile": []}

@app.get("/api/timeseries")
def get_timeseries(lat: float, lon: float, param: str, depth_index: int = 0):
    try:
        if param in ['msl', 'hujan']:
            ds = ds_msl if param == 'msl' else ds_tp
            pt = ds[list(ds.data_vars)[0]].sel(latitude=lat, longitude=lon, method='nearest').values.tolist()
            if param == 'msl': vals = [round(v/100, 1) if not np.isnan(v) else None for v in pt]
            else: 
                vals, prev = [], 0
                for i, v in enumerate(pt):
                    if np.isnan(v): vals.append(None)
                    else:
                        curr = v * 1000
                        vals.append(round(max(0, curr - prev) if i > 0 else curr, 2))
                        prev = curr
            return {"values": vals}
        
        ds = get_dataset(param, depth_index)
        var_name = 'VHM0' if param == 'gelombang' else 'zos' if param == 'ssh' else 'thetao' if param == 'suhu' else 'so' if param == 'salinitas' else 'uo'
        
        if param == 'arus':
            u = ds['uo'].sel(latitude=lat, longitude=lon, method='nearest')
            v = ds['vo'].sel(latitude=lat, longitude=lon, method='nearest')
            if 'depth' in u.dims: u, v = u.isel(depth=depth_index), v.isel(depth=depth_index)
            mag = np.sqrt(u.values**2 + v.values**2)
            vals = [round(float(m), 2) if not np.isnan(m) else None for m in mag]
        else:
            pt = ds[var_name].sel(latitude=lat, longitude=lon, method='nearest')
            if 'depth' in pt.dims: pt = pt.isel(depth=depth_index)
            vals = [round(float(v), 2) if not np.isnan(v) else None for v in pt.values]
        ds.close()
        return {"values": vals}
    except Exception as e: return {"error": str(e)}

@app.get("/api/thermal-front/{time_index}")
def get_thermal_front(time_index: int):
    try:
        ds = xr.open_dataset('data_nc/surface_hourly.nc')
        sst = ds['thetao'].isel(time=time_index, depth=0).values
        lons, lats = ds.longitude.values, ds.latitude.values
        ds.close()
        land_mask = np.isnan(sst) 
        coastal_mask = ndimage.binary_dilation(land_mask, iterations=2) 
        sst_filled = np.nan_to_num(sst, nan=np.nanmean(sst))
        dy, dx = np.gradient(sst_filled)
        G = np.hypot(dx, dy) 
        G[coastal_mask] = 0
        contours = measure.find_contours(G, 0.5)
        lines = []
        for contour in contours:
            line_coords = []
            for point in contour:
                y_idx, x_idx = point 
                x_safe, y_safe = int(np.clip(round(x_idx), 0, len(lons)-1)), int(np.clip(round(y_idx), 0, len(lats)-1))
                line_coords.append([float(lons[x_safe]), float(lats[y_safe])])
            if len(line_coords) > 3: lines.append(line_coords)
        return {"type": "FeatureCollection", "features": [{"type": "Feature", "geometry": {"type": "MultiLineString", "coordinates": lines}, "properties": {"name": "Thermal Front"}}]}
    except Exception as e: return {"error": str(e)}

@app.get("/api/tide")
def get_tide_srgi(station_code: str):
    session = requests.Session()
    try:
        session.get("https://srgi.big.go.id/tides", headers={"User-Agent": "Mozilla"}, timeout=10)
        xsrf = urllib.parse.unquote(session.cookies.get('XSRF-TOKEN', ''))
        now = datetime.datetime.now()
        api_url = f"https://srgi.big.go.id/tides_data/pasut_{station_code}?new=true&date={now.year}/{now.month}/{now.day}&timestamp={int(now.timestamp())}"
        res = session.get(api_url, headers={"User-Agent": "Mozilla", "X-XSRF-TOKEN": xsrf}, timeout=15).json()
        if isinstance(res, str): return {"error": "Server BIG SRGI sedang maintenance/gangguan."}
        data_arr = res.get('predictions', []) or res.get('results', [])
        elevs = [float(i.get('RAD1') or i.get('RAD2') or i.get('PRS') or 0) for i in data_arr]
        if not elevs: return {"error": "Sensor mati / Data kosong"}
        return {"station": station_code, "times": [i.get('ts') for i in data_arr], "elevations": elevs, "hat": round(max(elevs), 2), "lat": round(min(elevs), 2)}
    except: return {"error": "Koneksi ke SRGI Terputus"}