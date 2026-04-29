// ==========================================
// 1. LOGIKA UI PANEL & DROPDOWN BASEMAP
// ==========================================
const topBarContent = document.getElementById('top-bar-content');
const toggleTopBtn = document.getElementById('toggle-top-bar');
toggleTopBtn.addEventListener('click', () => { 
    topBarContent.classList.toggle('-translate-y-full'); 
    toggleTopBtn.querySelector('svg').classList.toggle('rotate-180'); 
});

const bottomBarContent = document.getElementById('bottom-bar-content');
const toggleBottomBtn = document.getElementById('toggle-bottom-bar');
toggleBottomBtn.addEventListener('click', () => { 
    bottomBarContent.classList.toggle('translate-y-full'); 
    toggleBottomBtn.querySelector('svg').classList.toggle('rotate-180'); 
});

const layerMenu = document.getElementById('layer-menu');
document.getElementById('btn-layer-menu').addEventListener('click', () => layerMenu.classList.toggle('hidden'));
document.getElementById('btn-close-menu').addEventListener('click', () => layerMenu.classList.add('hidden'));

// TAB SWITCH KANAN ATAS
const tabZonasi = document.getElementById('tab-zonasi'), tabMetOcean = document.getElementById('tab-metocean');
const listZonasi = document.getElementById('parameter-list-zonasi'), listMetOcean = document.getElementById('parameter-list-metocean');

tabZonasi.addEventListener('click', () => { 
    tabZonasi.className = "flex-1 px-4 py-1.5 rounded-full text-xs font-semibold bg-blue-900 text-white shadow-md"; 
    tabMetOcean.className = "flex-1 px-4 py-1.5 rounded-full text-xs font-semibold text-gray-600 hover:bg-gray-200"; 
    listZonasi.classList.remove('hidden'); 
    listMetOcean.classList.add('hidden'); 
});

tabMetOcean.addEventListener('click', () => { 
    tabMetOcean.className = "flex-1 px-4 py-1.5 rounded-full text-xs font-semibold bg-blue-900 text-white shadow-md"; 
    tabZonasi.className = "flex-1 px-4 py-1.5 rounded-full text-xs font-semibold text-gray-600 hover:bg-gray-200"; 
    listMetOcean.classList.remove('hidden'); 
    listZonasi.classList.add('hidden'); 
});

// ==========================================
// 2. INISIALISASI PETA & BASEMAP
// ==========================================
const map = L.map('map', { zoomControl: false, preferCanvas: true }).setView([-2.8, 112.8], 7.2);
// Buat pane khusus agar urutan tumpukan terkontrol
map.createPane('zonasiPane');
map.getPane('zonasiPane').style.zIndex = 600; // Lebih rendah

map.createPane('metoceanPane');
map.getPane('metoceanPane').style.zIndex = 500; // Lebih tinggi (di atas zonasi)
const baseLayers = {
    satellite: L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}', { attribution: 'Esri' }),
    osm: L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { attribution: '© OpenStreetMap' }),
    dark: L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { attribution: '© CARTO' }),
    light: L.tileLayer('https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png', { attribution: '© CARTO' })
};

let currentBasemap = baseLayers.satellite;
currentBasemap.addTo(map);

const btnBasemap = document.getElementById('btn-basemap');
const basemapDropdown = document.getElementById('basemap-dropdown');

btnBasemap.addEventListener('click', () => basemapDropdown.classList.toggle('hidden'));

document.addEventListener('click', (e) => {
    if (!btnBasemap.contains(e.target) && !basemapDropdown.contains(e.target)) {
        basemapDropdown.classList.add('hidden');
    }
});

document.querySelectorAll('.basemap-option').forEach(btn => {
    btn.addEventListener('click', function() {
        const selectedMap = this.getAttribute('data-map');
        map.removeLayer(currentBasemap); 
        currentBasemap = baseLayers[selectedMap]; 
        currentBasemap.addTo(map); 
        basemapDropdown.classList.add('hidden'); 
    });
});

document.getElementById('btn-zoom-in').addEventListener('click', () => map.zoomIn());
document.getElementById('btn-zoom-out').addEventListener('click', () => map.zoomOut());

// ==========================================
// 3. VARIABEL GLOBAL & KONFIGURASI
// ==========================================
let currentZonasiLayer = null;
let velocityLayer = null;
let activeRasterGroup = L.featureGroup().addTo(map);
let activeDataType = null; 
let currentSliderIndex = 0;
let animationInterval = null;
let isPlaying = false; 
let timeChartInstance = null;
let depthChartInstance = null;
let activeZonasiLayers = {}; // Untuk menyimpan banyak layer zonasi (Rule 1)
let currentMetOceanLayer = null; // Untuk kontrol single-select (Rule 2)
let uploadedShpLayers = []; // Wadah untuk menampung semua SHP yang di-upload user

const configs = {
    suhu: { title: "Suhu Air Laut ", scale: chroma.scale(['blue', 'cyan', 'lime', 'yellow', 'red']).domain([27, 32]), min: "27°C", max: "32°C", css: "linear-gradient(to right, blue, cyan, lime, yellow, red)" },
    gelombang: { title: "Tinggi Gelombang (m)", scale: chroma.scale(['#e0f3db', '#43a2ca', '#0868ac']).domain([0, 2]), min: "0m", max: ">2m", css: "linear-gradient(to right, #e0f3db, #43a2ca, #0868ac)" },
    salinitas: { title: "Salinitas Air Laut ", scale: chroma.scale(['#ffffe5', '#41ab5d', '#004529']).domain([25, 35]), min: "25 PSU", max: "35 PSU", css: "linear-gradient(to right, #ffffe5, #41ab5d, #004529)" },
    ssh: { title: "Elevasi Muka Air (SSH)", scale: chroma.scale(['#d53e4f', '#ffffbf', '#3288bd']).domain([-0.5, 0.5]), min: "-0.5m", max: "+0.5m", css: "linear-gradient(to right, #d53e4f, #ffffbf, #3288bd)" },
    arus: { title: "Arus Laut " } , msl: { title: "Tekanan Udara (hPa)", scale: chroma.scale(['#0000ff', '#00ffff', '#00ff00', '#ffff00', '#ff0000']).domain([1005, 1015]), min: "Rendah (1005 hPa)", max: "Tinggi (1015 hPa)", css: "linear-gradient(to right, #0000ff, #00ffff, #00ff00, #ffff00, #ff0000)" },
    hujan: { title: "Akumulasi Curah Hujan (mm)", scale: chroma.scale(['#ffffff', '#00ffff', '#0000ff', '#00008b']).domain([0, 50]), min: "Cerah (0mm)", max: "Lebat (>50mm)", css: "linear-gradient(to right, #ffffff, #00ffff, #0000ff, #00008b)" },
    angin: { title: "Angin 10m (m/s)" }, 
    batimetri: { 
        title: "Kedalaman Dasar Laut (m)", 
        // Warna biru gelap (palung) ke biru pucat (pesisir)
        scale: chroma.scale(['#000b2e', '#08306b', '#2879b9', '#c8ddf0']), 
        // min, max, dan domain tidak di-hardcode lagi di sini, akan kita hitung otomatis!
        css: "linear-gradient(to right, #000b2e, #08306b, #2879b9, #c8ddf0)" 
    },
};

// ==========================================
// 4. LOGIKA WAKTU (TIME SLIDER)
// ==========================================
const hourlyDates = [];
const today = new Date();
today.setHours(7, 0, 0, 0); // Mulai dari 00:00

const shortMonths = ["Jan", "Feb", "Mar", "Apr", "Mei", "Jun", "Jul", "Agu", "Sep", "Okt", "Nov", "Des"];
const days = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];

for (let i = 0; i < 240; i++) { 
    let nextHour = new Date(today.getTime() + (i * 60 * 60 * 1000));
    let dayName = days[nextHour.getDay()];
    let dayDate = nextHour.getDate();
    let month = shortMonths[nextHour.getMonth()];
    let hour = nextHour.getHours().toString().padStart(2, '0');
    hourlyDates.push(`${dayName} ${dayDate} - ${hour}:00`);
}

let labelHTML = '';
let uniqueDays = [];
hourlyDates.forEach(dateStr => {
    let dayPart = dateStr.split(' - ')[0]; 
    if (!uniqueDays.includes(dayPart)) uniqueDays.push(dayPart);
});

uniqueDays.forEach(day => {
    labelHTML += `<div class="flex-1 text-center border-r border-blue-700/50 text-[10px] font-medium py-1 text-blue-200 hover:bg-white/10 transition">${day}</div>`;
});
document.getElementById('monthLabels').innerHTML = labelHTML;

const timeSlider = document.getElementById('timeSlider');
const sliderTooltip = document.getElementById('slider-tooltip');

function updateTooltipPosition() {
    let val = parseInt(timeSlider.value);
    let min = parseInt(timeSlider.min) || 0;
    let max = parseInt(timeSlider.max) || 239;
    let percent = ((val - min) / (max - min)) * 100;
    sliderTooltip.style.left = `calc(${percent}% + (${8 - percent * 0.15}px))`;
    sliderTooltip.textContent = hourlyDates[val];
}
updateTooltipPosition();

// ==========================================
// 4B. SINKRONISASI SLIDER KE WAKTU SAAT INI
// ==========================================
function syncSliderToCurrentTime() {
    const now = new Date();
    // Hitung selisih jam dari jam 00:00 hari ini
    const diffTime = now.getTime() - today.getTime();
    const diffHours = Math.floor(diffTime / (1000 * 60 * 60)); 
    
    // Pastikan batasnya ada di antara 0 sampai 239 (10 hari)
    if (diffHours >= 0 && diffHours <= 239) {
        timeSlider.value = diffHours;
        currentSliderIndex = diffHours;
        updateTooltipPosition();
    }
}
// Jalankan fungsi saat web pertama dimuat
syncSliderToCurrentTime();

// ==========================================
// 5. LOGIKA KEDALAMAN (INPUT MANUAL & LIMIT 92.33m)
// ==========================================
let depthLevels = [0]; 
const depthSlider = document.getElementById('depthSlider');
const depthContainer = document.getElementById('depth-container');

// Merombak UI: Mengganti teks statis '0 m' menjadi kotak Input Angka
const depthValSpan = document.getElementById('depthVal');
if (depthValSpan && depthValSpan.tagName !== 'DIV') { 
    const parent = depthValSpan.parentNode;
    parent.innerHTML = `
        <div class="flex justify-center items-center gap-1 mt-1" id="depthVal">
            <input type="number" id="depthInputManual" value="0" min="0" max="92.33" step="0.1" class="w-16 px-1 py-0.5 border border-blue-300 rounded text-center outline-none focus:ring-2 focus:ring-blue-500 text-blue-700 font-bold bg-white shadow-inner">
            <span class="text-blue-900 text-xs font-bold">m</span>
        </div>
    `;
}
const depthInputManual = document.getElementById('depthInputManual');

if(depthContainer) {
    L.DomEvent.disableClickPropagation(depthContainer);
    L.DomEvent.disableScrollPropagation(depthContainer);
}

async function loadRealDepths() {
    try {
        const res = await fetch('https://api-webgis-kalteng.onrender.com/api/depths');
        const data = await res.json();
        
        // KUNCI UTAMA: Potong (Filter) data API yang turun dari Python agar tidak lewat 92.33m
        depthLevels = data.depths.filter(d => d <= 92.33); 
        
        if (depthSlider) {
            depthSlider.max = depthLevels.length - 1;
            const maxLabel = document.getElementById('maxDepthLabel');
            // Kunci tulisan ujung kanan slider
            if (maxLabel) maxLabel.textContent = "92.3m"; 
        }
    } catch (e) {
        console.error("Gagal membaca kedalaman asli:", e);
        depthLevels = [0, 5, 10, 20, 30, 40, 50, 75, 92.33]; // Angka darurat
        if (depthSlider) depthSlider.max = depthLevels.length - 1;
    }
}
loadRealDepths();

if (depthSlider && depthInputManual) {
    // Aksi 1: Saat bulatan slider ditarik/digeser
    depthSlider.addEventListener('input', (e) => { 
        let idx = parseInt(e.target.value);
        depthInputManual.value = depthLevels[idx]; 
    });
    
    depthSlider.addEventListener('change', () => { 
        if(activeDataType) renderActiveLayer(parseInt(timeSlider.value)); 
    });

    // Aksi 2: Saat user mengetik angka manual di kotak input
    depthInputManual.addEventListener('change', (e) => {
        let val = parseFloat(e.target.value);
        
        // KUNCI ANTI JEBOL: Tampilkan peringatan jika user ketik angka > 92.33
        if (val > 92.33) { 
            alert("Batas maksimal kedalaman untuk perairan Kalimantan Tengah ini adalah 92.33 meter!"); 
            val = 92.33; 
        } else if (val < 0 || isNaN(val)) { 
            val = 0; 
        }

        // Cari lapisan (layer array) terdekat dengan angka ketikan user
        let closestIdx = 0, minDiff = Infinity;
        for (let i = 0; i < depthLevels.length; i++) {
            let diff = Math.abs(depthLevels[i] - val);
            if (diff < minDiff) { minDiff = diff; closestIdx = i; }
        }
        
        // Kembalikan angka ke dalam kotak dan sinkronkan posisi slider
        depthInputManual.value = depthLevels[closestIdx];
        depthSlider.value = closestIdx;
        
        // Langsung gambar ulang petanya!
        if(activeDataType) renderActiveLayer(parseInt(timeSlider.value));
    });
}

