# Dossier d'évaluation 5ème année — Application Android

Application reprenant tout le contenu du cahier papier (Circonscription Thala – langue française) :
couverture, liste des élèves, récitation, expression orale, lecture, production écrite,
conjugaison/grammaire/orthographe, tableaux d'erreurs, bilans par groupes de besoins et remédiations.
Totaux et moyennes sont calculés automatiquement. Les données sont enregistrées sur l'appareil
**et** dans le cloud (Firebase), avec fonctionnement hors-ligne puis synchronisation.

## Nouveautés
- **Plusieurs classes** : bouton 🏫 (en haut) ou tuile « Mes classes ». Chaque classe a ses élèves, notes, erreurs et bilans.
  Une nouvelle classe recopie l'école, l'année et l'enseignant(e). Renommer : Couverture → Classe.
  Les anciens dossiers (une seule classe) sont convertis automatiquement, sans perte.
- **Apparence** (tuile 🎨) : 7 polices, taille du texte de 12 à 24 px, thèmes de couleurs et couleurs libres
  (principale, accent, texte, fond). Réglages enregistrés sur l'appareil.
- **Imprimer / PDF** (tuile 🖨️) : choix des rubriques et de l'orientation. Sur Android, le PDF s'ouvre dans le menu de
  partage (enregistrer, Drive, WhatsApp, imprimer…). Le PDF reprend la police (sans-serif, serif ou machine),
  la taille et la couleur principale choisies. Il ne contient que des caractères latins (français).

- **Détection des erreurs par IA** : dans l'onglet « Erreurs » de l'expression orale, de la lecture et de la production écrite,
  choisissez un élève, collez son texte (ou prenez la copie en photo) et touchez « Analyser ». L'IA ajoute au tableau les erreurs
  classées selon les critères de l'activité (à vérifier et à corriger si besoin). Il faut une clé API Anthropic, saisie dans
  « ⚙ Clé API » et gardée sur l'appareil seulement. Le nom de l'élève n'est jamais envoyé. Le modèle se change dans `AI_MODEL` (haut de la section IA de `www/app.js`).

## Obtenir l'APK (sans installer Android Studio) — environ 20 minutes

### 1. Créer le projet cloud (Firebase, gratuit)
1. https://console.firebase.google.com → **Ajouter un projet**.
2. **Authentication → Sign-in method** → activer **E-mail/Mot de passe**.
3. **Firestore Database → Créer** (mode production, région proche, ex. `eur3`).
4. Firestore → onglet **Règles** → coller le contenu de `firestore.rules` → **Publier**.
5. **Paramètres du projet (⚙) → Vos applications → </> Web** → enregistrer l'app → copier l'objet `firebaseConfig`.
6. Coller ces valeurs dans `cloud-src/firebase-config.js`.

### 2. Compiler l'APK avec GitHub (gratuit)
1. Créer un dépôt GitHub (privé conseillé) et y envoyer **tout le contenu de ce dossier**
   (y compris le dossier caché `.github`).
2. Onglet **Actions → « Construire l'APK Android » → Run workflow** (se lance aussi à chaque envoi).
3. Après ~5–8 min : ouvrir l'exécution → **Artifacts → dossier-evaluation-apk** → télécharger → `app-debug.apk`.

### 3. Installer
Copier `app-debug.apk` sur le téléphone, l'ouvrir et autoriser « sources inconnues ».
Au premier lancement : **Créer un compte** (e-mail + mot de passe). Se connecter avec le même
compte sur un autre appareil retrouve toutes les données.

## Alternative : Android Studio
```
npm install
npm run build:cloud
npx cap add android
npx cap sync android
npx cap open android      # puis Build > Build APK(s)
```

## Tester dans un navigateur
`npm run serve` puis http://localhost:8080 (sans Firebase configuré : mode local uniquement ;
l'export PDF demande d'abord `npm install && npm run build:cloud`).

## Remarques
- Un compte = toutes vos classes (synchronisées ensemble). En cas de modification sur deux appareils hors-ligne, la version la plus récente l'emporte.
- Barèmes modifiables en haut de `www/app.js` (objet `GRIDS`). Hypothèses faites là où le document
  papier ne détaille pas : expression orale C6 = 0,5 + 0,25 + 0,25 ; lecture « Lec. Voc » et « Lec. Comp »
  = 0,75 chacune (pour atteindre 20) ; production écrite C7 en perfectionnement.
- L'APK « debug » est installable directement ; pour publier sur Google Play il faudra une version signée.
