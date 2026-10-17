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
    { c: 'C1', t: 'Adéquation', d: 'Respect de la tâche demandée et du sujet.', min: 1, cells: [1, 1, 1] },
    { c: 'C2', t: 'Phonétique', d: 'Correction de la prononciation, de l’articulation et de l’intonation.', min: 1, cells: [1, 1, 1] },
    { c: 'C3', t: 'Linguistique', d: 'Correction de la syntaxe et des structures de phrases utilisées.', min: 1, cells: [1, 1, 1] },
    { c: 'C4', t: 'Cohérence', d: 'Enchaînement logique et compréhensible des idées.', min: 1, cells: [1, 1, 1] },
    { c: 'C5', t: 'Perfectionnement', d: 'Aisance, richesse lexicale et dépassement des normes minimales.', min: 0, cells: [1, 1] },
    { c: 'C6', t: 'Perfectionnement', d: 'Aisance, richesse lexicale et dépassement des normes minimales.', min: 0, cells: [.5, .25, .25] }] },
  lect: { total: 20, pre: 'texte', crit: [
    { c: 'C1', t: 'Lecture vocale', d: 'Qualité de la voix et respect de la continuité du texte.', min: 1, cells: [1, 1, 1] },
    { c: 'C2', t: 'Lecture globale', d: 'Saisie du sens global et des informations explicites.', min: 1, max: 4.5 },
    { c: 'C3', t: 'Vocabulaire', d: 'Compréhension du sens des mots dans le contexte.', min: 1, max: 3 },
    { c: 'C4', t: 'Justification', d: 'Capacité à prouver ses réponses en s’appuyant sur le texte.', min: 1, max: 3 },
    { c: 'C5', t: 'Perfectionnement', d: 'Fluidité remarquable, vitesse de lecture et interprétation expressive.', min: 0, max: 3 },
    { c: 'C6', t: 'Perfectionnement', d: 'Fluidité remarquable, vitesse de lecture et interprétation expressive.', min: 0, max: 2 },
    { c: 'Voc', name: 'Lec.Voc', min: 0, max: .75 }, { c: 'Comp', name: 'Lec.Comp', min: 0, max: .75 }] },
  ecrit: { total: 20, pre: null, crit: [
    { c: 'C1', t: 'Adéquation de la production', d: 'Respect de la consigne, du type de texte et de la situation de communication.', min: 1, max: 3 },
    { c: 'C2', t: 'Lisibilité', d: 'Écriture claire et compréhensible.', min: 1, max: 1.5 },
    { c: 'C3', t: 'Correction linguistique', d: 'Agencement correct des mots, respect des accords et des formes verbales étudiées, emploi de la ponctuation forte.', min: 1, max: 6 },
    { c: 'C4', t: 'Orthographe', d: 'Maîtrise de l’orthographe lexicale et grammaticale.', min: 1, max: 4 },
    { c: 'C5', t: 'Cohérence sémantique', d: 'Progression logique du texte sans contradictions.', min: 1, max: 3 },
    { c: 'C6', t: 'Richesse du vocabulaire', d: 'Utilisation de mots variés et adaptés.', min: 1, max: 1.5 },
    { c: 'C7', t: 'Présentation matérielle', d: 'Copie propre, sans rature ni surcharge, avec un espacement correct des mots.', min: 0, max: 1 }] }
};
// signe de niveau pour le PDF (coloré : rouge pour --- et --+, vert pour -++ et +++)
const lvCell = v => (v ? { c: v, lv: 1 } : '');
const critLabel = cr => (cr.t ? `${cr.c} - ${cr.t}` : (cr.name || cr.c));
const cellsOf = g => g.crit.flatMap(cr => cr.cells
  ? cr.cells.map((m, i) => ({ key: `${cr.c}_${i + 1}`, lab: 'I' + (i + 1), max: m, min: cr.min }))
  : [{ key: cr.c, lab: '', max: cr.max, min: cr.min }]);

const GROUPS_4 = ['Groupe 1', 'Groupe 2', 'Groupe 3', 'Groupe 4'];
const GROUPS_ABCD = ['Groupe A', 'Groupe B', 'Groupe C', 'Groupe D'];
const LEVELS = ['---', '--+', '-++', '+++'];
// niveau par critère : S[g].clv[idÉlève][critère] (ex. S.lect.clv.s1.C2)
const critLv = (g, sid, c) => (((S[g].clv || {})[sid]) || {})[c] || '';
const lvOpts = cur => `<option value="">–</option>${LEVELS.map(l => `<option value="${l}" ${cur === l ? 'selected' : ''}>${l}</option>`).join('')}`;

/* =====================================================================
   2. ÉTAT
   ===================================================================== */
const LS1 = 'dossier5.local.v1', LS2 = 'dossier5.local.v2';
const mkStudents = n => Array.from({ length: n }, (_, i) => ({ id: 's' + (i + 1), nom: '', naiss: '', sexe: '' }));
const mkGroups = () => Array.from({ length: 4 }, () => ({ noms: '', crit: '', diff: '', dec: '' }));
const skill = () => ({ sc: {}, pre: {}, err: [], groups: mkGroups(), remed: '', unite: '', perf: '', lvl: {}, clv: {} });

