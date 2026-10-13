// Génération du PDF (jsPDF + autoTable) puis enregistrement / partage.
// Sur Android : écrit le fichier dans le cache de l'appli et ouvre le menu de partage
// (Enregistrer, Drive, WhatsApp, Imprimer…). Dans un navigateur : téléchargement direct.
import { jsPDF } from 'jspdf';
import * as ATmod from 'jspdf-autotable';
import { Capacitor } from '@capacitor/core';
import { Filesystem, Directory } from '@capacitor/filesystem';
import { Share } from '@capacitor/share';

const autoTable = typeof ATmod.default === 'function' ? ATmod.default : ATmod.autoTable;

const rgb = h => { const n = parseInt(String(h || '').slice(1), 16); return isNaN(n) ? [30, 58, 138] : [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const lum = c => { const [r, g, b] = c.map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * r + .7152 * g + .0722 * b; };
const mixW = (c, t) => c.map(x => Math.round(x * t + 255 * (1 - t)));

// Les polices standard du PDF ne contiennent que les caractères latins (WinAnsi)
const clean = s => String(s ?? '')
  .replace(/[\u2018\u2019]/g, "'").replace(/[\u201C\u201D]/g, '"').replace(/[\u2013\u2014]/g, '-')
  .replace(/\u2026/g, '...').replace(/\u0153/g, 'oe').replace(/\u0152/g, 'OE')
  .replace(/\u2713/g, 'V').replace(/\u2717/g, 'X').replace(/[\u202F\u00A0]/g, ' ')
  .replace(/[^\n\r\t\x20-\x7E\u00A1-\u00FF]/g, '?');

export async function exportPdf(model, o) {
  const doc = new jsPDF({ orientation: o.orientation === 'portrait' ? 'portrait' : 'landscape', unit: 'mm', format: 'a4' });
  const W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight();
  const M = 12, font = o.font || 'helvetica';
  const base = Math.min(16, Math.max(8, 10 * (o.scale || 1)));      // pt
  const PT = 0.3528;                                                // mm par point
  const pri = rgb(o.colors.pri), ink = rgb(o.colors.ink), soft = mixW(rgb(o.colors.pri2), .14);
  const onPri = lum(pri) > .45 ? [17, 24, 39] : [255, 255, 255];
  let y = M;

  doc.setProperties({ title: clean(model.title) });
  const ensure = h => { if (y + h > H - M - 6) { doc.addPage(); y = M; } };

  function heading(text, lvl) {
    const size = lvl === 1 ? base * 1.7 : base * 1.2, lh = size * PT * 1.25;
    const lines = doc.splitTextToSize(clean(text), W - 2 * M);
    ensure(lh * lines.length + 4);
    doc.setFont(font, 'bold'); doc.setFontSize(size); doc.setTextColor(...pri);
    for (const l of lines) { doc.text(l, M, y + size * PT); y += lh; }
    if (lvl === 1) { doc.setDrawColor(...pri); doc.setLineWidth(.6); doc.line(M, y, W - M, y); y += 4; } else y += 1.5;
  }
  function paragraph(text, label) {
    const lh = base * PT * 1.4;
    doc.setFontSize(base);
    if (label) {
      ensure(lh * 2); doc.setFont(font, 'bold'); doc.setTextColor(...pri);
      doc.text(clean(label), M, y + base * PT); y += lh;
    }
    doc.setFont(font, 'normal'); doc.setTextColor(...ink);
    for (const l of doc.splitTextToSize(clean(text), W - 2 * M)) { ensure(lh); doc.text(l, M, y + base * PT); y += lh; }
    y += 2;
  }
  function cell(c) {
    if (typeof c !== 'object' || c === null) return clean(c);
    const out = { content: clean(c.c) };
    if (c.colSpan) out.colSpan = c.colSpan;
    if (c.rowSpan) out.rowSpan = c.rowSpan;
    if (c.kind === 'perf') out.styles = { fillColor: [180, 83, 9], textColor: [255, 255, 255] };
    return out;
  }
  function table(b) {
    ensure(28);
    const left = b.align === 'left';
    autoTable(doc, {
      startY: y,
      head: b.head.map(r => r.map(cell)),
      body: b.body.map(r => r.map(cell)),
      foot: b.foot ? b.foot.map(r => r.map(cell)) : undefined,
      showHead: 'everyPage', showFoot: 'lastPage', theme: 'grid',
      margin: { left: M, right: M, top: M, bottom: M + 6 },
      styles: { font, fontSize: base * .85, cellPadding: 1.3, halign: left ? 'left' : 'center', valign: 'middle',
        lineColor: [190, 198, 215], lineWidth: .2, textColor: ink, overflow: 'linebreak', minCellHeight: b.minH || 0 },
      headStyles: { fillColor: pri, textColor: onPri, fontStyle: 'bold', halign: 'center' },
      footStyles: { fillColor: soft, textColor: ink, fontStyle: 'bold' },
      columnStyles: left ? { 0: { cellWidth: b.firstW || 26, fontStyle: 'bold' } } : { 0: { halign: 'left', cellWidth: b.firstW || 'auto' } }
    });
    y = doc.lastAutoTable.finalY + 6;
  }

  for (const b of model.blocks) {
    if (b.t === 'h1') { if (b.newPage && y > M) { doc.addPage(); y = M; } heading(b.text, 1); }
    else if (b.t === 'h2') heading(b.text, 2);
    else if (b.t === 'kv') paragraph(b.text, b.label);
    else if (b.t === 'p') paragraph(b.text);
    else if (b.t === 'table') table(b);
  }

  // pied de page : école · classe · année + numéro de page
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    doc.setPage(i); doc.setFont(font, 'normal'); doc.setFontSize(8); doc.setTextColor(120, 120, 120);
    doc.text(clean(`${model.footer || ''}   -   ${i} / ${n}`), W / 2, H - 6, { align: 'center' });
  }

  const name = o.fileName || 'dossier.pdf';
  if (Capacitor.isNativePlatform()) {
    const uri = doc.output('datauristring');
    const data = uri.slice(uri.indexOf('base64,') + 7);
    const f = await Filesystem.writeFile({ path: name, data, directory: Directory.Cache });
    await Share.share({ title: name, url: f.uri, dialogTitle: 'Enregistrer ou imprimer le PDF' });
  } else {
    doc.save(name);
  }
}
