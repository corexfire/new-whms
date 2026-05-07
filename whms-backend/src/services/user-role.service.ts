import { prisma } from '../index';
import bcrypt from 'bcrypt';

export interface CreateUserDto {
    email: string;
    password: string;
    name: string;
    roleId: string;
}

export interface UpdateUserDto {
    name?: string;
    roleId?: string;
    isActive?: boolean;
}

export interface CreateRoleDto {
    name: string;
    description?: string;
    permissions: Array<{ action: string; resource: string }>;
}

export interface UpdateRoleDto {
    name?: string;
    description?: string;
}

export class UserService {
    private async hashPassword(password: string): Promise<string> {
        return bcrypt.hash(password, 12);
    }

    async create(dto: CreateUserDto) {
        const passwordHash = await this.hashPassword(dto.password);

        return prisma.user.create({
            data: {
                email: dto.email,
                passwordHash,
                name: dto.name,
                roleId: dto.roleId,
            },
            include: {
                role: {
                    include: { permissions: true },
                },
            },
        });
    }

    async findAll(params: { search?: string; roleId?: string; page?: number; limit?: number }) {
        const { search, roleId, page = 1, limit = 20 } = params;
        const skip = (page - 1) * limit;

        const where: any = {};
        if (search) {
            where.OR = [
                { email: { contains: search, mode: 'insensitive' } },
                { name: { contains: search, mode: 'insensitive' } },
            ];
        }
        if (roleId) where.roleId = roleId;

        const [users, total] = await Promise.all([
            prisma.user.findMany({
                where,
                skip,
                take: limit,
                orderBy: { name: 'asc' },
                include: { role: true },
            }),
            prisma.user.count({ where }),
        ]);

        return {
            users: users.map(u => ({ ...u, passwordHash: undefined })),
            total,
            page,
            limit,
            totalPages: Math.ceil(total / limit),
        };
    }

    async findById(id: string) {
        const user = await prisma.user.findUnique({
            where: { id },
            include: {
                role: {
                    include: { permissions: true },
                },
            },
        });
        if (user) {
            (user as any).passwordHash = undefined;
        }
        return user;
    }

    async findByEmail(email: string) {
        return prisma.user.findUnique({
            where: { email },
            include: { role: { include: { permissions: true } } },
        });
    }

    async update(id: string, dto: UpdateUserDto) {
        return prisma.user.update({
            where: { id },
            data: dto,
            include: { role: true },
        });
    }

    async updatePassword(id: string, currentPassword: string, newPassword: string) {
        const user = await prisma.user.findUnique({ where: { id } });
        if (!user) throw new Error('User not found');

        const isValid = await bcrypt.compare(currentPassword, user.passwordHash);
        if (!isValid) throw new Error('Current password is incorrect');

        const newHash = await this.hashPassword(newPassword);
        return prisma.user.update({
            where: { id },
            data: { passwordHash: newHash },
        });
    }

    async resetPassword(id: string, newPassword: string) {
        const passwordHash = await this.hashPassword(newPassword);
        return prisma.user.update({
            where: { id },
            data: { passwordHash },
        });
    }

    async delete(id: string) {
        return prisma.user.update({
            where: { id },
            data: { isActive: false },
        });
    }
}

export class RoleService {
    async create(dto: CreateRoleDto) {
        const { permissions, ...roleData } = dto;

        return prisma.role.create({
            data: {
                ...roleData,
                permissions: {
                    create: permissions.map(p => ({
                        action: p.action,
                        resource: p.resource,
                    })),
                },
            },
            include: { permissions: true },
        });
    }

    async findAll() {
        return prisma.role.findMany({
            orderBy: { name: 'asc' },
            include: { _count: { select: { users: true } } },
        });
    }

    async findById(id: string) {
        return prisma.role.findUnique({
            where: { id },
            include: { permissions: true },
        });
    }

    async findByName(name: string) {
        return prisma.role.findUnique({
            where: { name },
            include: { permissions: true },
        });
    }

    async update(id: string, dto: UpdateRoleDto) {
        return prisma.role.update({
            where: { id },
            data: dto,
            include: { permissions: true },
        });
    }

    async updatePermissions(roleId: string, permissions: Array<{ action: string; resource: string }>) {
        await prisma.permission.deleteMany({ where: { roles: { some: { id: roleId } } } });

        return prisma.role.update({
            where: { id: roleId },
            data: {
                permissions: {
                    create: permissions.map(p => ({
                        action: p.action,
                        resource: p.resource,
                    })),
                },
            },
            include: { permissions: true },
        });
    }

    async delete(id: string) {
        const userCount = await prisma.user.count({ where: { roleId: id } });
        if (userCount > 0) {
            throw new Error(`Cannot delete role: ${userCount} users are assigned to this role`);
        }
        return prisma.role.delete({ where: { id } });
    }
}

export class PermissionService {
    async findAll() {
        return prisma.permission.findMany({
            orderBy: [{ resource: 'asc' }, { action: 'asc' }],
        });
    }

    async findByResource(resource: string) {
        return prisma.permission.findMany({
            where: { resource },
            orderBy: { action: 'asc' },
        });
    }
}

export const userService = new UserService();
export const roleService = new RoleService();
export const permissionService = new PermissionService();
