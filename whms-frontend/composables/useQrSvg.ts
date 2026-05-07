/**
 * useQrSvg — generate a minimal inline QR-code SVG string using `uqr`.
 * uqr is already installed as a Nuxt transitive dependency.
 */
import { renderSVG } from 'uqr'

/**
 * Returns an SVG string for the given `value`.
 * Options are passed directly to `uqr` renderSVG.
 */
export function generateQrSvg(value: string, options?: Record<string, any>): string {
  if (!value) return ''
  try {
    return renderSVG(value, {
      ecc: 'M',
      ...options,
    })
  } catch {
    return ''
  }
}

/**
 * Open a print popup for a given QR + label content.
 */
export function printQrLabel(opts: {
  code: string
  warehouseName?: string
  zone?: string
  aisle?: string
  rack?: string
  level?: string
  bin?: string
  capacity?: number | null
}) {
  const svgStr = generateQrSvg(opts.code)
  const win = window.open('', '_blank', 'width=420,height=560')
  if (!win) return

  const meta = [
    opts.warehouseName,
    opts.zone && `Zone: ${opts.zone}`,
    opts.aisle && `Aisle: ${opts.aisle}`,
    opts.rack && `Rack: ${opts.rack}`,
    opts.level && `Level: ${opts.level}`,
    opts.bin && `Bin: ${opts.bin}`,
  ].filter(Boolean).join(' · ')

  win.document.open()
  win.document.write(`
    <!DOCTYPE html>
    <html>
      <head>
        <title>Label — ${opts.code}</title>
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body {
            font-family: ui-sans-serif, system-ui, -apple-system, 'Segoe UI', Roboto, Arial, sans-serif;
            display: flex; align-items: center; justify-content: center;
            min-height: 100vh; background: #f8fafc;
          }
          .card {
            border: 2px solid #334155;
            border-radius: 12px;
            padding: 20px 24px;
            width: 320px;
            text-align: center;
            background: #fff;
          }
          .code {
            font-size: 18px;
            font-weight: 800;
            letter-spacing: 0.04em;
            color: #0f172a;
            margin-bottom: 8px;
            word-break: break-all;
          }
          .meta {
            font-size: 11px;
            color: #64748b;
            margin-bottom: 14px;
            line-height: 1.6;
          }
          .qr {
            display: inline-block;
            width: 192px;
            height: 192px;
            margin-bottom: 14px;
          }
          .qr svg {
            width: 100%;
            height: 100%;
          }
          .scan-me {
            font-size: 10px;
            color: #94a3b8;
            text-transform: uppercase;
            letter-spacing: 0.08em;
          }
          @media print {
            body { background: white; }
            .card { border-color: #000; box-shadow: none; }
          }
        </style>
      </head>
      <body>
        <div class="card">
          <div class="code">${opts.code}</div>
          <div class="meta">${meta}</div>
          <div class="qr">${svgStr}</div>
          <div class="scan-me">Scan untuk informasi lokasi</div>
        </div>
        <script>window.onload = () => { window.print(); }<\/script>
      </body>
    </html>
  `)
  win.document.close()
}
