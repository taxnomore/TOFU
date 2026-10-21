// Network play, at home (Wi-Fi) or on the Internet (rooms with a code): lobby
// screen (QR code or share link, players, roles, settings) and the glue
// between the server connection and network game sessions.
import qrcode from 'qrcode-generator';
import { VARIANTS, isVariant } from '../../shared/world/variants';
import { DEFAULT_MAP, MAP_LIST, getMap, isMapId } from '../../shared/world/maps';
import { MAX_SEATS_PER_CLIENT, normalizeRoomCode } from '../../shared/net/protocol';
import type { LobbyPlayer, RolePref, SeatReq, ServerMode } from '../../shared/net/protocol';
import { sfx } from '../audio/sfx';
import { InputDevice, KEYMAPS, KeyboardDevice } from '../input/devices';
import { HUMAN_LOOKS } from '../render/characters';
import { LobbyMsg, NetClient, NetStatus, StartMsg, serverUrl } from '../runtime/netClient';
import { NetSession } from '../runtime/netSession';
import type { LocalPlayer } from '../runtime/session';
import { el } from './hud';
import { LazyPad, MultiDevice, Screens, isTouch, savePrefs } from './screens';

const NAMES = ['Léa', 'Hugo', 'Chloé', 'Lucas', 'Emma', 'Nathan', 'Jade', 'Louis', 'Inès', 'Tom', 'Zoé', 'Noé'];
/** Names for the 🎲 button (handy with a gamepad, which cannot type). */
const FUN_NAMES = [...NAMES, 'Mamie', 'Papi', 'Tonton', 'Tata', 'Mila', 'Jules', 'Rose', 'Arthur', 'Lina', 'Gabriel', 'Capitaine', 'Doudou'];
const SEAT_CONTROLS = ['Clavier gauche (ZQSD/WASD) ou manette 1', 'Clavier droit (flèches) ou manette 2', 'Manette 3'];

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');

export function installLan(screens: Screens) {
  screens.lan = new Lan(screens);
}

interface ServerInfo {
  mode: ServerMode;
  publicUrl: string;
}

let infoPromise: Promise<ServerInfo | null> | null = null;

/** Mode of the server that sent this page (null: no server, as with the downloaded file). */
function serverInfo(): Promise<ServerInfo | null> {
  if (location.protocol === 'file:') return Promise.resolve(null);
  infoPromise ??= fetch('/api/info', { cache: 'no-store' })
    .then((r) => (r.ok ? r.json() : null))
    .then((j) => (j && (j.mode === 'lan' || j.mode === 'internet') ? { mode: j.mode, publicUrl: typeof j.publicUrl === 'string' ? j.publicUrl : '' } : null))
    .catch(() => null);
  return infoPromise;
}

/** Room code given in the page address (?salon=KZPTM). */
export function urlRoom(): string | null {
  return normalizeRoomCode(new URLSearchParams(location.search).get('salon'));
}

/** Keeps the room code in the address, so a reload goes back to the room. */
function setUrlRoom(code: string) {
  try {
    const u = new URL(location.href);
    if (code) u.searchParams.set('salon', code);
    else u.searchParams.delete('salon');
    history.replaceState(history.state, '', u);
  } catch {
    /* address bar left as it is */
  }
}

const LOCAL_HOSTS = ['localhost', '127.0.0.1', '::1', '[::1]'];

const lastHtml = new WeakMap<Element, string>();
/**
 * Replaces the content only when it changed. The lobby redraws every second:
 * rewriting the same buttons would lose focus and clicks in progress. (The
 * browser's own innerHTML is no reference: it writes attributes its own way.)
 */
function setHtml(e: Element, html: string) {
  if (lastHtml.get(e) === html) return;
  lastHtml.set(e, html);
  e.innerHTML = html;
}

class Lan {
  net: NetClient | null = null;
  private mode: 'off' | 'lobby' | 'game' = 'off';
  private scr: HTMLElement | null = null;
  private session: NetSession | null = null;
  private banner: HTMLElement | null = null;
  private profileKey = '';
  private joinKey = '';
  private watchdog: ReturnType<typeof setInterval> | null = null;
  private info: ServerInfo | null = null;
  /** Kick button armed (second press confirms). */
  private armed = '';

  constructor(private screens: Screens) {
    void serverInfo().then((i) => {
      this.info = i;
      this.screens.refreshTitle();
    });
  }

