// STEP 1: Buat peta
var map = L.map('mapid', {
    zoomControl: false // Matikan zoom control default
}).setView([-4.0, 112.0], 7.4);

// Teks penjelasan untuk setiap layer
const layerDescriptions = {
    arus: {
        title: 'Arus Laut (m/s)',
        description: 'Arus laut adalah gerakan massa air laut yang terus-menerus dan terarah, mengalir seperti sungai-sungai raksasa yang tidak terlihat di dalam samudra. Gerakan kolosal ini bukan sekadar air yang berpindah tempat; ia adalah bagian dari sistem sirkulasi global yang sangat kompleks dan memainkan peran fundamental dalam mengatur iklim planet, mendukung kehidupan laut, dan memengaruhi aktivitas manusia seperti pelayaran dan perikanan.'
    },
    suhu: {
        title: 'Suhu Permukaan Laut (°C)',
        description: 'Suhu di permukaan laut (Sea Surface Temperature/SST) adalah salah satu indikator vital paling penting bagi kesehatan planet kita. Lautan berfungsi sebagai baterai panas raksasa yang menyerap, menyimpan, dan melepaskan sejumlah besar energi, menjadikannya penggerak utama bagi sistem iklim, cuaca, dan seluruh ekosistem di dalamnya, termasuk ikan dan terumbu karang.'
    }
};

// Tambahkan zoom control custom di posisi kanan atas
L.control.zoom({
    position: 'topright'
}).addTo(map);

// STEP 2: Definisikan layer peta dasar
// STEP 2: Definisikan layer peta dasar
var satelliteMap = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', {
    attribution: 'Tiles &copy; Esri'
});
var cartoDark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors &copy; <a href="https://carto.com/attributions">CARTO</a>'
});

// --- BASEMAP BARU ---
var openStreetMap = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
});
var stadiaDark = L.tileLayer('https://tiles.stadiamaps.com/tiles/alidade_smooth_dark/{z}/{x}/{y}{r}.png', {
    attribution: '&copy; <a href="https://stadiamaps.com/">Stadia Maps</a>, &copy; <a href="https://openmaptiles.org/">OpenMapTiles</a> &copy; <a href="http://openstreetmap.org">OpenStreetMap</a> contributors'
});

satelliteMap.addTo(map); // Peta awal yang ditampilkan tetap citra satelit

// STEP 3: Muat semua file data
var sstFilePaths = [];
var monthNames = ["Januari", "Februari", "Maret", "April", "Mei", "Juni", "Juli", "Agustus", "September", "Oktober", "November", "Desember"];
for (var i = 1; i <= 12; i++) {
    var monthString = i < 10 ? '0' + i : i.toString();
    sstFilePaths.push(`Temperatur/sst_month_${monthString}.json`); 
}
var arusFilePath = 'data_arus_final.json';
var allFilePaths = [arusFilePath, ...sstFilePaths];

var fetchPromises = allFilePaths.map(path => fetch(path).then(res => res.json()));

closeInfoBtn.addEventListener('click', () => {
    infoPanel.classList.add('hidden');
});

