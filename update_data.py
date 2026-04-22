import subprocess
from datetime import datetime, timedelta
import os
import urllib.request
import sys

print(f"--- Pengecekan Rutin: {datetime.now()} ---")

# 1. CEK KONEKSI INTERNET
def ada_internet():
    try:
        urllib.request.urlopen('http://google.com', timeout=3)
        return True
    except:
        return False

if not ada_internet():
    print("Misi dibatalkan: Tidak ada jaringan internet.")
    sys.exit() # Matikan script langsung

# 2. CEK APAKAH SUDAH UPDATE HARI INI
# (Pilih salah satu file .nc kamu sebagai patokan utama)
file_patokan = "/mnt/c/Users/1212/geoportal-laut-itb-bungsu/data_nc/suhu_kalteng.nc" 

if os.path.exists(file_patokan):
    # Ambil tanggal terakhir file tersebut dimodifikasi
    tanggal_modifikasi = datetime.fromtimestamp(os.path.getmtime(file_patokan)).date()
    tanggal_hari_ini = datetime.now().date()
    
    if tanggal_modifikasi == tanggal_hari_ini:
        print("Misi dibatalkan: Data sudah versi terbaru hari ini. Lanjut tidur zzz...")
        sys.exit() # Matikan script langsung karena sudah update

# Jika lolos kedua ujian di atas, berarti internet ADA dan data BELUM update hari ini!
print("Internet OK! Data Belum Update! Memulai proses download dari satelit...")

# =======================================================
# TARUH KODINGAN DOWNLOAD LAMA KAMU DI BAWAH GARIS INI
# =======================================================


# 1. Pindah ke folder proyek (Sesuaikan path ini dengan folder kamu)
# Gunakan absolute path agar Cronjob tidak bingung
base_path = "/mnt/c/Users/1212/geoportal-laut-itb-bungsu"
os.chdir(base_path)

# 2. Hitung Tanggal Otomatis
today = datetime.now()
start_date = today.strftime("%Y-%m-%d")
end_date = (today + timedelta(days=9)).strftime("%Y-%m-%d")

print(f"--- Memulai Update Data Otomatis ({start_date} s/d {end_date}) ---")

# 3. Daftar Perintah Download (5 File Utama sesuai diskusi terakhir)
commands = [
    # 1. Suhu (3D Harian - Sampai 200m)
    f'/home/syafrizalocean/venv/bin/copernicusmarine subset -i cmems_mod_glo_phy-thetao_anfc_0.083deg_P1D-m -x 109 -X 116 -y -5.5 -Y -0.5 -v thetao -z 0 -Z 200 --start-datetime "{start_date}" --end-datetime "{end_date}" -o data_nc -f suhu_kalteng.nc --overwrite',
    
    # 2. Arus (3D Harian - Sampai 200m)
    f'/home/syafrizalocean/venv/bin/copernicusmarine subset -i cmems_mod_glo_phy-cur_anfc_0.083deg_P1D-m -x 109 -X 116 -y -5.5 -Y -0.5 -v uo -v vo -z 0 -Z 200 --start-datetime "{start_date}" --end-datetime "{end_date}" -o data_nc -f arus_kalteng.nc --overwrite',
    
    # 3. Elevasi Muka Air / SSH (2D Permukaan Harian)
    f'/home/syafrizalocean/venv/bin/copernicusmarine subset -i cmems_mod_glo_phy_anfc_0.083deg_P1D-m -x 109 -X 116 -y -5.5 -Y -0.5 -v zos --start-datetime "{start_date}" --end-datetime "{end_date}" -o data_nc -f ssh_kalteng.nc --overwrite',
    
    # 4. Salinitas (3D Harian - Sampai 200m)
    f'/home/syafrizalocean/venv/bin/copernicusmarine subset -i cmems_mod_glo_phy-so_anfc_0.083deg_P1D-m -x 109 -X 116 -y -5.5 -Y -0.5 -v so -z 0 -Z 200 --start-datetime "{start_date}" --end-datetime "{end_date}" -o data_nc -f salinitas_kalteng.nc --overwrite',
    
    # 5. Gelombang (2D Permukaan 3-Jaman)
    f'/home/syafrizalocean/venv/bin/copernicusmarine subset -i cmems_mod_glo_wav_anfc_0.083deg_PT3H-i -x 109 -X 116 -y -5.5 -Y -0.5 -v VHM0 --start-datetime "{start_date}" --end-datetime "{end_date}" -o data_nc -f gelombang_kalteng.nc --overwrite'
]

# 4. Jalankan perintah satu per satu
for cmd in commands:
    print(f"Menjalankan: {cmd[:50]}...")
    try:
        # Perintah ini akan otomatis menimpa file lama di folder data_nc
        subprocess.run(cmd, shell=True, check=True)
        print("✅ Berhasil.")
    except Exception as e:
        print(f"❌ Gagal: {e}")

print("--- Semua Data MetOcean Berhasil Diperbarui! ---")