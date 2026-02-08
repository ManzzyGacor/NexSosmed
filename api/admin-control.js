const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Inisialisasi Model (Cek apakah model sudah ada untuk menghindari Error Overwrite)
const User = mongoose.models.User || mongoose.model('User', new mongoose.Schema({
    username: { type: String, required: true },
    password: { type: String, required: true },
    balance: { type: Number, default: 0 }
}));

const Order = mongoose.models.Order || mongoose.model('Order', new mongoose.Schema({
    userId: mongoose.Schema.Types.ObjectId,
    price: Number,
    status: String,
    date: { type: Date, default: Date.now }
}));

const Config = mongoose.models.Config || mongoose.model('Config', new mongoose.Schema({
    key: String,
    value: Number
}));

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ msg: 'Method Not Allowed' });

    try {
        await mongoose.connect(process.env.MONGODB_URI);
        
        const { action, adminUser, targetUser, amount, newPassword, margin } = req.body;

        // AUTHENTICATION: Hanya 'man' yang boleh masuk
        if (adminUser !== 'man') {
            return res.status(403).json({ msg: 'Akses ilegal terdeteksi!' });
        }

        // --- 1. GET STATS (Untuk Dashboard Admin) ---
        if (action === 'get_stats') {
            const totalUsers = await User.countDocuments();
            const totalOrders = await Order.countDocuments();
            
            // Hitung Estimasi Profit (Misal 10% dari total transaksi sukses)
            const orders = await Order.find({ status: 'Success' });
            const marginData = await Config.findOne({ key: 'margin' });
            const currentMargin = marginData ? marginData.value : 10;
            
            // Profit = Total Harga Jual * (Margin / (100 + Margin))
            const totalRevenue = orders.reduce((acc, curr) => acc + (curr.price || 0), 0);
            const totalProfit = Math.floor(totalRevenue * (currentMargin / (100 + currentMargin)));

            return res.status(200).json({
                totalUsers,
                totalOrders,
                totalProfit,
                margin: currentMargin,
                recentOrders: await Order.find().sort({ date: -1 }).limit(10)
            });
        }

        // --- 2. FIND USER (Cari User berdasarkan Username) ---
        if (action === 'find_user') {
            const user = await User.findOne({ username: targetUser }).select('-password');
            if (!user) return res.status(404).json({ msg: 'User tidak ditemukan' });
            return res.status(200).json(user);
        }

        // --- 3. UPDATE USER (Saldo & Password) ---
        if (action === 'update_user') {
            const updateFields = { balance: parseInt(amount) };
            
            if (newPassword && newPassword.trim() !== "") {
                const salt = await bcrypt.genSalt(10);
                updateFields.password = await bcrypt.hash(newPassword, salt);
            }

            const updatedUser = await User.findOneAndUpdate(
                { username: targetUser },
                { $set: updateFields },
                { new: true }
            );

            if (!updatedUser) return res.status(404).json({ msg: 'Gagal update user' });
            return res.status(200).json({ msg: 'User berhasil diperbarui' });
        }

        // --- 4. UPDATE MARGIN (Pengaturan Global) ---
        if (action === 'update_margin') {
            await Config.findOneAndUpdate(
                { key: 'margin' },
                { value: parseInt(margin) },
                { upsert: true }
            );
            return res.status(200).json({ msg: 'Margin berhasil disimpan' });
        }

        return res.status(400).json({ msg: 'Action tidak valid' });

    } catch (err) {
        console.error("Admin API Error:", err);
        return res.status(500).json({ msg: 'Server Error', error: err.message });
    }
}