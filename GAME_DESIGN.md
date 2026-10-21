# TOFU ! QUI A FAIT ÇA ? Conception du jeu

Ce document décrit les règles, l'équilibrage, la carte, les systèmes et la manière d'ajouter du contenu. Les valeurs citées viennent du code (`src/shared/constants.ts`, `src/shared/sim/rules.ts`, `src/shared/world/`).

## 1. Intention

Un jeu de fête asymétrique pour jouer en famille. Tofu, un labrador jaune, cherche les bêtises ; les humains préparent la maison avant l'arrivée des invités. Le plaisir vient des réactions en chaîne : Tofu vole une chaussette, un humain le poursuit et bouscule un vase, le chat passe, Tofu lâche la chaussette pour le chat, et la boue finit dans le salon. Les systèmes reposent donc sur l'état des objets plutôt que sur des scènes scriptées.

L'humour reste doux : personne ne blesse le chien ou le chat. Un coup de patte du chat étourdit Tofu 0,6 seconde ; une glissade fait tomber un humain un peu plus d'une seconde.

## 2. Déroulement d'une manche

1. Choix du mode (solo, écran partagé, réseau local) et des rôles.
2. Cartes de rôle (4 secondes) : tâches pour les humains, défis secrets pour Tofu, rappel des commandes.
3. Compte à rebours 3, 2, 1.
4. Partie : 6 minutes par défaut (4 ou 8 minutes au choix).
5. Fin : bannière du vainqueur, raison, statistiques drôles, titres (« Roi de la glissade », « Tofu, voleur de chaussettes »), puis **Revanche** ou **Revanche (changer Tofu)** : le rôle de Tofu passe au joueur suivant.

Une revanche repart d'un monde propre, avec une nouvelle graine aléatoire. À graine égale, les tâches et les défis tirés sont identiques (test automatique).

## 3. Conditions de victoire

| Camp | Condition |
|---|---|
| Humains | Toutes les tâches faites **et** propreté ≥ 70 %. Les invités sonnent alors : il faut tenir 15 secondes. Si Tofu défait une tâche ou salit la maison sous le seuil pendant ce délai, le compte s'annule. |
| Tofu | Bêtises ≥ objectif : 250 points contre un humain, 180 contre deux. |
| Tofu | Fin du temps sans victoire des humains. Si le compte des invités tourne à la fin du temps, la partie attend sa fin. |

Personne ne peut se retrouver bloqué : tout désordre se nettoie, un objet cassé se remet en place après nettoyage, la baguette mangée revient à la boulangerie après 45 secondes, les croissants mangés se rachètent à la boulangerie, et la carte n'a pas de cul-de-sac (tests de navigation sur toutes les zones, objets et emplacements).

## 4. Tâches des humains

Le jeu tire 3 tâches pour un humain, 6 pour deux. Chaque tâche lit l'état réel du monde ; Tofu peut donc la défaire.

| Tâche | Objectif | Ce que Tofu peut faire |
|---|---|---|
| 🧺 Rentrer le linge | 4 pièces de l'étendoir dans le panier à linge (ou la commode) | voler du linge sur le fil ou dans la commode ; le panier à linge, lui, reste fermé pour Tofu |
| 🧸 Ranger les jouets | 4 jouets dans le coffre de la chambre des enfants | ressortir les jouets du coffre |
| 🍽️ Mettre la table | la vaisselle du placard sur la table du salon | tirer la nappe : la vaisselle tombe |
| 🥐 Servir le goûter | les croissants de la cuisine sur la table du jardin | manger les croissants (il faut en racheter) |
| 🗑️ Sortir la poubelle | le sac de la cuisine dans la grande poubelle du trottoir | renverser la poubelle ou déchirer le sac |
| ✉️ Relever le courrier | le courrier de la boîte aux lettres sur la console de l'entrée | voler le courrier |
| 🛏️ Faire le lit | maintenir Action au lit | sauter sur le lit (avec ou sans boue) |
| 🌷 Arroser les fleurs | remplir l'arrosoir au robinet, arroser les 2 massifs | creuser un massif |

