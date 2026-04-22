import xarray as xr
import json
import numpy as np
import os

print("Mulai membaca arus_kalteng.nc...")

# 1. Buka file NetCDF
ds = xr.open_dataset('arus_kalteng.nc')

# 2. Balik urutan Latitude dari Utara ke Selatan 
# (Syarat mutlak agar panah animasi tidak terbalik arahnya di Leaflet)
ds_flipped = ds.sortby('latitude', ascending=False)

# 3. Ambil nilai U (Timur-Barat) dan V (Utara-Selatan) di kedalaman pertama dan waktu pertama
u = ds_flipped['uo'].isel(time=0, depth=0).values
v = ds_flipped['vo'].isel(time=0, depth=0).values

# 4. Ambil titik kordinat
lats = ds_flipped.latitude.values
lons = ds_flipped.longitude.values

nx = len(lons)
ny = len(lats)
dx = lons[1] - lons[0] if nx > 1 else 0.083
dy = lats[1] - lats[0] if ny > 1 else -0.083 # dy harus sesuai jarak derajat

# 5. Ubah data menjadi 1 baris (flatten) dan ganti daratan (NaN) menjadi Null
u_flat = np.where(np.isnan(u), None, u).flatten().tolist()
v_flat = np.where(np.isnan(v), None, v).flatten().tolist()

# 6. Susun ke dalam format baku Leaflet-Velocity JSON
velocity_data = [
    {
        "header": {
            "parameterCategory": 2,
            "parameterNumber": 2, # U-component (Barat-Timur)
            "lo1": float(lons[0]), # Batas Barat
            "la1": float(lats[0]), # Batas Utara
            "dx": float(dx),
            "dy": float(abs(dy)),
            "nx": nx,
            "ny": ny,
            "refTime": str(ds.time.values[0])
        },
        "data": u_flat
    },
    {
        "header": {
            "parameterCategory": 2,
            "parameterNumber": 3, # V-component (Selatan-Utara)
            "lo1": float(lons[0]),
            "la1": float(lats[0]),
            "dx": float(dx),
            "dy": float(abs(dy)),
            "nx": nx,
            "ny": ny,
            "refTime": str(ds.time.values[0])
        },
        "data": v_flat
    }
]

# 7. Simpan file-nya ke dalam folder demo dengan menimpa data statis yang lama
output_path = 'demo/data_arus_final.json'
with open(output_path, 'w') as f:
    json.dump(velocity_data, f)

print(f"SUKSES! Data arus Kalteng berhasil dikonversi dan disimpan ke: {output_path}")