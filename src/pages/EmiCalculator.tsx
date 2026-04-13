import { useState, useCallback, useEffect } from 'react'
import jsPDF from 'jspdf'
import {
  Calculator,
  TrendingUp,
  IndianRupee,
  Calendar,
  Save,
  Mail,
  MessageCircle,
  FileDown,
  Printer,
  Trash2,
  Clock,
  ChevronRight,
  X,
  CheckCircle,
  AlertCircle,
  Loader2,
  BarChart3,
  RotateCcw,
  Send,
} from 'lucide-react'
import { emiCalculatorAPI, EmiCalculation } from '../api/emiCalculator'

// ─── helpers ──────────────────────────────────────────────────────────────────

const fmtINR = (n: number) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: 0 }).format(n)

const fmtINRFull = (n: number) =>
  new Intl.NumberFormat('en-IN', { maximumFractionDigits: 2 }).format(n)

const calcEmi = (principal: number, annualRate: number, months: number) => {
  if (!principal || !annualRate || !months) return { emi: 0, total: 0, interest: 0 }
  const r = annualRate / 12 / 100
  const emi = (principal * r * Math.pow(1 + r, months)) / (Math.pow(1 + r, months) - 1)
  const total = emi * months
  const interest = total - principal
  return {
    emi: Math.round(emi * 100) / 100,
    total: Math.round(total * 100) / 100,
    interest: Math.round(interest * 100) / 100,
  }
}

const buildAmortisation = (principal: number, annualRate: number, months: number, emi: number) => {
  const r = annualRate / 12 / 100
  let balance = principal
  const rows = []
  for (let i = 1; i <= Math.min(months, 360); i++) {
    const interestPart = balance * r
    const principalPart = emi - interestPart
    balance -= principalPart
    rows.push({
      month: i,
      emi: Math.round(emi * 100) / 100,
      principal: Math.round(principalPart * 100) / 100,
      interest: Math.round(interestPart * 100) / 100,
      balance: Math.max(0, Math.round(balance * 100) / 100),
    })
  }
  return rows
}

const formatDate = (iso: string) =>
  new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' })

// ─── jsPDF direct download (no print dialog) ──────────────────────────────────

