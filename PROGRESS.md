# Journal de progression

Ce journal dit ce qui fonctionne, comment je l'ai vérifié et ce qui reste à vérifier. Les pistes de suite sont dans [NEXT_STEPS.md](NEXT_STEPS.md).

## État

Le jeu est jouable de bout en bout : solo contre l'ordinateur dans les deux rôles, écran partagé à 2 ou 3 joueurs sur un PC, réseau local avec téléphones et PC mélangés, et jeu par Internet avec des salons à code. Les six jalons du cahier des charges sont faits, ainsi que cinq améliorations : plus de bêtises, un ordinateur plus malin, des réglages de confort, le jeu par Internet et trois nouveaux lieux (l'école primaire, le centre commercial et le parc), en plus du quartier. Aucun élément de jeu affiché n'est un simple bouche-trou : tous les modèles sont construits en code, mais les maisons voisines n'ont qu'une façade (comme prévu par le cahier des charges).

## Jalons et commits

| Jalon | Contenu | Commit |
|---|---|---|
| M1 | projet Vite + TypeScript + Three.js, carte en données, collisions, navigation, simulation à pas fixe | `0c89a39` |
| M2, M3 | rendu 3D (maison, jardin, quartier), personnages animés, objets, portes et portails, commandes clavier, manette et tactile, cinq systèmes de bêtises, nettoyage, tâches, défis, interface, minicarte, tutoriel, sons, fins de partie | `c8a61ef` |
| M4 | IA de Tofu et des humains (navigation, portes, blocages, objectifs), équilibrage, protection des objets rangés | `78b4359` |
| M5 | serveur réseau autoritatif, salon avec QR code, synchronisation, prédiction, reconnexion, revanche ; corrections de l'écran partagé | `6d6fc1d` |
| M6 | remappage du clavier, disposition tactile, papier toilette, aspirateur robot, bruits de pas, priorité des portes, appuis brefs, équilibrage, documentation | `03e18b3`, `7bb1fa7`, `e03106e` |
| Après M6 | serveur autonome (Node seul), fichier HTML unique qui s'ouvre d'un double clic, écran de chargement qui explique un échec au lieu d'une page blanche | `cea65c3`, `522cd0f`, `58aad87` |
| Amélioration 1 | plus de bêtises : réactions en chaîne, arrosoir qui fuit, quatre ambiances (été, automne, hiver, jour de marché) | `37937d9` |
| Amélioration 2 | ordinateur plus malin : aspirateur robot, pattes essuyées à la porte, coéquipier qui laisse sa part au joueur, recoins accessibles | `ba1f92d` |
| Amélioration 3 | confort : boutons de manette, taille du texte, couleurs contrastées, secousses, astuces, prénom au hasard | `f991a74` |
| Amélioration 4 | jeu par Internet : salons à code, limites contre les abus, outils de l'hôte, délai d'affichage adaptatif, lien public Cloudflare | `c23f31a` et suivants |
| Amélioration 5 | plusieurs lieux : le monde, les tâches et l'affichage viennent des données de la carte, puis l'école, le centre commercial et le parc ; choix du lieu dans les menus et le salon en ligne, objectif de bêtises propre à chaque lieu | `60bb05f`, `3212f7d`, `828a9cc`, `3dea816` et suivants |

## Commandes vérifiées

Depuis un clone neuf de la branche `ameliorations` (Node 22.22, npm 10.9, Linux) :

| Commande | Résultat |
|---|---|
| `npm install` | 51 paquets installés, sans erreur |
| `npm run build` | vérification TypeScript, client (`dist/`) et serveur (`dist-server/`) construits en 8 secondes |
| `npm test` | 168 tests réussis sur 168 (88 avant les nouveaux lieux) |
| `npm run dev` | bannière avec l'adresse locale et l'adresse Wi-Fi, page servie (HTTP 200), salon WebSocket qui répond |
| `npm run start` | page et fichiers servis (HTTP 200), routes inconnues renvoyées vers la page, accès hors de `dist/` refusé (403) |
| `npm audit` | 0 vulnérabilité |
| `npm run internet` | avec un faux `cloudflared` qui imite le vrai : lien public lu, serveur lancé en mode Internet et joignable seulement depuis le PC, QR code dans le terminal, tout s'arrête avec `Ctrl+C` ; sans `cloudflared` : message d'installation pour Windows, macOS et Linux |

## Tests automatiques (Vitest)