  isActive() {
    return this.mode !== 'off';
  }

  isHost() {
    return !!this.net?.host;
  }

  private get online(): boolean {
    return this.info?.mode === 'internet';
  }

  /** Network buttons of the title menu: `top` goes first, `bottom` after the local modes. */
  menu(remote: boolean): { top: string; bottom: string } {
    const code = urlRoom();
    const btn = (a: string, ico: string, title: string, sub: string, primary: boolean) =>
      `<button class="${primary ? 'primary' : ''}" data-a="${a}"><span class="ico">${ico}</span><span>${title}<small>${sub}</small></span></button>`;
    if (this.online) {
      const play = btn('online', '🌍', 'Jouer en ligne', 'Créer un salon ou entrer un code', remote && !code);
      if (code) return { top: btn('join', '🔑', `Rejoindre le salon ${code}`, 'Partie en ligne', true), bottom: play };
      return remote ? { top: play, bottom: '' } : { top: '', bottom: play };
    }
    if (remote) return { top: btn('lan', '📱', 'Rejoindre la partie', 'Partie en réseau local (Wi-Fi)', true), bottom: '' };
    return { top: '', bottom: btn('lan', '📱', 'Réseau local', 'Téléphones et autres PC sur le Wi-Fi', false) };
  }

  /** From the title menu: home network, online rooms, or the room in the address. */
  async open(how: 'lan' | 'online' | 'join' = 'lan') {
    if (location.protocol === 'file:') {
      this.showNeedsServer();
      return;
    }
    if (this.net) {
      this.showLobby();
      return;
    }
    this.info ??= await serverInfo();
    if (!this.online) this.connect('');
    else if (how === 'join' && urlRoom()) this.connect(urlRoom()!);
    else this.showOnline();
  }

  /** Joins a room (`room`: a code, "new" to create one, empty at home). */
  private connect(room: string) {
    if (this.net) return;
    const p = this.screens.prefs;
    const name = p.name || NAMES[Math.floor(Math.random() * NAMES.length)];
    const seat: SeatReq = { name, avatar: p.avatar, pref: 'any', device: isTouch() ? 'touch' : 'keyboard' };
    const net = new NetClient([seat], serverUrl(room));
    net.onLobby = (m) => this.onLobby(m);
    net.onStart = (m) => this.onStart(m);
    net.onStatus = (s) => this.onStatus(s);
    net.onWelcome = (m) => {
      if (m.room) setUrlRoom(m.room);
    };
    this.net = net;
    net.connect();
    this.watchdog = setInterval(() => this.checkLink(), 1000);
    this.showLobby();
  }

  /** Internet server: create a room, or join one with its code. */
  private showOnline(err = '') {
    const s = el('div', 'screen dim');
    s.innerHTML = `<div class="panel" style="max-width:560px">
      <h2>🌍 Jouer en ligne</h2>
      <p>Chaque famille joue dans son propre salon. Celui qui crée le salon devient l'hôte 👑 : il envoie ensuite le lien ou le code aux autres joueurs.</p>
      <button class="big primary" data-create><span class="ico">➕</span><span>Créer un salon<small>Puis partager le lien avec les autres joueurs</small></span></button>
      <h3>J'ai un code</h3>
      <div class="namerow"><input type="text" data-code maxlength="9" placeholder="Par exemple KZPTM" autocomplete="off" autocapitalize="characters" spellcheck="false" enterkeyhint="go" aria-label="Code du salon"><button class="big" data-join>Rejoindre ▶</button></div>
      ${err ? `<p class="err">${esc(err)}</p>` : ''}
      <div class="foot"><button class="big" data-back>⬅ Retour</button></div></div>`;
    const join = () => {
      const typed = (s.querySelector('[data-code]') as HTMLInputElement).value;
      const code = normalizeRoomCode(typed);
      if (!code) this.showOnline('Un code compte 5 lettres, sans voyelles (par exemple KZPTM).');
      else this.connect(code);
    };
    s.addEventListener('click', (e) => {
      const b = (e.target as HTMLElement).closest('button');
      if (!b) return;
      sfx.play('click');
      if (b.hasAttribute('data-create')) this.connect('new');
      else if (b.hasAttribute('data-join')) join();
      else if (b.hasAttribute('data-back')) this.screens.showTitle();
    });
    s.addEventListener('keydown', (e) => {
      if ((e.target as HTMLElement).hasAttribute('data-code') && e.key === 'Enter') join();
    });
    this.screens.show(s);
  }