function downloadEmiPDF(d: {
  loanAmount: number
  interestRate: number
  tenureYears: number
  tenureMonths: number
  emi: number
  total: number
  interest: number
}) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' })
  const W = 210
  const margin = 14
  const cW = W - margin * 2   // content width = 182mm
  let y = 0

  const pPct = d.total > 0 ? Math.round((d.loanAmount / d.total) * 100) : 0
  const iPct = 100 - pPct

  // colour helpers
  const fill  = (r: number, g: number, b: number) => doc.setFillColor(r, g, b)
  const txt   = (r: number, g: number, b: number) => doc.setTextColor(r, g, b)
  const draw  = (r: number, g: number, b: number) => doc.setDrawColor(r, g, b)
  const lw    = (n: number) => doc.setLineWidth(n)
  const font  = (style: 'bold' | 'normal' | 'italic') => doc.setFont('helvetica', style)
  const size  = (pt: number) => doc.setFontSize(pt)

  // ── HEADER bar ──────────────────────────────────────────────────────────────
  fill(29, 78, 216)
  doc.rect(0, 0, W, 30, 'F')

  size(15); font('bold'); txt(255, 255, 255)
  doc.text('BuildFlow CRM', margin, 13)

  size(8.5); font('normal'); txt(147, 197, 253)
  doc.text('EMI Calculation Report', margin, 20)

  const dateStr = new Date().toLocaleDateString('en-IN', { day: '2-digit', month: 'long', year: 'numeric' })
  size(8); font('normal'); txt(147, 197, 253)
  doc.text(dateStr, W - margin, 20, { align: 'right' })

  y = 38

  // ── MONTHLY EMI hero ────────────────────────────────────────────────────────
  fill(29, 78, 216)
  doc.roundedRect(margin, y, cW, 30, 3, 3, 'F')

  size(7.5); font('bold'); txt(147, 197, 253)
  doc.text('MONTHLY EMI', margin + 6, y + 8)

  size(24); font('bold'); txt(255, 255, 255)
  doc.text(`Rs.${fmtINRFull(d.emi)}`, margin + 6, y + 21)

  size(8); font('normal'); txt(147, 197, 253)
  doc.text(`for ${d.tenureYears} year${d.tenureYears !== 1 ? 's' : ''} at ${d.interestRate}% p.a.`, margin + 6, y + 28)

  y += 38

  // ── STATS grid ──────────────────────────────────────────────────────────────
  const colW = (cW - 6) / 3
  const stats = [
    { label: 'PRINCIPAL AMOUNT', value: `Rs.${fmtINR(d.loanAmount)}`, f: [239,246,255] as [number,number,number], t: [29,78,216] as [number,number,number], b: [191,219,254] as [number,number,number] },
    { label: 'TOTAL INTEREST',   value: `Rs.${fmtINR(d.interest)}`,   f: [254,242,242] as [number,number,number], t: [220,38,38]  as [number,number,number], b: [254,202,202] as [number,number,number] },
    { label: 'TOTAL PAYABLE',    value: `Rs.${fmtINR(d.total)}`,      f: [240,253,244] as [number,number,number], t: [5,150,105]  as [number,number,number], b: [187,247,208] as [number,number,number] },
  ]

  stats.forEach((s, i) => {
    const x = margin + i * (colW + 3)
    fill(...s.f); draw(...s.b); lw(0.3)
    doc.roundedRect(x, y, colW, 22, 2, 2, 'FD')

    size(7); font('bold'); txt(...s.t)
    doc.text(s.label, x + 4, y + 8)

    size(11); font('bold')
    doc.text(s.value, x + 4, y + 17)
  })

  y += 29

  // ── LOAN PARAMETERS table ───────────────────────────────────────────────────
  size(7.5); font('bold'); txt(100, 116, 139)
  doc.text('LOAN PARAMETERS', margin, y)
  y += 5

  const params: [string, string][] = [
    ['Loan Amount',            `Rs.${fmtINR(d.loanAmount)}`],
    ['Annual Interest Rate',   `${d.interestRate}%`],
    ['Loan Tenure',            `${d.tenureYears} Years (${d.tenureMonths} Months)`],
    ['Monthly EMI',            `Rs.${fmtINRFull(d.emi)}`],
    ['Total Interest Payable', `Rs.${fmtINR(d.interest)}`],
    ['Total Amount Payable',   `Rs.${fmtINR(d.total)}`],
  ]

  const rowH = 9
  params.forEach(([label, value], i) => {
    const rowY = y + i * rowH
    const isLast = i === params.length - 1

    if (isLast) { fill(239, 246, 255) }
    else if (i % 2 === 1) { fill(248, 250, 252) }
    else { fill(255, 255, 255) }
    draw(241, 245, 249); lw(0.15)
    doc.rect(margin, rowY, cW, rowH, 'FD')

    size(8.5)
    if (isLast) { font('bold'); txt(29, 78, 216) } else { font('normal'); txt(55, 65, 81) }
    doc.text(label, margin + 3, rowY + 6)

    font('bold')
    if (isLast) { txt(29, 78, 216) } else { txt(15, 23, 42) }
    doc.text(value, W - margin - 3, rowY + 6, { align: 'right' })
  })

  draw(226, 232, 240); lw(0.4)
  doc.rect(margin, y, cW, params.length * rowH, 'S')

  y += params.length * rowH + 10

  // ── COMPOSITION bar ─────────────────────────────────────────────────────────
  size(7.5); font('bold'); txt(100, 116, 139)
  doc.text('LOAN COMPOSITION', margin, y)
  y += 5

  const pBarW = (d.loanAmount / d.total) * cW
  const iBarW = cW - pBarW

  fill(29, 78, 216)
  doc.roundedRect(margin, y, pBarW, 5, 1, 1, 'F')
  fill(244, 63, 94)
  doc.roundedRect(margin + pBarW, y, iBarW, 5, 1, 1, 'F')

  y += 9
  size(8); font('bold')
  txt(29, 78, 216);  doc.text(`Principal — ${pPct}%`, margin, y)
  txt(244, 63, 94);  doc.text(`Interest — ${iPct}%`, W - margin, y, { align: 'right' })

  y += 12

  // ── AMORTISATION table ──────────────────────────────────────────────────────
  const amRows = buildAmortisation(d.loanAmount, d.interestRate, d.tenureMonths, d.emi)
  const maxAm = 40

  size(7.5); font('bold'); txt(100, 116, 139)
  doc.text(
    `AMORTISATION SCHEDULE${d.tenureMonths > maxAm ? ` (First ${maxAm} months shown)` : ''}`,
    margin, y
  )
  y += 5

  // Table header
  const amCols  = ['Month', 'EMI (Rs.)', 'Principal (Rs.)', 'Interest (Rs.)', 'Balance (Rs.)']
  const amWidths = [18, 36, 40, 38, 50]

  fill(21, 33, 68); draw(21, 33, 68); lw(0)
  doc.rect(margin, y, cW, 8, 'F')

  let cx = margin
  amCols.forEach((col, i) => {
    size(6.5); font('bold'); txt(147, 197, 253)
    doc.text(col, cx + 2.5, y + 5.5)
    cx += amWidths[i]
  })
  y += 8

  amRows.slice(0, maxAm).forEach((row, idx) => {
    if (y > 272) {
      doc.addPage()
      y = 14
    }

    if (idx % 2 === 1) { fill(248, 250, 252) } else { fill(255, 255, 255) }
    draw(241, 245, 249); lw(0.15)
    doc.rect(margin, y, cW, 7, 'FD')

    const cells = [
      String(row.month),
      fmtINRFull(row.emi),
      fmtINRFull(row.principal),
      fmtINRFull(row.interest),
      fmtINRFull(row.balance),
    ]
    const cellColors: [number, number, number][] = [
      [100, 116, 139],
      [29, 78, 216],
      [5, 150, 105],
      [220, 38, 38],
      [55, 65, 81],
    ]

    cx = margin
    cells.forEach((cell, i) => {
      size(7); font(i === 0 ? 'normal' : 'bold'); txt(...cellColors[i])
      doc.text(cell, cx + 2.5, y + 5)
      cx += amWidths[i]
    })
    y += 7
  })

  draw(226, 232, 240); lw(0.35)
  // outer border drawn row-by-row above; just add left/right verticals
  doc.line(margin, y - amRows.slice(0, maxAm).length * 7 - 8, margin, y)
  doc.line(W - margin, y - amRows.slice(0, maxAm).length * 7 - 8, W - margin, y)

  y += 8

  // ── DISCLAIMER ──────────────────────────────────────────────────────────────
  if (y > 258) { doc.addPage(); y = 14 }

  fill(255, 251, 235); draw(253, 230, 138); lw(0.4)
  doc.roundedRect(margin, y, cW, 18, 2, 2, 'FD')

  size(7.5); font('bold'); txt(146, 64, 14)
  doc.text('Disclaimer:', margin + 4, y + 7)

  size(7); font('normal'); txt(180, 100, 0)
  const disclaimer =
    'This calculation is for illustration purposes only. Actual EMI may vary based on lender ' +
    'policies, processing fees, GST and applicable charges. Consult a financial advisor for precise figures.'
  const lines = doc.splitTextToSize(disclaimer, cW - 8)
  doc.text(lines, margin + 4, y + 13)

  // ── FOOTER ──────────────────────────────────────────────────────────────────
  const totalPages = (doc as any).internal.getNumberOfPages()
  for (let pg = 1; pg <= totalPages; pg++) {
    doc.setPage(pg)
    size(6.5); font('normal'); txt(148, 163, 184)
    doc.text(
      `Generated by BuildFlow CRM  ·  ${new Date().toLocaleDateString('en-IN')}  ·  Page ${pg} of ${totalPages}`,
      W / 2, 291, { align: 'center' }
    )
  }

  // ── DIRECT DOWNLOAD ─────────────────────────────────────────────────────────
  const filename = `EMI-Rs${fmtINR(d.loanAmount)}-${d.interestRate}pct-${d.tenureYears}yr.pdf`
  doc.save(filename)
}

// ─── print window (for Print button) ─────────────────────────────────────────

