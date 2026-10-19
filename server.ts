import express from 'express';
import { createServer as createViteServer } from 'vite';
import net from 'net';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function isPrivateRfc1918Ip(host: string): boolean {
  const clean = host.trim();
  if (clean.startsWith('10.')) return true;
  if (clean.startsWith('192.168.')) return true;
  if (clean.startsWith('127.')) return true;
  const parts = clean.split('.');
  if (parts.length === 4 && parts[0] === '172') {
    const second = Number(parts[1]);
    if (second >= 16 && second <= 31) return true;
  }
  return false;
}

function probeTcpPort(
  host: string,
  port: number,
  timeoutMs = 3500
): Promise<{
  port: number;
  open: boolean;
  latencyMs: number | null;
  banner: string;
  error?: string;
}> {
  return new Promise((resolve) => {
    const start = Date.now();
    const socket = new net.Socket();
    let settled = false;
    let bannerBuf = '';

    const finish = (
      open: boolean,
      latencyMs: number | null,
      banner: string,
      error?: string
    ) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      resolve({ port, open, latencyMs, banner: banner.trim(), error });
    };

    socket.setTimeout(timeoutMs);

    socket.on('connect', () => {
      const latency = Date.now() - start;
      // Wait briefly to see if SSH or Telnet sends a banner
      setTimeout(() => {
        finish(true, latency, bannerBuf);
      }, 350);
    });

    socket.on('data', (chunk) => {
      // Strip Telnet IAC control bytes (0xFF ..) and keep printable ASCII
      const printable = chunk
        .toString('latin1')
        .replace(/[\x00-\x1F\x7F-\xFF]/g, ' ')
        .trim();
      if (printable) {
        bannerBuf += ' ' + printable;
      }
    });

    socket.on('timeout', () => {
      finish(false, null, '', `Connection timeout (${timeoutMs}ms)`);
    });

    socket.on('error', (err: Error) => {
      finish(false, null, '', err.message);
    });

    socket.connect(port, host);
  });
}

function stripTelnetIac(buffer: Buffer): string {
  const out: number[] = [];
  let i = 0;
  while (i < buffer.length) {
    if (buffer[i] === 0xff && i + 2 < buffer.length) {
      // Skip 3-byte Telnet IAC command sequence
      i += 3;
    } else {
      const byte = buffer[i];
      if ((byte >= 32 && byte <= 126) || byte === 10 || byte === 13 || byte === 9) {
        out.push(byte);
      }
      i++;
    }
  }
  return Buffer.from(out).toString('utf8');
}

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // 1. Real TCP Port Prober for Active OLT / Network Device
  app.post('/api/olt/probe', async (req, res) => {
    try {
      const { host, ports = [23, 22, 830, 80] } = req.body as {
        host?: string;
        ports?: number[];
      };

      if (!host || typeof host !== 'string') {
        res.status(400).json({ error: 'IP Address atau Hostname OLT wajib diisi.' });
        return;
      }

      const cleanHost = host.trim();
      const privateIpWarning = isPrivateRfc1918Ip(cleanHost)
        ? 'IP yang dimasukkan adalah IP Private lokal (RFC1918). Jika aplikasi dijalankan di Cloud AI Studio, pastikan OLT memiliki IP Publik / Port Forwarding atau jalankan aplikasi ini di server lokal NOC yang satu VLAN Management dengan OLT.'
        : null;

      const results = await Promise.all(
        ports.slice(0, 6).map((p) => probeTcpPort(cleanHost, Number(p), 3500))
      );

      res.json({
        host: cleanHost,
        timestamp: new Date().toISOString(),
        isPrivateIp: isPrivateRfc1918Ip(cleanHost),
        privateIpWarning,
        results,
      });
    } catch (err: any) {
      res.status(500).json({ error: err?.message || 'Gagal melakukan probe TCP.' });
    }
  });

  // 2. Real Live Telnet / Raw TCP Session Executor for Active OLTs
  app.post('/api/olt/telnet-exec', async (req, res) => {
    const {
      host,
      port = 23,
      username = '',
      password = '',
      commands = [],
      timeoutMs = 7000,
    } = req.body as {
      host?: string;
      port?: number;
      username?: string;
      password?: string;
      commands?: string[];
      timeoutMs?: number;
    };

    if (!host || typeof host !== 'string') {
      res.status(400).json({ error: 'Host/IP OLT wajib diisi.' });
      return;
    }

    const cleanHost = host.trim();
    const targetPort = Number(port) || 23;

    const socket = new net.Socket();
    let transcript = '';
    let finished = false;

    const finalize = (success: boolean, errorMsg?: string) => {
      if (finished) return;
      finished = true;
      socket.destroy();
      res.json({
        success,
        host: cleanHost,
        port: targetPort,
        isPrivateIp: isPrivateRfc1918Ip(cleanHost),
        transcript: transcript || '(Tidak ada output teks yang diterima dari perangkat)',
        error: errorMsg,
      });
    };

    socket.setTimeout(Math.min(Number(timeoutMs) || 7000, 9500));

    socket.on('data', (data: Buffer) => {
      transcript += stripTelnetIac(data);
    });

    socket.on('timeout', () => {
      finalize(
        transcript.length > 0,
        transcript.length > 0
          ? undefined
          : `Koneksi ke ${cleanHost}:${targetPort} timeout. Pastikan IP dapat dijangkau dari server.`
      );
    });

    socket.on('error', (err: Error) => {
      finalize(false, `Koneksi gagal (${err.message})`);
    });

    socket.connect(targetPort, cleanHost, () => {
      const sequence: string[] = [];
      if (username.trim()) sequence.push(username.trim());
      if (password.trim()) sequence.push(password.trim());
      sequence.push(...commands);

      let step = 0;
      const interval = setInterval(() => {
        if (finished || socket.destroyed) {
          clearInterval(interval);
          return;
        }
        if (step < sequence.length) {
          socket.write(sequence[step] + '\r\n');
          step++;
        } else {
          clearInterval(interval);
          setTimeout(() => {
            finalize(true);
          }, 900);
        }
      }, 450);
    });
  });

  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*all', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`OptiCore EMS/NMS Server running on http://0.0.0.0:${PORT}`);
  });
}

startServer();