  /** Opened from the downloaded HTML file: network play needs the small server. */
  private showNeedsServer() {
    const s = el('div', 'screen dim');
    s.innerHTML = `<div class="panel" style="max-width:640px">
      <h2>📱 Partie en réseau local</h2>
      <p>Pour jouer avec des téléphones, le jeu a besoin de son petit serveur, qui tourne sur ce PC :</p>
      <ol>
        <li>Ouvrez un terminal dans le dossier du jeu (celui de l'archive .zip).</li>
        <li>Tapez <kbd>npm run start</kbd>.</li>
        <li>Ouvrez <b>http://localhost:8080/</b> dans le navigateur, puis « Réseau local ».</li>
      </ol>
      <p>Pour jouer par Internet avec de la famille qui habite ailleurs, tapez plutôt <kbd>npm run internet</kbd> (voir le fichier README, « Jouer par Internet »).</p>
      <p>Ce fichier suffit pour jouer seul ou à plusieurs sur ce PC (écran partagé).</p>
      <div class="foot"><button class="big primary" data-back>⬅ Retour</button></div></div>`;
    s.querySelector('[data-back]')!.addEventListener('click', () => {
      sfx.play('click');
      this.screens.showTitle();
    });
    this.screens.show(s);
  }

  leave() {
    if (this.net?.room) setUrlRoom('');
    this.net?.close();
    this.net = null;
    this.mode = 'off';
    this.session = null;
    this.scr = null;
    this.setBanner('');
    document.body.classList.remove('lan-host');
    if (this.watchdog) clearInterval(this.watchdog);
    this.watchdog = null;
  }

  rematch(rotate: boolean) {
    this.net?.send({ t: 'rematch', rotate });
  }

  /** End screen "Salon": the host brings everybody back, guests just look at the lobby. */
  toLobby() {
    if (this.net?.host && this.net.lobby?.phase === 'game') this.net.send({ t: 'to_lobby' });
    else this.backToLobby();
  }

  // ------------------------------------------------------------ server events

  private onLobby(m: LobbyMsg) {
    document.body.classList.toggle('lan-host', !!this.net?.host);
    if (this.mode === 'game' && m.phase === 'lobby') {
      this.backToLobby();
      return;
    }
    if (this.mode === 'lobby') this.render();
  }

  private onStart(m: StartMsg) {
    const net = this.net;
    if (!net) return;
    const locals: LocalPlayer[] = [];
    m.you.forEach((y, i) => {
      const c = m.state.chars[y.charId];
      if (!c) return;
      locals.push({
        slot: i, charId: y.charId, seat: y.seat, device: this.deviceFor(y.seat, m.you.length, c.role), rig: this.screens.newRig(),
        rect: { x: 0, y: 0, w: 1, h: 1 }, raw: null, name: c.name,
      });
    });
    if (!locals.length) {
      // No role this round (late arrival or more than three players): watch Tofu.
      locals.push({
        slot: 0, charId: 0, spectator: true, device: this.screens.primaryDevice('human'), rig: this.screens.newRig(),
        rect: { x: 0, y: 0, w: 1, h: 1 }, raw: null, name: 'Spectateur',
      });
    }
    this.session = new NetSession(net, m, locals);
    this.mode = 'game';
    this.scr = null;
    this.setBanner('');
    this.screens.startNet(this.session);
  }

  private onStatus(s: NetStatus) {
    const net = this.net;
    if (s === 'closed' && this.mode === 'lobby' && net && !net.lobby && this.online) {
      // Refused before entering (unknown code, server busy): back to the choice.
      const err = net.error || 'Impossible de rejoindre ce salon.';
      this.leave();
      this.showOnline(err);
      return;
    }
    if (this.mode === 'lobby') this.render();
    else if (this.mode === 'game') {
      if (s === 'open') this.setBanner('');
      else if (s === 'closed') this.setBanner(`❌ ${esc(this.net?.error || 'Déconnecté du serveur.')}`, true);
      else this.setBanner('📡 Connexion perdue… reconnexion en cours');
    }
  }

