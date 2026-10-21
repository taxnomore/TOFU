# 🐶 TOFU ! QUI A FAIT ÇA ?

Un jeu de fête en 3D pour toute la famille. Tofu, un labrador jaune, fait des bêtises ; les humains préparent la maison avant l'arrivée des invités. Un joueur incarne Tofu, un ou deux joueurs incarnent les humains. L'ordinateur peut tenir le rôle qui manque.

Le jeu tourne dans le navigateur : sur un PC Linux (Firefox ou Chromium) et sur les téléphones Android ou iPhone reliés au même Wi-Fi. Il ne demande ni compte, ni abonnement. Après l'installation, il n'a plus besoin d'Internet.

- [1. Installer le jeu sur un PC Linux](#1-installer-le-jeu-sur-un-pc-linux)
- [2. Lancer le jeu](#2-lancer-le-jeu)
- [3. Jouer seul](#3-jouer-seul)
- [4. Jouer à 2 ou 3 sur le même PC](#4-jouer-à-2-ou-3-sur-le-même-pc-écran-partagé)
- [5. Jouer avec des téléphones sur le Wi-Fi](#5-jouer-avec-des-téléphones-sur-le-wi-fi)
- [6. Commandes](#6-commandes)
- [7. Règles en bref](#7-règles-en-bref)
- [8. Dépannage](#8-dépannage)
- [9. Pour les développeurs](#9-pour-les-développeurs)

## 1. Installer le jeu sur un PC Linux

### Ce qu'il faut

- **Node.js 20.19 ou plus récent** (Node 22 conseillé) avec npm. Vérifiez avec `node --version`.
- Un navigateur récent : **Firefox** ou **Chromium** (ou Chrome).

Si Node.js manque ou date trop :

- Ubuntu, Debian, Linux Mint : les dépôts proposent souvent une version trop ancienne. Le plus simple passe par [nvm](https://github.com/nvm-sh/nvm) :
  ```bash
  curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.3/install.sh | bash
  # fermez puis rouvrez le terminal
  nvm install 22
  ```
- Fedora : `sudo dnf install nodejs`
- Arch, Manjaro : `sudo pacman -S nodejs npm`

### Installation

Dans un terminal, placez-vous dans le dossier du jeu, puis :

```bash
npm install
npm run build
```

`npm install` télécharge les bibliothèques une seule fois (Internet nécessaire à cette étape seulement). `npm run build` prépare la version optimisée du jeu.

## 2. Lancer le jeu

```bash
npm run start
```

Le terminal affiche deux adresses, par exemple :

```
   Sur ce PC          : http://localhost:8080/
   Téléphones (Wi-Fi) : http://192.168.1.42:8080/
```

Ouvrez la première dans le navigateur du PC. Gardez le terminal ouvert pendant que vous jouez ; `Ctrl+C` arrête le jeu.

- Autre port : `PORT=8081 npm run start`
- Mode développement, avec rechargement automatique quand le code change : `npm run dev`

Au premier lancement, passez par « Comment jouer » : l'écran résume les règles et toutes les touches. Des astuces apparaissent aussi pendant les premières parties.

## 3. Jouer seul

1. Cliquez sur **Jouer seul**.
2. Choisissez **Jouer Tofu** ou **Jouer un humain**.
3. Réglez la difficulté de l'ordinateur (Facile, Normal, Difficile) et la durée (4, 6 ou 8 minutes).
4. Cliquez sur **C'est parti !**

L'ordinateur joue l'autre camp pour de vrai : il ouvre les portes, vole du linge, nettoie, lance des friandises et vous poursuit. En humain, vous pouvez ajouter un coéquipier joué par l'ordinateur.

## 4. Jouer à 2 ou 3 sur le même PC (écran partagé)

1. Branchez les manettes si vous en avez (facultatif).
2. Cliquez sur **Plusieurs joueurs sur ce PC**.
3. Chaque joueur appuie sur son bouton pour rejoindre :
   - **Espace** : clavier gauche (ZQSD sur un clavier AZERTY) ;
   - **Entrée** : clavier droit (flèches) ;
   - **A** : une manette (une par joueur).
4. Chaque joueur choisit son rôle avec **gauche / droite** et son personnage avec **haut / bas**. La souris marche aussi.
5. Lancez avec le bouton **Jouer**, ou la touche pause d'un joueur (**Échap**, **⌫** ou **Start**).

L'écran se partage en 2 ou 3 vues. Chaque joueur a sa propre caméra et peut explorer une autre partie du quartier. À 3 joueurs, le quatrième quart de l'écran montre une vue d'ensemble.

Si un seul joueur rejoint, l'ordinateur joue les rôles manquants (réglage « Rôles manquants »).

## 5. Jouer avec des téléphones sur le Wi-Fi

1. **Sur le PC** : lancez `npm run start`, ouvrez `http://localhost:8080/` et cliquez sur **Réseau local**. Le PC devient l'hôte 👑. Le salon affiche un QR code et l'adresse du jeu.
2. **Sur chaque téléphone** : connectez-vous au même Wi-Fi que le PC. Scannez le QR code avec l'appareil photo, ou tapez l'adresse affichée (par exemple `http://192.168.1.42:8080/`). Touchez **Rejoindre la partie**.
3. Chacun écrit son prénom, choisit **Tofu**, **Humain** ou **Peu importe**, puis touche **Je suis prêt !**
4. L'hôte règle la durée et la difficulté. Il peut désigner Tofu avec **En faire Tofu**. Il lance ensuite la partie.
5. Tournez les téléphones en mode paysage.

Bon à savoir :

- Le PC hôte peut aussi accueillir un ou plusieurs joueurs. Le bouton **Ajouter un joueur sur ce PC** partage son écran (clavier gauche, clavier droit ou manettes).
- Une partie compte 3 joueurs au plus. Les suivants regardent la manche et jouent à la suivante.
- Si personne ne veut être Tofu, l'ordinateur le joue, ou bien le premier joueur, selon le réglage de l'hôte. Sans humain, l'ordinateur joue « Maman ».
- Si un téléphone perd la connexion, l'ordinateur prend sa place. Le joueur la récupère en revenant (le jeu se reconnecte seul ; sinon, rechargez la page).
- À la fin, l'hôte choisit **Revanche**, **Revanche (changer Tofu)** ou **Salon**.

### Si les téléphones n'arrivent pas à se connecter

- Ouvrez le port dans le pare-feu du PC :
  - Ubuntu (ufw) : `sudo ufw allow 8080/tcp`
  - Fedora (firewalld) : `sudo firewall-cmd --add-port=8080/tcp` (ajoutez `--permanent`, puis `sudo firewall-cmd --reload`, pour garder la règle).
- Vérifiez que le PC et les téléphones utilisent le même réseau. Un réseau « invités » ou l'option « isolation des clients » de la box empêche les appareils de se voir.
- Utilisez l'adresse qui commence par `192.168.` ou `10.`. Le salon liste aussi les autres adresses du PC.
- Gardez l'adresse en `http://` : le jeu n'utilise pas `https://` sur le réseau local.

## 6. Commandes

Les touches se changent dans **Réglages → Changer les touches**. Les tableaux suivants montrent les touches d'origine.

### Clavier, un seul joueur

| Action | AZERTY | QWERTY |
|---|---|---|
| Se déplacer | Z Q S D ou flèches | W A S D ou flèches |
| Tourner la caméra | glisser avec la souris, A / E | glisser avec la souris, Q / E |
| Zoom | molette | molette |
| Action (prendre, poser, ouvrir, nettoyer) | Espace ou Entrée | Espace ou Entrée |
| Courir | Maj | Shift |
| Zoomies (Tofu), friandise ou balle (humain) | F | F |
| Aboyer (Tofu), appeler Tofu (humain) | R | R |
| S'asseoir l'air innocent (Tofu) | C | C |
| Vue du dessus | V ou Tab | V ou Tab |
| Pause | Échap ou P | Esc ou P |

Certaines actions demandent de **maintenir** le bouton (nettoyer, faire le lit, arroser, pousser une porte) ; le jeu l'indique.

### Deux joueurs sur un même clavier

| Action | Clavier gauche | Clavier droit |
|---|---|---|
| Se déplacer | Z Q S D (W A S D en QWERTY) | flèches |
| Action | Espace | Entrée ou 0 du pavé numérique |
| Courir | Maj gauche | Maj droite ou Ctrl droit |
| Zoomies, friandise | F | ! (AZERTY), / (QWERTY) ou 1 du pavé |
| Aboyer, appeler | R | : (AZERTY), . (QWERTY) ou 2 du pavé |
| S'asseoir | C | ; (AZERTY), , (QWERTY) ou 3 du pavé |
| Caméra | A / E (Q / E en QWERTY) | O / P ou 4 / 6 du pavé |
| Vue du dessus | V | 5 du pavé |
| Pause | Échap | ⌫ (retour arrière) |

### Manette (Xbox, PlayStation ou compatible)

| Action | Bouton |
|---|---|
| Se déplacer | stick gauche ou croix directionnelle |
| Caméra | stick droit, LB / RB (L1 / R1) |
| Action | A (croix) |
| Courir | RT ou LT (R2 / L2) |
| Zoomies, friandise | X (carré) |
| Aboyer, appeler | B (rond) |
| S'asseoir | Y (triangle) |
| Vue du dessus | Select (Share) |
| Pause | Start (Options) |

### Téléphone ou tablette

- **Se déplacer** : posez le pouce gauche n'importe où sur la moitié gauche de l'écran ; un joystick apparaît.
- **Caméra** : glissez un doigt sur la partie droite de l'écran, en dehors des boutons.
- **Boutons** en bas à droite : ✋ **Action** (le plus gros), 💨 **Courir**, 🌀 **Zoomies** ou 🦴 **Friandise**, 🗯️ **Wouf** ou 📣 **Appeler**, 🐾 **Assis** (Tofu).
- **⏸** en haut à droite : pause.
- Jouez en mode paysage ; le jeu le rappelle si le téléphone est en portrait.

## 7. Règles en bref

- Une manche dure 6 minutes (4 ou 8 au choix).
- **Les humains** reçoivent une liste de tâches : 3 tâches pour un humain, 6 pour deux. Exemples : rentrer le linge, ranger les jouets, mettre la table, servir le goûter, sortir la poubelle, relever le courrier, faire le lit, arroser les fleurs.
- **Les humains gagnent** quand toutes les tâches sont faites et que la maison est propre à 70 % au moins. Les invités sonnent alors ; il faut tenir 15 secondes sans que Tofu défasse une tâche ni salisse la maison sous le seuil.
- **Tofu gagne** quand sa barre de bêtises atteint 220 points (170 contre deux humains), ou quand le temps s'écoule avant que les humains aient fini.
- **Tofu** reçoit 3 **défis secrets** (+20 points chacun). Ses bêtises : voler du linge et le cacher, renverser des objets, poursuivre le chat, rapporter de la boue dans la maison, renverser les poubelles, manger le goûter, sauter sur le lit ou le canapé, creuser les massifs, tirer la nappe, dérouler le papier toilette, allumer l'aspirateur robot, aboyer sur la factrice. Les bêtises variées remplissent les **zoomies** : un sprint fou qui renverse tout sur son passage.
- **Les humains** reprennent ce que Tofu porte dans sa gueule, rangent, nettoient, essuient les pattes de Tofu, ferment les portes et lancent une friandise ou la balle pour l'attirer. Attention : en courant trop vite, on peut glisser sur l'eau ou bousculer un vase !
- Rien ne se perd pour de bon : un objet mangé ou cassé revient (par exemple, la boulangerie vend de nouveaux croissants), et tout désordre se nettoie.

Le fichier [GAME_DESIGN.md](GAME_DESIGN.md) détaille les règles, les points et la carte.

## 8. Dépannage

| Problème | Solution |
|---|---|
| « Le port 8080 est déjà utilisé » | Lancez `PORT=8081 npm run start` et utilisez les adresses affichées. |
| Écran noir ou message d'erreur 3D | Activez l'accélération matérielle (WebGL) dans le navigateur. Dans Firefox, `about:support` indique si WebGL fonctionne. |
| Le jeu saccade | **Réglages → Graphismes : Rapides** (la page se recharge). Fermez les autres onglets. |
| Pas de son | Touchez l'écran ou appuyez sur une touche : les navigateurs exigent un geste avant de jouer du son. Vérifiez **Réglages → Son**. |
| « Connexion perdue » sur un téléphone | Rapprochez-le de la box. Le jeu se reconnecte seul et rend la place au joueur. |
| « Build introuvable » | Lancez `npm run build` avant `npm run start`. |
| iPhone | Utilisez Safari. Le plein écran n'existe pas sur iPhone ; « Ajouter à l'écran d'accueil » donne un affichage plus grand. |

## 9. Pour les développeurs

| Commande | Rôle |
|---|---|
| `npm install` | installe les dépendances (versions figées dans `package-lock.json`) |
| `npm run dev` | serveur local + Vite avec rechargement automatique |
| `npm run build` | vérifie le TypeScript, construit le client (`dist/`) et le serveur (`dist-server/`) |
| `npm run start` | sert le jeu construit et le salon réseau (port 8080, variable `PORT`) |
| `npm test` | lance les tests : règles, monde, IA, instantanés réseau, serveur avec 3 clients |

Organisation du code :

```
src/shared/      logique pure, commune au navigateur et au serveur
  world/         données de la carte, collisions, navigation
  sim/           simulation à pas fixe (60 Hz), règles, chat, interactions
  ai/            IA de Tofu et des humains
  net/           protocole réseau et instantanés différentiels
src/client/      rendu Three.js, interface, sons, commandes, sessions locale et réseau
server/          serveur HTTP + WebSocket (salon, partie autoritative)
tests/           tests Vitest
```

Documents : [GAME_DESIGN.md](GAME_DESIGN.md) (règles, carte, équilibrage, extension), [CREDITS.md](CREDITS.md) (licences), [PROGRESS.md](PROGRESS.md) (journal), [NEXT_STEPS.md](NEXT_STEPS.md) (suite).

## Licences

Le code du jeu est sous licence MIT. Les bibliothèques et la police Fredoka gardent leurs licences libres ; voir [CREDITS.md](CREDITS.md). Tous les modèles 3D, textures, sons et musiques sont créés par le code du jeu lui-même ; aucun fichier graphique ou sonore tiers n'est utilisé.