| Fichier | Tests | Ce qui est vérifié |
|---|---|---|
| `tests/world.test.ts` | 95 | pour chaque lieu : identifiants uniques, références valides, une cachette pour Tofu et un bocal de friandises, chaque tâche faisable (objets présents, emplacement qui les accepte), graphe du chat connexe ; pour chaque lieu et chaque ambiance : apparitions, base du robot, indices de l'ordinateur et flaques sur un sol libre, toutes les zones atteignables, emplacements et objets atteignables, objets posés hors des meubles, portes dans leurs ouvertures, chemins du chat libres ; au quartier : chemin chambre → square et boulangerie, portes, chatière, trou de la haie réservé à Tofu |
| `tests/mapsAI.test.ts` | 13 | ordinateur contre ordinateur dans chaque lieu et chaque ambiance : pas d'erreur, des bêtises et des tâches faites |
| `tests/mapsNet.test.ts` | 1 | partie en réseau au parc : le lieu et l'ambiance choisis par l'hôte arrivent chez chaque joueur, qui construit le même parc ; l'ordinateur y joue Tofu |
| `tests/rules.test.ts` | 19 | vol et retour du linge, reprise dans la gueule de Tofu, linge de l'étendoir, boue et nettoyage, pattes essuyées, plante renversée puis remise, poubelle de rue, chat, zoomies, friandise, endurance, papier toilette, aspirateur robot, priorité des portes, victoires de Tofu (bêtises, temps) et des humains, revanche identique à graine égale |
| `tests/ai.test.ts` | 7 | manches complètes ordinateur contre ordinateur (1 et 2 humains, et dans chaque ambiance), bêtises variées de l'IA, aspirateur éteint par l'humain quand Tofu l'a allumé, coéquipier qui laisse au joueur le désordre dont il s'occupe, désordre tombé dans le recoin derrière le fauteuil toujours nettoyable |
| `tests/net.test.ts` | 3 | instantanés différentiels : l'état reconstruit chez le client égale celui du serveur pendant une manche complète ; validation des messages ; prédiction identique au serveur |
| `tests/mischief.test.ts` | 16 | arrosoir qui fuit (gouttes, glissade, remplissage), réactions en chaîne (chat sur le plan de travail, balle, aspirateur), automne (tas de feuilles, feuilles dans la maison, ratissage), hiver (pattes mouillées, rue déneigée, bonhomme de neige), jour de marché (étals, vol, repas, retour au bon étal, cageot), défis propres à chaque ambiance, objets absents hors de leur ambiance |
| `tests/rooms.test.ts` | 7 | jeu par Internet : codes de salon (saisie nettoyée, ni voyelles ni chiffres), deux familles dans deux salons, code inconnu ou absent, limite de parties, retrait d'un joueur et retour refusé, salon fermé aux nouveaux mais ouvert aux joueurs déjà venus, limites par adresse (connexions, salons créés, codes faux, y compris derrière un tunnel), salons vides et inactifs supprimés, page d'un autre site refusée, salon unique à la maison |
| `tests/latency.test.ts` | 1 | vrai code du navigateur (connexion, prédiction) à travers un relais qui retarde chaque message de 70 ms ± 30 ms : le personnage répond avant que le serveur le sache, finit au même endroit que sur le serveur (écart < 5 cm), corrections < 25 cm, un aboiement appuyé une seule image arrive au serveur et à l'autre joueur, délai d'affichage allongé pour le lien irrégulier |
| `tests/comfort.test.ts` | 4 | remappage de la manette : un bouton par action, croix réservée au déplacement, lecture des nouveaux boutons en jeu (pause comprise), sauvegarde dans le navigateur, sauvegarde abîmée ignorée, noms des boutons |
| `tests/server.test.ts` | 2 | vrai serveur HTTP + WebSocket avec 3 clients : salon, rôles, droits de l'hôte, choix du lieu (lieu inconnu refusé, ambiance absente du lieu remplacée par l'été), départ, déplacements identiques chez tous, accusés de réception, entrées refusées pour un siège d'un autre, déconnexion reprise par l'ordinateur, reconnexion, fin, revanche avec rotation de Tofu, retour au salon, spectateurs, client trop bavard coupé, message trop gros refusé |

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
| Remappage de la manette, avec la manette seule (simulée) : croix pour choisir la ligne, A pour « Changer », puis le nouveau bouton, B pour revenir | bouton changé, conflit retiré, croix qui annule, retour aux réglages sans clic parasite, aide « Comment jouer » à jour, réglage gardé |
| Réglages de confort : taille du texte, couleurs contrastées, astuces coupées, gardés après rechargement ; écran de jeu à 1280 × 720 et 740 × 360, seul et en écran partagé, avec le texte le plus grand | réussi, sans erreur dans la console ; sur petit écran, les jauges du haut gardent leur seule icône pour ne pas déborder |
| Salon réseau : bouton 🎲 | prénom changé et transmis au serveur |
| Jeu par Internet, jeu construit (`npm run start -- --internet`), trois navigateurs : création d'un salon, lien public et QR code, copie du lien, temps d'aller-retour, lien ouvert par un invité, code faux, saisie qui n'est pas un code, retrait d'un visiteur (deux appuis), salon fermé aux nouveaux, partie lancée, invité qui recharge sa page en pleine partie | 18 vérifications sur 18, sans erreur dans la console ; l'invité reprend son personnage |
| Réseau local après ces changements : salon, prénom au hasard, parcours au clavier, commandes tactiles | réussi |
| Fichier unique `tofu-qui-a-fait-ca.html` ouvert depuis le disque (file://), seul dans un dossier | menus, solo et écran partagé fonctionnent, sans aucune autre requête |
| Ambiances dans le navigateur : écran de lancement avec le choix d'ambiance, décor de chaque ambiance, tas de feuilles éparpillé puis feuilles dans le salon, bonhomme de neige démoli puis traces mouillées, arrosoir volé qui goutte (repris par l'humain ordinateur), fromage volé sur un étal | réussi, sans erreur dans la console |
| Écran de chargement dans 10 situations : normale, 3D coupée (`--disable-3d-apis`), fichier tronqué à 500 Ko, `index.html` du code source et de `dist/` ouverts d'un double clic, scripts bloqués par une politique de sécurité, JavaScript coupé, page dans une iframe isolée (comme un aperçu), rendu qui ne démarre pas, version servie par `npm run start` | jamais de page blanche : le jeu démarre, ou un message dit pourquoi et quoi faire ; le bouton « Ouvrir le jeu » mène au fichier unique, qui démarre ; le jeu tourne aussi dans l'iframe isolée |

