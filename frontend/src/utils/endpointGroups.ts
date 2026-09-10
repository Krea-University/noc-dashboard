import { Endpoint, EndpointGroup, CustomGroup } from '../types';

export interface GroupDefinition {
  name: string;
  group_type: 'Computers';
  category: 'Academic Labs' | 'Classrooms & Venues' | 'Operating Systems' | 'Architecture' | 'Security Policies' | 'Workstations & Servers' | 'Custom Groups';
  description: string;
  isMatch: (ep: Endpoint) => boolean;
}

export const ENDPOINT_CENTRAL_GROUPS: GroupDefinition[] = [
  {
    name: '32-bit systems',
    group_type: 'Computers',
    category: 'Architecture',
    description: 'Endpoints with 32-bit x86 architecture',
    isMatch: (ep) => {
      const os = (ep.os_name || '').toLowerCase();
      return os.includes('x86') || os.includes('32-bit');
    },
  },
  {
    name: '64-bit systems',
    group_type: 'Computers',
    category: 'Architecture',
    description: 'Endpoints running 64-bit x64 or ARM64 architectures',
    isMatch: (ep) => {
      const os = (ep.os_name || '').toLowerCase();
      return (
        os.includes('x64') ||
        os.includes('64-bit') ||
        os.includes('ubuntu') ||
        os.includes('macos') ||
        os.includes('sonoma') ||
        os.includes('sequoia')
      );
    },
  },
  {
    name: 'All Linux machines',
    group_type: 'Computers',
    category: 'Operating Systems',
    description: 'Managed Linux & Ubuntu desktop distributions across labs and research',
    isMatch: (ep) => {
      const os = (ep.os_name || '').toLowerCase();
      return os.includes('linux') || os.includes('ubuntu');
    },
  },
  {
    name: 'All Mac machines',
    group_type: 'Computers',
    category: 'Operating Systems',
    description: 'Apple macOS devices (MacBook Pro, Air, iMacs for faculty & creative arts)',
    isMatch: (ep) => {
      const os = (ep.os_name || '').toLowerCase();
      return os.includes('mac') || os.includes('apple') || os.includes('darwin');
    },
  },
  {
    name: 'All Windows machines',
    group_type: 'Computers',
    category: 'Operating Systems',
    description: 'All Windows OS platforms (Windows 11, Windows 10, Windows Server)',
    isMatch: (ep) => {
      const os = (ep.os_name || '').toLowerCase();
      return os.includes('windows');
    },
  },
  {
    name: 'block',
    group_type: 'Computers',
    category: 'Security Policies',
    description: 'Systems under quarantine, test isolation, or restricted network access',
    isMatch: (ep) => {
      const name = (ep.hostname || '').toUpperCase();
      return (
        name.includes('EXAM') ||
        name.includes('TESTING') ||
        ep.status === 'OFFLINE'
      );
    },
  },
  {
    name: 'COM',
    group_type: 'Computers',
    category: 'Academic Labs',
    description: 'Computer Science & Commerce Computing Lab Workstations (COM-LAB-01 to 60)',
    isMatch: (ep) => {
      const name = (ep.hostname || '').toUpperCase();
      return name.startsWith('COM-') || name.startsWith('COM-LAB');
    },
  },
  {
    name: 'DATASCIENCE LAB',
    group_type: 'Computers',
    category: 'Academic Labs',
    description: 'Data Science & AI Analytics Laboratory high-performance desktops',
    isMatch: (ep) => {
      const name = (ep.hostname || '').toUpperCase();
      return name.startsWith('DATASCIENCE');
    },
  },
  {
    name: 'DATASCIENCE LAB Static',
    group_type: 'Computers',
    category: 'Academic Labs',
    description: 'Data Science Lab systems with fixed static IP leases for distributed compute clusters',
    isMatch: (ep) => {
      const name = (ep.hostname || '').toUpperCase();
      const ip = ep.ip_address || '';
      return name.startsWith('DATASCIENCE') && ip.startsWith('10.10.17.');
    },
  },
  {
    name: 'JSW',
    group_type: 'Computers',
    category: 'Classrooms & Venues',
    description: 'JSW Academic Block seminar hall, smart podiums & tutorial room computers',
    isMatch: (ep) => {
      const name = (ep.hostname || '').toUpperCase();
      return name.startsWith('JSW-');
    },
  },
  {
    name: 'Library-Computer',
    group_type: 'Computers',
    category: 'Classrooms & Venues',
    description: 'Digital Library OPAC search kiosks, Bloomberg Terminals & circulation desks',
    isMatch: (ep) => {
      const name = (ep.hostname || '').toUpperCase();
      return name.includes('LIB') || name.includes('BLOOMBERG');
    },
  },
  {
    name: 'NAB CLASSROOM PC\'S',
    group_type: 'Computers',
    category: 'Classrooms & Venues',
    description: 'New Academic Block (NAB) tiered smart classroom podium computers',
    isMatch: (ep) => {
      const name = (ep.hostname || '').toUpperCase();
      return name.startsWith('NAB-') || name.includes('VENUE-NAB') || name.includes('CLASS');
    },
  },
  {
    name: 'Trading Lab Computers',
    group_type: 'Computers',
    category: 'Academic Labs',
    description: 'Finance & Trading simulation terminals with dual-monitor market feeds',
    isMatch: (ep) => {
      const name = (ep.hostname || '').toUpperCase();
      return name.startsWith('TF-') || name.includes('TRADING');
    },
  },
  {
    name: 'Tradingfloor',
    group_type: 'Computers',
    category: 'Academic Labs',
    description: 'Trading Floor student analysis workstations and simulated trading desks',
    isMatch: (ep) => {
      const name = (ep.hostname || '').toUpperCase();
      return name.startsWith('TF-') || name.includes('TRADING');
    },
  },
  {
    name: 'USB Block',
    group_type: 'Computers',
    category: 'Security Policies',
    description: 'Academic lab systems with USB mass-storage restriction policy enforced',
    isMatch: (ep) => {
      const name = (ep.hostname || '').toUpperCase();
      return (
        name.startsWith('COM-') ||
        name.startsWith('DATASCIENCE') ||
        name.includes('LIB') ||
        name.startsWith('NAB-') ||
        name.includes('VENUE-BIOLOGY') ||
        name.includes('EXAM')
      );
    },
  },
  {
    name: 'Windows Servers',
    group_type: 'Computers',
    category: 'Workstations & Servers',
    description: 'Windows Server operating systems and local infrastructure controllers',
    isMatch: (ep) => {
      const os = (ep.os_name || '').toLowerCase();
      const name = (ep.hostname || '').toLowerCase();
      return os.includes('server') || name.includes('server') || name === 'endpointcentral';
    },
  },
  {
    name: 'Windows Workstations',
    group_type: 'Computers',
    category: 'Workstations & Servers',
    description: 'Faculty, staff, research scholars & administrative Windows desktop/laptop PCs',
    isMatch: (ep) => {
      const os = (ep.os_name || '').toLowerCase();
      const name = (ep.hostname || '').toLowerCase();
      return os.includes('windows') && !os.includes('server') && name !== 'endpointcentral';
    },
  },
];

