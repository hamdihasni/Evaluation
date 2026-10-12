import * as cloud from './cloud.js';

/* =====================================================================
   1. CONFIGURATION DES GRILLES (reprend les barèmes du cahier papier)
   cells : indicateurs I1, I2, I3… avec leur barème  |  max : critère unique
   min:1 = critère minimal, min:0 = critère de perfectionnement
   ===================================================================== */
const GRIDS = {
  recit: { total: 5, pre: 'poeme', crit: [
    { c: 'C1', min: 1, cells: [1, .5, .5] }, { c: 'C2', min: 1, cells: [.5, .5] },
    { c: 'C3', min: 1, cells: [.5, .5, .5] }, { c: 'C4', min: 0, cells: [.25, .25] }] },
  oral: { total: 15, pre: 'situ', crit: [
    { c: 'C1', min: 1, cells: [1, 1, 1] }, { c: 'C2', min: 1, cells: [1, 1, 1] },
    { c: 'C3', min: 1, cells: [1, 1, 1] }, { c: 'C4', min: 1, cells: [1, 1, 1] },
    { c: 'C5', min: 1, cells: [1, 1] }, { c: 'C6', min: 0, cells: [.5, .25, .25] }] },
  lect: { total: 20, pre: 'texte', crit: [
    { c: 'C1', min: 1, cells: [1, 1, 1] }, { c: 'C2', min: 1, max: 4.5 }, { c: 'C3', min: 1, max: 3 },
    { c: 'C4', min: 1, max: 3 }, { c: 'C5', min: 1, max: 3 }, { c: 'C6', min: 1, max: 2 },
    { c: 'Voc', name: 'Lec.Voc', min: 0, max: .75 }, { c: 'Comp', name: 'Lec.Comp', min: 0, max: .75 }] },
  ecrit: { total: 20, pre: null, crit: [
    { c: 'C1', min: 1, max: 3 }, { c: 'C2', min: 1, max: 1.5 }, { c: 'C3', min: 1, max: 6 },
    { c: 'C4', min: 1, max: 4 }, { c: 'C5', min: 1, max: 3 }, { c: 'C6', min: 1, max: 1.5 },
    { c: 'C7', min: 0, max: 1 }] }
};
const cellsOf = g => g.crit.flatMap(cr => cr.cells
  ? cr.cells.map((m, i) => ({ key: `${cr.c}_${i + 1}`, lab: 'I' + (i + 1), max: m, min: cr.min }))
  : [{ key: cr.c, lab: '', max: cr.max, min: cr.min }]);

const GROUPS_4 = ['Groupe 1', 'Groupe 2', 'Groupe 3', 'Groupe 4'];
const GROUPS_ABCD = ['Groupe A', 'Groupe B', 'Groupe C', 'Groupe D'];

/* =====================================================================
   2. ÉTAT
   ===================================================================== */
const LS = 'dossier5.local.v1';
const mkStudents = n => Array.from({ length: n }, (_, i) => ({ id: 's' + (i + 1), nom: '', naiss: '', sexe: '' }));
const mkGroups = () => Array.from({ length: 4 }, () => ({ noms: '', crit: '', diff: '', dec: '' }));
const skill = () => ({ sc: {}, pre: {}, err: [], groups: mkGroups(), remed: '' });

const defaultState = () => ({
  v: 1, updatedAt: 0,
  meta: { dre: 'Kasserine', circ: 'Thala', ecole: '', classe: '5ème A', annee: '2026 / 2027', enseignant: '',
    inspecteur: 'M. Moncef Zidi', assistant: 'M. Mohamed Mnasri' },
  students: mkStudents(28),
  recit: { ...skill(), module: '', poemes: { P1: '', P2: '' } },
  oral: { ...skill(), perf: '', obj: ['', '', '', ''], structure: '', lexique: '', sit: ['', '', '', ''], epr: ['', '', ''] },
  lect: { ...skill(), textes: [0, 1, 2, 3].map(() => ({ titre: '', texte: '' })), groupsComp: mkGroups() },
  ecrit: skill(),
  conj: { diffs: ['', '', ''], marks: {}, groups: mkGroups(), remed: '' }
});

// complète un état ancien/incomplet avec les valeurs par défaut (compat. versions futures)
function merge(base, src) {
  if (Array.isArray(base)) return Array.isArray(src) ? src : base;
  if (base && typeof base === 'object') {
    const out = { ...base };
    if (src && typeof src === 'object') for (const k of Object.keys(src)) out[k] = k in base ? merge(base[k], src[k]) : src[k];
    return out;
  }
  return src === undefined ? base : src;
}

