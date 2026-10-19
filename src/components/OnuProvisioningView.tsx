import React, { useState, useMemo } from 'react';
import {
  OltNode,
  OnuDevice,
  UnconfiguredOnu,
  VendorType,
} from '../types/network';
import { generateVendorProvisioningCli } from '../data/initialNetworkData';
import {
  Search,
  RefreshCw,
  Plus,
  Check,
  Terminal,
  RotateCcw,
  Trash2,
  Sliders,
  X,
} from 'lucide-react';

interface OnuProvisioningViewProps {
  olts: OltNode[];
  onus: OnuDevice[];
  unconfiguredOnus: UnconfiguredOnu[];
  initialFilterOltId?: string;
  initialFilterPonLabel?: string;
  onProvisionOnu: (
    uncfgId: string,
    newOnu: OnuDevice,
    executedCli: string
  ) => void;
  onScanNewUnconfiguredOnu: () => void;
  onRebootOnu: (onuId: string) => void;
  onMeasureOpticalOnu: (onuId: string) => void;
  onDeleteOnu: (onuId: string) => void;
}

export const OnuProvisioningView: React.FC<OnuProvisioningViewProps> = ({
  olts,
  onus,
  unconfiguredOnus,
  initialFilterOltId = 'ALL',
  initialFilterPonLabel = '',
  onProvisionOnu,
  onScanNewUnconfiguredOnu,
  onRebootOnu,
  onMeasureOpticalOnu,
  onDeleteOnu,
}) => {
  const [vendorFilter, setVendorFilter] = useState<'ALL' | VendorType>('ALL');
  const [oltFilter, setOltFilter] = useState<string>(initialFilterOltId);
  const [statusFilter, setStatusFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>(initialFilterPonLabel);
  const [isScanning, setIsScanning] = useState(false);
  const [selectedOnuDiagnostic, setSelectedOnuDiagnostic] =
    useState<OnuDevice | null>(null);

  // Provisioning Modal State
  const [activeUncfg, setActiveUncfg] = useState<UnconfiguredOnu | null>(null);
  const [customerName, setCustomerName] = useState('PT Solusi Digital Nusantara');
  const [serviceId, setServiceId] = useState('SID-FTTH-90411');
  const [odpName, setOdpName] = useState('ODP-SDM-FB02/08');
  const [onuIndex, setOnuIndex] = useState(19);
  const [svlan, setSvlan] = useState(1100);
  const [cvlan, setCvlan] = useState(105);
  const [lineProfile, setLineProfile] = useState('LP-BIZ-300M');
  const [serviceProfile, setServiceProfile] = useState('SP-ROUTED-TRIPLE');
  const [upMbps, setUpMbps] = useState(150);
  const [downMbps, setDownMbps] = useState(300);

  const openProvisionModal = (item: UnconfiguredOnu) => {
    setActiveUncfg(item);
    const existingOnPort = onus.filter(
      (u) => u.oltId === item.oltId && u.ponPortLabel === item.ponPortLabel
    );
    const nextIdx =
      existingOnPort.reduce((max, u) => Math.max(max, u.onuIndex), 0) + 1;
    setOnuIndex(nextIdx);
    setServiceId(`SID-${item.oltVendor.slice(0, 3).toUpperCase()}-${Math.floor(100000 + Math.random() * 899999)}`);
    setCustomerName(`Pelanggan FTTH ${item.loid || item.serialNumber.slice(-4)}`);
    setOdpName(`ODP-${item.ponPortLabel.replace(/[^a-zA-Z0-9]/g, '')}/01`);
    if (item.oltVendor === 'ZTE') {
      setSvlan(1100);
      setCvlan(102);
    } else if (item.oltVendor === 'Huawei') {
      setSvlan(2100);
      setCvlan(312);
    } else if (item.oltVendor === 'FiberHome') {
      setSvlan(3100);
      setCvlan(405);
    } else {
      setSvlan(4100);
      setCvlan(505);
    }
  };

  const previewCliScript = useMemo(() => {
    if (!activeUncfg) return '';
    return generateVendorProvisioningCli({
      vendor: activeUncfg.oltVendor,
      ponPortLabel: activeUncfg.ponPortLabel,
      onuIndex,
      serialNumber: activeUncfg.serialNumber,
      model: activeUncfg.detectedModel,
      customerName,
      serviceId,
      svlan,
      cvlan,
      lineProfile,
      serviceProfile,
      upMbps,
      downMbps,
    });
  }, [
    activeUncfg,
    onuIndex,
    customerName,
    serviceId,
    svlan,
    cvlan,
    lineProfile,
    serviceProfile,
    upMbps,
    downMbps,
  ]);

  const handleConfirmProvision = (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeUncfg) return;

    const newOnu: OnuDevice = {
      id: `onu-${Date.now()}`,
      oltId: activeUncfg.oltId,
      oltName: activeUncfg.oltName,
      vendor: activeUncfg.oltVendor,
      ponPortLabel: activeUncfg.ponPortLabel,
      onuIndex,
      serialNumber: activeUncfg.serialNumber,
      model: activeUncfg.detectedModel,
      customerName,
      serviceId,
      odpName,
      status: 'Online',
      rxPowerDbm: activeUncfg.rxPowerDbm,
      txPowerDbm: 2.2,
      oltRxPowerDbm: Number((activeUncfg.rxPowerDbm - 1.6).toFixed(1)),
      distanceKm: activeUncfg.distanceKm,
      cvlan,
      svlan,
      lineProfile,
      serviceProfile,
      bandwidthUpMbps: upMbps,
      bandwidthDownMbps: downMbps,
      ipAddressPppoe: `10.140.${Math.floor(10 + Math.random() * 200)}.${Math.floor(10 + Math.random() * 240)}`,
      macAddress: `A4:9B:4F:${Math.floor(10 + Math.random() * 89)}:${Math.floor(10 + Math.random() * 89)}:C1`,
      lastChange: '2026-10-19 10:12:00',
      uptime: '0d 00h 01m',
    };

    onProvisionOnu(activeUncfg.id, newOnu, previewCliScript);
    setActiveUncfg(null);
  };

  const handleTriggerAutofind = () => {
    setIsScanning(true);
    onScanNewUnconfiguredOnu();
    setTimeout(() => setIsScanning(false), 400);
  };

  const filteredOnus = useMemo(() => {
    return onus.filter((item) => {
      if (vendorFilter !== 'ALL' && item.vendor !== vendorFilter) return false;
      if (oltFilter !== 'ALL' && item.oltId !== oltFilter) return false;
      if (statusFilter !== 'ALL' && item.status !== statusFilter) return false;
      if (searchQuery.trim() !== '') {
        const q = searchQuery.toLowerCase();
        const match =
          item.serialNumber.toLowerCase().includes(q) ||
          item.customerName.toLowerCase().includes(q) ||
          item.serviceId.toLowerCase().includes(q) ||
          item.ponPortLabel.toLowerCase().includes(q) ||
          item.odpName.toLowerCase().includes(q);
        if (!match) return false;
      }
      return true;
    });
  }, [onus, vendorFilter, oltFilter, statusFilter, searchQuery]);

  return (
    <div className="space-y-6">
      {/* Header & Discovery Action */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-slate-800">
        <div>
          <h1 className="text-xl font-semibold text-slate-100 tracking-tight">
            Auto-Discovery & Provisioning ONU/ONT Multi-Vendor
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Deteksi otomatis perangkat ONT belum terkonfigurasi (Uncfg/Autofind) dan kompilasi skrip OMCI/VLAN lintas vendor.
          </p>
        </div>

        <button
          onClick={handleTriggerAutofind}
          className="inline-flex items-center gap-2 px-4 py-2 text-xs font-medium text-white bg-sky-600 hover:bg-sky-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${isScanning ? 'animate-spin' : ''}`} />
          Pindai PON Autofind Baru ({unconfiguredOnus.length})
        </button>
      </div>

      {/* Section 1: Unconfigured / Autofind ONU Queue */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">
              Antrean ONT Terdeteksi Belum Terkonfigurasi (PON Autofind / Uncfg)
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Hasil polling perintah <code className="text-sky-400">show gpon onu uncfg</code> (ZTE), <code className="text-sky-400">display ont autofind all</code> (Huawei), dan <code className="text-sky-400">show pon unauth</code>.
            </p>
          </div>
          <span className="text-xs font-mono tabular-nums text-slate-400">
            {unconfiguredOnus.length} ONT Menunggu Otorisasi
          </span>
        </div>

        {unconfiguredOnus.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-sm text-slate-300">
              Seluruh ONT yang terhubung pada port PON telah terotorisasi.
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Klik tombol Pindai PON Autofind Baru di kanan atas untuk mensimulasikan deteksi ONT baru di lapangan.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4 mt-4">
            {unconfiguredOnus.map((item) => (
              <div
                key={item.id}
                className="p-4 bg-slate-950 border border-slate-800 rounded-lg flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between text-xs text-slate-400">
                    <span className="font-semibold text-sky-400">
                      {item.oltVendor}
                    </span>
                    <span className="font-mono tabular-nums">
                      {item.discoveredAt}
                    </span>
                  </div>

                  <div className="text-sm font-mono tabular-nums font-semibold text-slate-100 mt-1">
                    SN: {item.serialNumber}
                  </div>

                  <div className="text-xs text-slate-400 mt-1">
                    {item.oltName} · Port <span className="font-mono text-slate-200">{item.ponPortLabel}</span>
                  </div>

                  <div className="flex items-center gap-2 text-xs text-slate-400 mt-2 pt-2 border-t border-slate-800/80 font-mono tabular-nums">
                    <span>Tipe: {item.detectedModel}</span>
                    <span aria-hidden="true">·</span>
                    <span className="text-emerald-400">{item.rxPowerDbm} dBm</span>
                    <span aria-hidden="true">·</span>
                    <span>{item.distanceKm} km</span>
                  </div>
                </div>

                <button
                  onClick={() => openProvisionModal(item)}
                  className="mt-3.5 w-full inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-medium text-white bg-sky-600 hover:bg-sky-500 rounded-lg transition-colors whitespace-nowrap"
                >
                  <Plus className="w-3.5 h-3.5" />
                  Provisioning & Otorisasi ONT
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Section 2: Active ONU Inventory & Optical Diagnostics */}
      <div className="bg-slate-900/70 border border-slate-800 rounded-lg p-5 space-y-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-800">
          <div>
            <h2 className="text-sm font-semibold text-slate-100">
              Inventaris ONT Terdaftar & Telemetri Redaman Optik ({filteredOnus.length})
            </h2>
            <p className="text-xs text-slate-400 mt-0.5">
              Pantau level sinyal Rx ONU/OLT (ambang batas normal -15.0 dBm s/d -27.0 dBm), jarak serat, dan status OAM.
            </p>
          </div>

          {/* Interactive Filters */}
          <div className="flex flex-wrap items-center gap-2.5">
            {/* Vendor Segmented Filter */}
            <div className="flex items-center gap-1 p-1 bg-slate-950 border border-slate-800 rounded-lg">
              {(['ALL', 'ZTE', 'Huawei', 'FiberHome', 'Nokia'] as const).map(
                (v) => (
                  <button
                    key={v}
                    onClick={() => setVendorFilter(v)}
                    className={`px-2.5 py-1 text-xs font-medium rounded transition-colors whitespace-nowrap shrink-0 ${
                      vendorFilter === v
                        ? 'bg-slate-800 text-white'
                        : 'text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    {v === 'ALL' ? 'Semua Vendor' : v}
                  </button>
                )
              )}
            </div>

            {/* Status Filter Select */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="px-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-200 focus:outline-none focus:border-sky-500"
            >
              <option value="ALL">Semua Status ONT</option>
              <option value="Online">Online (Normal)</option>
              <option value="LOS">LOS (Putus Optik)</option>
              <option value="DyingGasp">Dying Gasp (Mati Listrik)</option>
            </select>

            {/* Search Input */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari SN, pelanggan, port, ODP..."
                className="pl-8 pr-3 py-1.5 text-xs bg-slate-950 border border-slate-800 rounded-lg text-slate-100 placeholder:text-slate-500 focus:outline-none focus:border-sky-500 w-56"
              />
            </div>
          </div>
        </div>

        {/* High-Density Data Table */}
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 text-xs font-medium text-slate-400">
                <th className="py-2.5 pr-4">Pelanggan & Service ID</th>
                <th className="py-2.5 px-3">Vendor & Port OLT</th>
                <th className="py-2.5 px-3">SN & Model ONT</th>
                <th className="py-2.5 px-3">Status OAM</th>
                <th className="py-2.5 px-3 text-right">Rx ONU / OLT</th>
                <th className="py-2.5 px-3 text-right">Jarak</th>
                <th className="py-2.5 px-3 text-right">SVLAN / CVLAN</th>
                <th className="py-2.5 px-3 text-right">Profil BW</th>
                <th className="py-2.5 pl-3 text-right">Tindakan</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/70 text-xs">
              {filteredOnus.map((onu) => {
                const isHighAttenuation =
                  onu.status === 'Online' && onu.rxPowerDbm < -27.0;
                return (
                  <tr
                    key={onu.id}
                    className="hover:bg-slate-800/40 transition-colors"
                  >
                    <td className="py-3 pr-4">
                      <div className="font-medium text-slate-100">
                        {onu.customerName}
                      </div>
                      <div className="text-slate-400 font-mono tabular-nums mt-0.5">
                        {onu.serviceId} · {onu.odpName}
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="text-slate-200 font-medium">
                        {onu.vendor}
                      </div>
                      <div className="text-slate-400 font-mono tabular-nums mt-0.5">
                        {onu.ponPortLabel}:{onu.onuIndex}
                      </div>
                    </td>

                    <td className="py-3 px-3">
                      <div className="font-mono tabular-nums text-slate-200">
                        {onu.serialNumber}
                      </div>
                      <div className="text-slate-400 mt-0.5">{onu.model}</div>
                    </td>

                    <td className="py-3 px-3">
                      <div
                        className={`font-semibold ${
                          onu.status === 'Online'
                            ? isHighAttenuation
                              ? 'text-amber-400'
                              : 'text-emerald-400'
                            : onu.status === 'DyingGasp'
                            ? 'text-amber-400'
                            : 'text-rose-400'
                        }`}
                      >
                        {onu.status === 'Online'
                          ? isHighAttenuation
                            ? 'Online (Redaman Tinggi)'
                            : 'Online (Aktif)'
                          : onu.status === 'DyingGasp'
                          ? 'Dying Gasp (PLN Padam)'
                          : 'LOS (Putus Serat)'}
                      </div>
                      <div className="text-slate-400 font-mono tabular-nums mt-0.5">
                        Uptime: {onu.uptime}
                      </div>
                    </td>

                    <td className="py-3 px-3 text-right font-mono tabular-nums">
                      <div
                        className={`font-semibold ${
                          onu.status !== 'Online'
                            ? 'text-rose-400'
                            : onu.rxPowerDbm < -27.0
                            ? 'text-amber-400'
                            : 'text-emerald-400'
                        }`}
                      >
                        {onu.rxPowerDbm.toFixed(1)} dBm
                      </div>
                      <div className="text-slate-400 mt-0.5">
                        OLT: {onu.oltRxPowerDbm.toFixed(1)} dBm
                      </div>
                    </td>

                    <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-200">
                      {onu.distanceKm.toFixed(2)} km
                    </td>

                    <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-200">
                      <div>S:{onu.svlan} / C:{onu.cvlan}</div>
                      <div className="text-slate-400 mt-0.5">
                        {onu.ipAddressPppoe}
                      </div>
                    </td>

                    <td className="py-3 px-3 text-right font-mono tabular-nums text-slate-200">
                      <div>
                        ↓{onu.bandwidthDownMbps}M / ↑{onu.bandwidthUpMbps}M
                      </div>
                      <div className="text-slate-400 mt-0.5">
                        {onu.lineProfile}
                      </div>
                    </td>

                    <td className="py-3 pl-3 text-right">
                      <div className="inline-flex items-center justify-end gap-1.5">
                        <button
                          onClick={() => {
                            onMeasureOpticalOnu(onu.id);
                            setSelectedOnuDiagnostic(onu);
                          }}
                          title="Uji Redaman & Diagnostik OMCI"
                          className="px-2.5 py-1 text-xs font-medium text-slate-200 bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition-colors whitespace-nowrap"
                        >
                          Ukur Optik
                        </button>
                        <button
                          onClick={() => onRebootOnu(onu.id)}
                          title="Reboot ONT via OMCI"
                          className="p-1.5 text-slate-300 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700 rounded transition-colors"
                        >
                          <RotateCcw className="w-3.5 h-3.5" />
                        </button>
                        <button
                          onClick={() => onDeleteOnu(onu.id)}
                          title="Deauthorize / Hapus ONT"
                          className="p-1.5 text-rose-300 hover:text-rose-200 bg-slate-800 hover:bg-rose-950/60 border border-slate-700 rounded transition-colors"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Selected ONU Live Optical Diagnostic Drawer */}
        {selectedOnuDiagnostic && (
          <div className="mt-4 p-4 bg-slate-950 border border-sky-800/70 rounded-lg">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <span className="text-xs font-semibold text-sky-400">
                  Hasil Uji OMCI Optical Transceiver Diagnostics
                </span>
                <h3 className="text-sm font-semibold text-slate-100 mt-0.5">
                  {selectedOnuDiagnostic.customerName} ({selectedOnuDiagnostic.serialNumber} · {selectedOnuDiagnostic.ponPortLabel}:{selectedOnuDiagnostic.onuIndex})
                </h3>
              </div>
              <button
                onClick={() => setSelectedOnuDiagnostic(null)}
                className="p-1 text-slate-400 hover:text-slate-200"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 pt-3 text-xs">
              <div>
                <span className="text-slate-400">Rx Power di ONU (1490nm)</span>
                <div className="font-mono tabular-nums font-semibold text-emerald-400 mt-0.5">
                  {selectedOnuDiagnostic.rxPowerDbm.toFixed(2)} dBm
                </div>
              </div>
              <div>
                <span className="text-slate-400">Tx Power dari ONU (1310nm)</span>
                <div className="font-mono tabular-nums font-semibold text-slate-100 mt-0.5">
                  +{selectedOnuDiagnostic.txPowerDbm.toFixed(2)} dBm
                </div>
              </div>
              <div>
                <span className="text-slate-400">Rx Power di OLT PON</span>
                <div className="font-mono tabular-nums font-semibold text-sky-400 mt-0.5">
                  {selectedOnuDiagnostic.oltRxPowerDbm.toFixed(2)} dBm
                </div>
              </div>
              <div>
                <span className="text-slate-400">Jarak Serat Optik (Ranging)</span>
                <div className="font-mono tabular-nums font-semibold text-slate-100 mt-0.5">
                  {selectedOnuDiagnostic.distanceKm.toFixed(3)} km
                </div>
              </div>
              <div>
                <span className="text-slate-400">MAC Address WAN PPPoE</span>
                <div className="font-mono tabular-nums font-semibold text-slate-100 mt-0.5">
                  {selectedOnuDiagnostic.macAddress}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Zero-Touch Multi-Vendor Provisioning Modal */}
      {activeUncfg && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-slate-900 border border-slate-700 rounded-lg max-w-4xl w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-800">
              <div>
                <div className="text-xs font-semibold text-sky-400">
                  Zero-Touch Provisioning Multi-Vendor ({activeUncfg.oltVendor})
                </div>
                <h3 className="text-base font-semibold text-slate-100 mt-0.5">
                  Otorisasi ONT Baru SN {activeUncfg.serialNumber} pada {activeUncfg.oltName}
                </h3>
              </div>
              <button
                onClick={() => setActiveUncfg(null)}
                className="p-1.5 text-slate-400 hover:text-white rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleConfirmProvision} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
              {/* Left 6 Cols: Provisioning Parameters */}
              <div className="lg:col-span-6 space-y-3.5 text-xs">
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 mb-1">
                      Port PON Target
                    </label>
                    <input
                      type="text"
                      disabled
                      value={activeUncfg.ponPortLabel}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-800 rounded-lg font-mono text-slate-400"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1">
                      Indeks ONU ID (1–128)
                    </label>
                    <input
                      type="number"
                      min={1}
                      max={128}
                      value={onuIndex}
                      onChange={(e) => setOnuIndex(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg font-mono text-slate-100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 mb-1">
                      Service ID / Nomor Layanan
                    </label>
                    <input
                      type="text"
                      required
                      value={serviceId}
                      onChange={(e) => setServiceId(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg font-mono text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1">
                      Kode ODP Distribusi
                    </label>
                    <input
                      type="text"
                      required
                      value={odpName}
                      onChange={(e) => setOdpName(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg font-mono text-slate-100"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1">
                    Nama Pelanggan / Deskripsi Link
                  </label>
                  <input
                    type="text"
                    required
                    value={customerName}
                    onChange={(e) => setCustomerName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 mb-1">
                      Service VLAN (S-VLAN)
                    </label>
                    <input
                      type="number"
                      value={svlan}
                      onChange={(e) => setSvlan(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg font-mono text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1">
                      Customer VLAN (C-VLAN)
                    </label>
                    <input
                      type="number"
                      value={cvlan}
                      onChange={(e) => setCvlan(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg font-mono text-slate-100"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 mb-1">
                      Line Profile (T-CONT/GEM)
                    </label>
                    <select
                      value={lineProfile}
                      onChange={(e) => setLineProfile(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100"
                    >
                      <option value="LP-HOME-100M">LP-HOME-100M</option>
                      <option value="LP-BIZ-300M">LP-BIZ-300M</option>
                      <option value="LP-BIZ-500M">LP-BIZ-500M</option>
                      <option value="LP-CORP-DEDICATED">LP-CORP-DEDICATED</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1">
                      Service Profile (OMCI)
                    </label>
                    <select
                      value={serviceProfile}
                      onChange={(e) => setServiceProfile(e.target.value)}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100"
                    >
                      <option value="SP-PPPOE-NAT">SP-PPPOE-NAT</option>
                      <option value="SP-ROUTED-TRIPLE">SP-ROUTED-TRIPLE</option>
                      <option value="SP-BRIDGE-ENT">SP-BRIDGE-ENT</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-slate-300 mb-1">
                      Bandwidth Upstream (Mbps)
                    </label>
                    <input
                      type="number"
                      value={upMbps}
                      onChange={(e) => setUpMbps(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg font-mono text-slate-100"
                    />
                  </div>
                  <div>
                    <label className="block text-slate-300 mb-1">
                      Bandwidth Downstream (Mbps)
                    </label>
                    <input
                      type="number"
                      value={downMbps}
                      onChange={(e) => setDownMbps(Number(e.target.value))}
                      className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg font-mono text-slate-100"
                    />
                  </div>
                </div>

                <div className="pt-2 flex items-center justify-end gap-2.5">
                  <button
                    type="button"
                    onClick={() => setActiveUncfg(null)}
                    className="px-4 py-2 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg transition-colors"
                  >
                    Batal
                  </button>
                  <button
                    type="submit"
                    className="inline-flex items-center gap-1.5 px-4 py-2 text-xs font-medium text-white bg-sky-600 hover:bg-sky-500 rounded-lg transition-colors"
                  >
                    <Check className="w-3.5 h-3.5" />
                    Eksekusi ke OLT {activeUncfg.oltVendor}
                  </button>
                </div>
              </div>

              {/* Right 6 Cols: Live Multi-Vendor CLI Script Preview */}
              <div className="lg:col-span-6 flex flex-col">
                <div className="flex items-center justify-between text-xs text-slate-400 mb-1.5">
                  <span className="font-medium text-slate-200">
                    Pratinjau Otomatis Skrip CLI ({activeUncfg.oltVendor} Native Syntax)
                  </span>
                  <span className="font-mono tabular-nums">SSH / NETCONF</span>
                </div>
                <pre className="flex-1 p-4 bg-slate-950 border border-slate-800 rounded-lg font-mono text-xs text-emerald-300 overflow-x-auto leading-relaxed">
                  {previewCliScript}
                </pre>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
