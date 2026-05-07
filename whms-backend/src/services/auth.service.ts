import { prisma } from '../index';
import bcrypt from 'bcrypt';
import { generateToken, JwtPayload } from '../utils/jwt';

export class AuthService {
    
    static async login(email: string, password: string) {
        // Find user with complete payload (roles & permissions)
        const user = await prisma.user.findUnique({
            where: { email },
            include: {
                role: {
                    include: {
                        permissions: true
                    }
                }
            }
        });

        if (!user || (!user.isActive)) {
            throw new Error('User not found or disabled.');
        }

        // Validate password
        const isValid = await bcrypt.compare(password, user.passwordHash);
        if (!isValid) {
            throw new Error('Invalid credentials.');
        }

        // Map abstract permissions
        const mappedPermissions = user.role.permissions.map((p: any) => `${p.action}:${p.resource}`);
        
        // Setup payload
        const payload: JwtPayload = {
            id: user.id,
            email: user.email,
            role: user.role.name,
            permissions: mappedPermissions
        };

        const token = generateToken(payload);

        return {
            accessToken: token,
            user: {
                id: user.id,
                email: user.email,
                name: user.name,
                role: user.role.name,
            },
            permissions: mappedPermissions
        };
    }
}
