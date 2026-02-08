const mongoose = require('mongoose');

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Forbidden');

    const { order_id, amount, status } = req.body;

    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const Deposit = mongoose.models.Deposit;
        const User = mongoose.models.User;

        // 1. Cari data deposit yang masih pending
        const deposit = await Deposit.findOne({ order_id: order_id });

        if (!deposit) return res.status(404).send('Order not found');
        
        // 2. CEK DOUBLE TOP UP: Jika status sudah completed, jangan proses lagi
        if (deposit.status === 'completed') {
            return res.status(200).send('Already Processed');
        }

        if (status === 'completed') {
            // 3. Update status deposit menjadi completed
            deposit.status = 'completed';
            await deposit.save();

            // 4. Tambahkan saldo ke user secara atomik
            await User.findByIdAndUpdate(deposit.userId, {
                $inc: { balance: deposit.amount }
            });

            console.log(`Topup Berhasil: ${order_id} - Rp${amount}`);
            return res.status(200).send('Webhook Received');
        }
        
        res.status(200).send('Status not completed');
    } catch (err) {
        res.status(500).send('Webhook Error');
    }
}