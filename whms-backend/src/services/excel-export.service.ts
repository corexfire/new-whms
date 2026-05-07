import ExcelJS, { Column, Row, CellValue, Workbook } from 'exceljs';
import { storageService } from './storage.service';

export interface ExcelColumn {
    header: string;
    key: string;
    width?: number;
    style?: {
        bold?: boolean;
        color?: string;
        fill?: string;
        alignment?: 'left' | 'center' | 'right';
    };
}

export interface ExcelSheet {
    name: string;
    columns: ExcelColumn[];
    data: any[];
    titleRow?: boolean;
}

export interface ExcelExportOptions {
    title?: string;
    author?: string;
    subject?: string;
    sheets?: ExcelSheet[];
    folder?: string;
}

export class ExcelExportService {
    private workbook: Workbook;

    constructor() {
        this.workbook = new ExcelJS.Workbook();
        this.workbook.creator = 'WHMS System';
        this.workbook.created = new Date();
    }

    addSheet(sheet: ExcelSheet): void {
        const ws = this.workbook.addWorksheet(sheet.name);

        ws.columns = sheet.columns.map(col => ({
            header: col.header,
            key: col.key,
            width: col.width || 15,
        }));

        if (sheet.titleRow) {
            const titleRow = ws.addRow([sheet.name]);
            titleRow.font = { bold: true, size: 16 };
            titleRow.height = 25;
            ws.mergeCells(`A1:${String.fromCharCode(64 + sheet.columns.length)}1`);
        }

        const headerRow = ws.addRow(sheet.columns.map(col => col.header));
        headerRow.font = { bold: true };
        headerRow.fill = {
            type: 'pattern',
            pattern: 'solid',
            fgColor: { argb: 'FF4472C4' },
        };
        headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
        headerRow.alignment = { horizontal: 'center' };
        headerRow.height = 20;

        sheet.data.forEach((row, index) => {
            const excelRow = ws.addRow(
                sheet.columns.map(col => this.formatValue(row[col.key]))
            );

            if (index % 2 === 0) {
                excelRow.fill = {
                    type: 'pattern',
                    pattern: 'solid',
                    fgColor: { argb: 'FFF2F2F2' },
                };
            }

            sheet.columns.forEach((col, colIndex) => {
                const cell = excelRow.getCell(colIndex + 1);
                if (col.style?.alignment) {
                    cell.alignment = { horizontal: col.style.alignment };
                }
            });
        });

        ws.getRow(sheet.titleRow ? 3 : 1).hidden = false;
    }

    private formatValue(value: any): CellValue {
        if (value === null || value === undefined) return '';
        if (value instanceof Date) return value.toLocaleString('id-ID');
        if (typeof value === 'boolean') return value ? 'Yes' : 'No';
        if (typeof value === 'number') return value;
        return String(value);
    }

    setProperties(options: { title?: string; author?: string; subject?: string }): void {
        if (options.title) this.workbook.title = options.title;
        if (options.author) this.workbook.creator = options.author;
        if (options.subject) this.workbook.subject = options.subject;
    }

    async toBuffer(): Promise<Buffer> {
        const buffer = await this.workbook.xlsx.writeBuffer();
        return Buffer.from(buffer);
    }

    async export(filename: string, options: ExcelExportOptions = {}): Promise<Buffer> {
        if (options.title || options.author || options.subject) {
            this.setProperties(options);
        }

        if (options.sheets) {
            options.sheets.forEach(sheet => this.addSheet(sheet));
        }

        return this.toBuffer();
    }

    async exportAndUpload(
        filename: string,
        data: any[],
        columns: ExcelColumn[],
        options: ExcelExportOptions = {}
    ): Promise<{ buffer: Buffer; storage: any }> {
        const sheetName = options.sheets?.[0]?.name || 'Data';
        
        if (options.sheets) {
            options.sheets.forEach(sheet => this.addSheet(sheet));
        } else {
            this.addSheet({ name: sheetName, columns, data });
        }

        if (options.title) this.workbook.title = options.title;
        if (options.author) this.workbook.creator = options.author;

        const buffer = await this.toBuffer();

        const storage = await storageService.uploadFile(buffer, `${filename}.xlsx`, {
            folder: options.folder || 'exports',
            mimetype: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        });

        return { buffer, storage };
    }

    createInventorySheet(inventory: any[]): void {
        const columns: ExcelColumn[] = [
            { header: 'SKU', key: 'sku', width: 15 },
            { header: 'Nama Produk', key: 'name', width: 30 },
            { header: 'Kategori', key: 'category', width: 15 },
            { header: 'Gudang', key: 'warehouse', width: 15 },
            { header: 'Stok', key: 'stock', width: 10, style: { alignment: 'right' } },
            { header: 'Min. Stok', key: 'minStock', width: 10, style: { alignment: 'right' } },
            { header: 'Harga', key: 'price', width: 15, style: { alignment: 'right' } },
            { header: 'Status', key: 'status', width: 12 },
        ];

        const dataWithStatus = inventory.map(item => ({
            ...item,
            status: item.stock <= 0 ? 'Habis' : item.stock <= item.minStock ? 'Rendah' : 'Normal',
        }));

        this.addSheet({ name: 'Inventori', columns, data: dataWithStatus, titleRow: true });
    }

    createShipmentSheet(shipments: any[]): void {
        const columns: ExcelColumn[] = [
            { header: 'ID', key: 'id', width: 15 },
            { header: 'Resi', key: 'trackingNumber', width: 20 },
            { header: 'Pengirim', key: 'sender', width: 25 },
            { header: 'Penerima', key: 'receiver', width: 25 },
            { header: 'Asal', key: 'origin', width: 15 },
            { header: 'Tujuan', key: 'destination', width: 15 },
            { header: 'Status', key: 'status', width: 15 },
            { header: 'Tanggal', key: 'createdAt', width: 15 },
        ];

        this.addSheet({ name: 'Pengiriman', columns, data: shipments, titleRow: true });
    }

    createReportSheet(title: string, headers: string[], rows: any[][]): void {
        const columns = headers.map((h, i) => ({
            header: h,
            key: `col${i}`,
            width: 15,
        }));

        const data = rows.map(row => {
            const obj: any = {};
            row.forEach((val, i) => {
                obj[`col${i}`] = val;
            });
            return obj;
        });

        this.addSheet({ name: title, columns, data, titleRow: true });
    }
}

export const excelExportService = new ExcelExportService();
