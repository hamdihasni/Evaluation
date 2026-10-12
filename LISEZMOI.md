# Dossier d'évaluation 5ème année — Application Android

Application reprenant tout le contenu du cahier papier (Circonscription Thala – langue française) :
couverture, liste des élèves, récitation, expression orale, lecture, production écrite,
conjugaison/grammaire/orthographe, tableaux d'erreurs, bilans par groupes de besoins et remédiations.
Totaux et moyennes sont calculés automatiquement. Les données sont enregistrées sur l'appareil
**et** dans le cloud (Firebase), avec fonctionnement hors-ligne puis synchronisation.

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
`npm run serve` puis http://localhost:8080 (sans Firebase configuré : mode local uniquement).

## Remarques
- Un seul dossier par compte (une classe). Pour plusieurs classes : un compte par classe, ou me demander l'extension.
- Barèmes modifiables en haut de `www/app.js` (objet `GRIDS`). Hypothèses faites là où le document
  papier ne détaille pas : expression orale C6 = 0,5 + 0,25 + 0,25 ; lecture « Lec. Voc » et « Lec. Comp »
  = 0,75 chacune (pour atteindre 20) ; production écrite C7 en perfectionnement.
- L'APK « debug » est installable directement ; pour publier sur Google Play il faudra une version signée.