const defaultState = () => ({
  v: 1, updatedAt: 0,
  meta: { dre: 'Kasserine', circ: 'Thala', ecole: '', classe: '5ème A', annee: '2026 / 2027', enseignant: '',
    inspecteur: 'M. Moncef Zidi', assistant: 'M. Mohamed Mnasri' },
  students: mkStudents(28),
  recit: { ...skill(), module: '', poemes: { P1: '', P2: '' } },
  oral: { ...skill(), perf: '', obj: ['', '', '', ''], structure: '', lexique: '', sit: ['', '', '', ''], epr: ['', '', ''] },
  lect: { ...skill(), textes: [0, 1, 2, 3].map(() => ({ titre: '', texte: '' })), groupsComp: mkGroups() },
  ecrit: skill(),
  conj: { diffs: ['', '', ''], marks: {}, groups: mkGroups(), remed: '', unite: '', perf: '' }
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

const newId = () => 'c' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
const defaultDB = () => ({ v: 2, updatedAt: 0, cur: 'c1', order: ['c1'], classes: { c1: defaultState() } });
// accepte l'ancien format (une seule classe) comme le nouveau (plusieurs classes)
function normDB(raw) {
  if (raw && raw.classes && Array.isArray(raw.order)) {
    const db = { v: 2, updatedAt: raw.updatedAt || 0, cur: raw.cur, order: raw.order.filter(id => raw.classes[id]), classes: {} };
    if (!db.order.length) return defaultDB();
    for (const id of db.order) db.classes[id] = merge(defaultState(), raw.classes[id]);
    if (!db.classes[db.cur]) db.cur = db.order[0];
    return db;
  }
  if (raw && raw.students) return { v: 2, updatedAt: raw.updatedAt || 0, cur: 'c1', order: ['c1'], classes: { c1: merge(defaultState(), raw) } };
  return defaultDB();
}
let DB = defaultDB();
let S = DB.classes[DB.cur];
const setDB = db => { DB = db; S = DB.classes[DB.cur]; };
let user = null, status = 'local', skipAuth = false, authReady = false;
let view = { sec: 'home', tab: 0 };

function loadLocal() {
  try {
    let raw = JSON.parse(localStorage.getItem(LS2) || 'null');
    if (raw && raw.db) { setDB(normDB(raw.db)); return raw.owner || null; }
    raw = JSON.parse(localStorage.getItem(LS1) || 'null');   // ancienne version : migration
    if (raw && raw.state) { setDB(normDB(raw.state)); return raw.owner || null; }
  } catch (e) { /* ignore */ }
  return null;
}
let owner = loadLocal();
skipAuth = localStorage.getItem('dossier5.skip') === '1';
const saveLocal = () => { try { localStorage.setItem(LS2, JSON.stringify({ owner, db: DB })); } catch (e) { /* quota */ } };

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
// élèves ayant atteint le niveau minimal (-++ ou +++) pour un critère
function lvStats(g, c) {
  let n = 0, tot = 0;
  for (const st of S.students) {
    const v = critLv(g, st.id, c); if (!v) continue;
    tot++; if (v === '-++' || v === '+++') n++;
  }
  return { n, tot };
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
    } else if (t === 'lvn' || t === 'lvp') {
      const { n, tot } = lvStats(el.dataset.g, el.dataset.c);
      el.textContent = !tot ? '' : (t === 'lvn' ? n : Math.round(100 * n / tot) + ' %'); return;
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

// choix de l'unité (1 à 4) + performance attendue (champ libre) pour chaque activité
const unitPerfHtml = g => `<div class="card"><label class="f"><span>Unité</span>
  <select data-b="${g}|unite"><option value="">–</option>${[1, 2, 3, 4].map(u =>
    `<option value="${u}" ${String(getP(g + '|unite')) === String(u) ? 'selected' : ''}>Unité ${u}</option>`).join('')}</select></label>
  ${field('Performance attendue', g + '|perf', { ta: 1, rows: 3 })}</div>`;

function gridHtml(g) {
  const cfg = GRIDS[g], cells = cellsOf(cfg);
  if (!S.students.length) return '<p class="hint">Ajoutez d’abord les élèves.</p>';
  const preLab = { poeme: 'Poème', situ: 'Situation', texte: 'Texte' }[cfg.pre];
  // en-têtes : Élève | (Poème/Situation/Texte) | Niveau par critère
  const head1 = `<tr><th class="sticky" rowspan="2">Élève</th>${cfg.pre ? `<th rowspan="2">${preLab}</th>` : ''}
    <th class="lvl" colspan="${cfg.crit.length}">Niveau par critère</th></tr>`;
  const head2 = '<tr>' + cfg.crit.map(cr => `<th class="lvl">${cr.name || cr.c}</th>`).join('') + '</tr>';
  const rows = S.students.map((s, i) => {
    return `<tr><td class="sticky">${esc(stuLabel(s, i))}</td>${cfg.pre ? `<td>${preSelect(g, s.id, i)}</td>` : ''}` +
      cfg.crit.map(cr => `<td><select class="lvsel" data-b="${g}|clv|${s.id}|${cr.c}">${lvOpts(critLv(g, s.id, cr.c))}</select></td>`).join('') + '</tr>';
  }).join('');
  const sp = cfg.pre ? 2 : 1;
  const foot = `<tr><td class="sticky flab" colspan="${sp}">Élèves ayant atteint les critères minimaux</td>` +
    cfg.crit.map(cr => `<td data-calc="lvn" data-g="${g}" data-c="${cr.c}"></td>`).join('') + '</tr>' +
    `<tr><td class="sticky flab" colspan="${sp}">%</td>` +
    cfg.crit.map(cr => `<td data-calc="lvp" data-g="${g}" data-c="${cr.c}"></td>`).join('') + '</tr>';
  const legend = cfg.crit.some(cr => cr.t) ? `<details class="card" style="padding:8px 12px"><summary><b>Critères d’évaluation</b></summary>
    ${cfg.crit.filter(cr => cr.t).map(cr => `<p style="margin:6px 0"><b>${cr.c} - ${esc(cr.t)}</b> <span class="hint">(${cr.min ? 'minimal' : 'perfectionnement'})</span><br>${esc(cr.d)}</p>`).join('')}</details>` : '';
  return unitPerfHtml(g) + legend + `<div class="scroll"><table><thead>${head1}${head2}</thead><tbody>${rows}</tbody><tfoot class="lvfoot">${foot}</tfoot></table></div>
    <p class="hint">Choisissez le niveau (---, --+, -++, +++) de chaque élève pour chaque critère. Les lignes du bas comptent les élèves ayant atteint le niveau minimal (-++ ou +++) et donnent le pourcentage parmi les élèves évalués.</p>`;
}

/* =====================================================================
   IA : détection automatique des erreurs selon les critères de l'activité
   La clé API est saisie par l'enseignant(e) et reste sur l'appareil (jamais synchronisée).
   Le nom de l'élève n'est jamais envoyé : seuls le texte, la photo et les critères partent.
   ===================================================================== */
const AI_MODEL = 'claude-sonnet-5-5';
const AI_KEY_LS = 'dossier5.aikey';
const AI_CTX = {
  oral: 'expression orale (le texte fourni est la transcription de ce que l’élève a dit)',
  lect: 'lecture (le texte fourni est la transcription de la lecture à voix haute de l’élève et/ou de ses réponses aux questions de compréhension)',
  ecrit: 'production écrite (le texte fourni est la production écrite de l’élève)'
};
const ERR_TYPES = ['Phonologique', 'Lexicale', 'Syntaxique', 'Morphologique', 'Orthographique', 'Sémantique', 'Autre'];
const aiDraft = {};
const aiD = g => (aiDraft[g] ||= { sid: '', text: '', ref: '', img: '', busy: false, msg: '', ok: false });

function aiCardHtml(g) {
  const d = aiD(g), hasKey = !!localStorage.getItem(AI_KEY_LS);
  const stu = S.students.map((s, i) => `<option value="${s.id}" ${d.sid === s.id ? 'selected' : ''}>${esc(stuLabel(s, i))}</option>`).join('');
  return `<div class="card aicard"><h3>🤖 Détection automatique (IA)</h3>
    <p class="hint">Collez le texte de l’élève ou prenez la copie en photo : l’IA relève les erreurs selon les critères de cette activité et les ajoute au tableau ci-dessous. Le nom de l’élève n’est jamais envoyé ; cachez-le sur la photo et ne l’écrivez pas dans le texte. Vérifiez toujours les résultats.</p>
    ${hasKey ? '' : '<p class="hint"><b>Clé API non configurée</b> : touchez « ⚙ Clé API » pour l’enregistrer.</p>'}
    <label class="f"><span>Élève</span><select data-ai="${g}|sid"><option value="">–</option>${stu}</select></label>
    <label class="f"><span>Production de l’élève (texte ou transcription)</span><textarea rows="5" data-ai="${g}|text">${esc(d.text)}</textarea></label>
    <label class="f"><span>Consigne ou texte de référence (facultatif)</span><textarea rows="2" data-ai="${g}|ref">${esc(d.ref)}</textarea></label>
    <div class="stack"><label class="btn sec sm">📷 Photo de la copie<input type="file" accept="image/*" data-aifile="${g}" hidden></label>
      ${d.img ? `<button class="btn red sm" data-act="aiimgdel" data-g="${g}">Retirer la photo</button>` : ''}</div>
    ${d.img ? `<img class="aithumb" src="${d.img}" alt="Photo de la copie">` : ''}
    <div class="msg ${d.ok ? 'ok' : ''}" id="ai-msg-${g}">${esc(d.msg)}</div>
    <div class="stack"><button class="btn" data-act="aianalyse" data-g="${g}">Analyser et détecter les erreurs</button>
      <button class="btn sec sm" data-act="aikey">⚙ Clé API</button></div></div>`;
}

function aiKeyModal() {
  const has = !!localStorage.getItem(AI_KEY_LS);
  modal(`<h2>Intelligence artificielle</h2>
    <p class="hint">Entrez votre clé API Anthropic (console.anthropic.com). Elle est enregistrée sur cet appareil uniquement. Le texte et les photos analysés sont envoyés à Anthropic ; le nom de l’élève n’est jamais envoyé. L’utilisation est facturée sur votre compte Anthropic.</p>
    <label class="f"><span>Clé API</span><input id="ai-key" type="password" autocomplete="off" placeholder="sk-ant-…"></label>
    <div class="msg" id="ai-key-msg">${has ? 'Une clé est déjà enregistrée.' : ''}</div>
    <div class="stack"><button class="btn" data-act="aisavekey">Enregistrer</button>
      ${has ? '<button class="btn red sm" data-act="aidelkey">Supprimer la clé</button>' : ''}
      <button class="btn sec" data-act="closemodal">Fermer</button></div>`);
}

// réduit la photo (1600 px max, JPEG) pour limiter le poids envoyé
const aiShrink = file => new Promise((ok, ko) => {
  const r = new FileReader();
  r.onerror = () => ko(new Error('Lecture de la photo impossible.'));
  r.onload = () => {
    const im = new Image();
    im.onerror = () => ko(new Error('Photo illisible.'));
    im.onload = () => {
      const k = Math.min(1, 1600 / Math.max(im.width, im.height));
      const c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
      c.getContext('2d').drawImage(im, 0, 0, c.width, c.height);
      ok(c.toDataURL('image/jpeg', .85));
    };
    im.src = r.result;
  };
  r.readAsDataURL(file);
});

async function aiCall(g, d, key) {
  const crit = GRIDS[g].crit.map(cr => `- ${cr.c} : ${cr.t || cr.name || cr.c}${cr.d ? ' — ' + cr.d : ''} (${cr.min ? 'critère minimal' : 'perfectionnement'})`).join('\n');
  const system = 'Tu es un assistant pédagogique pour un(e) enseignant(e) de français de 5ème année de l’enseignement primaire (Tunisie, élèves d’environ 10-11 ans). ' +
    'Tu analyses la production d’un élève et tu relèves ses erreurs réelles, classées selon les critères d’évaluation de l’activité. ' +
    'Règles : ne signale que de vraies erreurs, sans en inventer ; cite l’extrait fautif exact puis la correction attendue ; rattache chaque erreur à UN critère de la liste (son code) ; ' +
    'choisis le type parmi : ' + ERR_TYPES.join(', ') + ' ; propose une hypothèse brève et bienveillante sur la source de l’erreur ; regroupe les erreurs identiques ; ' +
    '15 erreurs au maximum, les plus significatives d’abord. Si une photo est fournie, transcris-la fidèlement, sans corriger, dans "transcription". ' +
    'Réponds UNIQUEMENT par un objet JSON, sans aucun texte autour : {"transcription":"","erreurs":[{"critere":"C1","erreur":"…","type":"…","hypothese":"…"}]}';
  const text = `Activité : ${AI_CTX[g]}.\nCritères d’évaluation :\n${crit}\n` +
    (d.ref.trim() ? `\nConsigne / texte de référence :\n${d.ref.trim()}\n` : '') +
    (d.text.trim() ? `\nProduction de l’élève :\n${d.text.trim()}` : '\nLa production de l’élève est sur la photo jointe.');
  const content = [];
  if (d.img) content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: d.img.split(',')[1] } });
  content.push({ type: 'text', text });
  let res;
  try {
    res = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' },
      body: JSON.stringify({ model: AI_MODEL, max_tokens: 3000, system, messages: [{ role: 'user', content }] })
    });
  } catch (e) { throw new Error('Pas de connexion internet.'); }
  if (!res.ok) {
    if (res.status === 401) throw new Error('Clé API invalide : vérifiez-la dans « ⚙ Clé API ».');
    if (res.status === 429) throw new Error('Trop de demandes : réessayez dans un instant.');
    throw new Error('Erreur du service IA (' + res.status + ').');
  }
  const data = await res.json();
  const raw = (data.content || []).map(c => c.text || '').join('').replace(/```json|```/g, '').trim();
  try { return JSON.parse(raw); } catch (e) {
    const m = raw.match(/\{[\s\S]*\}/); if (m) { try { return JSON.parse(m[0]); } catch (e2) { /* ignore */ } }
    throw new Error('Réponse de l’IA illisible : réessayez.');
  }
}