// 1. Definisi Warna Berdasarkan Nama Zonasi
// --- KAMUS WARNA & GAYA UNTUK SEMUA ZONASI ---
const styleZonasi = {
    // 1. ZONASI KKP (Dominan Hijau, Biru, & Kuning)
    "Pencadangan/indikasi kawasan konservasi": { fillColor: "#2ecc71", color: "#27ae60", weight: 1, fillOpacity: 0.6 },
    "Taman": { fillColor: "#27ae60", color: "#1e8449", weight: 1, fillOpacity: 0.6 },
    "Kawasan Konservasi Lainnya": { fillColor: "#1abc9c", color: "#117864", weight: 1, fillOpacity: 0.6 },
    "Zona Pariwisata": { fillColor: "#f1c40f", color: "#d4ac0d", weight: 1, fillOpacity: 0.6 },
    "Zona Perikanan Tangkap": { fillColor: "#3498db", color: "#21618c", weight: 1, fillOpacity: 0.6 },
    "Zona Perikanan Budidaya": { fillColor: "#2980b9", color: "#154360", weight: 1, fillOpacity: 0.6 },
    "Zona Pelabuhan Laut": { fillColor: "#34495e", color: "#2c3e50", weight: 1, fillOpacity: 0.7 },
    "Zona Pelabuhan Perikanan": { fillColor: "#5dade2", color: "#2874a6", weight: 1, fillOpacity: 0.7 },

    // 2. ZONA KKP FEB 2019 (Inti = Merah, Pemanfaatan = Oranye)
    "Zona Inti": { fillColor: "#e74c3c", color: "#943126", weight: 2, fillOpacity: 0.7 },
    "Zona Pemanfaatan": { fillColor: "#e67e22", color: "#a04000", weight: 1, fillOpacity: 0.6 },
    "Zona Perikanan Berkelanjutan": { fillColor: "#9b59b6", color: "#633974", weight: 1, fillOpacity: 0.6 },
    "Zona Lainnya": { fillColor: "#bdc3c7", color: "#7f8c8d", weight: 1, fillOpacity: 0.5 },

    // 3. TRANSPORTASI & PELABUHAN (Nuansa Abu-abu/Infrastruktur)
    "Pangkalan Pendaratan Ikan": { fillColor: "#95a5a6", color: "#616a6b", weight: 1, fillOpacity: 0.7 },
    "Pelabuhan Pengumpul": { fillColor: "#7f8c8d", color: "#4d5656", weight: 1, fillOpacity: 0.7 },
    "Pelabuhan Pengumpan": { fillColor: "#b2babb", color: "#717d7e", weight: 1, fillOpacity: 0.7 },
    "Terminal Umum": { fillColor: "#839192", color: "#515a5a", weight: 1, fillOpacity: 0.7 },
    "Terminal Khusus": { fillColor: "#515a5a", color: "#273746", weight: 1, fillOpacity: 0.7 },

    // 4. ALUR PELAYARAN (Garis Tebal, Tanpa Fill)
    "Alur-Pelayaran Masuk Pelabuhan": { color: "#d35400", weight: 4, fillOpacity: 0 },
    "Alur-Pelayaran Sungai dan Alur-Pelayaran Danau": { color: "#e67e22", weight: 3, fillOpacity: 0, dashArray: "5, 5" },
    "Alur-Pelayaran Umum dan Perlintasan": { color: "#c0392b", weight: 4, fillOpacity: 0 },

    // 5. INFRASTRUKTUR BAWAH LAUT (Kabel & Migas)
    "Jaringan Minyak dan Gas Bumi": { fillColor: "#de1b11", color: "#f39c12", weight: 2, fillOpacity: 0.6},
    "Jaringan Tetap": { fillColor: "#d5d515", color: "#d5bf11", weight: 2, fillOpacity: 0.6 },

    // 6. MIGRASI BIOTA (Garis Putus-putus/Bebas)
    "Biota Laut": { color: "#00b894", weight: 4, fillOpacity: 0, dashArray: "10, 10" },
    "Migrasi Mamalia Laut": { color: "#0984e3", weight: 4, fillOpacity: 0, dashArray: "15, 10, 5, 10" }
};

// 2. Fungsi Detektif Pintar untuk Sidebar
function showDetail(props) {
    const sidebar = document.getElementById('detail-sidebar');
    const content = document.getElementById('sidebar-content');
    sidebar.classList.remove('-translate-x-[120%]');

    // DETEKTIF KATEGORI: Cari value mana yang ada di dalam kamus warna 'styleZonasi'
    let kategoriKawasan = 'Zonasi Pesisir';
    const keys = Object.keys(props);
    for(let key of keys) {
        if (styleZonasi[props[key]]) {
            kategoriKawasan = props[key];
            break;
        }
    }

    // DETEKTIF NAMA: Ambil nama dari kolom yang BUKAN merupakan nama kategori
    let namaKawasan = 'Tanpa Nama Spesifik';
    if (props.NAMOBJ && props.NAMOBJ !== kategoriKawasan) namaKawasan = props.NAMOBJ;
    else if (props.Toponimi && props.Toponimi !== kategoriKawasan) namaKawasan = props.Toponimi;
    else if (props.NAMA && props.NAMA !== kategoriKawasan) namaKawasan = props.NAMA;
    else if (props.REMARK && props.REMARK !== kategoriKawasan) namaKawasan = props.REMARK;
    
    let luasKawasan = props.LUASHA || props.Luas_ha || props.LUAS || props.Shape_Area || 0;
    if (typeof luasKawasan === 'number') luasKawasan = luasKawasan.toFixed(2); 
    
    let dasarHukum = props.DSR_HKM || props.SBDATA || props.KETERANGAN || 'Perda RZWP-3-K / Data Spasial Nasional';

    content.innerHTML = `
        <div class="border-b pb-2 mb-3 border-blue-100">
            <label class="text-[10px] font-bold text-blue-900 uppercase tracking-wider">Kategori / Zonasi</label>
            <p class="text-sm font-extrabold text-blue-700 bg-blue-50 inline-block px-2 py-1 rounded mt-1">${kategoriKawasan}</p>
        </div>
        <div>
            <label class="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Nama Lokasi / Objek</label>
            <p class="text-sm font-bold text-gray-800 leading-tight">${namaKawasan}</p>
        </div>
        <div class="mt-3">
            <label class="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Luas Area</label>
            <p class="text-xs font-semibold text-gray-700">${luasKawasan} Ha</p>
        </div>
        <div class="pt-2 border-t border-gray-100 mt-3">
            <label class="text-[10px] font-bold text-gray-500 uppercase tracking-wider">Sumber / Keterangan Ekstra</label>
            <p class="text-[11px] text-gray-600 leading-relaxed italic">${dasarHukum}</p>
        </div>
    `;
}

function closeSidebar() {
    document.getElementById('detail-sidebar').classList.add('-translate-x-[120%]');
}

// ==========================================
// 6. FUNGSI RENDER PETA (API BACKEND)
// ==========================================
async function renderActiveLayer(dayIndex) {
    activeRasterGroup.clearLayers();
    if (velocityLayer) { map.removeLayer(velocityLayer); velocityLayer = null; }
    if (!activeDataType) return;

    const originalTimeText = hourlyDates[dayIndex];
    document.getElementById('displayTime').textContent = "Memuat data 3D...";

    try {
        // --- 1. MENENTUKAN URL DATA ---
        let url = `https://api-webgis-kalteng.onrender.com/api/${activeDataType}`;
        
        // Data MetOcean pakai jam, Batimetri tidak pakai
        if (activeDataType !== 'batimetri') {
            url += `/${dayIndex}`;
        }
        
        if (['suhu', 'salinitas', 'arus'].includes(activeDataType) && depthLevels.length > 1) {
            if (depthContainer) depthContainer.classList.remove('hidden');
            if (depthSlider) url += `/${depthSlider.value}`; 
        } else {
            if (depthContainer) depthContainer.classList.add('hidden');
        }

        // --- 2. DOWNLOAD DATA DARI BACKEND ---
        const response = await fetch(url);
        const dayData = await response.json();

        // --- 3. LOGIKA KHUSUS BATIMETRI & SEMBUNYIKAN SLIDER ---
        let timeSliderContainer = document.getElementById('bottom-bar-container');
        
        if (activeDataType === 'batimetri') {
            // Sembunyikan slider waktu saat klik batimetri
            if (timeSliderContainer) timeSliderContainer.classList.add('hidden');

            // Hitung min & max dari data yang baru didownload
            let validDepths = dayData.zs.filter(v => v !== null);
            let minDepth = Math.floor(Math.min(...validDepths));
            let maxDepth = Math.ceil(Math.max(...validDepths));
            
            let dynamicScale = chroma.scale(['#041e42', '#08306b', '#2879b9', '#73b3d8', '#c8ddf0']).domain([minDepth, maxDepth]);
            configs['batimetri'].scale = dynamicScale;
            configs['batimetri'].min = `${minDepth} m`;
            configs['batimetri'].max = `${maxDepth} m`;
        } else {
            // Tampilkan kembali slider waktu untuk data lainnya
            if (timeSliderContainer) timeSliderContainer.classList.remove('hidden');
        }

        // --- 4. RENDER KE PETA (ARUS ATAU RASTER) ---
        if (activeDataType === 'arus' || activeDataType === 'angin') {
            document.getElementById('legenda-container').classList.add('hidden');
            let isAngin = (activeDataType === 'angin');
            velocityLayer = L.velocityLayer({
                displayValues: true, 
                displayOptions: { 
                    velocityType: isAngin ? 'Angin 10m' : 'Arus Laut', 
                    position: 'bottomleft', 
                    speedUnit: 'm/s' 
                },
                data: dayData, 
                maxVelocity: isAngin ? 15.0 : 0.8,
                velocityScale: isAngin ? 0.005 : 0.1,
                colorScale: isAngin ? ["#ffffb2", "#fd8d3c", "#f03b20", "#bd0026"] : ["#ffffff", "#e0e0e0"]
            }).addTo(map);
        } else {
            // Render raster warna (Suhu, Batimetri, dsb)
            const conf = configs[activeDataType];
            document.getElementById('legenda-container').classList.remove('hidden');
            document.getElementById('legenda-warna').style.background = conf.css;
            document.getElementById('legenda-min').textContent = conf.min;
            document.getElementById('legenda-max').textContent = conf.max;

            // ... (Kodingan untuk menggambar Rectangle/kotak-kotak raster tetap ada di sini)
            const nx = dayData.nx, ny = dayData.ny;
            const lo1 = dayData.lo1, la1 = dayData.la1;
            const dx = dayData.dx, dy = dayData.dy;
            const zs = dayData.zs;

            window.currentGridData = { nx, ny, lo1, la1, dx, dy, zs };

            for (let j = 0; j < ny; j++) {
                for (let i = 0; i < nx; i++) {
                    const idx = j * nx + i;
                    const val = zs[idx];
                    if (val !== null && val !== undefined) {
                        const lat = la1 - j * dy;
                        const lon = lo1 + i * dx;
                        const bounds = [[lat - dy / 2, lon - dx / 2], [lat + dy / 2, lon + dx / 2]];
                        const color = conf.scale(val).hex();
                        
                        let rect = L.rectangle(bounds, {
                            color: color,
                            weight: 0,
                            fillColor: color,
                            fillOpacity: 0.8,
                            interactive: true
                        });
                        
                        // Titipkan data ke dalam kotak ini (untuk radar klik)
                        rect.metoceanVal = val;
                        rect.metoceanTitle = conf.title;
                        
                        // KUNCI: .bindTooltip() sudah dihapus, langsung masukkan ke grup peta!
                        rect.addTo(activeRasterGroup);
                    }
                }
            }
        }
        
        // Kembalikan teks waktu sesuai aslinya
        document.getElementById('displayTime').textContent = originalTimeText;

    } catch (err) {
        console.error("Gagal memuat data lapisan:", err);
        document.getElementById('displayTime').textContent = "Error memuat data";
    }
}
// ==========================================
// 7. KLIK MENU METOCEAN & ZONASI
// ==========================================
const metoceanItems = document.querySelectorAll('.metocean-item');
const zonasiItems = document.querySelectorAll('.zonasi-item');

// --- A. AUTO-TAMBAH CHECKBOX KE MENU (Biar ga repot edit HTML) ---
document.querySelectorAll('.zonasi-item, .metocean-item').forEach(item => {
    const textSpan = item.querySelector('span.text-xs');
    const cb = document.createElement('input');
    cb.type = 'checkbox';
    cb.className = 'mr-2 w-3.5 h-3.5 text-blue-600 bg-gray-100 border-gray-300 rounded pointer-events-none';
    textSpan.parentNode.insertBefore(cb, textSpan);
});

