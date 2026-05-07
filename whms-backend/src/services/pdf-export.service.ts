import puppeteer, { Browser, PDFOptions } from 'puppeteer';
import { storageService } from './storage.service';

export interface PDFTemplateData {
    title: string;
    companyName?: string;
    companyAddress?: string;
    logoUrl?: string;
    data: Record<string, any>;
    items?: any[];
    footer?: string;
}

export interface PDFExportOptions {
    format?: 'A4' | 'Letter' | 'Legal';
    landscape?: boolean;
    printBackground?: boolean;
    margin?: {
        top?: string;
        bottom?: string;
        left?: string;
        right?: string;
    };
    folder?: string;
}

const DEFAULT_STYLES = `
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; font-size: 12px; color: #333; line-height: 1.5; }
    .header { text-align: center; margin-bottom: 30px; border-bottom: 2px solid #333; padding-bottom: 20px; }
    .header h1 { font-size: 24px; color: #222; margin-bottom: 5px; }
    .header .subtitle { color: #666; }
    .meta { margin-bottom: 20px; }
    .meta-row { display: flex; margin-bottom: 5px; }
    .meta-label { font-weight: bold; width: 150px; }
    .meta-value { flex: 1; }
    table { width: 100%; border-collapse: collapse; margin: 20px 0; }
    th { background: #f5f5f5; border: 1px solid #ddd; padding: 10px; text-align: left; font-weight: 600; }
    td { border: 1px solid #ddd; padding: 8px 10px; }
    tr:nth-child(even) { background: #fafafa; }
    .total-row { font-weight: bold; background: #f0f0f0 !important; }
    .footer { margin-top: 40px; text-align: center; font-size: 10px; color: #888; border-top: 1px solid #ddd; padding-top: 15px; }
    .text-right { text-align: right; }
    .text-center { text-align: center; }
    .badge { display: inline-block; padding: 3px 8px; border-radius: 3px; font-size: 10px; font-weight: bold; }
    .badge-success { background: #d4edda; color: #155724; }
    .badge-warning { background: #fff3cd; color: #856404; }
    .badge-danger { background: #f8d7da; color: #721c24; }
`;

export class PDFExportService {
    private browser: Browser | null = null;

    private async getBrowser(): Promise<Browser> {
        if (!this.browser || !this.browser.connected) {
            this.browser = await puppeteer.launch({
                headless: true,
                args: [
                    '--no-sandbox',
                    '--disable-setuid-sandbox',
                    '--disable-dev-shm-usage',
                    '--disable-accelerated-2d-canvas',
                    '--disable-gpu',
                ],
            });
        }
        return this.browser;
    }

    generateHTML(data: PDFTemplateData): string {
        const { title, companyName, data: recordData, items, footer } = data;

        let itemsHtml = '';
        if (items && items.length > 0) {
            const headers = Object.keys(items[0]);
            itemsHtml = `
                <table>
                    <thead>
                        <tr>${headers.map(h => `<th>${this.formatHeader(h)}</th>`).join('')}</tr>
                    </thead>
                    <tbody>
                        ${items.map(item => `
                            <tr>${headers.map(h => `<td>${this.formatCell(item[h])}</td>`).join('')}</tr>
                        `).join('')}
                    </tbody>
                </table>
            `;
        }

        let metaHtml = '';
        if (recordData && Object.keys(recordData).length > 0) {
            metaHtml = `
                <div class="meta">
                    ${Object.entries(recordData).map(([key, value]) => `
                        <div class="meta-row">
                            <span class="meta-label">${this.formatHeader(key)}:</span>
                            <span class="meta-value">${this.formatCell(value)}</span>
                        </div>
                    `).join('')}
                </div>
            `;
        }

        return `
            <!DOCTYPE html>
            <html>
            <head>
                <meta charset="utf-8">
                <title>${title}</title>
                <style>${DEFAULT_STYLES}</style>
            </head>
            <body>
                <div class="header">
                    <h1>${companyName || 'WHMS System'}</h1>
                    <div class="subtitle">${title}</div>
                </div>
                ${metaHtml}
                ${itemsHtml}
                ${footer ? `<div class="footer">${footer}<br>Generated: ${new Date().toLocaleString()}</div>` : ''}
            </body>
            </html>
        `;
    }

    private formatHeader(key: string): string {
        return key
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase())
            .replace(/_/g, ' ');
    }

    private formatCell(value: any): string {
        if (value === null || value === undefined) return '-';
        if (typeof value === 'boolean') return value ? 'Yes' : 'No';
        if (typeof value === 'number') {
            return value.toLocaleString('id-ID');
        }
        if (value instanceof Date) {
            return value.toLocaleString('id-ID');
        }
        return String(value);
    }

    async generatePDF(
        html: string,
        options: PDFExportOptions = {}
    ): Promise<Buffer> {
        const browser = await this.getBrowser();
        const page = await browser.newPage();

        await page.setContent(html, { waitUntil: 'networkidle0' });

        const pdfOptions: PDFOptions = {
            format: options.format || 'A4',
            landscape: options.landscape || false,
            printBackground: options.printBackground || true,
            margin: options.margin || {
                top: '20mm',
                bottom: '20mm',
                left: '15mm',
                right: '15mm',
            },
        };

        const pdfBuffer = await page.pdf(pdfOptions);
        await page.close();

        return Buffer.from(pdfBuffer);
    }

    async exportAndUpload(
        data: PDFTemplateData,
        filename: string,
        options: PDFExportOptions = {}
    ): Promise<{ buffer: Buffer; storage: any }> {
        const html = this.generateHTML(data);
        const buffer = await this.generatePDF(html, options);
        
        const storage = await storageService.uploadFile(buffer, `${filename}.pdf`, {
            folder: options.folder || 'reports',
            mimetype: 'application/pdf',
        });

        return { buffer, storage };
    }

    async cleanup(): Promise<void> {
        if (this.browser) {
            await this.browser.close();
            this.browser = null;
        }
    }
}

export const pdfExportService = new PDFExportService();