Protection : un objet que les humains viennent de ranger ou de reprendre reste hors d'atteinte de Tofu pendant 25 secondes. Sans cette règle, Tofu pouvait défaire une tâche aussitôt finie, et les manches tournaient en boucle.

## 5. Défis secrets de Tofu

Tofu tire 3 défis ; chacun rapporte 20 points de bêtises. L'automne, l'hiver et le jour de marché imposent leur propre défi ; les deux autres viennent du tirage commun (18 défis). Le défi « faire sursauter les humains » n'apparaît que s'il y a des humains. La factrice passe une première fois après 30 secondes, puis toutes les 75 à 110 secondes.

| Défi | Objectif |
|---|---|
| 🧦 Voleur | voler 5 vêtements |
| 💎 Trésor | cacher 3 objets dans son panier ou sa niche |
| 🛣️ Rue | emporter un objet de la maison jusque dans la rue |
| 💥 Casse | faire tomber 5 objets |
| 🐾 Boue | 12 traces de boue dans les chambres |
| 🐈 Chat | poursuivre le chat 8 secondes |
| 🗑️ Poubelles | renverser 2 poubelles |
| 🥐 Gourmand | manger quelque chose de bon |
| 😇 Innocent | s'asseoir l'air innocent à côté d'une bêtise |
| 💨 Zoomies | déclencher les zoomies dans la maison |
| 🛏️ Lit sale | sauter sur le lit avec les pattes pleines de boue |
| 🥖 Baguette | rapporter la baguette de la boulangerie |
| 🕳️ Creuser | creuser un trou dans un massif |
| 📢 Sursaut | faire sursauter les humains 3 fois en aboyant |
| 📮 Factrice | aboyer sur la factrice |
| 🧻 Papier | dérouler 25 feuilles de papier toilette |
| ⛓️ Réaction en chaîne | faire renverser 2 objets par le chat ou par l'aspirateur |
| 🚿 Arrosoir | voler l'arrosoir et laisser 15 gouttes dans la maison |
| 🍂 Feuilles (automne) | éparpiller 4 tas de feuilles |
| ⛄ Bonshommes (hiver) | démolir les 2 bonshommes de neige |
| 🧀 Marché (jour de marché) | manger 2 bonnes choses volées au marché |

## 6. Barème des bêtises

| Bêtise | Points |
|---|---|
| Voler un objet (la même chose revolée dans les 60 s ne compte plus) | 2 |
| Cacher un objet dans le panier ou la niche | 3 |
| Lâcher un objet de la maison dans la rue | 4 |
| Renverser un objet | 1,5 à 4 selon l'objet (environ moitié moins si un humain ou le chat le renverse) |
| Manger (croissants, baguette) | 7 |
| Déchirer le sac poubelle | 4 |
| Sauter sur le lit / le lit boueux | 3 / 4 |
| Sauter sur le canapé / le canapé boueux | 1,5 / 4 |
| Creuser un massif | 4 |
| Tirer la nappe | 7 |
| Une trace de boue (ou une feuille morte) dans la maison | 0,15 |
| Une trace mouillée de pattes enneigées (hiver) | 0,06 |
| Une goutte de l'arrosoir sur un sol de la maison ou de la terrasse | 0,08 (arrosoir vide : +1) |
| Voler sur un étal du marché | 3 |
| Démolir un bonhomme de neige / éparpiller un tas de feuilles | 5 / 2,5 |
| Faire tomber la tasse de café / le cageot de pommes | 3 / 4 |
| Réaction en chaîne (le chat poursuivi par Tofu, ou l'aspirateur qu'il a allumé, renverse un objet) | les points entiers de l'objet |
| Une feuille de papier toilette déroulée | 0,15 (rouleau vide : +2) |
| Allumer l'aspirateur robot | 1,5 ; ce qu'il renverse compte ensuite pour Tofu |
| Poursuivre le chat | 1,2 par seconde (6 au plus par fuite) |
| Aboyer sur le chat perché / la factrice | 2 / 3 |
| Glissade d'un humain | 1,5 |
| Défi secret | 20 |
| S'asseoir l'air innocent près d'une bêtise | 2 (une fois par bêtise) |
| Désordre laissé par terre | 0,012 point par seconde et par désordre (0,12 par seconde au plus) ; les traces d'eau, qui sèchent seules, ne comptent pas |

