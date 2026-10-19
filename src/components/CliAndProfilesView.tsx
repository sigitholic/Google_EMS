import React, { useState } from 'react';
import {
  OltNode,
  OnuDevice,
  UnconfiguredOnu,
  ProvisioningProfile,
  VendorType,
} from '../types/network';
import {
  Terminal,
  Play,
  Plus,
  Trash2,
  Copy,
  Check,
  Radio,
  RefreshCw,
} from 'lucide-react';

interface CliAndProfilesViewProps {
  olts: OltNode[];
  onus: OnuDevice[];
  unconfiguredOnus: UnconfiguredOnu[];
  profiles: ProvisioningProfile[];
  selectedOltId: string;
  externalCliLog: string[];
  onSelectOlt: (oltId: string) => void;
  onAddProfile: (profile: ProvisioningProfile) => void;
  onDeleteProfile: (profileId: string) => void;
}

interface ProbePortResult {
  port: number;
  open: boolean;
  latencyMs: number | null;
  banner: string;
  error?: string;
}

export const CliAndProfilesView: React.FC<CliAndProfilesViewProps> = ({
  olts,
  onus,
  unconfiguredOnus,
  profiles,
  selectedOltId,
  externalCliLog,
  onSelectOlt,
  onAddProfile,
  onDeleteProfile,
}) => {
  const activeOlt = olts.find((o) => o.id === selectedOltId) || olts[0];
  const [terminalMode, setTerminalMode] = useState<'LIVE_HARDWARE' | 'SIMULATOR'>(
    'LIVE_HARDWARE'
  );
  const [commandInput, setCommandInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Live Hardware Connection State
  const [liveHost, setLiveHost] = useState(activeOlt.ipAddress);
  const [livePort, setLivePort] = useState(23);
  const [liveUsername, setLiveUsername] = useState('zte');
  const [livePassword, setLivePassword] = useState('');
  const [isProbing, setIsProbing] = useState(false);
  const [isExecutingLive, setIsExecutingLive] = useState(false);
  const [probeResults, setProbeResults] = useState<ProbePortResult[] | null>(
    null
  );
  const [privateIpNotice, setPrivateIpNotice] = useState<string | null>(null);

  const [terminalLines, setTerminalLines] = useState<string[]>([
    `OptiCore Unified Multi-Vendor Telnet/SSH/NETCONF Proxy Gateway`,
    `Mode Aktif: Konektor Perangkat OLT Langsung (Real TCP/Telnet Socket Backend)`,
    `Pilih 'Tes Port TCP' untuk menguji keterjangkauan IP OLT atau kirim perintah CLI langsung ke perangkat.`,
  ]);

  // New Profile Form State
  const [profName, setProfName] = useState('DBA-TCONT-300M-GAMING');
  const [profCategory, setProfCategory] =
    useState<ProvisioningProfile['category']>('DBA / T-CONT');
  const [tcontType] =
    useState<ProvisioningProfile['tcontType']>('Type-3 (Assured)');
  const [assuredMbps, setAssuredMbps] = useState(150);
  const [maxMbps, setMaxMbps] = useState(300);
  const [svlan, setSvlan] = useState(1100);
  const [cvlan, setCvlan] = useState(108);

  const getPromptPrefix = (olt: OltNode) => {
    if (olt.vendor === 'ZTE') return `${olt.name}#`;
    if (olt.vendor === 'Huawei') return `${olt.name}(config)#`;
    if (olt.vendor === 'FiberHome') return `${olt.name}\\onu#`;
    return `typ:isadmin>#`;
  };

  const handleSelectOltNode = (olt: OltNode) => {
    onSelectOlt(olt.id);
    setLiveHost(olt.ipAddress);
  };

  // Real Backend TCP Probe Handler
  const handleProbeRealDevice = async () => {
    if (!liveHost.trim()) return;
    setIsProbing(true);
    setProbeResults(null);
    setPrivateIpNotice(null);

    try {
      const response = await fetch('/api/olt/probe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: liveHost.trim(),
          ports: [livePort, 23, 22, 830, 80].filter(
            (v, i, a) => a.indexOf(v) === i
          ),
        }),
      });
      const data = await response.json();
      if (data.results) {
        setProbeResults(data.results);
        if (data.privateIpWarning) {
          setPrivateIpNotice(data.privateIpWarning);
        }
        const summaryLines = (data.results as ProbePortResult[]).map(
          (r) =>
            `  [TCP Port ${String(r.port).padEnd(4)}] -> ${
              r.open
                ? `[OPEN] Latency: ${r.latencyMs}ms ${
                    r.banner ? `| Banner: ${r.banner}` : ''
                  }`
                : `[CLOSED/UNREACHABLE] (${r.error || 'Timeout'})`
            }`
        );
        setTerminalLines((prev) => [
          ...prev,
          `# Probe Koneksi Socket Nyata ke ${liveHost.trim()}:`,
          ...summaryLines,
          ...(data.privateIpWarning ? [`  Catatan: ${data.privateIpWarning}`] : []),
          '',
        ]);
      }
    } catch (err: any) {
      setTerminalLines((prev) => [
        ...prev,
        `[ERROR] Gagal menghubungi backend gateway: ${err?.message || 'Unknown error'}`,
      ]);
    } finally {
      setIsProbing(false);
    }
  };

  // Real Backend Telnet Command Execution Handler
  const executeLiveTelnetCommand = async (rawCmd: string) => {
    const cmd = rawCmd.trim();
    if (!cmd) return;

    setIsExecutingLive(true);
    setTerminalLines((prev) => [
      ...prev,
      `[LIVE SOCKET ${liveHost}:${livePort}]# ${cmd}`,
      `Menghubungi socket ${liveHost}:${livePort}...`,
    ]);

    try {
      const disablePagingCmd =
        activeOlt.vendor === 'ZTE'
          ? 'terminal length 0'
          : activeOlt.vendor === 'Huawei'
          ? 'screen-length 0 temporary'
          : '';

      const commandsToSend = disablePagingCmd
        ? [disablePagingCmd, cmd]
        : [cmd];

      const response = await fetch('/api/olt/telnet-exec', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          host: liveHost.trim(),
          port: livePort,
          username: liveUsername,
          password: livePassword,
          commands: commandsToSend,
          timeoutMs: 7000,
        }),
      });

      const data = await response.json();
      if (data.success) {
        setTerminalLines((prev) => [
          ...prev,
          `[OK] Respons Perangkat Aktif (${data.host}:${data.port}):`,
          ...String(data.transcript).split('\n'),
          '',
        ]);
      } else {
        setTerminalLines((prev) => [
          ...prev,
          `[SOCKET ERROR] ${data.error || 'Gagal terhubung ke OLT.'}`,
          ...(data.isPrivateIp
            ? [
                `  Info Jaringan: IP ${data.host} adalah IP lokal/private (RFC1918).`,
                `  Agar dapat terhubung langsung dari Cloud Preview, gunakan IP Publik / Port Forwarding / Tunnel VPN,`,
                `  atau jalankan aplikasi ini di PC/Server lokal NOC yang berada di satu segmen VLAN Management OLT.`,
              ]
            : []),
          '',
        ]);
      }
    } catch (err: any) {
      setTerminalLines((prev) => [
        ...prev,
        `[ERROR] Eksekusi gagal: ${err?.message || 'Network error'}`,
      ]);
    } finally {
      setIsExecutingLive(false);
      setCommandInput('');
    }
  };

  // Simulator Fallback Handler
  const executeSimulatorCommand = (rawCmd: string) => {
    const cmd = rawCmd.trim();
    if (!cmd) return;

    const prompt = getPromptPrefix(activeOlt);
    const oltOnus = onus.filter((u) => u.oltId === activeOlt.id);
    const oltUncfg = unconfiguredOnus.filter((u) => u.oltId === activeOlt.id);

    let output: string[] = [];

    if (
      cmd.includes('uncfg') ||
      cmd.includes('autofind') ||
      cmd.includes('unauth')
    ) {
      if (oltUncfg.length === 0) {
        output = [`Tidak ditemukan ONT unconfigured pada ${activeOlt.name}.`];
      } else {
        output = [
          `------------------------------------------------------------------------`,
          `Port PON             Serial Number     Model          Rx Power   Jarak`,
          `------------------------------------------------------------------------`,
          ...oltUncfg.map(
            (u) =>
              `${u.ponPortLabel.padEnd(20)} ${u.serialNumber.padEnd(17)} ${u.detectedModel.padEnd(14)} ${String(u.rxPowerDbm + ' dBm').padEnd(10)} ${u.distanceKm} km`
          ),
          `------------------------------------------------------------------------`,
          `Total ditemukan: ${oltUncfg.length} ONT menunggu provisioning.`,
        ];
      }
    } else if (cmd.includes('power') || cmd.includes('optical')) {
      output = [
        `-------------------------------------------------------------------------------`,
        `ONU Interface          SN             Status      ONU Rx(dBm)  OLT Rx(dBm)  Jarak`,
        `-------------------------------------------------------------------------------`,
        ...oltOnus.map(
          (u) =>
            `${(u.ponPortLabel + ':' + u.onuIndex).padEnd(22)} ${u.serialNumber.padEnd(14)} ${u.status.padEnd(11)} ${String(u.rxPowerDbm.toFixed(1)).padEnd(12)} ${String(u.oltRxPowerDbm.toFixed(1)).padEnd(12)} ${u.distanceKm}km`
        ),
        `-------------------------------------------------------------------------------`,
      ];
    } else if (cmd.includes('card') || cmd.includes('board') || cmd.includes('slot')) {
      output = [
        `--------------------------------------------------------------------`,
        `Slot  Board Type                  Role               Status   Temp`,
        `--------------------------------------------------------------------`,
        ...activeOlt.slots.map(
          (s) =>
            `${String(s.slotNumber).padEnd(5)} ${s.cardModel.padEnd(27)} ${s.cardRole.padEnd(18)} ${s.status.padEnd(8)} ${s.tempC}C`
        ),
        `--------------------------------------------------------------------`,
      ];
    } else if (cmd.includes('mac') || cmd.includes('service-port') || cmd.includes('fdb')) {
      output = [
        `------------------------------------------------------------------------------`,
        `MAC Address        SVLAN  CVLAN  Port/ONU                 IP PPPoE`,
        `------------------------------------------------------------------------------`,
        ...oltOnus.map(
          (u) =>
            `${u.macAddress.padEnd(18)} ${String(u.svlan).padEnd(6)} ${String(u.cvlan).padEnd(6)} ${(u.ponPortLabel + ':' + u.onuIndex).padEnd(24)} ${u.ipAddressPppoe}`
        ),
        `------------------------------------------------------------------------------`,
      ];
    } else if (cmd.includes('write') || cmd.includes('save')) {
      output = [
        `Menyimpan konfigurasi aktif ke NVRAM Flash pada ${activeOlt.name}...`,
        `[OK] Konfigurasi berhasil disinkronkan (100%).`,
      ];
    } else {
      output = [
        `Perintah dieksekusi pada Simulator ${activeOlt.vendor} (${activeOlt.firmware}):`,
        `  Uptime: ${activeOlt.uptime} | CPU: ${activeOlt.cpuLoad}% | Mem: ${activeOlt.memoryLoad}% | Temp: ${activeOlt.chassisTempC}C`,
      ];
    }

    setTerminalLines((prev) => [...prev, `${prompt} ${cmd}`, ...output, '']);
    setCommandInput('');
  };

  const handleDispatchCommand = (cmd: string) => {
    if (terminalMode === 'LIVE_HARDWARE') {
      executeLiveTelnetCommand(cmd);
    } else {
      executeSimulatorCommand(cmd);
    }
  };

  const getQuickCommands = (vendor: VendorType) => {
    if (vendor === 'ZTE') {
      return [
        { label: 'Cek ONT Uncfg', cmd: 'show gpon onu uncfg' },
        { label: 'Redaman Optik PON', cmd: 'show pon power attenuation gpon-olt_1/1/1' },
        { label: 'Status Kartu Slot', cmd: 'show card' },
        { label: 'Tabel MAC & VLAN', cmd: 'show mac-address-table vlan' },
        { label: 'Simpan NVRAM', cmd: 'write' },
      ];
    }
    if (vendor === 'Huawei') {
      return [
        { label: 'Autofind ONT', cmd: 'display ont autofind all' },
        { label: 'Diagnostik Optik', cmd: 'display ont optical-info 0 1 0 all' },
        { label: 'Status Board', cmd: 'display board 0' },
        { label: 'Service-Port VLAN', cmd: 'display service-port all' },
        { label: 'Simpan Konfig', cmd: 'save' },
      ];
    }
    if (vendor === 'FiberHome') {
      return [
        { label: 'Cek Unauth ONT', cmd: 'show unauth_onu all' },
        { label: 'Optik Port PON', cmd: 'show optic_module slot 1 pon 1' },
        { label: 'Status Linecard', cmd: 'show card_state' },
        { label: 'Tabel QinQ VLAN', cmd: 'show service_port all' },
        { label: 'Simpan Flash', cmd: 'save' },
      ];
    }
    return [
      { label: 'Cek Unconfigured ONT', cmd: 'show pon unauth' },
      { label: 'Redaman Optik ONT', cmd: 'show equipment ont optics' },
      { label: 'Status Slot LT/NT', cmd: 'show equipment slot' },
      { label: 'Bridge Port VLAN', cmd: 'show vlan bridge-port-fdb' },
      { label: 'Admin Save', cmd: 'admin save' },
    ];
  };

  const handleCreateProfile = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profName.trim()) return;
    const newProf: ProvisioningProfile = {
      id: `prof-${Date.now()}`,
      name: profName.trim().toUpperCase(),
      category: profCategory,
      tcontType,
      assuredBwMbps: assuredMbps,
      maxBwMbps: maxMbps,
      svlan,
      cvlan,
      serviceMode: 'PPPoE Routed',
      gemPortId: 1,
      description: `Profil ${profCategory} terkompilasi otomatis (CIR ${assuredMbps}M / PIR ${maxMbps}M · SVLAN ${svlan} / CVLAN ${cvlan}).`,
    };
    onAddProfile(newProf);
    setProfName(`DBA-TCONT-${maxMbps}M-CUSTOM`);
  };

  const compileProfileToMultiVendor = (p: ProvisioningProfile) => {
    const cirKbps = p.assuredBwMbps * 1024;
    const pirKbps = p.maxBwMbps * 1024;
    return [
      `[ZTE]    gpon profile tcont ${p.name} type 3 assured ${cirKbps} maximum ${pirKbps}`,
      `[Huawei] dba-profile add profile-name ${p.name} type3 assure ${cirKbps} max ${pirKbps}`,
      `[FH]     set dba_profile name ${p.name} type 3 cir ${cirKbps} pir ${pirKbps} svlan ${p.svlan}`,
      `[Nokia]  configure qos profiles bandwidth ${p.name} committed-info-rate ${cirKbps} assured-info-rate ${pirKbps}`,
    ].join('\n');
  };

  const handleCopySnippet = (id: string, text: string) => {
    navigator.clipboard?.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 1500);
  };

  return (
    <div className="space-y-6">
      {/* Page Title */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-semibold text-slate-100 tracking-tight">
            Konektor CLI Perangkat Aktif (Real TCP/Telnet) & Studio Profil Multi-Vendor
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Uji keterjangkauan socket TCP (Telnet/SSH/NETCONF) dan kirim perintah CLI langsung ke OLT aktif atau jalankan di Simulator Lab.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-lg">
          {olts.map((olt) => (
            <button
              key={olt.id}
              onClick={() => handleSelectOltNode(olt)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                olt.id === activeOlt.id
                  ? 'bg-sky-600 text-white'
                  : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
              }`}
            >
              {olt.vendor} · {olt.ipAddress}
            </button>
          ))}
        </div>
      </div>

      {/* Main Split: Left Interactive CLI & Live Hardware Connector | Right Cross-Vendor Profile Manager */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left 7 Cols: Live Hardware Socket Connector & CLI Console */}
        <div className="lg:col-span-7 bg-slate-900/70 border border-slate-800 rounded-lg p-5 flex flex-col justify-between space-y-4">
          <div className="space-y-4">
            {/* Mode Switcher: Live Hardware vs Lab Simulator */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-slate-800">
              <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg">
                <button
                  onClick={() => setTerminalMode('LIVE_HARDWARE')}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                    terminalMode === 'LIVE_HARDWARE'
                      ? 'bg-sky-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Koneksi Perangkat OLT Aktif (Live TCP/Telnet)
                </button>
                <button
                  onClick={() => setTerminalMode('SIMULATOR')}
                  className={`px-3 py-1.5 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                    terminalMode === 'SIMULATOR'
                      ? 'bg-sky-600 text-white'
                      : 'text-slate-400 hover:text-slate-200'
                  }`}
                >
                  Mode Simulator Lab ({activeOlt.vendor})
                </button>
              </div>

              <button
                onClick={() => setTerminalLines([])}
                className="px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200 bg-slate-800 rounded whitespace-nowrap self-end sm:self-auto"
              >
                Bersihkan Terminal
              </button>
            </div>

            {/* Live Device Connection Parameters Panel */}
            {terminalMode === 'LIVE_HARDWARE' && (
              <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-lg space-y-3 text-xs">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <span className="font-semibold text-sky-400">
                    Parameter Socket Perangkat Aktif (Backend Node.js net.Socket)
                  </span>
                  <span className="text-slate-400">
                    Mendukung Telnet (23), SSH Probe (22), NETCONF (830)
                  </span>
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2.5">
                  <div className="col-span-2">
                    <label className="block text-slate-400 mb-1">
                      IP Publik / Host OLT
                    </label>
                    <input
                      type="text"
                      value={liveHost}
                      onChange={(e) => setLiveHost(e.target.value)}
                      placeholder="Mis. 103.x.x.x atau 10.240.12.11"
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded font-mono text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">
                      Port TCP
                    </label>
                    <input
                      type="number"
                      value={livePort}
                      onChange={(e) => setLivePort(Number(e.target.value))}
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded font-mono text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">
                      Username OLT
                    </label>
                    <input
                      type="text"
                      value={liveUsername}
                      onChange={(e) => setLiveUsername(e.target.value)}
                      placeholder="zte / root"
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded font-mono text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-400 mb-1">
                      Password OLT
                    </label>
                    <input
                      type="password"
                      value={livePassword}
                      onChange={(e) => setLivePassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded font-mono text-slate-100"
                    />
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleProbeRealDevice}
                    disabled={isProbing}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-emerald-600 hover:bg-emerald-500 disabled:opacity-50 rounded transition-colors whitespace-nowrap"
                  >
                    <RefreshCw
                      className={`w-3.5 h-3.5 ${isProbing ? 'animate-spin' : ''}`}
                    />
                    {isProbing
                      ? 'Menguji Socket TCP...'
                      : `Tes Koneksi & Latency Port ke ${liveHost}`}
                  </button>

                  {probeResults && (
                    <div className="flex flex-wrap items-center gap-2 font-mono tabular-nums text-xs">
                      {probeResults.map((r) => (
                        <span
                          key={r.port}
                          className={
                            r.open ? 'text-emerald-400' : 'text-rose-400'
                          }
                        >
                          Port {r.port}: {r.open ? `${r.latencyMs}ms OPEN` : 'CLOSED'}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                {privateIpNotice && (
                  <div className="p-2.5 bg-amber-950/50 border border-amber-800/70 rounded text-amber-200 text-xs leading-relaxed">
                    {privateIpNotice}
                  </div>
                )}
              </div>
            )}

            {/* Quick Vendor-Authentic Diagnostic Macros */}
            <div className="flex flex-wrap items-center gap-1.5">
              {getQuickCommands(activeOlt.vendor).map((item) => (
                <button
                  key={item.cmd}
                  onClick={() => handleDispatchCommand(item.cmd)}
                  disabled={isExecutingLive}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono text-slate-200 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded transition-colors whitespace-nowrap"
                >
                  <Play className="w-3 h-3 text-sky-400" />
                  {item.label}
                </button>
              ))}
            </div>

            {/* Terminal Viewport */}
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 h-80 overflow-y-auto font-mono text-xs text-slate-200 space-y-1">
              {terminalLines.map((line, idx) => (
                <div
                  key={idx}
                  className={
                    line.includes('#')
                      ? 'text-sky-400 font-semibold pt-1'
                      : line.startsWith('[OK]') || line.includes('[OPEN]')
                      ? 'text-emerald-400'
                      : line.startsWith('[SOCKET ERROR]') ||
                        line.startsWith('[ERROR]')
                      ? 'text-rose-400'
                      : 'text-slate-300 whitespace-pre-wrap'
                  }
                >
                  {line}
                </div>
              ))}
              {externalCliLog.length > 0 && (
                <div className="pt-3 mt-3 border-t border-slate-800 text-emerald-300 whitespace-pre">
                  {externalCliLog.join('\n\n')}
                </div>
              )}
            </div>
          </div>

          {/* Interactive CLI Prompt Form */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              handleDispatchCommand(commandInput);
            }}
            className="mt-3 flex items-center gap-2"
          >
            <div className="flex-1 flex items-center bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 font-mono text-xs">
              <span className="text-sky-400 mr-2 shrink-0">
                {terminalMode === 'LIVE_HARDWARE'
                  ? `${liveHost}:${livePort}#`
                  : getPromptPrefix(activeOlt)}
              </span>
              <input
                type="text"
                value={commandInput}
                onChange={(e) => setCommandInput(e.target.value)}
                placeholder={
                  terminalMode === 'LIVE_HARDWARE'
                    ? 'Ketik perintah CLI untuk dikirim via Live Telnet Socket ke OLT...'
                    : 'Ketik perintah CLI Simulator (mis. show gpon onu uncfg)...'
                }
                className="w-full bg-transparent text-slate-100 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              disabled={isExecutingLive}
              className="px-4 py-2 text-xs font-medium text-white bg-sky-600 hover:bg-sky-500 disabled:opacity-50 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              {isExecutingLive ? 'Mengirim...' : 'Kirim Perintah'}
            </button>
          </form>
        </div>

        {/* Right 5 Cols: Unified Profile Builder (DBA / Line / Service / VLAN) */}
        <div className="lg:col-span-5 bg-slate-900/70 border border-slate-800 rounded-lg p-5 flex flex-col justify-between space-y-4">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">
              Tambah Profil Provisioning Lintas Vendor
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Buat satu profil abstraksi; sistem otomatis menerjemahkannya ke sintaks ZTE, Huawei, FiberHome, dan Nokia.
            </p>

            <form
              onSubmit={handleCreateProfile}
              className="mt-3.5 space-y-3 text-xs bg-slate-950 border border-slate-800 rounded-lg p-3.5"
            >
              <div className="grid grid-cols-2 gap-2.5">
                <div>
                  <label className="block text-slate-400 mb-1">Nama Profil</label>
                  <input
                    type="text"
                    required
                    value={profName}
                    onChange={(e) => setProfName(e.target.value)}
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded font-mono text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">Kategori</label>
                  <select
                    value={profCategory}
                    onChange={(e) =>
                      setProfCategory(
                        e.target.value as ProvisioningProfile['category']
                      )
                    }
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded text-slate-100"
                  >
                    <option value="DBA / T-CONT">DBA / T-CONT</option>
                    <option value="Line Profile">Line Profile</option>
                    <option value="Service Profile">Service Profile</option>
                    <option value="VLAN / Layanan">VLAN / Layanan</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-3 gap-2.5">
                <div>
                  <label className="block text-slate-400 mb-1">CIR (Mbps)</label>
                  <input
                    type="number"
                    value={assuredMbps}
                    onChange={(e) => setAssuredMbps(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded font-mono text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">PIR Maks (Mbps)</label>
                  <input
                    type="number"
                    value={maxMbps}
                    onChange={(e) => setMaxMbps(Number(e.target.value))}
                    className="w-full px-2.5 py-1.5 bg-slate-900 border border-slate-700 rounded font-mono text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 mb-1">SVLAN / CVLAN</label>
                  <div className="flex items-center gap-1">
                    <input
                      type="number"
                      value={svlan}
                      onChange={(e) => setSvlan(Number(e.target.value))}
                      className="w-1/2 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded font-mono text-slate-100"
                    />
                    <input
                      type="number"
                      value={cvlan}
                      onChange={(e) => setCvlan(Number(e.target.value))}
                      className="w-1/2 px-2 py-1.5 bg-slate-900 border border-slate-700 rounded font-mono text-slate-100"
                    />
                  </div>
                </div>
              </div>

              <button
                type="submit"
                className="w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-sky-600 hover:bg-sky-500 rounded transition-colors"
              >
                <Plus className="w-3.5 h-3.5" />
                Kompilasi & Simpan Profil Multi-Vendor
              </button>
            </form>
          </div>

          {/* Saved Profiles List */}
          <div className="space-y-2.5 max-h-64 overflow-y-auto pr-1">
            {profiles.map((prof) => {
              const snippet = compileProfileToMultiVendor(prof);
              return (
                <div
                  key={prof.id}
                  className="p-3 bg-slate-950 border border-slate-800 rounded-lg text-xs space-y-2"
                >
                  <div className="flex items-center justify-between">
                    <div>
                      <span className="font-mono font-semibold text-slate-100">
                        {prof.name}
                      </span>
                      <span className="text-slate-400 ml-2">
                        · {prof.category} · CIR {prof.assuredBwMbps}M / PIR {prof.maxBwMbps}M
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => handleCopySnippet(prof.id, snippet)}
                        className="p-1 text-slate-400 hover:text-white"
                        title="Salin Skrip 4 Vendor"
                      >
                        {copiedId === prof.id ? (
                          <Check className="w-3.5 h-3.5 text-emerald-400" />
                        ) : (
                          <Copy className="w-3.5 h-3.5" />
                        )}
                      </button>
                      <button
                        onClick={() => onDeleteProfile(prof.id)}
                        className="p-1 text-slate-400 hover:text-rose-400"
                        title="Hapus Profil"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>
                  <pre className="p-2 bg-slate-900/90 rounded font-mono text-[11px] text-slate-300 overflow-x-auto">
                    {snippet}
                  </pre>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};
