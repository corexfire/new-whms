import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

const SECRET = process.env.JWT_SECRET || 'secret-key';
const EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d';

export interface JwtPayload {
    id: string;
    email: string;
    role: string;
    permissions: string[];
}

declare global {
    namespace Express {
        interface Request {
            user?: JwtPayload;
        }
    }
}

export const generateToken = (payload: JwtPayload): string => {
    return jwt.sign(payload, SECRET, { expiresIn: EXPIRES_IN as any });
};

export const verifyToken = (token: string): JwtPayload | null => {
    try {
        return jwt.verify(token, SECRET) as JwtPayload;
    } catch (e) {
        return null;
    }
};

export const authMiddleware = (req: Request, res: Response, next: NextFunction): void => {
    const authHeader = req.headers.authorization;
    if (!authHeader?.startsWith('Bearer ')) {
        res.status(401).json({ error: 'Auth token missing' });
        return;
    }

    const token = authHeader.split(' ')[1];
    const payload = verifyToken(token);
    if (!payload) {
        res.status(401).json({ error: 'Invalid or expired token' });
        return;
    }

    req.user = payload;
    next();
};
