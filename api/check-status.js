const mongoose = require('mongoose');

export default async function handler(req, res) {
    const { order_id } = req.query;

    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const Deposit = mongoose.models.Deposit;

        const deposit = await Deposit.findOne({ order_id: order_id });

        if (!deposit) {
            return res.status(404).json({ status: 'not_found' });
        }

        // Kembalikan status ke frontend (pending atau completed)
        res.status(200).json({ status: deposit.status });
    } catch (err) {
        res.status(500).json({ error: 'DB Error' });
    }
}