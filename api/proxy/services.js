import axios from 'axios';

export default async function handler(req, res) {
    const API_KEY = process.env.BUZZER_API_KEY; // Taruh di Vercel Dashboard
    const SECRET_KEY = process.env.BUZZER_SECRET_KEY;

    try {
        const response = await axios.post('https://buzzerpanel.id/api/json.php', {
            api_key: API_KEY,
            secret_key: SECRET_KEY,
            action: 'services'
        });

        res.status(200).json(response.data);
    } catch (err) {
        res.status(500).json({ msg: 'Gagal mengambil layanan' });
    }
}