async function aiAnalyse(g) {
  const d = aiD(g);
  const setMsg = (m, ok) => { d.msg = m; d.ok = !!ok; const el = $('#ai-msg-' + g); if (el) { el.textContent = m; el.className = 'msg ' + (ok ? 'ok' : ''); } };
  const key = localStorage.getItem(AI_KEY_LS);
  if (!key) return aiKeyModal();
  const idx = S.students.findIndex(s => s.id === d.sid);
  if (idx < 0) return setMsg('Choisissez d’abord un élève.');
  if (!d.text.trim() && !d.img) return setMsg('Saisissez le texte de l’élève ou ajoutez une photo.');
  if (d.busy) return;
  d.busy = true; setMsg('Analyse en cours… (quelques secondes)');
  try {
    const out = await aiCall(g, d, key);
    const name = S.students[idx].nom.trim() || ('E' + (idx + 1));
    const crits = GRIDS[g].crit;
    const list = (Array.isArray(out.erreurs) ? out.erreurs : []).slice(0, 15).map(x => {
      const cr = crits.find(c => c.c === String(x.critere || '').trim());
      return { eleve: name, erreur: String(x.erreur || '').slice(0, 400), crit: cr ? critLabel(cr) : '',
        type: ERR_TYPES.includes(x.type) ? x.type : 'Autre', hyp: String(x.hypothese || '').slice(0, 400), ia: 1 };
    }).filter(x => x.erreur);
    if (out.transcription && !d.text.trim()) d.text = String(out.transcription);
    S[g].err.push(...list);
    d.busy = false;
    if (list.length) changed();
    d.msg = list.length ? `${list.length} erreur(s) ajoutée(s) au tableau ci-dessous : vérifiez-les.` : 'Aucune erreur détectée.';
    d.ok = true;
    render(true);
  } catch (e) { d.busy = false; setMsg(String((e && e.message) || e)); }
}