let S = defaultState();
let user = null, status = 'local', skipAuth = false, authReady = false;
let view = { sec: 'home', tab: 0 };

function loadLocal() {
  try {
    const raw = JSON.parse(localStorage.getItem(LS) || 'null');
    if (raw && raw.state) { S = merge(defaultState(), raw.state); return raw.owner || null; }
  } catch (e) { /* ignore */ }
  return null;
}
let owner = loadLocal();
skipAuth = localStorage.getItem('dossier5.skip') === '1';
const saveLocal = () => { try { localStorage.setItem(LS, JSON.stringify({ owner, state: S })); } catch (e) { /* quota */ } };

/* =====================================================================
   3. OUTILS
   ===================================================================== */
const $ = (s, r = document) => r.querySelector(s);
const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const num = v => { const n = parseFloat(String(v).replace(',', '.')); return isNaN(n) ? null : n; };
const fmt = n => String(Math.round(n * 100) / 100).replace('.', ',');
const getP = p => p.split('|').reduce((o, k) => (o == null ? o : o[k]), S);
function setP(p, v) {
  const ks = p.split('|'); let o = S;
  for (let i = 0; i < ks.length - 1; i++) { if (o[ks[i]] == null) o[ks[i]] = {}; o = o[ks[i]]; }
  o[ks[ks.length - 1]] = v;
}
const stuLabel = (s, i) => `E${i + 1}${s.nom ? ' · ' + s.nom : ''}`;

/* =====================================================================
   4. CALCULS
   ===================================================================== */
function rowTotal(g, sid) {
  const row = S[g].sc[sid]; if (!row) return null;
  let t = 0, any = false;
  for (const c of cellsOf(GRIDS[g])) {
    const v = num(row[c.key]); if (v == null) continue;
    any = true; t += Math.min(Math.max(v, 0), c.max);
  }
  return any ? t : null;
}
function colAvg(g, key, max) {
  let t = 0, n = 0;
  for (const s of S.students) {
    const v = num((S[g].sc[s.id] || {})[key]); if (v == null) continue;
    t += Math.min(Math.max(v, 0), max); n++;
  }
  return n ? t / n : null;
}
function refresh() {
  document.querySelectorAll('[data-calc]').forEach(el => {
    const t = el.dataset.calc; let v = null;
    if (t === 'rt') v = rowTotal(el.dataset.g, el.dataset.sid);
    else if (t === 'ca') v = colAvg(el.dataset.g, el.dataset.k, +el.dataset.max);
    else if (t === 'ga') {
      let s = 0, n = 0; for (const st of S.students) { const x = rowTotal(el.dataset.g, st.id); if (x != null) { s += x; n++; } }
      v = n ? s / n : null;
    } else if (t === 'cp') {
      let ok = 0, tot = 0;
      for (const st of S.students) { const m = (S.conj.marks[st.id] || {})[el.dataset.d]; if (m === 'ok') { ok++; tot++; } else if (m === 'ko') tot++; }
      el.textContent = tot ? Math.round(100 * ok / tot) + ' %' : ''; return;
    } else if (t === 'cnt') {
      const k = el.dataset.k;
      el.textContent = k === 'all' ? S.students.filter(s => s.nom.trim()).length : S.students.filter(s => s.sexe === k).length; return;
    }
    el.textContent = v == null ? '' : fmt(v);
  });
}

/* =====================================================================
   5. COMPOSANTS HTML
   ===================================================================== */
const field = (label, path, o = {}) => {
  const val = esc(getP(path));
  return `<label class="f"><span>${esc(label)}</span>${o.ta
    ? `<textarea data-b="${path}" rows="${o.rows || 3}" placeholder="${esc(o.ph || '')}">${val}</textarea>`
    : `<input data-b="${path}" type="${o.type || 'text'}" value="${val}" placeholder="${esc(o.ph || '')}">`}</label>`;
};

function preSelect(g, sid, i) {
  const cur = (S[g].pre[sid]) ?? (g === 'recit' ? (i % 2 ? 'P2' : 'P1') : '');
  let opts;
  if (g === 'recit') opts = [['P1', 'P1'], ['P2', 'P2']];
  else if (g === 'oral') opts = [['', '–'], ['S1', 'S1'], ['S2', 'S2'], ['S3', 'S3'], ['S4', 'S4']];
  else opts = [['', '–'], ['T1', 'T1'], ['T2', 'T2'], ['T3', 'T3'], ['T4', 'T4']];
  return `<select data-b="${g}|pre|${sid}">${opts.map(([v, l]) => `<option value="${v}" ${v === cur ? 'selected' : ''}>${l}</option>`).join('')}</select>`;
}

