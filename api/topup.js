// File: api/topup.js
import axios from 'axios';
import mongoose from 'mongoose';

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
    if (!userId || amount < 1000) return res.status(400).json({ msg: 'Minimal deposit Rp 1.000' });

    await mongoose.connect(process.env.MONGODB_URI);
    
    // Buat Order ID Unik
    const order_id = `TOPUP-${Date.now()}-${Math.floor(Math.random() * 1000)}`;

    try {
        // Request ke Pakasir
        const response = await axios.post('https://app.pakasir.com/api/transactioncreate/qris', {
            project: process.env.PAKASIR_PROJECT, // ID Project Pakasir
            order_id: order_id,
            amount: parseInt(amount),
            api_key: process.env.PAKASIR_API_KEY
        });

        const result = response.data;

        // Cek respon Pakasir (Biasanya ada di result.data.qr_string atau result.payment_number)
        // Sesuaikan dengan respon asli Pakasir, biasanya untuk QRIS dia mengembalikan string.
        let qrString = "";
        
        // Logika Fallback mengambil QR String (Tergantung update API Pakasir)
        if (result.status === 'success' && result.data && result.data.qr_string) {
            qrString = result.data.qr_string;
        } else if (result.payment) {
             qrString = result.payment; // Kadang di sini
        }

        if (qrString) {
            // Simpan ke DB "Pending"
            const newDeposit = new Deposit({
                userId: new mongoose.Types.ObjectId(userId),
                order_id: order_id,
                amount: parseInt(amount),
                status: 'pending'
            });
            await newDeposit.save();

            // Kembalikan format yang diminta script.js
            return res.status(200).json({
                payment_number: qrString, // String QRIS untuk qrcode.js
                total_payment: parseInt(amount),
                order_id: order_id
            });
        }
        
        res.status(400).json({ msg: 'Gagal mendapatkan QRIS dari Pakasir.' });

    } catch (err) {
        console.error("Topup Error:", err.message);
        res.status(500).json({ msg: 'Server Error', error: err.message });
    }
}