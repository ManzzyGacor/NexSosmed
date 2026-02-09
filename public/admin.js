// Fungsi Pindah Tab
function showTab(tabId) {
    document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
    
    document.getElementById(tabId).classList.add('active');
    event.currentTarget.classList.add('active');

    if(tabId === 'stats') loadStats();
}

// Ambil Data Stats dari API
async function loadStats() {
    const res = await fetch('/api/admin-control', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'get_stats', adminUser: 'man' })
    });
    const data = await res.json();
    
    document.getElementById('count-users').innerText = data.totalUsers;
    document.getElementById('count-orders').innerText = data.totalOrders;
    document.getElementById('count-profit').innerText = `Rp ${data.totalProfit.toLocaleString()}`;
    document.getElementById('input-margin').value = data.margin;
}
// Fungsi Cari User
async function findUser() {
    const targetUsername = document.getElementById('search-username').value;
    const adminSession = JSON.parse(localStorage.getItem('user_session'));

    // Validasi input
    if (!targetUsername) return alert("Masukkan username yang ingin dicari");

    // Tampilkan loading (Opsional)
    const searchBtn = document.getElementById('btn-search');
    searchBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    searchBtn.disabled = true;

    try {
        const response = await fetch('/api/admin-control', { // Sesuaikan dengan path file backendmu
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'find_user',      // Harus sesuai dengan action di admin-control.js
                adminUser: 'man',        // Pengaman wajib di backendmu
                targetUser: targetUsername // Username yang dicari
            })
        });

        const data = await response.json();

        if (response.ok) {
            // Jika ketemu, isi form edit (sesuaikan ID dengan HTML-mu)
            document.getElementById('edit-username').value = data.username;
            document.getElementById('edit-balance').value = data.balance;
            
            // Tampilkan area edit user
            document.getElementById('edit-user-section').style.display = 'block';
        } else {
            alert("Error: " + data.msg); // Akan muncul 'User tidak ditemukan'
        }
    } catch (err) {
        console.error("Fetch Error:", err);
        alert("Gagal menghubungi server.");
    } finally {
        searchBtn.innerHTML = 'Cari';
        searchBtn.disabled = false;
    }
}

// Fungsi Update Saldo/Password (Sekalian ditambahkan agar sinkron dengan backend)
async function updateUser() {
    const target = document.getElementById('edit-username').value;
    const amount = document.getElementById('edit-balance').value;
    const newPass = document.getElementById('edit-password').value;

    try {
        const response = await fetch('/api/admin-control', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'update_user',   // Action ke-3 di backend
                adminUser: 'man',
                targetUser: target,
                amount: amount,
                newPassword: newPass
            })
        });

        const result = await response.json();
        alert(result.msg);
        if (response.ok) location.reload();
    } catch (err) {
        alert("Gagal update");
    }
}
async function updateMargin() {
    const marginValue = document.getElementById('margin-input').value;
    const session = JSON.parse(localStorage.getItem('user_session'));

    try {
        const res = await fetch('/api/admin-control', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                action: 'update_margin',
                adminUser: session.username, // pastikan 'man'
                margin: marginValue
            })
        });

        const result = await res.json();
        
        if (res.ok) {
            alert("✅ " + result.msg); // Muncul notifikasi sukses
            location.reload(); // Refresh untuk melihat perubahan profit
        } else {
            alert("❌ Gagal: " + result.msg);
        }
    } catch (e) {
        alert("Terjadi kesalahan sistem");
    }
}
// Jalankan saat pertama buka
loadStats();