/**
 * Tests whether an endpoint matches a user-created Custom Group rule
 */
export function matchCustomGroup(ep: Endpoint, cg: CustomGroup): boolean {
  if (!cg || !cg.match_value) return false;
  const matchVal = cg.match_value.trim().toLowerCase();
  const host = (ep.hostname || '').toLowerCase();
  const ip = (ep.ip_address || '').toLowerCase();
  const os = (ep.os_name || '').toLowerCase();

  switch (cg.match_type) {
    case 'HOSTNAME_PREFIX':
      return host.startsWith(matchVal);
    case 'HOSTNAME_CONTAINS':
      return host.includes(matchVal);
    case 'IP_PREFIX':
      return ip.startsWith(matchVal);
    case 'OS_CONTAINS':
      return os.includes(matchVal);
    default:
      return host.includes(matchVal);
  }
}

/**
 * Returns the primary operational group name for a workstation
 */
export function getPrimaryGroup(ep: Endpoint, customGroups?: CustomGroup[]): string {
  if (customGroups && customGroups.length > 0) {
    const matchedCustom = customGroups.find((cg) => matchCustomGroup(ep, cg));
    if (matchedCustom) return matchedCustom.name;
  }

  const name = (ep.hostname || '').toUpperCase();
  const os = (ep.os_name || '').toLowerCase();

  if (name.startsWith('COM-') || name.startsWith('COM-LAB')) return 'COM';
  if (name.startsWith('DATASCIENCE')) return 'DATASCIENCE LAB';
  if (name.startsWith('JSW-')) return 'JSW';
  if (name.startsWith('NAB-') || name.includes('VENUE-NAB')) return 'NAB CLASSROOM PC\'S';
  if (name.startsWith('TF-') || name.includes('TRADING')) return 'Tradingfloor';
  if (name.includes('LIB') || name.includes('BLOOMBERG')) return 'Library-Computer';
  if (os.includes('server') || name.toLowerCase() === 'endpointcentral') return 'Windows Servers';
  if (os.includes('mac') || os.includes('apple')) return 'All Mac machines';
  if (os.includes('linux') || os.includes('ubuntu')) return 'All Linux machines';
  return 'Windows Workstations';
}

/**
 * Returns all groups (standard and user-created custom) that an endpoint belongs to
 */
export function getEndpointGroups(ep: Endpoint, customGroups?: CustomGroup[]): string[] {
  const groups = ENDPOINT_CENTRAL_GROUPS.filter((grp) => grp.isMatch(ep)).map((grp) => grp.name);
  if (customGroups && customGroups.length > 0) {
    for (const cg of customGroups) {
      if (matchCustomGroup(ep, cg) && !groups.includes(cg.name)) {
        groups.push(cg.name);
      }
    }
  }
  return groups;
}

/**
 * Computes live group metrics for all Endpoint Central groups + user-created custom groups
 */
export function calculateGroupSummaries(
  endpoints: Endpoint[],
  customGroups?: CustomGroup[]
): EndpointGroup[] {
  const standardGroups: EndpointGroup[] = ENDPOINT_CENTRAL_GROUPS.map((def) => {
    let total = 0;
    let online = 0;
    let offline = 0;

    for (const ep of endpoints) {
      if (def.isMatch(ep)) {
        total++;
        if (ep.status === 'ONLINE') {
          online++;
        } else {
          offline++;
        }
      }
    }

    return {
      name: def.name,
      group_type: def.group_type,
      category: def.category,
      description: def.description,
      total,
      online,
      offline,
      is_custom: false,
    };
  });

  const customGroupList: EndpointGroup[] = (customGroups || []).map((cg) => {
    let total = 0;
    let online = 0;
    let offline = 0;

    for (const ep of endpoints) {
      if (matchCustomGroup(ep, cg)) {
        total++;
        if (ep.status === 'ONLINE') {
          online++;
        } else {
          offline++;
        }
      }
    }

    return {
      id: cg.id,
      name: cg.name,
      group_type: 'Computers',
      category: cg.category || 'Custom Groups',
      description: cg.description || `Rule: ${cg.match_type} = "${cg.match_value}"`,
      total,
      online,
      offline,
      is_custom: true,
      match_type: cg.match_type,
      match_value: cg.match_value,
      color: cg.color || 'indigo',
    };
  });

  return [...standardGroups, ...customGroupList];
}