  /** Warns when snapshots stop arriving (weak Wi-Fi) before the socket notices, or when the link is slow. */
  private checkLink() {
    if (this.mode === 'lobby') this.render();
    if (this.mode !== 'game' || !this.session || !this.net?.connected) return;
    const gap = performance.now() - this.session.lastSnapAt;
    const rtt = this.net.rtt;
    if (gap > 2500) this.setBanner('📡 Connexion instable…');
    else if (rtt > 300) this.setBanner(`🐢 Connexion lente (${Math.round(rtt)} ms) : tes actions arrivent en retard.`);
    else if (this.banner && !this.banner.classList.contains('fatal') && (rtt < 250 || !this.banner.textContent?.startsWith('🐢'))) this.setBanner('');
  }

  private setBanner(html: string, fatal = false) {
    if (!html) {
      this.banner?.remove();
      this.banner = null;
      return;
    }
    if (!this.banner) {
      this.banner = el('div', 'net-banner');
      document.body.appendChild(this.banner);
    }
    this.banner.classList.toggle('fatal', fatal);
    if (fatal) {
      lastHtml.delete(this.banner);
      this.banner.innerHTML = `${html} <button class="big" data-quit>🏠 Menu</button>`;
      this.banner.querySelector('[data-quit]')!.addEventListener('click', () => this.screens.showTitle());
    } else setHtml(this.banner, html);
  }

  private backToLobby() {
    this.session = null;
    this.setBanner('');
    this.screens.endSession();
    this.screens.startAttract();
    this.showLobby();
  }

  /** Controls of each seat when several players share this device. */
  private deviceFor(seat: number, n: number, role: 'tofu' | 'human'): InputDevice {
    if (n <= 1) return this.screens.primaryDevice(role);
    if (seat === 0) return new MultiDevice([new KeyboardDevice('kb-left', 'Clavier (gauche)', KEYMAPS.left), new LazyPad(0)]);
    if (seat === 1) return new MultiDevice([new KeyboardDevice('kb-right', 'Clavier (droite)', KEYMAPS.right), new LazyPad(1)]);
    return new LazyPad(2);
  }

  // ------------------------------------------------------------ lobby screen

  private showLobby() {
    this.mode = 'lobby';
    this.profileKey = '';
    this.joinKey = '';
    const s = el('div', 'screen dim');
    s.innerHTML = `<div class="panel lan-panel">
      <h2 data-title>${this.online ? '🌍 Partie en ligne' : '📱 Partie en réseau local'}</h2>
      <div class="lan-status" data-status></div>
      <div class="lan-grid">
        <div class="lan-join" data-join></div>
        <div class="lan-main">
          <h3>Joueurs</h3>
          <div class="lobby-list" data-players></div>
          <h3>Moi <small data-ping title="Temps d'aller-retour vers le serveur"></small></h3>
          <div data-profile></div>
          <h3>Réglages de la partie <small class="guest-only">(choisis par l'hôte 👑)</small></h3>
          <div class="opts" data-settings></div>
        </div>
      </div>
      <div class="foot">
        <button class="big" data-back>⬅ Quitter</button>
        <div class="row">
          <button class="big guest-only" data-ready>✋ Je suis prêt !</button>
          <button class="big primary host-only" data-start>Lancer la partie ▶</button>
        </div>
      </div></div>`;
    s.addEventListener('click', (e) => this.onClick(e));
    s.addEventListener('change', (e) => this.onChange(e));
    s.addEventListener('keydown', (e) => {
      const t = e.target as HTMLElement;
      if (t.tagName === 'INPUT' && e.key === 'Enter') (t as HTMLInputElement).blur();
    });
    this.scr = s;
    this.screens.show(s);
    this.render();
  }

  private myPlayers(): LobbyPlayer[] {
    const net = this.net;
    if (!net?.lobby) return [];
    return net.lobby.players.filter((p) => p.clientId === net.clientId).sort((a, b) => a.seat - b.seat);
  }

