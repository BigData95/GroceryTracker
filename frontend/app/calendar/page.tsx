'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/Card';
import {
  api,
  CalendarDay,
  daysInMonth,
  formatCurrency,
  monthIso,
  startOfMonthGrid
} from '@/lib/api';

const weekLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export default function CalendarPage() {
  const [month, setMonth] = useState(monthIso());
  const [days, setDays] = useState<CalendarDay[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getCalendar(month)
      .then(setDays)
      .catch((err) => setError(err.message));
  }, [month]);

  const byDay = useMemo(() => {
    const map = new Map<string, CalendarDay>();
    days.forEach((entry) => map.set(entry.day, entry));
    return map;
  }, [days]);

  const blanks = startOfMonthGrid(month);
  const totalDays = daysInMonth(month);

  return (
    <main className="page">
      {error ? <div className="error">{error}</div> : null}
      <Card>
        <div className="form-grid three">
          <div className="form-field">
            <label>Month</label>
            <input
              className="input"
              type="month"
              value={month}
              onChange={(e) => setMonth(e.target.value)}
            />
          </div>
          <div className="metric">
            <div className="label">Days with purchases</div>
            <div className="value">{days.filter((day) => day.purchases_count > 0).length}</div>
          </div>
          <div className="metric">
            <div className="label">Days with meals</div>
            <div className="value">{days.filter((day) => day.meals_count > 0).length}</div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="calendar-grid" style={{ marginBottom: 12 }}>
          {weekLabels.map((label) => (
            <div key={label} className="muted small">
              {label}
            </div>
          ))}
        </div>
        <div className="calendar-grid">
          {Array.from({ length: blanks }).map((_, index) => (
            <div key={`blank-${index}`} className="calendar-empty" />
          ))}
          {Array.from({ length: totalDays }).map((_, index) => {
            const dayNumber = index + 1;
            const day = `${month}-${String(dayNumber).padStart(2, '0')}`;
            const summary = byDay.get(day);
            return (
              <Link key={day} href={`/calendar/${day}`} className="calendar-cell">
                <div className="calendar-top">
                  <strong>{dayNumber}</strong>
                  <span className="muted small">
                    {formatCurrency(Number(summary?.total_spend || 0))}
                  </span>
                </div>
                <div className="calendar-icons">
                  <span>💸 {summary?.total_spend ? formatCurrency(Number(summary.total_spend)) : '$0.00'}</span>
                  <span>🛒 {summary?.purchases_count || 0}</span>
                  <span>🍽️ {summary?.meals_count || 0}</span>
                  <span>📦 {summary?.ran_out_count || 0}</span>
                  <span>🎬 {summary?.occasion_count || 0}</span>
                  <span>🚴 {summary?.bike_nutrition_count || 0}</span>
                </div>
              </Link>
            );
          })}
        </div>
      </Card>
    </main>
  );
}
