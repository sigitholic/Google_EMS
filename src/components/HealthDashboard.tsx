import React, { useState, useEffect, useMemo } from 'react';
import {
  ResponsiveContainer,
  AreaChart,
  Area,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ReferenceLine,
} from 'recharts';
import { OltNode } from '../types/network';
import { Play, Pause, Zap, RefreshCw } from 'lucide-react';

interface TelemetryDataPoint {
  time: string;
  cpu: number;
  memory: number;
  tempC: number;
  downlinkGbps: number;
  uplinkGbps: number;
  packetLossPct: number;
}

interface HealthDashboardProps {
  olts: OltNode[];
  selectedOltId: string;
  onSelectOlt?: (oltId: string) => void;
  compact?: boolean;
}

function generateInitialSeries(olt: OltNode, pointsCount = 18): TelemetryDataPoint[] {
  const now = Date.now();
  const series: TelemetryDataPoint[] = [];

  for (let i = pointsCount - 1; i >= 0; i--) {
    const t = new Date(now - i * 3000);
    const timeLabel = t.toTimeString().slice(0, 8);
    const wave = Math.sin(i * 0.55);
    const noise = (Math.random() - 0.5) * 3.2;

    const cpu = Math.max(
      8,
      Math.min(96, Math.round(olt.cpuLoad + wave * 5 + noise))
    );
    const memory = Math.max(
      20,
      Math.min(94, Math.round(olt.memoryLoad + wave * 2.2 + noise * 0.5))
    );
    const tempC = Number(
      Math.max(
        31,
        Math.min(72, olt.chassisTempC + wave * 0.8 + (Math.random() - 0.5) * 0.6)
      ).toFixed(1)
    );
    const downlinkGbps = Number(
      Math.max(
        0.4,
        olt.downlinkThroughputGbps + wave * 1.35 + (Math.random() - 0.5) * 0.75
      ).toFixed(2)
    );
    const uplinkGbps = Number(
      Math.max(
        0.2,
        olt.uplinkThroughputGbps + wave * 0.48 + (Math.random() - 0.5) * 0.3
      ).toFixed(2)
    );

    series.push({
      time: timeLabel,
      cpu,
      memory,
      tempC,
      downlinkGbps,
      uplinkGbps,
      packetLossPct: olt.status === 'Critical' ? 1.85 : 0.01,
    });
  }

  return series;
}

