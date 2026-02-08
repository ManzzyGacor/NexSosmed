const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

// Ambil Model User yang sudah ada
const User = mongoose.models.User || mongoose.model('User', new mongoose.Schema({
    username: { type: String, required: true },
    password: { type: String, required: true },
    balance: { type: Number, default: 0 },
    role: { type: String, default: 'Member' }
}));

export default async function handler(req, res) {
    // Hanya izinkan POST
    if (req.method !== 'POST') return res.status(405).json({ msg: 'Method Not Allowed' });

    try {
        await mongoose.connect(process.env.MONGODB_URI);
        const { username, password } = req.body;

        // 1. Cari user berdasarkan username
        const user = await User.findOne({ username });
        if (!user) {
            return res.status(400).json({ success: false, msg: 'Username tidak terdaftar!' });
        }

        // 2. Bandingkan password yang diinput dengan yang di database (Bcrypt)
        const isMatch = await bcrypt.compare(password, user.password);
        if (!isMatch) {
            return res.status(400).json({ success: false, msg: 'Password salah!' });
        }

        // 3. Jika cocok, kirim data user ke frontend untuk disimpan di Session
        return res.status(200).json({
            success: true,
            msg: 'Login Berhasil!',
            user: {
                id: user._id,
                username: user.username,
                balance: user.balance,
                role: user.role
            }
        });

    } catch (err) {
        return res.status(500).json({ success: false, msg: 'Terjadi kesalahan server' });
    }
}