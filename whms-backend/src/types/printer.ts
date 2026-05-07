export interface PrinterSocket {
    ip: string;
    port?: number;
    name?: string;
}

export interface PrintJob {
    id: string;
    printer: PrinterSocket;
    zpl: string;
    copies?: number;
    labelType: 'product' | 'shipping' | 'custom' | 'receipt';
    metadata?: Record<string, any>;
}

export interface LabelTemplate {
    id: string;
    name: string;
    type: 'product' | 'shipping' | 'custom' | 'receipt';
    config: {
        width?: number;
        height?: number;
        elements: LabelElement[];
    };
    createdAt: Date;
    updatedAt: Date;
    createdBy?: string;
}

export interface LabelElement {
    id: string;
    type: 'text' | 'barcode' | 'qrcode' | 'line' | 'box' | 'image';
    x: number;
    y: number;
    width?: number;
    height?: number;
    content?: string;
    dataField?: string;
    style?: {
        fontSize?: number;
        fontWidth?: number;
        fontHeight?: number;
        bold?: boolean;
        alignment?: 'left' | 'center' | 'right';
        color?: string;
    };
}

export interface BarcodeConfig {
    type: 'CODE128' | 'CODE39' | 'EAN13' | 'EAN8' | 'UPC_A' | 'QR_CODE';
    height?: number;
    width?: number;
    showText?: boolean;
}

export interface PrintResponse {
    success: boolean;
    jobId?: string;
    message?: string;
    error?: string;
}
