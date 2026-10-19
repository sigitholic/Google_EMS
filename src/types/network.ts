export type VendorType = 'ZTE' | 'Huawei' | 'FiberHome' | 'Nokia';

export type AlarmSeverity = 'Critical' | 'Major' | 'Minor' | 'Warning';

export type OnuStatus = 'Online' | 'LOS' | 'DyingGasp' | 'LOFi' | 'Offline';

export interface PonPort {
  id: string;
  slot: number;
  port: number;
  label: string; // e.g., gpon-olt_1/2/1 or 0/1/0
  adminState: 'Enabled' | 'Disabled';
  operState: 'Up' | 'Down' | 'Degraded';
  txPowerDbm: number; // e.g. +4.8 dBm
  splitRatio: '1:32' | '1:64' | '1:128';
  activeOnus: number;
  totalOnus: number;
  temperatureC: number;
  biasCurrentMa: number;
  uplinkTrafficMbps: number;
  downlinkTrafficMbps: number;
  odcName: string;
}

export interface ChassisSlot {
  slotNumber: number;
  cardModel: string;
  cardRole: 'Service GPON' | 'Service XG-PON' | 'Control & Switch' | 'Uplink 10G/40G' | 'Power Module';
  status: 'Normal' | 'Standby' | 'Alarm';
  cpuUsage: number;
  tempC: number;
  portsCount: number;
}

export interface OltNode {
  id: string;
  name: string;
  vendor: VendorType;
  model: string; // e.g., ZXA10 C320, MA5800-X7, AN5516-04, 7360 ISAM FX-8
  firmware: string;
  ipAddress: string;
  locationPop: string;
  region: string;
  status: 'Normal' | 'Warning' | 'Critical';
  uptime: string;
  cpuLoad: number;
  memoryLoad: number;
  chassisTempC: number;
  snmpState: 'Connected' | 'Polling' | 'Timeout';
  netconfState: 'Active' | 'Idle';
  uplinkThroughputGbps: number;
  downlinkThroughputGbps: number;
  slots: ChassisSlot[];
  ponPorts: PonPort[];
}

export interface OnuDevice {
  id: string;
  oltId: string;
  oltName: string;
  vendor: VendorType;
  ponPortLabel: string; // e.g., 1/2/1 or 0/1/0
  onuIndex: number; // e.g., 1..64
  serialNumber: string; // e.g., ZTEGC891A02B, HWTC7721B409
  model: string; // e.g., F670L, HG8245H5, HG6145D2, G-2425G-A
  customerName: string;
  serviceId: string;
  odpName: string;
  status: OnuStatus;
  rxPowerDbm: number; // ONU receive power (-14 to -30 dBm)
  txPowerDbm: number; // ONU transmit power (+2.1 dBm)
  oltRxPowerDbm: number; // OLT receive power from this ONU
  distanceKm: number;
  cvlan: number;
  svlan: number;
  lineProfile: string;
  serviceProfile: string;
  bandwidthUpMbps: number;
  bandwidthDownMbps: number;
  ipAddressPppoe: string;
  macAddress: string;
  lastChange: string;
  uptime: string;
}

export interface UnconfiguredOnu {
  id: string;
  oltId: string;
  oltName: string;
  oltVendor: VendorType;
  ponPortLabel: string;
  serialNumber: string;
  detectedModel: string;
  rxPowerDbm: number;
  distanceKm: number;
  discoveredAt: string;
  loid?: string;
}

export interface NetworkAlarm {
  id: string;
  timestamp: string;
  severity: AlarmSeverity;
  oltId: string;
  oltName: string;
  vendor: VendorType;
  sourceObject: string;
  alarmCode: string;
  description: string;
  rootCauseAnalysis: string;
  acknowledged: boolean;
}

export interface ProvisioningProfile {
  id: string;
  name: string;
  category: 'DBA / T-CONT' | 'Line Profile' | 'Service Profile' | 'VLAN / Layanan';
  tcontType?: 'Type-1 (Fixed)' | 'Type-3 (Assured)' | 'Type-4 (Best Effort)' | 'Type-5 (Mixed)';
  assuredBwMbps: number;
  maxBwMbps: number;
  svlan: number;
  cvlan: number;
  serviceMode: 'PPPoE Routed' | 'IPoE Bridged' | 'VoIP SIP' | 'Triple-Play';
  gemPortId: number;
  description: string;
}
