import './globals.css';
import { TabNav } from '@/components/TabNav';
import { PropsWithChildren } from 'react';

export const metadata = {
  title: 'Grocery Tracker',
  description: 'Track grocery spend, pantry duration, meals, and monthly reports.'
};

export default function RootLayout({ children }: PropsWithChildren) {
  return (
    <html lang="en">
      <body>
        <div className="app-shell">
          <header className="header">
            <div>
              <h1>Grocery Tracker</h1>
              <p>
                Log purchases, meals, pantry usage, and monthly patterns without AI.
              </p>
            </div>
            <TabNav />
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