function gridHtml(g) {
  const cfg = GRIDS[g], cells = cellsOf(cfg);
  if (!S.students.length) return '<p class="hint">Ajoutez d’abord les élèves.</p>';
  const preLab = { poeme: 'Poème', situ: 'Situation', texte: 'Texte' }[cfg.pre];
  // en-têtes
  const nMin = cells.filter(c => c.min).length, nPerf = cells.length - nMin;
  const head1 = `<tr><th class="sticky" rowspan="3">Élève</th>${cfg.pre ? `<th rowspan="3">${preLab}</th>` : ''}
    ${nMin ? `<th class="min" colspan="${nMin}">Critères minimaux</th>` : ''}${nPerf ? `<th class="perf" colspan="${nPerf}">Perfectionnement</th>` : ''}
    <th rowspan="3">Total<br>/${cfg.total}</th></tr>`;
  const head2 = '<tr>' + cfg.crit.map(cr => {
    const span = cr.cells ? cr.cells.length : 1, mx = cr.cells ? cr.cells.reduce((a, b) => a + b, 0) : cr.max;
    return `<th class="${cr.min ? 'min' : 'perf'}" colspan="${span}">${cr.name || cr.c}<br>${fmt(mx)}</th>`;
  }).join('') + '</tr>';
  const head3 = '<tr>' + cells.map(c => `<th class="${c.min ? 'min' : 'perf'}">${c.lab ? c.lab + '<br>' : ''}${fmt(c.max)}</th>`).join('') + '</tr>';
  const rows = S.students.map((s, i) => {
    const r = S[g].sc[s.id] || {};
    return `<tr><td class="sticky">${esc(stuLabel(s, i))}</td>${cfg.pre ? `<td>${preSelect(g, s.id, i)}</td>` : ''}` +
      cells.map(c => `<td><input class="n" type="number" step="any" inputmode="decimal" data-max="${c.max}" data-b="${g}|sc|${s.id}|${c.key}" value="${esc(r[c.key] ?? '')}"></td>`).join('') +
      `<td class="tot" data-calc="rt" data-g="${g}" data-sid="${s.id}"></td></tr>`;
  }).join('');
  const foot = `<tr><td class="sticky">Moyenne</td>${cfg.pre ? '<td></td>' : ''}` +
    cells.map(c => `<td data-calc="ca" data-g="${g}" data-k="${c.key}" data-max="${c.max}"></td>`).join('') +
    `<td class="tot" data-calc="ga" data-g="${g}"></td></tr>`;
  return `<div class="scroll"><table><thead>${head1}${head2}${head3}</thead><tbody>${rows}</tbody><tfoot>${foot}</tfoot></table></div>
    <p class="hint">Saisissez les points obtenus (la valeur est plafonnée au barème de chaque indicateur). Totaux et moyennes sont calculés automatiquement.</p>`;
}

function errorsHtml(g) {
  const list = S[g].err;
  return `<datalist id="dl-stu">${S.students.filter(s => s.nom).map(s => `<option value="${esc(s.nom)}">`).join('')}</datalist>
  <datalist id="dl-type">${['Phonologique', 'Lexicale', 'Syntaxique', 'Morphologique', 'Orthographique', 'Sémantique', 'Autre'].map(t => `<option value="${t}">`).join('')}</datalist>
  <div class="card"><h3>Recensement et classification des erreurs</h3>
  ${list.map((e, i) => `<div class="errcard">
    <label class="f"><span>Nom & prénom (élève)</span><input list="dl-stu" data-b="${g}|err|${i}|eleve" value="${esc(e.eleve)}"></label>
    <label class="f"><span>Erreur</span><textarea rows="2" data-b="${g}|err|${i}|erreur">${esc(e.erreur)}</textarea></label>
    <div class="row2">
      <label class="f"><span>Critère concerné</span><input data-b="${g}|err|${i}|crit" value="${esc(e.crit)}"></label>
      <label class="f"><span>Type de l’erreur</span><input list="dl-type" data-b="${g}|err|${i}|type" value="${esc(e.type)}"></label></div>
    <label class="f"><span>Hypothèses explicatives sur la source de l’erreur</span><textarea rows="2" data-b="${g}|err|${i}|hyp">${esc(e.hyp)}</textarea></label>
    <button class="btn red sm" data-act="delerr" data-g="${g}" data-i="${i}">Supprimer</button></div>`).join('') || '<p class="hint">Aucune erreur enregistrée.</p>'}
  <button class="btn" data-act="adderr" data-g="${g}">+ Ajouter une erreur</button></div>`;
}

