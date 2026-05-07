import JsBarcode from 'jsbarcode';
import QRCode from 'qrcode';

export type BarcodeFormat = 
    | 'CODE128' 
    | 'CODE128A' 
    | 'CODE128B' 
    | 'CODE128C'
    | 'EAN13' 
    | 'EAN8' 
    | 'UPC' 
    | 'CODE39' 
    | 'ITF14'
    | 'PHARMACODE'
    | 'CODABAR';

export interface BarcodeOptions {
    format: BarcodeFormat;
    width?: number;
    height?: number;
    displayValue?: boolean;
    fontSize?: number;
    margin?: number;
    background?: string;
    lineColor?: string;
    textMargin?: number;
    textAlign?: 'left' | 'center' | 'right';
    textPosition?: 'top' | 'bottom';
    fontOptions?: string;
    font?: string;
    text?: string;
}

export interface BarcodeResult {
    format: BarcodeFormat;
    data: string;
    svg: string;
    base64?: string;
}

export interface QRCodeOptions {
    errorCorrectionLevel?: 'L' | 'M' | 'Q' | 'H';
    type?: 'svg' | 'terminal' | 'utf8';
    width?: number;
    margin?: number;
    color?: {
        dark?: string;
        light?: string;
    };
}

export interface QRCodeResult {
    data: string;
    svg?: string;
    base64?: string;
}

const DEFAULT_BARCODE_OPTIONS: Partial<BarcodeOptions> = {
    width: 2,
    height: 100,
    displayValue: true,
    fontSize: 14,
    margin: 10,
    background: '#ffffff',
    lineColor: '#000000',
    textMargin: 2,
    textAlign: 'center',
    textPosition: 'bottom',
};

export class BarcodeService {
    generateBarcodeSVG(data: string, options: BarcodeOptions): string {
        const mergedOptions = { ...DEFAULT_BARCODE_OPTIONS, ...options };
        
        const svgElement = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        JsBarcode(svgElement, data, {
            format: mergedOptions.format,
            width: mergedOptions.width,
            height: mergedOptions.height,
            displayValue: mergedOptions.displayValue,
            fontSize: mergedOptions.fontSize,
            margin: mergedOptions.margin,
            background: mergedOptions.background,
            lineColor: mergedOptions.lineColor,
            textMargin: mergedOptions.textMargin,
            textAlign: mergedOptions.textAlign,
            textPosition: mergedOptions.textPosition,
            fontOptions: mergedOptions.fontOptions,
            font: mergedOptions.font,
        });

        return svgElement.outerHTML;
    }

    generateBarcodeAsBuffer(data: string, options: BarcodeOptions): BarcodeResult {
        const mergedOptions = { ...DEFAULT_BARCODE_OPTIONS, ...options };
        const { createCanvas } = require('canvas');
        
        const canvas = createCanvas(400, 200);
        JsBarcode(canvas, data, {
            format: mergedOptions.format,
            width: mergedOptions.width,
            height: mergedOptions.height,
            displayValue: mergedOptions.displayValue,
            fontSize: mergedOptions.fontSize,
            margin: mergedOptions.margin,
            background: mergedOptions.background,
            lineColor: mergedOptions.lineColor,
            textMargin: mergedOptions.textMargin,
            textAlign: mergedOptions.textAlign,
            textPosition: mergedOptions.textPosition,
        });

        return {
            format: options.format,
            data,
            svg: '',
            base64: canvas.toDataURL('image/png'),
        };
    }

    async generateQRCode(data: string, options: QRCodeOptions = {}): Promise<QRCodeResult> {
        const mergedOptions: QRCodeOptions = {
            errorCorrectionLevel: 'M',
            type: 'svg',
            width: 200,
            margin: 2,
            color: {
                dark: '#000000',
                light: '#ffffff',
            },
            ...options,
        };

        const svg = await QRCode.toString(data, {
            type: mergedOptions.type,
            width: mergedOptions.width,
            margin: mergedOptions.margin,
            errorCorrectionLevel: mergedOptions.errorCorrectionLevel,
            color: mergedOptions.color,
        });

        const base64 = await QRCode.toDataURL(data, {
            width: mergedOptions.width,
            margin: mergedOptions.margin,
            errorCorrectionLevel: mergedOptions.errorCorrectionLevel,
            color: mergedOptions.color,
        });

        return {
            data,
            svg,
            base64,
        };
    }

    validateBarcodeData(data: string, format: BarcodeFormat): boolean {
        switch (format) {
            case 'EAN13':
                return /^\d{12,13}$/.test(data);
            case 'EAN8':
                return /^\d{7,8}$/.test(data);
            case 'UPC':
                return /^\d{11,12}$/.test(data);
            case 'ITF14':
                return /^\d{13,14}$/.test(data);
            case 'PHARMACODE':
                return /^\d{2,6}$/.test(data);
            case 'CODABAR':
                return /^[A-D][0-9\+\-\.\/\:\$]+[A-D]$/.test(data);
            default:
                return data.length > 0;
        }
    }

    generateBatch(
        items: Array<{ data: string; format: BarcodeFormat; options?: Partial<BarcodeOptions> }>
    ): BarcodeResult[] {
        return items.map(item => this.generateBarcodeAsBuffer(item.data, {
            format: item.format,
            ...item.options,
        }));
    }
}

export const barcodeService = new BarcodeService();
