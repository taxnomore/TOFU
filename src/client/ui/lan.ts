// LAN multiplayer screens (placeholder until the network milestone).
import type { Screens } from './screens';
import { el } from './hud';

export function installLan(screens: Screens) {
  screens.lan = {
    open() {
      const s = el('div', 'screen dim');
      s.innerHTML = '<div class="panel" style="max-width:520px"><h2>📱 Réseau local</h2><p>Bientôt disponible.</p><div class="foot"><button class="big" data-back>⬅ Retour</button></div></div>';
      s.querySelector('[data-back]')!.addEventListener('click', () => screens.showTitle());
      screens.clear();
      screens.app.uiRoot.appendChild(s);
    },
    leave() {},
    rematch() {},
    isActive: () => false,
  };
}
