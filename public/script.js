// ==========================================
// 1. SYSTEM CONFIG & DARK MODE (Jalan Duluan)
// ==========================================
const toggleSwitch = document.querySelector('.theme-switch input[type="checkbox"]');
const currentTheme = localStorage.getItem('theme') ? localStorage.getItem('theme') : 'dark';

// Set tema saat load
document.documentElement.setAttribute('data-theme', currentTheme);

if (currentTheme === 'light') {
    if(toggleSwitch) toggleSwitch.checked = true;
}

// Event Listener Ganti Tema
if(toggleSwitch) {
    toggleSwitch.addEventListener('change', function(e) {
        if (e.target.checked) {
            document.documentElement.setAttribute('data-theme', 'light');
            localStorage.setItem('theme', 'light');
        } else {
            document.documentElement.setAttribute('data-theme', 'dark');
            localStorage.setItem('theme', 'dark');
        }    
    });
}

// ==========================================
// 2. SESSION & NAVIGATION
// ==========================================
document.addEventListener('DOMContentLoaded', function() {
    // Cek Session
    const session = localStorage.getItem('user_session');

    if (!session) {
        // Redirect ke login jika bukan di halaman user.html
        if (!window.location.pathname.includes('user.html')) {
            window.location.href = 'user.html';
        }
        return;
    }

    const userData = JSON.parse(session);

    // ISI DATA USER KE UI
    const saldoEl = document.getElementById('display-saldo');
    const namaEl = document.getElementById('display-username');
    const profileName = document.getElementById('profile-name');
    const profileRole = document.getElementById('profile-role');

    if (saldoEl) saldoEl.innerText = `Rp ${userData.balance.toLocaleString('id-ID')}`;
    if (namaEl) namaEl.innerText = userData.username;
    if (profileName) profileName.innerText = userData.username;
    if (profileRole) profileRole.innerText = userData.role;

    // KHUSUS ADMIN (User: man)
    if (userData.username.toLowerCase() === 'man' || userData.role === 'Admin') {
        const adminArea = document.getElementById('admin-area');
        if (adminArea) adminArea.style.display = 'block';
    }
});

function handleLogout() {
    if(confirm("Yakin ingin keluar?")) {
        localStorage.removeItem('user_session');
        window.location.href = 'user.html';
    }
}

// Navigasi Halaman (SPA)
function showPage(pageId, element) {
    const pages = document.querySelectorAll('.page');
    pages.forEach(page => page.classList.remove('active'));

    const target = document.getElementById(pageId);
    if(target) target.classList.add('active');

    const navItems = document.querySelectorAll('.nav-item');
    navItems.forEach(item => item.classList.remove('active'));
    
    if (pageId === 'orders') {
        loadOrderHistory();
    }
    if (element) {
        if(element.classList.contains('nav-item')) {
            element.classList.add('active');
        } else if (element.closest('.nav-item')) {
            element.closest('.nav-item').classList.add('active');
        }
    }
}

// ==========================================
// 3. ORDER SERVICE (SELECT2 + SEARCH)
// ==========================================
let allServicesData = []; 

// Setup Select2 saat dokumen siap
$(document).ready(function() {
    // Inisialisasi Select2
    $('.select2-enable').select2({
        width: '100%',
        dropdownParent: $('#services') // Penting agar search bar bisa diketik
    });

    // Load Data Awal
    loadCategories();

    // Event Listener Select2
    $('#category-select').on('change', function() {
        loadServicesByCategory($(this).val());
    });

    $('#service-select').on('change', function() {
        updateServiceDetails();
    });
});

async function loadCategories() {
    try {
        const res = await fetch('/api/buzzer', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ action: 'services' })
        });
        const result = await res.json();
        
        if (result.status) {
            allServicesData = result.data;
            const categories = [...new Set(allServicesData.map(s => s.category))];
            
            const catSelect = $('#category-select');
            catSelect.empty().append('<option value="">-- Cari Kategori --</option>');
            categories.forEach(cat => catSelect.append(new Option(cat, cat)));
        }
    } catch (err) { console.error("Gagal load layanan"); }
}

// Ganti fungsi loadServicesByCategory di script.js kamu
function loadServicesByCategory(catName) {
    const filtered = allServicesData.filter(s => s.category === catName);
    const svcSelect = $('#service-select');
    svcSelect.empty().append('<option value="">-- Cari Layanan --</option>');
    
    filtered.forEach(svc => {
        // PERBAIKAN: Gunakan svc.id (bukan svc.service) agar terdeteksi provider
        const opt = new Option(svc.name, svc.id); 
        $(opt).attr('data-price', svc.price);
        $(opt).attr('data-min', svc.min);
        $(opt).attr('data-desc', svc.note || "-");
        svcSelect.append(opt);
    });
}