// ==========================================
// FUNGSI SAPU JAGAT (RESET SEMUA LAYER)
// ==========================================
function matikanSemuaLayer() {
    // 1. Tutup semua Sidebar
    if (typeof closeSidebar === 'function') closeSidebar();
    if (typeof closeMetOceanSidebar === 'function') closeMetOceanSidebar();

    // 2. Normalkan kembali semua menu & hilangkan abu-abu
    document.querySelectorAll('.metocean-item, .ekstra-item').forEach(item => {
        item.classList.replace('bg-yellow-100', 'bg-gray-100');
        item.classList.remove('opacity-40', 'pointer-events-none', 'grayscale');
        const cb = item.querySelector('input[type="checkbox"]');
        if (cb) cb.checked = false;
    });

    // 3. Bersihkan Peta dari Raster & Vektor (Suhu, Arus, dll)
    activeDataType = null;
    if (activeRasterGroup) activeRasterGroup.clearLayers();
    if (velocityLayer) { map.removeLayer(velocityLayer); velocityLayer = null; }

    // 4. Bersihkan Thermal Front
    isThermalFrontActive = false;
    if (thermalFrontLayer) { map.removeLayer(thermalFrontLayer); thermalFrontLayer = null; }

    // 5. Bersihkan Marker Pasang Surut
    isTideActive = false;
    if (typeof tideLayerGroup !== 'undefined') tideLayerGroup.clearLayers();

    // 6. Matikan UI Ekstra
    if (isPlaying) stopAnimation();
    document.getElementById('legenda-container').classList.add('hidden');
    document.getElementById('displayPanel').classList.add('hidden');
    const depthCont = document.getElementById('depth-container');
    if (depthCont) depthCont.classList.add('hidden');
}

// --- B. LOGIKA METOCEAN (SINGLE SELECT) ---
metoceanItems.forEach(item => {
    item.addEventListener('click', function() {
        const type = this.getAttribute('data-type');
        const cb = this.querySelector('input[type="checkbox"]');
        const isCurrentlyChecked = cb ? cb.checked : false; // Ingat status sblm direset

        // 1. BERSIHKAN SEMUANYA!
        matikanSemuaLayer();

        // 2. Nyalakan parameter ini HANYA jika sebelumnya dia mati
        if (!isCurrentlyChecked) {
            activeDataType = type; 
            if (cb) cb.checked = true;
            this.classList.replace('bg-gray-100', 'bg-yellow-100');
            
            // --- KUNCI: BIKIN MENU LAIN JADI ABU-ABU MATI ---
            document.querySelectorAll('.metocean-item, .ekstra-item').forEach(otherItem => {
                if (otherItem !== this) { // Jika bukan tombol yang sedang diklik ini
                    otherItem.classList.add('opacity-40', 'pointer-events-none', 'grayscale');
                }
            });

            // Nyalakan UI Judul
            document.getElementById('displayPanel').classList.remove('hidden');
            document.getElementById('displayTitle').textContent = configs[type].title;
            document.getElementById('displayTime').textContent = `Prakiraan: ${hourlyDates[currentSliderIndex]}`;
            
            // Gambar Petanya!
            renderActiveLayer(currentSliderIndex);
        }
    });
});

// --- C. LOGIKA ZONASI (MULTI-SELECT CEKLIS) ---
zonasiItems.forEach(item => {
    item.addEventListener('click', function() {
        const fileName = this.getAttribute('data-file');
        const layerName = this.getAttribute('data-name');
        const cb = this.querySelector('input[type="checkbox"]');

        closeMetOceanSidebar();

        // Jika layer sudah aktif, MATIKAN
        if (activeZonasiLayers[fileName]) {
            map.removeLayer(activeZonasiLayers[fileName]); 
            delete activeZonasiLayers[fileName]; 
            this.classList.replace('bg-yellow-100', 'bg-gray-100'); 
            cb.checked = false; // Hapus Ceklis
            
            if (Object.keys(activeZonasiLayers).length === 0 && !activeDataType) {
                document.getElementById('displayPanel').classList.add('hidden');
            }
        } 
        // Jika layer belum aktif, NYALAKAN
        else {
            this.classList.replace('bg-gray-100', 'bg-yellow-100'); 
            cb.checked = true; // Tambah Ceklis
            
            fetch(fileName).then(res => res.json()).then(data => {
                const layer = L.geoJSON(data, {
                    pane: 'zonasiPane',
                    style: function(feature) {
                        let p = feature.properties;
                        let kategoriMatch = null;
                        for(let key of Object.keys(p)) {
                            if (styleZonasi[p[key]]) { kategoriMatch = p[key]; break; }
                        }
                        return kategoriMatch ? styleZonasi[kategoriMatch] : { fillColor: "#ffffff", color: "#666", weight: 1, fillOpacity: 0.3 };
                    },
                    onEachFeature: (feature, layer) => {
                        layer.on('click', function(e) {
                            L.DomEvent.stopPropagation(e);
                            Object.values(activeZonasiLayers).forEach(l => l.resetStyle());
                            layer.setStyle({ weight: 4, color: '#ffff00', fillOpacity: 0.9 });

                            // PANGGIL MESIN SIDEBAR GABUNGAN
                            if (typeof buildUnifiedSidebar === 'function') {
                                buildUnifiedSidebar(e.latlng.lat, e.latlng.lng, feature.properties);
                            }
                        });
                    }
                }).addTo(map);
                
                activeZonasiLayers[fileName] = layer;
                map.fitBounds(layer.getBounds());
                document.getElementById('displayTitle').textContent = layerName + " (Statis)";
                document.getElementById('displayPanel').classList.remove('hidden');
                
            }).catch(err => {
                console.error("Gagal memuat file:", err);
                alert("Gagal memuat file: " + fileName);
                this.classList.replace('bg-yellow-100', 'bg-gray-100'); 
                cb.checked = false; // Batalkan ceklis jika gagal/error
            });
        }
    });
});

// ==========================================
// 8. LOGIKA PLAY & SLIDER WAKTU
// ==========================================
timeSlider.addEventListener('input', function() {
    currentSliderIndex = parseInt(this.value);
    updateTooltipPosition();

    if (activeDataType) {
        document.getElementById('displayTime').textContent = `Prakiraan: ${hourlyDates[currentSliderIndex]}`;
        renderActiveLayer(currentSliderIndex);
    }
    // KUNCI: Panggil update Thermal Front jika sedang aktif
    if (isThermalFrontActive) {
        renderThermalFront(currentSliderIndex);
    }
});

const playPauseBtn = document.getElementById('play-pause-btn');

function stopAnimation() {
    clearInterval(animationInterval);
    isPlaying = false;
    playPauseBtn.innerHTML = `<svg class="w-8 h-8" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clip-rule="evenodd"></path></svg>`;
}

function startAnimation() {
    isPlaying = true;
    playPauseBtn.innerHTML = `<svg class="w-8 h-8" fill="currentColor" viewBox="0 0 20 20"><path fill-rule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm4 0a1 1 0 012 0v4a1 1 0 11-2 0V8z" clip-rule="evenodd"></path></svg>`;
    animationInterval = setInterval(() => {
        let currentVal = parseInt(timeSlider.value);
        let nextVal = (currentVal >= 239) ? 0 : currentVal + 1; 
        timeSlider.value = nextVal;
        timeSlider.dispatchEvent(new Event('input')); 
    }, 1500); 
}

// Ganti event listener playPauseBtn di app.js kamu
playPauseBtn.addEventListener('click', () => {
    // Izinkan Play jika ada MetOcean AKTIF atau Thermal Front AKTIF
    if (!activeDataType && !isThermalFrontActive) { 
        alert("Pilih parameter MetOcean atau Alat Analisis dulu di menu kanan atas ya!"); 
        return; 
    }
    
    // Munculkan panel judul jika hanya Thermal Front yang dimainkan
    if (!activeDataType && isThermalFrontActive) {
        document.getElementById('displayPanel').classList.remove('hidden');
        document.getElementById('displayTitle').textContent = "Thermal Front Tracker";
    }

    isPlaying ? stopAnimation() : startAnimation();
});
// ==========================================
// 9. LOGIKA SIDEBAR KIRI GABUNGAN & DUA GRAFIK
// ==========================================
const detailSidebar = document.getElementById('detail-sidebar');
const sidebarContent = document.getElementById('sidebar-content');

// 1. Radar Matematika
function getMetOceanDataMath(lat, lon) {
    if (!activeDataType || !window.currentGridData) return null;
    let grid = window.currentGridData;
    let i = Math.round((lon - grid.lo1) / grid.dx);
    let j = Math.round((grid.la1 - lat) / grid.dy);
    
    if (i >= 0 && i < grid.nx && j >= 0 && j < grid.ny) {
        let idx = j * grid.nx + i;
        let val = grid.zs[idx];
        if (val !== null && val !== undefined) {
            return { val: val, type: activeDataType, title: configs[activeDataType].title };
        }
    }
    return null;
}

