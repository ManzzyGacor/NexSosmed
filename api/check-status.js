const mongoose = require('mongoose');

const Deposit = mongoose.models.Deposit || mongoose.model('Deposit', new mongoose.Schema({
    order_id: String,
    status: String
}));

export default async function handler(req, res) {
    const { order_id } = req.query;
    try {
        if (!mongoose.connections[0].readyState) await mongoose.connect(process.env.MONGODB_URI);
        const deposit = await Deposit.findOne({ order_id: order_id });
        
        if (!deposit) return res.status(404).json({ status: 'not_found' });
        
        // Kirim status terbaru (pending/completed)
        return res.status(200).json({ status: deposit.status });
    } catch (err) {
        return res.status(500).json({ error: 'DB Error' });
    }
}