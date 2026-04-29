import copernicusmarine as cm
import xarray as xr
import os

os.makedirs("data_nc", exist_ok=True)
CONF = {"username": "hidayatsyafrizal@gmail.com", "password": "Selat040413"}

def download_hybrid():
    # 1. DOWNLOAD HOURLY (HANYA PERMUKAAN - Untuk Grafik Cantik & 2D)
    print("📥 Downloading Hourly Surface Data...")
    cm.subset(
        dataset_id="cmems_mod_glo_phy_anfc_0.083deg_PT1H-m",
        variables=["thetao", "so", "uo", "vo", "zos"],
        minimum_longitude=108.0, maximum_longitude=117.0,
        minimum_latitude=-7.0, maximum_latitude=1.0,
        minimum_depth=0.4, maximum_depth=0.5, # Kunci: Hanya permukaan
        output_filename="data_nc/surface_hourly.nc",
        **CONF, force_download=True
    )

    # 2. DOWNLOAD DAILY (3D - Untuk Profil Kedalaman)
    print("📥 Downloading Daily 3D Data...")
    cm.subset(
        dataset_id="cmems_mod_glo_phy_anfc_0.083deg_PT24H-i",
        variables=["thetao", "so", "uo", "vo"],
        minimum_longitude=108.0, maximum_longitude=117.0,
        minimum_latitude=-7.0, maximum_latitude=1.0,
        minimum_depth=0.0, maximum_depth=93.0,
        output_filename="data_nc/3d_daily.nc",
        **CONF, force_download=True
    )
    
    print("✅ Download Hybrid Selesai!")

if __name__ == "__main__":
    download_hybrid()