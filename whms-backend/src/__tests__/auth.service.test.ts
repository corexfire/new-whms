/// <reference types="jest" />
import { beforeEach, describe, expect, it, jest } from '@jest/globals';
import { mockPrisma } from './setup';
import { AuthService } from '../services/auth.service';
import bcrypt from 'bcrypt';

describe('AuthService', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('login', () => {
        it('should return access token for valid credentials', async () => {
            const mockUser = {
                id: 'user-1',
                email: 'admin@test.com',
                name: 'Admin',
                passwordHash: await bcrypt.hash('password123', 10),
                isActive: true,
                role: {
                    name: 'ADMIN',
                    permissions: [{ action: 'read', resource: 'users' }],
                },
            };

            (mockPrisma.user.findUnique as any).mockResolvedValue(mockUser);

            const result = await AuthService.login('admin@test.com', 'password123');

            expect(result).toHaveProperty('accessToken');
            expect(result).toHaveProperty('user');
            expect(result.user.email).toBe('admin@test.com');
            expect(mockPrisma.user.findUnique).toHaveBeenCalledWith({
                where: { email: 'admin@test.com' },
                include: { role: { include: { permissions: true } } },
            });
        });

        it('should throw error for non-existent user', async () => {
            (mockPrisma.user.findUnique as any).mockResolvedValue(null);

            await expect(AuthService.login('nobody@test.com', 'pass')).rejects.toThrow(
                'User not found or disabled.'
            );
        });

        it('should throw error for invalid password', async () => {
            const mockUser = {
                id: 'user-1',
                email: 'admin@test.com',
                name: 'Admin',
                passwordHash: await bcrypt.hash('correctpassword', 10),
                isActive: true,
                role: {
                    name: 'ADMIN',
                    permissions: [],
                },
            };

            (mockPrisma.user.findUnique as any).mockResolvedValue(mockUser);

            await expect(
                AuthService.login('admin@test.com', 'wrongpassword')
            ).rejects.toThrow('Invalid credentials.');
        });

        it('should throw error for inactive user', async () => {
            (mockPrisma.user.findUnique as any).mockResolvedValue(null);

            await expect(AuthService.login('inactive@test.com', 'pass')).rejects.toThrow(
                'User not found or disabled.'
            );
        });
    });
});
