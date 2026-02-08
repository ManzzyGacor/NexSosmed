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

// Jalankan saat pertama buka
loadStats();