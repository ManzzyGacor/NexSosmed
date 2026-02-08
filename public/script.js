// ==========================================
// BAGIAN 1: SESSION & UI UTAMA (KODE LAMA)
// ==========================================
document.addEventListener('DOMContentLoaded', function() {
    // Ambil data session
    const session = localStorage.getItem('user_session');

    if (!session) {
        // Jika belum login, paksa ke halaman login (user.html)
        // Kecuali jika memang sedang di halaman user.html
        if (!window.location.pathname.includes('user.html')) {
            window.location.href = 'user.html';
        }
        return;
    }

    const userData = JSON.parse(session);

    // ISI SALDO DAN NAMA KE UI
    const saldoEl = document.getElementById('display-saldo'); 
    const namaEl = document.getElementById('display-username'); 
    
    // Isi Profil di halaman Profil
    const profileName = document.getElementById('profile-name');
    const profileRole = document.getElementById('profile-role');

    if (saldoEl) saldoEl.innerText = `Rp ${userData.balance.toLocaleString('id-ID')}`;
    if (namaEl) namaEl.innerText = userData.username;
    
    if (profileName) profileName.innerText = userData.username;
    if (profileRole) profileRole.innerText = userData.role;

    // JIKA USER ADALAH 'man', TAMPILKAN TOMBOL ADMIN
    if (userData.username.toLowerCase() === 'man' || userData.role === 'Admin') {
        const adminBtn = document.getElementById('admin-btn-nav');
        if (adminBtn) adminBtn.style.display = 'block';
    }

    // Load Riwayat Pesanan (Otomatis ambil ID dari session)
    if(document.getElementById('orders')) {
        loadOrderHistory(userData.id); 
    }
});

// SPA Navigation Logic
function showPage(pageId, element) {
    // Sembunyikan semua halaman
    const pages = document.querySelectorAll('.page');
    pages.forEach(page => page.classList.remove('active'));

    // Tampilkan halaman yang diklik
    const targetPage = document.getElementById(pageId);
    if(targetPage) targetPage.classList.add('active');

    // Update state navigasi (warna icon)
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => item.classList.remove('active'));
    
    // Jika klik dari nav-item, beri kelas active
    if (element) {
        // Cek apakah element itu sendiri nav-item atau parentnya
        if(element.classList.contains('nav-item')) {
            element.classList.add('active');
        } else if (element.closest('.nav-item')) {
            element.closest('.nav-item').classList.add('active');
        }
    }
}

// Dark/Light Mode Logic
const toggleSwitch = document.querySelector('.theme-switch input[type="checkbox"]');
const currentTheme = localStorage.getItem('theme') ? localStorage.getItem('theme') : 'dark';

document.documentElement.setAttribute('data-theme', currentTheme);
if (toggleSwitch) {
    if (currentTheme === 'light') {
        toggleSwitch.checked = true;
    }
    toggleSwitch.addEventListener('change', function(e) {
        if (e.target.checked) {
            document.documentElement.setAttribute('data-theme', 'light');
            localStorage.setItem('theme', 'light');
        } else {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
        }    
    }, false);
}


// ==========================================
// BAGIAN 2: LOGIKA LAYANAN BARU (SELECT2)
// ==========================================
// Variabel Global untuk layanan
let allServicesData = []; 

// Fungsi Utama Load Kategori (Dipanggil saat start)
async function loadCategories() {
    try {
        const res = await fetch('/api/buzzer', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ action: 'services' })
        });
        const result = await res.json();
        
        if (result.status) {
            allServicesData = result.data; // Simpan semua data
            
            // Ambil Kategori Unik
            const categories = [...new Set(allServicesData.map(s => s.category))];
            
            // Isi Dropdown Kategori (Menggunakan jQuery untuk Select2)
            const catSelect = $('#category-select');
            catSelect.empty().append('<option value="">-- Cari Kategori --</option>');
            
            categories.forEach(cat => {
                catSelect.append(new Option(cat, cat));
            });
        }
    } catch (err) {
        console.error("Gagal load layanan:", err);
    }
}

// Dipanggil saat Select2 Kategori berubah
function loadServicesByCategory(categoryName) {
    if (!categoryName) return;

    // Filter layanan sesuai kategori
    const filteredServices = allServicesData.filter(s => s.category === categoryName);
    
    // Isi Dropdown Layanan
    const svcSelect = $('#service-select');
    svcSelect.empty().append('<option value="">-- Cari Layanan --</option>');
    
    filteredServices.forEach(svc => {
        // Simpan data lengkap di attribute html element option
        const option = new Option(svc.name, svc.service); // text, value (ID layanan)
        
        // Kita simpan data lain sebagai attribute agar mudah diambil
        $(option).attr('data-price', svc.price);
        $(option).attr('data-min', svc.min);
        $(option).attr('data-max', svc.max);
        $(option).attr('data-desc', svc.note || "-");
        
        svcSelect.append(option);
    });
    
    // Reset form harga
    document.getElementById('price-per-k').value = "Rp 0";
    document.getElementById('min-order').value = "0";
}