// 2. Mesin Pembangun Sidebar (DENGAN LOGIKA PENYARINGAN KEDALAMAN)
window.buildUnifiedSidebar = async function(lat, lon, zonasiProps = null) {
    detailSidebar.classList.remove('-translate-x-[120%]'); 
    let html = '';

    if (zonasiProps) {
        let kategori = 'Zonasi Pesisir', nama = 'Tanpa Nama Spesifik';
        for (let key of Object.keys(zonasiProps)) { if (styleZonasi[zonasiProps[key]]) { kategori = zonasiProps[key]; break; } }
        if (zonasiProps.NAMOBJ && zonasiProps.NAMOBJ !== kategori) nama = zonasiProps.NAMOBJ;
        
        let luas = zonasiProps.LUASHA || zonasiProps.Luas_ha || 0;
        html += `
            <div class="border-b pb-2 mb-3 border-blue-100">
                <label class="text-[10px] font-bold text-blue-900 uppercase">Kategori</label>
                <p class="text-sm font-extrabold text-blue-700 bg-blue-50 inline-block px-2 py-1 rounded mt-1">${kategori}</p>
            </div>
            <div class="mb-3 border-b border-gray-100 pb-3">
                <label class="text-[10px] font-bold text-gray-500 uppercase">Nama Lokasi</label>
                <p class="text-sm font-bold text-gray-800 leading-tight">${nama}</p>
                <p class="text-xs text-gray-600 font-semibold mt-1">Luas: ${typeof luas === 'number' ? luas.toFixed(2) : luas} Ha</p>
            </div>
        `;
    }

    let moData = getMetOceanDataMath(lat, lon);
    if (moData) {
        let unit = moData.type === 'batimetri' ? ' m' : '';
        html += `
            <div>
                <label class="text-[10px] font-bold text-blue-900 uppercase">MetOcean Saat Ini</label>
                <div class="text-xs text-gray-800 bg-yellow-50 p-2 rounded border border-yellow-200 mt-1 mb-3">
                    <b>${moData.title}</b><br>
                    Nilai: <span class="text-blue-700 font-extrabold">${moData.val.toFixed(2)}${unit}</span> di ${Math.abs(lat).toFixed(3)}°S, ${lon.toFixed(3)}°E
                </div>
        `;
        
        // WADAH GRAFIK TIME SERIES & KEDALAMAN (Muncul untuk semua kecuali batimetri)
        if (moData.type !== 'batimetri') {
            html += `
                <div class="mt-3">
                    <div class="flex justify-between items-center">
                        <label class="text-[9px] font-bold text-gray-500 uppercase">Prakiraan 10 Hari (Time Series)</label>
                        <a href="https://api-webgis-kalteng.onrender.com/api/export-csv?lat=${lat}&lon=${lon}&param=${moData.type}&mode=timeseries" target="_blank" class="text-[9px] bg-green-600 text-white px-2 py-0.5 rounded hover:bg-green-700 transition cursor-pointer flex items-center gap-1 shadow-sm">📥 CSV</a>
                    </div>
                    <div class="relative h-28 w-full mt-1 bg-white border border-gray-100 rounded shadow-inner"><canvas id="chartTimeSeries"></canvas></div>
                </div>
            `;
            
            // HANYA MUNCUL JIKA DATANYA 3D (Suhu, Salinitas, Arus)
            if (['suhu', 'salinitas', 'arus'].includes(moData.type)) {
                html += `
                    <div class="mt-3 border-t border-gray-100 pt-3">
                        <div class="flex justify-between items-center">
                            <label class="text-[9px] font-bold text-gray-500 uppercase">Profil Kedalaman (Data Asli API)</label>
                            <a href="https://api-webgis-kalteng.onrender.com/api/export-csv?lat=${lat}&lon=${lon}&param=${moData.type}&mode=depth" target="_blank" class="text-[9px] bg-green-600 text-white px-2 py-0.5 rounded hover:bg-green-700 transition cursor-pointer flex items-center gap-1 shadow-sm">📥 CSV</a>
                        </div>
                        <div class="relative h-48 w-full mt-1 bg-white border border-gray-100 rounded shadow-inner flex items-center justify-center">
                            <span id="loading-depth" class="text-xs text-blue-600 font-bold animate-pulse">Menghubungkan API...</span>
                            <canvas id="chartDepth" class="hidden w-full h-full"></canvas>
                        </div>
                    </div>
                `;
            }
        }
        
        // KUNCI PERBAIKAN 2: Tampilkan Info Literatur Batnas jika yang diklik Batimetri
        if (moData.type === 'batimetri') {
             html += `
                <div class="mt-4 p-4 bg-blue-50 rounded-lg border-l-4 border-blue-600 shadow-sm">
                    <h4 class="text-xs font-bold text-blue-900 uppercase mb-2">Informasi Batimetri Dasar Laut</h4>
                    <div class="text-[11px] leading-relaxed text-gray-700 text-justify space-y-2">
                        <p>Data batimetri ini bersumber dari <b>Batnas (Batimetri Nasional)</b> yang dirilis oleh Badan Informasi Geospasial (BIG).</p>
                        <p>Batnas memiliki resolusi spasial 6 arc-second (sekitar 180 meter), yang merupakan penggabungan data hasil survei pemeruman dengan data altimetri satelit, menjadikannya sebagai salah satu basis data dasar laut paling akurat untuk perairan dangkal dan pesisir wilayah Indonesia.</p>
                    </div>
                </div>
            `;
        }
        
        html += `</div>`;
    }

    if (typeof isThermalFrontActive !== 'undefined' && isThermalFrontActive) {
        html += `
            <div class="mt-4 p-4 bg-blue-50 rounded-lg border-l-4 border-blue-600 shadow-sm">
                <h4 class="text-xs font-bold text-blue-900 uppercase mb-2">Informasi Thermal Front</h4>
                <div class="text-[11px] leading-relaxed text-gray-700 text-justify space-y-2">
                    <p>Thermal front merupakan zona yang menggambarkan wilayah dengan gradien temperatur, baik secara horizontal (Sholva et al., 2013) maupun vertikal (Belkin dan Cornillon, 2003).</p>
                    <p>Zona ini terbentuk di perairan yang memiliki perbedaan suhu mencolok dengan daerah sekitarnya, dengan kisaran perbedaan sekitar 0,5°C dalam jarak 3 km (Simbolon et al., 2013). Zona ini juga tergolong dalam zona konvergensi massa air yang kaya akan nutrien, klorofil-a, fitoplankton, dan zooplankton, sehingga berperan penting dalam meningkatkan produktivitas perairan (Valvanis et al., 2005; Sholva et al., 2013).</p>
                    <p>Identifikasi thermal front sangat krusial bagi zona penangkapan ikan karena area ini merupakan zona konvergensi massa air. Kandungan nutrien yang tinggi menarik berbagai organisme laut, termasuk ikan-ikan pelagis yang sering menjadi target perikanan. Selain itu, perbedaan suhu yang mencolok di zona ini menciptakan kondisi lingkungan yang mendukung keberagaman dan konsentrasi ikan dalam jumlah besar.</p>
                </div>
            </div>
        `;
    }

    if (!zonasiProps && !moData && !isThermalFrontActive) {
        html += `<p class="text-gray-400 text-xs italic">Data tidak ditemukan di koordinat ini.</p>`;
    }

    sidebarContent.innerHTML = html;

// --- C. GAMBAR GRAFIK TIME SERIES (DATA ASLI) ---
    if (moData && moData.type !== 'batimetri') {
        
        // 1. Kosongkan kanvas dan tampilkan indikator loading
        const tsCanvasContainer = document.getElementById('chartTimeSeries').parentNode;
        tsCanvasContainer.innerHTML = '<span id="loading-ts" class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-[10px] text-blue-600 font-bold animate-pulse">Menarik data 10 Hari...</span><canvas id="chartTimeSeries" class="w-full h-full"></canvas>';

        try {
            // 2. Cek apakah layer butuh index kedalaman (3D)
            let depthParam = '';
            if (['suhu', 'salinitas', 'arus'].includes(moData.type)) {
                const dSlider = document.getElementById('depthSlider');
                if (dSlider) depthParam = `&depth_index=${dSlider.value}`;
            }

            // 3. Tarik data asli dari Backend!
            const tsRes = await fetch(`https://api-webgis-kalteng.onrender.com/api/timeseries?lat=${lat}&lon=${lon}&param=${moData.type}${depthParam}`);
            const tsData = await tsRes.json();

            // 4. Hapus tulisan loading
            const loadingEl = document.getElementById('loading-ts');
            if (loadingEl) loadingEl.remove();

                if (!tsData.error && tsData.values) {
                    let labelsTime = [];
                    let dataTime = [];
                    
                    // 1. MASUKKAN TEKS WAKTU SECARA UTUH TERLEBIH DAHULU
                    if (tsData.values.length <= 15) {
                        // Data Copernicus (Suhu, Arus, Salinitas)
                        for (let i = 0; i < tsData.values.length; i++) {
                            let hourIndex = Math.min(i * 24, 239);
                            labelsTime.push(hourlyDates[hourIndex]); // Biarkan utuh misal: "Rab 29 - 07:00"
                            dataTime.push(tsData.values[i]);
                        }
                    } else {
                        // Data ECMWF (Hujan, MSL, Angin)
                        let currentHour = 0;
                        for (let i = 0; i < tsData.values.length; i++) {
                            let safeHour = Math.min(currentHour, 239);
                            labelsTime.push(hourlyDates[safeHour]);
                            dataTime.push(tsData.values[i]);
                            
                            if (currentHour < 144) currentHour += 3;
                            else currentHour += 6;
                        }
                    }

                    // 2. GAMBAR GRAFIKNYA DENGAN PENYARINGAN SUMBU X YANG BENAR
                    if(timeChartInstance) timeChartInstance.destroy();
                    timeChartInstance = new Chart(document.getElementById('chartTimeSeries').getContext('2d'), {
                        type: 'line', 
                        data: { labels: labelsTime, datasets: [{ label: moData.title, data: dataTime, borderColor: '#2563eb', backgroundColor: 'rgba(37, 99, 235, 0.2)', fill: true, tension: 0.4, pointRadius: 1 }] },
                        options: { 
                            maintainAspectRatio: false, 
                            plugins: { legend: { display: false } }, 
                            scales: { 
                                x: { 
                                    ticks: { 
                                        font: { size: 8, weight: 'bold' },
                                        maxRotation: 0,
                                        callback: function(val, index) {
                                            let label = this.getLabelForValue(val);
                                            // Jika data laut (harian), selalu tampilkan nama harinya
                                            if (dataTime.length <= 15) {
                                                return label.split(' - ')[0]; 
                                            }
                                            // Jika data cuaca (3-jaman), HANYA tampilkan nama hari jika jamnya menunjukkan "07:00" (Siklus awal harian)
                                            if (label.includes('07:00')) {
                                                return label.split(' - ')[0];
                                            }
                                            return null; // Sembunyikan jam lainnya agar tidak semut
                                        }
                                    },
                                    grid: {
                                        // Beri garis tebal sebagai pemisah antar hari
                                        color: (ctx) => ctx.tick && ctx.tick.label ? 'rgba(0,0,0,0.2)' : 'rgba(0,0,0,0)'
                                    }
                                }, 
                                y: { ticks: { font: { size: 8 } } } 
                            } 
                        }
                    });
                }
                
        } catch(e) {
            console.error("Gagal memuat Time Series:", e);
            document.getElementById('chartTimeSeries').parentNode.innerHTML = '<span class="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-red-500 text-xs font-bold">Gagal terhubung ke server</span>';
        }

        // --- D. FETCH API & GAMBAR GRAFIK KEDALAMAN (HANYA UNTUK DATA 3D) ---
        if (['suhu', 'salinitas', 'arus'].includes(moData.type)) {
            try {
                const response = await fetch(`https://api-webgis-kalteng.onrender.com/api/profile?lat=${lat}&lon=${lon}&param=${moData.type}&time_index=${currentSliderIndex}`);
                const realData = await response.json();

                document.getElementById('loading-depth').classList.add('hidden');
                const canvasDepth = document.getElementById('chartDepth');
                canvasDepth.classList.remove('hidden');

                if(typeof depthChartInstance !== 'undefined' && depthChartInstance) depthChartInstance.destroy();
                window.depthChartInstance = new Chart(canvasDepth.getContext('2d'), {
                    type: 'line', 
                    data: { labels: realData.depths.map(d => d + 'm'), datasets: [{ label: moData.title, data: realData.values, borderColor: '#0000ff', backgroundColor: '#0000ff', fill: false, tension: 0.1, pointRadius: 3, pointHoverRadius: 6 }] },
                    options: { maintainAspectRatio: false, indexAxis: 'y', plugins: { legend: { display: false } }, scales: { x: { position: 'top', title: { display: true, text: `Nilai Parameter`, font: {size: 9, weight: 'bold'} }, ticks: { font: { size: 9 } } }, y: { reverse: false, title: { display: true, text: 'Kedalaman (m)', font: {size: 9, weight: 'bold'} }, ticks: { font: { size: 9 } } } } } 
                });
            } catch (error) {
                console.error("Gagal menarik data dari server Python:", error);
                document.getElementById('loading-depth').innerHTML = `<span class="text-red-500">Gagal mengambil data dari server.</span>`;
            }
        }
    }
};

map.on('click', function(e) {
    if (activeDataType || isThermalFrontActive) {
        buildUnifiedSidebar(e.latlng.lat, e.latlng.lng, null);
    }
});

window.closeMetOceanSidebar = function() {
    const detailSidebar = document.getElementById('detail-sidebar');
    if (detailSidebar) detailSidebar.classList.add('-translate-x-[120%]');
};

// ==========================================
// PENYESUAIAN UI: LEBAR SIDEBAR, KURSOR & HOVER INFO
// ==========================================

// 1. Modifikasi Sidebar Kiri
const sidebarElement = document.getElementById('detail-sidebar');
if (sidebarElement) {
    sidebarElement.className = sidebarElement.className.replace(/w-\d+/g, '');
    sidebarElement.classList.add('w-[90vw]', 'md:w-[26rem]', 'max-h-[60vh]', 'overflow-y-auto');
}

// 2. Paksa Kursor Peta menjadi Default (Panah)
const cursorStyle = document.createElement('style');
cursorStyle.innerHTML = `
    .leaflet-container, .leaflet-interactive, .leaflet-grab { cursor: default !important; }
    .leaflet-dragging .leaflet-grab, .leaflet-dragging .leaflet-interactive { cursor: grabbing !important; }
`;
document.head.appendChild(cursorStyle);

// 3. Buat Kotak Info Hover
let hoverTooltip = document.getElementById('hover-metocean-tooltip');
if (!hoverTooltip) {
    hoverTooltip = document.createElement('div');
    hoverTooltip.id = 'hover-metocean-tooltip';
    hoverTooltip.className = 'fixed z-[99999] bg-blue-900/95 text-white px-3 py-2 rounded shadow-xl text-xs font-bold pointer-events-none hidden transition-opacity duration-150 border border-blue-400';
    document.body.appendChild(hoverTooltip);
}

// 4. Nyalakan Radar Hover saat Mouse Bergerak
map.on('mousemove', function(e) {
    let moData = getMetOceanDataMath(e.latlng.lat, e.latlng.lng);
    if (moData) {
        let unit = moData.type === 'batimetri' ? ' m' : '';
        hoverTooltip.innerHTML = `<span class="text-gray-300 font-normal tracking-wide">${moData.title}</span><br><span class="text-yellow-400 text-sm">${moData.val.toFixed(1)}${unit}</span>`;
        hoverTooltip.style.left = (e.originalEvent.clientX + 15) + 'px';
        hoverTooltip.style.top = (e.originalEvent.clientY + 20) + 'px';
        hoverTooltip.classList.remove('hidden');
    } else {
        hoverTooltip.classList.add('hidden');
    }
});

map.on('mouseout', function() {
    hoverTooltip.classList.add('hidden');
});

map.on('dragstart', function() {
    if (hoverTooltip) hoverTooltip.classList.add('hidden');
});

// ==========================================
// 10. FITUR MOUSE KORDINAT, SEARCH & FULLSCREEN
// ==========================================

// A. Mouse Koordinat Realtime
map.on('mousemove', function(e) {
    document.getElementById('coord-info').innerHTML = `Lat: ${e.latlng.lat.toFixed(4)} | Lon: ${e.latlng.lng.toFixed(4)}`;
});

// B. Pencarian Lokasi (Geocoding API OpenStreetMap)
document.getElementById('input-search').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        let query = this.value;
        if (!query) return;
        this.value = "Mencari...";
        
        fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}`)
        .then(res => res.json())
        .then(data => {
            this.value = query; // Kembalikan teks asli
            if (data && data.length > 0) {
                let lat = data[0].lat;
                let lon = data[0].lon;
                map.flyTo([lat, lon], 12);
                L.marker([lat, lon]).addTo(map).bindPopup(data[0].display_name).openPopup();
            } else {
                alert("Lokasi tidak ditemukan!");
            }
        }).catch(() => {
            this.value = query;
            alert("Gagal mencari lokasi.");
        });
    }
});

// C. Fitur Fullscreen
document.getElementById('btn-fullscreen').addEventListener('click', () => {
    if (!document.fullscreenElement) {
        document.documentElement.requestFullscreen().catch(err => console.log(err));
    } else {
        document.exitFullscreen();
    }
});

// Rule 5: Tombol Default Zoom
document.getElementById('btn-home').addEventListener('click', () => {
    map.flyTo([-2.8, 112.8], 7.2); // Sesuai setView awal kamu
});

// Rule 6: Search Autocomplete
const searchInput = document.getElementById('input-search');
const suggestionsBox = document.getElementById('search-suggestions');

searchInput.addEventListener('input', function() {
    const query = this.value;
    if (query.length < 3) {
        suggestionsBox.classList.add('hidden');
        return;
    }

    fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${query}&limit=5&countrycodes=id`)
        .then(res => res.json())
        .then(data => {
            suggestionsBox.innerHTML = '';
            if (data.length > 0) {
                suggestionsBox.classList.remove('hidden');
                data.forEach(place => {
                    const item = document.createElement('div');
                    item.className = "px-4 py-2 hover:bg-blue-50 cursor-pointer text-xs text-gray-800 border-b border-gray-100";
                    item.textContent = place.display_name;
                    item.onclick = () => {
                        map.flyTo([place.lat, place.lon], 12);
                        L.marker([place.lat, place.lon]).addTo(map).bindPopup(place.display_name).openPopup();
                        suggestionsBox.classList.add('hidden');
                        searchInput.value = place.display_name;
                    };
                    suggestionsBox.appendChild(item);
                });
            }
        });
});