**Zoomies** : chaque bêtise remplit la jauge (de 2 % pour un aboiement à 16 % pour la nappe ; une bêtise répétée rapporte moins). Jauge pleine : 6 secondes à 8,6 m/s, Tofu renverse ce qu'il touche ; il halète ensuite 1,4 seconde.

## 7. Propreté

La propreté part de 100 % et baisse selon :

- chaque désordre : de 3 points (coussin, miettes) à 8 points (déchets, vaisselle cassée). La boue compte selon le nombre d'empreintes (pleine valeur à 5 empreintes), le papier toilette selon le nombre de feuilles (pleine valeur à 6 feuilles) ;
- chaque objet qui n'est pas à sa place : 2,5 points ;
- un désordre dehors compte moins : × 0,7 dans le jardin, × 0,45 dans la rue et le square.

Les empreintes, les feuilles de papier, les gouttes et les feuilles mortes sont regroupées par zones de nettoyage de 2 m (12 marques au plus par zone ; 900 empreintes, 400 feuilles de papier, 500 gouttes et 400 feuilles mortes au plus affichées) : aucune accumulation sans limite. Les traces d'eau sèchent seules : une zone commence à sécher 25 secondes après sa création, puis perd une marque toutes les 2,5 secondes.

## 8. Les bêtises : systèmes de jeu

Les cinq systèmes demandés fonctionnent dans la simulation et dans le rendu.

1. **Voler du linge** : chaussettes, slip à pois, marinière, serviette, chaussons, dans la commode, au pied du lit ou sur l'étendoir. Tofu porte l'objet dans la gueule (visible sur le modèle ; il ralentit de 14 %), le lâche, le cache dans son panier ou sa niche, ou l'emporte dans la rue. Les humains le voient (flèche rouge, minicarte), le reprennent directement dans la gueule de Tofu, ou le ramassent et le rangent.
2. **Renverser** : vases, plantes, pots de fleurs, tour de cubes, coussins, nain de jardin, poubelles. Les objets suivent une physique simplifiée (vol, rebonds, collisions avec les murs) puis restent renversés. Le désordre (eau, terre, cubes, déchets) persiste jusqu'au nettoyage, qui remet l'objet debout. Un humain qui court trop vite peut aussi bousculer un objet.
3. **Le chat** : il se promène sur un graphe de chemins (jardin, palissades, toit de voiture, square, chatière). Il fuit Tofu (5,5 m, ou 8,5 m quand Tofu court) vers un perchoir sûr, saute, renverse parfois un objet en fuyant et donne un coup de patte si Tofu le colle. Perché, il ignore Tofu ; Tofu peut alors l'aboyer.
4. **Pattes boueuses** : deux flaques (jardin et square). Tofu boueux laisse des empreintes à l'intérieur (une tous les 42 cm) ; la boue sèche dehors. Les humains essuient les traces (maintenir Action) et peuvent essuyer les pattes de Tofu.
5. **Poubelles et nourriture** : Tofu renverse la poubelle de la cuisine, la grande poubelle du trottoir ou celle du square (déchets à ramasser), déchire le sac, mange les croissants ou la baguette.

Bonus déjà en place :

