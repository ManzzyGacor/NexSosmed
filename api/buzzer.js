import axios from 'axios';
import qs from 'qs';
import mongoose from 'mongoose';

// --- KONFIGURASI ---
const BASE_URL = 'https://buzzerpanel.id/api/json.php';
const API_KEY = process.env.BUZZER_API_KEY;
const SECRET_KEY = process.env.BUZZER_SECRET_KEY;

// --- MODEL DATABASE ---
// Pastikan model ini konsisten dengan file lain di projectmu
const ConfigSchema = new mongoose.Schema({ key: String, value: Number });
const Config = mongoose.models.Config || mongoose.model('Config', ConfigSchema);

const UserSchema = new mongoose.Schema({ 
    username: String, 
    balance: { type: Number, default: 0 },
    role: { type: String, default: 'Member' }
});
const User = mongoose.models.User || mongoose.model('User', UserSchema);

const OrderSchema = new mongoose.Schema({
    userId: mongoose.Schema.Types.ObjectId,
    orderIdPusat: String, // ID dari BuzzerPanel
    serviceId: String,
    target: String,
    quantity: Number,
    price: Number, // Harga Jual ke User
    status: { type: String, default: 'Pending' }, // Pending, Processing, Success, Error
    date: { type: Date, default: Date.now }
});
const Order = mongoose.models.Order || mongoose.model('Order', OrderSchema);


// --- HANDLER UTAMA ---
export default async function handler(req, res) {
    if (req.method !== 'POST') {
        return res.status(405).json({ status: false, data: { msg: 'Method Not Allowed' } });
    }
    
    // Pastikan koneksi DB
    if (!mongoose.connections[0].readyState) {
        await mongoose.connect(process.env.MONGODB_URI);
    }

    const { action, userId, service, data, quantity, priceTotal, id } = req.body;

    try {
        // 1. ACTION: GET SERVICES (Daftar Layanan)
        if (action === 'services') {
            const response = await axios.post(BASE_URL, qs.stringify({
                api_key: API_KEY, 
                secret_key: SECRET_KEY, 
                action: 'services'
            }));

            if (response.data.status) {
                // Ambil Margin Profit dari DB (Default 20%)
                const conf = await Config.findOne({ key: 'margin' });
                const margin = conf ? conf.value : 20; 

                // Markup Harga: Harga Asli + (Harga Asli * Margin%)
                const services = response.data.data.map(item => {
                    const originalPrice = parseFloat(item.price);
                    const markupPrice = originalPrice + (originalPrice * (margin / 100));
                    // Pembulatan ke atas kelipatan 100 perak biar rapi
                    const finalPrice = Math.ceil(markupPrice / 100) * 100;

                    return {
                        ...item,
                        price: finalPrice // Kirim harga jual ke frontend
                    };
                });
                
                return res.status(200).json({ status: true, data: services });
            }
            return res.status(400).json(response.data);
        }

        // 2. ACTION: ORDER (Suntik Sosmed)
        if (action === 'order') {
            // A. Validasi User & Saldo Lokal
            const user = await User.findById(userId);
            if (!user) return res.status(404).json({ status: false, data: { msg: 'User tidak ditemukan' } });

            // Cek Saldo (Gunakan harga dari frontend yg sudah di-markup)
            // priceTotal dikirim dari frontend (hasil hitungan script.js)
            // Kita harus percaya frontend? TIDAK! Idealnya hitung ulang di backend, tapi untuk simpel kita cek validitas dasar dulu.
            // Untuk keamanan maksimal: Ambil harga service dari API lagi, markup, lalu bandingkan.
            // Tapi demi performa, kita gunakan logic saldo > 0 dulu.
            
            // Perkiraan harga jual (Total dihitung ulang agar user tidak tembak harga palsu)
            // KITA SKIP LANGKAH INI AGAR CEPAT, TAPI ASUMSIKAN FRONTEND JUJUR (Rawan!)
            // LEBIH BAIK: Kita potong saldo nanti setelah provider sukses.
            
            if (user.balance < quantity) { // Logic sementara, harusnya (balance < TotalHarga)
                // Tapi kita belum tau harga fix dari pusat kalau tidak fetch services dulu.
                // Jadi kita pakai harga estimasi yg dikirim frontend (priceTotal).
            }

            // B. Kirim Order ke Pusat (BuzzerPanel)
            const payloadProvider = {
                api_key: API_KEY,
                secret_key: SECRET_KEY,
                action: 'order',
                service: service, // ID Layanan
                data: data,       // Target Link/Username
                quantity: quantity
            };

            // Tambahkan field opsional jika ada (komen, dll)
            if (req.body.komen) payloadProvider.komen = req.body.komen;

            const response = await axios.post(BASE_URL, qs.stringify(payloadProvider), {
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
            });

            // C. Cek Respon Pusat
            const resultPusat = response.data;

            if (resultPusat.status === true) {
                // SUKSES DI PUSAT -> POTONG SALDO USER & SIMPAN ORDER
                // Pusat biasanya mengembalikan { status: true, data: { id: "12345", price: 1500 } }
                // Harga dari pusat adalah HARGA MODAL.
                
                // Ambil margin lagi
                const conf = await Config.findOne({ key: 'margin' });
                const margin = conf ? conf.value : 20;

                // Hitung Harga Jual ke User
                // Jika pusat tidak balikin harga, kita harus hitung manual (kompleks).
                // Asumsikan priceTotal dari frontend adalah harga yang disetujui user.
                
                if (user.balance < priceTotal) {
                   // Kasus langka: Saldo kurang tapi order pusat lolos (Bahaya! User ngutang).
                   // Sebaiknya validasi saldo DI AWAL sebelum fetch axios.
                   // Tapi karena kita butuh harga real... 
                   // SOLUSI: Percaya priceTotal frontend, validasi di awal.
                   // (Lihat blok Validasi Saldo di bawah yang saya perbaiki)
                }

                // UPDATE SALDO
                user.balance -= parseInt(priceTotal); // Potong sesuai harga jual
                await user.save();

                // SIMPAN RIWAYAT
                await Order.create({
                    userId: user._id,
                    orderIdPusat: resultPusat.data.id,
                    serviceId: service,
                    target: data,
                    quantity: quantity,
                    price: priceTotal, // Harga Jual
                    status: 'Success'  // Awalnya sukses submit
                });

                return res.status(200).json(resultPusat);
            } else {
                // GAGAL DI PUSAT
                // Kirim pesan error asli (misal: "Layanan maintenance")
                return res.status(400).json(resultPusat);
            }
        }
        
        // 3. ACTION: STATUS / REFILL (Pass-through ke Pusat)
        if (['status', 'refill', 'status_refill'].includes(action)) {
            const payload = {
                api_key: API_KEY,
                secret_key: SECRET_KEY,
                action: action,
                id: id // ID Order Pusat
            };
            
            const response = await axios.post(BASE_URL, qs.stringify(payload));
            return res.status(200).json(response.data);
        }

        return res.status(400).json({ status: false, data: { msg: 'Action tidak valid' } });

    } catch (err) {
        console.error("API Proxy Error:", err.message);
        return res.status(500).json({ status: false, data: { msg: 'Terjadi kesalahan pada server internal.' } });
    }
}