# Crédits et licences

## Le jeu

- Code, règles, carte et textes : créés pour ce projet, sous licence MIT (voir `package.json`).
- **Graphismes** : tous les modèles 3D (maison, meubles, quartier, Tofu, humains, chat), les textures (parquet, tomettes, carrelage, herbe, façades) et les effets sont générés par le code du jeu (géométries Three.js et textures dessinées dans des canvas). Aucun modèle, image ou illustration d'un autre jeu n'est utilisé.
- **Sons et musique** : tous les bruitages (aboiements, chocs, éclaboussures, interface) et la musique sont synthétisés en direct avec la Web Audio API par `src/client/audio/sfx.ts`. Aucun fichier audio tiers n'est utilisé.
- **Icônes** : les petites icônes de l'interface sont des emojis Unicode affichés par la police du système ; l'icône du jeu (`public/favicon.svg`) est dessinée pour le projet.

## Bibliothèques livrées avec le jeu

Ces bibliothèques font partie du jeu construit (`dist/`) ou du serveur (`dist-server/`). Aucune n'est chargée depuis Internet pendant la partie.

| Bibliothèque | Version | Licence | Rôle |
|---|---|---|---|
| [three](https://threejs.org/) | 0.180.0 | MIT | rendu 3D WebGL |
| [ws](https://github.com/websockets/ws) | 8.22.0 | MIT | WebSocket du serveur (réseau local et Internet) |
| [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) | 1.4.4 | MIT | QR code du salon (« QR Code » est une marque déposée de DENSO WAVE INCORPORATED) |
| [@fontsource/fredoka](https://fontsource.org/fonts/fredoka) | 5.2.8 | police : SIL Open Font License 1.1 | police Fredoka (Google Fonts), embarquée en fichiers locaux |

## Outils de développement

Ils servent à construire et tester le jeu ; ils ne sont pas livrés aux joueurs.

| Outil | Version | Licence |
|---|---|---|
| Vite | 7.3.7 | MIT |
| Vitest | 5.0.5 | MIT |
| TypeScript | 5.9.3 | Apache-2.0 |
| tsx | 4.23.15 | MIT |
| esbuild | 0.28.2 | MIT |
| @types/three, @types/ws, @types/node | 0.180.0, 8.18.1, 22.18.12 | MIT |

## Programme facultatif

`npm run internet` utilise [cloudflared](https://github.com/cloudflare/cloudflared) (licence Apache-2.0) s'il est installé sur le PC. Le jeu ne le contient pas et ne le télécharge pas. Il ouvre un « tunnel rapide » de Cloudflare, gratuit et sans compte, soumis aux conditions d'utilisation de Cloudflare. Le jeu marche sans lui (seul, écran partagé, réseau local, ou votre propre serveur).

Les textes complets des licences se trouvent dans `node_modules/<bibliothèque>/LICENSE` après `npm install`.