| Nouveaux lieux : partie solo dans chacun, vues de chaque pièce et de chaque coin (classe, bibliothèque, cantine, préau, potager, rue ; galerie, boutiques, café, supermarché, parking, cour de livraison ; pique-nique, kiosque, buvette, pataugeoire, mare), automne et hiver | réussi, sans erreur dans la console ; le quartier reste identique après la refonte |
| Écran « Jouer seul » : choix du lieu, ambiances proposées selon le lieu (le jour de marché n'existe qu'au quartier), décor du menu qui suit le lieu, choix gardé après rechargement | réussi |

Le script `scripts/smoke-test.mjs` reprend le parcours et les commandes tactiles ; il passe contre `npm run start`.

## Équilibrage mesuré

Ordinateur contre ordinateur, manches de 6 minutes, même niveau pour les deux camps. Le détail par ambiance est dans [GAME_DESIGN.md](GAME_DESIGN.md), section 10.

| Niveau | Tofu contre 1 humain | Tofu contre 2 humains |
|---|---|---|
| Facile (été) | 9 victoires sur 50 | 11 victoires sur 50 |
| Normal (moyenne des 4 ambiances) | 198 victoires sur 400 | 225 victoires sur 400 |
| Difficile (été) | 46 victoires sur 50 | 44 victoires sur 50 |

Par lieu (Normal, été, 40 manches par case) :

| Lieu | Tofu contre 1 humain | Tofu contre 2 humains |
|---|---|---|
| Quartier | 26 sur 40 | 26 sur 40 |
| École | 17 sur 40 | 21 sur 40 |
| Centre commercial | 27 sur 40 | 21 sur 40 |
| Parc | 24 sur 40 | 16 sur 40 |

Sans réglage, deux humains de l'ordinateur gagnaient presque toujours dans les nouveaux lieux (Tofu : 2 sur 20 à l'école). Les nouveaux lieux ont donc leur objectif de bêtises contre deux humains, plus bas en été qu'en automne et en hiver.

Sur 60 manches (Normal, un humain), Tofu allume maintenant l'aspirateur 107 fois, dans 44 manches (4 fois avant) ; les humains l'éteignent 73 fois et l'allument 3 fois pour aspirer la boue.

## Corrections notables pendant les vérifications

