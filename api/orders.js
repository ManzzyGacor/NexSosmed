const mongoose = require('mongoose');

// Definisi Model Order (Pastikan field sesuai dengan saat kita simpan di buzzer.js)
const OrderSchema = new mongoose.Schema({
    userId: mongoose.Schema.Types.ObjectId,
    orderIdPusat: String, // ID dari BuzzerPanel
    target: String,
    quantity: Number,
    price: Number,
    status: { type: String, default: 'Pending' },
    date: { type: Date, default: Date.now }
});

const Order = mongoose.models.Order || mongoose.model('Order', OrderSchema);

export default async function handler(req, res) {
    if (req.method !== 'GET') return res.status(405).json({ msg: 'Method Not Allowed' });

    const { userId } = req.query;
    if (!userId) return res.status(400).json({ msg: 'UserId dibutuhkan' });

    try {
        if (!mongoose.connections[0].readyState) await mongoose.connect(process.env.MONGODB_URI);
        
        // Ambil 20 pesanan terakhir
        const orders = await Order.find({ userId: userId }).sort({ date: -1 }).limit(20);
        
        res.status(200).json(orders);
    } catch (err) {
        res.status(500).json({ msg: 'Gagal mengambil riwayat' });
    }
}

