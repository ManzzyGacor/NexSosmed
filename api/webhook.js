const mongoose = require('mongoose');

// DEFINISI MODEL (Agar tidak error 'undefined' saat webhook dipanggil)
const User = mongoose.models.User || mongoose.model('User', new mongoose.Schema({ balance: Number }));
const Deposit = mongoose.models.Deposit || mongoose.model('Deposit', new mongoose.Schema({
    userId: mongoose.Schema.Types.ObjectId,
    order_id: String,
    amount: Number,
    status: String
}));

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Forbidden');
    const { order_id, status } = req.body;

    try {
        if (!mongoose.connections[0].readyState) await mongoose.connect(process.env.MONGODB_URI);
        
        const deposit = await Deposit.findOne({ order_id: order_id });
        if (!deposit) return res.status(404).send('Order not found');
        if (deposit.status === 'completed') return res.status(200).send('Already Processed');

        // Terima status 'completed' atau 'success' sesuai standar gateway
        if (status === 'completed' || status === 'success') {
            deposit.status = 'completed';
            await deposit.save();

            // Tambahkan saldo
            await User.findByIdAndUpdate(deposit.userId, {
                $inc: { balance: deposit.amount }
            });

            return res.status(200).send('OK');
        }
        res.status(200).send('Pending');
    } catch (err) {
        res.status(500).send('Error');
    }
}