- En écran partagé, rejoindre avec Espace ou Entrée ne marchait pas : la lecture des touches arrivait après leur effacement. Corrigé et vérifié.
- Un appui bref sur Action, compris entre deux images, se perdait (porte qui ne s'ouvrait pas sur un appareil lent). Les appuis clavier et tactiles sont maintenant retenus jusqu'à l'image suivante.
- Collé à une porte fermée, l'humain voyait « Ramasser la terre » au lieu d'« Ouvrir la porte ». La porte passe désormais en premier quand on la regarde.
- Sur téléphone, les boutons tactiles couvraient l'écran de fin, la barre d'endurance chevauchait la liste des tâches et la zone libre pour tourner la caméra était trop petite. Mise en page revue.
- La fin de la protection d'un objet n'était pas transmise en réseau. Corrigé ; le test d'instantanés le vérifie.
- Le serveur de fichiers acceptait le dossier voisin `dist-server/`. Corrigé.
- L'écran « Comment jouer » annonçait 100 points de bêtises au lieu de la vraie valeur.
- L'humain ordinateur pouvait s'acharner toute une manche sur un désordre tombé dans le recoin derrière le fauteuil du salon (la recherche de chemin visait une case isolée). Il vise désormais la case accessible la plus proche ; un objet qui atterrit dans un recoin est déplacé vers la zone principale.
- Le salon réseau comparait son contenu avec celui que le navigateur réécrit (`data-lock=""` au lieu de `data-lock`) : il reconstruisait la liste des joueurs à chaque mise à jour, et un clic pouvait se perdre. Il compare maintenant avec le dernier contenu écrit. Le test dans le navigateur l'a révélé.
- Le serveur de développement (Vite) refusait les noms d'hôte publics d'un tunnel. Il accepte maintenant celui de `PUBLIC_URL`.
- Le test de latence échouait une fois sur vingt sous forte charge. Deux causes, toutes deux dans le test : le relais de test pouvait inverser deux messages (une vraie connexion garde l'ordre), et un coup de patte du chat étourdit parfois Tofu juste avant l'aboiement. Le relais garde l'ordre ; le test aboie loin du chat et vérifie d'abord que l'appui arrive bien au serveur.
- Page blanche signalée dans Firefox et Chromium à l'ouverture du jeu. Je n'ai pas accès à l'ordinateur concerné ; j'ai trouvé deux causes possibles. L'archive contient des fichiers `index.html` qui restent blancs d'un double clic, et le jeu restait blanc quand le navigateur n'offre pas WebGL 2. Un écran de chargement s'affiche maintenant avant le jeu ; en cas d'échec, il donne la cause et la marche à suivre. Le jeu choisit aussi les graphismes « Rapides » quand la 3D passe par le processeur (rendu logiciel).

- Nouveaux lieux : la porte des toilettes de l'école (1 m de large) tombait entre deux cases de la grille de navigation et restait infranchissable ; le test des zones atteignables l'a trouvé. Elle mesure maintenant 1,1 m.
- Nouveaux lieux : deux cartes avaient une tâche « poubelle » ; le second lieu écrasait la tâche du premier. Les tâches des nouveaux lieux portent maintenant le nom du lieu en préfixe.
- Parc : avec la table des cadeaux et le sac de plage ouverts à Tofu, il défaisait les tâches sans fin (Tofu gagnait 15 manches sur 16). La table et le sac se ferment maintenant à lui ; il garde la nappe, les ballons, le gâteau et les massifs.

## Limites connues

- **Pas d'essai sur de vrais appareils** : ni iPhone, ni Android, ni Firefox, ni carte graphique réelle. Le rendu logiciel des tests tourne à 3 à 10 images par seconde ; il ne dit rien des objectifs de 60 images par seconde sur PC et 30 sur téléphone.
- **Manettes** : seule une manette simulée a servi aux essais, en disposition standard. Une manette non standard peut nommer ses boutons autrement ; le remappage aide alors à s'y retrouver.
- **Sons** : générés par le code ; l'environnement de test n'a pas de haut-parleur, je n'ai donc pas pu les écouter. Le code des sons s'exécute sans erreur.
- **IA** : les mesures d'équilibre opposent l'ordinateur à lui-même ; contre de vrais joueurs, le bon niveau reste à trouver en famille.
- **Nouveaux lieux** : jamais joués par de vraies personnes. Leurs objectifs de bêtises viennent des parties ordinateur contre ordinateur. Le défi « baguette » n'existe qu'au quartier et à l'école (ailleurs, rapporter la baguette ne voudrait rien dire).
- **Internet** : vérifié avec un faux tunnel et une latence simulée. Le vrai tunnel Cloudflare, de vrais réseaux mobiles et une partie entre deux maisons restent à essayer. Les salons vivent en mémoire : un redémarrage du serveur les efface. Sur le réseau local, le jeu reste en HTTP.
- **WebGL 2 obligatoire** : sans lui, le jeu ne peut pas tourner. La page l'explique et donne les réglages à essayer.
- **Taille** : le fichier JavaScript du jeu pèse 1 020 ko (300 ko compressé) avec les quatre lieux ; le premier chargement sur téléphone peut prendre quelques secondes.