function groupsHtml(path, title, labels, fields) {
  const F = { noms: 'Noms et prénoms', crit: 'Critères non maîtrisés', diff: 'Difficultés à traiter', dec: 'Décisions de remédiation' };
  const arr = getP(path);
  return `<div class="card"><h3>${esc(title)}</h3>
    <p class="hint">Si la difficulté touche la majorité des élèves, les activités de remédiation visent l’ensemble de la classe.</p>
    ${arr.map((gr, i) => `<details ${i === 0 ? 'open' : ''} class="card" style="padding:8px 12px"><summary><b>${labels[i]}</b></summary>
      ${fields.map(f => `<label class="f"><span>${F[f]}</span><textarea rows="3" data-b="${path}|${i}|${f}">${esc(gr[f])}</textarea></label>`).join('')}</details>`).join('')}</div>`;
}

const remedHtml = (path, title) => `<div class="card"><h3>${esc(title)}</h3>${field('Situation détaillée', path, { ta: 1, rows: 10 })}</div>`;

/* =====================================================================
   6. SECTIONS
   ===================================================================== */
const SECTIONS = {
  couv: { icon: '📘', title: 'Couverture', sub: 'École, classe, année', tabs: [['Informations', () => `<div class="card cover">
      <div class="hint">Direction Régionale de l’Enseignement de ${esc(S.meta.dre)} · Circonscription ${esc(S.meta.circ)} pour la langue française</div>
      <div class="big">CAHIER D’ÉVALUATION — ${esc(S.meta.classe)}</div></div>
    <div class="card">${field('Direction régionale', 'meta|dre')}${field('Circonscription', 'meta|circ')}${field('École primaire', 'meta|ecole')}
      ${field('Classe', 'meta|classe')}${field('Année scolaire', 'meta|annee')}${field('Prénom et nom de l’enseignant(e)', 'meta|enseignant')}
      ${field('L’inspecteur', 'meta|inspecteur')}${field('L’assistant pédagogique', 'meta|assistant')}</div>`]] },

  eleves: { icon: '👥', title: 'Liste des élèves', sub: 'Nom, naissance, sexe', tabs: [['Liste nominative', () => `<div class="card">
      <h3>${esc(S.meta.classe)} — Année ${esc(S.meta.annee)}</h3>
      ${S.students.map((s, i) => `<div class="stu"><b>${i + 1}</b>
        <input placeholder="Nom et prénom" data-b="students|${i}|nom" value="${esc(s.nom)}">
        <input type="date" data-b="students|${i}|naiss" value="${esc(s.naiss)}">
        <select data-b="students|${i}|sexe"><option value="" ${!s.sexe ? 'selected' : ''}>–</option><option value="G" ${s.sexe === 'G' ? 'selected' : ''}>G</option><option value="F" ${s.sexe === 'F' ? 'selected' : ''}>F</option></select>
        <button class="btn red sm" data-act="delstu" data-i="${i}" aria-label="Supprimer">✕</button></div>`).join('')}
      <div class="stats"><span>Garçons : <span data-calc="cnt" data-k="G"></span></span><span>Filles : <span data-calc="cnt" data-k="F"></span></span><span>Effectif : <span data-calc="cnt" data-k="all"></span></span></div>
      <div class="stack" style="margin-top:12px"><button class="btn" data-act="addstu">+ Ajouter un élève</button>
      <details><summary class="hint">Importer une liste (un nom par ligne)</summary>
        <textarea id="importbox" rows="6" placeholder="Nom Prénom&#10;Nom Prénom…"></textarea>
        <button class="btn sec" data-act="import" style="margin-top:6px">Importer</button></details></div></div>`]] },

  recit: { icon: '🎭', title: 'Récitation', sub: 'Grille /5 · mise en train', tabs: [
    ['Grille', () => `<div class="card"><div class="row2">${field('Module d’évaluation N°', 'recit|module')}<div></div></div>
      ${field('Poème 1', 'recit|poemes|P1')}${field('Poème 2', 'recit|poemes|P2')}</div>${gridHtml('recit')}`],
    ['Mise en train', () => groupsHtml('recit|groups', 'Résultats de la mise en train', GROUPS_4, ['noms', 'crit', 'diff', 'dec'])]] },

  oral: { icon: '🗣️', title: 'Expression orale', sub: 'Fiche · grille /15', tabs: [
    ['Fiche', () => `<div class="card"><h3>Expression orale — 5ème année</h3>
      ${field('Performance attendue à la fin du 2ème degré : Au terme de la…', 'oral|perf', { ta: 1, rows: 4 })}
      <h3>Objectifs spécifiques</h3>${[0, 1, 2, 3].map(i => field('Objectif ' + (i + 1), `oral|obj|${i}`, { ta: 1, rows: 2 })).join('')}
      ${field('Structure', 'oral|structure', { ta: 1 })}${field('Lexique', 'oral|lexique', { ta: 1 })}
      <h3>Situations</h3>${[0, 1, 2, 3].map(i => field('S' + (i + 1), `oral|sit|${i}`, { ta: 1, rows: 2 })).join('')}</div>
      ${[0, 1, 2].map(i => `<div class="card"><h3>Épreuve d’évaluation n°${i + 1}</h3>${field('Objectifs de communication + lexique et structures à employer par l’élève + questions proposées', `oral|epr|${i}`, { ta: 1, rows: 6 })}</div>`).join('')}`],
    ['Grille', () => gridHtml('oral')],
    ['Erreurs', () => errorsHtml('oral')],
    ['Bilan', () => groupsHtml('oral|groups', 'Résultats en expression orale', GROUPS_4, ['noms', 'crit', 'diff', 'dec'])]] },

  lect: { icon: '📖', title: 'Lecture', sub: 'Grille /20 · vocale & compréhension', tabs: [
    ['Textes', () => S.lect.textes.map((t, i) => `<div class="card"><h3>Texte N°${i + 1} proposé à la lecture vocale</h3>
      ${field('Titre', `lect|textes|${i}|titre`)}${field('Texte', `lect|textes|${i}|texte`, { ta: 1, rows: 7 })}</div>`).join('')],
    ['Grille', () => gridHtml('lect')],
    ['Erreurs', () => errorsHtml('lect')],
    ['Bilans', () => groupsHtml('lect|groups', 'Résultats en lecture vocale', GROUPS_4, ['noms', 'crit', 'diff', 'dec']) +
      groupsHtml('lect|groupsComp', 'Résultats en lecture compréhension', GROUPS_4, ['noms', 'crit', 'diff', 'dec'])],
    ['Remédiation', () => remedHtml('lect|remed', 'Dispositif de remédiation de la lecture')]] },

  ecrit: { icon: '✍️', title: 'Production écrite', sub: 'Grille /20', tabs: [
    ['Grille', () => gridHtml('ecrit')],
    ['Erreurs', () => errorsHtml('ecrit')],
    ['Bilan', () => groupsHtml('ecrit|groups', 'Résultats à l’écrit', GROUPS_4, ['noms', 'crit', 'diff', 'dec'])],
    ['Remédiation', () => remedHtml('ecrit|remed', 'Dispositif de remédiation de la production')]] },

  conj: { icon: '🔤', title: 'Conjugaison · Grammaire · Orthographe', sub: 'Difficultés & % de réussite', tabs: [
    ['Difficultés', () => {
      const d = [0, 1, 2];
      return `<div class="card">${d.map(i => field('Difficulté n°' + (i + 1), `conj|diffs|${i}`, { ta: 1, rows: 2 })).join('')}</div>
      <div class="scroll"><table><thead><tr><th class="sticky">Élève</th>${d.map(i => `<th>Diff. ${i + 1}</th>`).join('')}</tr></thead><tbody>
      ${S.students.map((s, i) => `<tr><td class="sticky">${esc(stuLabel(s, i))}</td>${d.map(k => {
        const m = (S.conj.marks[s.id] || {})['d' + k] || '';
        return `<td><button class="tog ${m}" data-act="tog" data-sid="${s.id}" data-d="d${k}">${m === 'ok' ? '✓' : m === 'ko' ? '✗' : '·'}</button></td>`;
      }).join('')}</tr>`).join('')}</tbody>
      <tfoot><tr><td class="sticky">% de réussite</td>${d.map(k => `<td data-calc="cp" data-d="d${k}"></td>`).join('')}</tr></tfoot></table></div>
      <p class="hint">Touchez une case : ✓ (réussi) → ✗ (non réussi) → vide.</p>`;
    }],
    ['Bilan', () => groupsHtml('conj|groups', 'Résultats des élèves', GROUPS_ABCD, ['noms', 'crit', 'dec']) +
      remedHtml('conj|remed', 'Dispositif de remédiation (conjugaison / grammaire / orthographe)')]] }
};
const HOME_ORDER = ['couv', 'eleves', 'recit', 'oral', 'lect', 'ecrit', 'conj'];

