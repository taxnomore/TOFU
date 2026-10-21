# Journal de progression

Ce journal dit ce qui fonctionne, comment je l'ai vérifié et ce qui reste à vérifier. Les pistes de suite sont dans [NEXT_STEPS.md](NEXT_STEPS.md).

## État

Le jeu est jouable de bout en bout : solo contre l'ordinateur dans les deux rôles, écran partagé à 2 ou 3 joueurs sur un PC, réseau local avec téléphones et PC mélangés. Les six jalons du cahier des charges sont faits. Aucun élément de jeu affiché n'est un simple bouche-trou : tous les modèles sont construits en code, mais les maisons voisines n'ont qu'une façade (comme prévu par le cahier des charges).

## Jalons et commits

| Jalon | Contenu | Commit |
|---|---|---|
| M1 | projet Vite + TypeScript + Three.js, carte en données, collisions, navigation, simulation à pas fixe | `0c89a39` |
| M2, M3 | rendu 3D (maison, jardin, quartier), personnages animés, objets, portes et portails, commandes clavier, manette et tactile, cinq systèmes de bêtises, nettoyage, tâches, défis, interface, minicarte, tutoriel, sons, fins de partie | `c8a61ef` |
| M4 | IA de Tofu et des humains (navigation, portes, blocages, objectifs), équilibrage, protection des objets rangés | `78b4359` |
| M5 | serveur réseau autoritatif, salon avec QR code, synchronisation, prédiction, reconnexion, revanche ; corrections de l'écran partagé | `6d6fc1d` |
| M6 | remappage du clavier, disposition tactile, papier toilette, aspirateur robot, bruits de pas, priorité des portes, appuis brefs, équilibrage, documentation | `03e18b3`, `7bb1fa7`, `e03106e` |
| Après M6 | serveur autonome (Node seul), fichier HTML unique qui s'ouvre d'un double clic, écran de chargement qui explique un échec au lieu d'une page blanche | `cea65c3`, `522cd0f`, `58aad87` |

## Commandes vérifiées

Depuis un clone neuf du dépôt (Node 22.22, npm 10.9, Linux) :

| Commande | Résultat |
|---|---|
| `npm install` | 69 paquets installés, sans erreur |
| `npm run build` | vérification TypeScript, client (`dist/`) et serveur (`dist-server/`) construits en 8 secondes |
| `npm test` | 40 tests réussis sur 40 |
| `npm run dev` | bannière avec l'adresse locale et l'adresse Wi-Fi, page servie (HTTP 200), salon WebSocket qui répond |
| `npm run start` | page et fichiers servis (HTTP 200), routes inconnues renvoyées vers la page, accès hors de `dist/` refusé (403) |
| `npm audit` | 0 vulnérabilité (après passage à Vitest 5.0.5) |

## Tests automatiques (Vitest)

| Fichier | Tests | Ce qui est vérifié |
|---|---|---|
| `tests/world.test.ts` | 29 | carte : apparitions libres, toutes les zones, emplacements et objets atteignables, chemin chambre → square et boulangerie, portes, chatière, trou de la haie réservé à Tofu, graphe du chat sans obstacle ; pour chacune des 4 ambiances : apparitions libres, objets et emplacements atteignables, objets posés hors des meubles, chemins du chat libres |
| `tests/rules.test.ts` | 19 | vol et retour du linge, reprise dans la gueule de Tofu, linge de l'étendoir, boue et nettoyage, pattes essuyées, plante renversée puis remise, poubelle de rue, chat, zoomies, friandise, endurance, papier toilette, aspirateur robot, priorité des portes, victoires de Tofu (bêtises, temps) et des humains, revanche identique à graine égale |
| `tests/ai.test.ts` | 3 | manches complètes ordinateur contre ordinateur (1 et 2 humains), bêtises variées de l'IA |
| `tests/net.test.ts` | 3 | instantanés différentiels : l'état reconstruit chez le client égale celui du serveur pendant une manche complète ; validation des messages ; prédiction identique au serveur |
| `tests/mischief.test.ts` | 16 | arrosoir qui fuit (gouttes, glissade, remplissage), réactions en chaîne (chat sur le plan de travail, balle, aspirateur), automne (tas de feuilles, feuilles dans la maison, ratissage), hiver (pattes mouillées, rue déneigée, bonhomme de neige), jour de marché (étals, vol, repas, retour au bon étal, cageot), défis propres à chaque ambiance, objets absents hors de leur ambiance |
| `tests/server.test.ts` | 2 | vrai serveur HTTP + WebSocket avec 3 clients : salon, rôles, droits de l'hôte, départ, déplacements identiques chez tous, accusés de réception, entrées refusées pour un siège d'un autre, déconnexion reprise par l'ordinateur, reconnexion, fin, revanche avec rotation de Tofu, retour au salon, spectateurs, client trop bavard coupé, message trop gros refusé |

## Tests dans un navigateur

Outil : Chromium sans écran piloté par Playwright, rendu 3D logiciel (SwiftShader). Les téléphones sont émulés (écran 844 × 390, événements tactiles). Les entrées passent par le vrai clavier, les vrais événements tactiles et une manette simulée.