function updateServiceDetails() {
    const selected = $('#service-select').find(':selected');
    const price = selected.attr('data-price');
    const min = selected.attr('data-min');
    
    if (price) {
        document.getElementById('price-per-k').value = `Rp ${parseInt(price).toLocaleString('id-ID')}`;
        document.getElementById('min-order').value = min;
        calculateTotal();
    }
}

function calculateTotal() {
    const qty = document.getElementById('order-quantity').value;
    // Mengambil angka saja dari field "Harga per 1000" (menghilangkan 'Rp' dan titik)
    const priceText = document.getElementById('price-per-k').value.replace(/[^0-9]/g, '');
    const totalEl = document.getElementById('total-price');
    
    if (qty && priceText) {
        // Rumus: (Jumlah / 1000) * Harga per 1000
        const total = (parseInt(qty) / 1000) * parseInt(priceText);
        
        // Tampilkan ke elemen total-price dengan format Rupiah yang rapi
        // Math.ceil digunakan agar tidak ada angka desimal (dibulatkan ke atas)
        totalEl.innerText = `Rp ${Math.ceil(total).toLocaleString('id-ID')}`;
    } else {
        totalEl.innerText = `Rp 0`;
    }
}

async function placeOrder() {
    // 1. Ambil Input
    const serviceId = $('#service-select').val();
    const target = document.getElementById('order-target').value;
    const qty = document.getElementById('order-quantity').value;
    
    // --- TAMBAHAN: Hitung Total Harga untuk dikirim ke Backend ---
    const priceText = document.getElementById('price-per-k').value.replace(/[^0-9]/g, '');
    const priceTotal = Math.ceil((parseInt(qty) / 1000) * parseInt(priceText));
    
    // Validasi Input Kosong
    if(!serviceId || !target || !qty) {
        return alert("Mohon lengkapi semua data pesanan (Layanan, Target, Jumlah)!");
    }

    // 2. Cek Session User
    const sessionRaw = localStorage.getItem('user_session');
    if (!sessionRaw) {
        alert("Sesi habis, silakan login kembali.");
        window.location.href = 'user.html';
        return;
    }
    const session = JSON.parse(sessionRaw);

    // 3. UI Loading
    const btn = document.getElementById('place-order-btn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Memproses...'; 
    btn.disabled = true;

    try {
        // 4. Kirim ke Backend Kita
        const res = await fetch('/api/buzzer', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({
                action: 'order',
                userId: session.id,
                service: serviceId,
                data: target,
                quantity: parseInt(qty),
                priceTotal: priceTotal // <--- WAJIB dikirim agar saldo terpotong
            })
        });

        const result = await res.json();

        // 5. PENANGANAN RESPON (FIX OBJECT OBJECT)
        if (result.status === true) {
            // Sukses: result.data.id berisi ID Order
            alert("✅ Pesanan Berhasil!\nID Order: " + result.data.id);
            
            // Refresh halaman agar saldo di header terupdate otomatis
            location.reload(); 
        } else {
            // Gagal: Ambil pesan error yang rapi
            let pesanError = "Gagal memproses pesanan.";
            
            if (result.data && result.data.msg) {
                pesanError = result.data.msg; 
            } else if (typeof result.data === 'string') {
                pesanError = result.data;
            } else {
                pesanError = JSON.stringify(result.data);
            }

            alert("❌ Gagal: " + pesanError);
        }

    } catch (e) { 
        console.error("Order Error:", e);
        alert("Terjadi kesalahan sistem: " + e.message); 
    } finally { 
        // 6. Kembalikan Tombol
        btn.innerHTML = originalText; 
        btn.disabled = false; 
    }
}

// ==========================================
// 4. TOP UP SYSTEM (QRIS) - FIXED VERSION
// ==========================================
function setAmount(val) {
    const amountInput = document.getElementById('topup-amount');
    if (amountInput) amountInput.value = val;
}

function resetTopUp() {
    if(confirm("Yakin ingin membatalkan pembayaran ini?")) {
        document.getElementById('topup-form-box').style.display = 'block';
        document.getElementById('qris-display').style.display = 'none';
        // Bersihkan area QR agar tidak menumpuk saat buat baru
        const qrContainer = document.getElementById('qrcode');
        if (qrContainer) qrContainer.innerHTML = "";
    }
}

