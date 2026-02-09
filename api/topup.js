const axios = require('axios');
const mongoose = require('mongoose');

// DEFINISI MODEL (Wajib ada di setiap file API)
const DepositSchema = new mongoose.Schema({
    userId: mongoose.Schema.Types.ObjectId,
    order_id: { type: String, unique: true },
    amount: Number,
    status: { type: String, default: 'pending' },
    date: { type: Date, default: Date.now }
});
const Deposit = mongoose.models.Deposit || mongoose.model('Deposit', DepositSchema);

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ msg: 'Method Not Allowed' });
    const { userId, amount } = req.body;

    try {
        if (!mongoose.connections[0].readyState) await mongoose.connect(process.env.MONGODB_URI);
        const order_id = `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

        const response = await axios.post('https://app.pakasir.com/api/transactioncreate/qris', {
            project: process.env.PAKASIR_PROJECT,
            order_id: order_id,
            amount: parseInt(amount),
            api_key: process.env.PAKASIR_API_KEY
        });

        if (response.data.payment) {
            await Deposit.create({
                userId: new mongoose.Types.ObjectId(userId),
                order_id: order_id,
                amount: parseInt(amount)
            });

            // Gabungkan data pembayaran dengan order_id lokal kita
            return res.status(200).json({
                ...response.data.payment,
                order_id: order_id // Pastikan ID ini terkirim ke frontend
            });
        }
        res.status(400).json({ msg: 'Gagal dari Pakasir' });
    } catch (err) {
        res.status(500).json({ msg: err.message });
    }
}