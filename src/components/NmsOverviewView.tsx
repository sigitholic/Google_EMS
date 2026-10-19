import React, { useState } from 'react';
import {
  OltNode,
  OnuDevice,
  UnconfiguredOnu,
  NetworkAlarm,
  AlarmSeverity,
} from '../types/network';
import { HealthDashboard } from './HealthDashboard';
import {
  ArrowUpRight,
  Check,
  Trash2,
  Download,
  Terminal,
  Activity,
} from 'lucide-react';

interface NmsOverviewViewProps {
  olts: OltNode[];
  onus: OnuDevice[];
  unconfiguredOnus: UnconfiguredOnu[];
  alarms: NetworkAlarm[];
  selectedOltId: string;
  onSelectOlt: (oltId: string) => void;
  onNavigateOltEms: (oltId: string) => void;
  onNavigateProvisioning: () => void;
  onNavigateCli: (oltId: string) => void;
  onAcknowledgeAlarm: (alarmId: string) => void;
  onClearAlarm: (alarmId: string) => void;
}

export const NmsOverviewView: React.FC<NmsOverviewViewProps> = ({
  olts,
  onus,
  unconfiguredOnus,
  alarms,
  selectedOltId,
  onSelectOlt,
  onNavigateOltEms,
  onNavigateProvisioning,
  onNavigateCli,
  onAcknowledgeAlarm,
  onClearAlarm,
}) => {
  const [severityFilter, setSeverityFilter] = useState<'ALL' | AlarmSeverity>(
    'ALL'
  );

  // Aggregate Metrics
  const totalPonPorts = olts.reduce((acc, o) => acc + o.ponPorts.length, 0);
  const totalActiveOnusAcrossPon = olts.reduce(
    (acc, o) => acc + o.ponPorts.reduce((s, p) => s + p.activeOnus, 0),
    0
  );
  const totalRegisteredAcrossPon = olts.reduce(
    (acc, o) => acc + o.ponPorts.reduce((s, p) => s + p.totalOnus, 0),
    0
  );
  const totalDownlinkGbps = olts.reduce(
    (acc, o) => acc + o.downlinkThroughputGbps,
    0
  );
  const totalUplinkGbps = olts.reduce(
    (acc, o) => acc + o.uplinkThroughputGbps,
    0
  );
  const unackedAlarmsCount = alarms.filter((a) => !a.acknowledged).length;

  const filteredAlarms = alarms.filter((a) =>
    severityFilter === 'ALL' ? true : a.severity === severityFilter
  );

  const handleExportAlarmsCsv = () => {
    const headers = [
      'Timestamp',
      'Severity',
      'Vendor',
      'OLT Name',
      'Source Object',
      'Alarm Code',
      'Description',
      'Root Cause Analysis',
    ];
    const rows = filteredAlarms.map((a) => [
      a.timestamp,
      a.severity,
      a.vendor,
      a.oltName,
      a.sourceObject,
      a.alarmCode,
      `"${a.description.replace(/"/g, '""')}"`,
      `"${a.rootCauseAnalysis.replace(/"/g, '""')}"`,
    ]);
    const csvContent =
      'data:text/csv;charset=utf-8,' +
      [headers.join(','), ...rows.map((r) => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', 'opticore_nms_alarms_report.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-6">
      {/* Top Section Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-semibold text-slate-100 tracking-tight">
            Pusat Kendali Jaringan FTTH & OLT Multi-Vendor (NOC NMS/EMS)
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Pemantauan terpadu kinerja elemen OLT ZTE, Huawei, FiberHome, dan Nokia beserta grafik tren CPU/Memori/Throughput real-time.
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          <button
            onClick={onNavigateProvisioning}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-slate-100 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            Antrean Autofind ONT ({unconfiguredOnus.length})
            <ArrowUpRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* 4-Column Full-Width KPI Telemetry Strip */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-5 bg-slate-900/70 border border-slate-800 rounded-lg">
          <div className="text-xs text-slate-400">
            Populasi OLT Multi-Vendor Aktif
          </div>
          <div className="text-2xl font-mono tabular-nums font-semibold text-slate-100 mt-1.5">
            {olts.length} Simpul OLT
          </div>
          <div className="text-xs text-slate-400 mt-2">
            ZTE · Huawei · FiberHome · Nokia ({totalPonPorts} Port PON)
          </div>
        </div>

        <div className="p-5 bg-slate-900/70 border border-slate-800 rounded-lg">
          <div className="text-xs text-slate-400">
            Total ONT Aktif / Terdaftar (PON)
          </div>
          <div className="text-2xl font-mono tabular-nums font-semibold text-emerald-400 mt-1.5">
            {totalActiveOnusAcrossPon} / {totalRegisteredAcrossPon}
          </div>
          <div className="text-xs text-slate-400 mt-2 font-mono tabular-nums">
            Rasio Ketersediaan Optik:{' '}
            {totalRegisteredAcrossPon > 0
              ? (
                  (totalActiveOnusAcrossPon / totalRegisteredAcrossPon) *
                  100
                ).toFixed(1)
              : '100.0'}
            %
          </div>
        </div>

        <div className="p-5 bg-slate-900/70 border border-slate-800 rounded-lg">
          <div className="text-xs text-slate-400">
            Trafik Agregat Downlink / Uplink
          </div>
          <div className="text-2xl font-mono tabular-nums font-semibold text-sky-400 mt-1.5">
            ↓ {totalDownlinkGbps.toFixed(2)}G / ↑ {totalUplinkGbps.toFixed(2)}G
          </div>
          <div className="text-xs text-slate-400 mt-2">
            Agregasi Metro-E 10G/100G · Sesi PPPoE Normal
          </div>
        </div>

        <div className="p-5 bg-slate-900/70 border border-slate-800 rounded-lg">
          <div className="text-xs text-slate-400">
            Alarm Aktif & Antrean Autofind
          </div>
          <div className="text-2xl font-mono tabular-nums font-semibold text-amber-400 mt-1.5">
            {unackedAlarmsCount} Alarm · {unconfiguredOnus.length} Uncfg
          </div>
          <div className="text-xs text-slate-400 mt-2">
            Korelasi Otomatis PON LOS & Dying Gasp Aktif
          </div>
        </div>
      </div>

      {/* Interactive Recharts Health Dashboard for Selected OLT */}
      <HealthDashboard
        olts={olts}
        selectedOltId={selectedOltId}
        onSelectOlt={onSelectOlt}
      />

      {/* Multi-Vendor OLT Inventory & Health Matrix */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-5 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">
              Matriks Perangkat OLT Multi-Vendor (Klik Grafik atau Inspeksi Sasis)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Pilih tombol Pantau Grafik untuk menampilkan tren CPU, memori, dan throughput OLT tersebut pada Health Dashboard di atas.
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums text-slate-400">
            Polling SNMPv3 + Telemetry NETCONF: Interval Aktif
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-xs font-medium text-slate-400">
                <th className="py-2.5 pr-4">Hostname OLT & Lokasi POP</th>
                <th className="py-2.5 px-3">Vendor & Sasis</th>
                <th className="py-2.5 px-3">IP Manajemen</th>
                <th className="py-2.5 px-3">Protokol Manajemen</th>
                <th className="py-2.5 px-3 text-right">Baseline CPU / RAM</th>
                <th className="py-2.5 px-3 text-right">ONT Aktif</th>
                <th className="py-2.5 px-3 text-right">Throughput</th>
                <th className="py-2.5 pl-3 text-right">Tindakan EMS</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 text-xs">
              {olts.map((olt) => {
                const isSelectedForChart = olt.id === selectedOltId;
                const activeOnuSum = olt.ponPorts.reduce(
                  (s, p) => s + p.activeOnus,
                  0
                );
                const totalOnuSum = olt.ponPorts.reduce(
                  (s, p) => s + p.totalOnus,
                  0
                );
                return (
                  <tr
                    key={olt.id}
                    className={`transition-colors ${
                      isSelectedForChart
                        ? 'bg-sky-950/25 hover:bg-sky-950/40'
                        : 'hover:bg-slate-800/40'
                    }`}
                  >
                    <td className="py-3.5 pr-4">
                      <div className="font-semibold text-slate-100">
                        {olt.name}
                      </div>
                      <div className="text-slate-400 mt-0.5">
                        {olt.locationPop} · {olt.region}
                      </div>
                    </td>

                    <td className="py-3.5 px-3">
                      <div className="font-semibold text-sky-400">
                        {olt.vendor}
                      </div>
                      <div className="text-slate-400 mt-0.5">
                        {olt.model} · {olt.firmware}
                      </div>
                    </td>

                    <td className="py-3.5 px-3 font-mono tabular-nums">
                      <div className="text-slate-200">{olt.ipAddress}</div>
                      <div className="text-slate-400 mt-0.5">
                        Uptime: {olt.uptime}
                      </div>
                    </td>

                    <td className="py-3.5 px-3">
                      <div className="text-slate-200 font-medium">
                        SNMPv3: {olt.snmpState}
                      </div>
                      <div className="text-slate-400 mt-0.5">
                        NETCONF: {olt.netconfState}
                      </div>
                    </td>

                    <td className="py-3.5 px-3 text-right font-mono tabular-nums text-slate-200">
                      <div>
                        {olt.cpuLoad}% / {olt.memoryLoad}%
                      </div>
                      <div className="text-slate-400 mt-0.5">
                        {olt.chassisTempC.toFixed(1)} °C
                      </div>
                    </td>

                    <td className="py-3.5 px-3 text-right font-mono tabular-nums">
                      <div className="font-semibold text-slate-100">
                        {activeOnuSum} / {totalOnuSum}
                      </div>
                      <div className="text-slate-400 mt-0.5">
                        {olt.ponPorts.length} Port PON
                      </div>
                    </td>

                    <td className="py-3.5 px-3 text-right font-mono tabular-nums text-slate-200">
                      <div className="text-sky-400">
                        ↓ {olt.downlinkThroughputGbps.toFixed(2)} Gbps
                      </div>
                      <div className="text-slate-400 mt-0.5">
                        ↑ {olt.uplinkThroughputGbps.toFixed(2)} Gbps
                      </div>
                    </td>

                    <td className="py-3.5 pl-3 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => onSelectOlt(olt.id)}
                          className={`inline-flex items-center gap-1 px-2.5 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap ${
                            isSelectedForChart
                              ? 'bg-sky-600 text-white border-sky-500'
                              : 'bg-slate-900 text-slate-300 hover:text-white border-slate-700'
                          }`}
                        >
                          <Activity className="w-3.5 h-3.5" />
                          {isSelectedForChart ? 'Sedang Dipantau' : 'Pantau Grafik'}
                        </button>
                        <button
                          onClick={() => onNavigateOltEms(olt.id)}
                          className="px-2.5 py-1.5 text-xs font-medium text-slate-100 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors whitespace-nowrap"
                        >
                          Sasis
                        </button>
                        <button
                          onClick={() => onNavigateCli(olt.id)}
                          title="Buka Terminal CLI OLT"
                          className="p-1.5 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
                        >
                          <Terminal className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* NMS Fault Management & Root-Cause Correlation Console */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">
              Konsol Alarm Jaringan & Analisis Akar Masalah (Fault & Root-Cause Correlation)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Membedakan secara otomatis antara putus serat optik feeder/dropcore (LOSi/PON LOS) dengan mati listrik pelanggan (Dying Gasp).
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Severity Filter Segmented Buttons */}
            <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg">
              {(['ALL', 'Critical', 'Major', 'Warning', 'Minor'] as const).map(
                (sev) => (
                  <button
                    key={sev}
                    onClick={() => setSeverityFilter(sev)}
                    className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                      severityFilter === sev
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {sev === 'ALL' ? 'Semua' : sev}
                  </button>
                )
              )}
            </div>

            <button
              onClick={handleExportAlarmsCsv}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors whitespace-nowrap shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              Ekspor CSV
            </button>
          </div>
        </div>

        {filteredAlarms.length === 0 ? (
          <div className="py-8 text-center text-xs text-slate-400">
            Tidak ada alarm aktif pada kategori filter ini. Jaringan beroperasi normal.
          </div>
        ) : (
          <div className="divide-y divide-slate-800">
            {filteredAlarms.map((alarm) => (
              <div
                key={alarm.id}
                className="py-4 first:pt-1 last:pb-1 flex flex-col lg:flex-row lg:items-start justify-between gap-4"
              >
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2 text-xs">
                    <span
                      className={`font-semibold ${
                        alarm.severity === 'Critical'
                          ? 'text-rose-400'
                          : alarm.severity === 'Major'
                          ? 'text-amber-400'
                          : alarm.severity === 'Warning'
                          ? 'text-sky-400'
                          : 'text-slate-300'
                      }`}
                    >
                      [{alarm.severity.toUpperCase()}] {alarm.alarmCode}
                    </span>
                    <span aria-hidden="true" className="text-slate-600">
                      ·
                    </span>
                    <span className="font-semibold text-slate-200">
                      {alarm.vendor} {alarm.oltName}
                    </span>
                    <span aria-hidden="true" className="text-slate-600">
                      ·
                    </span>
                    <span className="font-mono text-slate-300">
                      {alarm.sourceObject}
                    </span>
                    <span aria-hidden="true" className="text-slate-600">
                      ·
                    </span>
                    <span className="font-mono tabular-nums text-slate-400">
                      {alarm.timestamp}
                    </span>
                  </div>

                  <p className="text-sm font-medium text-slate-100">
                    {alarm.description}
                  </p>

                  <p className="text-xs text-slate-400 leading-relaxed">
                    {alarm.rootCauseAnalysis}
                  </p>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {!alarm.acknowledged ? (
                    <button
                      onClick={() => onAcknowledgeAlarm(alarm.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors whitespace-nowrap"
                    >
                      <Check className="w-3.5 h-3.5 text-emerald-400" />
                      Acknowledge
                    </button>
                  ) : (
                    <span className="text-xs text-slate-500 px-2">
                      Acknowledged
                    </span>
                  )}

                  <button
                    onClick={() => onClearAlarm(alarm.id)}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-slate-300 hover:text-white bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors whitespace-nowrap"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Bersihkan
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};
