import { Socket } from 'socket.io';
import { verifyToken, JwtPayload } from '../utils/jwt';

export interface AuthenticatedSocket extends Socket {
    user?: JwtPayload;
}

/**
 * Socket.IO Authentication Middleware
 * Verifies JWT token from socket.handshake.auth.token
 * Attaches decoded user payload to socket.user
 */
export const socketAuthMiddleware = (socket: AuthenticatedSocket, next: (err?: Error) => void) => {
    const token = socket.handshake.auth?.token;

    if (!token) {
        return next(new Error('Authentication error: Token not provided'));
    }

    try {
        const decoded = verifyToken(token);
        
        if (!decoded) {
            return next(new Error('Authentication error: Invalid or expired token'));
        }

        // Attach user to socket for use in event handlers
        socket.user = decoded;
        next();
    } catch (err) {
        console.error('[SocketIO Auth] Token verification failed:', err);
        return next(new Error('Authentication error: Token verification failed'));
    }
};

/**
 * Room-based authorization middleware
 * Ensures user can only join rooms they have access to
 */
export const canJoinRoom = (socket: AuthenticatedSocket, room: string): boolean => {
    if (!socket.user) return false;
    
    // Admin can join any room
    if (socket.user.role === 'admin') return true;
    
    // User can join their own room (e.g., user:user_id)
    if (room === `user:${socket.user.id}`) return true;
    
    // Check if room matches user's warehouse/branch
    if (room.startsWith('warehouse:') && socket.user.permissions.includes('warehouse:read')) {
        return true;
    }
    
    return false;
};