  private render() {
    const s = this.scr;
    const net = this.net;
    if (!s || !net || this.mode !== 'lobby') return;
    const lob = net.lobby;
    const q = <T extends HTMLElement>(sel: string) => s.querySelector(sel) as T;

    const title = net.room ? `🌍 Salon ${net.room}` : this.online ? '🌍 Partie en ligne' : '📱 Partie en réseau local';
    const h2 = q<HTMLElement>('[data-title]');
    if (h2.textContent !== title) h2.textContent = title;

    // Connection status.
    let status = '';
    if (net.status === 'connecting' || (net.status === 'open' && !lob)) status = '⏳ Connexion au serveur…';
    else if (net.status === 'lost') {
      status = '📡 Connexion perdue, nouvelle tentative…';
      if (net.failures >= 3) {
        status += this.online
          ? '<br><small>Vérifiez la connexion Internet. Si le serveur a redémarré, le salon n\'existe plus : créez-en un nouveau.</small>'
          : '<br><small>Le PC hôte doit lancer « npm run start » et tous les appareils doivent être sur le même Wi-Fi.</small>';
      }
    } else if (net.status === 'closed') status = `❌ ${esc(net.error || 'Déconnecté du serveur.')}`;
    else if (lob?.phase === 'game') status = '🎮 Une partie est en cours : tu joueras à la prochaine manche.';
    const st = q<HTMLElement>('[data-status]');
    setHtml(st, status);
    st.style.display = status ? '' : 'none';

    this.renderJoin(q('[data-join]'));
    if (!lob) return;

    // Players.
    const rows = lob.players.map((p) => {
      const mine = p.clientId === net.clientId;
      const role = p.role === 'tofu' ? '🐶 Tofu' : p.role === 'human' ? '🧑 Humain' : '⏳ Attend son tour';
      const dev = p.device === 'touch' ? '📱' : p.device === 'gamepad' ? '🎮' : '⌨️';
      const state = !p.connected ? '🔌 Parti' : p.clientId === lob.hostId ? '👑 Hôte' : p.ready ? '✅ Prêt' : '… pas prêt';
      const color = p.role === 'tofu' ? 'var(--tofu)' : hex(HUMAN_LOOKS[p.avatar % 4].shirt);
      const assign = net.host && p.role !== 'tofu' && p.connected ? `<button class="mini" data-assign="${esc(p.key)}" title="Ce joueur sera Tofu">En faire Tofu 🐶</button>` : '';
      // The host can send away someone who should not be there (twice to confirm).
      const kick = net.host && !mine && p.seat === 0 ? `<button class="mini" data-kick="${esc(p.key)}">${this.armed === p.key ? 'Confirmer ?' : 'Retirer'}</button>` : '';
      return `<div class="lobby-player ${mine ? 'me' : ''} ${p.connected ? '' : 'off'}">
        <span class="dot" style="background:${color}"></span><b>${esc(p.name)}</b>${mine ? '<small>(toi)</small>' : ''}<span>${dev}</span>
        <span class="role">${role}</span>${assign}${kick}<span class="ready">${state}</span></div>`;
    });
    if (lob.ai.tofu) rows.push('<div class="lobby-player ai"><span class="dot" style="background:var(--tofu)"></span><b>Tofu</b><span>🤖 ordinateur</span><span class="role">🐶 Tofu</span></div>');
    if (lob.ai.humans) rows.push(`<div class="lobby-player ai"><span class="dot" style="background:${hex(HUMAN_LOOKS[0].shirt)}"></span><b>Maman</b><span>🤖 ordinateur</span><span class="role">🧑 Humain</span></div>`);
    // Once everybody is in, the host can close the door to strangers.
    if (net.host) rows.push(`<div class="lock-line"><button class="mini" data-lock>${lob.locked ? '🔓 Rouvrir le salon aux nouveaux joueurs' : '🔒 Fermer le salon aux nouveaux joueurs'}</button></div>`);
    else if (lob.locked) rows.push('<div class="lock-line"><small>🔒 Salon fermé aux nouveaux joueurs</small></div>');
    const players = q<HTMLElement>('[data-players]');
    const html = rows.join('');
    setHtml(players, html);

    this.renderProfile(q('[data-profile]'), lob);
    // Updated every second on its own, so the buttons of the list stay put.
    const ping = net.rtt ? `📶 ${Math.round(net.rtt)} ms` : '';
    const pe = q<HTMLElement>('[data-ping]');
    if (pe.textContent !== ping) pe.textContent = ping;

    // Settings (host edits, others see).
    const dis = net.host ? '' : 'disabled';
    const seg = (k: string, opts: [string | number, string][], cur: string | number) =>
      `<div class="seg" data-k="${k}">${opts.map(([v, n]) => `<button ${dis} class="${cur === v ? 'sel' : ''}" data-v="${v}">${n}</button>`).join('')}</div>`;
    const set = lob.settings;
    const sh = `<span>Durée</span>${seg('dur', [[240, '4 min'], [360, '6 min'], [480, '8 min']], set.duration)}
      <span>Si personne ne veut être Tofu</span>${seg('fill', [[1, "L'ordinateur joue Tofu"], [0, 'Le premier joueur est Tofu']], set.fillAI ? 1 : 0)}
      <span>Ordinateur</span>${seg('diff', [[0, 'Facile'], [1, 'Normal'], [2, 'Difficile']], set.difficulty)}
      <span>Lieu</span>${seg('map', MAP_LIST.map((m) => [m.id, `${m.icon} ${m.name}`] as [string, string]), set.map ?? DEFAULT_MAP)}
      <span>Ambiance</span>${seg('variant', VARIANTS.filter((d) => getMap(set.map ?? DEFAULT_MAP).variants.includes(d.id)).map((d) => [d.id, `${d.icon} ${d.id === 'marche' ? 'Marché' : d.name}`] as [string, string]), set.variant ?? 'ete')}`;
    const se = q<HTMLElement>('[data-settings]');
    setHtml(se, sh);

    // Footer.
    const me = this.myPlayers()[0];
    const rb = q<HTMLButtonElement>('[data-ready]');
    rb.textContent = me?.ready ? '✅ Prêt ! (annuler)' : '✋ Je suis prêt !';
    rb.classList.toggle('primary', !me?.ready);
    rb.disabled = lob.phase !== 'lobby';
    const guests = lob.players.filter((p) => p.connected && p.clientId !== lob.hostId);
    const ready = guests.filter((p) => p.ready).length;
    const sb = q<HTMLButtonElement>('[data-start]');
    sb.innerHTML = `Lancer la partie ▶${guests.length ? `<small>${ready} / ${guests.length} prêt${guests.length > 1 ? 's' : ''}</small>` : ''}`;
    sb.disabled = lob.phase !== 'lobby' || net.status !== 'open';
  }