// Klik di luar untuk tutup saran
document.addEventListener('click', (e) => {
    if (!searchInput.contains(e.target)) suggestionsBox.classList.add('hidden');
});


// ==========================================
// 12. ALAT ANALISIS: THERMAL FRONT
// ==========================================
let thermalFrontLayer = null;
let isThermalFrontActive = false;

document.getElementById('btn-thermal-front').addEventListener('click', function() {
    const isCurrentlyActive = isThermalFrontActive;
    
    // 1. BERSIHKAN SEMUANYA!
    matikanSemuaLayer();

    // 2. Nyalakan Thermal Front HANYA jika sebelumnya dia mati
    if (!isCurrentlyActive) {
        isThermalFrontActive = true;
        document.getElementById('cb-thermal-front').checked = true;
        this.classList.replace('bg-gray-100', 'bg-yellow-100');
        
        // --- KUNCI: BIKIN MENU LAIN JADI ABU-ABU MATI ---
        document.querySelectorAll('.metocean-item, .ekstra-item').forEach(item => {
            if (item.id !== 'btn-thermal-front') {
                item.classList.add('opacity-40', 'pointer-events-none', 'grayscale');
            }
        });

        // Munculkan penjelasan di sidebar kiri
        let center = map.getCenter();
        buildUnifiedSidebar(center.lat, center.lng, null);

        // Nyalakan UI Judul
        document.getElementById('displayPanel').classList.remove('hidden');
        document.getElementById('displayTitle').textContent = "Thermal Front Tracker";
        document.getElementById('displayTime').textContent = `Prakiraan: ${hourlyDates[currentSliderIndex]}`;
        
        // Gambar Petanya!
        renderThermalFront(currentSliderIndex);
    }
});

async function renderThermalFront(dayIndex) {
    if (!isThermalFrontActive) return;
    
    if (thermalFrontLayer) { map.removeLayer(thermalFrontLayer); thermalFrontLayer = null; }
    
    try {
        const res = await fetch(`https://api-webgis-kalteng.onrender.com/api/thermal-front/${dayIndex}`);
        const data = await res.json();
        
        // 1. LIHAT ISI ASLINYA DI SINI
        console.log("Wujud Asli Data dari Server:", data);

        // 2. Cegah Leaflet crash jika formatnya salah
        if (!data || (data.type !== "FeatureCollection" && data.type !== "Feature")) {
            console.error("❌ GAGAL: Data dari server bukan GeoJSON! Isinya:", data);
            return; // Berhenti di sini agar layar tidak error merah
        }

        thermalFrontLayer = L.geoJSON(data, {
            pane: 'metoceanPane',
            style: {
                color: '#ff0000', 
                weight: 3,        
                dashArray: '8, 6',
                opacity: 0.9,
                lineCap: 'round'
            }
        }).addTo(map);
    } catch (err) {
        console.error("Gagal memuat API Thermal Front:", err);
    }
}

// ==========================================
// 13. FITUR PENGUKUR JARAK (RULER TOOL)
// ==========================================
const btnMeasure = document.getElementById('btn-measure');

let isMeasuring = false;
let measurePoints = [];
let measureLine = null;
let tempMeasureLine = null;
let measureTooltip = null;
let measureResultLabel = null;

// Fungsi untuk menghitung total jarak dari array titik
function calculateTotalDistance(latlngs) {
    let total = 0;
    for (let i = 0; i < latlngs.length - 1; i++) {
        total += map.distance(latlngs[i], latlngs[i + 1]);
    }
    return total;
}

// Format teks jarak (meter atau kilometer)
function formatDistance(meters) {
    if (meters > 1000) return (meters / 1000).toFixed(2) + ' km';
    return Math.round(meters) + ' m';
}

// Bersihkan semua coretan pengukur
function clearMeasurement() {
    isMeasuring = false;
    measurePoints = [];
    map.getContainer().style.cursor = ''; // Kembalikan kursor normal
    map.doubleClickZoom.enable();         // Aktifkan zoom dblclick lagi
    btnMeasure.classList.remove('bg-yellow-300', 'text-blue-900', 'shadow-inner');
    
    // Matikan sensor mouse
    map.off('click', onMeasureClick);
    map.off('mousemove', onMeasureMove);
    map.off('dblclick', onMeasureDblClick);
    
    // Hapus semua garis & label dari peta
    if (measureLine) { map.removeLayer(measureLine); measureLine = null; }
    if (tempMeasureLine) { map.removeLayer(tempMeasureLine); tempMeasureLine = null; }
    if (measureTooltip) { map.removeLayer(measureTooltip); measureTooltip = null; }
    if (measureResultLabel) { map.removeLayer(measureResultLabel); measureResultLabel = null; }
}

// Daftarkan ke Window agar tombol "Hapus" di HTML bisa memanggilnya
window.clearMeasurement = clearMeasurement;

// Aksi ketika tombol penggaris diklik
btnMeasure.addEventListener('click', () => {
    if (isMeasuring) {
        clearMeasurement(); // Jika sedang nyala, matikan
    } else {
        clearMeasurement(); // Bersihkan sisa yang lama dulu
        isMeasuring = true;
        
        // Ubah gaya tombol dan kursor
        btnMeasure.classList.add('bg-yellow-300', 'text-blue-900', 'shadow-inner');
        map.getContainer().style.cursor = 'crosshair';
        map.doubleClickZoom.disable(); // Matikan zoom agar dblclick bisa dipakai untuk finish
        
        // Nyalakan sensor mouse
        map.on('click', onMeasureClick);
        map.on('mousemove', onMeasureMove);
        map.on('dblclick', onMeasureDblClick);
    }
});

function onMeasureClick(e) {
    measurePoints.push(e.latlng);

    // Gambar garis utama biru solid
    if (!measureLine) {
        measureLine = L.polyline(measurePoints, {color: '#2563eb', weight: 3}).addTo(map);
    } else {
        measureLine.setLatLngs(measurePoints);
    }

    // Buat tooltip penunjuk angka real-time
    if (!measureTooltip) {
        measureTooltip = L.tooltip({permanent: true, direction: 'right', className: 'bg-transparent border-none shadow-none text-blue-900 font-bold text-xs'})
            .setLatLng(e.latlng)
            .addTo(map);
    }
}

function onMeasureMove(e) {
    if (measurePoints.length > 0) {
        let tempPts = [...measurePoints, e.latlng];
        
        // Gambar garis putus-putus menuju kursor
        if (!tempMeasureLine) {
            tempMeasureLine = L.polyline(tempPts, {color: '#2563eb', weight: 2, dashArray: '5, 5'}).addTo(map);
        } else {
            tempMeasureLine.setLatLngs(tempPts);
        }

        let currentDist = calculateTotalDistance(tempPts);
        
        // Update angka di kursor
        measureTooltip.setLatLng(e.latlng).setContent(`
            <div class="bg-white/90 px-2 py-1 rounded shadow-md border border-gray-200">
                Jarak: ${formatDistance(currentDist)}<br>
                <span class="text-[9px] text-gray-500 font-normal">Klik 2x untuk selesai</span>
            </div>
        `);
    }
}

function onMeasureDblClick(e) {
    L.DomEvent.stopPropagation(e);
    if (measurePoints.length < 2) return;

    // Saat double click, Leaflet juga memicu click, jadi kita hapus titik terakhir yang dobel
    measurePoints.pop(); 
    
    let finalDist = calculateTotalDistance(measurePoints);
    measureLine.setLatLngs(measurePoints); // Kunci garis utamanya
    
    // Matikan sensor ukur, tapi JANGAN hapus garisnya (isMeasuring = false)
    isMeasuring = false;
    map.getContainer().style.cursor = '';
    map.doubleClickZoom.enable();
    btnMeasure.classList.remove('bg-yellow-300', 'text-blue-900', 'shadow-inner');
    map.off('click', onMeasureClick);
    map.off('mousemove', onMeasureMove);
    map.off('dblclick', onMeasureDblClick);
    
    // Bersihkan garis putus-putus dan tooltip sementara
    if (tempMeasureLine) { map.removeLayer(tempMeasureLine); tempMeasureLine = null; }
    if (measureTooltip) { map.removeLayer(measureTooltip); measureTooltip = null; }

    // Tampilkan Kotak Hasil Hitam dengan Tombol Hapus (Mirip Web KKP)
    let lastPoint = measurePoints[measurePoints.length - 1];
    let resultHTML = `
        <div class="bg-gray-800/95 text-white px-3 py-1.5 rounded shadow-lg text-xs flex items-center gap-3 whitespace-nowrap border border-gray-600">
            <span>Total jarak: <b class="text-yellow-400">${formatDistance(finalDist)}</b></span>
            <button onclick="window.clearMeasurement()" class="bg-red-500 hover:bg-red-600 text-white px-2 py-0.5 rounded shadow transition cursor-pointer pointer-events-auto">Hapus</button>
        </div>
    `;

    measureResultLabel = L.marker(lastPoint, {
        icon: L.divIcon({
            className: 'custom-measure-result',
            html: resultHTML,
            iconSize: [null, null], // Sesuaikan otomatis dengan isi
            iconAnchor: [0, 20]     // Geser sedikit ke atas dari titik
        }),
        interactive: true
    }).addTo(map);
}


// ==========================================
// 14. FITUR UPLOAD SHAPEFILE (.ZIP)
// ==========================================
const btnUploadShp = document.getElementById('btn-upload-shp');
const inputShp = document.getElementById('input-shp-file');

// Saat tombol diklik, pura-pura mengklik input file yang tersembunyi
btnUploadShp.addEventListener('click', () => {
    inputShp.click();
});

// Saat user sudah memilih file .zip
inputShp.addEventListener('change', function(e) {
    const file = e.target.files[0];
    if (!file) return;

    // Pastikan formatnya ZIP
    if (!file.name.toLowerCase().endsWith('.zip')) {
        alert("Peringatan: Harap upload file dalam format .zip yang berisi SHP!");
        inputShp.value = ''; // Reset
        return;
    }

    // Ubah tulisan tombol agar user tahu sedang loading
    const originalText = btnUploadShp.innerHTML;
    btnUploadShp.innerHTML = "⏳ Memproses...";

    // Gunakan FileReader untuk membaca isi ZIP
    const reader = new FileReader();
    reader.onload = function(e) {
        const buffer = e.target.result;
        
        // Gunakan library shpjs untuk mengubah ZIP (SHP) menjadi GeoJSON
        shp(buffer).then(function(geojson) {
            
            // Gambar GeoJSON ke atas peta
            const uploadedLayer = L.geoJSON(geojson, {
                pane: 'zonasiPane', // Taruh di bawah layer MetOcean agar rapi
                style: function(feature) {
                    return {
                        color: '#9b59b6', // Warna Ungu Amethyst agar beda dengan zonasi asli
                        weight: 2,
                        fillColor: '#8e44ad',
                        fillOpacity: 0.5,
                        dashArray: '4, 4' // Garis putus-putus
                    };
                },
                onEachFeature: function(feature, layer) {
                    // Buat Popup otomatis yang membaca semua kolom/tabel di SHP tersebut
                    let popupContent = `<div class="bg-blue-900 text-white px-2 py-1 text-xs font-bold rounded mb-2">Data SHP Upload</div><table class="text-[10px] w-full text-left">`;
                    
                    if (feature.properties) {
                        for (let key in feature.properties) {
                            let val = feature.properties[key];
                            popupContent += `<tr class="border-b border-gray-100"><th class="pr-2 text-gray-500 py-1">${key}</th><td class="font-semibold text-gray-800">${val}</td></tr>`;
                        }
                    }
                    popupContent += "</table>";
                    
                    layer.bindPopup(popupContent, { maxWidth: 300 });
                }
            }).addTo(map);
            
            // KUNCI PERBAIKAN: Masukkan layer ini ke daftar antrean hapus
            uploadedShpLayers.push(uploadedLayer);

            // Arahkan kamera langsung ke SHP yang baru diupload
            map.fitBounds(uploadedLayer.getBounds());
            
            // Beri notifikasi sukses
            btnUploadShp.innerHTML = "✅ Berhasil!";
            setTimeout(() => { btnUploadShp.innerHTML = originalText; }, 3000);
            
            // Reset input agar bisa upload file yang sama lagi jika dibutuhkan
            inputShp.value = '';

        }).catch(function(err) {
            console.error("Error membaca SHP:", err);
            alert("Gagal membaca SHP! Pastikan di dalam .zip terdapat file .shp, .shx, dan .dbf yang valid.");
            btnUploadShp.innerHTML = originalText;
            inputShp.value = '';
        });
    };
    
    // Mulai membaca file sebagai Array Buffer (format yang dibutuhkan shpjs)
    reader.readAsArrayBuffer(file);
});



// ==========================================
// 15. FITUR GAMBAR POLYGON & DOWNLOAD VIA POPUP
// ==========================================
const btnPolygon = document.getElementById('btn-polygon');
let isDrawingPoly = false, polyPoints = [], tempPolyLine = null, tempCloseLine = null, mainPolyLine = null, polyTooltip = null;
let drawnPolygonLayer = null;

