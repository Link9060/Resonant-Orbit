import type { SVGProps } from 'react';

type IconProps = SVGProps<SVGSVGElement> & { size?: number };

export const ARROW_MARK_PATH = 'M3 5.2 21 12 3 18.8 8.2 12 3 5.2Z';

function BaseIcon({ size = 18, children, ...props }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function ArrowMarkIcon({ size = 18, ...props }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" aria-hidden="true" {...props}>
      <path d={ARROW_MARK_PATH} fill="currentColor" />
    </svg>
  );
}

export function SearchIcon(props: IconProps) {
  return <BaseIcon {...props}><circle cx="11" cy="11" r="6.5" /><path d="m16 16 4 4" /></BaseIcon>;
}

export function ZoomInIcon(props: IconProps) {
  return <BaseIcon {...props}><circle cx="10.5" cy="10.5" r="6.5" /><path d="M10.5 7.5v6M7.5 10.5h6M15.4 15.4 20 20" /></BaseIcon>;
}

export function ZoomOutIcon(props: IconProps) {
  return <BaseIcon {...props}><circle cx="10.5" cy="10.5" r="6.5" /><path d="M7.5 10.5h6M15.4 15.4 20 20" /></BaseIcon>;
}

export function RotateWorldIcon(props: IconProps) {
  return <BaseIcon {...props}><path d="M4.5 9.5A8 8 0 0 1 18 5.5l1.5 1.5" /><path d="M19.5 3.5V7h-3.5" /><path d="M19.5 14.5A8 8 0 0 1 6 18.5L4.5 17" /><path d="M4.5 20.5V17H8" /><circle cx="12" cy="12" r="2.25" /></BaseIcon>;
}

export function TargetIcon(props: IconProps) {
  return <BaseIcon {...props}><circle cx="12" cy="12" r="7.5" /><circle cx="12" cy="12" r="2.5" /><path d="M12 2v3M12 19v3M2 12h3M19 12h3" /></BaseIcon>;
}

export function CompassIcon(props: IconProps) {
  return <BaseIcon {...props}><circle cx="12" cy="12" r="8" /><path d="m15.5 8.5-2.2 4.8-4.8 2.2 2.2-4.8 4.8-2.2Z" /></BaseIcon>;
}

export function RadioTowerIcon(props: IconProps) {
  return <BaseIcon {...props}><path d="M12 8v12M9 20h6" /><circle cx="12" cy="6" r="1.5" /><path d="M8.5 3.8a5 5 0 0 0 0 4.4M15.5 3.8a5 5 0 0 1 0 4.4M5.5 1.5a8.5 8.5 0 0 0 0 9M18.5 1.5a8.5 8.5 0 0 1 0 9" /></BaseIcon>;
}

export function CoreIcon(props: IconProps) {
  return <BaseIcon {...props}><circle cx="12" cy="12" r="3.25" /><path d="M12 3.5c3.9 0 7 3.8 7 8.5s-3.1 8.5-7 8.5-7-3.8-7-8.5 3.1-8.5 7-8.5Z" /><path d="M4.7 8.2c2-3.4 6.8-4.2 10.9-1.8s5.7 7 3.8 10.4-6.8 4.2-10.9 1.8S2.7 11.6 4.7 8.2Z" /></BaseIcon>;
}

export function FutureNodeIcon(props: IconProps) {
  return <BaseIcon {...props}><path d="m12 3 7.5 4.4v9.2L12 21l-7.5-4.4V7.4L12 3Z" /><path d="m8.6 9 3.4 2 3.4-2M12 11v4" /><circle cx="12" cy="15.8" r=".8" fill="currentColor" stroke="none" /></BaseIcon>;
}

export function ArrowUpRightIcon(props: IconProps) {
  return <BaseIcon {...props}><path d="M7 17 17 7M9 7h8v8" /></BaseIcon>;
}

export function ArrowLeftIcon(props: IconProps) {
  return <BaseIcon {...props}><path d="m10 6-6 6 6 6M4 12h16" /></BaseIcon>;
}

export function CommandIcon(props: IconProps) {
  return <BaseIcon {...props}><path d="M9 7V5a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3v14a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V7Z" /></BaseIcon>;
}

export function PulseIcon(props: IconProps) {
  return <BaseIcon {...props}><path d="M3 12h4l2-5 4 10 2-5h6" /></BaseIcon>;
}

export function CloseIcon(props: IconProps) {
  return <BaseIcon {...props}><path d="m6 6 12 12M18 6 6 18" /></BaseIcon>;
}
