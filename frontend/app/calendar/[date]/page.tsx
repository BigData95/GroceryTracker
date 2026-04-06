
'use client';

import { useEffect, useState } from 'react';
import { Card } from '@/components/Card';
import { api, DayDetail, formatCurrency } from '@/lib/api';

export default function DayDetailPage({ params }: { params: { date: string } }) {
  const [detail, setDetail] = useState<DayDetail | null>(null);
  const [note, setNote] = useState('');
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    api
      .getDayDetail(params.date)
      .then((data) => {
        setDetail(data);
        setNote(data.note || '');
      })
      .catch((err) => setError(err.message));
  }, [params.date]);

  async function saveNote() {
    try {
      await api.saveDayNote(params.date, note);
      setMessage('Day note saved.');
      const refreshed = await api.getDayDetail(params.date);
      setDetail(refreshed);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save note');
    }
  }

  return (
    <main className="page">
      {message ? <div className="notice">{message}</div> : null}
      {error ? <div className="error">{error}</div> : null}
      <Card>
        <h2>Day detail · {params.date}</h2>
        <div className="metric-grid">
          <div className="metric">
            <div className="label">Total spent</div>
            <div className="value">{formatCurrency(Number(detail?.total_spend || 0))}</div>
          </div>
          <div className="metric">
            <div className="label">Items bought</div>
            <div className="value">{detail?.items_bought.length || 0}</div>
          </div>
          <div className="metric">
            <div className="label">Meals</div>
            <div className="value">{detail?.meals.length || 0}</div>
          </div>
          <div className="metric">
            <div className="label">Ran out</div>
            <div className="value">{detail?.products_finished.length || 0}</div>
          </div>
        </div>
      </Card>

      <div className="split-grid">
        <Card>
          <h3>Items bought</h3>
          <div className="list">
            {detail?.items_bought.map((item, idx) => (
              <div className="list-item" key={`${item.product_id}-${idx}`}>
                <div className="list-row">
                  <strong>{item.product_name}</strong>
                  <span>{formatCurrency(Number(item.total_price))}</span>
                </div>
                <div className="muted small">Qty {item.quantity} · Unit {formatCurrency(Number(item.unit_price))}</div>
              </div>
            ))}
          </div>
        </Card>

        <Card>
          <h3>Meals cooked / eaten</h3>
          <div className="list">
            {detail?.meals.map((meal) => (
              <div className="list-item" key={meal.id}>
                <div className="list-row">
                  <strong>{meal.name_snapshot}</strong>
                  <span className="pill">{meal.category_snapshot}</span>
                </div>
                <div className="muted small">Items used</div>
                <div className="pills" style={{ marginTop: 8 }}>
                  {meal.ingredients.map((ingredient) => (
                    <span className="pill" key={`${meal.id}-${ingredient.product_id}`}>
                      {ingredient.product_name} · {ingredient.quantity}
                    </span>
                  ))}
                </div>
                {meal.note ? <div className="muted small" style={{ marginTop: 8 }}>{meal.note}</div> : null}
              </div>
            ))}
            {!detail?.meals.length ? <div className="muted">No meals logged for this day.</div> : null}
          </div>
        </Card>
      </div>

      <div className="split-grid">
        <Card>
          <h3>All ingredients used that day</h3>
          <div className="pills">
            {detail?.ingredients_used.map((ingredient, idx) => (
              <span className="pill" key={`${ingredient.product_id}-${idx}`}>
                {ingredient.product_name} · {ingredient.quantity}
              </span>
            ))}
          </div>
          <h3 style={{ marginTop: 20 }}>Products opened</h3>
          <div className="pills">
            {detail?.products_opened.map((name) => (
              <span className="pill" key={name}>{name}</span>
            ))}
          </div>
          <h3 style={{ marginTop: 20 }}>Products finished</h3>
          <div className="pills">
            {detail?.products_finished.map((name) => (
              <span className="pill" key={name}>{name}</span>
            ))}
          </div>
        </Card>

        <Card>
          <h3>Notes</h3>
          <textarea
            className="textarea"
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Day notes, observations, cravings, context..."
          />
          <div className="actions">
            <button className="button" type="button" onClick={saveNote}>Save note</button>
          </div>
        </Card>
      </div>
    </main>
  );
}
