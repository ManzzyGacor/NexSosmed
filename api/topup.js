const axios = require('axios');
const mongoose = require('mongoose');

// Schema Deposit Lokal
const DepositSchema = new mongoose.Schema({
    userId: mongoose.Schema.Types.ObjectId,
    order_id: { type: String, unique: true },
    amount: Number,
    status: { type: String, default: 'pending' }, // pending, completed
    date: { type: Date, default: Date.now }
});
const Deposit = mongoose.models.Deposit || mongoose.model('Deposit', DepositSchema);

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ msg: 'Method Not Allowed' });

    const { userId, amount } = req.body;
    if (!userId || amount < 1000) return res.status(400).json({ msg: 'Data tidak valid atau nominal minimal Rp 1.000' });

    await mongoose.connect(process.env.MONGODB_URI);
    const order_id = `INV-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    try {
        const response = await axios.post('https://app.pakasir.com/api/transactioncreate/qris', {
            project: process.env.PAKASIR_PROJECT,
            order_id: order_id,
            amount: parseInt(amount),
            api_key: process.env.PAKASIR_API_KEY
        });

        if (response.data.payment) {
            // Simpan record deposit ke MongoDB
            const newDeposit = new Deposit({
                userId: new mongoose.Types.ObjectId(userId),
                order_id: order_id,
                amount: parseInt(amount)
            });
            await newDeposit.save();

            return res.status(200).json(response.data.payment);
        }
        res.status(400).json({ msg: 'Gagal membuat invoice di Pakasir' });
    } catch (err) {
        res.status(500).json({ msg: 'Server Error', error: err.message });
    }
}