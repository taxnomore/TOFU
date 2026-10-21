// LAN room (placeholder until the multiplayer milestone).
import type { WebSocket } from 'ws';

export class Room {
  connect(ws: WebSocket, _addr: string): void {
    ws.send(JSON.stringify({ t: 'error', msg: 'Le multijoueur réseau arrive bientôt.' }));
    ws.close();
  }
}
