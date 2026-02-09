import axios from 'axios';
import qs from 'qs';
import mongoose from 'mongoose';

// --- KONFIGURASI ---
// Ganti URL ini jika provider kamu pakai URL lain
const BASE_URL = 'https://buzzerpanel.id/api/json.php'; 
const API_KEY = process.env.BUZZER_API_KEY;
const SECRET_KEY = process.env.BUZZER_SECRET_KEY;

// --- MODEL DATABASE ---
const Config = mongoose.models.Config || mongoose.model('Config', new mongoose.Schema({ key: String, value: Number }));
const User = mongoose.models.User || mongoose.model('User', new mongoose.Schema({ 
    username: String, 
    balance: { type: Number, default: 0 },
    role: { type: String, default: 'Member' }
}));
const Order = mongoose.models.Order || mongoose.model('Order', new mongoose.Schema({
    userId: mongoose.Schema.Types.ObjectId,
    orderIdPusat: String,
    serviceId: String,
    serviceName: String, // Tambahan biar tau ini layanan apa di database
    target: String,
    quantity: Number,
    price: Number, 
    status: { type: String, default: 'Pending' },
    date: { type: Date, default: Date.now }
}));

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ status: false, data: { msg: 'Method Not Allowed' } });

    // Pastikan koneksi DB
    if (!mongoose.connections[0].readyState) {
        await mongoose.connect(process.env.MONGODB_URI);
    }

    const { action, userId, service, data, quantity, priceTotal, id } = req.body;

    try {
        // --- 1. GET SERVICES (DAFTAR LAYANAN) ---
        if (action === 'services') {
            // Kita pakai 'services' standar agar kompatibel. 
            // Kalau mau speed/status, ubah jadi 'services_1' atau 'services2' di sini.
            const payload = qs.stringify({ api_key: API_KEY, secret_key: SECRET_KEY, action: 'services' });
            
            const response = await axios.post(BASE_URL, payload);

            if (response.data.status) {
                // Ambil Margin Profit dari DB (Default 20%)
                const conf = await Config.findOne({ key: 'margin' });
                const margin = conf ? conf.value : 20; 

                const services = response.data.data.map(item => {
                    const originalPrice = parseFloat(item.price);
                    const markupPrice = originalPrice + (originalPrice * (margin / 100));
                    // Pembulatan ke atas kelipatan 100 perak
                    const finalPrice = Math.ceil(markupPrice / 100) * 100;

                    return {
                        id: item.id,       // PENTING: Ini ID yang wajib dikirim saat order
                        name: item.name,
                        category: item.category,
                        price: finalPrice, // Harga Jual User
                        min: item.min,
                        max: item.max,
                        note: item.note
                    };
                });
                
                return res.status(200).json({ status: true, data: services });
            }
            return res.status(400).json({ status: false, data: { msg: "Gagal mengambil layanan dari pusat." } });
        }

        // --- 2. ORDER (SUNTIK SOSMED) ---
        if (action === 'order') {
            const user = await User.findById(userId);
            if (!user) return res.status(404).json({ status: false, data: { msg: 'User tidak ditemukan' } });

            // Validasi Saldo Awal (PENTING)
            // Kita percaya priceTotal dari frontend dulu untuk validasi cepat
            // Pastikan frontend kirim priceTotal (integer)
            if (user.balance < parseInt(priceTotal)) {
                 return res.status(400).json({ status: false, data: { msg: 'Saldo tidak mencukupi!' } });
            }

            // Kirim ke Provider
            const payloadProvider = {
                api_key: API_KEY,
                secret_key: SECRET_KEY,
                action: 'order',
                service: service, // INI HARUS ID (ANGKA), CONTOH: 1423
                data: data,       // Target URL/Username
                quantity: quantity
            };
            
            // Handle Komen/Custom Comments jika ada
            if (req.body.komen) payloadProvider.komen = req.body.komen;

            const response = await axios.post(BASE_URL, qs.stringify(payloadProvider));
            const resultPusat = response.data;

            if (resultPusat.status === true) {
                // SUKSES DI PUSAT -> BARU POTONG SALDO
                user.balance -= parseInt(priceTotal);
                await user.save();

                // Simpan Riwayat
                await Order.create({
                    userId: user._id,
                    orderIdPusat: resultPusat.data.id,
                    serviceId: service,
                    target: data,
                    quantity: quantity,
                    price: priceTotal,
                    status: 'Success' // Status awal order sukses
                });

                return res.status(200).json(resultPusat);
            } else {
                // GAGAL DI PUSAT (Misal: Layanan maintenance / Target salah)
                // Tangkap pesan errornya
                const errorMsg = resultPusat.data && resultPusat.data.msg ? resultPusat.data.msg : "Gagal memproses di pusat";
                return res.status(400).json({ status: false, data: { msg: errorMsg } });
            }
        }
        
        // --- 3. STATUS CHECK & REFILL ---
        if (['status', 'refill'].includes(action)) {
            const payload = qs.stringify({ api_key: API_KEY, secret_key: SECRET_KEY, action: action, id: id });
            const response = await axios.post(BASE_URL, payload);
            return res.status(200).json(response.data);
        }

        return res.status(400).json({ status: false, data: { msg: 'Action tidak valid' } });

    } catch (err) {
        console.error("API Error:", err.message);
        return res.status(500).json({ status: false, data: { msg: 'Server Error: ' + err.message } });
    }
}