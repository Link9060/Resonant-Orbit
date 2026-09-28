export type ArrowDestinationId = 'atlas' | 'ravin' | 'relay' | 'waypoint';
export type OrbitSelectionId = 'orbit' | ArrowDestinationId;

export type ArrowDestination = {
  id: ArrowDestinationId;
  name: string;
  code: string;
  description: string;
  detail: string;
  arrivalLine: string;
  shortcut: 1 | 2 | 3 | 4;
  href?: string;
  searchTerms: readonly string[];
  anchor: readonly [number, number, number];
};

export const ARROW_DESTINATIONS: readonly ArrowDestination[] = [
  {
    id: 'atlas',
    name: 'Atlas',
    code: 'DATA',
    description: 'Files, projects, links, people, and the context that connects them.',
    detail: 'Data landmark',
    arrivalLine: 'Your information, connected.',
    shortcut: 1,
    href: '/atlas/',
    searchTerms: ['files', 'projects', 'links', 'people', 'data', 'field', 'knowledge', 'context', 'notes'],
    anchor: [-0.82, -0.42, 0.38],
  },
  {
    id: 'ravin',
    name: 'RAVIN',
    code: 'INTELLIGENCE',
    description: 'Reasoning, memory, conversation, and the ARROW intelligence layer.',
    detail: 'Core landmark',
    arrivalLine: 'Intelligence, connected to everything.',
    shortcut: 2,
    href: '/ravin/',
    searchTerms: ['ai', 'assistant', 'ask', 'chat', 'memory', 'reasoning', 'intelligence', 'ravin'],
    anchor: [0.48, -0.7, 0.52],
  },
  {
    id: 'relay',
    name: 'Relay',
    code: 'COMMUNICATION',
    description: 'Messaging, groups, coordination, and the social layer.',
    detail: 'Broadcast landmark',
    arrivalLine: 'Communication without breaking flow.',
    shortcut: 3,
    href: '/relay/',
    searchTerms: ['messages', 'friends', 'groups', 'chat', 'communication', 'school', 'relay'],
    anchor: [0.76, 0.5, 0.34],
  },
  {
    id: 'waypoint',
    name: 'Waypoint',
    code: 'DIRECTION',
    description: 'Brain dumps, tasks, plans, calendar, goals, and clear next actions.',
    detail: 'Beacon landmark',
    arrivalLine: 'Turn the mess into the next clear move.',
    shortcut: 4,
    href: '/waypoint/',
    searchTerms: ['tasks', 'today', 'calendar', 'plans', 'goals', 'brain dump', 'dump', 'direction', 'review', 'waypoint'],
    anchor: [-0.62, 0.56, -0.55],
  },
];

export const ARROW_DESTINATION_BY_ID = new Map(
  ARROW_DESTINATIONS.map(destination => [destination.id, destination] as const),
);

export function isArrowDestinationId(value: string | null): value is ArrowDestinationId {
  return value !== null && ARROW_DESTINATION_BY_ID.has(value as ArrowDestinationId);
}

export function readIncomingArrowSource(search: string) {
  const source = new URLSearchParams(search).get('from');
  return isArrowDestinationId(source) ? source : null;
}

export function readOrbitFocusTarget(search: string) {
  const target = new URLSearchParams(search).get('focus');
  return isArrowDestinationId(target) ? target : null;
}