function openPrintWindow(d: {
  loanAmount: number; interestRate: number; tenureYears: number
  tenureMonths: number; emi: number; total: number; interest: number
}) {
  const pPct = d.total > 0 ? Math.round((d.loanAmount / d.total) * 100) : 0
  const iPct = 100 - pPct

  const html = `<!DOCTYPE html><html><head><meta charset="UTF-8"/>
<title>EMI Calculation — BuildFlow</title>
<style>
  *{margin:0;padding:0;box-sizing:border-box;}
  body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;background:#fff;color:#0F172A;padding:32px;}
  @page{size:A4;margin:12mm;}
  @media print{body{-webkit-print-color-adjust:exact;print-color-adjust:exact;}}
  h1{font-size:20px;font-weight:800;color:#1D4ED8;}
  .header{display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:24px;padding-bottom:16px;border-bottom:2px solid #1D4ED8;}
  .hero{background:linear-gradient(135deg,#1D4ED8,#3B82F6);border-radius:12px;padding:22px 28px;margin-bottom:18px;color:#fff;}
  .hero .label{font-size:10px;text-transform:uppercase;letter-spacing:1px;opacity:.7;margin-bottom:6px;}
  .hero .amount{font-size:36px;font-weight:900;letter-spacing:-1px;}
  .hero .sub{font-size:11px;opacity:.65;margin-top:6px;}
  .grid{display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:18px;}
  .stat{border-radius:10px;padding:14px;border-width:1px;border-style:solid;}
  .stat .slabel{font-size:9px;text-transform:uppercase;letter-spacing:.5px;font-weight:700;margin-bottom:5px;}
  .stat .sval{font-size:17px;font-weight:800;}
  table{width:100%;border-collapse:collapse;border:1px solid #E2E8F0;border-radius:8px;overflow:hidden;margin-bottom:18px;}
  th{background:#F8FAFC;padding:9px 12px;text-align:left;font-size:9px;color:#64748B;text-transform:uppercase;letter-spacing:.4px;border-bottom:1px solid #E2E8F0;}
  td{padding:9px 12px;font-size:12px;border-bottom:1px solid #F1F5F9;}
  tr:nth-child(even) td{background:#FAFBFC;}
  .bar-wrap{margin-bottom:18px;}
  .bar{height:8px;border-radius:99px;overflow:hidden;display:flex;margin:8px 0;}
  .bar-p{background:#1D4ED8;}  .bar-i{background:#F43F5E;}
  .bar-labels{display:flex;justify-content:space-between;font-size:10px;font-weight:700;}
  .disc{background:#FFFBEB;border:1px solid #FDE68A;border-radius:8px;padding:12px 14px;font-size:10px;color:#92400E;line-height:1.6;}
</style></head><body>
<div class="header">
  <div><h1>BuildFlow CRM</h1><div style="font-size:12px;color:#64748B;margin-top:2px;">EMI Calculation Report</div></div>
  <div style="text-align:right;font-size:11px;color:#94A3B8;">${new Date().toLocaleDateString('en-IN',{day:'2-digit',month:'long',year:'numeric'})}</div>
</div>
<div class="hero">
  <div class="label">Monthly EMI</div>
  <div class="amount">Rs.${fmtINRFull(d.emi)}</div>
  <div class="sub">for ${d.tenureYears} years at ${d.interestRate}% p.a.</div>
</div>
<div class="grid">
  <div class="stat" style="background:#EFF6FF;border-color:#BFDBFE;">
    <div class="slabel" style="color:#1D4ED8;">Principal Amount</div>
    <div class="sval" style="color:#1E40AF;">Rs.${fmtINR(d.loanAmount)}</div>
  </div>
  <div class="stat" style="background:#FEF2F2;border-color:#FECACA;">
    <div class="slabel" style="color:#DC2626;">Total Interest</div>
    <div class="sval" style="color:#DC2626;">Rs.${fmtINR(d.interest)}</div>
  </div>
  <div class="stat" style="background:#F0FDF4;border-color:#BBF7D0;">
    <div class="slabel" style="color:#059669;">Total Payable</div>
    <div class="sval" style="color:#059669;">Rs.${fmtINR(d.total)}</div>
  </div>
</div>
<table>
  <tr><th>Parameter</th><th style="text-align:right;">Value</th></tr>
  ${[['Loan Amount',`Rs.${fmtINR(d.loanAmount)}`],['Annual Interest Rate',`${d.interestRate}%`],['Loan Tenure',`${d.tenureYears} Years (${d.tenureMonths} Months)`],['Monthly EMI',`Rs.${fmtINRFull(d.emi)}`],['Total Interest Payable',`Rs.${fmtINR(d.interest)}`],['Total Amount Payable',`Rs.${fmtINR(d.total)}`]].map(([l,v])=>`<tr><td>${l}</td><td style="text-align:right;font-weight:700;">${v}</td></tr>`).join('')}
</table>
<div class="bar-wrap">
  <div style="font-size:10px;font-weight:700;color:#64748B;text-transform:uppercase;letter-spacing:.5px;">Loan Composition</div>
  <div class="bar"><div class="bar-p" style="width:${pPct}%"></div><div class="bar-i" style="width:${iPct}%"></div></div>
  <div class="bar-labels"><span style="color:#1D4ED8;">Principal — ${pPct}%</span><span style="color:#F43F5E;">Interest — ${iPct}%</span></div>
</div>
<div class="disc"><strong>Disclaimer:</strong> This calculation is for illustration purposes only. Actual EMI may vary based on lender policies, processing fees, GST and applicable charges. Consult a financial advisor for precise figures.</div>
</body></html>`

  const w = window.open('', '_blank', 'width=800,height=700')
  if (!w) return
  w.document.write(html)
  w.document.close()
  w.focus()
  setTimeout(() => w.print(), 500)
}

// ─── slider ───────────────────────────────────────────────────────────────────

interface InputSliderProps {
  label: string; value: number; min: number; max: number; step: number
  prefix?: string; suffix?: string; onChange: (v: number) => void
  formatDisplay?: (v: number) => string
}

