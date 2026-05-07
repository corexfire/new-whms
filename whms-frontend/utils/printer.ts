// ESC/POS Commands specification
const ESC = '\x1b'
const GS = '\x1d'
const CMD_INIT = ESC + '@' // Initialize printer
const CMD_ALIGN_CENTER = ESC + 'a' + '\x01'
const CMD_ALIGN_LEFT = ESC + 'a' + '\x00'
const CMD_CUT_PAPER = GS + 'V' + '\x41' + '\x00' // Partial cut
const CMD_BOLD_ON = ESC + 'E' + '\x01'
const CMD_BOLD_OFF = ESC + 'E' + '\x00'

export class ThermalPrinter {
  private port: SerialPort | null = null
  private writer: WritableStreamDefaultWriter<Uint8Array> | null = null

  async connect() {
    if (!('serial' in navigator)) {
      throw new Error('Web Serial API is not supported in this browser. Please use Chrome/Edge.')
    }
    
    // Request port access
    this.port = await navigator.serial.requestPort()
    
    // Standard thermal printer baudrate is typically 9600 or 115200
    await this.port.open({ baudRate: 9600 })
    
    this.writer = this.port.writable.getWriter()
    
    // Send init command
    await this.writeString(CMD_INIT)
  }

  async writeString(text: string) {
    if (!this.writer) throw new Error('Printer not connected.')
    
    // Basic ASCII encoding. True ESC/POS printers may need CodePage 850 or Windows-1252 parsing via TextEncoder
    const encoder = new TextEncoder()
    await this.writer.write(encoder.encode(text))
  }

  private formatLine(left: string, right: string, width: number = 32) {
    const spaceLength = width - left.length - right.length
    if (spaceLength <= 0) return left + ' ' + right
    return left + ' '.repeat(spaceLength) + right
  }

  async printReceipt(headerData: any, items: any[], total: number) {
    try {
      if (!this.writer) await this.connect()
      
      // Receipt Header
      await this.writeString(CMD_ALIGN_CENTER)
      await this.writeString(CMD_BOLD_ON)
      await this.writeString(`\n${headerData.company_name}\n`)
      await this.writeString(CMD_BOLD_OFF)
      await this.writeString(`${headerData.address}\n\n`)
      
      // Divider
      const div = '-'.repeat(32) + '\n'
      await this.writeString(CMD_ALIGN_LEFT)
      await this.writeString(div)
      
      await this.writeString(`Trx ID : ${headerData.trx_id}\n`)
      await this.writeString(`Date   : ${headerData.date}\n`)
      await this.writeString(`Cashier: ${headerData.cashier}\n`)
      await this.writeString(div)

      // Receipt Items
      for (const item of items) {
        // Line 1: Item name
        await this.writeString(`${item.name}\n`)
        
        // Line 2: Qty x Price     Total
        const leftAlign = `  ${item.qty} x ${item.price}`
        const rightAlign = `${item.subtotal}`
        await this.writeString(this.formatLine(leftAlign, rightAlign, 32) + '\n')
      }
      
      // Footer Totals
      await this.writeString(div)
      await this.writeString(CMD_BOLD_ON)
      await this.writeString(this.formatLine('TOTAL :', `Rp ${total}`, 32) + '\n')
      await this.writeString(CMD_BOLD_OFF)
      
      // Auto-cut at the end (Feed 4 lines first)
      await this.writeString('\n\n\n\n')
      await this.writeString(CMD_CUT_PAPER)

      return true
    } catch (err: any) {
      console.error('Thermal Print Error:', err)
      throw err
    } finally {
      if (this.writer) {
        this.writer.releaseLock()
      }
      if (this.port) {
        await this.port.close()
      }
    }
  }
}

// Global instance 
export const printerService = new ThermalPrinter()