function clearPolygonTool() {
    isDrawingPoly = false; 
    polyPoints = [];
    map.getContainer().style.cursor = ''; 
    map.doubleClickZoom.enable();
    btnPolygon.classList.remove('bg-yellow-300', 'text-blue-900', 'shadow-inner');
    map.off('click', onPolyClick); 
    map.off('mousemove', onPolyMove); 
    map.off('dblclick', onPolyDblClick);

    if (mainPolyLine) { map.removeLayer(mainPolyLine); mainPolyLine = null; }
    if (tempPolyLine) { map.removeLayer(tempPolyLine); tempPolyLine = null; }
    if (tempCloseLine) { map.removeLayer(tempCloseLine); tempCloseLine = null; }
    if (polyTooltip) { map.removeLayer(polyTooltip); polyTooltip = null; }
}

// Fungsi Download yang Diperbaiki (Bypass Blokir Keamanan Chrome)
window.downloadShpFromPopup = function() {
    if (!drawnPolygonLayer) return;
    
    let filename = document.getElementById('popup-poly-name').value || "Area_Baru";
    // Bersihkan semua karakter aneh dan spasi agar file ZIP tidak rusak
    filename = filename.replace(/[^a-zA-Z0-9_]/g, '_'); 

    let geojson = drawnPolygonLayer.toGeoJSON();
    geojson.properties = { Nama: filename, Sumber: "WebGIS Kalteng ITB" };
    
    let featureCollection = { type: 'FeatureCollection', features: [geojson] };
    let options = { folder: filename, types: { polygon: filename } };

    try {
        const btnDownload = document.querySelector('button[onclick="window.downloadShpFromPopup()"]');
        if (btnDownload) btnDownload.textContent = "⏳ Memproses ZIP...";
        
        // KUNCI PERBAIKAN: Gunakan shpwrite.zip() lalu buat link <a> manual agar tidak diblokir Chrome
        shpwrite.zip(featureCollection, options).then(function(content) {
            const link = document.createElement('a');
            link.href = 'data:application/zip;base64,' + content;
            link.download = filename + '.zip';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);

            if (btnDownload) btnDownload.textContent = "✅ Berhasil!";
            setTimeout(() => { if (btnDownload) btnDownload.textContent = "💾 Download SHP (.zip)"; }, 2000);
        }).catch(function(err) {
            console.error("Zip Error:", err);
            alert("Gagal memproses file ZIP.");
            if (btnDownload) btnDownload.textContent = "💾 Download SHP (.zip)";
        });
    } catch(e) { 
        console.error("Export Error:", e);
        alert("Gagal mengekspor SHP."); 
    }
};

btnPolygon.addEventListener('click', () => {
    if (isDrawingPoly) {
        clearPolygonTool();
    } else {
        clearPolygonTool(); 
        isDrawingPoly = true;
        btnPolygon.classList.add('bg-yellow-300', 'text-blue-900', 'shadow-inner');
        map.getContainer().style.cursor = 'crosshair'; 
        map.doubleClickZoom.disable();
        map.on('click', onPolyClick); 
        map.on('mousemove', onPolyMove); 
        map.on('dblclick', onPolyDblClick);
    }
});

function onPolyClick(e) {
    if (!isDrawingPoly) return;
    polyPoints.push(e.latlng);
    
    if (!mainPolyLine) {
        mainPolyLine = L.polyline(polyPoints, {color: '#8e44ad', weight: 3}).addTo(map);
    } else {
        mainPolyLine.setLatLngs(polyPoints);
    }
    
    if (!polyTooltip) {
        polyTooltip = L.tooltip({permanent: true, direction: 'right', className: 'bg-white/90 text-blue-900 font-bold text-xs shadow-md border-none rounded'}).addTo(map);
    }
}

function onPolyMove(e) {
    // KUNCI PERBAIKAN ERROR "reading lat": Safety guard yang super ketat
    if (!isDrawingPoly || polyPoints.length === 0 || !e.latlng) return;

    let lastPoint = polyPoints[polyPoints.length - 1];
    let firstPoint = polyPoints[0];

    // Jika tiba-tiba koordinat kosong karena bug Leaflet, hentikan proses
    if (!lastPoint || !firstPoint) return;

    let tempPts = [lastPoint, e.latlng];
    if (!tempPolyLine) tempPolyLine = L.polyline(tempPts, {color: '#8e44ad', weight: 2, dashArray: '5, 5'}).addTo(map);
    else tempPolyLine.setLatLngs(tempPts);

    if (polyPoints.length > 1) {
        let closePts = [e.latlng, firstPoint];
        if (!tempCloseLine) tempCloseLine = L.polyline(closePts, {color: '#8e44ad', weight: 2, dashArray: '5, 5', opacity: 0.5}).addTo(map);
        else tempCloseLine.setLatLngs(closePts);
    }
    
    if (polyTooltip) {
        polyTooltip.setLatLng(e.latlng).setContent(`Titik: ${polyPoints.length}<br><span class="text-[9px] text-gray-500 font-normal">Klik 2x untuk simpan</span>`);
    }
}

function onPolyDblClick(e) {
    L.DomEvent.stopPropagation(e);
    
    // KUNCI PERBAIKAN DOUBLE CLICK: Saring titik duplikat yang dihasilkan oleh double-click
    let uniquePoints = [];
    for (let i = 0; i < polyPoints.length; i++) {
        let pt = polyPoints[i];
        if (i === 0 || (pt.lat !== polyPoints[i-1].lat && pt.lng !== polyPoints[i-1].lng)) {
            uniquePoints.push(pt);
        }
    }

    if (uniquePoints.length < 3) { 
        alert("Area batal dibuat. Butuh minimal 3 titik unik!"); 
        clearPolygonTool(); 
        return; 
    }

    const finalPoints = [...uniquePoints]; 
    clearPolygonTool(); // Bersihkan alat gambar dengan aman

    if (drawnPolygonLayer) map.removeLayer(drawnPolygonLayer);

    // Gambar poligon permanen
    drawnPolygonLayer = L.polygon(finalPoints, {
        color: '#8e44ad', fillColor: '#9b59b6', fillOpacity: 0.4, weight: 3
    }).addTo(map);

    let popupContent = `
        <div class="p-2 text-gray-800 min-w-[150px]">
            <label class="text-[10px] font-bold uppercase text-gray-500">Nama Area SHP:</label>
            <input type="text" id="popup-poly-name" value="Area_Baru" class="w-full border border-gray-300 p-1.5 text-xs mb-3 mt-1 rounded outline-none focus:ring-2 focus:ring-blue-500 font-semibold text-blue-900">
            <button onclick="window.downloadShpFromPopup()" class="w-full bg-blue-600 text-white text-[11px] py-2 rounded font-bold hover:bg-blue-700 shadow transition flex justify-center items-center gap-1">💾 Download SHP (.zip)</button>
        </div>
    `;
    drawnPolygonLayer.bindPopup(popupContent, { minWidth: 180 }).openPopup();
}
// ==========================================
// 16. FITUR BERSIH TOTAL (CLEAR ALL LAYERS)
// ==========================================
document.getElementById('btn-clear-all').addEventListener('click', () => {
    if (!confirm("Apakah Anda yakin ingin menghapus semua layer dan kembali ke tampilan default?")) return;

    // 1. Hapus Semua SHP yang pernah di-upload user (KUNCI PERBAIKAN)
    uploadedShpLayers.forEach(layer => map.removeLayer(layer));
    uploadedShpLayers = []; // Kosongkan daftar antrean

    // 2. Hapus Semua Zonasi Pesisir
    Object.values(activeZonasiLayers).forEach(layer => map.removeLayer(layer));
    activeZonasiLayers = {};

    // 3. Hapus Semua MetOcean & Raster
    activeDataType = null;
    activeRasterGroup.clearLayers();
    if (velocityLayer) { map.removeLayer(velocityLayer); velocityLayer = null; }
    if (typeof thermalFrontLayer !== 'undefined' && thermalFrontLayer) { 
        map.removeLayer(thermalFrontLayer); 
        thermalFrontLayer = null; 
        isThermalFrontActive = false; 
    }
    if (isPlaying) stopAnimation();

    // 4. Hapus Poligon & Alat Ukur
    if (typeof drawnPolygonLayer !== 'undefined' && drawnPolygonLayer) { 
        map.removeLayer(drawnPolygonLayer); 
        drawnPolygonLayer = null; 
    }
    if (typeof clearMeasurement === 'function') clearMeasurement();

    // 5. Reset UI (Tutup Sidebar & Panel)
    document.getElementById('displayPanel').classList.add('hidden');
    document.getElementById('legenda-container').classList.add('hidden');
    const dContainer = document.getElementById('depth-container');
    if (dContainer) dContainer.classList.add('hidden');
    
    if (typeof closeSidebar === 'function') closeSidebar();
    if (typeof closeMetOceanSidebar === 'function') closeMetOceanSidebar();

    // 6. Reset Semua Tombol (Warna & Checkbox)
    document.querySelectorAll('.zonasi-item, .metocean-item').forEach(item => {
        item.classList.replace('bg-yellow-100', 'bg-gray-100');
        item.classList.remove('opacity-40', 'pointer-events-none');
        const cb = item.querySelector('input[type="checkbox"]');
        if (cb) cb.checked = false;
    });

    // Reset Tombol Thermal Front jika ada
    const btnThermal = document.getElementById('btn-thermal-front');
    if (btnThermal) {
        btnThermal.classList.replace('bg-yellow-100', 'bg-gray-100');
        btnThermal.classList.remove('opacity-40', 'pointer-events-none');
        const cbT = document.getElementById('cb-thermal-front');
        if (cbT) cbT.checked = false;
    }

    alert("Seluruh peta dan file upload telah dibersihkan!");
});
// ==========================================
// 17. FITUR CETAK PETA (EKSPOR PDF A4 + LEGENDA + PROGRESS BAR)
// ==========================================
const btnPrint = document.getElementById('btn-print');

if (!document.getElementById('print-progress')) {
    const progressOverlay = document.createElement('div');
    progressOverlay.id = 'print-progress';
    progressOverlay.className = 'fixed top-4 left-4 z-[99999] bg-blue-900 text-white px-4 py-3 rounded-lg shadow-2xl border-2 border-yellow-400 font-bold flex items-center gap-4 transition-opacity hidden';
    progressOverlay.innerHTML = `
        <svg class="animate-spin h-6 w-6 text-yellow-400" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4"></circle>
            <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
        </svg>
        <div class="flex flex-col w-40">
            <span id="progress-text" class="text-[10px] text-blue-100 uppercase tracking-wider mb-1">Menyiapkan...</span>
            <div class="w-full h-2 bg-blue-950 rounded-full overflow-hidden">
                <div id="progress-bar" class="h-full bg-yellow-400 w-0 transition-all duration-300"></div>
            </div>
        </div>
        <span id="progress-percent" class="text-yellow-400 text-lg font-extrabold w-12 text-right">0%</span>
    `;
    document.body.appendChild(progressOverlay);
}

function updateProgress(percent, text) {
    document.getElementById('progress-text').textContent = text;
    document.getElementById('progress-bar').style.width = percent + '%';
    document.getElementById('progress-percent').textContent = percent + '%';
}

