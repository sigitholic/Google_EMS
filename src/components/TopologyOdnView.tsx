import React, { useState } from 'react';
import { OltNode, OnuDevice, NetworkAlarm } from '../types/network';
import {
  Network,
  ZapOff,
  Scissors,
  RotateCcw,
  ArrowRight,
  CheckCircle2,
  AlertTriangle,
} from 'lucide-react';

interface TopologyOdnViewProps {
  olts: OltNode[];
  onus: OnuDevice[];
  alarms: NetworkAlarm[];
  onSimulateFeederCut: (oltId: string) => void;
  onSimulateDyingGasp: (oltId: string) => void;
  onRestoreNetworkNormal: () => void;
  onSelectOltInEms: (oltId: string) => void;
}

export const TopologyOdnView: React.FC<TopologyOdnViewProps> = ({
  olts,
  onus,
  alarms,
  onSimulateFeederCut,
  onSimulateDyingGasp,
  onRestoreNetworkNormal,
  onSelectOltInEms,
}) => {
  const [focusedOltId, setFocusedOltId] = useState<string>(olts[0]?.id || '');
  const focusedOlt = olts.find((o) => o.id === focusedOltId) || olts[0];
  const focusedOnus = onus.filter((u) => u.oltId === focusedOlt.id);

  return (
    <div className="space-y-6">
      {/* Header & Interactive Fault Correlation Simulator */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-5 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-semibold text-slate-100 tracking-tight">
            Topologi Jaringan Metro & Hierarki ODN (FTTH NMS)
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Peta keterhubungan Core BNG/BRAS, Agregasi Metro-E, OLT Multi-Vendor, ODC, ODP, hingga ONT pelanggan beserta korelasi gangguan optik.
          </p>
        </div>

        {/* Fault Correlation Simulator Controls */}
        <div className="flex flex-wrap items-center gap-2">
          <button
            onClick={() => onSimulateFeederCut(focusedOlt.id)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-rose-200 bg-rose-950/70 hover:bg-rose-900/80 border border-rose-800/80 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Scissors className="w-3.5 h-3.5" />
            Simulasi Putus Feeder ODC ({focusedOlt.vendor})
          </button>
          <button
            onClick={() => onSimulateDyingGasp(focusedOlt.id)}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-amber-200 bg-amber-950/70 hover:bg-amber-900/80 border border-amber-800/80 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <ZapOff className="w-3.5 h-3.5" />
            Simulasi Mati Listrik PLN (Dying Gasp)
          </button>
          <button
            onClick={onRestoreNetworkNormal}
            className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-emerald-200 bg-emerald-950/70 hover:bg-emerald-900/80 border border-emerald-800/80 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <RotateCcw className="w-3.5 h-3.5" />
            Pulihkan Semua Jalur Optik
          </button>
        </div>
      </div>

      {/* Interactive End-to-End Hierarchy Diagram */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-5 space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">
              Arsitektur Lapisan Jaringan: Core BNG → Metro-E → Multi-Vendor OLT → ODN (ODC/ODP)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Klik salah satu node OLT di bawah untuk menelusuri pohon distribusi pasif (Passive Optical Splitter) ODC dan ODP.
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums text-slate-400">
            Protokol Uplink: LACP 2x10GE · QinQ 802.1ad · MPLS-TP
          </span>
        </div>

        {/* Tier 1 & Tier 2: Core BNG & Metro Aggregation */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between">
            <div>
              <div className="text-xs text-sky-400 font-semibold">
                TIER 1 · CORE ROUTER & BNG / BRAS
              </div>
              <div className="text-sm font-semibold text-slate-100 mt-0.5">
                BNG-CORE-JKT-01 (PPPoE / IPoE Subscriber Gateway)
              </div>
              <div className="text-xs font-mono tabular-nums text-slate-400 mt-1">
                Loopback: 10.255.0.1 · Sesi PPPoE Aktif: 14,820 · BGP ASN 138910
              </div>
            </div>
            <span className="text-xs font-mono text-emerald-400 shrink-0">
              100GE UP
            </span>
          </div>

          <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg flex items-center justify-between">
            <div>
              <div className="text-xs text-sky-400 font-semibold">
                TIER 2 · METRO ETHERNET AGGREGATION RING
              </div>
              <div className="text-sm font-semibold text-slate-100 mt-0.5">
                SW-METRO-RING-NUSANTARA (ITU-T G.8032 ERPS &lt; 50ms)
              </div>
              <div className="text-xs font-mono tabular-nums text-slate-400 mt-1">
                SVLAN Trunk: 1100, 1200, 2100, 3100, 4100 · Uplink Utilisasi: 38.4%
              </div>
            </div>
            <span className="text-xs font-mono text-emerald-400 shrink-0">
              ERPS NORMAL
            </span>
          </div>
        </div>

        {/* Tier 3: Multi-Vendor OLT Nodes Selector */}
        <div>
          <div className="text-xs font-semibold text-slate-300 mb-3">
            TIER 3 · SIMPUL ACCESS OLT MULTI-VENDOR (Pilih OLT untuk Inspeksi Cabang ODC/ODP)
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {olts.map((olt) => {
              const isFocused = olt.id === focusedOlt.id;
              return (
                <button
                  key={olt.id}
                  onClick={() => setFocusedOltId(olt.id)}
                  className={`text-left p-4 rounded-lg border transition-colors ${
                    isFocused
                      ? 'bg-slate-900 border-sky-500'
                      : 'bg-slate-950 border-slate-800 hover:border-slate-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span className="font-semibold text-sky-400">
                      {olt.vendor}
                    </span>
                    <span
                      className={`font-medium ${
                        olt.status === 'Normal'
                          ? 'text-emerald-400'
                          : olt.status === 'Warning'
                          ? 'text-amber-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {olt.status}
                    </span>
                  </div>
                  <div className="text-sm font-semibold text-slate-100 mt-1 truncate">
                    {olt.name}
                  </div>
                  <div className="text-xs text-slate-400 mt-0.5">
                    {olt.region} · <span className="font-mono">{olt.ipAddress}</span>
                  </div>
                  <div className="flex items-center justify-between text-xs font-mono tabular-nums text-slate-400 mt-3 pt-2 border-t border-slate-800">
                    <span>{olt.ponPorts.length} Port PON</span>
                    <span>↓{olt.downlinkThroughputGbps.toFixed(1)} Gbps</span>
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Tier 4 & Tier 5: ODC & ODP Optical Distribution Network Tree for Focused OLT */}
        <div className="pt-4 border-t border-slate-800 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <div className="text-xs font-semibold text-sky-400">
                TIER 4 & TIER 5 · JARINGAN DISTRIBUSI OPTIK PASIF (ODC → ODP → ONT)
              </div>
              <h3 className="text-base font-semibold text-slate-100 mt-0.5">
                Pohon Distribusi Serat Optik: {focusedOlt.name} ({focusedOlt.vendor} {focusedOlt.model})
              </h3>
            </div>
            <button
              onClick={() => onSelectOltInEms(focusedOlt.id)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              Buka Sasis Fisik {focusedOlt.vendor}
              <ArrowRight className="w-3.5 h-3.5" />
            </button>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {focusedOlt.ponPorts.map((port) => {
              const portOnus = focusedOnus.filter(
                (u) => u.ponPortLabel === port.label
              );
              return (
                <div
                  key={port.id}
                  className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-3"
                >
                  <div className="flex items-center justify-between pb-2.5 border-b border-slate-800">
                    <div>
                      <div className="text-xs font-mono font-semibold text-slate-100">
                        Port PON: {port.label} → Kabinet {port.odcName}
                      </div>
                      <div className="text-xs text-slate-400 mt-0.5 font-mono tabular-nums">
                        Tx +{port.txPowerDbm.toFixed(1)} dBm · Splitter {port.splitRatio} · Aktif {port.activeOnus}/{port.totalOnus} ONT
                      </div>
                    </div>
                    <span
                      className={`text-xs font-semibold ${
                        port.operState === 'Up'
                          ? 'text-emerald-400'
                          : port.operState === 'Degraded'
                          ? 'text-amber-400'
                          : 'text-rose-400'
                      }`}
                    >
                      {port.operState === 'Up'
                        ? 'Feeder Normal'
                        : port.operState === 'Degraded'
                        ? 'Redaman Tinggi'
                        : 'Feeder LOS Cut'}
                    </span>
                  </div>

                  {/* Attached ONUs under this ODC/PON */}
                  {portOnus.length === 0 ? (
                    <div className="text-xs text-slate-400 py-2">
                      Semua {port.activeOnus} ONT pada ODC {port.odcName} beroperasi normal (tidak ada sampel deviasi di tabel).
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {portOnus.map((onu) => (
                        <div
                          key={onu.id}
                          className="p-2.5 bg-slate-900/90 border border-slate-800 rounded flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs"
                        >
                          <div>
                            <div className="font-medium text-slate-200">
                              {onu.odpName} → {onu.customerName}
                            </div>
                            <div className="text-slate-400 font-mono tabular-nums mt-0.5">
                              SN {onu.serialNumber} · Indeks :{onu.onuIndex} · Jarak {onu.distanceKm} km
                            </div>
                          </div>

                          <div className="text-right font-mono tabular-nums shrink-0">
                            <div
                              className={`font-semibold ${
                                onu.status === 'Online'
                                  ? onu.rxPowerDbm < -27.0
                                    ? 'text-amber-400'
                                    : 'text-emerald-400'
                                  : onu.status === 'DyingGasp'
                                  ? 'text-amber-400'
                                  : 'text-rose-400'
                              }`}
                            >
                              {onu.status} ({onu.rxPowerDbm.toFixed(1)} dBm)
                            </div>
                            <div className="text-slate-400">
                              SVLAN {onu.svlan} / CVLAN {onu.cvlan}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* Root-Cause Correlation Knowledge Matrix */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-5">
        <h3 className="text-sm font-semibold text-slate-100">
          Mesin Korelasi Alarm Optik Otomatis (Root-Cause Analysis NMS)
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-3 text-xs">
          <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-lg">
            <div className="font-semibold text-rose-400">
              1. Indikasi Putus Kabel Feeder / Distribusi (PON LOS)
            </div>
            <p className="text-slate-400 mt-1 leading-relaxed">
              Apabila seluruh ONT pada satu port PON atau satu ODP mengalami <span className="text-slate-200">LOSi secara serentak tanpa pesan Dying Gasp</span>, NMS mengklasifikasikan sebagai putus serat optik backbone/feeder.
            </p>
          </div>
          <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-lg">
            <div className="font-semibold text-amber-400">
              2. Indikasi Pemadaman Listrik Pelanggan (Dying Gasp)
            </div>
            <p className="text-slate-400 mt-1 leading-relaxed">
              Apabila ONT mengirimkan frame OAM <span className="text-slate-200">Dying Gasp (ITU-T G.984.3)</span> beberapa milidetik sebelum kehilangan sinyal, NMS menahan tiket gangguan tim fiber karena penyebabnya adalah listrik PLN pelanggan padam.
            </p>
          </div>
          <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-lg">
            <div className="font-semibold text-sky-400">
              3. Degradasi Redaman Pasif / Makro-Bending
            </div>
            <p className="text-slate-400 mt-1 leading-relaxed">
              Apabila ONT tetap Online namun nilai <span className="text-slate-200">Rx Optical Power turun di bawah -27.0 dBm</span>, NMS menerbitkan peringatan dini sebelum terjadi packet loss atau flapping PPPoE.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};
