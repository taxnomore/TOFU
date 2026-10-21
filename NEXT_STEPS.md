# Prochaines étapes

Liste classée par priorité. Elle complète [PROGRESS.md](PROGRESS.md), qui décrit ce qui fonctionne et ce qui a été vérifié.

## Priorité 1 : vérifier sur de vrais appareils

Les tests automatiques ont tourné dans Chromium, avec un rendu 3D logiciel (sans carte graphique) et une émulation de téléphone. Il reste à essayer :

1. **Téléphones réels** : un Android récent (Chrome) et un iPhone (Safari), en Wi-Fi sur le PC hôte. Points à regarder : fluidité (objectif 30 images/s), taille des boutons, joystick, rotation de caméra, son après le premier toucher, reconnexion après une mise en veille.
2. **Firefox sur Linux** : fichier `tofu-qui-a-fait-ca.html` ouvert d'un double clic, rendu, manettes, clavier AZERTY, plein écran.
3. **Fluidité sur PC** : vérifier 60 images/s avec une carte graphique intégrée, en solo et en écran partagé à 3 joueurs (4 vues). Si besoin, baisser l'ombre ou la résolution du niveau « Beaux », ou ajouter un niveau automatique selon les images par seconde mesurées.
4. **Manettes réelles** : manette Xbox et PlayStation, branchées en USB et en Bluetooth, à 1, 2 et 3 joueurs.

## Priorité 2 : confort de jeu

1. Remappage des boutons de **manette** (le clavier se remappe déjà).
2. Choix de la **taille du texte** et d'un mode **couleurs contrastées** pour l'interface.
3. Option pour **désactiver les astuces** dès le premier lancement (elles se réactivent déjà dans les réglages).
4. Dans le salon réseau, navigation complète à la **manette** (le prénom se tape aujourd'hui au clavier ou au doigt).

## Priorité 3 : contenu

1. Davantage de réactions en chaîne : le chat qui fait tomber des objets de plus haut, l'arrosoir qui fuit, la balle qui rebondit sur les meubles.
2. IA : apprendre à l'ordinateur à éteindre l'aspirateur robot quand il gêne, et à l'allumer plus souvent pour nettoyer la boue.
3. Nouvelles tâches et nouveaux défis secrets (ajout par les données, voir GAME_DESIGN.md, section 15).
4. Variantes de la carte : saison (feuilles mortes, neige), jour de marché sur le square.

## Priorité 4 : technique

1. Étendre `scripts/smoke-test.mjs` (aujourd'hui : parcours au clavier et commandes tactiles) aux scénarios déjà essayés pendant le développement : réseau local à 3 appareils, écran partagé, vol et retour d'une chaussette, nettoyage de la boue.
2. Jeu par Internet : le transport réseau sépare déjà la simulation du serveur ; il faudrait un hébergement, HTTPS et un code de salon.
3. Installation comme application (PWA hors ligne) : demande HTTPS, donc surtout utile avec le jeu par Internet.
4. Découper le fichier JavaScript du jeu (870 ko, 250 ko compressé) pour accélérer le premier chargement sur téléphone.
