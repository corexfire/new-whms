import { Router } from 'express';
import { AuthController } from '../controllers/auth.controller';
import rateLimit from 'express-rate-limit';
import { requireAuth } from '../middlewares/auth.middleware';

const router = Router();

// Rate limiting for login: max 5 requests per 15 minutes per IP
const loginLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 5,
    message: { error: 'Terlalu banyak percobaan login, silakan coba lagi setelah 15 menit.' },
    standardHeaders: true,
    legacyHeaders: false,
});

router.post('/login', loginLimiter, AuthController.login);

// Contoh Route Terlindungi (Profile)
// Nanti handler nya bisa diimplementasikan ke dalam controller
router.get('/profile', requireAuth, (req, res) => {
    res.json({
        message: 'Akses diotorisasi',
        user: req.user
    });
});

export default router;
