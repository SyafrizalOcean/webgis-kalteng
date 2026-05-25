import copernicusmarine as cm
import xarray as xr
import os
from datetime import datetime, timedelta
import numpy as np  # <--- TAMBAHKAN INI!
import json         # <--- TAMBAHKAN INI JUGA (Jaga-jaga agar JSON-nya bisa dibuat)
import pandas as pd # <--- DAN INI!

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
    
    # ==================================================
    # 4. EWS MARINE HEAT WAVES (MHW) & COLD SPELLS (MCS)
    # ==================================================
    print("🚨 Menganalisis Potensi Ekstrem (MHW & MCS) Hari Ini...")
    try:
        import json
        import pandas as pd
        
        # Buka data forecast harian yang baru saja di-download
        ds_forecast = xr.open_dataset('data_nc/3d_daily.nc')
        sst_hari_ini = ds_forecast['thetao'].isel(depth=0, time=0)
        
        # Buka "Buku Panduan" Klimatologi (Berisi Mean, P90, dan P10)
        ds_klim = xr.open_dataset('Klimatologi_SST_365Hari.nc')
        
        # Cari tahu hari ini hari ke-berapa (Day of Year)
        waktu_sekarang = pd.to_datetime(sst_hari_ini.time.values)
        doy_sekarang = waktu_sekarang.dayofyear
        
        # Ambil peta batas wajar spesifik untuk hari ini
        batas_hari_ini = ds_klim.sel(dayofyear=doy_sekarang)
        batas_mhw = batas_hari_ini['p90']  # Persentil 90
        batas_mcs = batas_hari_ini['p10']  # Persentil 10
        
        # MESIN DETEKSI GANDA
        potensi_mhw = sst_hari_ini > batas_mhw
        potensi_mcs = sst_hari_ini < batas_mcs
        
        lats = sst_hari_ini.latitude.values
        lons = sst_hari_ini.longitude.values
        
        def cetak_json(potensi, batas_suhu, nama_file):
            y_idx, x_idx = np.where(potensi == True)
            json_data = {
                "tanggal_analisis": waktu_sekarang.strftime("%Y-%m-%d"),
                "day_of_year": int(doy_sekarang),
                "data_peringatan": []
            }
            for i in range(len(y_idx)):
                if not np.isnan(sst_hari_ini.values[y_idx[i], x_idx[i]]):
                    json_data["data_peringatan"].append({
                        "lat": round(float(lats[y_idx[i]]), 3),
                        "lon": round(float(lons[x_idx[i]]), 3),
                        "suhu_prediksi": round(float(sst_hari_ini.values[y_idx[i], x_idx[i]]), 2),
                        "batas_wajar": round(float(batas_suhu.values[y_idx[i], x_idx[i]]), 2)
                    })
            json_data["total_titik_bahaya"] = len(json_data["data_peringatan"])
            with open(nama_file, "w") as f:
                json.dump(json_data, f)
            return json_data["total_titik_bahaya"]

        # Eksekusi Pembuatan JSON
        tot_mhw = cetak_json(potensi_mhw, batas_mhw, "ews_mhw_hari_ini.json")
        tot_mcs = cetak_json(potensi_mcs, batas_mcs, "ews_mcs_hari_ini.json")
            
        print(f"✅ Radar Selesai! Ditemukan {tot_mhw} titik MHW dan {tot_mcs} titik MCS.")
        ds_forecast.close()
        ds_klim.close()
    except Exception as e:
        print("❌ Gagal memproses EWS:", e)

    print("✅ Download Hybrid Selesai 100%!")

if __name__ == "__main__":
    download_hybrid()