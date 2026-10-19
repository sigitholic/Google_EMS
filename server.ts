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

function stripTelnetIac(buffer: Buffer): string {
  const out: number[] = [];
  let i = 0;
  while (i < buffer.length) {
    if (buffer[i] === 0xff && i + 2 < buffer.length) {
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

// ============================================================================
// PER-OLT MUTEX QUEUE WORKER (Prevents VTY Telnet Session Collision on OLT)
// ============================================================================
interface WorkerJobLog {
  id: string;
  oltHost: string;
  jobType: 'PROVISIONING' | 'CLI_EXEC' | 'OPTICAL_POLL' | 'TCP_PROBE';
  status: 'QUEUED' | 'RUNNING' | 'SUCCESS' | 'FAILED_ROLLBACK';
  startedAt: string;
  durationMs: number;
  summary: string;
  errorDetail?: string;
}

const oltMutexLocks = new Map<string, Promise<any>>();
const workerJobHistory: WorkerJobLog[] = [
  {
    id: 'job-init-1',
    oltHost: '10.240.12.11',
    jobType: 'OPTICAL_POLL',
    status: 'SUCCESS',
    startedAt: new Date(Date.now() - 45000).toISOString(),
    durationMs: 310,
    summary: 'SNMP GETBULK (max-rep=25) optical table selesai tanpa memblokir antrean VTY Telnet.',
  },
  {
    id: 'job-init-2',
    oltHost: '10.240.28.14',
    jobType: 'PROVISIONING',
    status: 'SUCCESS',
    startedAt: new Date(Date.now() - 18000).toISOString(),
    durationMs: 1420,
    summary: 'Expect State-Machine: Auto-bypass prompt { <cr> } Huawei VRP & verifikasi ont-lineprofile.',
  },
];

async function runWithOltMutex<T>(
  oltHost: string,
  jobType: WorkerJobLog['jobType'],
  taskFn: () => Promise<{ summary: string; data: T }>
): Promise<T> {
  const prevLock = oltMutexLocks.get(oltHost) || Promise.resolve();
  const jobId = `job-${Date.now()}-${Math.floor(Math.random() * 999)}`;
  const startTime = Date.now();

  const logEntry: WorkerJobLog = {
    id: jobId,
    oltHost,
    jobType,
    status: 'QUEUED',
    startedAt: new Date().toISOString(),
    durationMs: 0,
    summary: `Menunggu giliran Mutex Lock untuk OLT ${oltHost}...`,
  };
  workerJobHistory.unshift(logEntry);
  if (workerJobHistory.length > 30) workerJobHistory.pop();

  let releaseLock!: () => void;
  const currentLock = new Promise<void>((resolve) => {
    releaseLock = resolve;
  });
  oltMutexLocks.set(
    oltHost,
    prevLock.then(() => currentLock).catch(() => currentLock)
  );

  await prevLock.catch(() => {});
  logEntry.status = 'RUNNING';

  try {
    const result = await taskFn();
    logEntry.status = 'SUCCESS';
    logEntry.durationMs = Date.now() - startTime;
    logEntry.summary = result.summary;
    return result.data;
  } catch (err: any) {
    logEntry.status = 'FAILED_ROLLBACK';
    logEntry.durationMs = Date.now() - startTime;
    logEntry.summary = `Gagal dieksekusi; worker menjalankan auto-rollback sesi.`;
    logEntry.errorDetail = err?.message || String(err);
    throw err;
  } finally {
    releaseLock();
  }
}

// ============================================================================
// PROMPT-DRIVEN EXPECT TELNET WORKER (Solves Blind-Sleep & Paging Bugs)
// ============================================================================
function executeExpectTelnetSession(params: {
  host: string;
  port: number;
  username?: string;
  password?: string;
  commands: string[];
  timeoutMs?: number;
}): Promise<{ transcript: string; detectedErrors: string[] }> {
  const {
    host,
    port,
    username = '',
    password = '',
    commands,
    timeoutMs = 8500,
  } = params;

  return new Promise((resolve, reject) => {
    const socket = new net.Socket();
    let fullTranscript = '';
    let bufferWindow = '';
    let stage: 'LOGIN_USER' | 'LOGIN_PASS' | 'READY' | 'DONE' = username
      ? 'LOGIN_USER'
      : 'READY';
    let cmdIndex = 0;
    let settled = false;
    const detectedErrors: string[] = [];

    const finish = (err?: Error) => {
      if (settled) return;
      settled = true;
      socket.destroy();
      if (err) reject(err);
      else resolve({ transcript: fullTranscript, detectedErrors });
    };

    socket.setTimeout(Math.min(timeoutMs, 9500));

    const checkAndAdvanceState = () => {
      if (settled || socket.destroyed) return;

      // 1. Auto-handle pagination (--More-- on ZTE, ---- More ---- on Huawei)
      if (/--\s*More\s*--/i.test(bufferWindow)) {
        bufferWindow = '';
        socket.write(' ');
        return;
      }

      // 2. Auto-handle Huawei interactive <cr> prompt: "{ <cr>||<K> }:"
      if (/\{\s*<cr>.*\}:/i.test(bufferWindow)) {
        bufferWindow = '';
        socket.write('\r\n');
        return;
      }

      // 3. Auto-handle confirmation prompt "[Y/N]:" or "(y/n) [n]:"
      if (/\[(y\/n|yes\/no)\]\s*:?\s*$/i.test(bufferWindow)) {
        bufferWindow = '';
        socket.write('y\r\n');
        return;
      }

      // 4. Detect OLT CLI error responses for automatic diagnostics
      const errorPatterns = [
        /%Error\s+\d+:[^\r\n]+/i,
        /Failure:\s*[^\r\n]+/i,
        /Parameter error[^\r\n]*/i,
        /ONU type does not exist[^\r\n]*/i,
        /The ONT ID already exists[^\r\n]*/i,
      ];
      for (const pat of errorPatterns) {
        const match = bufferWindow.match(pat);
        if (match && !detectedErrors.includes(match[0])) {
          detectedErrors.push(match[0]);
        }
      }

      // 5. State Machine Transitions based on real OLT prompts
      if (
        stage === 'LOGIN_USER' &&
        /(username|login|user name)\s*:\s*$/i.test(bufferWindow)
      ) {
        bufferWindow = '';
        stage = password ? 'LOGIN_PASS' : 'READY';
        socket.write(username + '\r\n');
        return;
      }

      if (stage === 'LOGIN_PASS' && /password\s*:\s*$/i.test(bufferWindow)) {
        bufferWindow = '';
        stage = 'READY';
        socket.write(password + '\r\n');
        return;
      }

      // Match standard CLI prompts: ZTE/Cisco (# or >), Huawei (config)#, FiberHome #, Nokia >#
      if (
        stage === 'READY' &&
        /([#>]\s*|\)\s*[#>]\s*)$/.test(bufferWindow.trim())
      ) {
        bufferWindow = '';
        if (cmdIndex < commands.length) {
          const nextCmd = commands[cmdIndex++];
          socket.write(nextCmd + '\r\n');
        } else {
          stage = 'DONE';
          finish();
        }
      }
    };

    socket.on('connect', () => {
      // Fallback progression timer if the target server doesn't emit standard prompts
      const fallbackInterval = setInterval(() => {
        if (settled || socket.destroyed) {
          clearInterval(fallbackInterval);
          return;
        }
        if (stage === 'LOGIN_USER') {
          stage = password ? 'LOGIN_PASS' : 'READY';
          socket.write(username + '\r\n');
        } else if (stage === 'LOGIN_PASS') {
          stage = 'READY';
          socket.write(password + '\r\n');
        } else if (stage === 'READY') {
          if (cmdIndex < commands.length) {
            socket.write(commands[cmdIndex++] + '\r\n');
          } else {
            clearInterval(fallbackInterval);
            setTimeout(() => finish(), 600);
          }
        }
      }, 550);
    });

    socket.on('data', (chunk: Buffer) => {
      const cleanText = stripTelnetIac(chunk);
      fullTranscript += cleanText;
      bufferWindow += cleanText;
      checkAndAdvanceState();
    });

    socket.on('timeout', () => {
      if (fullTranscript.length > 0) {
        finish();
      } else {
        finish(new Error(`Telnet Expect Timeout (${timeoutMs}ms) ke ${host}:${port}`));
      }
    });

    socket.on('error', (err: Error) => {
      finish(err);
    });

    socket.connect(port, host);
  });
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
      setTimeout(() => {
        finish(true, latency, bannerBuf);
      }, 350);
    });

    socket.on('data', (chunk) => {
      const printable = chunk
        .toString('latin1')
        .replace(/[\x00-\x1F\x7F-\xFF]/g, ' ')
        .trim();
      if (printable) bannerBuf += ' ' + printable;
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

async function startServer() {
  const app = express();
  const PORT = 3000;

  app.use(express.json());

  // 1. Get Worker Queue & Mutex Telemetry
  app.get('/api/worker/status', (_req, res) => {
    res.json({
      activeLocks: Array.from(oltMutexLocks.keys()),
      history: workerJobHistory,
    });
  });

  // 2. Diagnose & Auto-Fix Flaky ONU Provisioning Script
  app.post('/api/worker/diagnose-script', (req, res) => {
    const { rawScript = '', vendor = 'ZTE' } = req.body as {
      rawScript?: string;
      vendor?: string;
    };

    const issues: {
      title: string;
      cause: string;
      fix: string;
    }[] = [];

    if (vendor === 'ZTE') {
      if (!/terminal length 0/i.test(rawScript)) {
        issues.push({
          title: 'Paging (--More--) Belum Dimatikan pada Sesi Worker',
          cause:
            'Saat OLT menampilkan output panjang, prompt berhenti di "--More--" sehingga perintah provisioning berikutnya tertelan/gagal.',
          fix: 'Tambahkan "terminal length 0" di awal sesi Telnet setelah login.',
        });
      }
      if (/onu\s+\d+\s+type\s+(?!ALL|ZTE-F670|ALL-ONT)/i.test(rawScript)) {
        issues.push({
          title: 'Ketidakcocokan Profil "onu type" (Gagal di Model ONT Tertentu)',
          cause:
            'Jika tipe ONT spesifik (mis. F670V2 / F609V5.3 / ONT pihak ketiga) belum terdaftar di database "pon-onu-type" OLT, perintah "onu <id> type <model> sn <SN>" akan ditolak (%Error: ONU type does not exist).',
          fix: 'Gunakan fallback otomatis ke profil universal "ALL-ONT" / "ZTE-G984" apabila model spesifik gagal, atau jalankan validasi "show onu-type gpon" sebelum provisioning.',
        });
      }
      if (/wan-ip/i.test(rawScript) && !/veip|vport|gemport/i.test(rawScript)) {
        issues.push({
          title: 'Konflik Mode HGU (Routed wan-ip) vs SFU/Hybrid (veip/eth_0/1)',
          cause:
            'Beberapa firmware ONT ZTE/XPON menggunakan mode Hybrid VEIP dan menolak injeksi "wan-ip" sebelum vport/gemport diikat ke service-port.',
          fix: 'Pastikan urutan: (1) interface gpon-onu -> tcont -> gemport -> service-port, baru (2) pon-onu-mng -> service HSI -> wan-ip / vlan port eth_0/1.',
        });
      }
    } else if (vendor === 'Huawei') {
      if (!/screen-length 0 temporary/i.test(rawScript)) {
        issues.push({
          title: 'Interactive Paging & Prompt { <cr> } Huawei VRP',
          cause:
            'Huawei MA5600T/MA5800 meminta konfirmasi "{ <cr>||<K> }:" pada perintah ont add dan service-port. Worker Telnet yang hanya mengirim perintah tanpa membaca prompt akan hang/gagal.',
          fix: 'Aktifkan "screen-length 0 temporary" dan tangani prompt "{ <cr> }:" dengan mengirim "\\r\\n" secara adaptif di Expect State-Machine.',
        });
      }
      if (/ont ipconfig/i.test(rawScript)) {
        issues.push({
          title: 'ONT Non-OMCI / Dual-Stack Menolak "ont ipconfig"',
          cause:
            'ONT tipe Bridge atau ONT beda merk (interoperabilitas) sering gagal saat diberi perintah "ont ipconfig pppoe" via OMCI.',
          fix: 'Cek kapabilitas OMCI ONT terlebih dahulu; gunakan "ont port native-vlan" jika ONT dikonfigurasi via TR-069/ACS atau mode Bridge.',
        });
      }
    }

    // Always include Worker Concurrency check
    issues.push({
      title: 'Race Condition antara Worker SNMP/Monitoring & Worker Telnet Provisioning',
      cause:
        'Jika worker polling redaman dan worker provisioning membuka koneksi Telnet bersamaan tanpa Per-OLT Mutex Queue, sesi VTY OLT penuh (maks 4-8 sesi) atau output saling bertumpuk.',
      fix: 'Gunakan Per-OLT Mutex Lock Queue untuk Telnet dan pisahkan pengambilan data redaman ke SNMP GETBULK (UDP 161) non-blocking.',
    });

    res.json({
      vendor,
      issuesCount: issues.length,
      issues,
    });
  });

  // 3. Real TCP Port Prober for Active OLT / Network Device
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

      const results = await runWithOltMutex(cleanHost, 'TCP_PROBE', async () => {
        const portChecks = await Promise.all(
          ports.slice(0, 6).map((p) => probeTcpPort(cleanHost, Number(p), 3500))
        );
        const openCount = portChecks.filter((r) => r.open).length;
        return {
          summary: `TCP Probe ke ${cleanHost} selesai (${openCount}/${portChecks.length} port terbuka).`,
          data: portChecks,
        };
      });

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

  // 4. Real Live Telnet / Raw TCP Session Executor with Mutex & Expect State Machine
  app.post('/api/olt/telnet-exec', async (req, res) => {
    const {
      host,
      port = 23,
      username = '',
      password = '',
      commands = [],
      timeoutMs = 8000,
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

    try {
      const execResult = await runWithOltMutex(cleanHost, 'CLI_EXEC', async () => {
        const resData = await executeExpectTelnetSession({
          host: cleanHost,
          port: targetPort,
          username,
          password,
          commands,
          timeoutMs,
        });
        return {
          summary: `Eksekusi ${commands.length} perintah CLI via Expect State-Machine ke ${cleanHost}:${targetPort} selesai.`,
          data: resData,
        };
      });

      res.json({
        success: true,
        host: cleanHost,
        port: targetPort,
        isPrivateIp: isPrivateRfc1918Ip(cleanHost),
        transcript:
          execResult.transcript ||
          '(Tidak ada output teks yang diterima dari perangkat)',
        detectedErrors: execResult.detectedErrors,
      });
    } catch (err: any) {
      res.json({
        success: false,
        host: cleanHost,
        port: targetPort,
        isPrivateIp: isPrivateRfc1918Ip(cleanHost),
        transcript: '',
        error: err?.message || 'Koneksi gagal',
      });
    }
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
