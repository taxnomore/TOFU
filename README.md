# 🐶 TOFU ! QUI A FAIT ÇA ?

Un jeu de fête en 3D pour toute la famille. Tofu, un labrador jaune, fait des bêtises ; les humains préparent une fête avant l'arrivée des invités. Un joueur incarne Tofu, un ou deux joueurs incarnent les humains. L'ordinateur peut tenir le rôle qui manque.

La fête a lieu au choix dans **quatre lieux** : la maison du quartier, l'école primaire, le centre commercial ou le parc.

Le jeu tourne dans le navigateur : sur un PC Linux (Firefox ou Chromium) et sur les téléphones Android ou iPhone reliés au même Wi-Fi. On peut aussi jouer par Internet avec de la famille qui habite ailleurs. Il ne demande ni compte, ni abonnement. Après l'installation, il n'a plus besoin d'Internet, sauf pour jouer à distance.

- [1. Installer le jeu sur un PC Linux](#1-installer-le-jeu-sur-un-pc-linux)
- [2. Lancer le jeu](#2-lancer-le-jeu)
- [3. Jouer seul](#3-jouer-seul)
- [4. Jouer à 2 ou 3 sur le même PC](#4-jouer-à-2-ou-3-sur-le-même-pc-écran-partagé)
- [5. Jouer avec des téléphones sur le Wi-Fi](#5-jouer-avec-des-téléphones-sur-le-wi-fi)
- [6. Jouer par Internet](#6-jouer-par-internet)
- [7. Commandes](#7-commandes)
- [8. Règles en bref](#8-règles-en-bref)
- [9. Dépannage](#9-dépannage)
- [10. Pour les développeurs](#10-pour-les-développeurs)

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

### Le plus simple : un double clic

Le fichier **`tofu-qui-a-fait-ca.html`** contient tout le jeu. Double-cliquez dessus : il s'ouvre dans le navigateur, sans installation et sans Internet. Il suffit pour jouer seul ou à plusieurs sur le même PC (écran partagé). Seul le jeu avec des téléphones (réseau local) demande le petit serveur décrit plus bas.

Ce fichier se trouve à la racine de l'archive .zip ; `npm run build` le crée aussi dans `dist/`. Les fichiers `index.html` ne s'ouvrent pas d'un double clic : ils servent au serveur. Ouverts par erreur, ils affichent un bouton « Ouvrir le jeu » qui mène au bon fichier.

Si le jeu ne peut pas démarrer, la page l'explique au lieu de rester blanche : 3D désactivée, fichier incomplet ou scripts bloqués. La section [Dépannage](#9-dépannage) reprend les solutions.

### Version téléchargée (.zip)

L'archive .zip contient le jeu déjà construit. Pour le réseau local, décompressez-la, ouvrez un terminal dans le dossier `tofu-qui-a-fait-ca`, puis passez directement à l'étape 2 (`npm run start`). Seul Node.js est nécessaire ; `npm install` et `npm run build` servent uniquement si vous modifiez le code.

### Installation depuis le code source

Le code source se trouve sur GitHub : <https://github.com/taxnomore/tofu>. Pour le récupérer, lancez `git clone https://github.com/taxnomore/tofu`, ou cliquez sur « Code » puis « Download ZIP » sur la page du dépôt.

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

Au premier lancement, passez par « Comment jouer » : l'écran résume les règles et toutes les touches. Des astuces apparaissent aussi pendant les premières parties ; on les coupe dans les **Réglages**.

## 3. Jouer seul

1. Cliquez sur **Jouer seul**.
2. Choisissez **Jouer Tofu** ou **Jouer un humain**.
3. Réglez la difficulté de l'ordinateur (Facile, Normal, Difficile), la durée (4, 6 ou 8 minutes), le **lieu** et l'**ambiance** (voir plus bas).
4. Cliquez sur **C'est parti !**

L'ordinateur joue l'autre camp pour de vrai : il ouvre les portes, vole du linge, nettoie, lance des friandises et vous poursuit. En humain, vous pouvez ajouter un coéquipier joué par l'ordinateur.

### Les lieux

| Lieu | La fête | Ce qui le rend différent |
|---|---|---|
| 🏡 Le quartier | les invités arrivent à la maison | une maison pleine de portes, un jardin, la rue, la boulangerie et le square ; le linge à rentrer, la table à mettre, le lit à faire |
| 🏫 L'école | la fête de l'école, les parents arrivent | une cour avec un préau, un long couloir, la classe, la bibliothèque, la cantine et un potager ; les objets trouvés, les fournitures, l'affiche du programme, le coin lecture |
| 🛍️ Le centre commercial | l'inauguration, le maire arrive | une galerie avec une fontaine (Tofu y trempe ses pattes), des boutiques ouvertes, un parking et une cour de livraison ; le ruban à tendre, les vêtements, le fond de caisse, les cartons |
| 🌳 Le parc | un pique-nique d'anniversaire | presque tout se passe dehors : le kiosque, l'aire de pique-nique, la buvette, la pataugeoire, la mare aux canards ; les cadeaux dans le coffre de la voiture, la nappe, les ballons |

Chaque lieu a ses propres tâches, cachettes, objets à renverser et pièges. Les défis secrets de Tofu s'adaptent au lieu, ainsi que le robot (aspirateur, robot laveur, robot de ménage, tondeuse) et le passant à qui aboyer (la factrice, le vigile, la joggeuse).

### Les ambiances

Chaque lieu existe en été, en automne et en hiver ; le quartier a aussi son jour de marché. Chaque ambiance change le décor et ajoute ses propres bêtises :

| Ambiance | Ce qui change |
|---|---|
| ☀️ Été | le décor habituel : fleurs à arroser, flaques de boue |
| 🍂 Automne | des feuilles partout ; Tofu éparpille les tas de feuilles et en rapporte dans la maison |
| ❄️ Hiver | de la neige partout ; les pattes de Tofu se mouillent dehors et laissent des traces dans la maison ; deux bonshommes de neige à démolir |
| 🧀 Jour de marché | trois étals sur le square : fromage, saucisson et poulet rôti à voler, cageot de pommes à renverser |

Chaque ambiance apporte aussi un défi secret pour Tofu. Le lieu et l'ambiance se choisissent dans l'écran de lancement (seul, écran partagé) ou dans le salon en réseau (par l'hôte).

## 4. Jouer à 2 ou 3 sur le même PC (écran partagé)

1. Branchez les manettes si vous en avez (facultatif).
2. Cliquez sur **Plusieurs joueurs sur ce PC**.
3. Chaque joueur appuie sur son bouton pour rejoindre :
   - **Espace** : clavier gauche (ZQSD sur un clavier AZERTY) ;
   - **Entrée** : clavier droit (flèches) ;
   - **A** : une manette (une par joueur).
4. Chaque joueur choisit son rôle avec **gauche / droite** et son personnage avec **haut / bas**. La souris marche aussi.
5. Lancez avec le bouton **Jouer**, ou la touche pause d'un joueur (**Échap**, **⌫** ou **Start** à l'origine).

L'écran se partage en 2 ou 3 vues. Chaque joueur a sa propre caméra et peut explorer une autre partie du quartier. À 3 joueurs, le quatrième quart de l'écran montre une vue d'ensemble.

Si un seul joueur rejoint, l'ordinateur joue les rôles manquants (réglage « Rôles manquants »).

## 5. Jouer avec des téléphones sur le Wi-Fi

1. **Sur le PC** : lancez `npm run start`, ouvrez `http://localhost:8080/` et cliquez sur **Réseau local**. Le PC devient l'hôte 👑. Le salon affiche un QR code et l'adresse du jeu.
2. **Sur chaque téléphone** : connectez-vous au même Wi-Fi que le PC. Scannez le QR code avec l'appareil photo, ou tapez l'adresse affichée (par exemple `http://192.168.1.42:8080/`). Touchez **Rejoindre la partie**.
3. Chacun écrit son prénom (ou touche 🎲 pour un prénom au hasard, pratique à la manette), choisit **Tofu**, **Humain** ou **Peu importe**, puis touche **Je suis prêt !**
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

## 6. Jouer par Internet

Les joueurs n'ont pas besoin d'habiter ensemble. Un seul PC fait tourner le serveur. Chaque famille crée son **salon** et envoie son lien aux autres ; le code du salon compte 5 lettres (par exemple `KZPTM`).

### Le plus simple : un lien public gratuit, sans compte

1. Installez le petit programme gratuit **cloudflared** (de Cloudflare) :
   - Windows : `winget install --id Cloudflare.cloudflared`
   - macOS : `brew install cloudflared`
   - Linux : le paquet `.deb` (Ubuntu, Debian) ou `.rpm` (Fedora) sur [la page des versions](https://github.com/cloudflare/cloudflared/releases/latest).
2. Dans le dossier du jeu : `npm run build` (une seule fois), puis `npm run internet`.
3. Le terminal affiche un lien public en `https://….trycloudflare.com`, avec un QR code. Ouvrez ce lien, choisissez **Jouer en ligne**, puis **Créer un salon**. Vous devenez l'hôte 👑.
4. Le salon montre son code, son lien, un QR code et les boutons **Copier le lien** et **Partager**. Envoyez le lien aux autres joueurs, par message ou par e-mail : ils l'ouvrent et touchent **Rejoindre le salon**. Ils peuvent aussi ouvrir le lien public, choisir **Jouer en ligne** et taper le code.

Bon à savoir :

- Le lien change à chaque lancement. Gardez le terminal ouvert ; `Ctrl+C` arrête le jeu et le lien.
- Les échanges passent par les serveurs de Cloudflare. Ce service gratuit sert surtout aux essais : Cloudflare ne garantit pas sa disponibilité, et ses conditions d'utilisation s'appliquent.
- Dans ce mode, seul le tunnel atteint le serveur : les appareils du réseau local passent eux aussi par le lien public.

### Avec votre propre serveur

Sur une machine joignable depuis Internet (serveur loué, ou PC dont la box redirige un port), lancez le jeu en mode Internet derrière un serveur web qui fournit le HTTPS. Exemple avec [Caddy](https://caddyserver.com/), qui obtient tout seul un certificat gratuit :

```bash
TOFU_MODE=internet HOST=127.0.0.1 TRUST_PROXY=1 PUBLIC_URL=https://tofu.example.org npm run start
```

```
# Caddyfile
tofu.example.org {
  reverse_proxy 127.0.0.1:8080
}
```

| Réglage | Rôle |
|---|---|
| `TOFU_MODE=internet` (ou `npm run start -- --internet`) | un salon avec code par famille, au lieu du salon unique de la maison |
| `PUBLIC_URL` | adresse publique du jeu, pour le lien et le QR code à partager |
| `TRUST_PROXY=1` | lit l'adresse des joueurs dans les en-têtes du serveur web (limites par adresse) |
| `HOST=127.0.0.1` | n'accepte que le serveur web de la même machine |
| `TOFU_MAX_ROOMS`, `TOFU_MAX_GAMES` | nombre maximal de salons (100) et de parties en même temps (40) |

Le jeu marche aussi sans HTTPS, en `http://` avec une redirection du port 8080 de la box, mais les échanges passent alors en clair.

### Sécurité

- Le code d'un salon compte 5 consonnes tirées au hasard, soit 3,2 millions de possibilités. Le serveur bloque une adresse qui essaie trop de codes faux.
- L'hôte peut **retirer** un joueur (deux appuis pour confirmer) : celui-ci ne revient pas dans ce salon avec la même page. Une fois la famille au complet, **Fermer le salon aux nouveaux joueurs** bloque toute nouvelle entrée ; les joueurs déjà venus peuvent recharger leur page.
- Le serveur limite les connexions par adresse (16), les salons créés (5 par adresse en 10 minutes), les salons (100) et les parties en même temps (40). Un salon vide disparaît après 2 minutes ; un salon sans partie se ferme après 30 minutes.
- Le serveur ne montre jamais aux joueurs les adresses du réseau de la maison. Une page d'un autre site ne peut pas s'y connecter.
- Comme sur le réseau local, le serveur reste l'arbitre : il vérifie chaque message et chaque action.

### Latence

Votre personnage répond tout de suite : le navigateur prévoit ses mouvements, puis le serveur confirme. Les autres joueurs apparaissent avec un léger retard, qui grandit un peu quand la connexion est irrégulière, pour rester fluide. Le salon affiche le temps d'aller-retour vers le serveur (📶) ; en partie, un bandeau prévient au-delà de 300 ms. Les tests simulent 140 ms d'aller-retour avec des à-coups de ± 60 ms.

## 7. Commandes

Les touches du clavier se changent dans **Réglages → Changer les touches**, les boutons de la manette dans **Réglages → Changer les boutons**. Les tableaux suivants montrent les réglages d'origine.

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

Pour changer un bouton, choisissez **Changer** en face de l'action, puis appuyez sur le nouveau bouton. Un bouton ne fait qu'une seule action. La croix directionnelle sert toujours à bouger. Dans les menus, A valide et B revient en arrière, quels que soient vos réglages.

### Téléphone ou tablette

- **Se déplacer** : posez le pouce gauche n'importe où sur la moitié gauche de l'écran ; un joystick apparaît.
- **Caméra** : glissez un doigt sur la partie droite de l'écran, en dehors des boutons.
- **Boutons** en bas à droite : ✋ **Action** (le plus gros), 💨 **Courir**, 🌀 **Zoomies** ou 🦴 **Friandise**, 🗯️ **Wouf** ou 📣 **Appeler**, 🐾 **Assis** (Tofu).
- **⏸** en haut à droite : pause.
- Jouez en mode paysage ; le jeu le rappelle si le téléphone est en portrait.

### Réglages de confort

Le menu **Réglages** propose aussi :

| Réglage | Effet |
|---|---|
| Taille du texte | Normale, Grande ou Très grande : tous les textes des menus et de l'écran de jeu grandissent. |
| Couleurs contrastées | Texte noir sur fond clair, bordures épaisses, sélection bien visible. |
| Secousses de l'écran | « Non » arrête les secousses de la caméra et les éléments qui tremblent. Si l'ordinateur demande moins d'animations, le jeu part sur « Non ». |
| Astuces en jeu | « Oui » ou « Non » ; « Revoir depuis le début » les fait toutes revenir. |
| Caméra auto | La caméra se replace derrière le personnage quand il avance. |

Le navigateur garde ces choix pour les parties suivantes.

## 8. Règles en bref

- Une manche dure 6 minutes (4 ou 8 au choix).
- **Les humains** reçoivent une liste de tâches propre au lieu : 3 tâches pour un humain, 6 pour deux. Exemples au quartier : rentrer le linge, ranger les jouets, mettre la table, servir le goûter, sortir la poubelle, relever le courrier, faire le lit, arroser les fleurs.
- **Les humains gagnent** quand toutes les tâches sont faites et que le lieu est propre à 70 % au moins. Les invités arrivent alors ; il faut tenir 15 secondes sans que Tofu défasse une tâche ni salisse sous le seuil.
- **Tofu gagne** quand sa barre de bêtises atteint son objectif, ou quand le temps s'écoule avant que les humains aient fini. L'objectif vaut 250 points contre un humain. Contre deux humains, il vaut 180 au quartier ; dans les autres lieux, plus vastes et plus faciles à tenir à deux, il vaut de 120 à 150 en été et 160 en automne ou en hiver. La barre du haut affiche toujours l'objectif.
- **Tofu** reçoit 3 **défis secrets** (+20 points chacun). Ses bêtises : voler du linge et le cacher, renverser des objets, poursuivre le chat, rapporter de la boue dans la maison, renverser les poubelles, manger le goûter, sauter sur le lit ou le canapé, creuser les massifs, tirer la nappe, dérouler le papier toilette, allumer l'aspirateur robot, voler l'arrosoir qui fuit, aboyer sur la factrice. Les bêtises variées remplissent les **zoomies** : un sprint fou qui renverse tout sur son passage.
- **Réactions en chaîne** : poursuivi dans la cuisine, le chat saute sur le plan de travail et fait tomber la tasse ou le pot de basilic ; l'aspirateur allumé par Tofu bouscule ce qu'il croise. Ces dégâts comptent entièrement pour Tofu. Une balle lancée par un humain peut aussi renverser un vase : c'est alors un accident humain.
- **Les humains** reprennent ce que Tofu porte dans sa gueule, rangent, nettoient, essuient les pattes de Tofu, ferment les portes et lancent une friandise ou la balle pour l'attirer. Attention : en courant trop vite, on peut glisser sur l'eau ou bousculer un vase !
- Rien ne se perd pour de bon : un objet mangé ou cassé revient (par exemple, la boulangerie vend de nouveaux croissants), et tout désordre se nettoie.

Le fichier [GAME_DESIGN.md](GAME_DESIGN.md) détaille les règles, les points et les quatre lieux.

## 9. Dépannage

| Problème | Solution |
|---|---|
| « Le port 8080 est déjà utilisé » | Lancez `PORT=8081 npm run start` et utilisez les adresses affichées. |
| « Votre navigateur n'affiche pas la 3D » | Le jeu demande WebGL 2. Firefox : ouvrez `about:config`, passez `webgl.force-enabled` à `true`, relancez. Chrome ou Chromium : Paramètres → Système → « Utiliser l'accélération graphique si disponible » ; sinon, mettez `chrome://flags/#ignore-gpu-blocklist` sur « Enabled ». Relancez le navigateur. |
| « Ce fichier ne s'ouvre pas d'un double clic » | Vous avez ouvert un `index.html`. Cliquez sur « Ouvrir le jeu » ou ouvrez `tofu-qui-a-fait-ca.html`. |
| « Le jeu n'a pas pu démarrer » | Vérifiez que `tofu-qui-a-fait-ca.html` pèse un peu plus de 1 Mo ; sinon, téléchargez-le à nouveau. Le « détail technique » en bas du message aide à trouver la cause. |
| « Chargement du jeu… » ne disparaît pas | Le navigateur bloque les scripts, souvent dans un aperçu (messagerie, stockage en ligne). Enregistrez le fichier, puis ouvrez-le d'un double clic. |
| Le jeu saccade | **Réglages → Graphismes : Rapides** (la page se recharge). Fermez les autres onglets. |
| Pas de son | Touchez l'écran ou appuyez sur une touche : les navigateurs exigent un geste avant de jouer du son. Vérifiez **Réglages → Son**. |
| « Connexion perdue » sur un téléphone | Rapprochez-le de la box. Le jeu se reconnecte seul et rend la place au joueur. |
| « Build introuvable » | Lancez `npm run build` avant `npm run start`. |
| « Il manque le programme gratuit cloudflared » | Installez-le (section [Jouer par Internet](#6-jouer-par-internet)), puis relancez `npm run internet`. |
| « Ce salon n'existe pas, ou plus » | Vérifiez le code. Les salons disparaissent quand le serveur s'arrête : l'hôte en crée un nouveau et renvoie le lien. |
| « L'hôte a fermé ce salon aux nouveaux joueurs » | Demandez à l'hôte de toucher **Rouvrir le salon aux nouveaux joueurs**. |
| « Connexion lente » pendant une partie par Internet | Rapprochez-vous de la box ou passez en Wi-Fi plutôt qu'en 4G. Les actions arrivent en retard, mais la partie continue. |
| iPhone | Utilisez Safari. Le plein écran n'existe pas sur iPhone ; « Ajouter à l'écran d'accueil » donne un affichage plus grand. |

## 10. Pour les développeurs

| Commande | Rôle |
|---|---|
| `npm install` | installe les dépendances (versions figées dans `package-lock.json`) |
| `npm run dev` | serveur local + Vite avec rechargement automatique |
| `npm run build` | vérifie le TypeScript, construit le client (`dist/`) et le serveur (`dist-server/`) |
| `npm run start` | sert le jeu construit et le salon réseau (port 8080, variable `PORT`) ; `-- --internet` pour les salons avec code |
| `npm run internet` | jeu par Internet : serveur en mode Internet + lien public Cloudflare (voir section 6) |
| `npm test` | lance les tests : règles, chaque lieu et chaque ambiance (accès, tâches faisables, chemins du chat), IA, instantanés réseau, serveur avec 3 clients, salons par Internet, latence simulée |
| `node scripts/smoke-test.mjs` | test dans un vrai navigateur (facultatif) : parcours au clavier de la chambre au square, commandes tactiles. Il demande Playwright : `npm install --no-save playwright && npx playwright install chromium`, et un jeu lancé avec `npm run start`. |

Organisation du code :

```
src/shared/      logique pure, commune au navigateur et au serveur
  world/         types de carte, collisions, navigation
    maps/        les quatre lieux (une carte = un fichier de données)
  sim/           simulation à pas fixe (60 Hz), règles, chat, interactions
  ai/            IA de Tofu et des humains
  net/           protocole réseau et instantanés différentiels
src/client/      rendu Three.js, interface, sons, commandes, sessions locale et réseau
server/          serveur HTTP + WebSocket (salons, limites, partie autoritative)
tests/           tests Vitest
```

Documents : [GAME_DESIGN.md](GAME_DESIGN.md) (règles, carte, équilibrage, extension), [CREDITS.md](CREDITS.md) (licences), [PROGRESS.md](PROGRESS.md) (journal), [NEXT_STEPS.md](NEXT_STEPS.md) (suite).

## Licences

Le code du jeu est sous licence MIT. Les bibliothèques et la police Fredoka gardent leurs licences libres ; voir [CREDITS.md](CREDITS.md). Tous les modèles 3D, textures, sons et musiques sont créés par le code du jeu lui-même ; aucun fichier graphique ou sonore tiers n'est utilisé.