function errorsHtml(g) {
  const list = S[g].err;
  return aiCardHtml(g) + `<datalist id="dl-stu">${S.students.filter(s => s.nom).map(s => `<option value="${esc(s.nom)}">`).join('')}</datalist>
  <datalist id="dl-type">${['Phonologique', 'Lexicale', 'Syntaxique', 'Morphologique', 'Orthographique', 'Sémantique', 'Autre'].map(t => `<option value="${t}">`).join('')}</datalist>
  <div class="card"><h3>Recensement et classification des erreurs</h3>
  ${list.map((e, i) => `<div class="errcard">${e.ia ? '<p class="hint" style="margin:0 0 6px">🤖 Détectée par l’IA — à vérifier</p>' : ''}
    <label class="f"><span>Nom & prénom (élève)</span><input list="dl-stu" data-b="${g}|err|${i}|eleve" value="${esc(e.eleve)}"></label>
    <label class="f"><span>Erreur</span><textarea rows="2" data-b="${g}|err|${i}|erreur">${esc(e.erreur)}</textarea></label>
    <div class="row2">
      <label class="f"><span>Critère concerné</span><select data-b="${g}|err|${i}|crit"><option value="">–</option>${(() => {
        const opts = GRIDS[g].crit.map(critLabel);
        if (e.crit && !opts.includes(e.crit)) opts.push(e.crit);   // garde une ancienne saisie libre
        return opts.map(o => `<option value="${esc(o)}" ${e.crit === o ? 'selected' : ''}>${esc(o)}</option>`).join('');
      })()}</select></label>
      <label class="f"><span>Type de l’erreur</span><input list="dl-type" data-b="${g}|err|${i}|type" value="${esc(e.type)}"></label></div>
    <label class="f"><span>Hypothèses explicatives sur la source de l’erreur</span><textarea rows="2" data-b="${g}|err|${i}|hyp">${esc(e.hyp)}</textarea></label>
    <button class="btn red sm" data-act="delerr" data-g="${g}" data-i="${i}">Supprimer</button></div>`).join('') || '<p class="hint">Aucune erreur enregistrée.</p>'}
  <button class="btn" data-act="adderr" data-g="${g}">+ Ajouter une erreur</button></div>`;
}

function groupsHtml(path, title, labels, fields, g) {
  const F = { noms: 'Noms et prénoms', crit: 'Critères non maîtrisés', diff: 'Difficultés à traiter', dec: 'Décisions de remédiation' };
  const arr = getP(path);
  const stuOpts = S.students.map((s, i) => s.nom.trim()).filter(Boolean);
  const critOpts = g === 'conj'
    ? [0, 1, 2].map(i => { const t = String((S.conj.diffs || [])[i] || '').trim(); return 'Difficulté ' + (i + 1) + (t ? ' : ' + t.slice(0, 50) : ''); })
    : GRIDS[g].crit.map(critLabel);
  const picker = (f, i, label, opts) => `<select class="addsel" data-add="${path}|${i}|${f}" aria-label="${esc(label)}">
    <option value="">＋ ${esc(label)}</option>${opts.map(o => `<option value="${esc(o)}">${esc(o)}</option>`).join('')}</select>`;
  return `<div class="card"><h3>${esc(title)}</h3>
    <p class="hint">Si la difficulté touche la majorité des élèves, les activités de remédiation visent l’ensemble de la classe.</p>
    ${arr.map((gr, i) => `<details ${i === 0 ? 'open' : ''} class="card" style="padding:8px 12px"><summary><b>${labels[i]}</b></summary>
      ${fields.map(f => `<label class="f"><span>${F[f]}</span>${f === 'noms' ? picker(f, i, 'Choisir un élève', stuOpts) : f === 'crit' ? picker(f, i, 'Choisir un critère', critOpts) : ''}<textarea rows="3" data-b="${path}|${i}|${f}">${esc(gr[f])}</textarea></label>`).join('')}</details>`).join('')}</div>`;
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

  recit: { icon: '🎭', title: 'Récitation', sub: 'Grille · mise en train', tabs: [
    ['Grille', () => `<div class="card"><div class="row2">${field('Module d’évaluation N°', 'recit|module')}<div></div></div>
      ${field('Poème 1', 'recit|poemes|P1')}${field('Poème 2', 'recit|poemes|P2')}</div>${gridHtml('recit')}`],
    ['Mise en train', () => groupsHtml('recit|groups', 'Résultats de la mise en train', GROUPS_4, ['noms', 'crit', 'diff', 'dec'], 'recit')]] },

  oral: { icon: '🗣️', title: 'Expression orale', sub: 'Fiche · grille', tabs: [
    ['Fiche', () => `<div class="card"><h3>Expression orale — 5ème année</h3>
      ${field('Performance attendue à la fin du 2ème degré : Au terme de la…', 'oral|perf', { ta: 1, rows: 4 })}
      <h3>Objectifs spécifiques</h3>${[0, 1, 2, 3].map(i => field('Objectif ' + (i + 1), `oral|obj|${i}`, { ta: 1, rows: 2 })).join('')}
      ${field('Structure', 'oral|structure', { ta: 1 })}${field('Lexique', 'oral|lexique', { ta: 1 })}
      <h3>Situations</h3>${[0, 1, 2, 3].map(i => field('S' + (i + 1), `oral|sit|${i}`, { ta: 1, rows: 2 })).join('')}</div>
      ${[0, 1, 2].map(i => `<div class="card"><h3>Épreuve d’évaluation n°${i + 1}</h3>${field('Objectifs de communication + lexique et structures à employer par l’élève + questions proposées', `oral|epr|${i}`, { ta: 1, rows: 6 })}</div>`).join('')}`],
    ['Grille', () => gridHtml('oral')],
    ['Erreurs', () => errorsHtml('oral')],
    ['Bilan', () => groupsHtml('oral|groups', 'Résultats en expression orale', GROUPS_4, ['noms', 'crit', 'diff', 'dec'], 'oral')]] },

  lect: { icon: '📖', title: 'Lecture', sub: 'Grille · vocale & compréhension', tabs: [
    ['Textes', () => S.lect.textes.map((t, i) => `<div class="card"><h3>Texte N°${i + 1} proposé à la lecture vocale</h3>
      ${field('Titre', `lect|textes|${i}|titre`)}${field('Texte', `lect|textes|${i}|texte`, { ta: 1, rows: 7 })}</div>`).join('')],
    ['Grille', () => gridHtml('lect')],
    ['Erreurs', () => errorsHtml('lect')],
    ['Bilans', () => groupsHtml('lect|groups', 'Résultats en lecture vocale', GROUPS_4, ['noms', 'crit', 'diff', 'dec'], 'lect') +
      groupsHtml('lect|groupsComp', 'Résultats en lecture compréhension', GROUPS_4, ['noms', 'crit', 'diff', 'dec'], 'lect')],
    ['Remédiation', () => remedHtml('lect|remed', 'Dispositif de remédiation de la lecture')]] },

  ecrit: { icon: '✍️', title: 'Production écrite', sub: 'Grille', tabs: [
    ['Grille', () => gridHtml('ecrit')],
    ['Erreurs', () => errorsHtml('ecrit')],
    ['Bilan', () => groupsHtml('ecrit|groups', 'Résultats à l’écrit', GROUPS_4, ['noms', 'crit', 'diff', 'dec'], 'ecrit')],
    ['Remédiation', () => remedHtml('ecrit|remed', 'Dispositif de remédiation de la production')]] },

  conj: { icon: '🔤', title: 'Conjugaison · Grammaire · Orthographe', sub: 'Difficultés & % de réussite', tabs: [
    ['Difficultés', () => {
      const d = [0, 1, 2];
      return unitPerfHtml('conj') + `<div class="card">${d.map(i => field('Difficulté n°' + (i + 1), `conj|diffs|${i}`, { ta: 1, rows: 2 })).join('')}</div>
      <div class="scroll"><table><thead><tr><th class="sticky">Élève</th>${d.map(i => `<th>Diff. ${i + 1}</th>`).join('')}</tr></thead><tbody>
      ${S.students.map((s, i) => `<tr><td class="sticky">${esc(stuLabel(s, i))}</td>${d.map(k => {
        const m = (S.conj.marks[s.id] || {})['d' + k] || '';
        return `<td><button class="tog ${m}" data-act="tog" data-sid="${s.id}" data-d="d${k}">${m === 'ok' ? '✓' : m === 'ko' ? '✗' : '·'}</button></td>`;
      }).join('')}</tr>`).join('')}</tbody>
      <tfoot><tr><td class="sticky">% de réussite</td>${d.map(k => `<td data-calc="cp" data-d="d${k}"></td>`).join('')}</tr></tfoot></table></div>
      <p class="hint">Touchez une case : ✓ (réussi) → ✗ (non réussi) → vide.</p>`;
    }],
    ['Bilan', () => groupsHtml('conj|groups', 'Résultats des élèves', GROUPS_ABCD, ['noms', 'crit', 'dec'], 'conj') +
      remedHtml('conj|remed', 'Dispositif de remédiation (conjugaison / grammaire / orthographe)')]] }
};
const HOME_ORDER = ['couv', 'eleves', 'recit', 'oral', 'lect', 'ecrit', 'conj'];
const EXTRA = [['classes', '🏫', 'Mes classes', 'Plusieurs classes'], ['look', '🎨', 'Apparence', 'Police, taille, couleurs'], ['pdf', '🖨️', 'Imprimer / PDF', 'Exporter le dossier']];

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
    body = `<div class="home">${HOME_ORDER.map(k => `<button class="tile" data-go="${k}"><span>${SECTIONS[k].icon}</span>${esc(SECTIONS[k].title)}<small>${esc(SECTIONS[k].sub)}</small></button>`).join('')}
      ${EXTRA.map(([a, i, t, sub]) => `<button class="tile alt" data-act="${a}"><span>${i}</span>${t}<small>${sub}</small></button>`).join('')}</div>
      <p class="hint" style="text-align:center;margin-top:18px">Circonscription ${esc(S.meta.circ)} pour la langue française</p>`;
  } else {
    if (view.tab >= sec.tabs.length) view.tab = 0;
    body = (sec.tabs.length > 1 ? `<div class="tabs">${sec.tabs.map((t, i) => `<button data-tab="${i}" class="${i === view.tab ? 'on' : ''}">${t[0]}</button>`).join('')}</div>` : '') + sec.tabs[view.tab][1]();
  }
  $('#app').innerHTML = `<header>${view.sec !== 'home' ? '<button data-act="home" aria-label="Accueil">←</button>' : ''}<h1>${esc(title)}</h1>${chip()}<button data-act="classes" aria-label="Classes">🏫</button><button data-act="acct" aria-label="Compte">${user ? '👤' : '☁️'}</button></header><main>${body}</main>`;
  refresh();
  window.scrollTo(0, y);
}
const go = (sec, tab = 0) => { view = { sec, tab }; render(); };