/* =====================================================================
   7. RENDU
   ===================================================================== */
const STATUS_TXT = { local: '📱 Local', sync: '⏳ Synchro…', ok: '☁️ Synchronisé', pend: '⏳ En attente', err: '⚠️ Hors ligne' };
function chip() {
  const cls = status === 'ok' ? 'ok' : status === 'err' ? 'err' : '';
  return `<span class="chip ${cls}" id="chip">${STATUS_TXT[status]}</span>`;
}
function setStatus(s) { status = s; const c = $('#chip'); if (c) { c.className = 'chip ' + (s === 'ok' ? 'ok' : s === 'err' ? 'err' : ''); c.textContent = STATUS_TXT[s]; } }

function render(keepScroll) {
  const y = keepScroll ? window.scrollY : 0;
  const sec = SECTIONS[view.sec];
  const title = view.sec === 'home' ? `Dossier d’évaluation · ${S.meta.classe}` : sec.title;
  let body;
  if (view.sec === 'home') {
    body = `<div class="home">${HOME_ORDER.map(k => `<button class="tile" data-go="${k}"><span>${SECTIONS[k].icon}</span>${esc(SECTIONS[k].title)}<small>${esc(SECTIONS[k].sub)}</small></button>`).join('')}</div>
      <button class="btn sec" data-act="printall" style="width:100%;margin-top:14px">🖨️ Imprimer tout le dossier</button>
      <p class="hint" style="text-align:center;margin-top:18px">Circonscription ${esc(S.meta.circ)} pour la langue française</p>`;
  } else {
    if (view.tab >= sec.tabs.length) view.tab = 0;
    body = (sec.tabs.length > 1 ? `<div class="tabs">${sec.tabs.map((t, i) => `<button data-tab="${i}" class="${i === view.tab ? 'on' : ''}">${t[0]}</button>`).join('')}</div>` : '') + sec.tabs[view.tab][1]();
  }
  $('#app').innerHTML = `<header>${view.sec !== 'home' ? '<button data-act="home" aria-label="Accueil">←</button>' : ''}<h1>${esc(title)}</h1>${chip()}<button data-act="printall" aria-label="Imprimer tout le dossier">🖨️</button><button data-act="acct" aria-label="Compte">${user ? '👤' : '☁️'}</button></header><main>${body}</main>`;
  refresh();
  window.scrollTo(0, y);
}
const go = (sec, tab = 0) => { view = { sec, tab }; render(); };

