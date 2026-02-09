const mongoose = require('mongoose');

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).send('Forbidden');

    // Pakasir biasanya mengirim order_id dan status
    const { order_id, status, amount } = req.body;

    try {
        await mongoose.connect(process.env.MONGODB_URI);
        
        // Pastikan Model sudah terinisialisasi
        const Deposit = mongoose.models.Deposit || mongoose.model('Deposit', new mongoose.Schema({
            userId: mongoose.Schema.Types.ObjectId,
            order_id: String,
            amount: Number,
            status: String
        }));
        const User = mongoose.models.User;

        // 1. Cari data deposit
        const deposit = await Deposit.findOne({ order_id: order_id });

        if (!deposit) {
            console.log("Deposit tidak ditemukan untuk ID:", order_id);
            return res.status(404).send('Order not found');
        }
        
        // 2. Jika sudah sukses sebelumnya, jangan proses lagi
        if (deposit.status === 'completed') {
            return res.status(200).send('Already Processed');
        }

        // 3. Cek Status (Pakasir biasanya kirim 'success' atau 'completed')
        if (status === 'completed' || status === 'success') {
            // Update status deposit
            deposit.status = 'completed';
            await deposit.save();

            // 4. Tambahkan saldo ke user
            // Gunakan deposit.amount dari database agar lebih aman (menghindari manipulasi amount dari luar)
            await User.findByIdAndUpdate(deposit.userId, {
                $inc: { balance: deposit.amount }
            });

            console.log(`[SUCCESS] Saldo Rp${deposit.amount} masuk ke User ID: ${deposit.userId}`);
            return res.status(200).send('OK');
        }
        
        res.status(200).send('Payment Pending');
    } catch (err) {
        console.error("Webhook Error:", err);
        res.status(500).send('Internal Error');
    }
}