  /** Online room: its code, the link to share and its QR code. */
  private renderShare(box: HTMLElement) {
    const net = this.net!;
    const base = (net.publicUrl || (LOCAL_HOSTS.includes(location.hostname) ? '' : location.origin)).replace(/\/+$/, '');
    const link = net.room && base ? `${base}/?salon=${net.room}` : '';
    const key = `share|${net.room}|${link}`;
    if (key === this.joinKey) return;
    this.joinKey = key;
    if (!net.room) {
      box.innerHTML = '';
      return;
    }
    let qrSvg = '';
    if (link) {
      const qr = qrcode(0, 'M');
      qr.addData(link);
      qr.make();
      qrSvg = `<div class="qr">${qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true })}</div>`;
    }
    const canShare = typeof navigator.share === 'function';
    box.innerHTML = `<p>Code du salon :</p><div class="room-code">${net.room}</div>
      ${link ? `<p><b>Pour inviter :</b> envoyez ce lien, ou faites scanner le code QR.</p>
      <div class="url">${esc(link)}</div>
      <div class="row"><button class="big" data-copy>📋 Copier le lien</button>${canShare ? '<button class="big" data-share>📤 Partager</button>' : ''}</div>
      ${qrSvg}` : `<p class="small">Pour obtenir le lien à partager, ouvrez le jeu par son adresse publique (celle du tunnel ou du serveur), pas par « localhost ».</p>`}
      <p class="small">On peut aussi ouvrir le jeu, choisir « Jouer en ligne » et taper le code.</p>`;
  }

  private async copyLink(b: HTMLButtonElement) {
    const link = this.scr?.querySelector('.lan-join .url')?.textContent ?? '';
    try {
      await navigator.clipboard.writeText(link);
      b.textContent = '✅ Lien copié !';
    } catch {
      // No clipboard access: select the link so that it can be copied by hand.
      const u = this.scr?.querySelector('.lan-join .url');
      if (u) getSelection()?.selectAllChildren(u);
      b.textContent = '👆 Copiez le lien sélectionné';
    }
    setTimeout(() => (b.textContent = '📋 Copier le lien'), 2500);
  }

