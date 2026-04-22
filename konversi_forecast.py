import xarray as xr
import json
import numpy as np

# Fungsi pemroses ajaib untuk semua parameter MetOcean
def konversi_grid_ke_json(nama_file_nc, nama_variabel, output_file, is_depth=False, is_3hourly=False):
    print(f"Membuka {nama_file_nc} untuk {nama_variabel}...")
    try:
        ds = xr.open_dataset(nama_file_nc)
        ds_flipped = ds.sortby('latitude', ascending=False)
        
        # JIKA data per 3 Jam (Gelombang), Python akan merata-ratakannya menjadi harian!
        if is_3hourly:
            print("  -> Mengonversi data 3-jaman menjadi rata-rata harian (1D)...")
            ds_flipped = ds_flipped.resample(time='1D').mean()
            
        lats = ds_flipped.latitude.values
        lons = ds_flipped.longitude.values
        nx, ny = len(lons), len(lats)
        dx = lons[1] - lons[0] if nx > 1 else 0.083
        dy = abs(lats[1] - lats[0]) if ny > 1 else 0.083

        all_days = []
        for t in range(len(ds_flipped.time)):
            # Cek apakah datanya 3D (butuh depth) atau 2D (permukaan saja)
            if is_depth:
                data = ds_flipped[nama_variabel].isel(time=t, depth=0).values
            else:
                data = ds_flipped[nama_variabel].isel(time=t).values
                
            data_flat = np.where(np.isnan(data), None, data).flatten().tolist()
            # Bulatkan 2 angka di belakang koma agar JSON sangat ringan
            data_flat = [round(float(val), 2) if val is not None else None for val in data_flat]

            all_days.append({
                "nx": nx, "ny": ny, "lo1": float(lons[0]), "la1": float(lats[0]),
                "dx": float(dx), "dy": float(dy), "zs": data_flat
            })

        with open(output_file, 'w') as f:
            json.dump(all_days, f)
        print(f"✅ Sukses disimpan ke: {output_file}")
    except Exception as e:
        print(f"❌ Gagal memproses {nama_variabel}: {e}")

# ========================================================
# MULAI EKSEKUSI PEMBUATAN JSON
# ========================================================

# 1. Arus (Format Khusus Leaflet Velocity)
print("\n--- 1. Proses Arus Laut ---")
try:
    ds_arus = xr.open_dataset('arus_kalteng_forecast.nc')
    ds_flipped = ds_arus.sortby('latitude', ascending=False)
    lats, lons = ds_flipped.latitude.values, ds_flipped.longitude.values
    nx, ny = len(lons), len(lats)
    dx, dy = (lons[1]-lons[0] if nx>1 else 0.083), (lats[1]-lats[0] if ny>1 else -0.083)
    all_arus = []
    for t in range(len(ds_flipped.time)):
        u = ds_flipped['uo'].isel(time=t, depth=0).values
        v = ds_flipped['vo'].isel(time=t, depth=0).values
        u_flat = np.where(np.isnan(u), None, u).flatten().tolist()
        v_flat = np.where(np.isnan(v), None, v).flatten().tolist()
        all_arus.append([
            {"header": {"parameterCategory": 2, "parameterNumber": 2, "lo1": float(lons[0]), "la1": float(lats[0]), "dx": float(dx), "dy": float(abs(dy)), "nx": nx, "ny": ny, "refTime": str(ds_flipped.time.values[t])}, "data": u_flat},
            {"header": {"parameterCategory": 2, "parameterNumber": 3, "lo1": float(lons[0]), "la1": float(lats[0]), "dx": float(dx), "dy": float(abs(dy)), "nx": nx, "ny": ny, "refTime": str(ds_flipped.time.values[t])}, "data": v_flat}
        ])
    with open('demo/data_arus_forecast.json', 'w') as f:
        json.dump(all_arus, f)
    print("✅ Sukses: demo/data_arus_forecast.json")
except Exception as e:
    print(f"❌ Gagal proses arus: {e}")

# 2. Suhu
print("\n--- 2. Proses Suhu (SST) ---")
konversi_grid_ke_json('suhu_kalteng.nc', 'thetao', 'demo/data_suhu_forecast.json', is_depth=True)

# 3. Salinitas
print("\n--- 3. Proses Salinitas ---")
konversi_grid_ke_json('salinitas_kalteng.nc', 'so', 'demo/data_salinitas_forecast.json', is_depth=True)

# 4. Elevasi Muka Air (SSH)
print("\n--- 4. Proses Elevasi Muka Air (SSH) ---")
konversi_grid_ke_json('ssh_kalteng.nc', 'zos', 'demo/data_ssh_forecast.json', is_depth=False)

# 5. Gelombang
print("\n--- 5. Proses Gelombang ---")
konversi_grid_ke_json('gelombang_kalteng.nc', 'VHM0', 'demo/data_gelombang_forecast.json', is_depth=False, is_3hourly=True)

print("\n🎉 SEMUA DATA METOCEAN SELESAI DIKONVERSI! 🎉")