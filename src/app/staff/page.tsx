import { ArrowAuthGate } from '@/components/arrow-auth-gate';

export const metadata = { title: 'Staff control · ARROW Orbit' };

export default function StaffPage() {
  return (
    <ArrowAuthGate>
      <main data-arrow-staff-workspace aria-label="ARROW staff workspace">
        <div data-arrow-os-shell data-module="orbit" hidden />
        <p role="status" data-staff-startup>Opening staff control…</p>
      </main>
    </ArrowAuthGate>
  );
}