  /** QR code and address for the other devices. */
  private renderJoin(box: HTMLElement) {
    const net = this.net!;
    if (this.online) {
      this.renderShare(box);
      return;
    }
    const local = LOCAL_HOSTS.includes(location.hostname);
    const url = local ? net.lanUrls[0] : `${location.protocol}//${location.host}/`;
    const key = `${url}|${net.lanUrls.join(',')}`;
    if (key === this.joinKey) return;
    this.joinKey = key;
    if (!url) {
      box.innerHTML = net.status === 'open'
        ? '<p class="err">Aucune adresse Wi-Fi trouvée sur ce PC.</p><p>Vérifiez qu\'il est connecté au réseau de la maison, puis relancez « npm run start ».</p>'
        : '';
      return;
    }
    const qr = qrcode(0, 'M');
    qr.addData(url);
    qr.make();
    const others = local ? net.lanUrls.slice(1) : [];
    box.innerHTML = `<div class="qr">${qr.createSvgTag({ cellSize: 4, margin: 2, scalable: true })}</div>
      <p><b>Pour rejoindre :</b> scannez ce code avec l'appareil photo du téléphone, ou tapez l'adresse :</p>
      <div class="url">${esc(url)}</div>
      ${others.length ? `<p class="small">Autres adresses de ce PC : ${others.map(esc).join(', ')}</p>` : ''}
      <p class="small">Tous les appareils doivent être sur le même Wi-Fi.</p>`;
  }

  /** My seats: name, wished role, look. Rebuilt only when they change, so typing is never interrupted. */
  private renderProfile(box: HTMLElement, lob: LobbyMsg) {
    const mine = this.myPlayers();
    const multi = mine.length > 1;
    const canAdd = !isTouch() && lob.phase === 'lobby' && mine.length < MAX_SEATS_PER_CLIENT && lob.players.length < 5;
    const key = JSON.stringify([mine.map((p) => [p.seat, p.pref, p.avatar, p.role]), canAdd, lob.phase]);
    if (key === this.profileKey) return;
    this.profileKey = key;
    const focused = document.activeElement as HTMLInputElement | null;
    const typing = focused && box.contains(focused) && focused.tagName === 'INPUT' ? { seat: focused.dataset.name, value: focused.value } : null;
    const prefs: [RolePref, string][] = [['tofu', '🐶 Tofu'], ['human', '🧑 Humain'], ['any', '🎲 Peu importe']];
    box.innerHTML = mine.map((p) => `<div class="lan-seat">
      ${multi ? `<h4>Joueur ${p.seat + 1} · <small>${SEAT_CONTROLS[p.seat]}</small>${p.seat > 0 ? ` <button class="mini" data-remove="${p.seat}">Retirer</button>` : ''}</h4>` : ''}
      <div class="opts">
        <span>Prénom</span><div class="namerow"><input type="text" maxlength="16" data-name="${p.seat}" value="${esc(p.name)}" autocomplete="off" enterkeyhint="done" aria-label="Prénom"><button class="mini dice" data-dice="${p.seat}" title="Un prénom au hasard">🎲</button></div>
        <span>Je veux jouer</span><div class="seg" data-k="pref" data-seat="${p.seat}">${prefs.map(([v, n]) => `<button class="${p.pref === v ? 'sel' : ''}" data-v="${v}">${n}</button>`).join('')}</div>
        <span>Si je suis humain</span><div class="seg" data-k="avatar" data-seat="${p.seat}">${HUMAN_LOOKS.slice(0, 4).map((l, i) => `<button class="${p.avatar === i ? 'sel' : ''}" data-v="${i}">${l.name}</button>`).join('')}</div>
      </div></div>`).join('')
      + (canAdd ? '<button class="big" data-add>➕ Ajouter un joueur sur ce PC <small>écran partagé : clavier gauche, clavier droit ou manettes</small></button>' : '');
    if (typing?.seat !== undefined) {
      const inp = box.querySelector(`input[data-name="${typing.seat}"]`) as HTMLInputElement | null;
      if (inp) {
        inp.value = typing.value;
        inp.focus();
      }
    }
  }

