// SPA Navigation Logic
function showPage(pageId, element) {
    // Sembunyikan semua halaman
    const pages = document.querySelectorAll('.page');
    pages.forEach(page => page.classList.remove('active'));

    // Tampilkan halaman yang diklik
    document.getElementById(pageId).classList.add('active');

    // Update state navigasi (warna icon)
    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => item.classList.remove('active'));
    
    // Jika klik dari nav-item, beri kelas active
    if (element && element.classList.contains('nav-item')) {
        element.classList.add('active');
    }
}

// Dark/Light Mode Logic
const toggleSwitch = document.querySelector('.theme-switch input[type="checkbox"]');
const currentTheme = localStorage.getItem('theme') ? localStorage.getItem('theme') : 'dark';

// Set tema awal saat load
document.documentElement.setAttribute('data-theme', currentTheme);
if (currentTheme === 'light') {
    toggleSwitch.checked = true;
}

function switchTheme(e) {
    if (e.target.checked) {
        document.documentElement.setAttribute('data-theme', 'light');
        localStorage.setItem('theme', 'light');
    } else {
        document.documentElement.setAttribute('data-theme', 'dark');
        localStorage.setItem('theme', 'dark');
    }    
}

toggleSwitch.addEventListener('change', switchTheme, false);

 const qtyInput = document.getElementById('order-quantity');
const pricePerKInput = document.getElementById('price-per-k');
const totalPriceDisplay = document.getElementById('total-price');

qtyInput.addEventListener('input', () => {
    // Ambil angka saja dari harga/1000 (misal: "Rp 1500" -> 1500)
    const pricePerK = parseInt(pricePerKInput.value.replace(/[^0-9]/g, '')) || 0;
    const qty = parseInt(qtyInput.value) || 0;

    const total = (qty / 1000) * pricePerK;
    
    totalPriceDisplay.innerText = new Intl.NumberFormat('id-ID', {
        style: 'currency',
        currency: 'IDR',
        maximumFractionDigits: 0
    }).format(total);
});

 // Fungsi mengambil riwayat pesanan dari DB kita
async function loadOrderHistory() {
    const userId = "USER_ID_DARI_SESSION"; // Ganti dengan ID user yang login
    const orderList = document.getElementById('order-list-container');
    orderList.innerHTML = '<p class="loading-text">Memuat pesanan...</p>';

    try {
        // Anggap kita buat API khusus untuk get riwayat: /api/orders?userId=...
        const response = await fetch(`/api/my-orders?userId=${userId}`);
        const orders = await response.json();

        orderList.innerHTML = ''; // Clear loading

        orders.forEach(order => {
            const card = document.createElement('div');
            card.className = 'order-item';
            card.innerHTML = `
                <div class="order-head">
                    <strong>${order.serviceName}</strong>
                    <span class="badge status-${order.status.toLowerCase()}">${order.status}</span>
                </div>
                <p>Target: ${order.target}</p>
                <div class="order-footer">
                    <small>ID: #${order.orderIdPusat}</small>
                    ${order.status === 'Success' ? `<button class="btn-refill" onclick="requestRefill('${order.orderIdPusat}')">Refill</button>` : ''}
                </div>
            `;
            orderList.appendChild(card);
            
            // Auto Update Status jika masih Pending/Processing
            if (['Pending', 'Processing'].includes(order.status)) {
                checkRealtimeStatus(order.orderIdPusat, order._id);
            }
        });
    } catch (err) {
        orderList.innerHTML = '<p>Gagal memuat riwayat.</p>';
    }
}