- **Papier toilette** : Tofu prend le rouleau sur son dérouleur (salle de bain). Tant qu'il le porte en courant, le papier se déroule derrière lui, une feuille tous les 34 cm, dans la maison comme dehors. Un rouleau compte 30 feuilles ; vide, il disparaît et un rouleau neuf revient sur le dérouleur 40 secondes plus tard. Les humains ramassent le papier (maintenir Action), reprennent le rouleau dans la gueule de Tofu ou le remettent sur son dérouleur (il redevient neuf).
- **Aspirateur robot** : il attend sur sa base dans le salon. Tofu l'allume (les humains aussi) ; il roule 25 secondes au hasard, rebondit sur les meubles, renverse les petits objets posés par terre, fait fuir le chat, et aspire au passage les empreintes de boue, les feuilles de papier et les miettes. Un humain peut l'éteindre : il rentre alors à sa base. Il se recharge 20 secondes avant de repartir.
- Sauter sur le lit et le canapé (coussins par terre, draps boueux), creuser les massifs, tirer la nappe, aboyer sur la factrice qui passe dans la rue, s'asseoir l'air innocent (« Qui, moi ? »), zoomies.
- **Arrosoir qui fuit** : Tofu peut voler l'arrosoir de la terrasse (il le ralentit). En courant, il en perd une goutte tous les 40 cm : 20 gouttes pour un arrosoir plein. Sur les sols de la maison et de la terrasse, chaque goutte laisse une trace qui glisse sous les pas d'un humain qui court, et qui sèche toute seule. Vide, l'arrosoir doit être rempli au robinet avant d'arroser les fleurs.
- **Réactions en chaîne** : en fuyant, le chat renverse ce qu'il touche, au sol comme en hauteur (la tasse de café sur le plan de travail, le pot de basilic sur le rebord de la fenêtre, hors de portée de Tofu). Si Tofu le poursuit à moins de 9 m, ou si l'aspirateur renverse un objet après que Tofu l'a allumé, les points comptent en entier pour Tofu. Une balle lancée renverse aussi ce qu'elle percute (accident humain).

## 8 bis. Les ambiances

L'ambiance se choisit avant la manche (et par l'hôte en réseau local). Le serveur et chaque appareil construisent alors le même monde : collisions, navigation, objets et emplacements dépendent de l'ambiance.

| Ambiance | Décor | Bêtises en plus |
|---|---|---|
| ☀️ Été | le quartier habituel | aucune |
| 🍂 Automne | arbres roux, feuilles au sol, citrouilles au potager, feuilles qui tombent | 4 tas de feuilles (jardin, devant, square). Tofu les éparpille en courant dedans (2,5 points) ; il garde alors des feuilles dans les poils et en sème dans la maison. Ratisser remet le tas en place. |
| ❄️ Hiver | neige au sol, sur les toits, les murets et les haies ; arbres nus ; flocons | Dehors (sauf dans la rue déneigée), les pattes de Tofu se chargent de neige : traces mouillées dans la maison, qui sèchent seules. 2 bonshommes de neige (jardin et square) : Tofu les pousse (maintenir Action 0,8 s) ou les percute à pleine vitesse (5 points). Les humains les refont. |
| 🧀 Jour de marché | trois étals rayés sur le square | Fromage, saucisson et poulet rôti sur les étals : Tofu les vole (3 points) et les mange (7 points) ; ils reviennent 45 secondes après. Les humains rendent la marchandise volée au bon étal. Un cageot de pommes se renverse (pommes qui roulent, glissantes). |

## 9. Capacités

| | Tofu | Humain |
|---|---|---|
| Marche / course | 4,15 / 6,7 m/s | 3,75 / 5,7 m/s |
| Endurance | se vide en 3 s de course, remonte 2,2 fois plus vite assis | se vide en 4 s |
| Portée d'action | 0,95 m | 1,15 m |
| Porter | un objet dans la gueule | jusqu'à 3 objets |
| Spécial | zoomies | friandise (2 au départ, 3 au plus, recharge au bocal) ou balle |
| Autre | aboyer (fait sursauter un humain proche), s'asseoir, pousser une porte intérieure, passer par la chatière, le trou de la haie et sous les tables, allumer l'aspirateur | ouvrir et fermer portes et portails, essuyer les pattes, caresser Tofu, allumer ou éteindre l'aspirateur |

