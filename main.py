from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import xarray as xr
import numpy as np
import rioxarray 
from scipy import ndimage
from skimage import measure
import io
import os
import requests
import datetime
import urllib.parse
from fastapi.responses import StreamingResponse

app = FastAPI(title="MetOcean API Kalteng - Master Version")
app.add_middleware(CORSMiddleware, allow_origins=["*"], allow_credentials=True, allow_methods=["*"], allow_headers=["*"])

print("🚀 Membuka Data Super Ringan (Format .nc)...")

# --- 1. SEMUA DATA SEKARANG BERFORMAT .NC (SANGAT RINGAN) ---
ds_suhu = xr.open_dataset('data_nc/suhu_kalteng.nc')
ds_arus = xr.open_dataset('data_nc/arus_kalteng.nc')
ds_salinitas = xr.open_dataset('data_nc/salinitas_kalteng.nc')
ds_ssh = xr.open_dataset('data_nc/ssh_kalteng.nc')
ds_gelombang = xr.open_dataset('data_nc/gelombang_kalteng.nc')

# File Udara yang sudah dipotong dari laptop
ds_10u = xr.open_dataset('data_nc/10u_kalteng.nc')
ds_10v = xr.open_dataset('data_nc/10v_kalteng.nc')
ds_msl = xr.open_dataset('data_nc/msl_kalteng.nc')
ds_tp = xr.open_dataset('data_nc/tp_kalteng.nc')

def load_batimetri(file_path):
    da = rioxarray.open_rasterio(file_path)
    da = da.squeeze('band') 
    da.rio.write_crs("EPSG:4326", inplace=True)
    min_lon, max_lon = 109.0, 116.0
    min_lat, max_lat = -5.5, -0.5
    da = da.rio.clip_box(minx=min_lon, miny=min_lat, maxx=max_lon, maxy=max_lat)
    da = da.where(da <= 0)
    new_lon = np.arange(min_lon, max_lon, 0.033)
    new_lat = np.arange(min_lat, max_lat, 0.033)
    return da.interp(x=new_lon, y=new_lat, method='linear').sortby('y', ascending=False)

ds_bathy = load_batimetri('data_nc/batimetri_kalteng.tif')
print("✅ Server Booting Sukses 100%! Tidak akan OOM lagi!")

# ==========================================
# FUNGSI PEMOTONG & PENGHALUS WAKTU
# ==========================================
def extract_time_slice(ds, var_name, time_index, depth_index=None):
    start_time = ds.time.values[0]
    target_time = start_time + np.timedelta64(time_index, 'h')
    if depth_index is not None and 'depth' in ds[var_name].dims:
        safe_depth = min(depth_index, len(ds['depth']) - 1)
        ds_sliced = ds[var_name].isel(depth=safe_depth)
    else:
        ds_sliced = ds[var_name]
    return ds_sliced.interp(time=target_time, method='nearest')

def spatial_interp_2d(slice_2d):
    min_lon, max_lon = 109.0, 116.0
    min_lat, max_lat = -5.5, -0.5
    lats_raw = slice_2d.latitude.values
    if lats_raw[0] > lats_raw[-1]: 
        slice_2d = slice_2d.sel(latitude=slice(max_lat, min_lat), longitude=slice(min_lon, max_lon))
    else:
        slice_2d = slice_2d.sel(latitude=slice(min_lat, max_lat), longitude=slice(min_lon, max_lon))
    slice_2d = slice_2d.sortby('longitude').sortby('latitude')
    new_lon = np.arange(min_lon, max_lon, 0.033)
    new_lat = np.arange(min_lat, max_lat, 0.033)
    return slice_2d.interp(latitude=new_lat, longitude=new_lon, method='linear').sortby('latitude', ascending=False)

def get_grid_data(ds, time_index, depth_index=None):
    var_name = list(ds.data_vars)[0]
    slice_2d = extract_time_slice(ds, var_name, time_index, depth_index)
    refined_slice = spatial_interp_2d(slice_2d)
    data = refined_slice.values
    data_flat = [round(float(v), 2) if not np.isnan(v) else None for v in data.flatten().tolist()]
    lats, lons = refined_slice.latitude.values, refined_slice.longitude.values
    return {"nx": len(lons), "ny": len(lats), "lo1": float(lons[0]), "la1": float(lats[0]), "dx": 0.033, "dy": 0.033, "zs": data_flat}