  private onClick(e: Event) {
    const net = this.net;
    const b = (e.target as HTMLElement).closest('button') as HTMLButtonElement | null;
    if (!b || b.disabled || !net) return;
    sfx.play('click');
    if (b.hasAttribute('data-back')) {
      this.screens.showTitle();
      return;
    }
    if (b.hasAttribute('data-ready')) {
      net.send({ t: 'ready', ready: !this.myPlayers()[0]?.ready });
      return;
    }
    if (b.hasAttribute('data-lock')) {
      net.send({ t: 'lock', locked: !net.lobby?.locked });
      return;
    }
    if (b.hasAttribute('data-copy')) {
      void this.copyLink(b);
      return;
    }
    if (b.hasAttribute('data-share')) {
      const link = this.scr?.querySelector('.lan-join .url')?.textContent ?? '';
      navigator.share?.({ title: 'TOFU ! Qui a fait ça ?', text: `Viens jouer avec nous ! Salon ${net.room}`, url: link }).catch(() => undefined);
      return;
    }
    if (b.dataset.kick) {
      if (this.armed === b.dataset.kick) {
        this.armed = '';
        net.send({ t: 'kick', key: b.dataset.kick });
      } else {
        const key = b.dataset.kick;
        this.armed = key;
        setTimeout(() => {
          if (this.armed === key) {
            this.armed = '';
            this.render();
          }
        }, 4000);
      }
      this.render();
      return;
    }
    if (b.hasAttribute('data-start')) {
      net.send({ t: 'start' });
      return;
    }
    if (b.dataset.assign) {
      net.send({ t: 'assign', key: b.dataset.assign, role: 'tofu' });
      return;
    }
    if (b.hasAttribute('data-add')) {
      const used = new Set(net.lobby?.players.map((p) => p.name));
      const name = NAMES.find((n) => !used.has(n)) ?? 'Joueur';
      const seat: SeatReq = { name, avatar: net.seats.length % 4, pref: 'any', device: 'keyboard' };
      net.seats.push(seat);
      net.send({ t: 'add_seat', seat });
      return;
    }
    if (b.dataset.dice) {
      const i = Number(b.dataset.dice);
      const used = new Set(net.lobby?.players.map((p) => p.name));
      const free = FUN_NAMES.filter((n) => !used.has(n));
      const name = free[Math.floor(Math.random() * free.length)] ?? 'Joueur';
      const inp = this.scr?.querySelector(`input[data-name="${i}"]`) as HTMLInputElement | null;
      if (inp) inp.value = name;
      this.setName(i, name);
      return;
    }
    if (b.dataset.remove) {
      const i = Number(b.dataset.remove);
      net.seats.splice(i, 1);
      net.send({ t: 'remove_seat', seat: i });
      return;
    }
    const seg = b.closest('.seg') as HTMLElement | null;
    if (!seg) return;
    const k = seg.dataset.k;
    const v = b.dataset.v!;
    const seatIdx = Number(seg.dataset.seat ?? 0);
    const seat = net.seats[seatIdx];
    if (k === 'pref') {
      if (seat) seat.pref = v as RolePref;
      net.send({ t: 'seat', seat: seatIdx, pref: v as RolePref });
    } else if (k === 'avatar') {
      if (seat) seat.avatar = Number(v);
      net.send({ t: 'seat', seat: seatIdx, avatar: Number(v) });
      if (seatIdx === 0) {
        this.screens.prefs.avatar = Number(v);
        savePrefs(this.screens.prefs);
      }
    } else if (k === 'dur') net.send({ t: 'settings', settings: { duration: Number(v) } });
    else if (k === 'fill') net.send({ t: 'settings', settings: { fillAI: v === '1' } });
    else if (k === 'diff') net.send({ t: 'settings', settings: { difficulty: Number(v) } });
    else if (k === 'variant' && isVariant(v)) net.send({ t: 'settings', settings: { variant: v } });
    else if (k === 'map' && isMapId(v)) net.send({ t: 'settings', settings: { map: v } });
  }

  private onChange(e: Event) {
    const net = this.net;
    const t = e.target as HTMLInputElement;
    if (!net || t.dataset.name === undefined) return;
    this.setName(Number(t.dataset.name), t.value);
  }

  private setName(i: number, value: string) {
    const net = this.net;
    if (!net) return;
    const name = value.replace(/[<>&"'`]/g, '').trim().slice(0, 16) || 'Joueur';
    if (net.seats[i]) net.seats[i].name = name;
    net.send({ t: 'seat', seat: i, name });
    if (i === 0) {
      this.screens.prefs.name = name;
      savePrefs(this.screens.prefs);
    }
  }
}