function InputSlider({ label, value, min, max, step, prefix, suffix, onChange, formatDisplay }: InputSliderProps) {
  const [inputVal, setInputVal] = useState(String(value))
  useEffect(() => { setInputVal(String(value)) }, [value])

  const handleBlur = () => {
    const num = parseFloat(inputVal.replace(/,/g, ''))
    if (isNaN(num) || num < min) { onChange(min); setInputVal(String(min)) }
    else if (num > max) { onChange(max); setInputVal(String(max)) }
    else { onChange(num); setInputVal(String(num)) }
  }

  const pct = ((value - min) / (max - min)) * 100

  return (
    <div className="space-y-2.5">
      <div className="flex items-center justify-between">
        <label className="text-[13px] font-semibold text-[#374151]">{label}</label>
        <div className="flex items-center gap-1.5 bg-white border border-[#E2E8F0] rounded-lg px-3 py-1.5 shadow-sm focus-within:border-blue-400 transition-colors">
          {prefix && <span className="text-blue-600 text-sm font-bold">{prefix}</span>}
          <input
            type="text" inputMode="decimal" value={inputVal}
            onChange={(e) => {
              const raw = e.target.value.replace(/,/g, '')
              setInputVal(raw)
              const num = parseFloat(raw)
              if (!isNaN(num) && num >= min && num <= max) onChange(num)
            }}
            onBlur={handleBlur}
            className="w-24 text-right text-[#0F172A] text-sm font-bold outline-none bg-transparent"
          />
          {suffix && <span className="text-[#64748B] text-sm font-semibold">{suffix}</span>}
        </div>
      </div>
      <div className="relative h-1.5 bg-[#E2E8F0] rounded-full">
        <div className="absolute top-0 left-0 h-1.5 rounded-full transition-all duration-100"
          style={{ width: `${pct}%`, background: 'linear-gradient(90deg,#1D4ED8,#60A5FA)' }} />
        <input type="range" min={min} max={max} step={step} value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
        <div className="absolute top-1/2 -translate-y-1/2 w-4 h-4 rounded-full bg-white border-2 border-blue-600 shadow-md shadow-blue-200 pointer-events-none transition-all duration-100"
          style={{ left: `calc(${pct}% - 8px)` }} />
      </div>
      <div className="flex justify-between text-[10px] text-[#CBD5E1] font-medium">
        <span>{formatDisplay ? formatDisplay(min) : `${prefix || ''}${fmtINR(min)}${suffix || ''}`}</span>
        <span>{formatDisplay ? formatDisplay(max) : `${prefix || ''}${fmtINR(max)}${suffix || ''}`}</span>
      </div>
    </div>
  )
}

// ─── toast ────────────────────────────────────────────────────────────────────

function Toast({ type, message, onClose }: { type: 'success' | 'error'; message: string; onClose: () => void }) {
  useEffect(() => { const t = setTimeout(onClose, 4000); return () => clearTimeout(t) }, [onClose])
  return (
    <div className={`fixed bottom-6 right-6 z-[100] flex items-center gap-3 px-4 py-3 rounded-xl shadow-2xl text-sm font-medium border transition-all ${
      type === 'success' ? 'bg-white border-emerald-200 text-emerald-700 shadow-emerald-100' : 'bg-white border-red-200 text-red-600 shadow-red-100'
    }`}>
      {type === 'success' ? <CheckCircle size={16} className="text-emerald-500" /> : <AlertCircle size={16} className="text-red-500" />}
      <span>{message}</span>
      <button onClick={onClose} className="ml-1 opacity-50 hover:opacity-100"><X size={14} /></button>
    </div>
  )
}

// ─── modal ────────────────────────────────────────────────────────────────────

function Modal({ title, subtitle, children, onClose, icon }: {
  title: string; subtitle?: string; children: React.ReactNode; onClose: () => void; icon?: React.ReactNode
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-sm" />
      <div className="relative w-full max-w-md rounded-2xl border border-[#E2E8F0] shadow-2xl bg-white" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#F1F5F9]">
          <div className="flex items-center gap-2.5">
            {icon && <div className="w-8 h-8 rounded-lg bg-blue-50 flex items-center justify-center">{icon}</div>}
            <div>
              <h3 className="text-[15px] font-semibold text-[#0F172A]">{title}</h3>
              {subtitle && <p className="text-xs text-[#94A3B8]">{subtitle}</p>}
            </div>
          </div>
          <button onClick={onClose} className="text-[#94A3B8] hover:text-[#374151] transition-colors p-1 rounded-lg hover:bg-gray-100"><X size={16} /></button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  )
}

// ─── stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, color, bg, icon: Icon }: { label: string; value: string; color: string; bg: string; icon: any }) {
  return (
    <div className="rounded-xl p-4 border border-[#E2E8F0] bg-white shadow-sm">
      <div className="w-8 h-8 rounded-lg flex items-center justify-center mb-2.5" style={{ background: bg }}>
        <Icon size={15} style={{ color }} />
      </div>
      <p className="text-[10px] text-[#94A3B8] font-semibold uppercase tracking-wider mb-1">{label}</p>
      <p className="text-lg font-bold text-[#0F172A]">{value}</p>
    </div>
  )
}

// ─── main page ────────────────────────────────────────────────────────────────

