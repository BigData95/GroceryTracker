'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';

const tabs = [
  { href: '/today', label: 'Today' },
  { href: '/calendar', label: 'Calendar' },
  { href: '/pantry', label: 'Pantry' },
  { href: '/dishes', label: 'Dishes' },
  { href: '/reports', label: 'Reports' },
  { href: '/manage', label: 'Manage' }
];

export function TabNav() {
  const pathname = usePathname();

  return (
    <nav className="tabs">
      {tabs.map((tab) => {
        const active = pathname === tab.href || pathname.startsWith(`${tab.href}/`);
        return (
          <Link key={tab.href} href={tab.href} className={active ? 'tab active' : 'tab'}>
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
