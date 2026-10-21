# Prochaines étapes

Liste classée par priorité. Elle complète [PROGRESS.md](PROGRESS.md), qui décrit ce qui fonctionne et ce qui a été vérifié.

## Priorité 1 : jouer les nouveaux lieux en famille

L'école, le centre commercial et le parc n'ont été joués que par l'ordinateur. Points à observer pendant quelques parties réelles :

1. **Équilibre** : qui gagne, et comment ? L'objectif de bêtises de chaque lieu se règle dans le champ `chaosGoals` de sa carte (`src/shared/world/maps/`).
2. **Lisibilité** : trouve-t-on facilement les objets à rapporter (vêtements tombés sur le parking, ballon passé dans la rue, cadeaux dans le coffre de la voiture) ? Les flèches et la minicarte suffisent-elles dans les grands lieux ?
3. **Rythme** : au parc, presque tout se passe dehors ; Tofu y laisse moins de traces de pattes, mais renverse davantage. Le centre commercial n'a presque pas de portes. Ces différences rendent-elles les parties plus variées, ou moins drôles ?
4. **Tâches** : en garder, en retirer, en ajouter (chaque tâche suit l'un des quatre modèles décrits dans GAME_DESIGN.md, section 4).

## Priorité 2 : vérifier sur de vrais appareils

Les tests automatiques ont tourné dans Chromium, avec un rendu 3D logiciel (sans carte graphique) et une émulation de téléphone. Il reste à essayer :

1. **Téléphones réels** : un Android récent (Chrome) et un iPhone (Safari), en Wi-Fi sur le PC hôte. Points à regarder : fluidité (objectif 30 images/s), taille des boutons, joystick, rotation de caméra, son après le premier toucher, reconnexion après une mise en veille.
2. **Firefox sur Linux** : fichier `tofu-qui-a-fait-ca.html` ouvert d'un double clic, rendu, manettes, clavier AZERTY, plein écran.
3. **Fluidité sur PC** : vérifier 60 images/s avec une carte graphique intégrée, en solo et en écran partagé à 3 joueurs (4 vues). Si besoin, baisser l'ombre ou la résolution du niveau « Beaux », ou ajouter un niveau automatique selon les images par seconde mesurées.
4. **Manettes réelles** : manette Xbox et PlayStation, branchées en USB et en Bluetooth, à 1, 2 et 3 joueurs.
5. **Jeu par Internet réel** : `npm run internet` avec le vrai `cloudflared`, une partie entre deux maisons, un téléphone en 4G. Points à regarder : fluidité, bandeau « connexion lente », reconnexion après une coupure.

## Priorité 3 : confort de jeu

Le remappage de la manette, la taille du texte, les couleurs contrastées, l'arrêt des secousses et des astuces existent depuis la troisième amélioration. Il reste :

1. Couleurs contrastées aussi dans le **décor 3D** : contour des objets à prendre et des désordres.
2. Une disposition de manette **par joueur** (aujourd'hui, toutes les manettes partagent la même).
3. Un écran qui affiche le bouton pressé, pour les **manettes non standard** (certaines manettes Bluetooth sous Linux nomment leurs boutons autrement).

## Priorité 4 : contenu

1. D'autres lieux sur le même modèle (une plage, une ferme, un camping) : un fichier de données par lieu, voir GAME_DESIGN.md, section 15.
2. Un défi secret propre à chaque lieu (faire tomber la pyramide de conserves, plonger dans la fontaine, faire peur aux canards).
3. D'autres ambiances (jour de pluie avec flaques partout, Noël avec un sapin à renverser), et un jour spécial par lieu, comme le jour de marché du quartier (kermesse à l'école, soldes au centre commercial, brocante au parc).
4. Une tâche propre à chaque ambiance pour les humains (ratisser, déneiger, faire le marché).

## Priorité 5 : technique

1. Étendre `scripts/smoke-test.mjs` (aujourd'hui : parcours au clavier et commandes tactiles) aux scénarios déjà essayés pendant le développement : réseau local à 3 appareils, écran partagé, vol et retour d'une chaussette, nettoyage de la boue.
2. Jeu par Internet : garder les salons après un redémarrage du serveur, et une petite page d'état pour l'hébergeur (salons, parties, connexions).
3. Installation comme application (PWA hors ligne) : demande HTTPS, désormais disponible avec le jeu par Internet.
4. Découper le fichier JavaScript du jeu (1 020 ko, 300 ko compressé) pour accélérer le premier chargement sur téléphone, par exemple en ne chargeant que le lieu choisi.