| Scénario | Résultat |
|---|---|
| Parcours au clavier en solo : chambre, entrée, porte du jardin ouverte avec Espace, jardin, portillon ouvert, allée, portail, trottoir, rue, square | réussi en 34 secondes de jeu, sans chargement |
| Deux joueurs sur un clavier : Tofu vole une chaussette dans la commode, la porte au jardin, la lâche ; l'humain la ramasse et la range dans le panier à linge ; Tofu se roule dans la flaque et laisse 29 empreintes dans le salon ; l'humain essuie (propreté de 82 % à 87 %) ; Tofu renverse le vase ; l'humain éponge et le vase revient ; Tofu poursuit le chat | 11 vérifications sur 11, en une seule passe ; l'interface affiche les mêmes valeurs que l'état du jeu |
| Victoire des humains (tâches terminées par le script), écran de fin, revanche | bannière « Les humains ont gagné », raison affichée, revanche remise à zéro (temps, bêtises, tâches, désordres) |
| Réseau local : 2 PC et 1 téléphone (adresse Wi-Fi), salon, rôles, « prêt », départ, déplacements au clavier et au joystick, fin, revanche avec rotation de Tofu, départ d'un joueur, retour au salon | positions identiques sur les 3 écrans et sur le serveur ; l'ordinateur reprend le joueur parti |
| Cas mixte : 2 joueurs en écran partagé sur le PC hôte + 1 téléphone | réussi ; prénoms en double numérotés (« Léa 2 ») |
| Écran partagé à 3 (clavier gauche, clavier droit, manette simulée) | 3 vues indépendantes et une vue d'ensemble |
| Téléphone : joystick, bouton Action, rotation de caméra par glissement, écran de fin, carte de rôle | réussi après corrections de mise en page |
| Remappage du clavier | touche changée, conflit retiré, réglage gardé après rechargement, retour aux touches d'origine |
| Fichier unique `tofu-qui-a-fait-ca.html` ouvert depuis le disque (file://), seul dans un dossier | menus, solo et écran partagé fonctionnent, sans aucune autre requête |
| Ambiances dans le navigateur : écran de lancement avec le choix d'ambiance, décor de chaque ambiance, tas de feuilles éparpillé puis feuilles dans le salon, bonhomme de neige démoli puis traces mouillées, arrosoir volé qui goutte (repris par l'humain ordinateur), fromage volé sur un étal | réussi, sans erreur dans la console |
| Écran de chargement dans 10 situations : normale, 3D coupée (`--disable-3d-apis`), fichier tronqué à 500 Ko, `index.html` du code source et de `dist/` ouverts d'un double clic, scripts bloqués par une politique de sécurité, JavaScript coupé, page dans une iframe isolée (comme un aperçu), rendu qui ne démarre pas, version servie par `npm run start` | jamais de page blanche : le jeu démarre, ou un message dit pourquoi et quoi faire ; le bouton « Ouvrir le jeu » mène au fichier unique, qui démarre ; le jeu tourne aussi dans l'iframe isolée |

Le script `scripts/smoke-test.mjs` reprend le parcours et les commandes tactiles ; il passe contre `npm run start`.

## Équilibrage mesuré

Ordinateur contre ordinateur, manches de 6 minutes, même niveau pour les deux camps :

| Niveau | Tofu contre 1 humain | Tofu contre 2 humains |
|---|---|---|
| Facile | 3 victoires sur 30 | 7 victoires sur 30 |
| Normal | 30 victoires sur 60 | 33 victoires sur 60 |
| Difficile | 28 victoires sur 30 | 24 victoires sur 30 |

## Corrections notables pendant les vérifications

- En écran partagé, rejoindre avec Espace ou Entrée ne marchait pas : la lecture des touches arrivait après leur effacement. Corrigé et vérifié.
- Un appui bref sur Action, compris entre deux images, se perdait (porte qui ne s'ouvrait pas sur un appareil lent). Les appuis clavier et tactiles sont maintenant retenus jusqu'à l'image suivante.
- Collé à une porte fermée, l'humain voyait « Ramasser la terre » au lieu d'« Ouvrir la porte ». La porte passe désormais en premier quand on la regarde.
- Sur téléphone, les boutons tactiles couvraient l'écran de fin, la barre d'endurance chevauchait la liste des tâches et la zone libre pour tourner la caméra était trop petite. Mise en page revue.
- La fin de la protection d'un objet n'était pas transmise en réseau. Corrigé ; le test d'instantanés le vérifie.
- Le serveur de fichiers acceptait le dossier voisin `dist-server/`. Corrigé.
- L'écran « Comment jouer » annonçait 100 points de bêtises au lieu de la vraie valeur.
- Page blanche signalée dans Firefox et Chromium à l'ouverture du jeu. Je n'ai pas accès à l'ordinateur concerné ; j'ai trouvé deux causes possibles. L'archive contient des fichiers `index.html` qui restent blancs d'un double clic, et le jeu restait blanc quand le navigateur n'offre pas WebGL 2. Un écran de chargement s'affiche maintenant avant le jeu ; en cas d'échec, il donne la cause et la marche à suivre. Le jeu choisit aussi les graphismes « Rapides » quand la 3D passe par le processeur (rendu logiciel).

## Limites connues

- **Pas d'essai sur de vrais appareils** : ni iPhone, ni Android, ni Firefox, ni carte graphique réelle. Le rendu logiciel des tests tourne à 3 à 10 images par seconde ; il ne dit rien des objectifs de 60 images par seconde sur PC et 30 sur téléphone.
- **Manettes** : testées seulement avec une manette simulée. Les boutons de manette ne se remappent pas.
- **Sons** : générés par le code ; l'environnement de test n'a pas de haut-parleur, je n'ai donc pas pu les écouter. Le code des sons s'exécute sans erreur.
- **IA** : l'ordinateur allume rarement l'aspirateur robot (4 manches sur 60 contre un humain) et ne l'éteint jamais lui-même ; l'aspirateur s'arrête seul au bout de 25 secondes.
- **Réseau** : réseau local seulement, en HTTP, un salon par serveur.
- **WebGL 2 obligatoire** : sans lui, le jeu ne peut pas tourner. La page l'explique et donne les réglages à essayer.
- **Taille** : le fichier JavaScript du jeu pèse 870 ko (250 ko compressé) ; le premier chargement sur téléphone peut prendre quelques secondes.