/* =====================================================================
   8. ENREGISTREMENT & CLOUD
   ===================================================================== */
let tLocal = null, tCloud = null;
function changed() {
  S.updatedAt = Date.now();
  clearTimeout(tLocal); tLocal = setTimeout(saveLocal, 250);
  if (user) { setStatus('pend'); clearTimeout(tCloud); tCloud = setTimeout(pushNow, 1500); }
}
async function pushNow() {
  if (!user) return;
  saveLocal(); setStatus('sync');
  try { await cloud.push(user.uid, JSON.stringify(S), S.updatedAt); setStatus('ok'); } catch (e) { setStatus('err'); }
}
async function syncDown() {
  setStatus('sync');
  try {
    // un autre compte avait utilisé cet appareil : ne pas mélanger les données
    if (owner && owner !== user.uid) { S = defaultState(); owner = user.uid; saveLocal(); render(true); }
    const r = await cloud.pull(user.uid);
    owner = user.uid;
    if (r && r.data) {
      const remote = JSON.parse(r.data);
      if ((remote.updatedAt || 0) > (S.updatedAt || 0)) { S = merge(defaultState(), remote); saveLocal(); render(); setStatus('ok'); return; }
    }
    await pushNow();
  } catch (e) { setStatus('err'); }
}

/* =====================================================================
   9. COMPTE (modal)
   ===================================================================== */
const AUTH_ERR = {
  'auth/invalid-credential': 'E-mail ou mot de passe incorrect.', 'auth/wrong-password': 'Mot de passe incorrect.',
  'auth/user-not-found': 'Aucun compte avec cet e-mail.', 'auth/email-already-in-use': 'Cet e-mail est déjà utilisé : connectez-vous.',
  'auth/weak-password': 'Mot de passe trop court (6 caractères minimum).', 'auth/invalid-email': 'Adresse e-mail invalide.',
  'auth/network-request-failed': 'Pas de connexion Internet.', 'auth/too-many-requests': 'Trop de tentatives, réessayez plus tard.'
};
const errMsg = e => AUTH_ERR[e && e.code] || 'Erreur : ' + ((e && e.message) || e);

