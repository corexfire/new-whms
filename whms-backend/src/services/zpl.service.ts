import net from 'net';
import { PrinterSocket } from '../types/printer';

export type BarcodeType = 
    | 'CODE128' 
    | 'CODE39' 
    | 'EAN13' 
    | 'EAN8' 
    | 'UPC_A' 
    | 'UPC_E'
    | 'QR_CODE';

export type Alignment = 'LEFT' | 'CENTER' | 'RIGHT';

export interface ZPLText {
    x: number;
    y: number;
    text: string;
    fontSize?: number;
    fontWidth?: number;
    fontHeight?: number;
    bold?: boolean;
    italic?: boolean;
    alignment?: Alignment;
}

export interface ZPLBarcode {
    x: number;
    y: number;
    data: string;
    type: BarcodeType;
    height?: number;
    width?: number;
    showText?: boolean;
}

export interface ZPLLine {
    x1: number;
    y1: number;
    x2: number;
    y2: number;
    thickness?: number;
}

export interface ZPLBox {
    x: number;
    y: number;
    width: number;
    height: number;
    borderThickness?: number;
}

export interface LabelData {
    barcode?: ZPLBarcode;
    qrCode?: {
        x: number;
        y: number;
        data: string;
        model?: 1 | 2;
        size?: number;
    };
    texts?: ZPLText[];
    lines?: ZPLLine[];
    boxes?: ZPLBox[];
}

export interface ZPLResult {
    zpl: string;
    estimatedLength: number;
}

const ZPL_COMMANDS = {
    START: '^XA',
    END: '^XZ',
    HOME: '^FO{X},{Y}',
    TEXT: '^FO{X},{Y}^A{FONT},{H},{W}^FD{TEXT}^FS',
    BARCODE: '^FO{X},{Y}^BY{W}^B{TYPE},{H},{Y},{Y},{Y}^FD{DATA}^FS',
    QR: '^FO{X},{Y}^BQN,{M},{S}^FD{DATA}^FS',
    LINE: '^FO{X1},{Y1}^LL{LENGTH}^FW{W}^FS',
    BOX: '^FO{X},{Y}^XFB:{W},{H},{T},{R},{C}^FS',
    CUT: '^CN1^FS',
    FEED: '^PQ{Q},{N},{P},{E}^FS',
};

export class ZPLService {
    private templateCache: Map<string, string> = new Map();

    generateText(config: ZPLText): string {
        const font = config.bold ? 'B' : 'N';
        const size = config.fontSize || 30;
        const width = config.fontWidth || size * 0.7;
        const height = config.fontHeight || size;
        const align = config.alignment || 'LEFT';

        let alignCmd = '';
        switch (align) {
            case 'CENTER':
                alignCmd = '^FB800,1,0,C';
                break;
            case 'RIGHT':
                alignCmd = '^FB800,1,0,R';
                break;
            default:
                alignCmd = '^FB800,1,0,L';
        }

        return `^FO${config.x},${config.y}${alignCmd}^A${font}N,${height},${width}^FD${config.text}^FS`;
    }

    generateBarcode(config: ZPLBarcode): string {
        const typeMap: Record<BarcodeType, string> = {
            'CODE128': 'C',
            'CODE39': '3',
            'EAN13': 'E',
            'EAN8': 'E',
            'UPC_A': 'U',
            'UPC_E': 'U',
            'QR_CODE': 'Q',
        };

        const type = typeMap[config.type];
        const width = config.width || 3;
        const height = config.height || 100;
        const showText = config.showText !== false ? 'Y' : 'N';

        if (config.type === 'QR_CODE') {
            return `^FO${config.x},${config.y}^BQN,2,${config.size || 10}^FDQA,${config.data}^FS`;
        }

        return `^FO${config.x},${config.y}^BY${width}^B${type},${height},${showText}^FD${config.data}^FS`;
    }

    generateQRCode(config: ZPLBarcode): string {
        return `^FO${config.x},${config.y}^BQN,2,${(config.height || 100) / 10}^FDQA,${config.data}^FS`;
    }

    generateLine(config: ZPLLine): string {
        const length = Math.sqrt(
            Math.pow(config.x2 - config.x1, 2) + Math.pow(config.y2 - config.y1, 2)
        );
        return `^FO${config.x1},${config.y1}^LL${Math.round(length)}^FW${config.thickness || 1}^FS`;
    }

    generateBox(config: ZPLBox): string {
        const thickness = config.borderThickness || 2;
        return `^FO${config.x},${config.y}^GB${config.width},${config.height},${thickness}^FS`;
    }

