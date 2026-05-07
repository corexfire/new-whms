import { prisma } from '../index';
import { LabelTemplate, LabelElement } from '../types/printer';
import { zplService } from './zpl.service';

export interface CreateTemplateDto {
    name: string;
    type: 'product' | 'shipping' | 'custom' | 'receipt';
    config: {
        width?: number;
        height?: number;
        elements: Omit<LabelElement, 'id'>[];
    };
}

export interface UpdateTemplateDto {
    name?: string;
    config?: {
        width?: number;
        height?: number;
        elements?: Omit<LabelElement, 'id'>[];
    };
}

const generateElementId = (): string => {
    return `el_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
};

const mapDbToTemplate = (db: any): LabelTemplate => ({
    id: db.id,
    name: db.name,
    type: db.type,
    config: {
        width: db.width,
        height: db.height,
        elements: typeof db.elements === 'string' ? JSON.parse(db.elements) : db.elements,
    },
    createdAt: db.createdAt,
    updatedAt: db.updatedAt,
    createdBy: db.createdBy,
});

export class LabelTemplateService {
    async create(dto: CreateTemplateDto, userId?: string): Promise<LabelTemplate> {
        const elements = dto.config.elements.map(el => ({
            ...el,
            id: el.id || generateElementId(),
        }));

        const template = await prisma.labelTemplate.create({
            data: {
                name: dto.name,
                type: dto.type,
                width: dto.config.width,
                height: dto.config.height,
                elements: elements,
                createdBy: userId,
            },
        });

        return mapDbToTemplate(template);
    }

    async findAll(type?: 'product' | 'shipping' | 'custom' | 'receipt'): Promise<LabelTemplate[]> {
        const where = type ? { type } : {};
        
        const templates = await prisma.labelTemplate.findMany({
            where,
            orderBy: { updatedAt: 'desc' },
        });

        return templates.map(mapDbToTemplate);
    }

    async findById(id: string): Promise<LabelTemplate | null> {
        const template = await prisma.labelTemplate.findUnique({
            where: { id },
        });

        return template ? mapDbToTemplate(template) : null;
    }

    async update(id: string, dto: UpdateTemplateDto): Promise<LabelTemplate | null> {
        const updateData: any = {};
        
        if (dto.name) updateData.name = dto.name;
        if (dto.config) {
            if (dto.config.width !== undefined) updateData.width = dto.config.width;
            if (dto.config.height !== undefined) updateData.height = dto.config.height;
            if (dto.config.elements) {
                updateData.elements = dto.config.elements.map(el => ({
                    ...el,
                    id: el.id || generateElementId(),
                }));
            }
        }

        const template = await prisma.labelTemplate.update({
            where: { id },
            data: updateData,
        });

        return mapDbToTemplate(template);
    }

    async delete(id: string): Promise<boolean> {
        try {
            await prisma.labelTemplate.delete({
                where: { id },
            });
            return true;
        } catch {
            return false;
        }
    }

    async generateZPLFromTemplate(
        templateId: string,
        data: Record<string, any>
    ): Promise<{ zpl: string; estimatedLength: number } | null> {
        const template = await this.findById(templateId);
        
        if (!template) return null;

        const { elements, width, height } = template.config;

        const commands: string[] = ['^XA'];
        
        if (width) commands.push(`^PW${width}`);
        if (height) commands.push(`^LL${height}`);

        elements.forEach(element => {
            switch (element.type) {
                case 'text':
                    commands.push(this.generateTextElement(element, data));
                    break;
                case 'barcode':
                    commands.push(this.generateBarcodeElement(element, data));
                    break;
                case 'qrcode':
                    commands.push(this.generateQRCodeElement(element, data));
                    break;
                case 'line':
                    commands.push(this.generateLineElement(element));
                    break;
                case 'box':
                    commands.push(this.generateBoxElement(element));
                    break;
            }
        });

        commands.push('^XZ');

        const zpl = commands.join('');
        return { zpl, estimatedLength: Buffer.byteLength(zpl, 'utf8') };
    }

    private generateTextElement(element: LabelElement, data: Record<string, any>): string {
        const content = element.content || data[element.dataField || ''] || '';
        const { fontSize = 30, bold = false, alignment = 'left' } = element.style || {};
        
        const font = bold ? 'B' : 'N';
        let alignCmd = '';
        
        switch (alignment) {
            case 'center':
                alignCmd = '^FB800,1,0,C';
                break;
            case 'right':
                alignCmd = '^FB800,1,0,R';
                break;
            default:
                alignCmd = '^FB800,1,0,L';
        }

        return `^FO${element.x},${element.y}${alignCmd}^A${font}N,${fontSize},${fontSize * 0.7}^FD${content}^FS`;
    }

    private generateBarcodeElement(element: LabelElement, data: Record<string, any>): string {
        const content = element.content || data[element.dataField || ''] || '';
        const { height = 100, width = 2 } = element.style || {};

        return `^FO${element.x},${element.y}^BY${width}^BCN,${height},Y,N,N^FD${content}^FS`;
    }

    private generateQRCodeElement(element: LabelElement, data: Record<string, any>): string {
        const content = element.content || data[element.dataField || ''] || '';
        const size = element.width ? Math.floor(element.width / 10) : 10;

        return `^FO${element.x},${element.y}^BQN,2,${size}^FDQA,${content}^FS`;
    }

    private generateLineElement(element: LabelElement): string {
        const x2 = element.x + (element.width || 100);
        const y2 = element.y + (element.height || 1);
        
        return `^FO${element.x},${element.y}^GB${element.width || 100},${element.height || 1},1^FS`;
    }

    private generateBoxElement(element: LabelElement): string {
        const borderWidth = element.style?.fontSize || 2;
        
        return `^FO${element.x},${element.y}^GB${element.width || 100},${element.height || 50},${borderWidth}^FS`;
    }

    async duplicate(id: string, newName: string): Promise<LabelTemplate | null> {
        const original = await this.findById(id);
        
        if (!original) return null;

        return this.create({
            name: newName,
            type: original.type,
            config: original.config,
        });
    }
}

export const labelTemplateService = new LabelTemplateService();