function modal(html) { $('#modal').innerHTML = html ? `<div class="modal"><div class="box">${html}</div></div>` : ''; }
function authModal(msg = '', ok = false) {
  if (!cloud.available) {
    return modal(`<h2>Cloud non configuré</h2><p class="hint">Les données sont enregistrées <b>sur cet appareil uniquement</b>. Pour activer la sauvegarde cloud, renseignez <code>cloud-src/firebase-config.js</code> puis reconstruisez l’application (voir LISEZMOI).</p><button class="btn" data-act="closemodal">OK</button>`);
  }
  if (user) {
    return modal(`<h2>Compte</h2><p class="hint">Connecté : <b>${esc(user.email)}</b><br>Vos données sont sauvegardées dans le cloud et disponibles sur tous vos appareils.</p>
      <div class="stack"><button class="btn" data-act="syncnow">Synchroniser maintenant</button><button class="btn red" data-act="logout">Se déconnecter</button><button class="btn sec" data-act="closemodal">Fermer</button></div>`);
  }
  modal(`<h2>☁️ Sauvegarde cloud</h2><p class="hint">Connectez-vous pour enregistrer le dossier dans le cloud et le retrouver sur tout appareil.</p>
    <label class="f"><span>E-mail</span><input id="au-mail" type="email" autocomplete="username"></label>
    <label class="f"><span>Mot de passe</span><input id="au-pw" type="password" autocomplete="current-password"></label>
    <div class="msg ${ok ? 'ok' : ''}" id="au-msg">${esc(msg)}</div>
    <div class="stack"><button class="btn" data-act="login">Connexion</button><button class="btn sec" data-act="register">Créer un compte</button>
    <button class="btn sec sm" data-act="resetpw">Mot de passe oublié</button><button class="btn sec sm" data-act="skip">Continuer sans compte (données locales)</button></div>`);
}
async function authDo(kind) {
  const mail = $('#au-mail').value.trim(), pw = $('#au-pw').value;
  const msg = t => { $('#au-msg').className = 'msg'; $('#au-msg').textContent = t; };
  if (!mail) return msg('Saisissez votre e-mail.');
  try {
    if (kind === 'resetpw') { await cloud.reset(mail); $('#au-msg').className = 'msg ok'; $('#au-msg').textContent = 'E-mail de réinitialisation envoyé.'; return; }
    if (!pw) return msg('Saisissez votre mot de passe.');
    msg('Veuillez patienter…');
    await (kind === 'register' ? cloud.register(mail, pw) : cloud.login(mail, pw));
    modal('');
  } catch (e) { msg(errMsg(e)); }
}

/* =====================================================================
   10. ÉVÉNEMENTS
   ===================================================================== */
document.addEventListener('input', e => {
  const t = e.target; if (!t.dataset || !t.dataset.b) return;
  let v = t.value;
  if (t.dataset.max !== undefined) { const n = num(v); v = n == null ? '' : n; }
  setP(t.dataset.b, v); changed(); refresh();
});
document.addEventListener('change', e => {
  const t = e.target; if (!t.dataset || !t.dataset.b) return;
  if (t.dataset.max !== undefined && t.value !== '') {
    const n = Math.min(Math.max(num(t.value) ?? 0, 0), +t.dataset.max);
    t.value = n; setP(t.dataset.b, n); changed(); refresh();
  }
  if (t.dataset.b.startsWith('students|') || t.dataset.b.startsWith('meta|')) { /* libellés mis à jour au prochain affichage */ }
});

document.addEventListener('click', async e => {
  const el = e.target.closest('[data-go],[data-tab],[data-act]'); if (!el) return;
  if (el.dataset.go) return go(el.dataset.go);
  if (el.dataset.tab !== undefined) { view.tab = +el.dataset.tab; render(); return window.scrollTo(0, 0); }
  const a = el.dataset.act;
  if (a === 'home') return go('home');
  if (a === 'acct') return authModal();
  if (a === 'printall') return printAll();
  if (a === 'closemodal') return modal('');
  if (a === 'skip') { skipAuth = true; localStorage.setItem('dossier5.skip', '1'); return modal(''); }
  if (a === 'login' || a === 'register' || a === 'resetpw') return authDo(a);
  if (a === 'logout') { await cloud.logout(); modal(''); return; }
  if (a === 'syncnow') { modal(''); return syncDown(); }
  if (a === 'addstu') { S.students.push({ id: 's' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), nom: '', naiss: '', sexe: '' }); changed(); return render(true); }
  if (a === 'delstu') {
    const i = +el.dataset.i, s = S.students[i];
    if (!confirm(`Supprimer l’élève ${i + 1}${s.nom ? ' (' + s.nom + ')' : ''} et ses notes ?`)) return;
    S.students.splice(i, 1); changed(); return render(true);
  }
  if (a === 'import') {
    const names = $('#importbox').value.split('\n').map(x => x.trim()).filter(Boolean); if (!names.length) return;
    let k = 0;
    for (const s of S.students) { if (!s.nom && k < names.length) s.nom = names[k++]; }
    while (k < names.length) S.students.push({ id: 's' + Date.now().toString(36) + k, nom: names[k++], naiss: '', sexe: '' });
    changed(); return render(true);
  }
  if (a === 'adderr') { S[el.dataset.g].err.push({ eleve: '', erreur: '', crit: '', type: '', hyp: '' }); changed(); return render(true); }
  if (a === 'delerr') { S[el.dataset.g].err.splice(+el.dataset.i, 1); changed(); return render(true); }
  if (a === 'tog') {
    const { sid, d } = el.dataset; const m = (S.conj.marks[sid] ||= {});
    m[d] = m[d] === 'ok' ? 'ko' : m[d] === 'ko' ? '' : 'ok';
    el.className = 'tog ' + m[d]; el.textContent = m[d] === 'ok' ? '✓' : m[d] === 'ko' ? '✗' : '·';
    changed(); refresh();
  }
});

