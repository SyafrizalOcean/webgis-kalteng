import copernicusmarine as cm
import os
from datetime import datetime, timedelta

os.makedirs("data_nc", exist_ok=True)

# Jangan lupa masukkan password aslimu lagi di bawah ini sebelum di-push!
CONF = {"username": "shidayat4", "password": "Selat040413@"}

def download_hybrid():
    # KUNCI PERBAIKAN: Batasi waktu hanya 10 hari agar file tidak mencapai 6 GB!
    start_date = datetime.utcnow().strftime("%Y-%m-%d 00:00:00")
    end_date = (datetime.utcnow() + timedelta(days=9)).strftime("%Y-%m-%d 23:59:59")
    
    print(f"Mendownload data MetOcean dari {start_date} sampai {end_date}...")

    # 1. DOWNLOAD HOURLY (PERMUKAAN)
    print("📥 Downloading Hourly Surface Data...")
    if os.path.exists("data_nc/surface_hourly.nc"): os.remove("data_nc/surface_hourly.nc")
    
    cm.subset(
        dataset_id="cmems_mod_glo_phy_anfc_0.083deg_PT1H-m",
        variables=["thetao", "so", "uo", "vo", "zos"],
        minimum_longitude=108.0, maximum_longitude=117.0,
        minimum_latitude=-7.0, maximum_latitude=1.0,
        minimum_depth=0.4, maximum_depth=0.5, 
        start_datetime=start_date, # Batas Waktu Mulai
        end_datetime=end_date,     # Batas Waktu Akhir
        output_filename="data_nc/surface_hourly.nc",
        **CONF, overwrite=True 
    )

    # 2. DOWNLOAD DAILY (3D)
    print("📥 Downloading Daily 3D Data...")
    if os.path.exists("data_nc/3d_daily.nc"): os.remove("data_nc/3d_daily.nc")
    
    cm.subset(
        # KUNCI PERBAIKAN: Kode harian Copernicus yang benar adalah P1D-m
        dataset_id="cmems_mod_glo_phy_anfc_0.083deg_P1D-m", 
        variables=["thetao", "so", "uo", "vo"],
        minimum_longitude=108.0, maximum_longitude=117.0,
        minimum_latitude=-7.0, maximum_latitude=1.0,
        minimum_depth=0.0, maximum_depth=93.0,
        start_datetime=start_date,
        end_datetime=end_date,
        output_filename="data_nc/3d_daily.nc",
        **CONF, overwrite=True
    )
    
    # 3. DOWNLOAD GELOMBANG (WAVE)
    print("📥 Downloading Wave Data...")
    if os.path.exists("data_nc/gelombang_hybrid.nc"): os.remove("data_nc/gelombang_hybrid.nc")
    
    cm.subset(
        dataset_id="cmems_mod_glo_wav_anfc_0.083deg_PT3H-i",
        variables=["VHM0"], 
        minimum_longitude=108.0, maximum_longitude=117.0,
        minimum_latitude=-7.0, maximum_latitude=1.0,
        start_datetime=start_date,
        end_datetime=end_date,
        output_filename="data_nc/gelombang_hybrid.nc",
        **CONF, overwrite=True
    )
    
    print("✅ Download Hybrid Selesai!")

if __name__ == "__main__":
    download_hybrid()