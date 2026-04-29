import copernicusmarine as cm
import xarray as xr
import os
from datetime import datetime, timedelta

os.makedirs("data_nc", exist_ok=True)

# JANGAN LUPA masukkan password aslimu lagi di bawah ini!
CONF = {"username": "shidayat4", "password": "Selat040413@"}

def download_hybrid():
    start_date = datetime.utcnow().strftime("%Y-%m-%d 00:00:00")
    end_date = (datetime.utcnow() + timedelta(days=9)).strftime("%Y-%m-%d 00:00:00")
    
    print(f"Mendownload data MetOcean dari {start_date} sampai {end_date}...")

    # KORDINAT DISAMAKAN DENGAN DATA ECMWF / BATIMETRI
    MIN_LON = 109.0
    MAX_LON = 116.0
    MIN_LAT = -6.0
    MAX_LAT = -0.5

    # 1. DOWNLOAD HOURLY (PERMUKAAN)
    print("📥 Downloading Hourly Surface Data...")
    if os.path.exists("data_nc/surface_hourly.nc"): os.remove("data_nc/surface_hourly.nc")
    
    cm.subset(
        dataset_id="cmems_mod_glo_phy_anfc_0.083deg_PT1H-m",
        variables=["thetao", "so", "uo", "vo", "zos"],
        minimum_longitude=MIN_LON, maximum_longitude=MAX_LON,
        minimum_latitude=MIN_LAT, maximum_latitude=MAX_LAT,
        minimum_depth=0.4, maximum_depth=0.5, 
        start_datetime=start_date,
        end_datetime=end_date,     
        output_filename="data_nc/surface_hourly.nc",
        **CONF, overwrite=True 
    )

    # 2. DOWNLOAD DAILY 3D (DIPISAH LALU DIGABUNG OLEH XARRAY)
    print("📥 Downloading Daily 3D Data (Suhu)...")
    if os.path.exists("data_nc/3d_thetao.nc"): os.remove("data_nc/3d_thetao.nc")
    cm.subset(
        dataset_id="cmems_mod_glo_phy-thetao_anfc_0.083deg_P1D-m", 
        variables=["thetao"],
        minimum_longitude=MIN_LON, maximum_longitude=MAX_LON,
        minimum_latitude=MIN_LAT, maximum_latitude=MAX_LAT,
        minimum_depth=0.0, maximum_depth=93.0,
        start_datetime=start_date, end_datetime=end_date,
        output_filename="data_nc/3d_thetao.nc",
        **CONF, overwrite=True
    )
    
    print("📥 Downloading Daily 3D Data (Salinitas)...")
    if os.path.exists("data_nc/3d_so.nc"): os.remove("data_nc/3d_so.nc")
    cm.subset(
        dataset_id="cmems_mod_glo_phy-so_anfc_0.083deg_P1D-m", 
        variables=["so"],
        minimum_longitude=MIN_LON, maximum_longitude=MAX_LON,
        minimum_latitude=MIN_LAT, maximum_latitude=MAX_LAT,
        minimum_depth=0.0, maximum_depth=93.0,
        start_datetime=start_date, end_datetime=end_date,
        output_filename="data_nc/3d_so.nc",
        **CONF, overwrite=True
    )

    print("📥 Downloading Daily 3D Data (Arus)...")
    if os.path.exists("data_nc/3d_cur.nc"): os.remove("data_nc/3d_cur.nc")
    cm.subset(
        dataset_id="cmems_mod_glo_phy-cur_anfc_0.083deg_P1D-m", 
        variables=["uo", "vo"],
        minimum_longitude=MIN_LON, maximum_longitude=MAX_LON,
        minimum_latitude=MIN_LAT, maximum_latitude=MAX_LAT,
        minimum_depth=0.0, maximum_depth=93.0,
        start_datetime=start_date, end_datetime=end_date,
        output_filename="data_nc/3d_cur.nc",
        **CONF, overwrite=True
    )

    print("⚙️ Menggabungkan 3 file Daily menjadi satu (3d_daily.nc)...")
    try:
        ds_t = xr.open_dataset('data_nc/3d_thetao.nc')
        ds_s = xr.open_dataset('data_nc/3d_so.nc')
        ds_c = xr.open_dataset('data_nc/3d_cur.nc')
        
        ds_merged = xr.merge([ds_t, ds_s, ds_c], compat='override')
        
        if os.path.exists("data_nc/3d_daily.nc"): os.remove("data_nc/3d_daily.nc")
        ds_merged.to_netcdf('data_nc/3d_daily.nc')
        
        ds_t.close()
        ds_s.close()
        ds_c.close()
        
        os.remove("data_nc/3d_thetao.nc")
        os.remove("data_nc/3d_so.nc")
        os.remove("data_nc/3d_cur.nc")
        print("✅ Penggabungan 3D sukses!")
    except Exception as e:
        print("❌ Gagal menggabungkan 3D:", e)

    # 3. DOWNLOAD GELOMBANG (WAVE)
    print("📥 Downloading Wave Data...")
    if os.path.exists("data_nc/gelombang_hybrid.nc"): os.remove("data_nc/gelombang_hybrid.nc")
    
    cm.subset(
        dataset_id="cmems_mod_glo_wav_anfc_0.083deg_PT3H-i",
        variables=["VHM0"], 
        minimum_longitude=MIN_LON, maximum_longitude=MAX_LON,
        minimum_latitude=MIN_LAT, maximum_latitude=MAX_LAT,
        start_datetime=start_date,
        end_datetime=end_date,
        output_filename="data_nc/gelombang_hybrid.nc",
        **CONF, overwrite=True
    )
    
    print("✅ Download Hybrid Selesai 100%!")

if __name__ == "__main__":
    download_hybrid()