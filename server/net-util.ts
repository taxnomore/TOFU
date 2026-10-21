import os from 'node:os';

/** LAN IPv4 addresses, most likely home Wi-Fi addresses first. */
export function lanAddresses(): string[] {
  const out: { ip: string; score: number }[] = [];
  const ifs = os.networkInterfaces();
  for (const [name, list] of Object.entries(ifs)) {
    for (const a of list ?? []) {
      if (a.family !== 'IPv4' || a.internal) continue;
      let score = 0;
      if (a.address.startsWith('192.168.')) score += 3;
      else if (a.address.startsWith('10.')) score += 2;
      else if (/^172\.(1[6-9]|2\d|3[01])\./.test(a.address)) score += 1;
      if (/^(wl|wi|en|eth)/i.test(name)) score += 1;
      if (/docker|veth|br-|virbr|vmnet|tailscale|zt/i.test(name)) score -= 5;
      out.push({ ip: a.address, score });
    }
  }
  return out.sort((a, b) => b.score - a.score).map((o) => o.ip);
}