// Fungsi cek status ke pusat (Proxy)
async function checkRealtimeStatus(pusatId, mongoId) {
    const response = await fetch('/api/buzzer', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'status', id: pusatId })
    });
    const result = await response.json();
    
    if (result.status) {
        // Jika status di pusat berubah (misal: "Success"), update UI atau kirim update ke DB
        console.log(`Status Order ${pusatId}: ${result.data.status}`);
        // Logic update tampilan status badge di sini...
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

//TOP UP SALDO
 async function processTopUp() {
    const amount = document.getElementById('topup-amount').value;
    if (amount < 1000) return alert("Minimal Rp 1.000");

    const btn = document.querySelector('.btn-main-large');
    btn.disabled = true;
    btn.innerText = "Processing...";

    try {
        const response = await fetch('/api/topup', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ 
                userId: localStorage.getItem('userId'), // Ambil ID user dari session
                amount: amount 
            })
        });
        const data = await response.json();

        if (data.payment_number) {
            // Sembunyikan form, tampilkan QRIS
            document.getElementById('topup-form').style.display = 'none';
            document.getElementById('qris-display').style.display = 'block';
            
            // Generate QR Code dari payment_number (QR String Pakasir)
            document.getElementById('qrcode').innerHTML = ""; // Clear
            new QRCode(document.getElementById("qrcode"), {
                text: data.payment_number,
                width: 200,
                height: 200
            });

            document.getElementById('qris-total').innerText = `Rp ${data.total_payment.toLocaleString()}`;
            document.getElementById('qris-expired').innerText = data.expired_at;

            // Jalankan polling untuk cek status (opsional)
            startPolling(data.order_id, data.total_payment);
        }
    } catch (err) {
        alert("Gagal menghubungi server Pakasir.");
    } finally {
        btn.disabled = false;
        btn.innerText = "Buat QRIS";
    }
}

// Fungsi Polling (Advanced Check)
function startPolling(orderId, amount) {
    const checkInterval = setInterval(async () => {
        const response = await fetch(`/api/check-status?order_id=${orderId}&amount=${amount}`);
        const result = await response.json();
        
        if (result.status === 'completed') {
            clearInterval(checkInterval);
            alert("Top Up Berhasil! Saldo telah ditambahkan.");
            location.reload();
        }
    }, 5000); // Cek tiap 5 detik
}
 // Memasukkan angka cepat
function setAmount(val) {
    document.getElementById('topup-amount').value = val;
}

// Reset view jika dibatalkan
function resetTopUp() {
    if(confirm("Yakin ingin membatalkan pembayaran ini?")) {
        document.getElementById('topup-form-box').style.display = 'block';
        document.getElementById('qris-display').style.display = 'none';
        // Hapus polling jika ada
    }
}

// Modifikasi sedikit processTopUp untuk handle UI
async function processTopUp() {
    const amount = document.getElementById('topup-amount').value;
    if (amount < 1000) {
        alert("Nominal minimal adalah Rp 1.000");
        return;
    }

    // Tampilkan loading state
    const btn = document.querySelector('.btn-pay-now');
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Membuat Invoice...';
    btn.disabled = true;

    try {
        // ... kode fetch ke /api/topup tetap sama ...
        
        // Sembunyikan input, tampilkan QRIS dengan animasi smooth
        document.getElementById('topup-form-box').style.display = 'none';
        const qrisView = document.getElementById('qris-display');
        qrisView.style.display = 'block';
        qrisView.classList.add('animate-fadeIn'); // tambahkan class animasi di CSS jika perlu
        
        // Render QR dan Polling...
    } catch (err) {
        alert("Server sedang sibuk, coba lagi nanti.");
    } finally {
        btn.innerHTML = '<i class="fas fa-qrcode"></i> Bayar Sekarang';
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
                
                // Tampilan Centang Hijau (Success UI)
                const qrisContainer = document.getElementById('qris-display');
                qrisContainer.innerHTML = `
                    <div style="text-align:center; padding: 40px 20px;">
                        <div class="success-icon" style="font-size: 80px; color: #2ecc71; margin-bottom: 20px;">
                            <i class="fas fa-check-circle"></i>
                        </div>
                        <h2 style="color: var(--text-main);">Pembayaran Berhasil!</h2>
                        <p style="color: var(--text-sub);">Saldo Anda telah otomatis ditambahkan.</p>
                        <button onclick="location.reload()" class="btn-main" style="margin-top:20px; width:100%;">Kembali ke Beranda</button>
                    </div>
                `;
                
                // Putar suara notifikasi jika perlu
                // new Audio('success.mp3').play();
            }
        } catch (e) {
            console.error("Polling error...");
        }
    }, 3000); // Cek setiap 3 detik
}