export const HealthDashboard: React.FC<HealthDashboardProps> = ({
  olts,
  selectedOltId,
  onSelectOlt,
  compact = false,
}) => {
  const activeOlt = useMemo(
    () => olts.find((o) => o.id === selectedOltId) || olts[0],
    [olts, selectedOltId]
  );

  const [historyMap, setHistoryMap] = useState<
    Record<string, TelemetryDataPoint[]>
  >(() => {
    const initial: Record<string, TelemetryDataPoint[]> = {};
    for (const o of olts) {
      initial[o.id] = generateInitialSeries(o, 18);
    }
    return initial;
  });

  const [isLiveStreaming, setIsLiveStreaming] = useState<boolean>(true);
  const [pollIntervalMs, setPollIntervalMs] = useState<number>(2500);
  const [metricView, setMetricView] = useState<'ALL' | 'COMPUTE' | 'TRAFFIC'>(
    'ALL'
  );

  // Ensure new OLTs added dynamically also have telemetry history initialized
  useEffect(() => {
    setHistoryMap((prev) => {
      const next = { ...prev };
      let changed = false;
      for (const o of olts) {
        if (!next[o.id]) {
          next[o.id] = generateInitialSeries(o, 18);
          changed = true;
        }
      }
      return changed ? next : prev;
    });
  }, [olts]);

  // Real-time streaming interval updating CPU, Memory, Temp, and Uplink/Downlink Throughput
  useEffect(() => {
    if (!isLiveStreaming) return;

    const timer = setInterval(() => {
      const timeLabel = new Date().toTimeString().slice(0, 8);

      setHistoryMap((prev) => {
        const next: Record<string, TelemetryDataPoint[]> = {};
        for (const olt of olts) {
          const currentSeries = prev[olt.id] || generateInitialSeries(olt, 18);
          const lastPoint = currentSeries[currentSeries.length - 1] || {
            cpu: olt.cpuLoad,
            memory: olt.memoryLoad,
            tempC: olt.chassisTempC,
            downlinkGbps: olt.downlinkThroughputGbps,
            uplinkGbps: olt.uplinkThroughputGbps,
          };

          // Smooth mean-reverting random walk around OLT baseline
          const cpuDelta = Math.round(
            (olt.cpuLoad - lastPoint.cpu) * 0.35 + (Math.random() - 0.48) * 5
          );
          const memDelta = Math.round(
            (olt.memoryLoad - lastPoint.memory) * 0.25 +
              (Math.random() - 0.49) * 2
          );
          const downDelta =
            (olt.downlinkThroughputGbps - lastPoint.downlinkGbps) * 0.3 +
            (Math.random() - 0.48) * 0.85;
          const upDelta =
            (olt.uplinkThroughputGbps - lastPoint.uplinkGbps) * 0.3 +
            (Math.random() - 0.48) * 0.32;
          const tempDelta =
            (olt.chassisTempC - lastPoint.tempC) * 0.25 +
            (Math.random() - 0.48) * 0.4;

          const newPoint: TelemetryDataPoint = {
            time: timeLabel,
            cpu: Math.max(6, Math.min(98, lastPoint.cpu + cpuDelta)),
            memory: Math.max(18, Math.min(95, lastPoint.memory + memDelta)),
            tempC: Number(
              Math.max(30, Math.min(75, lastPoint.tempC + tempDelta)).toFixed(1)
            ),
            downlinkGbps: Number(
              Math.max(0.2, lastPoint.downlinkGbps + downDelta).toFixed(2)
            ),
            uplinkGbps: Number(
              Math.max(0.1, lastPoint.uplinkGbps + upDelta).toFixed(2)
            ),
            packetLossPct: olt.status === 'Critical' ? 1.92 : 0.01,
          };

          next[olt.id] = [...currentSeries.slice(-17), newPoint];
        }
        return next;
      });
    }, pollIntervalMs);

    return () => clearInterval(timer);
  }, [isLiveStreaming, pollIntervalMs, olts]);

  const activeSeries =
    historyMap[activeOlt.id] || generateInitialSeries(activeOlt, 18);
  const latestPoint = activeSeries[activeSeries.length - 1] || {
    time: '--:--:--',
    cpu: activeOlt.cpuLoad,
    memory: activeOlt.memoryLoad,
    tempC: activeOlt.chassisTempC,
    downlinkGbps: activeOlt.downlinkThroughputGbps,
    uplinkGbps: activeOlt.uplinkThroughputGbps,
    packetLossPct: 0.01,
  };

  // Peak calculations over active window
  const peakCpu = Math.max(...activeSeries.map((d) => d.cpu));
  const peakDownlink = Math.max(...activeSeries.map((d) => d.downlinkGbps));
  const peakUplink = Math.max(...activeSeries.map((d) => d.uplinkGbps));

  // Inject synthetic traffic & CPU burst for testing chart response
  const handleSimulateBurst = () => {
    const timeLabel = new Date().toTimeString().slice(0, 8);
    setHistoryMap((prev) => {
      const currentSeries = prev[activeOlt.id] || [];
      const burstPoint: TelemetryDataPoint = {
        time: timeLabel,
        cpu: Math.min(95, latestPoint.cpu + 28),
        memory: Math.min(92, latestPoint.memory + 12),
        tempC: Number((latestPoint.tempC + 2.4).toFixed(1)),
        downlinkGbps: Number((latestPoint.downlinkGbps + 4.6).toFixed(2)),
        uplinkGbps: Number((latestPoint.uplinkGbps + 1.8).toFixed(2)),
        packetLossPct: 0.14,
      };
      return {
        ...prev,
        [activeOlt.id]: [...currentSeries.slice(-17), burstPoint],
      };
    });
  };

  const handleResetBaseline = () => {
    setHistoryMap((prev) => ({
      ...prev,
      [activeOlt.id]: generateInitialSeries(activeOlt, 18),
    }));
  };

  const onlinePonCount = activeOlt.ponPorts.filter(
    (p) => p.operState === 'Up'
  ).length;

  return (
    <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-5 space-y-5">
      {/* Top Header & Controls */}
      <div className="flex flex-col xl:flex-row xl:items-center justify-between gap-4 pb-4 border-b border-slate-800">
        <div>
          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-400">
            <span className="font-semibold text-sky-400">
              REAL-TIME OLT HEALTH TELEMETRY
            </span>
            <span aria-hidden="true">·</span>
            <span>{activeOlt.vendor}</span>
            <span aria-hidden="true">·</span>
            <span>{activeOlt.model}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              IP {activeOlt.ipAddress}
            </span>
            <span aria-hidden="true">·</span>
            <span className="font-mono tabular-nums">
              Update {latestPoint.time}
            </span>
          </div>
          <h2 className="text-base font-semibold text-slate-100 mt-1">
            Health Dashboard: {activeOlt.name} ({activeOlt.locationPop})
          </h2>
        </div>

        {/* Interactive Toolbar */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          {/* Optional OLT Switcher if onSelectOlt is provided */}
          {onSelectOlt && !compact && (
            <select
              value={activeOlt.id}
              onChange={(e) => onSelectOlt(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-sky-500"
            >
              {olts.map((o) => (
                <option key={o.id} value={o.id}>
                  {o.vendor} · {o.name}
                </option>
              ))}
            </select>
          )}

          {/* Metric View Filter */}
          <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg">
            {(
              [
                { id: 'ALL', label: 'Semua Grafik' },
                { id: 'COMPUTE', label: 'CPU & Memori' },
                { id: 'TRAFFIC', label: 'Throughput Gbps' },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setMetricView(tab.id)}
                className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                  metricView === tab.id
                    ? 'bg-slate-800 text-white'
                    : 'text-slate-400 hover:text-slate-200'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* Polling Cadence Selector */}
          <select
            value={pollIntervalMs}
            onChange={(e) => setPollIntervalMs(Number(e.target.value))}
            className="px-2.5 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-300 font-mono tabular-nums"
          >
            <option value={1500}>Interval 1.5s</option>
            <option value={2500}>Interval 2.5s</option>
            <option value={5000}>Interval 5.0s</option>
          </select>

          {/* Live Pause/Resume Button */}
          <button
            onClick={() => setIsLiveStreaming((prev) => !prev)}
            className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors whitespace-nowrap shrink-0 ${
              isLiveStreaming
                ? 'bg-emerald-950/60 text-emerald-200 border-emerald-800/80 hover:bg-emerald-900/70'
                : 'bg-slate-800 text-slate-300 border-slate-700 hover:bg-slate-700'
            }`}
          >
            {isLiveStreaming ? (
              <>
                <Pause className="w-3.5 h-3.5" />
                Live Aktif
              </>
            ) : (
              <>
                <Play className="w-3.5 h-3.5" />
                Dijeda
              </>
            )}
          </button>

          {/* Simulate Traffic & CPU Spike */}
          <button
            onClick={handleSimulateBurst}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-amber-200 bg-amber-950/60 hover:bg-amber-900/70 border border-amber-800/70 rounded-lg transition-colors whitespace-nowrap shrink-0"
            title="Uji lonjakan trafik Gbps dan beban CPU pada grafik"
          >
            <Zap className="w-3.5 h-3.5" />
            Simulasi Lonjakan
          </button>

          <button
            onClick={handleResetBaseline}
            className="p-1.5 text-slate-400 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded-lg transition-colors"
            title="Reset histori grafik"
          >
            <RefreshCw className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Live Telemetry Summary Strip (Replaces static status boxes with dynamic live metrics + deltas) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-lg">
          <div className="text-xs text-slate-400">CPU Control Board</div>
          <div
            className={`text-lg font-mono tabular-nums font-semibold mt-1 ${
              latestPoint.cpu >= 80
                ? 'text-rose-400'
                : latestPoint.cpu >= 60
                ? 'text-amber-400'
                : 'text-sky-400'
            }`}
          >
            {latestPoint.cpu}%
          </div>
          <div className="text-xs text-slate-400 font-mono tabular-nums mt-0.5">
            Puncak: {peakCpu}% · Ambang: 85%
          </div>
        </div>

        <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-lg">
          <div className="text-xs text-slate-400">Utilisasi Memori RAM</div>
          <div
            className={`text-lg font-mono tabular-nums font-semibold mt-1 ${
              latestPoint.memory >= 85 ? 'text-amber-400' : 'text-indigo-400'
            }`}
          >
            {latestPoint.memory}%
          </div>
          <div className="text-xs text-slate-400 font-mono tabular-nums mt-0.5">
            Firmware {activeOlt.firmware.split(' ')[0]}
          </div>
        </div>

        <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-lg">
          <div className="text-xs text-slate-400">Downlink Throughput</div>
          <div className="text-lg font-mono tabular-nums font-semibold text-emerald-400 mt-1">
            ↓ {latestPoint.downlinkGbps.toFixed(2)} Gbps
          </div>
          <div className="text-xs text-slate-400 font-mono tabular-nums mt-0.5">
            Puncak: {peakDownlink.toFixed(2)} Gbps
          </div>
        </div>

        <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-lg">
          <div className="text-xs text-slate-400">Uplink Throughput</div>
          <div className="text-lg font-mono tabular-nums font-semibold text-cyan-400 mt-1">
            ↑ {latestPoint.uplinkGbps.toFixed(2)} Gbps
          </div>
          <div className="text-xs text-slate-400 font-mono tabular-nums mt-0.5">
            Puncak: {peakUplink.toFixed(2)} Gbps
          </div>
        </div>

        <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-lg">
          <div className="text-xs text-slate-400">Suhu Sasis & Backplane</div>
          <div
            className={`text-lg font-mono tabular-nums font-semibold mt-1 ${
              latestPoint.tempC >= 50
                ? 'text-rose-400'
                : latestPoint.tempC >= 44
                ? 'text-amber-400'
                : 'text-slate-100'
            }`}
          >
            {latestPoint.tempC.toFixed(1)} °C
          </div>
          <div className="text-xs text-slate-400 font-mono tabular-nums mt-0.5">
            Uptime: {activeOlt.uptime}
          </div>
        </div>

        <div className="p-3.5 bg-slate-950 border border-slate-800 rounded-lg">
          <div className="text-xs text-slate-400">Kesehatan Link & PON</div>
          <div
            className={`text-lg font-mono tabular-nums font-semibold mt-1 ${
              activeOlt.status === 'Normal'
                ? 'text-emerald-400'
                : activeOlt.status === 'Warning'
                ? 'text-amber-400'
                : 'text-rose-400'
            }`}
          >
            {onlinePonCount}/{activeOlt.ponPorts.length} PON Up
          </div>
          <div className="text-xs text-slate-400 font-mono tabular-nums mt-0.5">
            Loss: {latestPoint.packetLossPct}% · {activeOlt.snmpState}
          </div>
        </div>
      </div>

      {/* Recharts Visualizations Grid */}
      <div
        className={`grid grid-cols-1 ${
          metricView === 'ALL' ? ' lg:grid-cols-2' : ''
        } gap-6`}
      >
        {/* Chart 1: Real-Time CPU, Memory & Temperature Trend */}
        {(metricView === 'ALL' || metricView === 'COMPUTE') && (
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-semibold text-slate-200">
                  Tren Beban CPU, Utilisasi Memori & Suhu Sasis (%)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Telemetri prosesor control board ({activeOlt.slots.find((s) => s.cardRole === 'Control & Switch')?.cardModel || 'Main Control Unit'}) dengan batas peringatan 80%.
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono tabular-nums shrink-0">
                <span className="text-sky-400">CPU: {latestPoint.cpu}%</span>
                <span aria-hidden="true" className="text-slate-600">
                  ·
                </span>
                <span className="text-indigo-400">
                  RAM: {latestPoint.memory}%
                </span>
                <span aria-hidden="true" className="text-slate-600">
                  ·
                </span>
                <span className="text-amber-400">
                  Suhu: {latestPoint.tempC}°C
                </span>
              </div>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart
                  data={activeSeries}
                  margin={{ top: 10, right: 12, left: -16, bottom: 0 }}
                >
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#1e293b"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="time"
                    stroke="#64748b"
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    tickLine={false}
                  />
                  <YAxis
                    domain={[0, 100]}
                    stroke="#64748b"
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    tickLine={false}
                    unit="%"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontFamily: 'JetBrains Mono, monospace',
                    }}
                    labelStyle={{ color: '#e2e8f0', marginBottom: '4px' }}
                  />
                  <ReferenceLine
                    y={80}
                    stroke="#f43f5e"
                    strokeDasharray="4 4"
                    label={{
                      value: 'Batas Kritis CPU 80%',
                      position: 'insideTopRight',
                      fill: '#f43f5e',
                      fontSize: 10,
                    }}
                  />
                  <Line
                    type="monotone"
                    dataKey="cpu"
                    name="CPU Load (%)"
                    stroke="#38bdf8"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="memory"
                    name="Memory RAM (%)"
                    stroke="#818cf8"
                    strokeWidth={2}
                    dot={false}
                    activeDot={{ r: 4 }}
                    isAnimationActive={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="tempC"
                    name="Suhu Sasis (°C)"
                    stroke="#fbbf24"
                    strokeWidth={1.75}
                    strokeDasharray="4 2"
                    dot={false}
                    isAnimationActive={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}

        {/* Chart 2: Real-Time Uplink & Downlink Throughput Trend (Gbps) */}
        {(metricView === 'ALL' || metricView === 'TRAFFIC') && (
          <div className="p-4 bg-slate-950 border border-slate-800 rounded-lg space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <div>
                <h3 className="text-xs font-semibold text-slate-200">
                  Tren Throughput Trafik Downlink & Uplink (Gbps)
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  Agregasi trafik port uplink 10GE/40GE & distribusi GPON/XG-PON secara real-time.
                </p>
              </div>
              <div className="flex items-center gap-3 text-xs font-mono tabular-nums shrink-0">
                <span className="text-emerald-400">
                  ↓ Down: {latestPoint.downlinkGbps.toFixed(2)} Gbps
                </span>
                <span aria-hidden="true" className="text-slate-600">
                  ·
                </span>
                <span className="text-cyan-400">
                  ↑ Up: {latestPoint.uplinkGbps.toFixed(2)} Gbps
                </span>
              </div>
            </div>

            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart
                  data={activeSeries}
                  margin={{ top: 10, right: 12, left: -12, bottom: 0 }}
                >
                  <defs>
                    <linearGradient
                      id="downlinkGrad"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="#10b981"
                        stopOpacity={0.35}
                      />
                      <stop
                        offset="95%"
                        stopColor="#10b981"
                        stopOpacity={0.02}
                      />
                    </linearGradient>
                    <linearGradient
                      id="uplinkGrad"
                      x1="0"
                      y1="0"
                      x2="0"
                      y2="1"
                    >
                      <stop
                        offset="5%"
                        stopColor="#06b6d4"
                        stopOpacity={0.35}
                      />
                      <stop
                        offset="95%"
                        stopColor="#06b6d4"
                        stopOpacity={0.02}
                      />
                    </linearGradient>
                  </defs>
                  <CartesianGrid
                    strokeDasharray="3 3"
                    stroke="#1e293b"
                    vertical={false}
                  />
                  <XAxis
                    dataKey="time"
                    stroke="#64748b"
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    tickLine={false}
                  />
                  <YAxis
                    stroke="#64748b"
                    tick={{ fill: '#94a3b8', fontSize: 11 }}
                    tickLine={false}
                    unit="G"
                  />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#0f172a',
                      borderColor: '#334155',
                      borderRadius: '8px',
                      fontSize: '12px',
                      fontFamily: 'JetBrains Mono, monospace',
                    }}
                    labelStyle={{ color: '#e2e8f0', marginBottom: '4px' }}
                  />
                  <Area
                    type="monotone"
                    dataKey="downlinkGbps"
                    name="Downlink (Gbps)"
                    stroke="#10b981"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#downlinkGrad)"
                    isAnimationActive={false}
                  />
                  <Area
                    type="monotone"
                    dataKey="uplinkGbps"
                    name="Uplink (Gbps)"
                    stroke="#06b6d4"
                    strokeWidth={2}
                    fillOpacity={1}
                    fill="url(#uplinkGrad)"
                    isAnimationActive={false}
                  />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
