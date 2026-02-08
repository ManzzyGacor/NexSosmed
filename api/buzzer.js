const axios = require('axios');
const qs = require('qs');
const mongoose = require('mongoose');

const BASE_URL = 'https://buzzerpanel.id/api/json.php';
const API_KEY = process.env.BUZZER_API_KEY;
const SECRET_KEY = process.env.BUZZER_SECRET_KEY;

// Inisialisasi Model Database
const Config = mongoose.models.Config || mongoose.model('Config', new mongoose.Schema({ key: String, value: Number }));
const User = mongoose.models.User || mongoose.model('User', new mongoose.Schema({ username: String, balance: Number }));
const Order = mongoose.models.Order || mongoose.model('Order', new mongoose.Schema({
    userId: mongoose.Schema.Types.ObjectId,
    orderIdPusat: String,
    serviceName: String,
    target: String,
    quantity: Number,
    price: Number,
    status: { type: String, default: 'Pending' },
    date: { type: Date, default: Date.now }
}));

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ status: false, data: 'Method Not Allowed' });
    
    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const { action, userId, service, data, quantity, priceTotal, id } = req.body;

        // 1. AMBIL KONFIGURASI MARGIN (Default 10% jika belum diatur di Admin)
        const marginConfig = await Config.findOne({ key: 'margin' });
        const marginPercent = marginConfig ? marginConfig.value : 10;

        // --- ACTION: SERVICES (Tampilkan harga + profit ke user) ---
        if (action === 'services') {
            const response = await axios.post(BASE_URL, qs.stringify({ 
                api_key: API_KEY, secret_key: SECRET_KEY, action: 'services' 
            }));
            
            if (response.data.status) {
                // Modifikasi harga pusat menjadi harga user berdasarkan margin
                const adjustedServices = response.data.data.map(s => {
                    const originalPrice = parseFloat(s.price);
                    const markup = originalPrice * (marginPercent / 100);
                    // Pembulatan ke atas agar harga cantik (Contoh: 1543 -> 1600)
                    const finalPrice = Math.ceil((originalPrice + markup) / 100) * 100; 
                    return { ...s, price: finalPrice };
                });
                return res.status(200).json({ status: true, data: adjustedServices });
            }
            return res.status(400).json(response.data);
        }

        // --- ACTION: ORDER (SUNTIK & POTONG SALDO) ---
        if (action === 'order') {
            const user = await User.findById(userId);
            if (!user) return res.status(404).json({ status: false, data: 'User tidak ditemukan' });
            
            // Validasi Saldo
            if (user.balance < priceTotal) {
                return res.status(400).json({ status: false, data: 'Saldo tidak mencukupi!' });
            }

            // Kirim ke API BuzzerPanel
            const payload = { api_key: API_KEY, secret_key: SECRET_KEY, action: 'order', service, data, quantity };
            const response = await axios.post(BASE_URL, qs.stringify(payload), {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            if (response.data.status) {
                // Potong saldo user dan simpan pesanan jika sukses di pusat
                user.balance -= priceTotal;
                await user.save();

                const newOrder = new Order({
                    userId: user._id,
                    orderIdPusat: response.data.data.id,
                    target: data,
                    quantity: quantity,
                    price: priceTotal,
                    status: 'Success' // Status awal setelah submit berhasil
                });
                await newOrder.save();

                return res.status(200).json(response.data);
            } else {
                return res.status(400).json({ status: false, data: response.data.data });
            }
        }

        // --- ACTION: STATUS (CEK REALTIME) ---
        if (action === 'status') {
            const response = await axios.post(BASE_URL, qs.stringify({ 
                api_key: API_KEY, secret_key: SECRET_KEY, action: 'status', id 
            }));
            
            if (response.data.status) {
                // Sinkronkan status ke DB lokal jika diperlukan
                await Order.updateOne({ orderIdPusat: id }, { status: response.data.data.status });
            }
            return res.status(200).json(response.data);
        }

        // --- ACTION: REFILL (PERMINTAAN ISI ULANG) ---
        if (action === 'refill') {
            const response = await axios.post(BASE_URL, qs.stringify({ 
                api_key: API_KEY, secret_key: SECRET_KEY, action: 'refill', id 
            }));
            return res.status(200).json(response.data);
        }

        // --- ACTION: STATUS REFILL ---
        if (action === 'status_refill') {
            const response = await axios.post(BASE_URL, qs.stringify({ 
                api_key: API_KEY, secret_key: SECRET_KEY, action: 'status_refill', id 
            }));
            return res.status(200).json(response.data);
        }

        return res.status(400).json({ status: false, data: 'Action tidak dikenal' });

    } catch (err) {
        console.error("Buzzer Error:", err.message);
        return res.status(500).json({ status: false, data: 'Kesalahan Server Proxy' });
    }
}