Promise.all(fetchPromises).then(results => {
    var arusData = results[0];
    var sstMonthlyData = results.slice(1);

    console.log("Data Arus berhasil dimuat");
    console.log(`${sstMonthlyData.length} file Data SST berhasil dimuat`);

    // --- Membuat Layer Arus Laut ---
    var velocityLayer = L.velocityLayer({
        displayValues: true,
        displayOptions: { velocityType: 'Arus Laut' },
        data: arusData,
        maxVelocity: 0.8,
        velocityScale: 0.2
    });

    // --- Membuat 12 LAYER SUHU LAUT (SST) ---
    // GANTI SELURUH BLOK looping sstMonthlyData.forEach DENGAN INI

// --- Membuat LAYER SUHU LAUT (SST) DENGAN DATA TAHUNAN ---
// GANTI SELURUH BLOK INI
// --- Membuat LAYER SUHU LAUT (SST) DENGAN DATA TAHUNAN ---
    var colorScale = chroma.scale(['blue', 'cyan', 'lime', 'yellow', 'red']).domain([28, 32.8]);
    var monthlySstLayers = []; // Array untuk menampung 12 layer SST

// Inisialisasi array untuk setiap bulan
    for (let i = 0; i < 12; i++) {
        monthlySstLayers.push(L.featureGroup());
    }

    if (sstMonthlyData.length > 0) {
        const sstGrid = sstMonthlyData[0];
        for (let j = 0; j < sstGrid.ny; j++) {
            for (let i = 0; i < sstGrid.nx; i++) {
                const dataIndex = j * sstGrid.nx + i;
                const yearlyTemps = sstMonthlyData.map(data => data.zs[dataIndex]);
                // Di demo.js, ganti blok "if (yearlyTemps.some..." dengan kode ini:

                if (yearlyTemps.some(temp => temp !== null)) {
                    const lat = sstGrid.la1 - j * sstGrid.dy;
                    const lon = sstGrid.lo1 + i * sstGrid.dx;
                    const bounds = [[lat - sstGrid.dy, lon], [lat, lon + sstGrid.dx]];

                    for (let month = 0; month < 12; month++) {
                        const value = yearlyTemps[month];
                        if (value !== null) {
                            const rectangle = L.rectangle(bounds, {
                                color: colorScale(value).hex(),
                                weight: 0,
                                fillOpacity: 0.4
                            });

                            // Tambahkan event handler ke rectangle
                            rectangle
                                .bindTooltip(`Suhu: ${value.toFixed(1)} °C`)
// GANTI TOTAL BLOK .on('click', ...) ANDA DENGAN INI:

                                .on('click', function(e) {
                                    const lat = parseFloat(e.latlng.lat);
                                    const lon = parseFloat(e.latlng.lng);

                                    // ▼▼▼ BAGIAN 1: Simpan data klik terakhir ke "memori" ▼▼▼
                                    lastClickedLatLng = e.latlng;
                                    lastClickedYearlyTemps = yearlyTemps; 
                                    
                                    const currentTemp = yearlyTemps[currentMonthIndex];
                                    const tempText = currentTemp !== null ? `${currentTemp.toFixed(1)} °C` : 'N/A';

                                    const popupContent = `
                                        <div class="popup-header">Info Lokasi</div>
                                        <div class="popup-body">
                                            <div class="popup-info-row">
                                                <i class="fas fa-water"></i>
                                                <span>Suhu Bulan Ini: <strong>${tempText}</strong></span>
                                            </div>
                                            <div class="popup-info-row">
                                                <i class="fas fa-map-marker-alt"></i>
                                                <span>Lat: ${lat.toFixed(4)}</span>
                                            </div>
                                            <div class="popup-info-row">
                                                <i class="fas fa-map-marker-alt" style="opacity:0;"></i>
                                                <span>Lon: ${lon.toFixed(4)}</span>
                                            </div>
                                        </div>
                                    `;

                                    // ▼▼▼ BAGIAN 2: Simpan objek pop-up ke "memori" ▼▼▼
                                    activePopup = L.popup({ className: 'custom-popup' })
                                        .setLatLng(e.latlng)
                                        .setContent(popupContent)
                                        .openOn(map);

                                    // ▼▼▼ BAGIAN 3: "Lupakan" pop-up saat ditutup (PENTING!) ▼▼▼
                                    activePopup.on('close', function() {
                                        activePopup = null;
                                        lastClickedLatLng = null;
                                        lastClickedYearlyTemps = null;
                                    });

                                    // Panggil fungsi untuk menampilkan grafik di sidebar (ini tidak berubah)
                                    showTemperatureChartInSidebar(lat, lon, yearlyTemps);
                                })
                            // ▼▼▼ BARIS PALING PENTING YANG HILANG ▼▼▼
                            // Tambahkan rectangle yang sudah jadi ke layer bulan yang sesuai
                            monthlySstLayers[month].addLayer(rectangle);
                        }
                    }
                }
            }
        }
    }    

// --- FUNGSI BARU UNTUK MENAMPILKAN GRAFIK ---
// GANTI SELURUH FUNGSI INI
// --- FUNGSI BARU UNTUK MENAMPILKAN GRAFIK ---
// HAPUS fungsi 'showTemperatureChart' yang lama, dan GANTI dengan yang ini:

    let chartInstance = null; // Variabel ini tetap di sini

    // Di demo.js, ganti total fungsi showTemperatureChartInSidebar dengan ini:

    // Di demo.js, ganti total fungsi showTemperatureChartInSidebar

// GANTI TOTAL FUNGSI LAMA ANDA DENGAN VERSI FINAL INI

    function showTemperatureChartInSidebar(lat, lon, yearlyData) {
        const containerGrafik = document.getElementById('grafik-container');
        
        // ▼▼▼ PERUBAHAN 1: Tampilkan kontainer grafik ▼▼▼
        // Baris ini "menghidupkan" kembali area grafik yang sebelumnya disembunyikan oleh CSS.
        containerGrafik.style.display = 'flex'; 

        containerGrafik.innerHTML = '';

        // 1. Buat Header (Judul + Tombol Close)
        const header = document.createElement('div');
        header.className = 'grafik-header';
        header.innerHTML = `
            <span class="grafik-title">Tren Suhu Tahunan</span>
            <button class="grafik-close-btn" title="Tutup Grafik">&times;</button>
        `;
        containerGrafik.appendChild(header);

        // 2. Buat DIV PEMBUNGKUS untuk kanvas
        const canvasWrapper = document.createElement('div');
        canvasWrapper.className = 'grafik-canvas-wrapper';
        
        // 3. Buat Canvas dan MASUKKAN KE DALAM PEMBUNGKUS
        const canvas = document.createElement('canvas');
        canvas.id = 'tempChartSidebar';
        canvasWrapper.appendChild(canvas);

        // 4. Masukkan PEMBUNGKUS ke kontainer utama
        containerGrafik.appendChild(canvasWrapper);

        // 5. Tambahkan fungsi pada Tombol Close
        const closeBtn = header.querySelector('.grafik-close-btn');
        closeBtn.addEventListener('click', function() {
            if (chartInstance) {
                chartInstance.destroy();
                chartInstance = null;
            }
            
            // ▼▼▼ PERUBAHAN 2: Sembunyikan kontainer saat ditutup ▼▼▼
            // Daripada menampilkan placeholder, kita sembunyikan lagi area grafiknya.
            containerGrafik.style.display = 'none';
        });

        if (chartInstance) {
            chartInstance.destroy();
        }

        // 6. Render grafik
        const ctx = canvas.getContext('2d');
        chartInstance = new Chart(ctx, {
            type: 'line',
            data: {
                labels: ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"],
                datasets: [{
                    label: 'Suhu (°C)',
                    data: yearlyData,
                    borderColor: '#007BFF',
                    backgroundColor: 'rgba(0, 123, 255, 0.1)',
                    fill: true,
                    tension: 0.1
                }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { ticks: { callback: function(value) { return value.toFixed(1) + '°'; } } }
                },
                plugins: {
                    legend: { display: false },
                    title: {
                        display: true,
                        text: `Lokasi: ${lat.toFixed(3)}, ${lon.toFixed(3)}`,
                        padding: { top: 5, bottom: 10 },
                        font: { size: 12, weight: 'normal' }
                    }
                }
            }
        });
    }
    // --- LEGENDA ---
    var legend = L.control({position: 'bottomright'});
    legend.onAdd = function (map) {
        var div = L.DomUtil.create('div', 'info legend'),
            grades = colorScale.domain(),
            labels = ['<strong>Suhu Laut (°C)</strong>'];
        for (var i = 0; i < 5; i++) {
            var value = grades[0] + (grades[1] - grades[0]) * i / 4;
            labels.push('<i style="background:' + colorScale(value).hex() + '"></i> ' + value.toFixed(1));
        }
        div.innerHTML = labels.join('<br>');
        return div;
    };

    var baseMaps = {
        "Citra Satelit": satelliteMap,
        "OpenStreetMap": openStreetMap, // <-- Tambahkan ini
        "Gelap (CARTO)": cartoDark,
        "Gelap (Stadia)": stadiaDark // <-- Tambahkan ini
    };

// Buat kontrol layer hanya untuk basemap dan letakkan di kanan atas
    L.control.layers(baseMaps, null, {
        position: 'topleft',
        collapsed: true // Opsi 'true' agar kontrolnya bisa dilipat
    }).addTo(map);
// ==========================================================
// === MENGHUBUNGKAN UI DENGAN PETA ===
// ==========================================================
    let activePopup = null; // Untuk menyimpan objek pop-up yang aktif
    let lastClickedLatLng = null; // Untuk menyimpan koordinat terakhir yang diklik
    let lastClickedYearlyTemps = null; // Untuk menyimpan data suhu tahunan di lokasi itu

    const parameterButtons = document.querySelectorAll('.param-btn');
    const timeSlider = document.getElementById('timeSlider');
    const timeDisplay = document.getElementById('time-display');
    const timeControl = document.querySelector('.time-control');
    const monthLabelsContainer = document.getElementById('monthLabels'); // <-- VARIABEL BARU
    const tickMarksContainer = document.getElementById('tickMarks'); // <-- VARIABEL BARU
    const playPauseBtn = document.getElementById('play-pause-btn');
    let animationInterval = null; // Untuk menyimpan ID interval
    const infoPanel = document.getElementById('infoPanel');
    const infoTitle = document.getElementById('infoTitle');
    const infoDescription = document.getElementById('infoDescription');
    const closeInfoBtn = document.getElementById('closeInfoBtn');
    const displayPanel = document.getElementById('displayPanel');
    const displayTitle = document.getElementById('displayTitle');
    const displayTime = document.getElementById('displayTime');

    // In demo.js
    function updateDisplayPanel() {
        const layerInfo = layerDescriptions[currentActiveLayer];
        if (layerInfo) {
            displayTitle.textContent = layerInfo.title;

            if (currentActiveLayer === 'suhu') {
                displayTime.textContent = monthNames[currentMonthIndex];
            } else {
                // Untuk Arus, Anda bisa menampilkan "Data Real-time" atau tanggal saat ini
                // Untuk sementara kita kosongkan atau beri keterangan umum
                displayTime.textContent = "Visualisasi Arus Laut Kalimantan Tengah";
            }
            displayPanel.classList.remove('hidden');
        } else {
            displayPanel.classList.add('hidden');
        }
    }

// Fungsi untuk mengisi panel dengan teks yang benar
    function updateInfoPanel(layerName) {
        const content = layerDescriptions[layerName];
        infoTitle.textContent = content.title;
        infoDescription.textContent = content.description;
        infoPanel.classList.remove('hidden');
    }
// Fungsi untuk tombol close
    closeInfoBtn.addEventListener('click', () => {
        infoPanel.classList.add('hidden');
    });
    // --- FUNGSI BARU UNTUK KONTROL ANIMASI ---
    function stopAnimation() {
        if (animationInterval) {
            clearInterval(animationInterval);
            animationInterval = null;
            playPauseBtn.innerHTML = '<i class="fas fa-play"></i>';
        }
    }

    function startAnimation() {
        stopAnimation(); // Pastikan tidak ada interval ganda
        playPauseBtn.innerHTML = '<i class="fas fa-pause"></i>';
        animationInterval = setInterval(() => {
            let currentValue = parseInt(timeSlider.value);
        // % 12 akan membuat slider kembali ke 0 setelah mencapai 11
            let nextValue = (currentValue + 1) % 12; 
            timeSlider.value = nextValue;
        // Picu event 'input' secara manual agar peta terupdate
            timeSlider.dispatchEvent(new Event('input', { 'bubbles': true }));
        }, 1000); // Pindah bulan setiap 1 detik (1000 ms)
    }

    // Tambahkan event listener untuk tombol Play/Pause
    playPauseBtn.addEventListener('click', () => {
    // Tombol ini hanya berfungsi jika layer suhu aktif
        if (currentActiveLayer === 'suhu') {
            if (animationInterval) {
                stopAnimation();
            } else {
                startAnimation();
            }
        }
    });

// --- KODE BARU: BUAT PENANDA SECARA DINAMIS ---
    for (let i = 0; i < 12; i++) {
        const tick = document.createElement('div');
        tick.className = 'tick';
        tickMarksContainer.appendChild(tick);
    }
// --- AKHIR KODE BARU ---

// --- KODE BARU: BUAT LABEL BULAN SECARA DINAMIS ---
    const shortMonthNames = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
    shortMonthNames.forEach(month => {
        const label = document.createElement('span');
        label.textContent = month;
        monthLabelsContainer.appendChild(label);
    });
    let currentActiveLayer = 'arus';
    let currentMonthIndex = 0;
    
    // Fungsi untuk update tampilan peta
// Fungsi untuk update tampilan peta
// GANTI TOTAL FUNGSI updateMapLayers DENGAN INI:
// Di demo.js, ganti total fungsi updateMapLayers
        function updateMapLayers() {
            map.closePopup();
            const containerGrafik = document.getElementById('grafik-container');
            
            // ▼▼▼ BARIS KUNCI: Selalu sembunyikan kontainer saat layer berganti ▼▼▼
            containerGrafik.style.display = 'none';

            map.removeLayer(velocityLayer);
            monthlySstLayers.forEach(layer => map.removeLayer(layer));
            map.removeControl(legend);
            
            if (currentActiveLayer === 'arus') {
                map.addLayer(velocityLayer);
                timeControl.style.display = 'none';
                stopAnimation();
            
            } else if (currentActiveLayer === 'suhu') {
                map.addLayer(monthlySstLayers[currentMonthIndex]);
                timeControl.style.display = 'flex';
                legend.addTo(map);
            }

            updateInfoPanel(currentActiveLayer);
            updateDisplayPanel();
        }
        function colorSliderTrack() {
            const value = timeSlider.value;
            const min = timeSlider.min ? timeSlider.min : 0;
            const max = timeSlider.max ? timeSlider.max : 100;
            const percentage = ((value - min) / (max - min)) * 100;

            const color = `linear-gradient(90deg, #007BFF ${percentage}%, #d3d3d3 ${percentage}%)`;
            timeSlider.style.background = color;
        }
    // --- LOGIKA UNTUK SIDEBAR TOGGLE ---
    // Di demo.js, GANTI SEMUA KODE DARI SINI SAMPAI AKHIR FILE

// --- LOGIKA UNTUK SIDEBAR TOGGLE ---
    parameterButtons.forEach(button => {
    button.addEventListener('click', function () {
        stopAnimation();
        parameterButtons.forEach(btn => btn.classList.remove('active'));
        this.classList.add('active');
        
        currentActiveLayer = this.dataset.param;
        console.log('Parameter aktif:', currentActiveLayer);
        
        // Cukup panggil satu fungsi ini, sisanya akan diurus
        updateMapLayers();
    });
}); // <-- Pastikan penutup untuk forEach ini ada di sini

// --- LOGIKA UNTUK TIME SLIDER ---
// GANTI TOTAL BLOK timeSlider.addEventListener(...) ANDA DENGAN INI:

timeSlider.addEventListener('input', function (event) {
    colorSliderTrack();

    if (event.isTrusted) {
        stopAnimation();
    }
    
    const newMonthIndex = parseInt(this.value);
    if (newMonthIndex === currentMonthIndex) { return; }

    currentMonthIndex = newMonthIndex; // Update indeks bulan SEGERA
    
    const newMonthName = monthNames[currentMonthIndex];
    timeDisplay.textContent = 'Bulan: ' + newMonthName;

    // Perbarui layer di peta
    if (currentActiveLayer === 'suhu') {
        // Hapus layer bulan yang lama (cek dulu apakah ada di peta)
        if (map.hasLayer(monthlySstLayers[newMonthIndex === 0 ? 11 : newMonthIndex - 1])) {
             map.removeLayer(monthlySstLayers[newMonthIndex === 0 ? 11 : newMonthIndex - 1]);
        }
        map.removeLayer(monthlySstLayers[currentMonthIndex === 0 ? 11 : currentMonthIndex - 1]);
        map.addLayer(monthlySstLayers[currentMonthIndex]);
    }
    
    // ▼▼▼ LOGIKA BARU UNTUK UPDATE POP-UP ▼▼▼
    if (activePopup && lastClickedLatLng && lastClickedYearlyTemps) {
        const newTemp = lastClickedYearlyTemps[currentMonthIndex];
        const newTempText = newTemp !== null ? `${newTemp.toFixed(1)} °C` : 'N/A';

        const newPopupContent = `
            <div class="popup-header">Info Lokasi</div>
            <div class="popup-body">
                <div class="popup-info-row">
                    <i class="fas fa-water"></i>
                    <span>Suhu Bulan Ini: <strong>${newTempText}</strong></span>
                </div>
                <div class="popup-info-row">
                    <i class="fas fa-map-marker-alt"></i>
                    <span>Lat: ${lastClickedLatLng.lat.toFixed(4)}</span>
                </div>
                <div class="popup-info-row">
                    <i class="fas fa-map-marker-alt" style="opacity:0;"></i>
                    <span>Lon: ${lastClickedLatLng.lng.toFixed(4)}</span>
                </div>
            </div>
        `;
        activePopup.setContent(newPopupContent); // Perbarui konten pop-up
    }
    // ▲▲▲ AKHIR LOGIKA BARU ▲▲▲
    
    updateDisplayPanel();
});
// --- INISIALISASI TAMPILAN AWAL ---
updateMapLayers();
colorSliderTrack();

// AKHIR DARI BLOK Promise.all
}).catch(error => {
    console.error("Gagal memuat atau mem-parsing salah satu file JSON:", error);
});
