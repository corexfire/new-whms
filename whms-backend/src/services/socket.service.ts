import { Server as SocketIOServer, Socket } from 'socket.io';
import { createServer } from 'http';
import express from 'express';
import { AuthenticatedSocket, socketAuthMiddleware } from '../middlewares/socket-auth.middleware';

interface ServerToClientEvents {
    'notification': (data: NotificationPayload) => void;
    'order:status': (data: OrderStatusPayload) => void;
    'tracking:update': (data: TrackingUpdatePayload) => void;
    'warehouse:alert': (data: WarehouseAlertPayload) => void;
}

interface ClientToServerEvents {
    'join:room': (room: string) => void;
    'leave:room': (room: string) => void;
    'tracking:location': (data: TrackingLocationData) => void;
}

export interface NotificationPayload {
    id: string;
    type: 'info' | 'success' | 'warning' | 'error';
    title: string;
    message: string;
    timestamp: string;
    read?: boolean;
}

export interface OrderStatusPayload {
    orderId: string;
    status: 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
    updatedAt: string;
    updatedBy?: string;
}

export interface WarehouseAlertPayload {
    warehouseId: string;
    alertType: 'stock_low' | 'stock_critical' | 'expiry_warning' | 'capacity_warning';
    message: string;
    severity: 'low' | 'medium' | 'high';
}

export interface TrackingLocationData {
    shipmentId: string;
    latitude: number;
    longitude: number;
    timestamp: string;
}

export interface TrackingUpdatePayload {
    shipmentId: string;
    latitude: number;
    longitude: number;
    timestamp: string;
}

let io: SocketIOServer<ClientToServerEvents, ServerToClientEvents> | null = null;

export const initializeSocketIO = (app: express.Application) => {
    const httpServer = createServer(app);
    
    io = new SocketIOServer<ClientToServerEvents, ServerToClientEvents>(httpServer, {
        cors: {
            origin: process.env.FRONTEND_URL || 'http://localhost:3000',
            methods: ['GET', 'POST'],
            credentials: true,
        },
        transports: ['websocket', 'polling'],
    });

    io.use(socketAuthMiddleware);

    io.on('connection', (socket: AuthenticatedSocket) => {
        console.log(`[SocketIO] User connected: ${socket.user?.email} (${socket.id})`);

        socket.on('join:room', (room: string) => {
            socket.join(room);
            console.log(`[SocketIO] ${socket.user?.email} joined room: ${room}`);
        });

        socket.on('leave:room', (room: string) => {
            socket.leave(room);
            console.log(`[SocketIO] ${socket.user?.email} left room: ${room}`);
        });

        socket.on('tracking:location', (data: TrackingLocationData) => {
            io?.to(`tracking:${data.shipmentId}`).emit('tracking:update', {
                shipmentId: data.shipmentId,
                latitude: data.latitude,
                longitude: data.longitude,
                timestamp: data.timestamp,
            } as any);
        });

        socket.on('disconnect', () => {
            console.log(`[SocketIO] User disconnected: ${socket.user?.email} (${socket.id})`);
        });
    });

    return { httpServer, io };
};

export const getIO = () => {
    if (!io) {
        throw new Error('Socket.IO not initialized. Call initializeSocketIO first.');
    }
    return io;
};

export const emitToUser = (userId: string, event: string, data: any) => {
    getIO().to(`user:${userId}`).emit(event as any, data);
};

export const emitToRoom = (room: string, event: string, data: any) => {
    getIO().to(room).emit(event as any, data);
};

export const emitToAll = (event: string, data: any) => {
    getIO().emit(event as any, data);
};
