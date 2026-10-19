/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import {
  OltNode,
  OnuDevice,
  UnconfiguredOnu,
  NetworkAlarm,
  ProvisioningProfile,
  VendorType,
} from './types/network';
import {
  INITIAL_OLTS,
  INITIAL_ONUS,
  INITIAL_UNCONFIGURED_ONUS,
  INITIAL_ALARMS,
  INITIAL_PROFILES,
} from './data/initialNetworkData';
import { NmsOverviewView } from './components/NmsOverviewView';
import { OltChassisView } from './components/OltChassisView';
import { OnuProvisioningView } from './components/OnuProvisioningView';
import { TopologyOdnView } from './components/TopologyOdnView';
import { CliAndProfilesView } from './components/CliAndProfilesView';
import { Plus, X, Check } from 'lucide-react';

type ActiveTab =
  | 'nms-overview'
  | 'olt-ems'
  | 'onu-provisioning'
  | 'odn-topology'
  | 'cli-profiles';

const STORAGE_KEY = 'opticore_multivendor_ems_nms_v1';

export default function App() {
  const [activeTab, setActiveTab] = useState<ActiveTab>('nms-overview');
  const [olts, setOlts] = useState<OltNode[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.olts?.length) return parsed.olts;
      }
    } catch {
      // ignore storage error
    }
    return INITIAL_OLTS;
  });

  const [onus, setOnus] = useState<OnuDevice[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.onus?.length) return parsed.onus;
      }
    } catch {
      // ignore
    }
    return INITIAL_ONUS;
  });

  const [unconfiguredOnus, setUnconfiguredOnus] = useState<UnconfiguredOnu[]>(
    () => {
      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (saved) {
          const parsed = JSON.parse(saved);
          if (parsed.unconfiguredOnus) return parsed.unconfiguredOnus;
        }
      } catch {
        // ignore
      }
      return INITIAL_UNCONFIGURED_ONUS;
    }
  );

  const [alarms, setAlarms] = useState<NetworkAlarm[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed.alarms) return parsed.alarms;
      }
    } catch {
      // ignore
    }
    return INITIAL_ALARMS;
  });

  const [profiles, setProfiles] = useState<ProvisioningProfile[]>(
    INITIAL_PROFILES
  );
  const [selectedOltId, setSelectedOltId] = useState<string>(
    INITIAL_OLTS[0].id
  );
  const [filterPonLabel, setFilterPonLabel] = useState<string>('');
  const [externalCliLog, setExternalCliLog] = useState<string[]>([]);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  // Add New OLT Modal State
  const [isAddOltOpen, setIsAddOltOpen] = useState(false);
  const [newOltVendor, setNewOltVendor] = useState<VendorType>('ZTE');
  const [newOltName, setNewOltName] = useState('OLT-ZTE-MDN-MERDEKA-01');
  const [newOltModel, setNewOltModel] = useState('ZXA10 C320 Compact');
  const [newOltIp, setNewOltIp] = useState('10.240.62.18');
  const [newOltPop, setNewOltPop] = useState('POP Merdeka Medan');
  const [newOltRegion, setNewOltRegion] = useState('Sumatera Utara');

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ olts, onus, unconfiguredOnus, alarms })
      );
    } catch {
      // ignore storage quota errors
    }
  }, [olts, onus, unconfiguredOnus, alarms]);

  const showNotification = (msg: string) => {
    setToastMessage(msg);
    setTimeout(() => setToastMessage(null), 3500);
  };

  // Handlers for OLT EMS
  const handleTogglePonPortAdmin = (oltId: string, ponPortId: string) => {
    setOlts((prev) =>
      prev.map((olt) => {
        if (olt.id !== oltId) return olt;
        return {
          ...olt,
          ponPorts: olt.ponPorts.map((p) => {
            if (p.id !== ponPortId) return p;
            const nextAdmin =
              p.adminState === 'Enabled' ? 'Disabled' : 'Enabled';
            return {
              ...p,
              adminState: nextAdmin,
              operState: nextAdmin === 'Disabled' ? 'Down' : 'Up',
            };
          }),
        };
      })
    );
    showNotification(
      `Status administratif port PON berhasil diperbarui melalui NETCONF/SNMP.`
    );
  };

  const handleSyncSnmpOlt = (oltId: string) => {
    setOlts((prev) =>
      prev.map((olt) => {
        if (olt.id !== oltId) return olt;
        return {
          ...olt,
          cpuLoad: Math.max(12, Math.min(68, olt.cpuLoad + (Math.random() > 0.5 ? 2 : -2))),
          uplinkThroughputGbps: Number(
            (olt.uplinkThroughputGbps + (Math.random() * 0.3 - 0.12)).toFixed(2)
          ),
          downlinkThroughputGbps: Number(
            (olt.downlinkThroughputGbps + (Math.random() * 0.5 - 0.2)).toFixed(2)
          ),
        };
      })
    );
    showNotification('MIB SNMPv3 dan tabel OMCI OLT berhasil disinkronkan.');
  };

  // Handlers for ONU Provisioning & Diagnostics
  const handleProvisionOnu = (
    uncfgId: string,
    newOnu: OnuDevice,
    executedCli: string
  ) => {
    setUnconfiguredOnus((prev) => prev.filter((u) => u.id !== uncfgId));
    setOnus((prev) => [newOnu, ...prev]);
    setExternalCliLog((prev) => [executedCli, ...prev.slice(0, 4)]);
    // Increment PON port active ONU counter
    setOlts((prev) =>
      prev.map((olt) => {
        if (olt.id !== newOnu.oltId) return olt;
        return {
          ...olt,
          ponPorts: olt.ponPorts.map((p) =>
            p.label === newOnu.ponPortLabel
              ? {
                  ...p,
                  activeOnus: p.activeOnus + 1,
                  totalOnus: p.totalOnus + 1,
                }
              : p
          ),
        };
      })
    );
    showNotification(
      `ONT ${newOnu.serialNumber} (${newOnu.vendor}) berhasil diotorisasi dan aktif pada ${newOnu.ponPortLabel}:${newOnu.onuIndex}.`
    );
  };

  const handleScanNewUnconfiguredOnu = () => {
    const targetOlt = olts[Math.floor(Math.random() * olts.length)];
    const targetPort =
      targetOlt.ponPorts[0]?.label ||
      (targetOlt.vendor === 'ZTE' ? 'gpon-olt_1/1/1' : '0/1/0');
    const prefixMap: Record<VendorType, string> = {
      ZTE: 'ZTEGC',
      Huawei: 'HWTC',
      FiberHome: 'FHTT',
      Nokia: 'ALCLF',
    };
    const modelMap: Record<VendorType, string> = {
      ZTE: 'F670L V2.1',
      Huawei: 'EG8145X6',
      FiberHome: 'HG6145D2',
      Nokia: 'G-2425G-A',
    };
    const randomHex = Math.floor(1000000 + Math.random() * 8999999)
      .toString(16)
      .toUpperCase()
      .slice(0, 7);
    const sn = `${prefixMap[targetOlt.vendor]}${randomHex}`;

    const newDiscovered: UnconfiguredOnu = {
      id: `uncfg-${Date.now()}`,
      oltId: targetOlt.id,
      oltName: targetOlt.name,
      oltVendor: targetOlt.vendor,
      ponPortLabel: targetPort,
      serialNumber: sn,
      detectedModel: modelMap[targetOlt.vendor],
      rxPowerDbm: Number((-16.5 - Math.random() * 5.2).toFixed(1)),
      distanceKm: Number((1.2 + Math.random() * 4.1).toFixed(2)),
      discoveredAt: 'Baru saja',
      loid: `AUTO-${randomHex.slice(0, 4)}`,
    };

    setUnconfiguredOnus((prev) => [newDiscovered, ...prev]);
    showNotification(
      `PON Autofind mendeteksi ONT baru SN ${sn} pada ${targetOlt.name} (${targetPort}).`
    );
  };

  const handleRebootOnu = (onuId: string) => {
    const target = onus.find((u) => u.id === onuId);
    setOnus((prev) =>
      prev.map((u) => (u.id === onuId ? { ...u, uptime: '0d 00h 01m' } : u))
    );
    if (target) {
      showNotification(
        `Perintah OMCI Reboot dikirim ke ONT ${target.serialNumber} (${target.customerName}).`
      );
    }
  };

  const handleMeasureOpticalOnu = (onuId: string) => {
    setOnus((prev) =>
      prev.map((u) => {
        if (u.id !== onuId || u.status !== 'Online') return u;
        const delta = Number((Math.random() * 0.4 - 0.2).toFixed(1));
        return {
          ...u,
          rxPowerDbm: Number((u.rxPowerDbm + delta).toFixed(1)),
        };
      })
    );
  };

  const handleDeleteOnu = (onuId: string) => {
    const target = onus.find((u) => u.id === onuId);
    setOnus((prev) => prev.filter((u) => u.id !== onuId));
    if (target) {
      showNotification(
        `ONT ${target.serialNumber} telah dihapus dari konfigurasi ${target.oltName}.`
      );
    }
  };

  // Handlers for Fault Simulation & Correlation in Topology View
  const handleSimulateFeederCut = (oltId: string) => {
    const targetOlt = olts.find((o) => o.id === oltId);
    if (!targetOlt) return;
    const firstPort = targetOlt.ponPorts[0];
    if (!firstPort) return;

    setOlts((prev) =>
      prev.map((o) =>
        o.id === oltId
          ? {
              ...o,
              status: 'Critical',
              ponPorts: o.ponPorts.map((p, i) =>
                i === 0 ? { ...p, operState: 'Down', activeOnus: 0 } : p
              ),
            }
          : o
      )
    );

    setOnus((prev) =>
      prev.map((u) =>
        u.oltId === oltId && u.ponPortLabel === firstPort.label
          ? { ...u, status: 'LOS', rxPowerDbm: -39.5, oltRxPowerDbm: -40.0 }
          : u
      )
    );

    const newAlarm: NetworkAlarm = {
      id: `alm-${Date.now()}`,
      timestamp: '2026-10-19 10:18:00',
      severity: 'Critical',
      oltId: targetOlt.id,
      oltName: targetOlt.name,
      vendor: targetOlt.vendor,
      sourceObject: `Port ${firstPort.label} (${firstPort.odcName})`,
      alarmCode: 'PON_LOS_BACKBONE_CUT',
      description: `Simulasi Putus Serat Feeder: Seluruh ONT pada ${firstPort.label} mengalami LOS serentak tanpa pesan Dying Gasp.`,
      rootCauseAnalysis: `Korelasi Otomatis NMS: Putus kabel optik Feeder antara ${targetOlt.name} dan kabinet ${firstPort.odcName}.`,
      acknowledged: false,
    };

    setAlarms((prev) => [newAlarm, ...prev]);
    showNotification(
      `Alarm Kritis: Simulasi putus serat feeder pada ${targetOlt.name} (${firstPort.label}) terdeteksi oleh korelasi NMS.`
    );
  };

  const handleSimulateDyingGasp = (oltId: string) => {
    const targetOlt = olts.find((o) => o.id === oltId);
    if (!targetOlt) return;

    setOnus((prev) =>
      prev.map((u) =>
        u.oltId === oltId
          ? { ...u, status: 'DyingGasp', txPowerDbm: 0.0, oltRxPowerDbm: -40.0 }
          : u
      )
    );

    const newAlarm: NetworkAlarm = {
      id: `alm-${Date.now()}`,
      timestamp: '2026-10-19 10:19:00',
      severity: 'Minor',
      oltId: targetOlt.id,
      oltName: targetOlt.name,
      vendor: targetOlt.vendor,
      sourceObject: `Cluster ODP ${targetOlt.region}`,
      alarmCode: 'CLUSTER_POWER_OUTAGE_DG',
      description: `Terima frame OAM Dying Gasp serentak dari ONT pada ${targetOlt.name}.`,
      rootCauseAnalysis: `Korelasi Otomatis NMS: Gangguan catu daya listrik PLN di area ${targetOlt.region} (Jaringan serat optik ODN normal, tidak perlu kirim tim splicing).`,
      acknowledged: false,
    };

    setAlarms((prev) => [newAlarm, ...prev]);
    showNotification(
      `Korelasi Dying Gasp: NMS mendeteksi pemadaman listrik area ${targetOlt.region}.`
    );
  };

  const handleRestoreNetworkNormal = () => {
    setOlts(INITIAL_OLTS);
    setOnus(INITIAL_ONUS);
    setAlarms(INITIAL_ALARMS);
    showNotification(
      'Seluruh jalur serat optik PON dan status OLT telah dipulihkan ke kondisi operasional.'
    );
  };

  // Add New Multi-Vendor OLT Handler
  const handleCreateOlt = (e: React.FormEvent) => {
    e.preventDefault();
    const ponLabel =
      newOltVendor === 'ZTE'
        ? 'gpon-olt_1/1/1'
        : newOltVendor === 'Huawei'
        ? '0/1/0'
        : newOltVendor === 'FiberHome'
        ? 'slot-1/pon-1'
        : '1/1/1/1';

    const newNode: OltNode = {
      id: `olt-${Date.now()}`,
      name: newOltName.trim().toUpperCase(),
      vendor: newOltVendor,
      model: newOltModel,
      firmware:
        newOltVendor === 'ZTE'
          ? 'V2.1.0 (ZXROS)'
          : newOltVendor === 'Huawei'
          ? 'VRP V800R021'
          : newOltVendor === 'FiberHome'
          ? 'RP2400 OS'
          : 'R6.2 ISAM',
      ipAddress: newOltIp,
      locationPop: newOltPop,
      region: newOltRegion,
      status: 'Normal',
      uptime: '0d 01h 12m',
      cpuLoad: 16,
      memoryLoad: 38,
      chassisTempC: 36.5,
      snmpState: 'Connected',
      netconfState: 'Active',
      uplinkThroughputGbps: 1.85,
      downlinkThroughputGbps: 5.4,
      slots: [
        {
          slotNumber: 1,
          cardModel:
            newOltVendor === 'ZTE'
              ? 'GTGH (16-Port GPON)'
              : newOltVendor === 'Huawei'
              ? 'H901GPHF (16-Port GPON)'
              : newOltVendor === 'FiberHome'
              ? 'GCOB (16-Port GPON)'
              : 'FGLT-B (16-Port GPON)',
          cardRole: 'Service GPON',
          status: 'Normal',
          cpuUsage: 15,
          tempC: 36,
          portsCount: 16,
        },
        {
          slotNumber: 2,
          cardModel: 'Control & Switch Fabric A',
          cardRole: 'Control & Switch',
          status: 'Normal',
          cpuUsage: 18,
          tempC: 37,
          portsCount: 4,
        },
      ],
      ponPorts: [
        {
          id: `pon-${Date.now()}`,
          slot: 1,
          port: 1,
          label: ponLabel,
          adminState: 'Enabled',
          operState: 'Up',
          txPowerDbm: 5.2,
          splitRatio: '1:64',
          activeOnus: 32,
          totalOnus: 32,
          temperatureC: 36.8,
          biasCurrentMa: 17.5,
          uplinkTrafficMbps: 210.4,
          downlinkTrafficMbps: 680.0,
          odcName: `ODC-${newOltRegion.slice(0, 3).toUpperCase()}-01`,
        },
      ],
    };

    setOlts((prev) => [...prev, newNode]);
    setSelectedOltId(newNode.id);
    setIsAddOltOpen(false);
    setActiveTab('olt-ems');
    showNotification(
      `Node OLT ${newNode.name} (${newNode.vendor}) berhasil diintegrasikan ke EMS/NMS.`
    );
  };

  return (
    <div className="min-h-screen bg-[#090d16] text-slate-100 flex flex-col">
      {/* Strict 3-Zone Top Bar Contract */}
      <header className="flex items-center justify-between gap-8 px-6 py-3.5 border-b border-slate-800 bg-slate-950/90 sticky top-0 z-40">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#nms-overview"
          onClick={(e) => {
            e.preventDefault();
            setActiveTab('nms-overview');
          }}
          className="text-base font-bold tracking-tight text-slate-100 whitespace-nowrap shrink-0"
        >
          OptiCore EMS/NMS
        </a>

        {/* Zone 2: 5 concise single-line navigation links */}
        <nav className="flex items-center gap-6 text-xs sm:text-sm font-medium text-slate-400 overflow-x-auto">
          <button
            onClick={() => setActiveTab('nms-overview')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'nms-overview'
                ? 'text-white underline underline-offset-8 decoration-sky-500 decoration-2'
                : 'hover:text-slate-100'
            }`}
          >
            Ringkasan NMS
          </button>
          <button
            onClick={() => setActiveTab('olt-ems')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'olt-ems'
                ? 'text-white underline underline-offset-8 decoration-sky-500 decoration-2'
                : 'hover:text-slate-100'
            }`}
          >
            Sasis OLT (EMS)
          </button>
          <button
            onClick={() => {
              setFilterPonLabel('');
              setActiveTab('onu-provisioning');
            }}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'onu-provisioning'
                ? 'text-white underline underline-offset-8 decoration-sky-500 decoration-2'
                : 'hover:text-slate-100'
            }`}
          >
            Provisioning ONU
          </button>
          <button
            onClick={() => setActiveTab('odn-topology')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'odn-topology'
                ? 'text-white underline underline-offset-8 decoration-sky-500 decoration-2'
                : 'hover:text-slate-100'
            }`}
          >
            Topologi ODN
          </button>
          <button
            onClick={() => setActiveTab('cli-profiles')}
            className={`py-1 transition-colors whitespace-nowrap shrink-0 ${
              activeTab === 'cli-profiles'
                ? 'text-white underline underline-offset-8 decoration-sky-500 decoration-2'
                : 'hover:text-slate-100'
            }`}
          >
            Terminal & Profil
          </button>
        </nav>

        {/* Zone 3: 1 Primary Action Button */}
        <div className="flex items-center shrink-0">
          <button
            onClick={() => setIsAddOltOpen(true)}
            className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-medium text-white bg-sky-600 hover:bg-sky-500 rounded-lg transition-colors whitespace-nowrap shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            Tambah OLT
          </button>
        </div>
      </header>

      {/* Notification Banner */}
      {toastMessage && (
        <div className="fixed bottom-5 right-5 z-50 bg-slate-900 border border-sky-500/80 text-slate-100 px-4 py-3 rounded-lg shadow-xl text-xs font-medium flex items-center gap-2.5 max-w-md">
          <Check className="w-4 h-4 text-sky-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Main Content Container (1440px-wide desktop layout) */}
      <main className="flex-1 max-w-[1440px] w-full mx-auto px-6 py-6">
        {activeTab === 'nms-overview' && (
          <NmsOverviewView
            olts={olts}
            onus={onus}
            unconfiguredOnus={unconfiguredOnus}
            alarms={alarms}
            selectedOltId={selectedOltId}
            onSelectOlt={setSelectedOltId}
            onNavigateOltEms={(oltId) => {
              setSelectedOltId(oltId);
              setActiveTab('olt-ems');
            }}
            onNavigateProvisioning={() => setActiveTab('onu-provisioning')}
            onNavigateCli={(oltId) => {
              setSelectedOltId(oltId);
              setActiveTab('cli-profiles');
            }}
            onAcknowledgeAlarm={(alarmId) =>
              setAlarms((prev) =>
                prev.map((a) =>
                  a.id === alarmId ? { ...a, acknowledged: true } : a
                )
              )
            }
            onClearAlarm={(alarmId) =>
              setAlarms((prev) => prev.filter((a) => a.id !== alarmId))
            }
          />
        )}

        {activeTab === 'olt-ems' && (
          <OltChassisView
            olts={olts}
            onus={onus}
            selectedOltId={selectedOltId}
            onSelectOlt={setSelectedOltId}
            onTogglePonPortAdmin={handleTogglePonPortAdmin}
            onSyncSnmpOlt={handleSyncSnmpOlt}
            onOpenCliForOlt={(oltId) => {
              setSelectedOltId(oltId);
              setActiveTab('cli-profiles');
            }}
            onInspectPonOnus={(oltId, ponLabel) => {
              setSelectedOltId(oltId);
              setFilterPonLabel(ponLabel);
              setActiveTab('onu-provisioning');
            }}
          />
        )}

        {activeTab === 'onu-provisioning' && (
          <OnuProvisioningView
            olts={olts}
            onus={onus}
            unconfiguredOnus={unconfiguredOnus}
            initialFilterOltId="ALL"
            initialFilterPonLabel={filterPonLabel}
            onProvisionOnu={handleProvisionOnu}
            onScanNewUnconfiguredOnu={handleScanNewUnconfiguredOnu}
            onRebootOnu={handleRebootOnu}
            onMeasureOpticalOnu={handleMeasureOpticalOnu}
            onDeleteOnu={handleDeleteOnu}
          />
        )}

        {activeTab === 'odn-topology' && (
          <TopologyOdnView
            olts={olts}
            onus={onus}
            alarms={alarms}
            onSimulateFeederCut={handleSimulateFeederCut}
            onSimulateDyingGasp={handleSimulateDyingGasp}
            onRestoreNetworkNormal={handleRestoreNetworkNormal}
            onSelectOltInEms={(oltId) => {
              setSelectedOltId(oltId);
              setActiveTab('olt-ems');
            }}
          />
        )}

        {activeTab === 'cli-profiles' && (
          <CliAndProfilesView
            olts={olts}
            onus={onus}
            unconfiguredOnus={unconfiguredOnus}
            profiles={profiles}
            selectedOltId={selectedOltId}
            externalCliLog={externalCliLog}
            onSelectOlt={setSelectedOltId}
            onAddProfile={(prof) => {
              setProfiles((prev) => [prof, ...prev]);
              showNotification(
                `Profil multi-vendor ${prof.name} berhasil dikompilasi dan disimpan.`
              );
            }}
            onDeleteProfile={(id) =>
              setProfiles((prev) => prev.filter((p) => p.id !== id))
            }
          />
        )}
      </main>

      {/* Quiet Footer */}
      <footer className="border-t border-slate-800/80 px-6 py-4 text-xs text-slate-500 max-w-[1440px] w-full mx-auto flex flex-col sm:flex-row items-center justify-between gap-2">
        <span>
          OptiCore Multi-Vendor OLT EMS & FTTH Network Management System
        </span>
        <span>
          Mendukung ZTE ZXROS · Huawei VRP MA5800 · FiberHome AN6000 · Nokia 7360 ISAM FX
        </span>
      </footer>

      {/* Add Multi-Vendor OLT Node Modal */}
      {isAddOltOpen && (
        <div className="fixed inset-0 z-50 bg-black/75 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-700 rounded-lg max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between pb-3 border-b border-slate-800">
              <div>
                <div className="text-xs font-semibold text-sky-400">
                  Integrasi Elemen Jaringan Baru (SNMPv3 / NETCONF)
                </div>
                <h3 className="text-base font-semibold text-slate-100 mt-0.5">
                  Tambah Perangkat OLT Multi-Vendor
                </h3>
              </div>
              <button
                onClick={() => setIsAddOltOpen(false)}
                className="p-1 text-slate-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateOlt} className="space-y-3.5 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">
                    Vendor Perangkat OLT
                  </label>
                  <select
                    value={newOltVendor}
                    onChange={(e) => {
                      const v = e.target.value as VendorType;
                      setNewOltVendor(v);
                      if (v === 'ZTE') {
                        setNewOltModel('ZXA10 C320 / C600');
                        setNewOltName('OLT-ZTE-MDN-MERDEKA-01');
                      } else if (v === 'Huawei') {
                        setNewOltModel('SmartAX MA5800-X7');
                        setNewOltName('OLT-HUAWEI-SMG-SIMPANG-01');
                      } else if (v === 'FiberHome') {
                        setNewOltModel('AN6000-17 / AN5516');
                        setNewOltName('OLT-FH-MLG-IJEN-01');
                      } else {
                        setNewOltModel('7360 ISAM FX-8');
                        setNewOltName('OLT-NOKIA-MKS-LOSARI-01');
                      }
                    }}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100"
                  >
                    <option value="ZTE">ZTE (ZXA10 Series)</option>
                    <option value="Huawei">Huawei (SmartAX MA5800/MA5608T)</option>
                    <option value="FiberHome">FiberHome (AN6000/AN5516)</option>
                    <option value="Nokia">Nokia (7360 ISAM FX)</option>
                  </select>
                </div>

                <div>
                  <label className="block text-slate-300 mb-1">
                    Tipe / Sasis Model
                  </label>
                  <input
                    type="text"
                    required
                    value={newOltModel}
                    onChange={(e) => setNewOltModel(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">
                    Hostname OLT
                  </label>
                  <input
                    type="text"
                    required
                    value={newOltName}
                    onChange={(e) => setNewOltName(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg font-mono text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">
                    IP Manajemen (IPv4)
                  </label>
                  <input
                    type="text"
                    required
                    value={newOltIp}
                    onChange={(e) => setNewOltIp(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg font-mono text-slate-100"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-300 mb-1">
                    Lokasi POP / Shelter
                  </label>
                  <input
                    type="text"
                    required
                    value={newOltPop}
                    onChange={(e) => setNewOltPop(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100"
                  />
                </div>
                <div>
                  <label className="block text-slate-300 mb-1">
                    Regional Area
                  </label>
                  <input
                    type="text"
                    required
                    value={newOltRegion}
                    onChange={(e) => setNewOltRegion(e.target.value)}
                    className="w-full px-3 py-2 bg-slate-950 border border-slate-700 rounded-lg text-slate-100"
                  />
                </div>
              </div>

              <div className="pt-3 flex items-center justify-end gap-2.5 border-t border-slate-800">
                <button
                  type="button"
                  onClick={() => setIsAddOltOpen(false)}
                  className="px-4 py-2 text-xs font-medium text-slate-300 bg-slate-800 hover:bg-slate-700 rounded-lg"
                >
                  Batal
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 text-xs font-medium text-white bg-sky-600 hover:bg-sky-500 rounded-lg"
                >
                  Hubungkan & Akuisisi Sasis
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