// Dipanggil saat Select2 Layanan berubah
function updateServiceDetails() {
    // Ambil data dari option yang dipilih via Select2
    const selectedOption = $('#service-select').find(':selected');
    const price = selectedOption.attr('data-price');
    const min = selectedOption.attr('data-min');
    const desc = selectedOption.attr('data-desc');

    if (price) {
        document.getElementById('price-per-k').value = `Rp ${parseInt(price).toLocaleString('id-ID')}`;
        document.getElementById('min-order').value = min;
        
        // Tampilkan Deskripsi
        const descBox = document.getElementById('service-desc');
        const descText = document.getElementById('desc-text');
        if(descBox && descText) {
            if(desc && desc !== 'null') {
                descBox.style.display = 'block';
                descText.innerText = desc;
            } else {
                descBox.style.display = 'none';
            }
        }
        calculateTotal(); // Hitung ulang total jika quantity sudah terisi
    }
}

// Hitung Total Harga Real-time
function calculateTotal() {
    const qtyInput = document.getElementById('order-quantity');
    const priceInput = document.getElementById('price-per-k');
    const totalDisplay = document.getElementById('total-price');

    if (!qtyInput || !priceInput) return;

    const qty = parseInt(qtyInput.value) || 0;
    // Ambil angka saja dari string "Rp 1.500" -> 1500
    const pricePerK = parseInt(priceInput.value.replace(/[^0-9]/g, '')) || 0;

    if (qty > 0 && pricePerK > 0) {
        const total = (qty / 1000) * pricePerK;
        totalDisplay.innerText = `Rp ${Math.ceil(total).toLocaleString('id-ID')}`;
    } else {
        totalDisplay.innerText = "Rp 0";
    }
}

// SUBMIT ORDER (Fungsi Baru)
async function placeOrder() {
    const serviceId = $('#service-select').val(); // Ambil value dari Select2
    const target = document.getElementById('order-target').value;
    const quantity = document.getElementById('order-quantity').value;
    const pricePerKVal = document.getElementById('price-per-k').value.replace(/[^0-9]/g, '');
    
    if (!serviceId || !target || !quantity) {
        return alert("Mohon lengkapi semua data pesanan!");
    }

    const priceTotal = (parseInt(quantity) / 1000) * parseInt(pricePerKVal);
    const session = JSON.parse(localStorage.getItem('user_session'));

    if (priceTotal > session.balance) {
        return alert("Saldo tidak mencukupi! Silakan Top Up.");
    }

    const btn = document.getElementById('place-order-btn');
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';

    try {
        const res = await fetch('/api/buzzer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'order',
                userId: session.id, // ID User dari MongoDB
                service: serviceId,
                data: target,
                quantity: parseInt(quantity),
                priceTotal: Math.ceil(priceTotal)
            })
        });

        const result = await res.json();

        if (result.status) {
            alert(`Pesanan Berhasil! ID: ${result.data.id}`);
            
            // Kurangi saldo di tampilan lokal biar update instan
            session.balance -= Math.ceil(priceTotal);
            localStorage.setItem('user_session', JSON.stringify(session));
            location.reload(); // Refresh halaman untuk update semua
        } else {
            alert(`Gagal: ${result.data}`);
        }
    } catch (err) {
        alert("Terjadi kesalahan koneksi.");
        console.error(err);
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-rocket"></i> Submit Pesanan';
    }
}


// ==========================================
// BAGIAN 3: INITIALISASI JQUERY (SELECT2)
// ==========================================
// Kode ini wajib ada agar dropdown bisa di-search
if (typeof $ !== 'undefined') {
    $(document).ready(function() {
        // Inisialisasi Select2 pada class .select2-enable
        $('.select2-enable').select2({
            width: '100%',
            dropdownParent: $('#services') // Agar dropdown muncul pas di dalam tab services
        });

        // Load data kategori pertama kali
        loadCategories();

        // Event Listener JQUERY untuk Select2
        $('#category-select').on('change', function() {
            const catName = $(this).val();
            loadServicesByCategory(catName); 
        });

        $('#service-select').on('change', function() {
            updateServiceDetails();
        });
    });
}


