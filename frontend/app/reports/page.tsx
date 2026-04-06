
'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/Card';
import { api, formatCurrency, monthIso, MonthlyReport } from '@/lib/api';

export default function ReportsPage() {
  const [month, setMonth] = useState(monthIso());
  const [report, setReport] = useState<MonthlyReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getMonthlyReport(month)
      .then(setReport)
      .catch((err) => setError(err.message));
  }, [month]);

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
            <div className="label">Total grocery spend</div>
            <div className="value">{formatCurrency(Number(report?.total_grocery_spend || 0))}</div>
          </div>
          <div className="metric">
            <div className="label">Occasions logged</div>
            <div className="value">{report?.occasions_count || 0}</div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="metric-grid">
          <div className="metric">
            <div className="label">Dinner variety</div>
            <div className="value">{report?.average_dinner_variety || 0}</div>
          </div>
          <div className="metric">
            <div className="label">Most repeated dish</div>
            <div className="value">{report?.dishes_count?.[0]?.dish_name || '—'}</div>
          </div>
          <div className="metric">
            <div className="label">Top item bought</div>
            <div className="value">{report?.most_purchased_items?.[0]?.product_name || '—'}</div>
          </div>
          <div className="metric">
            <div className="label">Most used ingredient</div>
            <div className="value">{report?.most_used_ingredients?.[0]?.product_name || '—'}</div>
          </div>
        </div>
      </Card>

      <div className="split-grid">
        <Card>
          <h2>Spend by category</h2>
          <div className="list">
            {report?.spend_by_category.map((item) => (
              <div className="list-item" key={item.category}>
                <div className="list-row">
                  <strong>{item.category}</strong>
                  <span>{formatCurrency(Number(item.total_spend))}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2>Most purchased items</h2>
          <table className="table">
            <thead>
              <tr>
                <th>Item</th>
                <th>Times</th>
                <th>Qty</th>
                <th>Spend</th>
              </tr>
            </thead>
            <tbody>
              {report?.most_purchased_items.map((item) => (
                <tr key={item.product_name}>
                  <td>{item.product_name}</td>
                  <td>{item.purchases_count}</td>
                  <td>{item.quantity}</td>
                  <td>{formatCurrency(Number(item.spend))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </Card>
      </div>

      <div className="split-grid">
        <Card>
          <h2>Dishes count</h2>
          <div className="list">
            {report?.dishes_count.map((dish) => (
              <div className="list-item" key={dish.dish_name}>
                <div className="list-row">
                  <strong>{dish.dish_name}</strong>
                  <span>{dish.count}</span>
                </div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h2>Items that ran out fastest</h2>
          <div className="list">
            {report?.items_ran_out_fastest.map((item) => (
              <div className="list-item" key={item.product_name}>
                <div className="list-row">
                  <strong>{item.product_name}</strong>
                  <span>{item.average_duration_days} days</span>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>

      <Card>
        <h2>Most used ingredients in dishes</h2>
        <div className="list">
          {report?.most_used_ingredients.map((item) => (
            <div className="list-item" key={item.product_name}>
              <div className="list-row">
                <strong>{item.product_name}</strong>
                <span>{item.used_times} uses</span>
              </div>
              <div className="muted small">Total quantity used: {item.total_quantity}</div>
              <div className="muted small">Used in: {item.dishes.join(', ') || '—'}</div>
            </div>
          ))}
          {!report?.most_used_ingredients.length ? <div className="muted">No ingredients used this month yet.</div> : null}
        </div>
      </Card>

      <Card>
        <h2>Items bought unusually often</h2>
        <table className="table">
          <thead>
            <tr>
              <th>Item</th>
              <th>This month</th>
              <th>Avg monthly count</th>
            </tr>
          </thead>
          <tbody>
            {report?.items_bought_unusually_often.map((item) => (
              <tr key={item.product_name}>
                <td>{item.product_name}</td>
                <td>{item.this_month_count}</td>
                <td>{item.average_monthly_count}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>
    </main>
  );
}
