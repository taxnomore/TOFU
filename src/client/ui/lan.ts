// LAN multiplayer: lobby screen (QR code, players, roles, settings) and the
// glue between the server connection and network game sessions.
import qrcode from 'qrcode-generator';
import { VARIANTS, isVariant } from '../../shared/world/variants';
import { MAX_SEATS_PER_CLIENT } from '../../shared/net/protocol';
import type { LobbyPlayer, RolePref, SeatReq } from '../../shared/net/protocol';
import { sfx } from '../audio/sfx';
import { InputDevice, KEYMAPS, KeyboardDevice } from '../input/devices';
import { HUMAN_LOOKS } from '../render/characters';
import { LobbyMsg, NetClient, NetStatus, StartMsg } from '../runtime/netClient';
import { NetSession } from '../runtime/netSession';
import type { LocalPlayer } from '../runtime/session';
import { el } from './hud';
import { LazyPad, MultiDevice, Screens, isTouch, savePrefs } from './screens';

const NAMES = ['Léa', 'Hugo', 'Chloé', 'Lucas', 'Emma', 'Nathan', 'Jade', 'Louis', 'Inès', 'Tom', 'Zoé', 'Noé'];
const SEAT_CONTROLS = ['Clavier gauche (ZQSD/WASD) ou manette 1', 'Clavier droit (flèches) ou manette 2', 'Manette 3'];

const esc = (s: string) => s.replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);
const hex = (n: number) => '#' + n.toString(16).padStart(6, '0');