Contre-jeu des humains : la friandise attire Tofu jusqu'à 9 m (la balle jusqu'à 12 m), il lâche ce qu'il porte et la mange en 2 secondes ; il résiste ensuite 8 secondes. Fermer une porte ralentit Tofu (pousser prend 0,9 s ; les portes extérieures et les portails lui résistent, sauf la chatière). En courant (> 4,9 m/s) sur de l'eau, un humain glisse et lâche ce qu'il porte.

## 10. Équilibrage

- Objectif de bêtises : 250 contre un humain, 180 contre deux (deux humains nettoient plus vite mais ont 6 tâches). Les nouvelles bêtises (arrosoir, réactions en chaîne, ambiances) ont fait passer ces objectifs de 220 et 170 à 250 et 180.
- 3 tâches à un humain, 6 à deux. Avec 4 tâches, un humain seul perdait 3 manches sur 4 contre l'ordinateur au niveau Normal ; avec 3 tâches, l'équilibre revient à une manche sur deux.
- Trois niveaux d'ordinateur (réactivité, précision des friandises, insistance de Tofu à défaire les tâches).
- Mesures automatiques, ordinateur contre ordinateur, manches de 6 minutes (script de simulation sans rendu) :

| Niveau de l'ordinateur | Tofu contre 1 humain | Tofu contre 2 humains |
|---|---|---|
| Facile (été) | Tofu gagne 9 fois sur 50 | Tofu gagne 11 fois sur 50 |
| Normal, été | Tofu gagne 56 fois sur 100 | Tofu gagne 60 fois sur 100 |
| Normal, automne | Tofu gagne 43 fois sur 100 | Tofu gagne 54 fois sur 100 |
| Normal, hiver | Tofu gagne 49 fois sur 100 | Tofu gagne 56 fois sur 100 |
| Normal, jour de marché | Tofu gagne 50 fois sur 100 | Tofu gagne 55 fois sur 100 |
| Difficile (été) | Tofu gagne 46 fois sur 50 | Tofu gagne 44 fois sur 50 |

Dans ces mesures, l'ordinateur joue les deux camps au même niveau ; elles ne disent rien de son niveau face à de vrais joueurs. Pour les plus jeunes, commencez en « Facile ». Les manches durent de 2 à 6 minutes et se jouent souvent sur la fin.

## 11. Carte

Un seul monde continu d'environ 63 m sur 50 m, sans chargement. En courant, on le traverse en 20 à 35 secondes. Le nord (en haut de la minicarte) correspond à la rue.

```
 nord
  ┌──────────────────────── Trottoir nord · Boulangerie ────────────────────────┐
  │                      Rue des Tilleuls (voitures garées)                     │
  ├──────────── Trottoir sud : grande poubelle, boîte aux lettres ──────────────┤
  │ SQUARE   │ Devant la maison                    │Portail│ Chez les voisins   │
  │ banc,    │        [porte d'entrée]             │       │ (façades, jardin)  │
  │ arbres,  │ ┌────────┬────────┬─────────┬──────┐ │ Allée │                    │
  │ poubelle,│ │Chambre │        │ Cuisine │ SdB  │ │       │                    │
  │ flaque   │ ├────────┤ Entrée ├─────────┴──────┤ │       │                    │
  │          │ │Enfants │        │      Salon     │ │       │                    │
  │          │ └────────┴[porte]─┴─────[baie]─────┘[Portillon]                  │
  │      [trou de la haie] JARDIN : terrasse, étendoir, massifs, flaque, niche  │
  └─────────────────────────────────────────────────────────────────────────────┘
 sud
```