    generateLabel(data: LabelData, copies: number = 1): ZPLResult {
        const commands: string[] = [ZPL_COMMANDS.START];

        if (data.barcode) {
            commands.push(this.generateBarcode(data.barcode));
        }

        if (data.qrCode) {
            commands.push(`^FO${data.qrCode.x},${data.qrCode.y}^BQN,2,${data.qrCode.size || 10}^FDQA,${data.qrCode.data}^FS`);
        }

        if (data.texts) {
            data.texts.forEach(text => {
                commands.push(this.generateText(text));
            });
        }

        if (data.lines) {
            data.lines.forEach(line => {
                commands.push(this.generateLine(line));
            });
        }

        if (data.boxes) {
            data.boxes.forEach(box => {
                commands.push(this.generateBox(box));
            });
        }

        commands.push(ZPL_COMMANDS.END);

        const zpl = commands.join('');
        const estimatedLength = Buffer.byteLength(zpl, 'utf8');

        return { zpl, estimatedLength };
    }

    generateProductLabel(
        product: {
            sku: string;
            name: string;
            barcode: string;
            price?: number;
            batch?: string;
            expiry?: string;
        },
        options: {
            width?: number;
            height?: number;
            copies?: number;
            showPrice?: boolean;
            showBatch?: boolean;
        } = {}
    ): ZPLResult {
        const { sku, name, barcode, price, batch, expiry } = product;
        const { copies = 1, showPrice = true, showBatch = true } = options;

        const width = options.width || 600;
        const height = options.height || 300;
        const leftMargin = 30;

        const commands: string[] = [ZPL_COMMANDS.START];

        commands.push(`^PW${width}`);
        commands.push(`^LL${height}`);

        commands.push(`^FO${leftMargin},20}^A0N,40,40^FD${name}^FS`);

        commands.push(`^FO${leftMargin},70}^BY3^BCN,80,Y,N,N^FD${barcode}^FS`);

        commands.push(`^FO${leftMargin},160}^A0N,25,25^FDSKU: ${sku}^FS`);

        if (showBatch && batch) {
            commands.push(`^FO${leftMargin},190}^A0N,20,20^FDBatch: ${batch}^FS`);
        }

        if (showPrice && price !== undefined) {
            commands.push(`^FO${leftMargin},220}^A0N,30,30^FDRp ${price.toLocaleString('id-ID')}^FS`);
        }

        commands.push(ZPL_COMMANDS.END);

        let zpl = commands.join('');
        
        if (copies > 1) {
            zpl = zpl.replace('^XZ', `^PQ${copies}^XZ`);
        }

        return { zpl, estimatedLength: Buffer.byteLength(zpl, 'utf8') };
    }

    generateShippingLabel(
        shipment: {
            trackingNumber: string;
            recipient: string;
            address: string;
            phone?: string;
            weight?: string;
        },
        options: { copies?: number } = {}
    ): ZPLResult {
        const { trackingNumber, recipient, address, phone, weight } = shipment;
        const { copies = 1 } = options;

        const commands: string[] = [ZPL_COMMANDS.START];

        commands.push(`^FO30,20}^A0N,50,50^FDWHMS^FS`);
        commands.push(`^FO30,80}^BY3^BCN,120,Y,N,N^FD${trackingNumber}^FS`);
        commands.push(`^FO30,220}^A0N,30,30^FD${recipient}^FS`);
        commands.push(`^FO30,260}^A0N,20,20^FD${address}^FS`);
        
        if (phone) {
            commands.push(`^FO30,290}^A0N,20,20^FDTelp: ${phone}^FS`);
        }
        
        if (weight) {
            commands.push(`^FO30,320}^A0N,20,20^FDWeight: ${weight}^FS`);
        }

        commands.push(`^FO30,360}^GB550,2,2^FS`);

        commands.push(ZPL_COMMANDS.END);

        let zpl = commands.join('');
        
        if (copies > 1) {
            zpl = zpl.replace('^XZ', `^PQ${copies}^XZ`);
        }

        return { zpl, estimatedLength: Buffer.byteLength(zpl, 'utf8') };
    }

    async sendToPrinter(zpl: string, printer: PrinterSocket): Promise<boolean> {
        return new Promise((resolve, reject) => {
            const client = new net.Socket();
            
            const timeout = setTimeout(() => {
                client.destroy();
                reject(new Error('Printer connection timeout'));
            }, 10000);

            client.connect(printer.port || 9100, printer.ip, () => {
                clearTimeout(timeout);
                client.write(zpl, (err) => {
                    if (err) {
                        client.end();
                        reject(err);
                    } else {
                        client.end();
                        resolve(true);
                    }
                });
            });

            client.on('error', (err) => {
                clearTimeout(timeout);
                reject(err);
            });
        });
    }

    cacheTemplate(id: string, zpl: string): void {
        this.templateCache.set(id, zpl);
    }

    getCachedTemplate(id: string): string | undefined {
        return this.templateCache.get(id);
    }

    clearTemplateCache(): void {
        this.templateCache.clear();
    }
}

export const zplService = new ZPLService();