export function installLan(screens: Screens) {
  screens.lan = new Lan(screens);
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

  constructor(private screens: Screens) {}

  isActive() {
    return this.mode !== 'off';
  }

  isHost() {
    return !!this.net?.host;
  }

  open() {
    if (location.protocol === 'file:') {
      this.showNeedsServer();
      return;
    }
    if (!this.net) {
      const p = this.screens.prefs;
      const name = p.name || NAMES[Math.floor(Math.random() * NAMES.length)];
      const seat: SeatReq = { name, avatar: p.avatar, pref: 'any', device: isTouch() ? 'touch' : 'keyboard' };
      const net = new NetClient([seat]);
      net.onLobby = (m) => this.onLobby(m);
      net.onStart = (m) => this.onStart(m);
      net.onStatus = (s) => this.onStatus(s);
      this.net = net;
      net.connect();
      this.watchdog = setInterval(() => this.checkLink(), 1000);
    }
    this.showLobby();
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
      <p>Ce fichier suffit pour jouer seul ou à plusieurs sur ce PC (écran partagé).</p>
      <div class="foot"><button class="big primary" data-back>⬅ Retour</button></div></div>`;
    s.querySelector('[data-back]')!.addEventListener('click', () => {
      sfx.play('click');
      this.screens.showTitle();
    });
    this.screens.show(s);
  }

  leave() {
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
    if (this.mode === 'lobby') this.render();
    else if (this.mode === 'game') {
      if (s === 'open') this.setBanner('');
      else if (s === 'closed') this.setBanner(`❌ ${esc(this.net?.error || 'Déconnecté du serveur.')}`, true);
      else this.setBanner('📡 Connexion perdue… reconnexion en cours');
    }
  }

  /** Warns when snapshots stop arriving (weak Wi-Fi) before the socket notices. */
  private checkLink() {
    if (this.mode !== 'game' || !this.session || !this.net?.connected) return;
    const gap = performance.now() - this.session.lastSnapAt;
    if (gap > 2500) this.setBanner('📡 Connexion instable…');
    else if (this.banner && !this.banner.classList.contains('fatal')) this.setBanner('');
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
      this.banner.innerHTML = `${html} <button class="big" data-quit>🏠 Menu</button>`;
      this.banner.querySelector('[data-quit]')!.addEventListener('click', () => this.screens.showTitle());
    } else if (this.banner.innerHTML !== html) this.banner.innerHTML = html;
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
      <h2>📱 Partie en réseau local</h2>
      <div class="lan-status" data-status></div>
      <div class="lan-grid">
        <div class="lan-join" data-join></div>
        <div class="lan-main">
          <h3>Joueurs</h3>
          <div class="lobby-list" data-players></div>
          <h3>Moi</h3>
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

    // Connection status.
    let status = '';
    if (net.status === 'connecting' || (net.status === 'open' && !lob)) status = '⏳ Connexion au serveur…';
    else if (net.status === 'lost') {
      status = '📡 Connexion perdue, nouvelle tentative…';
      if (net.failures >= 3) {
        status += '<br><small>Le PC hôte doit lancer « npm run start » et tous les appareils doivent être sur le même Wi-Fi.</small>';
      }
    } else if (net.status === 'closed') status = `❌ ${esc(net.error || 'Déconnecté du serveur.')}`;
    else if (lob?.phase === 'game') status = '🎮 Une partie est en cours : tu joueras à la prochaine manche.';
    const st = q<HTMLElement>('[data-status]');
    if (st.innerHTML !== status) st.innerHTML = status;
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
      return `<div class="lobby-player ${mine ? 'me' : ''} ${p.connected ? '' : 'off'}">
        <span class="dot" style="background:${color}"></span><b>${esc(p.name)}</b>${mine ? '<small>(toi)</small>' : ''}<span>${dev}</span>
        <span class="role">${role}</span>${assign}<span class="ready">${state}</span></div>`;
    });
    if (lob.ai.tofu) rows.push('<div class="lobby-player ai"><span class="dot" style="background:var(--tofu)"></span><b>Tofu</b><span>🤖 ordinateur</span><span class="role">🐶 Tofu</span></div>');
    if (lob.ai.humans) rows.push(`<div class="lobby-player ai"><span class="dot" style="background:${hex(HUMAN_LOOKS[0].shirt)}"></span><b>Maman</b><span>🤖 ordinateur</span><span class="role">🧑 Humain</span></div>`);
    const players = q<HTMLElement>('[data-players]');
    const html = rows.join('');
    if (players.innerHTML !== html) players.innerHTML = html;

    this.renderProfile(q('[data-profile]'), lob);

    // Settings (host edits, others see).
    const dis = net.host ? '' : 'disabled';
    const seg = (k: string, opts: [string | number, string][], cur: string | number) =>
      `<div class="seg" data-k="${k}">${opts.map(([v, n]) => `<button ${dis} class="${cur === v ? 'sel' : ''}" data-v="${v}">${n}</button>`).join('')}</div>`;
    const set = lob.settings;
    const sh = `<span>Durée</span>${seg('dur', [[240, '4 min'], [360, '6 min'], [480, '8 min']], set.duration)}
      <span>Si personne ne veut être Tofu</span>${seg('fill', [[1, "L'ordinateur joue Tofu"], [0, 'Le premier joueur est Tofu']], set.fillAI ? 1 : 0)}
      <span>Ordinateur</span>${seg('diff', [[0, 'Facile'], [1, 'Normal'], [2, 'Difficile']], set.difficulty)}
      <span>Ambiance</span>${seg('variant', VARIANTS.map((d) => [d.id, `${d.icon} ${d.id === 'marche' ? 'Marché' : d.name}`] as [string, string]), set.variant ?? 'ete')}`;
    const se = q<HTMLElement>('[data-settings]');
    if (se.innerHTML !== sh.replace(/\n\s+/g, '\n')) se.innerHTML = sh.replace(/\n\s+/g, '\n');

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

  /** QR code and address for the other devices. */
  private renderJoin(box: HTMLElement) {
    const net = this.net!;
    const local = ['localhost', '127.0.0.1', '::1', '[::1]'].includes(location.hostname);
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
        <span>Prénom</span><input type="text" maxlength="16" data-name="${p.seat}" value="${esc(p.name)}" autocomplete="off" enterkeyhint="done">
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
  }

  private onChange(e: Event) {
    const net = this.net;
    const t = e.target as HTMLInputElement;
    if (!net || t.dataset.name === undefined) return;
    const i = Number(t.dataset.name);
    const name = t.value.replace(/[<>&"'`]/g, '').trim().slice(0, 16) || 'Joueur';
    if (net.seats[i]) net.seats[i].name = name;
    net.send({ t: 'seat', seat: i, name });
    if (i === 0) {
      this.screens.prefs.name = name;
      savePrefs(this.screens.prefs);
    }
  }
}