btnPrint.addEventListener('click', async () => {
    if (btnPrint.disabled) return;
    btnPrint.disabled = true;
    
    const progressOverlay = document.getElementById('print-progress');
    progressOverlay.classList.remove('hidden');
    updateProgress(10, 'Menyiapkan Peta...');

    // 1. SEMBUNYIKAN UI
    const uiElementsToHide = [
        document.getElementById('top-bar-container'),
        document.getElementById('toolbar-bottom'),
        document.getElementById('bottom-bar-container'),
        document.getElementById('depth-container'),
        document.getElementById('coord-info'),
        document.getElementById('layer-menu'),
        document.getElementById('detail-sidebar'),
        document.getElementById('metocean-sidebar')
    ];

    const originalStyles = [];
    uiElementsToHide.forEach(el => {
        if (el) {
            originalStyles.push({ el: el, opacity: el.style.opacity, pointerEvents: el.style.pointerEvents });
            el.style.opacity = '0';
            el.style.pointerEvents = 'none';
        }
    });

    const leafletControls = document.querySelector('.leaflet-control-container');
    let originalLeafletDisplay = '';
    if (leafletControls) {
        originalLeafletDisplay = leafletControls.style.display;
        leafletControls.style.display = 'none'; 
    }

    try {
        window.scrollTo(0, 0);
        await new Promise(r => setTimeout(r, 400)); 

        updateProgress(40, 'Memotret Peta...');
        await new Promise(r => setTimeout(r, 100)); 

        // ==========================================
        // TAHAP A: FOTO PETA SAJA (Kini sempurna berkat Canvas)
        // ==========================================
        const mapElement = document.getElementById('map');
        const mapCanvas = await html2canvas(mapElement, {
            useCORS: true,
            allowTaint: false,
            scale: 2, 
            backgroundColor: '#aadaff'
        });

        updateProgress(65, 'Menyusun Legenda...');
        await new Promise(r => setTimeout(r, 100));

        // ==========================================
        // TAHAP B: BUAT KOTAK LEGENDA RAHASIA
        // ==========================================
        const legendDiv = document.createElement('div');
        legendDiv.style.position = 'absolute';
        legendDiv.style.top = '-9999px'; 
        legendDiv.style.left = '0';
        legendDiv.style.width = '1200px'; 
        legendDiv.style.backgroundColor = '#ffffff';
        legendDiv.style.padding = '20px';
        legendDiv.style.fontFamily = 'sans-serif';

        let legendHTML = `<h2 style="text-align: center; font-size: 20px; font-weight: bold; margin-bottom: 20px; color: #1e3a8a; border-bottom: 2px solid #1e3a8a; padding-bottom: 10px;">LEGENDA PETA</h2>`;
        legendHTML += `<div style="display: flex; justify-content: space-around; align-items: flex-start;">`;

        if (activeDataType) {
            let conf = configs[activeDataType];
            legendHTML += `
                <div style="flex: 1; padding: 0 20px; border-right: 2px solid #eee;">
                    <h4 style="font-size: 16px; font-weight: bold; margin-bottom: 10px; color: #333;">MetOcean: ${conf.title}</h4>
                    <div style="width: 100%; height: 20px; background: ${conf.css}; border: 1px solid #666; border-radius: 4px;"></div>
                    <div style="display: flex; justify-content: space-between; margin-top: 5px; font-size: 14px; font-weight: bold; color: #333;">
                        <span>${conf.min}</span>
                        <span>${conf.max}</span>
                    </div>
                </div>
            `;
        } else if (typeof isThermalFrontActive !== 'undefined' && isThermalFrontActive) {
            legendHTML += `
                <div style="flex: 1; padding: 0 20px; border-right: 2px solid #eee;">
                    <h4 style="font-size: 16px; font-weight: bold; margin-bottom: 10px; color: #333;">Alat Analisis</h4>
                    <div style="display: flex; align-items: center; gap: 10px; margin-top: 10px;">
                        <div style="width: 60px; height: 0; border-top: 5px dashed red;"></div>
                        <span style="font-size: 14px; font-weight: bold; color: #333;">Thermal Front (Garis Pertemuan Massa Air)</span>
                    </div>
                </div>
            `;
        }

        if (Object.keys(activeZonasiLayers).length > 0) {
            let activeCategories = new Set(); 
            Object.values(activeZonasiLayers).forEach(layer => {
                layer.eachLayer(l => {
                    if (l.feature && l.feature.properties) {
                        let p = l.feature.properties;
                        for (let key of Object.keys(p)) {
                            if (styleZonasi[p[key]]) activeCategories.add(p[key]);
                        }
                    }
                });
            });

            if (activeCategories.size > 0) {
                legendHTML += `
                    <div style="flex: 2; padding: 0 20px;">
                        <h4 style="font-size: 16px; font-weight: bold; margin-bottom: 15px; color: #333;">Zonasi Pesisir & Ruang Laut</h4>
                        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px;">
                `;
                Array.from(activeCategories).forEach(cat => {
                    let style = styleZonasi[cat];
                    let isLine = style.fillOpacity === 0; 
                    let visual = isLine 
                        ? `<div style="width: 25px; height: 0; border-top: 4px ${style.dashArray ? 'dashed' : 'solid'} ${style.color};"></div>`
                        : `<div style="width: 25px; height: 16px; border: 1px solid #666; background-color: ${style.fillColor}; opacity: 0.8;"></div>`;
                    
                    legendHTML += `
                        <div style="display: flex; align-items: center; gap: 8px;">
                            ${visual}
                            <span style="font-size: 13px; font-weight: bold; color: #444;">${cat}</span>
                        </div>
                    `;
                });
                legendHTML += `</div></div>`;
            }
        }

        legendHTML += `</div>`;
        legendDiv.innerHTML = legendHTML;
        document.body.appendChild(legendDiv);

        const legendCanvas = await html2canvas(legendDiv, { scale: 2 });
        document.body.removeChild(legendDiv);

        updateProgress(85, 'Merakit PDF (A4)...');
        await new Promise(r => setTimeout(r, 100));

        // ==========================================
        // TAHAP C: RAKIT KEDALAM PDF KERTAS A4
        // ==========================================
        const mapImgData = mapCanvas.toDataURL('image/jpeg', 0.95);
        const legendImgData = legendCanvas.toDataURL('image/png');

        const { jsPDF } = window.jspdf;
        const pdf = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });

        const pdfWidth = pdf.internal.pageSize.getWidth();  
        const pdfHeight = pdf.internal.pageSize.getHeight(); 
        const margin = 10; 

        // TATA LETAK PETA
        const mapMaxHeight = 135; 
        const mapMaxWidth = pdfWidth - (margin * 2);

        const mapProps = pdf.getImageProperties(mapImgData);
        const mapRatio = Math.min(mapMaxWidth / mapProps.width, mapMaxHeight / mapProps.height);
        const finalMapWidth = mapProps.width * mapRatio;
        const finalMapHeight = mapProps.height * mapRatio;
        
        const mapX = (pdfWidth - finalMapWidth) / 2;
        const mapY = margin;

        pdf.setDrawColor(0, 0, 0); 
        pdf.setLineWidth(0.5);
        pdf.rect(mapX, mapY, finalMapWidth, finalMapHeight);
        pdf.addImage(mapImgData, 'JPEG', mapX, mapY, finalMapWidth, finalMapHeight);

        // TATA LETAK LEGENDA
        const legendY = mapY + finalMapHeight + 5; 
        const legendMaxHeight = pdfHeight - legendY - margin;
        const legendMaxWidth = pdfWidth - (margin * 2);

        const legProps = pdf.getImageProperties(legendImgData);
        const legRatio = Math.min(legendMaxWidth / legProps.width, legendMaxHeight / legProps.height);
        const finalLegWidth = legProps.width * legRatio;
        const finalLegHeight = legProps.height * legRatio;

        const legX = (pdfWidth - finalLegWidth) / 2;
        pdf.addImage(legendImgData, 'PNG', legX, legendY, finalLegWidth, finalLegHeight);

        updateProgress(100, 'Selesai! Mengunduh...');
        await new Promise(r => setTimeout(r, 800)); 

        let pdfName = "Peta_WebGIS_Kalteng_A4";
        pdf.save(`${pdfName}.pdf`);

    } catch (error) {
        console.error("Gagal mencetak PDF:", error);
        alert("Gagal mengekspor PDF. Pastikan internet stabil.");
    } finally {
        originalStyles.forEach(item => {
            item.el.style.opacity = item.opacity;
            item.el.style.pointerEvents = item.pointerEvents;
        });
        if (leafletControls) leafletControls.style.display = originalLeafletDisplay;

        progressOverlay.classList.add('hidden');
        btnPrint.disabled = false;
    }
});

// ==========================================
// 18. WIDGET RAMALAN CUACA (WINDY CLONE) - AUTO START & ISOLASI
// ==========================================

let isWeatherActive = false;

// --- 1. BUAT TOMBOL TOGGLE CUACA (Di sebelah tombol pesawat) ---
const planeBtn = document.querySelector('button[title="Mulai Tour WebGIS"]');
let weatherToggleBtn = document.getElementById('btn-toggle-weather');

if (!weatherToggleBtn && planeBtn) {
    const btnContainer = document.createElement('div');
    btnContainer.className = 'flex gap-2 pointer-events-auto';
    planeBtn.parentNode.insertBefore(btnContainer, planeBtn);
    
    weatherToggleBtn = document.createElement('button');
    weatherToggleBtn.id = 'btn-toggle-weather';
    weatherToggleBtn.className = 'bg-slate-800 text-white p-3 rounded-full shadow-lg hover:bg-slate-700 transition border border-slate-600 text-lg flex items-center justify-center';
    weatherToggleBtn.title = "Mode Ramalan Cuaca";
    weatherToggleBtn.innerHTML = '🌤️';
    
    btnContainer.appendChild(weatherToggleBtn);
    btnContainer.appendChild(planeBtn);
}

// --- 2. BUAT MINI WIDGET (KIRI ATAS) ---
const weatherWidget = document.createElement('div');
weatherWidget.id = 'weather-widget';
weatherWidget.className = 'absolute top-16 left-2 md:left-4 z-[1000] w-[90vw] md:w-[22rem] bg-slate-800/90 backdrop-blur-md rounded-xl shadow-2xl border border-slate-600 text-white overflow-hidden transition-all duration-300 hidden';
weatherWidget.innerHTML = `
    <div class="p-3 border-b border-slate-600/50 flex justify-between items-center cursor-pointer hover:bg-slate-700/50 transition" onclick="document.getElementById('bottom-forecast-panel').classList.remove('translate-y-full')" title="Klik untuk lihat tabel per jam">
        <div>
            <div class="text-[10px] text-slate-300 font-bold uppercase tracking-wider flex items-center gap-1">
                <span>📍</span> <span id="wx-location" class="truncate w-40 inline-block">Klik Peta...</span>
            </div>
            <div class="text-4xl font-extrabold mt-1 flex items-center gap-2"><span id="wx-temp">--°</span></div>
        </div>
        <div class="text-right flex flex-col items-end">
            <span id="wx-icon" class="text-4xl drop-shadow-lg" style="line-height: 1;">☁️</span>
            <span id="wx-desc" class="text-[10px] font-bold text-yellow-400 mt-1 uppercase tracking-wider">Memuat...</span>
            <span id="wx-wind" class="text-[10px] text-slate-300">-- kt</span>
        </div>
    </div>
    <div class="flex justify-between px-3 py-2 bg-slate-900/80" id="wx-forecast"></div>
`;
document.body.appendChild(weatherWidget);

// --- 3. BUAT PANEL BAWAH (WINDY STYLE) ---
const forecastPanel = document.createElement('div');
forecastPanel.id = 'bottom-forecast-panel';
forecastPanel.className = 'absolute bottom-0 left-0 right-0 z-[1001] bg-slate-50/95 backdrop-blur-md shadow-[0_-10px_20px_rgba(0,0,0,0.2)] border-t border-slate-300 transition-transform duration-500 translate-y-full flex flex-col';
forecastPanel.innerHTML = `
    <div class="flex justify-between items-center bg-slate-800 text-white px-4 py-2 cursor-pointer" onclick="document.getElementById('bottom-forecast-panel').classList.add('translate-y-full')">
        <div class="flex items-center gap-2">
            <span class="text-sm font-bold tracking-wider uppercase text-yellow-400" id="panel-location-title">Prakiraan Cuaca Per Jam</span>
        </div>
        <button class="text-red-400 hover:text-red-300 font-bold text-xs bg-slate-700 px-3 py-1 rounded shadow">✖ Tutup Tabel</button>
    </div>
    <div class="overflow-x-auto pb-1 custom-scrollbar">
        <div id="forecast-table-container" class="flex min-w-max p-2 text-center text-[10.5px] text-slate-800"></div>
    </div>
`;
document.body.appendChild(forecastPanel);

if (!document.getElementById('wx-styles')) {
    const wxStyle = document.createElement('style');
    wxStyle.id = 'wx-styles';
    wxStyle.innerHTML = `
        .custom-scrollbar::-webkit-scrollbar { height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-thumb { background: #94a3b8; border-radius: 4px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: #e2e8f0; }
        .wind-arrow { display: inline-block; transition: transform 0.3s; font-size: 14px; font-weight: bold; color: #334155; }
    `;
    document.head.appendChild(wxStyle);
}

// --- 4. LOGIKA DATA OPEN-METEO ---
function getWeatherIconAndDesc(code) {
    if (code === 0) return { icon: '☀️', desc: 'Cerah' };
    if (code >= 1 && code <= 3) return { icon: '⛅', desc: 'Berawan' };
    if (code >= 45 && code <= 48) return { icon: '🌫️', desc: 'Berkabut' };
    if (code >= 51 && code <= 67) return { icon: '🌧️', desc: 'Hujan' };
    if (code >= 80 && code <= 82) return { icon: '🌦️', desc: 'Hujan Deras' };
    if (code >= 95 && code <= 99) return { icon: '⛈️', desc: 'Badai Petir' };
    return { icon: '☁️', desc: 'Mendung' };
}