def get_vector_data(ds_u, ds_v, time_index, depth_index=None):
    var_u, var_v = list(ds_u.data_vars)[0], list(ds_v.data_vars)[0]
    u_slice = extract_time_slice(ds_u, var_u, time_index, depth_index)
    v_slice = extract_time_slice(ds_v, var_v, time_index, depth_index)
    u_ref, v_ref = spatial_interp_2d(u_slice), spatial_interp_2d(v_slice)
    u_data, v_data = u_ref.values, v_ref.values
    lats, lons = u_ref.latitude.values, u_ref.longitude.values
    dx, dy = 0.033, 0.033
    return [
        {"header": {"parameterCategory": 2, "parameterNumber": 2, "lo1": float(lons[0]), "la1": float(lats[0]), "dx": dx, "dy": dy, "nx": len(lons), "ny": len(lats), "refTime": "0"}, "data": np.where(np.isnan(u_data), None, u_data).flatten().tolist()},
        {"header": {"parameterCategory": 2, "parameterNumber": 3, "lo1": float(lons[0]), "la1": float(lats[0]), "dx": dx, "dy": dy, "nx": len(lons), "ny": len(lats), "refTime": "0"}, "data": np.where(np.isnan(v_data), None, v_data).flatten().tolist()}
    ]

# ==========================================
# ENDPOINT API PETA (LAYER)
# ==========================================
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
    data = get_grid_data(ds_msl, time_index)
    data['zs'] = [round(v / 100, 1) if v is not None else None for v in data['zs']]
    return data

@app.get("/api/hujan/{time_index}")
def api_hujan(time_index: int):
    data = get_grid_data(ds_tp, time_index)
    data['zs'] = [round(v * 1000, 2) if v is not None else None for v in data['zs']]
    return data

@app.get("/api/angin/{time_index}")
def api_angin(time_index: int): return get_vector_data(ds_10u, ds_10v, time_index)

@app.get("/api/batimetri")
def api_batimetri():
    data = ds_bathy.values
    data_flat = [round(float(v), 1) if not np.isnan(v) else None for v in data.flatten().tolist()]
    lats, lons = ds_bathy.y.values, ds_bathy.x.values
    return {"nx": len(lons), "ny": len(lats), "lo1": float(lons[0]), "la1": float(lats[0]), "dx": 0.033, "dy": 0.033, "zs": data_flat}

# ==========================================
# ENDPOINT TIME SERIES & ALAT ANALISIS
# ==========================================
@app.get("/api/timeseries")
def get_timeseries(lat: float, lon: float, param: str, depth_index: int = 0):
    if param == 'suhu': ds = ds_suhu
    elif param == 'salinitas': ds = ds_salinitas
    elif param == 'ssh': ds = ds_ssh
    elif param == 'gelombang': ds = ds_gelombang
    elif param == 'msl': ds = ds_msl
    elif param == 'hujan': ds = ds_tp
    elif param == 'arus': ds_u, ds_v = ds_arus, ds_arus
    elif param == 'angin': ds_u, ds_v = ds_10u, ds_10v
    else: return {"error": "Parameter tidak didukung"}

    try:
        if param in ['arus', 'angin']:
            var_u = list(ds_u.data_vars)[0]
            var_v = list(ds_v.data_vars)[1] if param == 'arus' and len(ds_v.data_vars)>1 else list(ds_v.data_vars)[0]
            pt_u = ds_u[var_u].sel(latitude=lat, longitude=lon, method='nearest')
            pt_v = ds_v[var_v].sel(latitude=lat, longitude=lon, method='nearest')
            if 'depth' in pt_u.dims:
                safe_depth = min(depth_index, len(ds_u['depth']) - 1)
                pt_u, pt_v = pt_u.isel(depth=safe_depth), pt_v.isel(depth=safe_depth)
            mag_vals = np.sqrt(pt_u.values**2 + pt_v.values**2)
            values = [None if np.isnan(v) else round(float(v), 2) for v in mag_vals]
            return {"values": values}

        var_name = list(ds.data_vars)[0]
        point_data = ds[var_name].sel(latitude=lat, longitude=lon, method='nearest')
        if 'depth' in point_data.dims:
            safe_depth = min(depth_index, len(ds['depth']) - 1)
            point_data = point_data.isel(depth=safe_depth)
            
        vals = point_data.values.tolist()
        if param == 'msl': values = [None if np.isnan(v) else round(float(v) / 100, 1) for v in vals]
        elif param == 'hujan': values = [None if np.isnan(v) else round(float(v) * 1000, 2) for v in vals]
        else: values = [None if np.isnan(v) else round(float(v), 2) for v in vals]
        return {"values": values}

    except Exception as e: return {"error": str(e)}

