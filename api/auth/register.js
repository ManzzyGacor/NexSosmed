import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const UserSchema = new mongoose.Schema({
    username: { type: String, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    password: { type: String, required: true },
    balance: { type: Number, default: 0 },
    role: { type: String, default: 'Member' } // Default adalah Member
});

const User = mongoose.models.User || mongoose.model('User', UserSchema);

export default async function handler(req, res) {
    if (req.method !== 'POST') return res.status(405).json({ msg: 'Method Not Allowed' });
    
    try {
        if (!mongoose.connections[0].readyState) {
            await mongoose.connect(process.env.MONGODB_URI);
        }
        
        const { username, email, password } = req.body;
        
        // Cek apakah user sudah ada
        let userExists = await User.findOne({ $or: [{ username }, { email }] });
        if (userExists) return res.status(400).json({ msg: 'Username atau Email sudah terdaftar' });
        
        // LOGIKA ADMIN OTOMATIS
        // Jika username adalah 'man', set role menjadi 'Admin'
        let finalRole = 'Member';
        if (username.toLowerCase() === 'man') {
            finalRole = 'Admin';
        }
        
        const hashedPassword = await bcrypt.hash(password, 10);
        
        const newUser = new User({
            username,
            email,
            password: hashedPassword,
            role: finalRole, // Role otomatis terpasang di sini
            balance: finalRole === 'Admin' ? 999999999 : 0 // Bonus: Kasih saldo tak terhingga jika admin (opsional)
        });
        
        await newUser.save();
        res.status(201).json({
            success: true,
            msg: `Registrasi Berhasil sebagai ${finalRole}`
        });
        
    } catch (err) {
        res.status(500).json({ msg: 'Server Error', error: err.message });
    }
}