// ==========================================
// MESIN PEMANDU TOUR (DRIVER.JS)
// ==========================================

document.addEventListener('DOMContentLoaded', () => {
    const btnTour = document.getElementById('btn-tour');

    // 1. Konfigurasi Mesin Driver.js
    const driver = window.driver.js.driver;
    const tourObj = driver({
        showProgress: true,       // Munculkan tulisan "Langkah 1 dari 10"
        animate: true,            // Animasi transisi yang mulus
        doneBtnText: 'Selesai',
        nextBtnText: 'Lanjut ➔',
        prevBtnText: '⬅ Kembali',
        progressText: 'Langkah {{current}} dari {{total}}',
        
        // 2. Daftar Destinasi Tour (Bisa kamu tambah/edit teksnya sesuka hati)
        steps: [
            {
                popover: {
                    title: '✈️ Selamat Datang di WebGIS Kalteng!',
                    description: 'Mari ikuti penerbangan singkat ini untuk mengenal fitur-fitur canggih di aplikasi ini. Klik Lanjut untuk mulai.',
                    align: 'center'
                }
            },
            {
                element: '#btn-layer-menu', // Menyorot tombol menu
                popover: {
                    title: '🗺️ Menu Peta & Parameter',
                    description: 'Klik tombol ini untuk membuka panel utama. Di sini kamu bisa memilih peta Zonasi Pesisir atau parameter MetOcean (Suhu, Arus, Salinitas).',
                    side: "left", align: 'start'
                }
            },
            {
                element: '#btn-basemap', // Menyorot tombol basemap
                popover: {
                    title: '🛰️ Ganti Latar (Basemap)',
                    description: 'Bosan dengan peta satelit? Ubah latar belakang peta ke mode Gelap (Dark), Terang (Light), atau OpenStreetMap di sini.',
                    side: "bottom", align: 'start'
                }
            },
            {
                element: '#input-search', // Menyorot kotak pencarian
                popover: {
                    title: '🔍 Pencarian Lokasi',
                    description: 'Ketik nama daerah atau pulau di sini, lalu pilih dari saran yang muncul. Kamera akan otomatis terbang ke lokasi tersebut.',
                    side: "bottom", align: 'start'
                }
            },
            {
                element: '#btn-toggle-weather', // Menyorot fitur cuaca Windy Clone
                popover: {
                    title: '🌤️ Mode Ramalan Cuaca',
                    description: 'Klik tombol ini untuk memunculkan widget ramalan cuaca interaktif layaknya aplikasi profesional.',
                    side: "left", align: 'center'
                }
            },
            {
                element: '#timeSlider', // Menyorot slider waktu bawah
                popover: {
                    title: '⏱️ Mesin Waktu (Time Slider)',
                    description: 'Geser tuas ini untuk melihat pergerakan prakiraan cuaca dan laut hingga 10 hari ke depan!',
                    side: "top", align: 'center'
                }
            },
            {
                element: '#depth-container', // Menyorot kedalaman
                popover: {
                    title: '🤿 Profil Kedalaman (3D)',
                    description: 'Khusus data laut (seperti Suhu atau Arus), gunakan slider ini untuk melihat kondisi air dari permukaan hingga kedalaman 92 meter.',
                    side: "top", align: 'start'
                }
            },
            {
                element: '#btn-measure', // Menyorot penggaris
                popover: {
                    title: '📏 Alat Ukur Jarak',
                    description: 'Aktifkan penggaris, lalu klik beberapa titik di peta untuk mengukur jarak pelayaran dengan presisi tinggi.',
                    side: "left", align: 'center'
                }
            },
            {
                element: '#btn-polygon', // Menyorot pembuat area
                popover: {
                    title: '⬠ Buat Area (Polygon) & SHP',
                    description: 'Gambar area poligonmu sendiri, dan langsung ekspor menjadi file SHP (.zip) lengkap dengan data koordinatnya!',
                    side: "left", align: 'center'
                }
            },
            {
                element: '#btn-print', // Menyorot tombol print
                popover: {
                    title: '🖨️ Cetak Peta (PDF)',
                    description: 'Selesai analisis? Klik ini untuk mengekspor petamu menjadi file PDF berstandar akademik, lengkap dengan grid (graticule) dan legenda.',
                    side: "left", align: 'center'
                }
            },
            {
                popover: {
                    title: '🎉 Tour Selesai!',
                    description: 'Kamu sekarang sudah siap menjadi nahkoda di WebGIS ini. Selamat bereksplorasi!',
                    align: 'center'
                }
            }
        ]
    });

    // 3. Tombol Pemicu Tour
    if (btnTour) {
        btnTour.addEventListener('click', () => {
            // Tutup menu-menu yang mungkin sedang terbuka agar layar bersih sebelum tour
            const layerMenu = document.getElementById('layer-menu');
            if (layerMenu && !layerMenu.classList.contains('hidden')) {
                layerMenu.classList.add('hidden');
            }
            if (typeof closeSidebar === 'function') closeSidebar();
            if (typeof closeMetOceanSidebar === 'function') closeMetOceanSidebar();
            
            // TERBANGKAN PESAWATNYA!
            tourObj.drive();
        });
    }
});