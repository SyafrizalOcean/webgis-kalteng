from ecmwf.opendata import Client
import os

# Buat folder khusus cuaca jika belum ada
os.makedirs("data_met", exist_ok=True)

# Memanggil API resmi ECMWF
client = Client(source="ecmwf")

print("--- Memulai Download Prakiraan ECMWF (10 Hari) ---")

# --- KUNCI PERBAIKANNYA DI SINI ---
# Kita ikuti aturan resmi ECMWF Open Data:
# 0 s/d 144 jam = interval 3 jam
# 150 s/d 240 jam = interval 6 jam
waktu_jam = list(range(0, 145, 3)) + list(range(150, 241, 6))

# Parameter yang mau diambil
# 10u = Angin U, 10v = Angin V, msl = Tekanan Udara, tp = Curah Hujan
parameter_cuaca = ["10u", "10v", "msl", "tp"]

for param in parameter_cuaca:
    print(f"\nMenyedot data {param.upper()}...")
    try:
        client.retrieve(
            step=waktu_jam,
            type="fc",          
            param=param,
            target=f"data_met/{param}_kalteng.grib2"
        )
        print(f"✅ {param.upper()} berhasil diamankan!")
    except Exception as e:
        print(f"❌ Gagal mendownload {param}: {e}")

print("\n--- SEMUA DATA CUACA ECMWF BERHASIL DIPERBARUI! ---")