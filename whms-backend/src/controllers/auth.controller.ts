import { Request, Response } from 'express';
import { AuthService } from '../services/auth.service';

export class AuthController {
    
    static async login(req: Request, res: Response) {
        try {
            const { email, password } = req.body;
            
            if (!email || !password) {
                return res.status(400).json({ error: 'Email and password are required' });
            }

            const loginData = await AuthService.login(email, password);
            
            return res.status(200).json({
                message: 'Login successful',
                data: loginData
            });
        } catch (error: any) {
            return res.status(401).json({ error: error.message || 'Authentication failed' });
        }
    }

    // Nanti dapat ditambah: profile, change password, reset password
}