- **Maison** (rez-de-chaussée complet) : entrée, chambre, chambre des enfants, cuisine, salon (avec la base de l'aspirateur robot), salle de bain avec buanderie (et le dérouleur de papier toilette). Cinq portes intérieures (Tofu peut les pousser), la porte d'entrée, la porte du jardin avec chatière et la baie vitrée du salon.
- **Jardin** : pelouse, dallage, terrasse, deux massifs, une flaque de boue, l'étendoir, la table du jardin, la niche, des jouets, une palissade et une haie (avec un trou réservé à Tofu vers le square).
- **Quartier** : allée et portail, trottoirs, rue avec voitures garées, lampadaires, boîte aux lettres, poubelles, façades des voisins, petit square avec banc et arbres, boulangerie. La factrice passe de temps en temps.
- **Caméra** : vue à la troisième personne qui suit en douceur, avec rotation, zoom et vue du dessus. Les murs entre la caméra et le joueur s'abaissent (effet « maison de poupée ») et le toit disparaît quand on entre : on ne perd jamais son personnage derrière un mur.

## 12. Personnages

Tous les modèles sont construits en code (formes simples assemblées, couleurs douces, ombres).

- **Tofu** : labrador jaune avec oreilles, museau, queue et quatre pattes. Animations procédurales : marche, course, queue qui remue (plus vite quand il porte un objet), objet dans la gueule, assis, l'air innocent (auréole), aboiement, zoomies exagérées, halètement, creusement.
- **Humains** : Maman, Papa, Léa, Hugo, chacun avec sa silhouette et ses couleurs ; marche, course, porter, nettoyer, lancer, glisser.
- **Chat** et **factrice** : animés de la même façon.

## 13. Intelligence artificielle

- **Navigation** : grilles de 0,5 m (une pour les humains, une pour Tofu, qui passe sous les tables et par la chatière), A* avec coût pour les portes, lissage du chemin, détection de blocage et nouveau calcul. Un but inaccessible (dans un meuble, ou dans un recoin fermé derrière le fauteuil) est remplacé par la case la plus proche que le personnage peut vraiment atteindre.
- **Tofu** : choisit une bêtise selon la distance, la variété, ses défis secrets et la position des humains ; fuit quand on le poursuit, lâche ce qu'il porte face à une friandise, défait les tâches finies selon la difficulté. Il allume l'aspirateur surtout quand des objets fragiles l'entourent (réaction en chaîne), poursuit le chat jusque dans la cuisine, vole l'arrosoir de préférence quand les fleurs restent à arroser, puis court dans la maison pour qu'il fuie partout. Il exploite chaque ambiance (tas de feuilles, bonshommes de neige, étals).
- **Humains** : se répartissent les tâches (réservations partagées), nettoient, reprennent les objets volés, protègent les tâches faites, lancent des friandises, ferment les portes, interceptent Tofu pendant le compte des invités. Ils éteignent l'aspirateur quand Tofu l'a allumé ou qu'il fonce vers un objet fragile, l'allument pour aspirer un sol couvert d'empreintes, essuient les pattes de Tofu à la porte avant qu'il entre, laissent sécher les traces d'eau et rendent la marchandise volée au bon étal.
- **Coéquipier** : un humain joué par l'ordinateur laisse au joueur le désordre ou l'objet dont celui-ci s'occupe déjà (joueur à moins de 3 m et plus proche que lui).

## 13 bis. Confort

- **Commandes** : le clavier (trois dispositions) et la manette se remappent dans les réglages. Un bouton fait une seule action ; la croix directionnelle sert toujours à bouger ; dans les menus, A valide et B revient. Toutes les manettes partagent la même disposition. Les bulles d'aide et l'écran « Comment jouer » affichent les boutons choisis.
- **Taille du texte** : 100, 115 ou 130 %. Toute l'interface suit la taille de police de la page ; les jauges du haut gardent leur seule icône quand la place manque.
- **Couleurs contrastées** : texte noir sur fond clair, bordures épaisses, sélection soulignée, focus très visible (interface seulement, pas le décor 3D).
- **Secousses** : « Non » coupe les secousses de caméra et les éléments d'interface qui tremblent. Le réglage part sur « Non » si le système demande moins d'animations (`prefers-reduced-motion`).
- **Astuces** : coupables ; « Revoir depuis le début » les remet toutes.
- **Salon réseau** : le bouton 🎲 donne un prénom au hasard, pour qui joue à la manette sans clavier.

## 14. Architecture technique

```
            src/shared  (TypeScript pur, sans rendu)
   world/ carte, collisions, navigation   sim/ simulation 60 Hz, règles, chat
   ai/ IA Tofu et humains                 net/ protocole, instantanés
        │                                   │
        ▼                                   ▼
 src/client (navigateur)               server (Node.js + ws)
  rendu Three.js, interface,            salon, partie autoritative 60 Hz,
  sons Web Audio, commandes,            validation des messages,
  session locale ou réseau              instantanés différentiels 20 Hz
```

- **Simulation** à pas fixe de 1/60 s. La même simulation tourne dans le navigateur (solo, écran partagé) et sur le serveur (réseau local).
- **Écran partagé** : un seul canvas WebGL, une vue par joueur (scissor), une caméra par joueur, une seule mise à jour d'ombres par image.
- **Internet** : avec `--internet`, le serveur accueille un salon par famille (code de 5 consonnes). Il limite les connexions, les créations de salons et les codes faux par adresse, ferme les salons vides ou inactifs, refuse les pages d'autres sites et ne révèle pas les adresses du réseau local. L'hôte peut retirer un joueur et fermer le salon aux nouveaux. Le délai d'affichage des autres joueurs part de 100 ms et monte jusqu'à 300 ms selon le retard des derniers instantanés. `npm run internet` ouvre un tunnel Cloudflare gratuit (sans compte) quand le programme `cloudflared` est installé.
- **Réseau** : serveur autoritatif. Les clients envoient seulement leurs entrées (numérotées) ; le serveur vérifie tout (forme des messages, longueur des déplacements, boutons, distances d'interaction dans la simulation, droits de l'hôte, débit). Il renvoie 20 instantanés par seconde : personnages, chat et minuterie à chaque fois, objets, portes et désordres seulement quand ils changent. Les clients affichent les autres joueurs avec 100 ms de retard (interpolation) et prédisent leur propre personnage avec le même code de déplacement que le serveur, puis corrigent en douceur. Une déconnexion confie le personnage à l'ordinateur sans arrêter la partie ; le joueur le récupère en revenant.

## 15. Ajouter du contenu

Les objets et lieux sont décrits par des données :

- **Nouveau type d'objet** : une entrée dans `ITEM_TYPES` (`src/shared/world/itemTypes.ts`) avec son nom, sa catégorie, ses règles de transport (`carry`), de chute (`knock` : désordre produit, points, vitesse minimale) ou de nourriture (`edible`).
- **Placer un objet** : une ligne dans `ITEMS` (`src/shared/world/map.ts`), soit à une position, soit dans un emplacement (`station`).
- **Nouvel emplacement** (meuble où l'on range) : une ligne dans `STATIONS` avec sa forme, sa portée, sa capacité et `dogReach` (Tofu peut-il y voler ?).
- **Nouveau désordre** : une entrée dans `MESS_TYPES` (saleté, durée de nettoyage, verbe affiché).
- **Nouvelle tâche** : une entrée dans `TASK_DEFS` (`src/shared/sim/rules.ts`) avec une fonction `eval` qui lit l'état du monde.
- **Nouveau défi** : une entrée dans `SECRET_DEFS`, puis un appel `progressSecret` à l'endroit où l'action se produit.
- **Équilibrage** : toutes les valeurs sont dans `src/shared/constants.ts`.

Les tests (`npm test`) vérifient ensuite que tout reste atteignable.

## 16. Pistes

Voir [NEXT_STEPS.md](NEXT_STEPS.md).
