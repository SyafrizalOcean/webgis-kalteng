import xarray as xr
from ecmwf.opendata import Client
import os
import gc

os.makedirs("data_nc", exist_ok=True) # Kita simpan langsung ke folder data_nc
client = Client(source="ecmwf")

waktu_jam = list(range(0, 145, 3)) + list(range(150, 241, 6))
parameter_cuaca = ["10u", "10v", "msl", "tp"]

print("🌍 MEMULAI PROSES DOWNLOAD & POTONG DATA CUACA ECMWF...")

for param in parameter_cuaca:
    temp_file = f"temp_{param}.grib2"
    out_file = f"data_nc/{param}_kalteng.nc"
    
    print(f"\n📥 1. Mendownload Global {param.upper()}...")
    try:
        client.retrieve(step=waktu_jam, type="fc", param=param, target=temp_file)
        
        print(f"✂️ 2. Memotong Global ke Area Kalteng...")
        ds = xr.open_dataset(temp_file, engine="cfgrib")
        
        # --- KUNCI PERBAIKAN: HAPUS 'TIME' LAMA SEBELUM RENAME ---
        if 'time' in ds.coords or 'time' in ds.variables:
            ds = ds.drop_vars('time')
            
        # Perbaiki format waktu
        if 'valid_time' in ds.coords and 'step' in ds.dims:
            ds = ds.swap_dims({'step': 'valid_time'}).rename({'valid_time': 'time'})
            
        # Potong area Kalteng
        lats = ds.latitude.values
        if lats[0] > lats[-1]: 
            ds_crop = ds.sel(latitude=slice(1, -7), longitude=slice(108, 117))
        else: 
            ds_crop = ds.sel(latitude=slice(-7, 1), longitude=slice(108, 117))
        
        print(f"💾 3. Menyimpan sebagai {out_file}...")
        ds_crop.to_netcdf(out_file)
        
        # Bersihkan memori & hapus file raksasa
        ds.close()
        del ds_crop
        gc.collect()
        os.remove(temp_file)
        print(f"✅ {param.upper()} Selesai!")
        
    except Exception as e:
        print(f"❌ Gagal memproses {param}: {e}")

print("\n🎉 SEMUA DATA CUACA SELESAI DIPOTONG DAN DISIMPAN SEBAGAI .NC!")