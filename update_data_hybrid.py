import copernicusmarine as cm
import os

os.makedirs("data_nc", exist_ok=True)

# PASTIKAN: Gunakan USERNAME (Bukan Email). Huruf besar/kecil harus sama persis dengan di profil web Copernicus!
CONF = {"username": "shidayat4", "password": "Selat040413@"}

def download_hybrid():
    # 1. DOWNLOAD HOURLY (PERMUKAAN)
    print("📥 Downloading Hourly Surface Data...")
    if os.path.exists("data_nc/surface_hourly.nc"): os.remove("data_nc/surface_hourly.nc")
    
    cm.subset(
        dataset_id="cmems_mod_glo_phy_anfc_0.083deg_PT1H-m",
        variables=["thetao", "so", "uo", "vo", "zos"],
        minimum_longitude=108.0, maximum_longitude=117.0,
        minimum_latitude=-7.0, maximum_latitude=1.0,
        minimum_depth=0.4, maximum_depth=0.5, 
        output_filename="data_nc/surface_hourly.nc",
        **CONF, overwrite=True # Wajib pakai overwrite=True, bukan force_download
    )

    # 2. DOWNLOAD DAILY (3D)
    print("📥 Downloading Daily 3D Data...")
    if os.path.exists("data_nc/3d_daily.nc"): os.remove("data_nc/3d_daily.nc")
    
    cm.subset(
        dataset_id="cmems_mod_glo_phy_anfc_0.083deg_PT24H-i",
        variables=["thetao", "so", "uo", "vo"],
        minimum_longitude=108.0, maximum_longitude=117.0,
        minimum_latitude=-7.0, maximum_latitude=1.0,
        minimum_depth=0.0, maximum_depth=93.0,
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
        output_filename="data_nc/gelombang_hybrid.nc",
        **CONF, overwrite=True
    )
    
    print("✅ Download Hybrid Selesai!")

if __name__ == "__main__":
    download_hybrid()