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
  const orient = o.orientation === 'portrait' ? 'portrait' : 'landscape';
  const firstCover = !!(model.blocks[0] && model.blocks[0].t === 'cover');
  // la page de couverture est toujours en portrait ; les autres pages suivent le choix de l'utilisateur
  const doc = new jsPDF({ orientation: firstCover ? 'portrait' : orient, unit: 'mm', format: 'a4' });
  const dimsOf = ori => (ori === 'portrait' ? [210, 297] : [297, 210]);
  const coverPages = new Set();   // numéros des pages de couverture (sans pied de page)
  let [W, H] = dimsOf(firstCover ? 'portrait' : orient);
  const M = 12, font = o.font || 'helvetica';
  const base = Math.min(16, Math.max(8, 10 * (o.scale || 1)));      // pt
  const PT = 0.3528;                                                // mm par point
  const pri = rgb(o.colors.pri), ink = rgb(o.colors.ink), soft = mixW(rgb(o.colors.pri2), .14);
  const onPri = lum(pri) > .45 ? [17, 24, 39] : [255, 255, 255];
  let y = M;
  const newPage = ori => {
    ori = ori || orient; doc.addPage('a4', ori);
    [W, H] = dimsOf(ori); y = M;
  };

  doc.setProperties({ title: clean(model.title) });
  const ensure = h => { if (y + h > H - M - 6) newPage(); };


  // ---------- page de couverture (modèle du cahier papier) ----------
  const PURPLE = [112, 48, 160], RED = [226, 38, 28], DRED = [176, 30, 24], GREY = [128, 128, 128];
  function rainbow(h) {      // h de 0 (rouge) à .75 (violet)
    const f = n => { const k = (n + h * 6) % 6; return Math.round(255 * (.86 - .86 * .86 * Math.max(0, Math.min(k, 4 - k, 1)))); };
    return [f(5), f(3), f(1)];
  }
  function drawCover(c) {
    const cx = W / 2, up = t => clean(t).toUpperCase();
    const fit = (txt, fnt, st, size, maxW) => {      // réduit la taille pour tenir dans maxW
      doc.setFont(fnt, st); doc.setFontSize(size);
      const w = doc.getTextWidth(txt);
      if (w > maxW) { size = size * maxW / w; doc.setFontSize(size); }
      return size;
    };
    const center = (txt, x, yy, fnt, st, size, col, maxW) => {
      txt = clean(txt); fit(txt, fnt, st, size, maxW || W - 40); doc.setTextColor(...col);
      doc.text(txt, x, yy, { align: 'center' }); return doc.getTextWidth(txt);
    };
    // cadre de la page
    doc.setDrawColor(170, 170, 170); doc.setLineWidth(.4); doc.rect(8, 8, W - 16, H - 16);
    // en-têtes gauche / droite
    ['Direction Régionale', 'De l\'enseignement', 'De ' + (c.dre || '')].forEach((t, i) =>
      center(t, 50, 28 + i * 7.2, 'times', 'bold', 11, [0, 0, 0], 70));
    const circL = ['CIRCONSCRIPTION', up(c.circ || ''), 'POUR LA LANGUE', 'FRANCAISE'];
    circL.forEach((t, i) => {
      const w = center(t, 161, 27 + i * 6, 'times', 'bold', 11, [0, 0, 0], 70);
      if (i === 1 && t) { doc.setDrawColor(0, 0, 0); doc.setLineWidth(.3); doc.line(161 - w / 2, 27 + i * 6 + 1, 161 + w / 2, 27 + i * 6 + 1); }
    });
    // école
    center('ECOLE PRIMAIRE ' + (String(c.ecole || '').trim() ? up(c.ecole) : '..........................'), cx, 59, 'helvetica', 'bold', 14, PURPLE);
    // titre
    center('CAHIER D\'EVALUATION', cx, 76, 'times', 'bold', 42, RED, W - 36);
    // classe : 5 ème A  (« ème » en exposant)
    {
      const m = String(c.classe || '').trim().match(/^(\d+)\s*(ème|eme|ère|ere|er|e)?\s*(.*)$/i);
      const big = 32;
      if (m) {
        const num = clean(m[1]), sup = clean(m[2] || ''), rest = clean(m[3] || '');
        doc.setFont('helvetica', 'normal'); doc.setFontSize(big); const w1 = doc.getTextWidth(num);
        doc.setFontSize(big * .55); const w2 = sup ? doc.getTextWidth(sup) + 1.5 : 0;
        doc.setFontSize(big); const w3 = rest ? doc.getTextWidth(' ' + rest) : 0;
        let x = cx - (w1 + w2 + w3) / 2; doc.setTextColor(0, 0, 0);
        doc.setFontSize(big); doc.text(num, x, 100); x += w1 + 1;
        if (sup) { doc.setFontSize(big * .55); doc.text(sup, x, 94.5); x += w2 - 1; }
        if (rest) { doc.setFont('helvetica', 'bold'); doc.setFontSize(big); doc.text(' ' + rest, x, 100); }
      } else center(c.classe || '', cx, 100, 'helvetica', 'bold', big, [0, 0, 0]);
    }
    // prénom et nom de l'enseignant(e) en couleurs
    {
      const txt = clean(String(c.enseignant || '').trim() || 'Prénom et Nom');
      const size = fit(txt, 'helvetica', 'bold', 44, W - 50);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(size);
      const chars = [...txt], ws = chars.map(ch => doc.getTextWidth(ch)), tot = ws.reduce((a, b) => a + b, 0);
      let x = cx - tot / 2;
      chars.forEach((ch, i) => { doc.setTextColor(...rainbow(.75 * i / Math.max(1, chars.length - 1))); doc.text(ch, x, 136); x += ws[i]; });
    }
    // inspecteur / assistant pédagogique
    center('L\'INSPECTEUR', cx, 172, 'helvetica', 'bold', 17, [0, 0, 0]);
    center(c.inspecteur || '', cx, 187, 'helvetica', 'bold', 26, DRED, W - 36);
    center('L\'assistant pédagogique', cx, 203, 'helvetica', 'bold', 14, [0, 0, 0]);
    center(c.assistant || '', cx, 220, 'helvetica', 'bold', 26, DRED, W - 36);
    // année scolaire
    center(c.annee || '', cx, 243, 'helvetica', 'bold', 32, PURPLE);
    // bas de page
    center('CIRCONSCRIPTION ' + up(c.circ || '') + ' POUR LA LANGUE FRANCAISE', cx, 273, 'times', 'bold', 9.5, GREY, W - 40);
  }

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
    if (c.lv) {   // niveaux : --- et --+ en rouge, -++ / ++- et +++ en vert
      const bad = /^-{2}/.test(String(c.c));
      out.styles = { textColor: bad ? [200, 0, 0] : [0, 140, 40], fontStyle: 'bold' };
    }
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

  // images jointes : 3 par ligne, légende = nom du fichier
  function images(b) {
    heading(b.label, 2);
    const gap = 4, maxW = (W - 2 * M - 2 * gap) / 3, maxH = 70;
    let x = M, rowH = 0;
    for (const it of b.list) {
      const k = Math.min(maxW / it.w, maxH / it.h), w = it.w * k, h = it.h * k, cellH = h + 6;
      if (x + maxW > W - M + 0.5) { x = M; y += rowH; rowH = 0; }
      if (y + cellH > H - M - 6) { newPage(); x = M; rowH = 0; }
      try { doc.addImage(it.data, 'JPEG', x, y, w, h); } catch (e) { /* image ignorée */ }
      doc.setFont(font, 'normal'); doc.setFontSize(7); doc.setTextColor(110, 110, 110);
      doc.text(doc.splitTextToSize(clean(it.name), maxW)[0] || '', x, y + h + 3.5);
      x += maxW + gap; rowH = Math.max(rowH, cellH);
    }
    y += rowH + 4;
  }

  for (const b of model.blocks) {
    if (b.t === 'cover') { if (b !== model.blocks[0]) newPage('portrait'); coverPages.add(doc.getNumberOfPages()); drawCover(b); y = H; }
    else if (b.t === 'h1') { if (b.newPage && y > M) newPage(); heading(b.text, 1); }
    else if (b.t === 'h2') heading(b.text, 2);
    else if (b.t === 'kv') paragraph(b.text, b.label);
    else if (b.t === 'p') paragraph(b.text);
    else if (b.t === 'table') table(b);
    else if (b.t === 'imgs') images(b);
  }

  // pied de page : école · classe · année + numéro de page
  const n = doc.getNumberOfPages();
  for (let i = 1; i <= n; i++) {
    if (coverPages.has(i)) continue;
    // dimensions réelles de la page (autoTable peut avoir ajouté des pages lui-même)
    let pw = doc.internal.pageSize.getWidth(), ph = doc.internal.pageSize.getHeight();
    try { const mb = doc.getPageInfo(i).pageContext.mediaBox, k = doc.internal.scaleFactor; pw = mb.topRightX / k; ph = mb.topRightY / k; } catch (e) {}
    doc.setPage(i); doc.setFont(font, 'normal'); doc.setFontSize(8); doc.setTextColor(120, 120, 120);
    doc.text(clean(`${model.footer || ''}   -   ${i} / ${n}`), pw / 2, ph - 6, { align: 'center' });
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