window.addEventListener('online', () => { if (user) pushNow(); });
// bouton "retour" Android (plugin @capacitor/app)
try {
  const App = window.Capacitor && window.Capacitor.Plugins && window.Capacitor.Plugins.App;
  if (App) App.addListener('backButton', () => {
    if ($('#modal').innerHTML) return modal('');
    if (view.sec !== 'home') go('home'); else App.exitApp();
  });
} catch (e) { /* navigateur */ }

/* =====================================================================
   10 bis. IMPRESSION DE TOUT LE DOSSIER
   Construit une version statique de toutes les sections (tous les onglets),
   puis lance l'impression. L'affichage écran n'est pas modifié.
   ===================================================================== */
function buildPrint() {
  const wrap = document.createElement('div');
  const meta = [S.meta.ecole, S.meta.classe, S.meta.annee, S.meta.enseignant].filter(Boolean).map(esc).join(' · ');
  wrap.innerHTML = HOME_ORDER.map(k => {
    const sec = SECTIONS[k];
    return `<section class="psec"><h1>${sec.icon} ${esc(sec.title)}</h1><div class="pmeta">${meta}</div>` +
      sec.tabs.map(([name, fn]) => `<div class="ptab">${sec.tabs.length > 1 ? `<h2>${esc(name)}</h2>` : ''}${fn()}</div>`).join('') + '</section>';
  }).join('');

  // éléments interactifs inutiles à l'impression
  wrap.querySelectorAll('datalist,.btn,.scroll + p.hint').forEach(n => n.remove());
  const ib = wrap.querySelector('#importbox'); if (ib && ib.closest('details')) ib.closest('details').remove();
  wrap.querySelectorAll('details').forEach(d => d.setAttribute('open', ''));

  // champs de saisie -> texte statique
  wrap.querySelectorAll('input,textarea,select').forEach(el => {
    let txt;
    if (el.tagName === 'SELECT') txt = el.options[el.selectedIndex] ? el.options[el.selectedIndex].textContent : '';
    else if (el.tagName === 'TEXTAREA') txt = el.value;
    else {
      txt = el.getAttribute('value') ?? '';
      if (el.type === 'date' && txt) txt = txt.split('-').reverse().join('/');
      else if (el.type === 'number' && txt !== '' && num(txt) != null) txt = fmt(num(txt));
    }
    const out = document.createElement(el.tagName === 'TEXTAREA' ? 'div' : 'span');
    out.className = 'pv' + (el.tagName === 'TEXTAREA' ? ' blk' : '');
    out.textContent = txt;
    el.replaceWith(out);
  });
  wrap.querySelectorAll('[data-act]').forEach(n => n.removeAttribute('data-act'));
  return wrap;
}

function printAll() {
  let pr = $('#print');
  if (!pr) { pr = document.createElement('div'); pr.id = 'print'; document.body.appendChild(pr); }
  pr.innerHTML = '';
  pr.appendChild(buildPrint());
  refresh();                                  // totaux, moyennes et % pour la version imprimée
  document.body.classList.add('printall');
  const done = () => {
    window.removeEventListener('afterprint', done);
    document.body.classList.remove('printall');
    setTimeout(() => { if (!document.body.classList.contains('printall')) pr.innerHTML = ''; }, 500);
  };
  window.addEventListener('afterprint', done);
  setTimeout(() => window.print(), 60);
}

/* =====================================================================
   11. DÉMARRAGE
   ===================================================================== */
render();
if (cloud.available) status = 'local';
cloud.onUser(async u => {
  const first = !authReady; authReady = true;
  user = u;
  if (u) { render(true); modal(''); await syncDown(); }
  else { setStatus('local'); render(true); if (first && cloud.available && !skipAuth) authModal(); }
});