async function processTopUp() {
    const amountInput = document.getElementById('topup-amount');
    const amount = amountInput ? amountInput.value : 0;
    const sessionRaw = localStorage.getItem('user_session');
    
    if (!sessionRaw) return alert("Sesi habis, silakan login kembali.");
    const session = JSON.parse(sessionRaw);

    if (amount < 1000) return alert("Minimal pengisian adalah Rp 1.000");

    const btn = document.querySelector('.btn-pay-now');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Menyiapkan QRIS...'; 
    btn.disabled = true;

    try {
        const res = await fetch('/api/topup', {
            method: 'POST',
            headers: {'Content-Type': 'application/json'},
            body: JSON.stringify({ 
                userId: session.id, 
                amount: parseInt(amount) 
            })
        });
        
        const data = await res.json();

        // PASTIKAN data.payment_number adalah string QRIS asli (000201...)
        if (data.payment_number) {
            // Sembunyikan form input, tampilkan area QRIS
            document.getElementById('topup-form-box').style.display = 'none';
            document.getElementById('qris-display').style.display = 'block';
            
            // Hapus isi QR lama sebelum membuat yang baru
            const qrContainer = document.getElementById('qrcode');
            qrContainer.innerHTML = "";

            // LOGIKA PEMBUATAN QRIS YANG MUDAH DI-SCAN
            new QRCode(qrContainer, {
                text: data.payment_number, // Teks mentah dari Pakasir
                width: 256,               // Ukuran lebih besar agar tidak pecah
                height: 256,
                colorDark : "#000000",
                colorLight : "#ffffff",
                // Level H (High) atau M (Medium) membantu scan jika gambar agak buram
                correctLevel : QRCode.CorrectLevel.M 
            });

            // Update info total harga di bawah QR
            const totalDisplay = document.getElementById('qris-total');
            if (totalDisplay) {
                totalDisplay.innerText = `Rp ${data.total_payment.toLocaleString('id-ID')}`;
            }
            
            // Mulai pengecekan saldo otomatis (Polling)
            startPolling(data.order_id);
            
        } else {
            alert("Gagal mendapatkan kode pembayaran dari server Pakasir.");
        }
    } catch (e) { 
        console.error("Topup Error:", e);
        alert("Terjadi kesalahan koneksi ke server."); 
    } finally { 
        btn.innerHTML = originalText; 
        btn.disabled = false; 
    }
}

function startPolling(orderId) {
    // Cek setiap 5 detik apakah pembayaran sudah masuk
    const pollInterval = setInterval(async () => {
        try {
            const res = await fetch(`/api/check-status?order_id=${orderId}`);
            const data = await res.json();

            // Jika status sukses di database (diupdate oleh webhook.js)
            if (data.status === 'completed' || data.status === 'success') {
                clearInterval(pollInterval);
                alert("Pembayaran Berhasil! Saldo Anda telah diperbarui.");
                location.reload(); // Refresh untuk update angka saldo di header
            }
        } catch (e) {
            console.error("Gagal mengecek status pembayaran...");
        }
    }, 5000); 

    // Berhenti cek otomatis setelah 15 menit agar tidak membebani server
    setTimeout(() => clearInterval(pollInterval), 15 * 60 * 1000);
}

async function loadOrderHistory() {
    const session = JSON.parse(localStorage.getItem('user_session'));
    const container = document.getElementById('order-list-container'); // Pastikan ID ini ada di HTML
    
    if (!container) return;
    container.innerHTML = '<div class="loader-inline"><i class="fas fa-spinner fa-spin"></i> Memuat riwayat...</div>';

    try {
        // 1. Ambil data dari database kita
        const res = await fetch(`/api/orders?userId=${session.id}`);
        const orders = await res.json();

        if (orders.length === 0) {
            container.innerHTML = '<div class="empty-state">Belum ada riwayat pesanan.</div>';
            return;
        }

        let html = `
            <table class="history-table">
                <thead>
                    <tr>
                        <th>ID Order</th>
                        <th>Target</th>
                        <th>Jumlah</th>
                        <th>Status</th>
                    </tr>
                </thead>
                <tbody>
        `;

        for (const order of orders) {
            // 2. Ambil status asli dari Provider secara realtime
            const statusRes = await fetch('/api/buzzer', {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify({ action: 'status', id: order.orderIdPusat })
            });
            const statusData = await statusRes.json();
            
            // Gunakan status dari provider jika ada, jika tidak gunakan status DB
            const liveStatus = statusData.status ? statusData.data.status : order.status;
            const badgeClass = getStatusClass(liveStatus);

            html += `
                <tr>
                    <td><small>#${order.orderIdPusat}</small></td>
                    <td><div class="truncate">${order.target}</div></td>
                    <td>${order.quantity}</td>
                    <td><span class="status-badge ${badgeClass}">${liveStatus}</span></td>
                </tr>
            `;
        }

        html += '</tbody></table>';
        container.innerHTML = html;

    } catch (e) {
        container.innerHTML = '<div class="error-msg">Gagal memuat data.</div>';
    }
}

function getStatusClass(status) {
    status = status.toLowerCase();
    if (status.includes('success')) return 'bg-success';
    if (status.includes('process') || status.includes('progress')) return 'bg-warning';
    if (status.includes('error') || status.includes('fail') || status.includes('partial')) return 'bg-danger';
    return 'bg-secondary';
}