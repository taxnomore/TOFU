// Friendly Node.js version check (French message for players).
const [major, minor] = process.versions.node.split('.').map(Number);
const ok = major > 22 || (major === 22 && minor >= 12) || (major === 20 && minor >= 19) || major === 21;
if (!ok) {
  console.error(`\n  Node.js ${process.versions.node} est trop ancien pour ce jeu.`);
  console.error('  Installez Node.js 22 LTS (ou 20.19 minimum) ; voir README.md.\n');
  process.exit(1);
}
