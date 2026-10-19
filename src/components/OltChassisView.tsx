import React, { useState } from 'react';
import { OltNode, OnuDevice, PonPort } from '../types/network';
import {
  Server,
  Cpu,
  Thermometer,
  Activity,
  Terminal,
  RefreshCw,
  Power,
  Sliders,
  ArrowUpRight,
} from 'lucide-react';

interface OltChassisViewProps {
  olts: OltNode[];
  onus: OnuDevice[];
  selectedOltId: string;
  onSelectOlt: (oltId: string) => void;
  onTogglePonPortAdmin: (oltId: string, ponPortId: string) => void;
  onSyncSnmpOlt: (oltId: string) => void;
  onOpenCliForOlt: (oltId: string) => void;
  onInspectPonOnus: (oltId: string, ponPortLabel: string) => void;
}

export const OltChassisView: React.FC<OltChassisViewProps> = ({
  olts,
  onus,
  selectedOltId,
  onSelectOlt,
  onTogglePonPortAdmin,
  onSyncSnmpOlt,
  onOpenCliForOlt,
  onInspectPonOnus,
}) => {
  const activeOlt = olts.find((o) => o.id === selectedOltId) || olts[0];
  const [selectedSlotNum, setSelectedSlotNum] = useState<number>(
    activeOlt?.slots[0]?.slotNumber || 1
  );
  const [selectedPonPortId, setSelectedPonPortId] = useState<string>(
    activeOlt?.ponPorts[0]?.id || ''
  );
  const [syncingId, setSyncingId] = useState<string | null>(null);

  const handleSelectOlt = (olt: OltNode) => {
    onSelectOlt(olt.id);
    if (olt.slots.length > 0) {
      setSelectedSlotNum(olt.slots[0].slotNumber);
    }
    if (olt.ponPorts.length > 0) {
      setSelectedPonPortId(olt.ponPorts[0].id);
    }
  };

  const handleTriggerSync = (oltId: string) => {
    setSyncingId(oltId);
    onSyncSnmpOlt(oltId);
    setTimeout(() => setSyncingId(null), 500);
  };

  const activeSlot =
    activeOlt.slots.find((s) => s.slotNumber === selectedSlotNum) ||
    activeOlt.slots[0];

  const activePonPort: PonPort | undefined =
    activeOlt.ponPorts.find((p) => p.id === selectedPonPortId) ||
    activeOlt.ponPorts[0];

  const oltOnus = onus.filter((u) => u.oltId === activeOlt.id);
  const onlineOnuCount = oltOnus.filter((u) => u.status === 'Online').length;

  return (
    <div className="space-y-6">
      {/* Multi-Vendor OLT Selector Bar */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-semibold text-slate-100 tracking-tight">
            Manajemen Elemen OLT Multi-Vendor (EMS)
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Inspeksi sasis fisik 19-inci, modul kartu GPON/XG-PON, serta telemetri optik SFP per port PON lintas vendor.
          </p>
        </div>

        {/* Interactive OLT Node Switcher (Functional Buttons) */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 bg-slate-900 border border-slate-800 rounded-lg">
          {olts.map((olt) => {
            const isSelected = olt.id === activeOlt.id;
            return (
              <button
                key={olt.id}
                onClick={() => handleSelectOlt(olt)}
                className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 ${
                  isSelected
                    ? 'bg-sky-600 text-white shadow-sm'
                    : 'text-slate-300 hover:text-white hover:bg-slate-800/70'
                }`}
              >
                {olt.vendor} · {olt.name.replace(/^OLT-[A-Z]+-/, '')}
              </button>
            );
          })}
        </div>
      </div>

      {/* Selected OLT Header Specification Strip */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-5">
        <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
              <span className="font-semibold text-sky-400">{activeOlt.vendor}</span>
              <span aria-hidden="true">·</span>
              <span>{activeOlt.model}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono tabular-nums">IP {activeOlt.ipAddress}</span>
              <span aria-hidden="true">·</span>
              <span>Firmware {activeOlt.firmware}</span>
            </div>
            <h2 className="text-lg font-semibold text-slate-100 mt-1">
              {activeOlt.name}
            </h2>
            <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400 mt-1">
              <span>Lokasi: {activeOlt.locationPop}</span>
              <span aria-hidden="true">·</span>
              <span>Wilayah: {activeOlt.region}</span>
              <span aria-hidden="true">·</span>
              <span>SNMPv3: {activeOlt.snmpState}</span>
              <span aria-hidden="true">·</span>
              <span>NETCONF/YANG: {activeOlt.netconfState}</span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2.5 shrink-0">
            <button
              onClick={() => handleTriggerSync(activeOlt.id)}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${syncingId === activeOlt.id ? 'animate-spin text-sky-400' : ''}`} />
              Sinkronisasi MIB / OMCI
            </button>
            <button
              onClick={() => onOpenCliForOlt(activeOlt.id)}
              className="inline-flex items-center gap-2 px-3.5 py-2 text-xs font-medium text-white bg-sky-600 hover:bg-sky-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Terminal className="w-3.5 h-3.5" />
              Buka Terminal CLI {activeOlt.vendor}
            </button>
          </div>
        </div>

        {/* 6-Column Telemetry Strip */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 pt-4">
          <div>
            <div className="text-xs text-slate-400">Status Operasional</div>
            <div
              className={`text-sm font-semibold mt-1 ${
                activeOlt.status === 'Normal'
                  ? 'text-emerald-400'
                  : activeOlt.status === 'Warning'
                  ? 'text-amber-400'
                  : 'text-rose-400'
              }`}
            >
              {activeOlt.status === 'Normal'
                ? 'Normal (Aktif)'
                : activeOlt.status === 'Warning'
                ? 'Peringatan (Degradasi)'
                : 'Kritis (Gangguan PON)'}
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-400">Uptime Sistem</div>
            <div className="text-sm font-mono tabular-nums text-slate-100 mt-1">
              {activeOlt.uptime}
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-400">Beban CPU / Memori</div>
            <div className="text-sm font-mono tabular-nums text-slate-100 mt-1">
              {activeOlt.cpuLoad}% / {activeOlt.memoryLoad}%
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-400">Suhu Sasis OLT</div>
            <div className="text-sm font-mono tabular-nums text-slate-100 mt-1">
              {activeOlt.chassisTempC.toFixed(1)} °C
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-400">Trafik Uplink / Downlink</div>
            <div className="text-sm font-mono tabular-nums text-slate-100 mt-1">
              {activeOlt.uplinkThroughputGbps.toFixed(2)}G / {activeOlt.downlinkThroughputGbps.toFixed(2)}G
            </div>
          </div>

          <div>
            <div className="text-xs text-slate-400">ONU Terdaftar (Online)</div>
            <div className="text-sm font-mono tabular-nums text-slate-100 mt-1">
              {onlineOnuCount} / {oltOnus.length} Sampel ONU
            </div>
          </div>
        </div>
      </div>

      {/* Main Split: Left Hardware Chassis Visualizer | Right Slot & PON Transceiver Inspector */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Left 7 Columns: Physical 19-Inch Telco Rack Chassis Layout */}
        <div className="lg:col-span-7 bg-slate-900/70 border border-slate-800 rounded-lg p-5 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between pb-4 border-b border-slate-800">
              <div>
                <h3 className="text-sm font-semibold text-slate-100">
                  Visualisasi Sasis Rak 19-Inci ({activeOlt.vendor} {activeOlt.model})
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Klik slot kartu line-card atau port PON untuk melihat parameter optik dan kontrol administratif.
                </p>
              </div>
              <span className="text-xs font-mono tabular-nums text-slate-400">
                {activeOlt.slots.length} Modul Terpasang
              </span>
            </div>

            {/* Metallic Rack Enclosure Representation */}
            <div className="mt-4 bg-slate-950 border border-slate-800 rounded-lg p-4">
              <div className="flex items-center justify-between text-xs font-mono text-slate-400 pb-3 mb-3 border-b border-slate-800/80">
                <span>FAN TRAY UNIT: 4x PWM ACTIVE (3420 RPM)</span>
                <span>DUAL DC POWER: -48.2V A / -48.1V B</span>
              </div>

              {/* Chassis Slots Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {activeOlt.slots.map((slot) => {
                  const isSelected = activeSlot?.slotNumber === slot.slotNumber;
                  return (
                    <button
                      key={slot.slotNumber}
                      onClick={() => setSelectedSlotNum(slot.slotNumber)}
                      className={`text-left p-3.5 rounded-lg border transition-colors ${
                        isSelected
                          ? 'bg-slate-900 border-sky-500'
                          : 'bg-slate-900/40 border-slate-800 hover:border-slate-700'
                      }`}
                    >
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono tabular-nums font-semibold text-slate-200">
                          SLOT #{slot.slotNumber}
                        </span>
                        <span
                          className={`font-mono text-xs ${
                            slot.status === 'Normal'
                              ? 'text-emerald-400'
                              : slot.status === 'Standby'
                              ? 'text-sky-400'
                              : 'text-rose-400'
                          }`}
                        >
                          {slot.status}
                        </span>
                      </div>

                      <div className="text-xs font-semibold text-slate-100 mt-1.5 truncate">
                        {slot.cardModel}
                      </div>

                      <div className="text-xs text-slate-400 mt-0.5">
                        {slot.cardRole} · {slot.portsCount} Port
                      </div>

                      <div className="flex items-center justify-between text-xs font-mono tabular-nums text-slate-400 mt-3 pt-2 border-t border-slate-800/80">
                        <span>CPU {slot.cpuUsage}%</span>
                        <span>{slot.tempC} °C</span>
                      </div>
                    </button>
                  );
                })}
              </div>

              {/* Active PON Ports Matrix inside Chassis */}
              <div className="mt-5 pt-4 border-t border-slate-800">
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs font-semibold text-slate-200">
                    Antarmuka Port PON Optik pada Sasis
                  </span>
                  <span className="text-xs text-slate-400">
                    Klik port untuk detail SFP B+/C+
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {activeOlt.ponPorts.map((port) => {
                    const isPortSelected = activePonPort?.id === port.id;
                    return (
                      <button
                        key={port.id}
                        onClick={() => setSelectedPonPortId(port.id)}
                        className={`text-left p-3 rounded-lg border transition-colors ${
                          isPortSelected
                            ? 'bg-slate-900 border-sky-500'
                            : 'bg-slate-900/50 border-slate-800 hover:border-slate-700'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <span className="font-mono tabular-nums text-xs font-semibold text-slate-100">
                            {port.label}
                          </span>
                          <span
                            className={`text-xs font-medium ${
                              port.adminState === 'Disabled'
                                ? 'text-slate-400'
                                : port.operState === 'Up'
                                ? 'text-emerald-400'
                                : port.operState === 'Degraded'
                                ? 'text-amber-400'
                                : 'text-rose-400'
                            }`}
                          >
                            {port.adminState === 'Disabled'
                              ? 'Admin Shutdown'
                              : port.operState === 'Up'
                              ? 'Link Up'
                              : port.operState === 'Degraded'
                              ? 'Degraded'
                              : 'LOS Down'}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 text-xs text-slate-400 mt-1 font-mono tabular-nums">
                          <span>Tx +{port.txPowerDbm.toFixed(1)} dBm</span>
                          <span aria-hidden="true">·</span>
                          <span>Split {port.splitRatio}</span>
                          <span aria-hidden="true">·</span>
                          <span>
                            ONU {port.activeOnus}/{port.totalOnus}
                          </span>
                        </div>

                        <div className="text-xs text-slate-400 mt-1">
                          Sub-ODC: {port.odcName}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs text-slate-400">
            <span>Standar ITU-T G.984 (GPON) & G.987 (XG-PON)</span>
            <span className="font-mono tabular-nums">
              Panjang Gelombang: Tx 1490nm / Rx 1310nm
            </span>
          </div>
        </div>

        {/* Right 5 Columns: Selected PON Port Optical Budget & Transceiver Diagnostics */}
        <div className="lg:col-span-5 bg-slate-900/70 border border-slate-800 rounded-lg p-5 flex flex-col justify-between">
          {activePonPort ? (
            <div>
              <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800">
                <div>
                  <div className="text-xs text-slate-400">
                    Diagnostik Modul Optik SFP Port PON
                  </div>
                  <h3 className="text-base font-semibold font-mono text-slate-100 mt-0.5">
                    {activePonPort.label} ({activePonPort.odcName})
                  </h3>
                </div>

                <button
                  onClick={() =>
                    onTogglePonPortAdmin(activeOlt.id, activePonPort.id)
                  }
                  className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
                    activePonPort.adminState === 'Enabled'
                      ? 'bg-rose-950/60 hover:bg-rose-900/70 text-rose-200 border-rose-800/70'
                      : 'bg-emerald-950/60 hover:bg-emerald-900/70 text-emerald-200 border-emerald-800/70'
                  }`}
                >
                  <Power className="w-3.5 h-3.5" />
                  {activePonPort.adminState === 'Enabled'
                    ? 'Matikan Port (Shutdown)'
                    : 'Aktifkan Port (No Shut)'}
                </button>
              </div>

              {/* Optical Telemetry Grid */}
              <div className="grid grid-cols-2 gap-3.5 my-4">
                <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-lg">
                  <div className="text-xs text-slate-400">Daya Pancar Laser OLT (Tx)</div>
                  <div className="text-lg font-mono tabular-nums font-semibold text-emerald-400 mt-1">
                    +{activePonPort.txPowerDbm.toFixed(2)} dBm
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Kelas Optik C+ (+3.0 s/d +7.0 dBm)
                  </div>
                </div>

                <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-lg">
                  <div className="text-xs text-slate-400">Rasio Splitter & Kapasitas</div>
                  <div className="text-lg font-mono tabular-nums font-semibold text-slate-100 mt-1">
                    {activePonPort.activeOnus} / {activePonPort.totalOnus} ONU
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Splitter Pasif {activePonPort.splitRatio} (~17.5 dB Loss)
                  </div>
                </div>

                <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-lg">
                  <div className="text-xs text-slate-400">Suhu & Arus Bias Laser SFP</div>
                  <div className="text-base font-mono tabular-nums font-semibold text-slate-100 mt-1">
                    {activePonPort.temperatureC.toFixed(1)} °C · {activePonPort.biasCurrentMa.toFixed(1)} mA
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Ambang Normal: &lt; 65 °C · &lt; 45 mA
                  </div>
                </div>

                <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-lg">
                  <div className="text-xs text-slate-400">Throughput Port PON Saat Ini</div>
                  <div className="text-base font-mono tabular-nums font-semibold text-sky-400 mt-1">
                    ↓ {activePonPort.downlinkTrafficMbps.toFixed(1)}M / ↑ {activePonPort.uplinkTrafficMbps.toFixed(1)}M
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    Kapasitas GPON: ↓ 2.488 Gbps / ↑ 1.244 Gbps
                  </div>
                </div>
              </div>

              {/* Optical Link Budget Calculator Summary */}
              <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-2.5">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-200">
                    Kalkulasi Optical Link Budget (OLT ke ODP)
                  </span>
                  <span className="text-xs font-mono tabular-nums text-slate-400">
                    Margin Aman: 28.0 dB
                  </span>
                </div>

                <div className="space-y-1.5 text-xs">
                  <div className="flex justify-between text-slate-300">
                    <span>Daya Pancar SFP OLT ({activePonPort.label})</span>
                    <span className="font-mono tabular-nums text-emerald-400">
                      +{activePonPort.txPowerDbm.toFixed(2)} dBm
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Redaman Splitter {activePonPort.splitRatio} (ODC + ODP)</span>
                    <span className="font-mono tabular-nums">
                      -{activePonPort.splitRatio === '1:64' ? '20.50' : '17.20'} dB
                    </span>
                  </div>
                  <div className="flex justify-between text-slate-400">
                    <span>Redaman Kabel Serat & Splicing (±0.35 dB/km)</span>
                    <span className="font-mono tabular-nums">-2.40 dB</span>
                  </div>
                  <div className="flex justify-between pt-2 border-t border-slate-800 font-medium text-slate-200">
                    <span>Estimasi Rata-Rata Rx Optik di Pelanggan</span>
                    <span className="font-mono tabular-nums text-sky-400">
                      {(
                        activePonPort.txPowerDbm -
                        (activePonPort.splitRatio === '1:64' ? 20.5 : 17.2) -
                        2.4
                      ).toFixed(2)}{' '}
                      dBm
                    </span>
                  </div>
                </div>
              </div>
            </div>
          ) : null}

          {activePonPort && (
            <div className="mt-5 pt-4 border-t border-slate-800 flex items-center justify-between gap-3">
              <div className="text-xs text-slate-400">
                Slot Aktif: #{activeSlot?.slotNumber} ({activeSlot?.cardModel})
              </div>
              <button
                onClick={() =>
                  onInspectPonOnus(activeOlt.id, activePonPort.label)
                }
                className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
              >
                Lihat Daftar ONU di Port Ini
                <ArrowUpRight className="w-3.5 h-3.5" />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
