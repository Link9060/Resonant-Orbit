export type ArrowDestinationId = 'atlas' | 'ravin' | 'relay' | 'w';
export type OrbitSelectionId = 'orbit' | ArrowDestinationId;

export type ArrowDestination = {
  id: ArrowDestinationId;
  name: string;
  code: string;
  description: string;
  detail: string;
  arrivalLine: string;
  href?: string;
  anchor: readonly [number, number, number];
};

export const ARROW_DESTINATIONS: readonly ArrowDestination[] = [
  {
    id: 'atlas',
    name: 'Atlas',
    code: 'NAVIGATION',
    description: 'Maps, place, movement, and spatial context.',
    detail: 'Compass landmark',
    arrivalLine: 'Place becomes context.',
    anchor: [-0.82, -0.42, 0.38],
  },
  {
    id: 'ravin',
    name: 'RAVIN',
    code: 'INTELLIGENCE',
    description: 'Reasoning, memory, conversation, and the ARROW intelligence layer.',
    detail: 'Core landmark',
    arrivalLine: 'Intelligence, connected to everything.',
    anchor: [0.48, -0.7, 0.52],
  },
  {
    id: 'relay',
    name: 'Relay',
    code: 'COMMUNICATION',
    description: 'Messaging, planning, coordination, and the social layer.',
    detail: 'Broadcast landmark',
    arrivalLine: 'Communication without breaking flow.',
    href: 'https://resonantrelay.org',
    anchor: [0.76, 0.5, 0.34],
  },
  {
    id: 'w',
    name: 'W',
    code: 'FUTURE MODULE',
    description: 'Reserved space for the next ARROW destination.',
    detail: 'Uncharted',
    arrivalLine: 'This destination has not been charted yet.',
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