@app.get("/api/thermal-front/{hour_index}")
def get_thermal_front(hour_index: int):
    try:
        time_idx = hour_index // 24
        max_time_idx = len(ds_suhu['time']) - 1
        if time_idx > max_time_idx: time_idx = max_time_idx

        sst = ds_suhu['thetao'].isel(time=time_idx, depth=0).values
        lons, lats = ds_suhu.longitude.values, ds_suhu.latitude.values
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

@app.get("/api/profile")
def get_depth_profile(lat: float, lon: float, param: str):
    if param == 'suhu': ds = ds_suhu
    elif param == 'salinitas': ds = ds_salinitas
    elif param == 'arus': ds = ds_arus
    else: return {"error": "Parameter tidak memiliki profil kedalaman"}

    try:
        var_name = list(ds.data_vars)[0]
        point_data = ds[var_name].sel(latitude=lat, longitude=lon, method='nearest')
        if 'time' in point_data.dims: point_data = point_data.mean(dim='time')
        if 'depth' not in ds.dims and 'depth' not in ds.coords: return {"error": "Data tidak ada"}

        depths_raw, values_raw = ds['depth'].values.tolist(), point_data.values.tolist()
        depths, values = [], []
        
        for d, v in zip(depths_raw, values_raw):
            if float(d) <= 92.33:
                depths.append(round(float(d), 2))
                values.append(None if np.isnan(v) else round(float(v), 2))

        return {"depths": depths, "values": values}
    except Exception as e: return {"error": str(e)}

# ==========================================
# EKSPOR & PASUT
# ==========================================
@app.get("/api/export-csv")
def export_data_csv(lat: float, lon: float, param: str, mode: str):
    if param == 'suhu': ds = ds_suhu
    elif param == 'salinitas': ds = ds_salinitas
    elif param == 'arus': ds = ds_arus
    else: return {"error": "Parameter tidak didukung"}

    var_name = list(ds.data_vars)[0]
    output = io.StringIO()
    if mode == 'timeseries':
        point_data = ds[var_name].sel(latitude=lat, longitude=lon, method='nearest')
        if 'depth' in point_data.dims: point_data = point_data.isel(depth=0)
        output.write("Waktu,Nilai,Latitude,Longitude\n")
        for t in range(len(point_data.time)):
            output.write(f"{str(point_data.time.values[t])},{point_data.isel(time=t).values:.2f},{lat:.4f},{lon:.4f}\n")
    elif mode == 'depth':
        point_data = ds[var_name].sel(latitude=lat, longitude=lon, method='nearest').mean(dim='time')
        output.write("Kedalaman(m),Nilai,Latitude,Longitude\n")
        depths = ds['depth'].values
        for i in range(len(depths)):
            val = point_data.isel(depth=i).values
            if not np.isnan(val): output.write(f"{depths[i]:.2f},{val:.2f},{lat:.4f},{lon:.4f}\n")

    output.seek(0)
    return StreamingResponse(output, media_type="text/csv", headers={"Content-Disposition": f"attachment; filename=export_{param}.csv"})

@app.get("/api/tide")
def get_tide_srgi(station_code: str):
    session = requests.Session()
    try:
        session.get("https://srgi.big.go.id/tides", headers={"User-Agent": "Mozilla"}, timeout=10)
        xsrf = urllib.parse.unquote(session.cookies.get('XSRF-TOKEN', ''))
        now = datetime.datetime.now()
        api_url = f"https://srgi.big.go.id/tides_data/pasut_{station_code}?new=true&date={now.year}/{now.month}/{now.day}&timestamp={int(now.timestamp())}"
        res = session.get(api_url, headers={"User-Agent": "Mozilla", "X-XSRF-TOKEN": xsrf}, timeout=15).json()
        data_arr = res.get('predictions', []) or res.get('results', [])
        elevs = [float(i.get('RAD1') or i.get('RAD2') or i.get('PRS') or 0) for i in data_arr]
        if not elevs: return {"error": "Sensor mati"}
        return {"station": station_code, "times": [i.get('ts') for i in data_arr], "elevations": elevs, "hat": round(max(elevs), 2), "lat": round(min(elevs), 2)}
    except Exception as e: return {"error": str(e)}

@app.get("/")
def home():
    return {"status": "Server Aktif 100% - Mode Anti OOM"}