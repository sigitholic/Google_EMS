import React, { useState } from 'react';
import {
  OltNode,
  OnuDevice,
  UnconfiguredOnu,
  ProvisioningProfile,
  VendorType,
} from '../types/network';
import { Terminal, Play, Plus, Trash2, Copy, Check } from 'lucide-react';

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
  const [commandInput, setCommandInput] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const [terminalLines, setTerminalLines] = useState<string[]>([
    `OptiCore Unified Multi-Vendor Telnet/SSH/NETCONF Proxy Gateway`,
    `Terhubung ke ${activeOlt.name} (${activeOlt.vendor} ${activeOlt.model} - ${activeOlt.ipAddress})`,
    `Ketik 'help' atau gunakan tombol perintah cepat di atas terminal untuk menjalankan diagnostik OLT.`,
  ]);

  // New Profile Form State
  const [profName, setProfName] = useState('DBA-TCONT-300M-GAMING');
  const [profCategory, setProfCategory] =
    useState<ProvisioningProfile['category']>('DBA / T-CONT');
  const [tcontType, setTcontType] =
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

  const executeVendorCommand = (rawCmd: string) => {
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
    } else if (cmd.includes('card') || cmd.includes('board')) {
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
    } else if (cmd.includes('mac') || cmd.includes('service-port')) {
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
        `Perintah dieksekusi pada ${activeOlt.vendor} (${activeOlt.firmware}):`,
        `  Uptime: ${activeOlt.uptime} | CPU: ${activeOlt.cpuLoad}% | Mem: ${activeOlt.memoryLoad}% | Temp: ${activeOlt.chassisTempC}C`,
        `  Gunakan preset tombol di atas untuk tabel uncfg, optical attenuation, atau service-port.`,
      ];
    }

    setTerminalLines((prev) => [...prev, `${prompt} ${cmd}`, ...output, '']);
    setCommandInput('');
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
            Terminal CLI Multi-Vendor & Studio Profil Provisioning (DBA / VLAN / OMCI)
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Konsol eksekusi perintah native (ZXROS, Huawei VRP, FiberHome AN6000, Nokia ISAM) dan manajemen profil T-CONT/GEM terpusat.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-lg">
          {olts.map((olt) => (
            <button
              key={olt.id}
              onClick={() => onSelectOlt(olt.id)}
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

      {/* Main Split: Left Interactive CLI Terminal | Right Cross-Vendor Profile Manager */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left 7 Cols: Interactive Vendor CLI Console */}
        <div className="lg:col-span-7 bg-slate-900/70 border border-slate-800 rounded-lg p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <div className="text-xs font-semibold text-sky-400">
                  Sesi SSH / Telnet Aktif · {activeOlt.vendor} ({activeOlt.firmware})
                </div>
                <h2 className="text-sm font-semibold text-slate-100 mt-0.5">
                  {activeOlt.name} ({activeOlt.ipAddress})
                </h2>
              </div>
              <button
                onClick={() => setTerminalLines([])}
                className="px-2.5 py-1 text-xs text-slate-400 hover:text-slate-200 bg-slate-800 rounded"
              >
                Bersihkan Layar
              </button>
            </div>

            {/* Quick Vendor-Authentic Diagnostic Macros */}
            <div className="flex flex-wrap items-center gap-1.5 my-3">
              {getQuickCommands(activeOlt.vendor).map((item) => (
                <button
                  key={item.cmd}
                  onClick={() => executeVendorCommand(item.cmd)}
                  className="inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-mono text-slate-200 bg-slate-950 hover:bg-slate-800 border border-slate-800 rounded transition-colors whitespace-nowrap"
                >
                  <Play className="w-3 h-3 text-sky-400" />
                  {item.label}
                </button>
              ))}
            </div>

            {/* Terminal Viewport */}
            <div className="bg-slate-950 border border-slate-800 rounded-lg p-4 h-96 overflow-y-auto font-mono text-xs text-slate-200 space-y-1">
              {terminalLines.map((line, idx) => (
                <div
                  key={idx}
                  className={
                    line.includes('#')
                      ? 'text-sky-400 font-semibold pt-1'
                      : line.startsWith('[OK]')
                      ? 'text-emerald-400'
                      : 'text-slate-300 whitespace-pre'
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
              executeVendorCommand(commandInput);
            }}
            className="mt-3 flex items-center gap-2"
          >
            <div className="flex-1 flex items-center bg-slate-950 border border-slate-700 rounded-lg px-3 py-2 font-mono text-xs">
              <span className="text-sky-400 mr-2 shrink-0">
                {getPromptPrefix(activeOlt)}
              </span>
              <input
                type="text"
                value={commandInput}
                onChange={(e) => setCommandInput(e.target.value)}
                placeholder="Ketik perintah CLI OLT (mis. show gpon onu uncfg / display board 0)..."
                className="w-full bg-transparent text-slate-100 focus:outline-none"
              />
            </div>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-medium text-white bg-sky-600 hover:bg-sky-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Kirim Perintah
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