async function updateWeatherWidget(lat, lon) {
    try {
        document.getElementById('wx-location').textContent = "Mencari lokasi...";
        const geoRes = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10`);
        const geoData = await geoRes.json();
        let locName = "Perairan Lepas"; 
        if (geoData && geoData.address) {
            locName = geoData.address.city || geoData.address.regency || geoData.address.county || geoData.address.village || geoData.address.state || "Kalimantan Tengah";
        }
        document.getElementById('wx-location').textContent = locName;
        document.getElementById('panel-location-title').innerHTML = `📍 Prakiraan Detail: <span class="text-white">${locName}</span>`;

        const wxRes = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=temperature_2m,precipitation,windspeed_10m,winddirection_10m,weathercode&daily=weathercode,temperature_2m_max,temperature_2m_min&timezone=auto&forecast_days=7`);
        const wxData = await wxRes.json();

        const current = wxData.current_weather;
        const wxInfo = getWeatherIconAndDesc(current.weathercode);
        document.getElementById('wx-temp').textContent = Math.round(current.temperature) + '°';
        document.getElementById('wx-icon').textContent = wxInfo.icon;
        document.getElementById('wx-desc').textContent = wxInfo.desc;
        document.getElementById('wx-wind').textContent = '💨 ' + Math.round(current.windspeed * 0.539957) + ' kt';

        let forecastHTML = '';
        const days = ["Min", "Sen", "Sel", "Rab", "Kam", "Jum", "Sab"];
        for (let i = 1; i <= 6; i++) {
            let dObj = new Date(wxData.daily.time[i]);
            forecastHTML += `
                <div class="flex flex-col items-center">
                    <span class="text-[9px] font-bold text-slate-400 uppercase">${days[dObj.getDay()]}</span>
                    <span class="text-base my-1">${getWeatherIconAndDesc(wxData.daily.weathercode[i]).icon}</span>
                    <div class="flex flex-col items-center leading-none mt-0.5">
                        <span class="text-[10px] font-bold text-white">${Math.round(wxData.daily.temperature_2m_max[i])}°</span>
                        <span class="text-[9px] font-bold text-slate-500 mt-0.5">${Math.round(wxData.daily.temperature_2m_min[i])}°</span>
                    </div>
                </div>
            `;
        }
        document.getElementById('wx-forecast').innerHTML = forecastHTML;

        const hourly = wxData.hourly;
        let tableHTML = '';
        let currentDay = '';

        let rowLabels = `
            <div class="flex flex-col border-r border-slate-300 min-w-[70px] font-extrabold text-slate-500 text-left bg-slate-100 sticky left-0 z-10 shadow-[2px_0_5px_rgba(0,0,0,0.05)] pt-1">
                <div class="border-b border-slate-300 text-transparent pb-1">.</div>
                <span class="py-1.5 pl-2 text-xs">Jam</span>
                <span class="text-xl py-1.5 text-transparent">.</span>
                <span class="py-1.5 pl-2 text-slate-700">Suhu (°C)</span>
                <span class="py-1.5 pl-2 text-blue-600">Hujan (mm)</span>
                <span class="py-1.5 pl-2 text-slate-800">Angin (kt)</span>
                <span class="py-1.5 pl-2">Arah</span>
            </div>
        `;

        for (let i = 0; i < hourly.time.length; i += 3) { 
            let dateObj = new Date(hourly.time[i]);
            let dayStr = days[dateObj.getDay()] + ' ' + dateObj.getDate();
            let hourStr = dateObj.getHours().toString().padStart(2, '0') + ':00';
            let icon = getWeatherIconAndDesc(hourly.weathercode[i]).icon;
            let temp = Math.round(hourly.temperature_2m[i]);
            let rain = hourly.precipitation[i];
            let windKt = Math.round(hourly.windspeed_10m[i] * 0.539957);
            let windDir = hourly.winddirection_10m[i];

            let wColor = windKt < 5 ? '#a7f3d0' : (windKt < 10 ? '#34d399' : (windKt < 15 ? '#fbbf24' : (windKt < 20 ? '#fb923c' : '#ef4444')));

            let dayHeader = currentDay !== dayStr 
                ? `<div class="font-extrabold border-b border-slate-300 text-left pl-2 text-slate-800 pb-1 bg-slate-200">${dayStr}</div>` 
                : `<div class="border-b border-slate-300 text-transparent select-none pb-1 bg-slate-50">.</div>`;
            currentDay = dayStr;

            tableHTML += `
                <div class="flex flex-col border-r border-slate-200 min-w-[55px] hover:bg-slate-200 transition duration-200 pt-1 bg-white">
                    ${dayHeader}
                    <span class="py-1.5 text-slate-600 font-bold">${hourStr}</span>
                    <span class="text-lg py-1.5 drop-shadow-sm">${icon}</span>
                    <span class="font-extrabold text-red-600 text-sm py-1.5">${temp}°</span>
                    <span class="text-blue-500 py-1.5 font-bold">${rain > 0 ? rain : '-'}</span>
                    <span class="font-bold py-1.5 text-slate-900 border-y border-white" style="background-color: ${wColor};">${windKt}</span>
                    <span class="py-1.5"><span class="wind-arrow" style="transform: rotate(${windDir}deg);">↓</span></span>
                </div>
            `;
        }

        document.getElementById('forecast-table-container').innerHTML = rowLabels + tableHTML;
    } catch (error) {
        document.getElementById('wx-location').textContent = "Server Error";
    }
}

// --- 5. KONTROL SISTEM CUACA ---
function turnOffWeatherSystem() {
    isWeatherActive = false;
    weatherWidget.classList.add('hidden');
    forecastPanel.classList.add('translate-y-full');
    if (weatherToggleBtn) {
        weatherToggleBtn.classList.replace('bg-blue-600', 'bg-slate-800');
        weatherToggleBtn.classList.remove('ring-4', 'ring-blue-400');
    }
}

function turnOnWeatherSystem() {
    if (typeof closeSidebar === 'function') closeSidebar();
    if (typeof closeMetOceanSidebar === 'function') closeMetOceanSidebar();
    
    isWeatherActive = true;
    weatherWidget.classList.remove('hidden');
    if (weatherToggleBtn) {
        weatherToggleBtn.classList.replace('bg-slate-800', 'bg-blue-600');
        weatherToggleBtn.classList.add('ring-4', 'ring-blue-400');
    }
    
    let center = map.getCenter();
    updateWeatherWidget(center.lat, center.lng);
}

if (weatherToggleBtn) {
    weatherToggleBtn.addEventListener('click', () => {
        isWeatherActive ? turnOffWeatherSystem() : turnOnWeatherSystem();
    });
}

// --- 6. SENSOR GLOBAL: MATI OTOMATIS JIKA KLIK UI LAIN ---
document.addEventListener('click', (e) => {
    // Jika sistem cuaca sedang mati, abaikan
    if (!isWeatherActive) return;

    // Daftar area yang BOLEH diklik saat mode cuaca aktif (tidak memicu mati otomatis)
    const allowedZones = [
        'weather-widget',          // Widget Cuaca Kiri Atas
        'bottom-forecast-panel',   // Panel Tabel Bawah
        'btn-toggle-weather',      // Tombol Toggle 🌤️
        'input-search',            // Kotak Pencarian Lokasi
        'search-suggestions'       // Hasil Pencarian Lokasi
    ];

    // Cek apakah user mengeklik area yang diizinkan
    const isAllowedZone = allowedZones.some(id => e.target.closest(`#${id}`));
    
    // Cek apakah user mengeklik peta (TIDAK termasuk kontrol Leaflet seperti tombol zoom/layer)
    const isMapClick = e.target.closest('#map') && !e.target.closest('.leaflet-control');

    // Jika yang diklik BUKAN peta dan BUKAN area cuaca (berarti user klik menu Layer, Zonasi, Print, dsb)
    if (!isAllowedZone && !isMapClick) {
        turnOffWeatherSystem();
    }
});

// Klik di peta HANYA memperbarui data JIKA mode cuaca sedang AKTIF
map.on('click', function(e) {
    if (isWeatherActive) {
        updateWeatherWidget(e.latlng.lat, e.latlng.lng);
        forecastPanel.classList.remove('translate-y-full'); // Buka otomatis panel bawah jika diklik di peta
    }
});

// --- 7. AUTO-START SAAT WEBGIS PERTAMA DIBUKA ---
// Beri jeda 1 detik agar Leaflet selesai merender peta dasar, lalu nyalakan cuaca!
setTimeout(() => {
    turnOnWeatherSystem();
}, 1000);


// ==========================================
// 19. STASIUN PASANG SURUT (TIDE STATION)
// ==========================================
let tideLayerGroup = L.layerGroup().addTo(map);
let isTideActive = false;

// Titik pelabuhan/muara utama di Kalimantan Tengah
const tideStations = [
    { name: "Teluk Segintung", lat: -3.3667, lon: 112.5500, code: "TSGT" },
    { name: "Kuala Jelai", lat: -3.0000, lon: 110.7000, code: "KLJL" },
];

document.getElementById('btn-tide-station').addEventListener('click', function() {
    const isCurrentlyActive = isTideActive;
    
    // 1. BERSIHKAN SEMUANYA!
    matikanSemuaLayer();

    // 2. Nyalakan Pasut HANYA jika sebelumnya dia mati
    if (!isCurrentlyActive) {
        isTideActive = true;
        document.getElementById('cb-tide-station').checked = true;
        this.classList.replace('bg-gray-100', 'bg-yellow-100');
        
        // --- KUNCI: BIKIN MENU LAIN JADI ABU-ABU MATI ---
        document.querySelectorAll('.metocean-item, .ekstra-item').forEach(item => {
            if (item.id !== 'btn-tide-station') {
                item.classList.add('opacity-40', 'pointer-events-none', 'grayscale');
            }
        });

        // Gambar Icon Jangkar di Peta
        tideStations.forEach(station => {
            let marker = L.marker([station.lat, station.lon], {
                icon: L.divIcon({
                    className: 'bg-transparent',
                    html: `<div class="bg-blue-600 text-white p-1.5 rounded-full shadow-lg border-2 border-white hover:bg-blue-800 transition transform hover:scale-110 flex items-center justify-center" style="width: 28px; height: 28px; font-size: 14px;">⚓</div>`,
                    iconSize: [28, 28],
                    iconAnchor: [14, 14]
                })
            });

            marker.on('click', function(e) {
                L.DomEvent.stopPropagation(e);
                buildTideSidebar(station.name, station.lat, station.lon, station.code);
            });
            
            tideLayerGroup.addLayer(marker);
        });
        
        // Arahkan kamera
        let groupBounds = L.featureGroup(tideLayerGroup.getLayers()).getBounds();
        map.fitBounds(groupBounds, { padding: [50, 50] });
    }
});

// FUNGSI MEMBANGUN SIDEBAR KHUSUS PASUT
async function buildTideSidebar(stationName, lat, lon, stationCode) {
    const detailSidebar = document.getElementById('detail-sidebar');
    const sidebarContent = document.getElementById('sidebar-content');
    
    detailSidebar.classList.remove('-translate-x-[120%]');
    sidebarContent.innerHTML = `<div class="text-center py-10"><span class="animate-pulse text-blue-600 font-bold text-sm">📡 Mengambil data sensor pasut...</span></div>`;

    try {
        // KITA KIRIM 'stationCode' BUKAN LAT/LON LAGI!
        const res = await fetch(`https://api-webgis-kalteng.onrender.com/api/tide?station_code=${stationCode}`);
        const data = await res.json();

        // TAMBAHKAN BLOK PENGAMAN INI
        if (data.error) {
             sidebarContent.innerHTML = `
                <div class="p-4 bg-red-50 rounded border border-red-200 mt-4">
                    <h4 class="text-red-700 font-bold text-xs uppercase mb-1">🚨 Koneksi API Gagal</h4>
                    <p class="text-red-600 text-[11px]">${data.error}</p>
                </div>`;
             return; // Hentikan proses menggambar grafik
        }

        let html = `
            <div class="border-b pb-2 mb-3 border-blue-100 flex justify-between items-start">
                <div>
                    <label class="text-[10px] font-bold text-blue-900 uppercase">Stasiun Observasi</label>
                    <p class="text-sm font-extrabold text-blue-700 bg-blue-50 inline-block px-2 py-1 rounded mt-1">${stationName}</p>
                </div>
                <a href="https://api-webgis-kalteng.onrender.com/api/tide?lat=${lat}&lon=${lon}" target="_blank" download="Tide_${stationName.replace(/\s+/g, '_')}.json" class="text-[9px] bg-green-600 text-white px-2 py-1 rounded hover:bg-green-700 transition cursor-pointer shadow-sm">📥 JSON</a>
            </div>
            
            <div class="flex justify-between text-center bg-gray-50 border border-gray-200 rounded p-2 mb-3 shadow-inner">
                <div><span class="block text-[9px] font-bold text-gray-500 uppercase">HAT (Max)</span><span class="text-xs font-extrabold text-blue-700">${data.hat} m</span></div>
                <div><span class="block text-[9px] font-bold text-gray-500 uppercase">MSL (Mean)</span><span class="text-xs font-extrabold text-gray-700">0.00 m</span></div>
                <div><span class="block text-[9px] font-bold text-gray-500 uppercase">LAT (Min)</span><span class="text-xs font-extrabold text-red-600">${data.lat} m</span></div>
            </div>
            
            <div class="mt-3">
                <label class="text-[9px] font-bold text-gray-500 uppercase">Prediksi Elevasi 7 Hari (Tide Graph)</label>
                <div class="relative h-48 w-full mt-1 bg-white border border-gray-100 rounded shadow-inner"><canvas id="chartTide"></canvas></div>
            </div>
        `;
        sidebarContent.innerHTML = html;

        // Render Grafik Melengkung Indah (Chart.js)
        new Chart(document.getElementById('chartTide').getContext('2d'), {
            type: 'line',
            data: {
                labels: data.times.map(t => t.substring(5, 16)), // Tampilkan Bulan-Tanggal Jam
                datasets: [{
                    label: 'Elevasi (m)',
                    data: data.elevations,
                    borderColor: '#0284c7', // Warna Air Biru Terang
                    backgroundColor: 'rgba(2, 132, 199, 0.25)',
                    fill: true,
                    tension: 0.4, // Membuat garis melengkung seperti ombak sungguhan
                    pointRadius: 0,
                    pointHoverRadius: 4
                }]
            },
            options: {
                maintainAspectRatio: false,
                plugins: { legend: { display: false } },
                interaction: { intersect: false, mode: 'index' },
                scales: {
                    x: { ticks: { font: { size: 8 }, maxTicksLimit: 6 } },
                    y: { 
                        title: { display: true, text: 'Elevasi (m)', font: {size: 8, weight: 'bold'} }, 
                        ticks: { font: { size: 8 } },
                        grid: { color: (ctx) => ctx.tick.value === 0 ? '#000000' : '#e5e7eb' } // Garis tebal di nol (MSL)
                    }
                }
            }
        });

    } catch (e) {
        sidebarContent.innerHTML = `<div class="p-4 bg-red-50 text-red-600 text-xs font-bold rounded border border-red-200">Gagal terhubung ke instrumen pasang surut.</div>`;
    }
}