// ==========================================
// BAGIAN 4: RIWAYAT PESANAN (KODE LAMA UPDATE)
// ==========================================
async function loadOrderHistory(userId) {
    const orderList = document.getElementById('order-list-container');
    // Cek apakah elemen ada (karena mungkin user belum buka tab riwayat)
    if (!orderList) return; 

    orderList.innerHTML = '<p class="loading-text" style="text-align:center; padding:20px;">Memuat pesanan...</p>';

    try {
        // Panggil API history (Anda perlu buat api/my-orders.js jika belum ada)
        // Atau gunakan logika localStorage sementara jika backend belum siap
        const response = await fetch('/api/buzzer', { // Sementara pakai endpoint buzzer check status
             // Disini idealnya endpoint khusus get history by userID
             // Saya asumsikan Anda akan membuatnya, atau gunakan mock data
        });
        
        // KARENA KITA BELUM BUAT API GET HISTORY SPESIFIK USER,
        // SEMENTARA KITA TAMPILKAN PLACEHOLDER ATAU LOGIKA MOCKUP
        // AGAR TIDAK ERROR
        orderList.innerHTML = '<p style="text-align:center;">Riwayat pesanan akan muncul di sini.</p>';
        
    } catch (err) {
        orderList.innerHTML = '<p style="text-align:center;">Gagal memuat riwayat.</p>';
    }
}

// Fungsi tombol Refill
async function requestRefill(orderId) {
    if (!confirm("Ajukan refill untuk pesanan ini?")) return;

    const response = await fetch('/api/buzzer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'refill', id: orderId })
    });
    const result = await response.json();

    if (result.status) {
        alert("Permintaan Refill Berhasil dikirim!");
    } else {
        alert("Gagal Refill: " + result.data);
    }
}


// ==========================================
// BAGIAN 5: TOP UP & QRIS (KODE LAMA)
// ==========================================
function setAmount(val) {
    const input = document.getElementById('topup-amount');
    if(input) input.value = val;
}

function resetTopUp() {
    if(confirm("Yakin ingin membatalkan pembayaran ini?")) {
        document.getElementById('topup-form-box').style.display = 'block';
        document.getElementById('qris-display').style.display = 'none';
        location.reload();
    }
}

async function processTopUp() {
    const amount = document.getElementById('topup-amount').value;
    const session = JSON.parse(localStorage.getItem('user_session'));

    if (amount < 1000) {
        alert("Nominal minimal adalah Rp 1.000");
        return;
    }

    // Tampilkan loading state
    const btn = document.querySelector('.btn-pay-now');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Membuat Invoice...';
    btn.disabled = true;

    try {
        const response = await fetch('/api/topup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                userId: session.id, // ID User Mongo
                amount: amount 
            })
        });
        const data = await response.json();

        if (data.payment_number) {
            // Sembunyikan form, tampilkan QRIS
            document.getElementById('topup-form-box').style.display = 'none';
            document.getElementById('qris-display').style.display = 'block';
            
            // Generate QR Code
            document.getElementById('qrcode').innerHTML = ""; 
            // Pastikan library QRCode.js sudah ada di index.html
            if(typeof QRCode !== 'undefined') {
                new QRCode(document.getElementById("qrcode"), {
                    text: data.payment_number,
                    width: 200,
                    height: 200
                });
            } else {
                document.getElementById('qrcode').innerText = "QR Library Missing";
            }

            document.getElementById('qris-total').innerText = `Rp ${data.total_payment.toLocaleString()}`;
            document.getElementById('qris-expired').innerText = data.expired_at;

            // Jalankan polling
            startPolling(data.order_id);
        } else {
            alert("Gagal membuat pesanan Topup.");
        }
    } catch (err) {
        console.error(err);
        alert("Server sedang sibuk, coba lagi nanti.");
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

function startPolling(orderId) {
    const pollInterval = setInterval(async () => {
        try {
            const res = await fetch(`/api/check-status?order_id=${orderId}`);
            const data = await res.json();

            if (data.status === 'completed') {
                clearInterval(pollInterval);
                
                const qrisContainer = document.getElementById('qris-display');
                qrisContainer.innerHTML = `
                    <div style="text-align:center; padding: 40px 20px;">
                        <div style="font-size: 80px; color: #2ecc71; margin-bottom: 20px;">
                            <i class="fas fa-check-circle"></i>
                        </div>
                        <h2 style="color: var(--text-main);">Pembayaran Berhasil!</h2>
                        <p style="color: var(--text-sub);">Saldo Anda telah otomatis ditambahkan.</p>
                        <button onclick="location.reload()" class="btn-main-large" style="margin-top:20px;">Kembali ke Beranda</button>
                    </div>
                `;
            }
        } catch (e) {
            console.error("Polling error...");
        }
    }, 3000); // Cek setiap 3 detik
}