//JIKA ADMIN
 function loadProfile(username) {
    const profileContainer = document.querySelector('.menu-list');
    
    // Jika username adalah 'man', tambahkan tombol Admin Control
    if (username === 'man') {
        const adminBtn = document.createElement('div');
        adminBtn.className = 'menu-link admin-special';
        adminBtn.innerHTML = `<i class="fas fa-user-shield"></i> Admin Control <i class="fas fa-chevron-right"></i>`;
        adminBtn.onclick = () => window.location.href = 'admin.html';
        profileContainer.prepend(adminBtn); // Letakkan paling atas
    }
}
//PESANAN BUZZER
let allServices = [];

// 1. Ambil Data Layanan dari API saat aplikasi dibuka
async function loadServices() {
    try {
        const response = await fetch('/api/buzzer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ action: 'services' })
        });
        const result = await response.json();
        
        if (result.status) {
            allServices = result.data;
            populateCategories();
        }
    } catch (err) {
        console.error("Gagal memuat layanan:", err);
    }
}

// 2. Masukkan Kategori ke Dropdown
function populateCategories() {
    const categorySelect = document.getElementById('category-select');
    const categories = [...new Set(allServices.map(s => s.category))];
    
    categories.forEach(cat => {
        let opt = document.createElement('option');
        opt.value = cat;
        opt.innerHTML = cat;
        categorySelect.appendChild(opt);
    });
}

// 3. Update Layanan berdasarkan Kategori yang dipilih
document.getElementById('category-select').addEventListener('change', function() {
    const serviceSelect = document.getElementById('service-select');
    serviceSelect.innerHTML = '<option value="">-- Pilih Layanan --</option>';
    
    const filtered = allServices.filter(s => s.category === this.value);
    filtered.forEach(s => {
        let opt = document.createElement('option');
        opt.value = s.id;
        opt.dataset.price = s.price;
        opt.dataset.min = s.min;
        opt.dataset.desc = s.note || "Tidak ada deskripsi.";
        opt.innerHTML = s.name;
        serviceSelect.appendChild(opt);
    });
});

// 4. Tampilkan Detail Harga & Deskripsi saat Layanan dipilih
document.getElementById('service-select').addEventListener('change', function() {
    const selected = this.options[this.selectedIndex];
    if (!selected.value) return;
    
    document.getElementById('price-per-k').value = `Rp ${selected.dataset.price}`;
    document.getElementById('min-order').value = selected.dataset.min;
    document.getElementById('service-desc').innerHTML = `<i class="fas fa-info-circle"></i> ${selected.dataset.desc}`;
    updateTotalPrice();
});

// 5. Kirim Pesanan (Suntik!)
document.getElementById('place-order-btn').addEventListener('click', async () => {
    const btn = document.getElementById('place-order-btn');
    const payload = {
        action: 'order',
        service: document.getElementById('service-select').value,
        data: document.getElementById('order-target').value,
        quantity: document.getElementById('order-quantity').value
    };
    
    if (!payload.service || !payload.data || !payload.quantity) {
        return alert("Mohon lengkapi semua data!");
    }
    
    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...';
    
    try {
        const response = await fetch('/api/buzzer', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });
        const result = await response.json();
        
        if (result.status) {
            alert(`Pesanan Berhasil! ID: ${result.data.id}`);
            showPage('orders'); // Pindah ke halaman riwayat
        } else {
            alert(`Gagal: ${result.data}`);
        }
    } catch (err) {
        alert("Terjadi kesalahan koneksi.");
    } finally {
        btn.disabled = false;
        btn.innerHTML = '<i class="fas fa-rocket"></i> Submit Pesanan';
    }
});

// Panggil fungsi load saat start
loadServices();
// Simulasi Loading Saldo
window.addEventListener('load', () => {
    console.log("NexSosmed Ready!");
    // Kamu bisa tambahkan fetch API BuzzerPanel di sini nanti
});