/* =====================================================================
   8. ENREGISTREMENT & CLOUD
   ===================================================================== */
let tLocal = null, tCloud = null;
function changed() {
  DB.updatedAt = Date.now();
  clearTimeout(tLocal); tLocal = setTimeout(saveLocal, 250);
  if (user) { setStatus('pend'); clearTimeout(tCloud); tCloud = setTimeout(pushNow, 1500); }
}
async function pushNow() {
  if (!user) return;
  saveLocal(); setStatus('sync');
  try { await cloud.push(user.uid, JSON.stringify(DB), DB.updatedAt); setStatus('ok'); } catch (e) { setStatus('err'); }
}
async function syncDown() {
  setStatus('sync');
  try {
    // un autre compte avait utilisé cet appareil : ne pas mélanger les données
    if (owner && owner !== user.uid) { setDB(defaultDB()); owner = user.uid; saveLocal(); render(true); }
    const r = await cloud.pull(user.uid);
    owner = user.uid;
    if (r && r.data) {
      const remote = normDB(JSON.parse(r.data)), keep = DB.cur;
      if ((remote.updatedAt || 0) > (DB.updatedAt || 0)) {
        setDB(remote); if (remote.classes[keep]) { DB.cur = keep; S = DB.classes[keep]; }
        saveLocal(); render(); setStatus('ok'); return;
      }
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
   9b. PLUSIEURS CLASSES
   ===================================================================== */
function classModal(msg = '') {
  const rows = DB.order.map(id => {
    const c = DB.classes[id], n = c.students.filter(s => s.nom.trim()).length;
    return `<div class="clsrow"><button class="cls ${id === DB.cur ? 'on' : ''}" data-act="selcls" data-id="${id}">
      <b>${esc(c.meta.classe || 'Classe')}</b><small>${esc(c.meta.ecole || '—')} · ${n} élève${n > 1 ? 's' : ''}</small></button>
      ${DB.order.length > 1 ? `<button class="btn red sm" data-act="delcls" data-id="${id}" aria-label="Supprimer la classe">✕</button>` : ''}</div>`;
  }).join('');
  modal(`<h2>🏫 Mes classes</h2>
    <p class="hint">Touchez une classe pour l’ouvrir. Chaque classe a ses propres élèves, notes, erreurs et bilans. Pour la renommer : Couverture → Classe.</p>
    ${rows}
    <label class="f" style="margin-top:10px"><span>Nouvelle classe (l’école, l’année et l’enseignant(e) sont recopiés)</span><input id="cls-new" placeholder="ex. 5ème B"></label>
    <div class="msg" id="cls-msg">${esc(msg)}</div>
    <div class="stack"><button class="btn" data-act="addcls">+ Créer la classe</button><button class="btn sec" data-act="closemodal">Fermer</button></div>`);
}
function switchClass(id) {
  if (!DB.classes[id]) return;
  DB.cur = id; S = DB.classes[id]; saveLocal();
  modal(''); view = { sec: 'home', tab: 0 }; render();
}
function addClass() {
  const name = ($('#cls-new').value || '').trim();
  if (!name) { const m = $('#cls-msg'); if (m) m.textContent = 'Saisissez le nom de la classe.'; return; }
  const id = newId(), st = defaultState();
  st.meta = { ...S.meta, classe: name };
  DB.classes[id] = st; DB.order.push(id); DB.cur = id; S = st;
  changed(); modal(''); view = { sec: 'home', tab: 0 }; render();
}
function delClass(id) {
  if (DB.order.length < 2 || !DB.classes[id]) return;
  if (!confirm(`Supprimer définitivement la classe « ${DB.classes[id].meta.classe} » avec tous ses élèves et ses notes ?`)) return;
  DB.order = DB.order.filter(x => x !== id); delete DB.classes[id];
  if (DB.cur === id) { DB.cur = DB.order[0]; S = DB.classes[DB.cur]; }
  changed(); classModal(); render(true);
}

/* =====================================================================
   9c. APPARENCE (police, taille, couleurs) — enregistrée sur l'appareil
   ===================================================================== */
const FONTS = {
  sys:   { label: 'Par défaut', css: 'system-ui,-apple-system,"Segoe UI",Roboto,sans-serif', pdf: 'helvetica' },
  read:  { label: 'Lisible (Verdana)', css: 'Verdana,Tahoma,Geneva,sans-serif', pdf: 'helvetica' },
  serif: { label: 'Avec empattements (Serif)', css: 'Georgia,"Times New Roman",serif', pdf: 'times' },
  mono:  { label: 'Machine à écrire', css: '"Courier New",Courier,monospace', pdf: 'courier' },
  hand:  { label: 'Manuscrit', css: '"Comic Sans MS","Segoe Print",cursive', pdf: 'helvetica' },
  casual:{ label: 'Décontracté', css: '"Trebuchet MS",casual,sans-serif', pdf: 'helvetica' },
  cond:  { label: 'Condensé', css: '"Arial Narrow","sans-serif-condensed",sans-serif', pdf: 'helvetica' }
};
const PRESETS = [['Bleu', '#1e3a8a', '#2f5bd8'], ['Vert', '#14532d', '#16a34a'], ['Violet', '#4c1d95', '#7c3aed'],
  ['Rouge', '#7f1d1d', '#dc2626'], ['Orange', '#7c2d12', '#ea580c'], ['Turquoise', '#134e4a', '#0d9488'], ['Gris', '#1f2937', '#4b5563']];
const DEF_PREFS = { font: 'sys', size: 16, pri: '#1e3a8a', pri2: '#2f5bd8', ink: '#1b2437', bg: '#f4f6fb' };
const LSP = 'dossier5.prefs';
const isHex = v => /^#[0-9a-f]{6}$/i.test(v || '');
function loadPrefs() {
  const p = { ...DEF_PREFS };
  try {
    const r = JSON.parse(localStorage.getItem(LSP) || 'null') || {};
    if (FONTS[r.font]) p.font = r.font;
    if (+r.size >= 12 && +r.size <= 24) p.size = Math.round(+r.size);
    for (const k of ['pri', 'pri2', 'ink', 'bg']) if (isHex(r[k])) p[k] = r[k];
  } catch (e) { /* ignore */ }
  return p;
}
let PREFS = loadPrefs();
const savePrefs = () => { try { localStorage.setItem(LSP, JSON.stringify(PREFS)); } catch (e) { /* quota */ } };
const rgb = h => { const n = parseInt(String(h).slice(1), 16) || 0; return [(n >> 16) & 255, (n >> 8) & 255, n & 255]; };
const toHex = a => '#' + a.map(x => Math.round(x).toString(16).padStart(2, '0')).join('');
const mix = (a, b, t) => { const A = rgb(a), B = rgb(b); return toHex(A.map((x, i) => x * t + B[i] * (1 - t))); };
const lum = h => { const [r, g, b] = rgb(h).map(v => { v /= 255; return v <= .03928 ? v / 12.92 : Math.pow((v + .055) / 1.055, 2.4); }); return .2126 * r + .7152 * g + .0722 * b; };
const onColor = h => (lum(h) > .45 ? '#111827' : '#ffffff');
function applyPrefs() {
  const st = document.documentElement.style, P = PREFS;
  st.fontSize = P.size + 'px';
  st.setProperty('--ff', FONTS[P.font].css);
  st.setProperty('--pri', P.pri); st.setProperty('--pri2', P.pri2);
  st.setProperty('--ink', P.ink); st.setProperty('--bg', P.bg);
  st.setProperty('--onpri', onColor(P.pri)); st.setProperty('--onpri2', onColor(P.pri2));
  st.setProperty('--soft', mix(P.pri2, '#ffffff', .12)); st.setProperty('--soft2', mix(P.pri2, '#ffffff', .22));
  const tc = document.querySelector('meta[name=theme-color]'); if (tc) tc.setAttribute('content', P.pri);
}
function lookModal() {
  const P = PREFS;
  modal(`<h2>🎨 Apparence</h2>
    <p class="hint">Réglages enregistrés sur cet appareil. Ils s’appliquent aussi au PDF (police, taille et couleur principale).</p>
    <div class="f"><span>Police</span><div class="fonts">${Object.entries(FONTS).map(([k, f]) =>
      `<button class="fontopt ${P.font === k ? 'on' : ''}" data-act="font" data-k="${k}" style="font-family:${f.css}">${esc(f.label)} — Aa Bb 123</button>`).join('')}</div></div>
    <label class="f"><span>Taille du texte : <b id="pf-size-v">${P.size} px</b></span><input type="range" min="12" max="24" step="1" value="${P.size}" data-pref="size"></label>
    <div class="f"><span>Thèmes de couleurs</span><div class="sws">${PRESETS.map((p, i) =>
      `<button class="sw" data-act="preset" data-i="${i}" aria-label="${p[0]}" title="${p[0]}" style="background:linear-gradient(135deg,${p[1]} 50%,${p[2]} 50%)"></button>`).join('')}</div></div>
    <div class="row2"><label class="f"><span>Couleur principale (en-tête, titres)</span><input type="color" data-pref="pri" value="${P.pri}"></label>
      <label class="f"><span>Couleur d’accent (boutons)</span><input type="color" data-pref="pri2" value="${P.pri2}"></label></div>
    <div class="row2"><label class="f"><span>Couleur du texte</span><input type="color" data-pref="ink" value="${P.ink}"></label>
      <label class="f"><span>Couleur du fond</span><input type="color" data-pref="bg" value="${P.bg}"></label></div>
    <div class="stack"><button class="btn" data-act="closemodal">Terminé</button><button class="btn red sm" data-act="resetlook">Rétablir les réglages par défaut</button></div>`);
}

/* =====================================================================
   9d. EXPORT PDF (le dessin du PDF est fait par www/pdf.js : jsPDF)
   ===================================================================== */
const PDF_SECS = [['couv', 'Couverture'], ['eleves', 'Liste des élèves'], ['recit', 'Récitation'], ['oral', 'Expression orale'],
  ['lect', 'Lecture'], ['ecrit', 'Production écrite'], ['conj', 'Conjugaison · Grammaire · Orthographe']];
const pdfSel = Object.fromEntries(PDF_SECS.map(([k]) => [k, true]));
let pdfOrient = 'landscape';

function pdfModal(msg = '', ok = false) {
  modal(`<h2>🖨️ Imprimer / PDF</h2>
    <p class="hint">Classe : <b>${esc(S.meta.classe)}</b>. Choisissez les rubriques à inclure. Sur Android, le PDF s’ouvre dans le menu de partage : enregistrer, envoyer ou imprimer.</p>
    ${PDF_SECS.map(([k, l]) => `<label class="chk"><input type="checkbox" data-pdfsec="${k}" ${pdfSel[k] ? 'checked' : ''}> ${esc(l)}</label>`).join('')}
    <label class="f" style="margin-top:8px"><span>Orientation de la page</span><select id="pdf-or">
      <option value="landscape" ${pdfOrient === 'landscape' ? 'selected' : ''}>Paysage (recommandé pour les grilles)</option>
      <option value="portrait" ${pdfOrient === 'portrait' ? 'selected' : ''}>Portrait</option></select></label>
    <div class="msg ${ok ? 'ok' : ''}" id="pdf-msg">${esc(msg)}</div>
    <div class="stack"><button class="btn" data-act="mkpdf">Générer le PDF</button><button class="btn sec" data-act="closemodal">Fermer</button></div>`);
}

const dFr = d => (d ? String(d).split('-').reverse().join('/') : '');
const GF = { noms: 'Noms et prénoms', crit: 'Critères non maîtrisés', diff: 'Difficultés à traiter', dec: 'Décisions de remédiation' };

function gridModel(g) {
  const cfg = GRIDS[g];
  const preLab = { poeme: 'Poème', situ: 'Situation', texte: 'Texte' }[cfg.pre];
  const h1 = [{ c: 'Élève', rowSpan: 2 }];
  if (cfg.pre) h1.push({ c: preLab, rowSpan: 2 });
  h1.push({ c: 'Niveau par critère', colSpan: cfg.crit.length });
  const h2 = cfg.crit.map(cr => ({ c: cr.name || cr.c }));
  const body = S.students.map((s, i) => {
    const cur = S[g].pre[s.id] ?? (g === 'recit' ? (i % 2 ? 'P2' : 'P1') : '');
    return [stuLabel(s, i), ...(cfg.pre ? [cur] : []),
      ...cfg.crit.map(cr => lvCell(critLv(g, s.id, cr.c)))];
  });
  const sp = cfg.pre ? 2 : 1, st = cfg.crit.map(cr => lvStats(g, cr.c));
  const foot = [
    [{ c: 'Élèves ayant atteint les critères minimaux', colSpan: sp }, ...st.map(x => (x.tot ? String(x.n) : ''))],
    [{ c: '%', colSpan: sp }, ...st.map(x => (x.tot ? Math.round(100 * x.n / x.tot) + ' %' : ''))]];
  return { t: 'table', head: [h1, h2], body, foot, firstW: 34 };
}
const errModel = g => ({ t: 'table', align: 'left', firstW: 34,
  head: [['Nom et prénom', 'Erreur', 'Critère concerné', 'Type de l’erreur', 'Hypothèses explicatives']],
  body: S[g].err.map(e => [e.eleve, e.erreur, e.crit, e.type, e.hyp]) });
const grpModel = (arr, labels, fields) => ({ t: 'table', align: 'left', minH: 16, firstW: 22,
  head: [['Groupe', ...fields.map(f => GF[f])]], body: arr.map((gr, i) => [labels[i], ...fields.map(f => gr[f] || '')]) });

function buildModel(sel) {
  const B = [], m = S.meta;
  const H1 = t => B.push({ t: 'h1', text: t, newPage: B.length > 0 });
  const H2 = t => B.push({ t: 'h2', text: t });
  const KV = (label, text) => { if (String(text || '').trim()) B.push({ t: 'kv', label, text }); };
  const ERR = g => { H2('Recensement et classification des erreurs'); if (S[g].err.length) B.push(errModel(g)); else B.push({ t: 'p', text: 'Aucune erreur enregistrée.' }); };
  const G4 = ['noms', 'crit', 'diff', 'dec'];
  const CRIT = g => { const l = GRIDS[g].crit.filter(cr => cr.t); if (!l.length) return;
    H2('Critères d’évaluation'); B.push({ t: 'p', text: l.map(cr => `${cr.c} - ${cr.t} (${cr.min ? 'minimal' : 'perfectionnement'}) : ${cr.d}`).join('\n') }); };
  // unité + performance attendue de l'activité
  const UP = (g, noPerf) => { if (S[g].unite) KV('Unité', 'Unité ' + S[g].unite); if (!noPerf) KV('Performance attendue', S[g].perf); };

  if (sel.includes('couv')) {
    B.push({ t: 'cover', dre: m.dre, circ: m.circ, ecole: m.ecole, classe: m.classe, annee: m.annee,
      enseignant: m.enseignant, inspecteur: m.inspecteur, assistant: m.assistant });
  }
  if (sel.includes('eleves')) {
    H1('Liste des élèves — ' + m.classe + ' — ' + m.annee);
    B.push({ t: 'table', align: 'center', firstW: 12,
      head: [['N°', 'Nom et prénom', 'Date de naissance', 'Sexe']],
      body: S.students.map((s, i) => [String(i + 1), s.nom, dFr(s.naiss), s.sexe]),
      foot: [['', `Garçons : ${S.students.filter(s => s.sexe === 'G').length}   Filles : ${S.students.filter(s => s.sexe === 'F').length}`, `Effectif : ${S.students.filter(s => s.nom.trim()).length}`, '']] });
  }
  if (sel.includes('recit')) {
    H1('Récitation — grille');
    UP('recit');
    KV('Module d’évaluation N°', S.recit.module); KV('Poème 1', S.recit.poemes.P1); KV('Poème 2', S.recit.poemes.P2);
    B.push(gridModel('recit'));
    H2('Résultats de la mise en train'); B.push(grpModel(S.recit.groups, GROUPS_4, G4));
  }
  if (sel.includes('oral')) {
    const o = S.oral;
    H1('Expression orale — 5ème année');
    UP('oral', true);
    KV('Performance attendue', o.perf);
    o.obj.forEach((x, i) => KV('Objectif spécifique ' + (i + 1), x));
    KV('Structure', o.structure); KV('Lexique', o.lexique);
    o.sit.forEach((x, i) => KV('Situation S' + (i + 1), x));
    o.epr.forEach((x, i) => KV('Épreuve d’évaluation n°' + (i + 1), x));
    CRIT('oral'); H2('Grille d’évaluation'); B.push(gridModel('oral'));
    ERR('oral');
    H2('Résultats en expression orale'); B.push(grpModel(o.groups, GROUPS_4, G4));
  }
  if (sel.includes('lect')) {
    const l = S.lect;
    H1('Lecture — grille');
    UP('lect');
    l.textes.forEach((t, i) => { if ((t.titre || t.texte || '').trim()) { KV(`Texte N°${i + 1}` + (t.titre ? ' — ' + t.titre : ''), t.texte || ' '); } });
    CRIT('lect'); H2('Grille d’évaluation'); B.push(gridModel('lect'));
    ERR('lect');
    H2('Résultats en lecture vocale'); B.push(grpModel(l.groups, GROUPS_4, G4));
    H2('Résultats en lecture compréhension'); B.push(grpModel(l.groupsComp, GROUPS_4, G4));
    KV('Dispositif de remédiation de la lecture', l.remed);
  }
  if (sel.includes('ecrit')) {
    const e = S.ecrit;
    H1('Production écrite — grille');
    UP('ecrit');
    CRIT('ecrit'); B.push(gridModel('ecrit'));
    ERR('ecrit');
    H2('Résultats à l’écrit'); B.push(grpModel(e.groups, GROUPS_4, G4));
    KV('Dispositif de remédiation de la production', e.remed);
  }
  if (sel.includes('conj')) {
    const c = S.conj, d = [0, 1, 2];
    H1('Conjugaison · Grammaire · Orthographe');
    UP('conj');
    d.forEach(i => KV('Difficulté n°' + (i + 1), c.diffs[i]));
    const pct = k => { let ok = 0, tot = 0; for (const st of S.students) { const v = (c.marks[st.id] || {})[k]; if (v === 'ok') { ok++; tot++; } else if (v === 'ko') tot++; } return tot ? Math.round(100 * ok / tot) + ' %' : ''; };
    B.push({ t: 'table', align: 'center', firstW: 40,
      head: [['Élève', ...d.map(i => 'Diff. ' + (i + 1))]],
      body: S.students.map((s, i) => [stuLabel(s, i), ...d.map(k => { const v = (c.marks[s.id] || {})['d' + k]; return v === 'ok' ? 'V' : v === 'ko' ? 'X' : ''; })]),
      foot: [['% de réussite', ...d.map(k => pct('d' + k))]] });
    H2('Résultats des élèves'); B.push(grpModel(c.groups, GROUPS_ABCD, ['noms', 'crit', 'dec']));
    KV('Dispositif de remédiation', c.remed);
  }
  return { title: 'Dossier d’évaluation — ' + m.classe, footer: [m.ecole, m.classe, m.annee].filter(Boolean).join(' · '), blocks: B };
}

async function makePdf() {
  const msg = (t, ok) => { const el = $('#pdf-msg'); if (el) { el.className = 'msg' + (ok ? ' ok' : ''); el.textContent = t; } };
  const sel = PDF_SECS.map(x => x[0]).filter(k => pdfSel[k]);
  if (!sel.length) return msg('Cochez au moins une rubrique.');
  const orSel = $('#pdf-or'); if (orSel) pdfOrient = orSel.value;
  msg('Génération du PDF…', true);
  try {
    const mod = await import('./pdf.js');
    const slug = String(S.meta.classe || 'classe').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_|_$/g, '');
    await mod.exportPdf(buildModel(sel), {
      orientation: pdfOrient, font: FONTS[PREFS.font].pdf, scale: PREFS.size / 16,
      colors: { pri: PREFS.pri, pri2: PREFS.pri2, ink: PREFS.ink },
      fileName: `Dossier_${slug}_${new Date().toISOString().slice(0, 10)}.pdf`
    });
    msg('PDF prêt.', true);
  } catch (e) {
    if (e && /cancel/i.test(String(e.message || e))) return msg('');
    msg('Erreur PDF : ' + ((e && e.message) || e));
  }
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
  const t = e.target;
  if (t && t.dataset && t.dataset.add) {
    const v = t.value; if (!v) return;
    const path = t.dataset.add, isName = path.endsWith('|noms');
    const cur = String(getP(path) || '').trim();
    const items = cur.split(isName ? /\s*,\s*|\n/ : /\n/).map(x => x.trim()).filter(Boolean);
    if (!items.includes(v)) { setP(path, cur ? cur + (isName ? ', ' : '\n') + v : v); changed(); }
    const ta = [...document.querySelectorAll('textarea[data-b]')].find(x => x.dataset.b === path);
    if (ta) ta.value = getP(path);
    t.value = ''; return;
  }
  if (!t || !t.dataset || !t.dataset.b) return;
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
  if (a === 'closemodal') return modal('');
  if (a === 'classes') return classModal();
  if (a === 'selcls') return switchClass(el.dataset.id);
  if (a === 'delcls') return delClass(el.dataset.id);
  if (a === 'addcls') return addClass();
  if (a === 'look') return lookModal();
  if (a === 'font') { PREFS.font = el.dataset.k; applyPrefs(); savePrefs(); return lookModal(); }
  if (a === 'preset') { const pr = PRESETS[+el.dataset.i]; PREFS.pri = pr[1]; PREFS.pri2 = pr[2]; applyPrefs(); savePrefs(); return lookModal(); }
  if (a === 'resetlook') { PREFS = { ...DEF_PREFS }; applyPrefs(); savePrefs(); return lookModal(); }
  if (a === 'pdf') return pdfModal();
  if (a === 'mkpdf') return makePdf();
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
  if (a === 'aikey') return aiKeyModal();
  if (a === 'aisavekey') {
    const v = ($('#ai-key').value || '').trim(), m = $('#ai-key-msg');
    if (!/^sk-ant-/.test(v)) { m.textContent = 'Cette clé ne semble pas valide (elle commence par sk-ant-).'; return; }
    localStorage.setItem(AI_KEY_LS, v); modal(''); return render(true);
  }
  if (a === 'aidelkey') { localStorage.removeItem(AI_KEY_LS); modal(''); return render(true); }
  if (a === 'aianalyse') return aiAnalyse(el.dataset.g);
  if (a === 'aiimgdel') { aiD(el.dataset.g).img = ''; return render(true); }
  if (a === 'adderr') { S[el.dataset.g].err.push({ eleve: '', erreur: '', crit: '', type: '', hyp: '' }); changed(); return render(true); }
  if (a === 'delerr') { S[el.dataset.g].err.splice(+el.dataset.i, 1); changed(); return render(true); }
  if (a === 'tog') {
    const { sid, d } = el.dataset; const m = (S.conj.marks[sid] ||= {});
    m[d] = m[d] === 'ok' ? 'ko' : m[d] === 'ko' ? '' : 'ok';
    el.className = 'tog ' + m[d]; el.textContent = m[d] === 'ok' ? '✓' : m[d] === 'ko' ? '✗' : '·';
    changed(); refresh();
  }
});

document.addEventListener('input', e => {
  const t = e.target; if (!t.dataset || !t.dataset.ai) return;
  const [g, f] = t.dataset.ai.split('|'); aiD(g)[f] = t.value;
});
document.addEventListener('change', async e => {
  const t = e.target; if (!t.dataset || !t.dataset.aifile) return;
  const g = t.dataset.aifile, f = t.files && t.files[0]; if (!f) return;
  try { aiD(g).img = await aiShrink(f); aiD(g).msg = ''; render(true); }
  catch (err) { const el = $('#ai-msg-' + g); if (el) { el.textContent = String(err.message || err); el.className = 'msg'; } }
});
document.addEventListener('input', e => {
  const t = e.target; if (!t.dataset || !t.dataset.pref) return;
  const k = t.dataset.pref;
  if (k === 'size') { PREFS.size = Math.min(24, Math.max(12, Math.round(+t.value) || 16)); const l = $('#pf-size-v'); if (l) l.textContent = PREFS.size + ' px'; }
  else if (isHex(t.value)) PREFS[k] = t.value;
  applyPrefs(); savePrefs();
});
document.addEventListener('change', e => {
  const t = e.target; if (!t.dataset || !t.dataset.pdfsec) return;
  pdfSel[t.dataset.pdfsec] = t.checked;
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
   11. DÉMARRAGE
   ===================================================================== */
applyPrefs();
render();
if (cloud.available) status = 'local';
cloud.onUser(async u => {
  const first = !authReady; authReady = true;
  user = u;
  if (u) { render(true); modal(''); await syncDown(); }
  else { setStatus('local'); render(true); if (first && cloud.available && !skipAuth) authModal(); }
});
