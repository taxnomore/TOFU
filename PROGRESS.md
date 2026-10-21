# Journal de progression

Ce journal dit ce qui fonctionne, comment je l'ai vérifié et ce qui reste à vérifier. Les pistes de suite sont dans [NEXT_STEPS.md](NEXT_STEPS.md).

## État

Le jeu est jouable de bout en bout : solo contre l'ordinateur dans les deux rôles, écran partagé à 2 ou 3 joueurs sur un PC, réseau local avec téléphones et PC mélangés. Les six jalons du cahier des charges sont faits. Aucun élément de jeu affiché n'est un simple bouche-trou : tous les modèles sont construits en code, mais les maisons voisines n'ont qu'une façade (comme prévu par le cahier des charges).

## Jalons et commits

| Jalon | Contenu | Commit |
|---|---|---|
| M1 | projet Vite + TypeScript + Three.js, carte en données, collisions, navigation, simulation à pas fixe | `754c474` |
| M2, M3 | rendu 3D (maison, jardin, quartier), personnages animés, objets, portes et portails, commandes clavier, manette et tactile, cinq systèmes de bêtises, nettoyage, tâches, défis, interface, minicarte, tutoriel, sons, fins de partie | `2968d09` |
| M4 | IA de Tofu et des humains (navigation, portes, blocages, objectifs), équilibrage, protection des objets rangés | `beac4c6` |
| M5 | serveur réseau autoritatif, salon avec QR code, synchronisation, prédiction, reconnexion, revanche ; corrections de l'écran partagé | `18aca06` |
| M6 | remappage du clavier, disposition tactile, papier toilette, aspirateur robot, bruits de pas, priorité des portes, appuis brefs, équilibrage, documentation | `56970ec`, `0cb8b22` et le commit final |

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
| `tests/world.test.ts` | 13 | carte : apparitions libres, toutes les zones, emplacements et objets atteignables, chemin chambre → square et boulangerie, portes, chatière, trou de la haie réservé à Tofu, graphe du chat sans obstacle |
| `tests/rules.test.ts` | 19 | vol et retour du linge, reprise dans la gueule de Tofu, linge de l'étendoir, boue et nettoyage, pattes essuyées, plante renversée puis remise, poubelle de rue, chat, zoomies, friandise, endurance, papier toilette, aspirateur robot, priorité des portes, victoires de Tofu (bêtises, temps) et des humains, revanche identique à graine égale |
| `tests/ai.test.ts` | 3 | manches complètes ordinateur contre ordinateur (1 et 2 humains), bêtises variées de l'IA |
| `tests/net.test.ts` | 3 | instantanés différentiels : l'état reconstruit chez le client égale celui du serveur pendant une manche complète ; validation des messages ; prédiction identique au serveur |
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

## Limites connues

- **Pas d'essai sur de vrais appareils** : ni iPhone, ni Android, ni Firefox, ni carte graphique réelle. Le rendu logiciel des tests tourne à 3 à 10 images par seconde ; il ne dit rien des objectifs de 60 images par seconde sur PC et 30 sur téléphone.
- **Manettes** : testées seulement avec une manette simulée. Les boutons de manette ne se remappent pas.
- **Sons** : générés par le code ; l'environnement de test n'a pas de haut-parleur, je n'ai donc pas pu les écouter. Le code des sons s'exécute sans erreur.
- **IA** : l'ordinateur allume rarement l'aspirateur robot (4 manches sur 60 contre un humain) et ne l'éteint jamais lui-même ; l'aspirateur s'arrête seul au bout de 25 secondes.
- **Réseau** : réseau local seulement, en HTTP, un salon par serveur.
- **Taille** : le fichier JavaScript du jeu pèse 855 ko (250 ko compressé) ; le premier chargement sur téléphone peut prendre quelques secondes.
