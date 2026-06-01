// ==========================================
// MESIN PEMANDU TOUR (DRIVER.JS) — VERSI LENGKAP
// Mencakup semua fitur: Tab Analisis (Lobster), EWS, Thermal Front, 
// Analisis Historis, Pencarian Koordinat, Sumber Data, dll.
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    const btnTour = document.getElementById('btn-tour');

    // Helper: persiapan UI sebelum tour (buka panel/tab yang relevan)
    function setupForStep(stepKey) {
        const layerMenu = document.getElementById('layer-menu');
        
        // Helper: scroll panel parameter ke elemen tertentu
        function scrollPanelTo(selector) {
            const container = document.getElementById('parameter-list-metocean');
            const target = document.querySelector(selector);
            if (!container || !target) return;
            
            // Hitung posisi target relatif terhadap container
            const containerRect = container.getBoundingClientRect();
            const targetRect = target.getBoundingClientRect();
            const offset = targetRect.top - containerRect.top + container.scrollTop - 20;
            
            container.scrollTo({ top: Math.max(0, offset), behavior: 'smooth' });
        }
        
        switch (stepKey) {
            case 'open-menu':
                if (layerMenu) layerMenu.classList.remove('hidden');
                break;
            
            case 'tab-metocean':
                if (layerMenu) layerMenu.classList.remove('hidden');
                document.getElementById('tab-metocean')?.click();
                // Scroll ke atas panel (ke section Alat Analisis Spesifik)
                setTimeout(() => {
                    const container = document.getElementById('parameter-list-metocean');
                    if (container) container.scrollTo({ top: 0, behavior: 'smooth' });
                }, 200);
                break;
            
            case 'tab-metocean-mhw':
                // Scroll panel ke posisi #mhw-panel itu sendiri
                if (layerMenu) layerMenu.classList.remove('hidden');
                document.getElementById('tab-metocean')?.click();
                setTimeout(() => {
                    // Pakai scrollIntoView langsung ke elemen target
                    const target = document.getElementById('mhw-panel');
                    if (target) {
                        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 300);
                break;
            
            case 'tab-metocean-ews':
                if (layerMenu) layerMenu.classList.remove('hidden');
                document.getElementById('tab-metocean')?.click();
                setTimeout(() => {
                    document.getElementById('btn-ews-mhw')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 300);
                break;
            
            case 'tab-metocean-thermal':
                if (layerMenu) layerMenu.classList.remove('hidden');
                document.getElementById('tab-metocean')?.click();
                setTimeout(() => {
                    document.getElementById('btn-thermal-front')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 300);
                break;
            
            case 'tab-metocean-hotspot':
                if (layerMenu) layerMenu.classList.remove('hidden');
                document.getElementById('tab-metocean')?.click();
                setTimeout(() => {
                    document.getElementById('btn-hotspot-mhw')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 300);
                break;
            
            case 'tab-metocean-ocean':
                if (layerMenu) layerMenu.classList.remove('hidden');
                document.getElementById('tab-metocean')?.click();
                setTimeout(() => {
                    const target = document.querySelector('.metocean-item[data-type="suhu"]');
                    if (target) {
                        target.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                }, 300);
                break;
            
            case 'tab-analisis':
                if (layerMenu) layerMenu.classList.remove('hidden');
                document.getElementById('tab-analisis')?.click();
                break;
            
            case 'close-menu':
                if (layerMenu) layerMenu.classList.add('hidden');
                break;
        }
    }

    // Konfigurasi Driver.js
    const driver = window.driver.js.driver;
    const tourObj = driver({
        showProgress: true,
        animate: true,
        smoothScroll: true,
        doneBtnText: 'Selesai',
        nextBtnText: 'Lanjut ➔',
        prevBtnText: '⬅ Kembali',
        progressText: 'Langkah {{current}} dari {{total}}',
        
        // Hook untuk auto-setup UI sebelum setiap step
        onHighlightStarted: (element, step) => {
            if (step.setup) setupForStep(step.setup);
        },
        
        steps: [
            // ─── STEP 1: WELCOME ───────────────────────────────────────────
            {
                popover: {
                    title: '✈️ Selamat Datang di WebGIS Kalteng!',
                    description: 'Mari ikuti tour singkat ini untuk mengenal fitur-fitur lengkap WebGIS Kelautan Kalimantan Tengah. Klik <b>Lanjut</b> untuk memulai penjelajahan.',
                    align: 'center'
                }
            },
            
            // ─── STEP 2: PENCARIAN (Lokasi + Koordinat) ────────────────────
            {
                element: '#input-search',
                popover: {
                    title: '🔍 Pencarian Lokasi & Koordinat',
                    description: 'Klik kotak ini untuk membuka panel pencarian. Tersedia dua mode: <b>Cari Lokasi</b> (nama tempat seperti Palangkaraya/Sampit) dan <b>Cari Koordinat</b> (format Desimal atau DMS dengan pilihan arah N/S, E/W).',
                    side: 'bottom', align: 'start'
                }
            },
            
            // ─── STEP 3: BASEMAP ──────────────────────────────────────────
            {
                element: '#btn-basemap',
                popover: {
                    title: '🛰️ Ganti Latar Peta (Basemap)',
                    description: 'Pilih tampilan peta dasar: <b>Citra Satelit</b>, <b>OpenStreetMap</b>, <b>Gelap (Carto Dark)</b>, atau <b>Terang (Carto Light)</b>. Sesuaikan dengan kebutuhan analisis Anda.',
                    side: 'bottom', align: 'start'
                }
            },
            
            // ─── STEP 4: UPLOAD SHP ───────────────────────────────────────
            {
                element: '#btn-upload-shp',
                popover: {
                    title: '📁 Upload Shapefile (.zip)',
                    description: 'Punya data spasial sendiri? Upload file SHP (dalam format .zip) untuk ditampilkan sebagai layer tambahan di atas peta.',
                    side: 'bottom', align: 'start'
                }
            },
            
            // ─── STEP 5: WIDGET CUACA ─────────────────────────────────────
            {
                element: '#weather-widget',
                popover: {
                    title: '🌤️ Widget Cuaca',
                    description: 'Saat pertama dibuka, widget ini menampilkan cuaca <b>Palangkaraya</b>. Klik area mana saja di peta untuk melihat cuaca daerah tersebut. Klik widget atau tombol cuaca untuk menampilkan tabel ramalan per jam selama 7 hari ke depan.',
                    side: 'right', align: 'start'
                }
            },
            
            // ─── STEP 6: TOMBOL TOGGLE CUACA ──────────────────────────────
            {
                element: '#btn-toggle-weather',
                popover: {
                    title: '☁️ Tombol Cuaca On/Off',
                    description: 'Tombol ini berfungsi sebagai saklar utama widget cuaca. Klik untuk menyalakan/mematikan widget beserta tabel ramalan per jam.',
                    side: 'left', align: 'center'
                }
            },
            
            // ─── STEP 7: BUKA MENU LAYER ──────────────────────────────────
            {
                element: '#btn-layer-menu',
                popover: {
                    title: '🗺️ Menu Parameter Peta',
                    description: 'Klik tombol menu (ikon tiga garis) untuk membuka panel utama. Di sini Anda bisa memilih layer dari tiga kategori: <b>Zonasi Pesisir</b>, <b>MetOcean</b>, dan <b>Analisis</b>.',
                    side: 'left', align: 'start'
                }
            },
            
            // ─── STEP 8: TAB ZONASI ───────────────────────────────────────
            {
                element: '#tab-zonasi',
                setup: 'open-menu',
                popover: {
                    title: '📍 Tab Zonasi Pesisir',
                    description: 'Berisi peta tematik dari Dinas Kelautan & Perikanan Kalteng: Zonasi KKP, Alur Pelayaran, Migas, Kabel Bawah Laut, dan Migrasi Biota Laut.',
                    side: 'bottom', align: 'center'
                }
            },
            
            // ─── STEP 9: TAB METOCEAN ─────────────────────────────────────
            {
                element: '#tab-metocean',
                setup: 'tab-metocean',
                popover: {
                    title: '🌊 Tab MetOcean',
                    description: 'Tab utama untuk parameter laut & cuaca: <b>Suhu Air, Salinitas, Arus, Gelombang, Elevasi, Batimetri, Angin, Hujan, Tekanan</b>. Juga berisi <b>Alat Analisis Spesifik</b> di bagian atas.',
                    side: 'bottom', align: 'center'
                }
            },
            
            // ─── STEP 10: ANALISIS HISTORIS MHW ───────────────────────────
            {
                element: '#mhw-panel',
                setup: 'tab-metocean-mhw',
                popover: {
                    title: '📅 Analisis Historis MHW & MCS',
                    description: 'Pilih tahun untuk melihat data MHW (Marine Heat Wave) atau MCS (Marine Cold Spell) di tahun-tahun sebelumnya. Saat aktif, slider waktu di bawah berubah menjadi mode <b>bulanan</b>. Tombol parameter lain akan dinonaktifkan sementara.',
                    side: 'left', align: 'center'
                }
            },
            
            // ─── STEP 11: EWS MHW/MCS ─────────────────────────────────────
            {
                element: '#btn-ews-mhw',
                setup: 'tab-metocean-ews',
                popover: {
                    title: '🚨 Early Warning System (EWS) MHW',
                    description: 'Sistem peringatan dini gelombang panas laut. Klik untuk melihat area yang sedang mengalami suhu ekstrem di atas ambang batas. Tersedia juga <b>EWS MCS</b> untuk gelombang dingin di sebelahnya.',
                    side: 'left', align: 'center'
                }
            },
            
            // ─── STEP 12: THERMAL FRONT ───────────────────────────────────
            {
                element: '#btn-thermal-front',
                setup: 'tab-metocean-thermal',
                popover: {
                    title: '🌪️ Thermal Front',
                    description: 'Mendeteksi area pertemuan dua massa air dengan suhu berbeda. Area ini biasanya menjadi <b>potensi tangkapan ikan</b> yang tinggi. Akan muncul notifikasi pop-up jika terdeteksi area thermal front terdekat.',
                    side: 'left', align: 'center'
                }
            },
            
            // ─── STEP 13: HOTSPOT MHW/MCS ─────────────────────────────────
            {
                element: '#btn-hotspot-mhw',
                setup: 'tab-metocean-hotspot',
                popover: {
                    title: '🗺️ Hotspot MHW & MCS (30 Tahun)',
                    description: 'Peta kekerapan kejadian MHW/MCS berdasarkan analisis data CMEMS selama 30 tahun terakhir. Berguna untuk identifikasi area rentan terhadap fenomena ekstrem.',
                    side: 'left', align: 'center'
                }
            },
            
            // ─── STEP 14: PARAMETER OCEAN ─────────────────────────────────
            // ─── STEP 14: PARAMETER OCEAN ─────────────────────────────────
            {
                element: '.metocean-item[data-type="suhu"]',
                setup: 'tab-metocean-ocean',
                popover: {
                    title: '🌡️ Parameter Ocean (Laut)',
                    description: 'Klik salah satu kotak parameter untuk menampilkannya di peta. Misalnya klik <b>Suhu Air</b> untuk lihat sebaran suhu permukaan laut. Anda juga bisa <b>klik titik di peta</b> untuk membuka sidebar detail berisi grafik prakiraan 10 hari & profil kedalaman.',
                    side: 'left', align: 'center'
                }
            },
            
            // ─── STEP 15: TAB ANALISIS (LOBSTER) ──────────────────────────
            {
                element: '#tab-analisis',
                setup: 'tab-analisis',
                popover: {
                    title: '🦞 Tab Analisis — Kesesuaian Budidaya',
                    description: 'Tab baru berisi <b>analisis kesesuaian budidaya lobster sistem KJA</b> berdasarkan 8 parameter biologi-fisik. Mengikuti metodologi Lesmana et al. (2022) dengan data CMEMS Reanalysis (30 tahun) & batimetri BATNAS.',
                    side: 'bottom', align: 'center'
                }
            },
            
            // ─── STEP 16: KOTAK LOBSTER ───────────────────────────────────
            {
                element: '#btn-lobster',
                setup: 'tab-analisis',
                popover: {
                    title: '🦞 Aktifkan Kesesuaian Lobster KJA',
                    description: 'Klik kotak ini untuk menampilkan pixel-pixel kesesuaian di peta. Warna <b>🟢 hijau = S1 Sesuai</b>, <b>🟡 kuning = S2 Cukup Sesuai</b>, <b>🔴 merah = S3 Tidak Sesuai</b>. Arahkan kursor untuk lihat detail parameter, klik pixel untuk sidebar lengkap dengan radar chart!',
                    side: 'left', align: 'center'
                }
            },
            
            // ─── STEP 17: TIME SLIDER ─────────────────────────────────────
            {
                element: '#timeSlider',
                setup: 'close-menu',
                popover: {
                    title: '⏱️ Mesin Waktu (Time Slider)',
                    description: 'Geser slider ini untuk melihat prakiraan cuaca/laut hingga <b>10 hari ke depan</b> per jam. Klik tombol ▶ di kiri untuk animasi otomatis. Saat mode historis MHW aktif, slider berubah menjadi mode <b>bulanan tahunan</b>.',
                    side: 'top', align: 'center'
                }
            },
            
            // ─── STEP 18: DEPTH SLIDER ────────────────────────────────────
            {
                element: '#depth-container',
                popover: {
                    title: '🤿 Profil Kedalaman 3D',
                    description: 'Khusus untuk parameter laut (Suhu, Salinitas, Arus), gunakan slider ini untuk melihat kondisi dari <b>permukaan hingga kedalaman 92 meter</b>. Slider akan otomatis muncul saat parameter laut diaktifkan.',
                    side: 'top', align: 'start'
                }
            },
            
            // ─── STEP 19: ALAT UKUR ───────────────────────────────────────
            {
                element: '#btn-measure',
                popover: {
                    title: '📏 Alat Ukur Jarak',
                    description: 'Aktifkan penggaris, lalu klik beberapa titik di peta untuk mengukur jarak pelayaran. Cocok untuk perhitungan rute kapal nelayan.',
                    side: 'top', align: 'center'
                }
            },
            
            // ─── STEP 20: UKUR JARAK KE ZONASI ────────────────────────────
            {
                element: '#btn-ukur-zonasi',
                popover: {
                    title: '🎯 Ukur Jarak ke Batas Zonasi',
                    description: 'Fitur khusus: klik titik di peta, sistem akan otomatis menghitung jarak terdekat ke batas zonasi (KKP, alur pelayaran, dll). Berguna untuk verifikasi kepatuhan tata ruang.',
                    side: 'top', align: 'center'
                }
            },
            
            // ─── STEP 21: POLYGON & SHP ───────────────────────────────────
            {
                element: '#btn-polygon',
                popover: {
                    title: '⬠ Buat Area (Polygon) & Ekspor SHP',
                    description: 'Gambar poligon area di peta, lalu ekspor ke file <b>SHP (.zip)</b> lengkap dengan koordinat. Gunakan tombol 💾 di sebelahnya untuk download.',
                    side: 'top', align: 'center'
                }
            },
            
            // ─── STEP 22: CETAK PDF ───────────────────────────────────────
            {
                element: '#btn-print',
                popover: {
                    title: '🖨️ Cetak / Ekspor Peta ke PDF',
                    description: 'Selesai analisis? Ekspor peta menjadi file <b>PDF berstandar akademik</b> lengkap dengan grid (graticule), judul, dan legenda. Siap untuk laporan atau presentasi.',
                    side: 'top', align: 'center'
                }
            },
            
            // ─── STEP 23: FULLSCREEN & TOOLBAR ────────────────────────────
            {
                element: '#toolbar-bottom',
                popover: {
                    title: '🛠️ Toolbar Lengkap',
                    description: 'Di toolbar ini juga tersedia tombol <b>+/-</b> (zoom), <b>🏠</b> (kembali ke beranda), <b>🗑️</b> (bersihkan semua layer), dan <b>⛶</b> (mode layar penuh).',
                    side: 'top', align: 'end'
                }
            },
            
            // ─── STEP 24: KOORDINAT KURSOR ────────────────────────────────
            {
                element: '#coord-info',
                popover: {
                    title: '📍 Koordinat Kursor',
                    description: 'Lihat koordinat kursor Anda di pojok kiri-bawah saat menggerakkan mouse di atas peta. Berguna saat input koordinat manual di kotak pencarian.',
                    side: 'right', align: 'center'
                }
            },
            
            // ─── STEP 25: SELESAI ─────────────────────────────────────────
            {
                popover: {
                    title: '🎉 Tour Selesai!',
                    description: 'Selamat! Anda telah mengenal semua fitur utama WebGIS Kelautan Kalimantan Tengah.<br><br>📊 <b>Sumber data:</b> CMEMS (Copernicus), ECMWF, BATNAS (BIG), dan Dinas Kelautan & Perikanan Kalteng.<br><br>Selamat bereksplorasi! Klik tombol ✈️ di kanan-bawah untuk mengulang tour kapan saja.',
                    align: 'center'
                }
            }
        ],
        
        // Cleanup saat tour selesai/dibatalkan
        onDestroyed: () => {
            // Pastikan layer menu tertutup setelah tour selesai
            const layerMenu = document.getElementById('layer-menu');
            if (layerMenu && !layerMenu.classList.contains('hidden')) {
                layerMenu.classList.add('hidden');
            }
        }
    });

    // Tombol pemicu Tour
    if (btnTour) {
        btnTour.addEventListener('click', () => {
            // Bersihkan layar sebelum tour mulai
            const layerMenu = document.getElementById('layer-menu');
            if (layerMenu && !layerMenu.classList.contains('hidden')) {
                layerMenu.classList.add('hidden');
            }
            if (typeof closeSidebar === 'function') closeSidebar();
            if (typeof closeMetOceanSidebar === 'function') closeMetOceanSidebar();
            
            // Tutup popup pencarian jika terbuka
            if (typeof closeSearchModal === 'function') closeSearchModal();
            
            // Matikan widget cuaca dulu agar tidak menutupi tour
            if (typeof isWeatherActive !== 'undefined' && isWeatherActive &&
                typeof turnOffWeatherSystem === 'function') {
                turnOffWeatherSystem();
            }
            
            // Mulai tour
            tourObj.drive();
        });
    }
});
