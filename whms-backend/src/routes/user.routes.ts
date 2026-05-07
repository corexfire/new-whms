import { Router, Request, Response } from 'express';
import { userService, roleService, permissionService } from '../services/user-role.service';
import { authMiddleware } from '../utils/jwt';

const router = Router();

router.post('/', authMiddleware, async (req: Request, res: Response) => {
    try {
        const user = await userService.create(req.body);
        return res.status(201).json({ success: true, user });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.get('/', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { search, roleId, page, limit } = req.query;
        const result = await userService.findAll({
            search: search as string,
            roleId: roleId as string,
            page: Number(page) || 1,
            limit: Number(limit) || 20,
        });
        return res.json({ success: true, ...result });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.get('/users/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const user = await userService.findById(String(req.params.id));
        if (!user) return res.status(404).json({ error: 'User not found' });
        return res.json({ success: true, user });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.put('/users/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const user = await userService.update(String(req.params.id), req.body);
        return res.json({ success: true, user });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.put('/users/:id/password', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { currentPassword, newPassword } = req.body;
        await userService.updatePassword(String(req.params.id), currentPassword, newPassword);
        return res.json({ success: true, message: 'Password updated' });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.post('/users/:id/reset-password', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { newPassword } = req.body;
        await userService.resetPassword(String(req.params.id), newPassword);
        return res.json({ success: true, message: 'Password reset' });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.delete('/users/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        await userService.delete(String(req.params.id));
        return res.json({ success: true, message: 'User deactivated' });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.post('/roles', authMiddleware, async (req: Request, res: Response) => {
    try {
        const role = await roleService.create(req.body);
        return res.status(201).json({ success: true, role });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.get('/roles', authMiddleware, async (req: Request, res: Response) => {
    try {
        const roles = await roleService.findAll();
        return res.json({ success: true, roles });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.get('/roles/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const role = await roleService.findById(String(req.params.id));
        if (!role) return res.status(404).json({ error: 'Role not found' });
        return res.json({ success: true, role });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

router.put('/roles/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        const role = await roleService.update(String(req.params.id), req.body);
        return res.json({ success: true, role });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.put('/roles/:id/permissions', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { permissions } = req.body;
        const role = await roleService.updatePermissions(String(req.params.id), permissions);
        return res.json({ success: true, role });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.delete('/roles/:id', authMiddleware, async (req: Request, res: Response) => {
    try {
        await roleService.delete(String(req.params.id));
        return res.json({ success: true, message: 'Role deleted' });
    } catch (error: any) {
        return res.status(400).json({ error: error.message });
    }
});

router.get('/permissions', authMiddleware, async (req: Request, res: Response) => {
    try {
        const { resource } = req.query;
        const permissions = resource
            ? await permissionService.findByResource(resource as string)
            : await permissionService.findAll();
        return res.json({ success: true, permissions });
    } catch (error: any) {
        return res.status(500).json({ error: error.message });
    }
});

export default router;
