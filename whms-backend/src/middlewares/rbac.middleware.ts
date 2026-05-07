import { Request, Response, NextFunction } from 'express';

// Check if user has any of the allowed roles
export const requireRole = (allowedRoles: string[]) => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (req.user.role === 'SUPER_ADMIN') {
            return next(); // Super admin bypass
        }

        if (!allowedRoles.includes(req.user.role)) {
            return res.status(403).json({ error: 'Forbidden: Insufficient role' });
        }

        return next();
    };
};

// Check if user has specific permission
export const requirePermission = (action: string, resource: string) => {
    return (req: Request, res: Response, next: NextFunction) => {
        if (!req.user) {
            return res.status(401).json({ error: 'Unauthorized' });
        }

        if (req.user.role === 'SUPER_ADMIN' || req.user.permissions.includes('*:*')) {
            return next(); // Super admin bypass
        }

        const requiredPerm = `${action}:${resource}`;
        
        if (req.user.permissions.includes(requiredPerm) || req.user.permissions.includes(`*:${resource}`)) {
            return next();
        }

        return res.status(403).json({ error: `Forbidden: Missing permission [${requiredPerm}]` });
    };
};
