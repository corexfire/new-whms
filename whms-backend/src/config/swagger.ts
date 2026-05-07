import swaggerJsdoc from 'swagger-jsdoc';

const options: swaggerJsdoc.Options = {
    definition: {
        openapi: '3.0.0',
        info: {
            title: 'WHMS Backend API',
            version: '1.0.0',
            description: 'Warehouse Management System Backend API Documentation',
            contact: {
                name: 'API Support',
            },
        },
        servers: [
            {
                url: process.env.BASE_URL || 'http://localhost:3001',
                description: 'Development server',
            },
        ],
        components: {
            securitySchemes: {
                bearerAuth: {
                    type: 'http',
                    scheme: 'bearer',
                    bearerFormat: 'JWT',
                },
            },
            schemas: {
                Error: {
                    type: 'object',
                    properties: {
                        error: { type: 'string' },
                    },
                },
                SuccessResponse: {
                    type: 'object',
                    properties: {
                        success: { type: 'boolean' },
                    },
                },
                Pagination: {
                    type: 'object',
                    properties: {
                        total: { type: 'integer' },
                        page: { type: 'integer' },
                        limit: { type: 'integer' },
                        totalPages: { type: 'integer' },
                    },
                },
            },
        },
        security: [{ bearerAuth: [] }],
        tags: [
            { name: 'Auth', description: 'Authentication endpoints' },
            { name: 'Items', description: 'Item management' },
            { name: 'Partners', description: 'Customer & Supplier management' },
            { name: 'Warehouses', description: 'Warehouse & Location management' },
            { name: 'Users', description: 'User & Role management' },
            { name: 'Purchase Orders', description: 'PO management' },
            { name: 'Goods Receipt', description: 'GRN management' },
            { name: 'Journal', description: 'Accounting journal entries' },
            { name: 'Sales Orders', description: 'SO management' },
            { name: 'Pick Lists', description: 'Pick list management' },
            { name: 'Shipping', description: 'Shipping management' },
            { name: 'Inventory', description: 'Inventory operations' },
            { name: 'Stocktake', description: 'Stocktake operations' },
            { name: 'Adjustments', description: 'Stock adjustments' },
            { name: 'Transfers', description: 'Inter-warehouse transfers' },
            { name: 'Monitoring', description: 'Dashboard & monitoring' },
            { name: 'POS', description: 'Point of Sale' },
            { name: 'Shifts', description: 'Shift management' },
            { name: 'Sync', description: 'Offline sync' },
            { name: 'COA', description: 'Chart of Accounts' },
            { name: 'Accounting', description: 'AR/AP management' },
            { name: 'Barcode', description: 'Barcode generation' },
            { name: 'Labels', description: 'Label templates' },
            { name: 'Print', description: 'Printing services' },
        ],
    },
    apis: ['./src/routes/*.ts'],
};

export const swaggerSpec = swaggerJsdoc(options);