export default function EmiCalculator() {
  const [loanAmount,   setLoanAmount]   = useState(2500000)
  const [interestRate, setInterestRate] = useState(8.5)
  const [tenureYears,  setTenureYears]  = useState(20)

  const [activeTab,        setActiveTab]        = useState<'calculator' | 'history'>('calculator')
  const [showAmortisation, setShowAmortisation] = useState(false)

  const [emailModal,    setEmailModal]    = useState<{ open: boolean; id: string | null }>({ open: false, id: null })
  const [whatsappModal, setWhatsappModal] = useState(false)
  const [emailInput,    setEmailInput]    = useState('')
  const [whatsappInput, setWhatsappInput] = useState('')

  const [saving,       setSaving]       = useState(false)
  const [emailSending, setEmailSending] = useState(false)
  const [toast,        setToast]        = useState<{ type: 'success' | 'error'; message: string } | null>(null)
  const [deletingId,   setDeletingId]   = useState<string | null>(null)

  const [history,      setHistory]      = useState<EmiCalculation[]>([])
  const [histLoading,  setHistLoading]  = useState(false)
  const [histPage,     setHistPage]     = useState(1)
  const [histTotal,    setHistTotal]    = useState(0)
  const [histPages,    setHistPages]    = useState(1)

  const tenureMonths = tenureYears * 12
  const { emi, total, interest } = calcEmi(loanAmount, interestRate, tenureMonths)
  const principalPct = total > 0 ? Math.round((loanAmount / total) * 100) : 0
  const interestPct  = 100 - principalPct

  const showToast = (type: 'success' | 'error', message: string) => setToast({ type, message })

  const loadHistory = useCallback(async (page = 1) => {
    setHistLoading(true)
    try {
      const res = await emiCalculatorAPI.getCalculations({ page: String(page), limit: '10' })
      if (res.success) { setHistory(res.data); setHistTotal(res.pagination.total); setHistPages(res.pagination.pages); setHistPage(page) }
    } catch { showToast('error', 'Failed to load history') }
    finally { setHistLoading(false) }
  }, [])

  useEffect(() => { if (activeTab === 'history') loadHistory(1) }, [activeTab, loadHistory])

  const handleSave = async () => {
    if (!emi) return
    setSaving(true)
    try {
      await emiCalculatorAPI.saveCalculation({ loanAmount, interestRate, tenureYears, tenureMonths, monthlyEmi: emi, totalAmount: total, totalInterest: interest })
      showToast('success', 'Calculation saved to history!')
    } catch { showToast('error', 'Failed to save calculation') }
    finally { setSaving(false) }
  }

  const saveAndGetId = async (): Promise<string | null> => {
    try {
      const r = await emiCalculatorAPI.saveCalculation({ loanAmount, interestRate, tenureYears, tenureMonths, monthlyEmi: emi, totalAmount: total, totalInterest: interest })
      return r.data._id
    } catch { return null }
  }

  const handleSendEmail = async (calcId: string | null) => {
    if (!emailInput.trim()) return
    let id = calcId
    if (!id) {
      setSaving(true)
      id = await saveAndGetId()
      setSaving(false)
      if (!id) { showToast('error', 'Failed to save before sending email'); return }
    }
    setEmailSending(true)
    try {
      const res = await emiCalculatorAPI.sendEmail(id, emailInput.trim())
      if (res.success) { showToast('success', `Email sent to ${emailInput.trim()}`); setEmailModal({ open: false, id: null }); setEmailInput('') }
      else showToast('error', res.message || 'Failed to send email')
    } catch { showToast('error', 'Failed to send email. Please try again.') }
    finally { setEmailSending(false) }
  }

  const handleWhatsApp = () => {
    const num = whatsappInput.replace(/\D/g, '')
    if (!num) return
    const msg = encodeURIComponent(
      `EMI Calculation Summary\n\nLoan Amount: Rs.${fmtINR(loanAmount)}\nInterest Rate: ${interestRate}% p.a.\nTenure: ${tenureYears} Years (${tenureMonths} months)\n\nMonthly EMI: Rs.${fmtINRFull(emi)}\nTotal Amount Payable: Rs.${fmtINR(total)}\nTotal Interest Payable: Rs.${fmtINR(interest)}\n\nCalculated via BuildFlow CRM`
    )
    window.open(`https://wa.me/${num}?text=${msg}`, '_blank')
    setWhatsappModal(false)
    setWhatsappInput('')
  }

  const handleDelete = async (id: string) => {
    setDeletingId(id)
    try {
      await emiCalculatorAPI.deleteCalculation(id)
      setHistory((prev) => prev.filter((c) => c._id !== id))
      setHistTotal((prev) => prev - 1)
      showToast('success', 'Calculation deleted')
    } catch { showToast('error', 'Failed to delete') }
    finally { setDeletingId(null) }
  }

  const handleLoadCalc = (calc: EmiCalculation) => {
    setLoanAmount(calc.loanAmount)
    setInterestRate(calc.interestRate)
    setTenureYears(calc.tenureYears)
    setActiveTab('calculator')
    showToast('success', 'Calculation loaded into calculator')
  }

  // Direct PDF download — no print dialog
  const handleDownloadPDF = () => {
    if (!emi) return
    downloadEmiPDF({ loanAmount, interestRate, tenureYears, tenureMonths, emi, total, interest })
  }

  // Print — opens clean print window
  const handlePrint = () => {
    if (!emi) return
    openPrintWindow({ loanAmount, interestRate, tenureYears, tenureMonths, emi, total, interest })
  }

  const amortisationRows = showAmortisation && emi > 0
    ? buildAmortisation(loanAmount, interestRate, tenureMonths, emi) : []

  return (
    <div className="min-h-screen bg-[#F8FAFC]">

      {/* ── Header ── */}
      <div className="bg-white border-b border-[#E2E8F0] px-6 py-5">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-xl flex items-center justify-center" style={{ background: 'linear-gradient(135deg,#1D4ED8,#3B82F6)' }}>
              <Calculator size={18} className="text-white" />
            </div>
            <div>
              <h1 className="text-[17px] font-bold text-[#0F172A] tracking-tight">EMI Calculator</h1>
              <p className="text-xs text-[#94A3B8] mt-0.5">Calculate, save and share loan EMI details</p>
            </div>
          </div>
          {activeTab === 'calculator' && (
            <button onClick={() => { setLoanAmount(2500000); setInterestRate(8.5); setTenureYears(20) }}
              className="flex items-center gap-1.5 text-xs text-[#64748B] hover:text-[#1D4ED8] border border-[#E2E8F0] hover:border-blue-200 rounded-lg px-3 py-1.5 bg-white transition-colors">
              <RotateCcw size={12} /> Reset
            </button>
          )}
        </div>
      </div>

      {/* ── Tabs ── */}
      <div className="px-6 pt-4">
        <div className="flex items-center gap-1 border-b border-[#E2E8F0]">
          {(['calculator', 'history'] as const).map((tab) => (
            <button key={tab} onClick={() => setActiveTab(tab)}
              className={`flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-all -mb-[1px] ${
                activeTab === tab ? 'border-blue-600 text-blue-600' : 'border-transparent text-[#64748B] hover:text-[#374151]'
              }`}>
              {tab === 'calculator' ? <Calculator size={14} /> : <Clock size={14} />}
              {tab === 'calculator' ? 'Calculator' : `History${histTotal > 0 ? ` (${histTotal})` : ''}`}
            </button>
          ))}
        </div>
      </div>

      <div className="px-6 py-5">

        {/* ══ CALCULATOR TAB ══ */}
        {activeTab === 'calculator' && (
          <div className="grid grid-cols-1 xl:grid-cols-5 gap-5">

            {/* Left: inputs */}
            <div className="xl:col-span-2 bg-white rounded-2xl border border-[#E2E8F0] p-6 space-y-6 shadow-sm">
              <div className="flex items-center gap-2">
                <IndianRupee size={14} className="text-blue-600" />
                <h2 className="text-xs font-bold text-[#374151] uppercase tracking-wider">Loan Details</h2>
              </div>

              <InputSlider label="Loan Amount" value={loanAmount} min={100000} max={100000000} step={50000}
                prefix="Rs." onChange={setLoanAmount}
                formatDisplay={(v) => v >= 10000000 ? `Rs.${(v/10000000).toFixed(1)}Cr` : `Rs.${(v/100000).toFixed(0)}L`} />

              <InputSlider label="Annual Interest Rate" value={interestRate} min={1} max={30} step={0.1}
                suffix="%" onChange={setInterestRate} formatDisplay={(v) => `${v}%`} />

              <InputSlider label="Loan Tenure" value={tenureYears} min={1} max={30} step={1}
                suffix=" Yr" onChange={setTenureYears} formatDisplay={(v) => `${v} Yr`} />

              <div className="border-t border-[#F1F5F9]" />

              {/* Buttons */}
              <div className="space-y-2.5">
                <button onClick={handleSave} disabled={saving || !emi}
                  className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors text-white shadow-sm shadow-blue-200">
                  {saving ? <Loader2 size={15} className="animate-spin" /> : <Save size={15} />} Save to History
                </button>

                <div className="grid grid-cols-2 gap-2">
                  <button onClick={() => setEmailModal({ open: true, id: null })} disabled={!emi}
                    className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold border border-[#E2E8F0] text-[#374151] hover:bg-[#F8FAFC] hover:border-blue-200 disabled:opacity-40 transition-colors bg-white">
                    <Mail size={13} className="text-blue-500" /> Send Email
                  </button>
                  <button onClick={() => setWhatsappModal(true)} disabled={!emi}
                    className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold border border-[#E2E8F0] text-[#374151] hover:bg-[#F8FAFC] hover:border-emerald-200 disabled:opacity-40 transition-colors bg-white">
                    <MessageCircle size={13} className="text-emerald-500" /> WhatsApp
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2">
                  {/* Download PDF — direct file download, no dialog */}
                  <button onClick={handleDownloadPDF} disabled={!emi}
                    className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold border border-[#E2E8F0] text-[#374151] hover:bg-purple-50 hover:border-purple-200 disabled:opacity-40 transition-colors bg-white">
                    <FileDown size={13} className="text-purple-500" /> Download PDF
                  </button>
                  <button onClick={handlePrint} disabled={!emi}
                    className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-semibold border border-[#E2E8F0] text-[#374151] hover:bg-orange-50 hover:border-orange-200 disabled:opacity-40 transition-colors bg-white">
                    <Printer size={13} className="text-orange-500" /> Print
                  </button>
                </div>
              </div>
            </div>

            {/* Right: results */}
            <div className="xl:col-span-3 space-y-4">

              {/* EMI hero */}
              <div className="rounded-2xl p-6 shadow-md" style={{ background: 'linear-gradient(135deg,#1D4ED8 0%,#3B82F6 60%,#60A5FA 100%)' }}>
                <p className="text-blue-100/70 text-[10px] font-bold uppercase tracking-widest mb-2">Monthly EMI</p>
                <p className="text-5xl font-black text-white tracking-tight leading-none">
                  {emi > 0 ? `Rs.${fmtINRFull(emi)}` : '—'}
                </p>
                <p className="text-blue-100/60 text-xs mt-2.5">for {tenureYears} year{tenureYears !== 1 ? 's' : ''} at {interestRate}% p.a.</p>
              </div>

              {/* Stats */}
              <div className="grid grid-cols-3 gap-3">
                <StatCard label="Principal Amount" value={`Rs.${emi > 0 ? fmtINR(loanAmount) : '—'}`} color="#1D4ED8" bg="#EFF6FF" icon={IndianRupee} />
                <StatCard label="Total Interest"   value={`Rs.${emi > 0 ? fmtINR(interest) : '—'}`}    color="#DC2626" bg="#FEF2F2" icon={TrendingUp} />
                <StatCard label="Total Payable"    value={`Rs.${emi > 0 ? fmtINR(total) : '—'}`}       color="#059669" bg="#F0FDF4" icon={BarChart3} />
              </div>

              {/* Composition */}
              {emi > 0 && (
                <div className="bg-white rounded-2xl border border-[#E2E8F0] p-5 shadow-sm">
                  <p className="text-[10px] font-bold text-[#94A3B8] uppercase tracking-wider mb-4">Loan Composition</p>
                  <div className="h-2.5 rounded-full overflow-hidden flex mb-3">
                    <div className="h-full rounded-l-full transition-all duration-500" style={{ width: `${principalPct}%`, background: 'linear-gradient(90deg,#1D4ED8,#60A5FA)' }} />
                    <div className="h-full rounded-r-full transition-all duration-500" style={{ width: `${interestPct}%`,  background: 'linear-gradient(90deg,#F43F5E,#FB7185)' }} />
                  </div>
                  <div className="flex items-center justify-between text-xs font-semibold">
                    <span className="text-blue-600 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-blue-500" /> Principal — {principalPct}%
                    </span>
                    <span className="text-rose-500 flex items-center gap-1.5">
                      <span className="w-2.5 h-2.5 rounded-full bg-rose-500" /> Interest — {interestPct}%
                    </span>
                  </div>
                  <div className="mt-4 pt-4 border-t border-[#F1F5F9] grid grid-cols-2 gap-4 text-xs">
                    {[
                      { label: 'Monthly Interest Rate',   value: `${(interestRate/12).toFixed(4)}%` },
                      { label: 'Total Instalments',       value: `${tenureMonths} months` },
                      { label: 'Interest / Principal',    value: `${interestPct}% / ${principalPct}%` },
                      { label: 'Annual Repayment',        value: `Rs.${fmtINR(emi * 12)}` },
                    ].map(({ label, value }) => (
                      <div key={label}>
                        <p className="text-[#CBD5E1] mb-0.5">{label}</p>
                        <p className="text-[#374151] font-semibold">{value}</p>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Amortisation */}
              {emi > 0 && (
                <div className="bg-white rounded-2xl border border-[#E2E8F0] overflow-hidden shadow-sm">
                  <button onClick={() => setShowAmortisation(!showAmortisation)}
                    className="w-full flex items-center justify-between px-5 py-3.5 text-sm font-semibold text-[#374151] hover:bg-[#F8FAFC] transition-colors">
                    <span className="flex items-center gap-2">
                      <Calendar size={14} className="text-blue-500" />
                      Amortisation Schedule
                      <span className="text-[10px] text-[#CBD5E1] font-normal">({tenureMonths} months)</span>
                    </span>
                    <ChevronRight size={15} className={`text-[#CBD5E1] transition-transform duration-200 ${showAmortisation ? 'rotate-90' : ''}`} />
                  </button>
                  {showAmortisation && (
                    <div className="overflow-x-auto max-h-72 overflow-y-auto border-t border-[#F1F5F9]">
                      <table className="w-full text-xs">
                        <thead className="sticky top-0 bg-[#F8FAFC]">
                          <tr>
                            {['Month','EMI (Rs.)','Principal (Rs.)','Interest (Rs.)','Balance (Rs.)'].map((h) => (
                              <th key={h} className="px-4 py-2.5 text-left font-semibold text-[#94A3B8] uppercase tracking-wide whitespace-nowrap border-b border-[#E2E8F0]">{h}</th>
                            ))}
                          </tr>
                        </thead>
                        <tbody>
                          {amortisationRows.map((row, i) => (
                            <tr key={row.month} className={`border-t border-[#F8FAFC] hover:bg-blue-50/30 ${i % 2 === 1 ? 'bg-[#FAFBFC]' : ''}`}>
                              <td className="px-4 py-2 text-[#94A3B8]">{row.month}</td>
                              <td className="px-4 py-2 text-blue-600 font-semibold">{fmtINRFull(row.emi)}</td>
                              <td className="px-4 py-2 text-emerald-600">{fmtINRFull(row.principal)}</td>
                              <td className="px-4 py-2 text-rose-500">{fmtINRFull(row.interest)}</td>
                              <td className="px-4 py-2 text-[#374151]">{fmtINRFull(row.balance)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              )}

              {/* Disclaimer */}
              <div className="flex gap-2.5 p-4 rounded-xl border border-amber-200 bg-amber-50">
                <AlertCircle size={14} className="text-amber-500 mt-0.5 shrink-0" />
                <p className="text-[11px] text-amber-700 leading-relaxed">
                  <strong className="font-semibold">Disclaimer:</strong> This calculator is for illustration purposes only and does not represent actual loan terms. Actual EMI may vary based on lender policies, processing fees, GST and applicable charges. Consult a financial advisor for precise figures.
                </p>
              </div>
            </div>
          </div>
        )}

        {/* ══ HISTORY TAB ══ */}
        {activeTab === 'history' && (
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold text-[#374151]">
                Saved Calculations
                {histTotal > 0 && <span className="ml-2 text-xs font-normal text-[#94A3B8]">({histTotal} total)</span>}
              </h2>
              <button onClick={() => loadHistory(histPage)} disabled={histLoading}
                className="flex items-center gap-1.5 text-xs text-blue-600 hover:text-blue-700 border border-blue-200 rounded-lg px-3 py-1.5 bg-white transition-colors">
                {histLoading ? <Loader2 size={12} className="animate-spin" /> : <RotateCcw size={12} />} Refresh
              </button>
            </div>

            {histLoading && history.length === 0 ? (
              <div className="flex items-center justify-center py-20"><Loader2 size={24} className="animate-spin text-blue-500" /></div>
            ) : history.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-24">
                <div className="w-16 h-16 rounded-2xl bg-blue-50 flex items-center justify-center mb-4"><Calculator size={28} className="text-blue-300" /></div>
                <p className="text-sm font-semibold text-[#94A3B8]">No saved calculations yet</p>
                <p className="text-xs mt-1 text-[#CBD5E1]">Run a calculation and click "Save to History"</p>
              </div>
            ) : (
              <>
                <div className="space-y-3">
                  {history.map((calc) => {
                    const pP = Math.round((calc.loanAmount / calc.totalAmount) * 100)
                    const iP = 100 - pP
                    return (
                      <div key={calc._id} className="bg-white rounded-2xl border border-[#E2E8F0] p-5 hover:border-blue-200 hover:shadow-sm transition-all shadow-sm">
                        <div className="flex items-start justify-between gap-3">
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-2 flex-wrap mb-2">
                              <span className="text-2xl font-black text-blue-600 tracking-tight">Rs.{fmtINRFull(calc.monthlyEmi)}</span>
                              <span className="text-xs text-[#94A3B8]">/month</span>
                              <span className="ml-auto text-[10px] px-2 py-0.5 rounded-full bg-[#F8FAFC] border border-[#E2E8F0] text-[#94A3B8]">{formatDate(calc.createdAt)}</span>
                            </div>
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#64748B]">
                              <span>Loan: <strong className="text-[#374151]">Rs.{fmtINR(calc.loanAmount)}</strong></span>
                              <span>Rate: <strong className="text-[#374151]">{calc.interestRate}%</strong></span>
                              <span>Tenure: <strong className="text-[#374151]">{calc.tenureYears} Yrs</strong></span>
                              <span>Total: <strong className="text-[#374151]">Rs.{fmtINR(calc.totalAmount)}</strong></span>
                              <span>Interest: <strong className="text-rose-500">Rs.{fmtINR(calc.totalInterest)}</strong></span>
                            </div>
                            <div className="mt-3 h-1.5 rounded-full overflow-hidden flex">
                              <div className="h-full rounded-l-full" style={{ width: `${pP}%`, background: '#3B82F6' }} />
                              <div className="h-full rounded-r-full" style={{ width: `${iP}%`, background: '#F43F5E' }} />
                            </div>
                            <div className="mt-1.5 flex gap-3 text-[10px] font-semibold">
                              <span className="text-blue-500">Principal {pP}%</span>
                              <span className="text-rose-400">Interest {iP}%</span>
                            </div>
                          </div>
                          <div className="flex flex-col gap-1.5 shrink-0">
                            <button onClick={() => handleLoadCalc(calc)}
                              className="text-[10px] px-3 py-1.5 rounded-lg bg-blue-50 text-blue-600 hover:bg-blue-100 font-semibold border border-blue-100 whitespace-nowrap">Load</button>
                            <button onClick={() => { setEmailModal({ open: true, id: calc._id }); setEmailInput('') }}
                              className="text-[10px] px-3 py-1.5 rounded-lg bg-[#F8FAFC] text-[#374151] hover:bg-blue-50 font-semibold border border-[#E2E8F0]">
                              <Mail size={10} className="inline mr-1 text-blue-500" />Email</button>
                            <button onClick={() => { setLoanAmount(calc.loanAmount); setInterestRate(calc.interestRate); setTenureYears(calc.tenureYears); setWhatsappModal(true) }}
                              className="text-[10px] px-3 py-1.5 rounded-lg bg-emerald-50 text-emerald-600 hover:bg-emerald-100 font-semibold border border-emerald-100">
                              <MessageCircle size={10} className="inline mr-1" />WA</button>
                            <button onClick={() => handleDelete(calc._id)} disabled={deletingId === calc._id}
                              className="text-[10px] px-3 py-1.5 rounded-lg bg-red-50 text-red-500 hover:bg-red-100 font-semibold border border-red-100 disabled:opacity-40">
                              {deletingId === calc._id ? <Loader2 size={10} className="animate-spin inline" /> : <Trash2 size={10} className="inline" />}</button>
                          </div>
                        </div>
                        {calc.userName && <p className="mt-2 text-[10px] text-[#CBD5E1]">Saved by {calc.userName}</p>}
                      </div>
                    )
                  })}
                </div>
                {histPages > 1 && (
                  <div className="flex items-center justify-center gap-2 pt-2">
                    <button disabled={histPage <= 1} onClick={() => loadHistory(histPage - 1)}
                      className="px-4 py-1.5 rounded-lg text-xs font-semibold border border-[#E2E8F0] text-[#374151] hover:bg-[#F8FAFC] disabled:opacity-30 bg-white">Previous</button>
                    <span className="text-xs text-[#94A3B8]">Page {histPage} of {histPages}</span>
                    <button disabled={histPage >= histPages} onClick={() => loadHistory(histPage + 1)}
                      className="px-4 py-1.5 rounded-lg text-xs font-semibold border border-[#E2E8F0] text-[#374151] hover:bg-[#F8FAFC] disabled:opacity-30 bg-white">Next</button>
                  </div>
                )}
              </>
            )}
          </div>
        )}
      </div>

      {/* ══ EMAIL MODAL ══ */}
      {emailModal.open && (
        <Modal title="Send via Email" subtitle="Sends formatted EMI report to any email" onClose={() => { setEmailModal({ open: false, id: null }); setEmailInput('') }} icon={<Mail size={15} className="text-blue-600" />}>
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-blue-50 border border-blue-100">
              <p className="text-xs text-blue-700 font-semibold mb-1">Calculation Summary</p>
              <p className="text-xs text-blue-600">EMI Rs.{fmtINRFull(emi)} · Loan Rs.{fmtINR(loanAmount)} · {interestRate}% · {tenureYears} Yrs</p>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1.5">Recipient Email Address</label>
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] focus-within:border-blue-400 focus-within:bg-white transition-colors">
                <Mail size={13} className="text-[#CBD5E1] shrink-0" />
                <input type="email" value={emailInput} onChange={(e) => setEmailInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleSendEmail(emailModal.id) }}
                  placeholder="client@example.com" autoFocus
                  className="flex-1 bg-transparent text-sm text-[#0F172A] outline-none placeholder:text-[#CBD5E1]" />
              </div>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => { setEmailModal({ open: false, id: null }); setEmailInput('') }}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-[#374151] border border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors">Cancel</button>
              <button onClick={() => handleSendEmail(emailModal.id)} disabled={emailSending || !emailInput.trim()}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-blue-600 hover:bg-blue-700 disabled:opacity-40 text-white flex items-center justify-center gap-2 shadow-sm shadow-blue-200">
                {emailSending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} Send Email
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* ══ WHATSAPP MODAL ══ */}
      {whatsappModal && (
        <Modal title="Send via WhatsApp" subtitle="Opens WhatsApp with pre-filled message" onClose={() => { setWhatsappModal(false); setWhatsappInput('') }} icon={<MessageCircle size={15} className="text-emerald-600" />}>
          <div className="space-y-4">
            <div className="p-3 rounded-xl bg-emerald-50 border border-emerald-100">
              <p className="text-xs text-emerald-700 font-semibold mb-2">Message Preview</p>
              <div className="text-xs text-emerald-700 font-mono leading-relaxed space-y-0.5">
                <p className="font-bold">EMI Calculation Summary</p>
                <p>Loan Amount: Rs.{fmtINR(loanAmount)}</p>
                <p>Interest Rate: {interestRate}% p.a.</p>
                <p>Tenure: {tenureYears} Yrs ({tenureMonths} months)</p>
                <p className="font-bold pt-1">Monthly EMI: Rs.{fmtINRFull(emi)}</p>
                <p>Total Payable: Rs.{fmtINR(total)}</p>
                <p>Total Interest: Rs.{fmtINR(interest)}</p>
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-[#374151] mb-1.5">WhatsApp Number (with country code)</label>
              <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl border border-[#E2E8F0] bg-[#F8FAFC] focus-within:border-emerald-400 focus-within:bg-white transition-colors">
                <MessageCircle size={13} className="text-emerald-500 shrink-0" />
                <input type="tel" value={whatsappInput} onChange={(e) => setWhatsappInput(e.target.value)}
                  onKeyDown={(e) => { if (e.key === 'Enter') handleWhatsApp() }}
                  placeholder="919876543210" autoFocus
                  className="flex-1 bg-transparent text-sm text-[#0F172A] outline-none placeholder:text-[#CBD5E1]" />
              </div>
              <p className="text-[10px] text-[#CBD5E1] mt-1.5">Include country code without + (e.g. 919876543210)</p>
            </div>
            <div className="flex gap-2 pt-1">
              <button onClick={() => { setWhatsappModal(false); setWhatsappInput('') }}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold text-[#374151] border border-[#E2E8F0] hover:bg-[#F8FAFC] transition-colors">Cancel</button>
              <button onClick={handleWhatsApp} disabled={!whatsappInput.replace(/\D/g, '')}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 disabled:opacity-40 text-white flex items-center justify-center gap-2 shadow-sm shadow-emerald-100">
                <MessageCircle size={14} /> Open WhatsApp
              </button>
            </div>
          </div>
        </Modal>
      )}

      {toast && <Toast type={toast.type} message={toast.message} onClose={() => setToast(null)} />}
    </div>
  )
}
