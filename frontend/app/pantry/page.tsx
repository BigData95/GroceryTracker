
'use client';

import { useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/Card';
import { api, formatCurrency, PantryProduct, todayIso } from '@/lib/api';

type SortDirection = 'asc' | 'desc';
type TableSortKey = 'product_name' | 'current_stock' | 'last_purchase_date' | 'average_monthly_spend' | 'status';
type CardSortKey =
  | 'quantity_bought_this_month'
  | 'spend_this_month'
  | 'average_monthly_spend'
  | 'current_stock'
  | 'average_duration_days'
  | 'average_price'
  | 'product_name';
type StatusFilter = 'all' | 'open' | 'in_stock' | 'finished' | 'out_of_stock';

const TABLE_PAGE_SIZE_OPTIONS = [10, 20, 50];
const CARD_PAGE_SIZE_OPTIONS = [6, 12, 24];

function matchesStatus(product: PantryProduct, status: StatusFilter) {
  if (status === 'all') return true;
  if (status === 'open') return product.is_open;
  if (status === 'in_stock') return !product.is_open && Number(product.current_stock) > 0;
  if (status === 'finished') return !product.is_open && Number(product.current_stock) <= 0 && Boolean(product.last_finished_on);
  if (status === 'out_of_stock') return Number(product.current_stock) <= 0 && !product.last_finished_on;
  return true;
}

export default function PantryPage() {
  const [referenceDate, setReferenceDate] = useState(todayIso());
  const [products, setProducts] = useState<PantryProduct[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tableSortKey, setTableSortKey] = useState<TableSortKey>('product_name');
  const [tableSortDirection, setTableSortDirection] = useState<SortDirection>('asc');
  const [tablePageSize, setTablePageSize] = useState(20);
  const [tablePage, setTablePage] = useState(1);
  const [tableStatusFilter, setTableStatusFilter] = useState<StatusFilter>('all');
  const [cardSortKey, setCardSortKey] = useState<CardSortKey>('quantity_bought_this_month');
  const [cardSortDirection, setCardSortDirection] = useState<SortDirection>('desc');
  const [cardCategoryFilter, setCardCategoryFilter] = useState('all');
  const [cardStatusFilter, setCardStatusFilter] = useState<StatusFilter>('all');
  const [cardSearch, setCardSearch] = useState('');
  const [cardPageSize, setCardPageSize] = useState(12);
  const [cardPage, setCardPage] = useState(1);

  async function loadData() {
    try {
      setError(null);
      const data = await api.getPantry(referenceDate);
      setProducts(data);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load pantry');
    }
  }

  useEffect(() => {
    loadData();
  }, [referenceDate]);

  useEffect(() => {
    setTablePage(1);
  }, [tablePageSize, tableSortKey, tableSortDirection, tableStatusFilter, products]);

  useEffect(() => {
    setCardPage(1);
  }, [cardSortKey, cardSortDirection, cardCategoryFilter, cardStatusFilter, cardSearch, cardPageSize, products]);

  async function logEvent(productId: number, eventType: 'open' | 'finish') {
    try {
      setMessage(null);
      setError(null);
      await api.logProductEvent(productId, {
        occurred_on: referenceDate,
        event_type: eventType
      });
      setMessage(eventType === 'open' ? 'Product marked as open.' : 'Product marked as finished.');
      await loadData();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to log pantry event');
    }
  }

  function toggleTableSort(key: TableSortKey) {
    if (tableSortKey === key) {
      setTableSortDirection((current) => (current === 'asc' ? 'desc' : 'asc'));
      return;
    }
    setTableSortKey(key);
    setTableSortDirection(key === 'product_name' ? 'asc' : 'desc');
  }

  const categories = useMemo(
    () => Array.from(new Set(products.map((product) => product.category))).sort((a, b) => a.localeCompare(b)),
    [products]
  );

  const statusOptions: Array<{ value: StatusFilter; label: string }> = [
    { value: 'all', label: 'All statuses' },
    { value: 'open', label: 'Open' },
    { value: 'in_stock', label: 'In stock' },
    { value: 'finished', label: 'Finished' },
    { value: 'out_of_stock', label: 'Out of stock' }
  ];

  const sortedTableProducts = useMemo(() => {
    const items = products.filter((product) => matchesStatus(product, tableStatusFilter));
    items.sort((a, b) => {
      let comparison = 0;
      switch (tableSortKey) {
        case 'product_name':
          comparison = a.product_name.localeCompare(b.product_name);
          break;
        case 'current_stock':
          comparison = Number(a.current_stock) - Number(b.current_stock);
          break;
        case 'last_purchase_date':
          comparison = (a.last_purchase_date || '').localeCompare(b.last_purchase_date || '');
          break;
        case 'average_monthly_spend':
          comparison = Number(a.average_monthly_spend) - Number(b.average_monthly_spend);
          break;
        case 'status':
          comparison = a.status_label.localeCompare(b.status_label);
          break;
      }
      return tableSortDirection === 'asc' ? comparison : -comparison;
    });
    return items;
  }, [products, tableStatusFilter, tableSortDirection, tableSortKey]);

  const pagedTableProducts = useMemo(() => {
    const start = (tablePage - 1) * tablePageSize;
    return sortedTableProducts.slice(start, start + tablePageSize);
  }, [sortedTableProducts, tablePage, tablePageSize]);

  const tableTotalPages = Math.max(1, Math.ceil(sortedTableProducts.length / tablePageSize));

  const filteredCardProducts = useMemo(() => {
    const search = cardSearch.trim().toLowerCase();
    return products
      .filter((product) => cardCategoryFilter === 'all' || product.category === cardCategoryFilter)
      .filter((product) => matchesStatus(product, cardStatusFilter))
      .filter((product) => {
        if (!search) return true;
        return (
          product.product_name.toLowerCase().includes(search) ||
          product.category.toLowerCase().includes(search) ||
          product.related_dishes.some((dish) => dish.toLowerCase().includes(search))
        );
      });
  }, [products, cardCategoryFilter, cardStatusFilter, cardSearch]);

  const sortedCardProducts = useMemo(() => {
    const items = [...filteredCardProducts];
    items.sort((a, b) => {
      let comparison = 0;
      switch (cardSortKey) {
        case 'product_name':
          comparison = a.product_name.localeCompare(b.product_name);
          break;
        case 'quantity_bought_this_month':
          comparison = Number(a.quantity_bought_this_month) - Number(b.quantity_bought_this_month);
          break;
        case 'spend_this_month':
          comparison = Number(a.spend_this_month) - Number(b.spend_this_month);
          break;
        case 'average_monthly_spend':
          comparison = Number(a.average_monthly_spend) - Number(b.average_monthly_spend);
          break;
        case 'current_stock':
          comparison = Number(a.current_stock) - Number(b.current_stock);
          break;
        case 'average_duration_days':
          comparison = Number(a.average_duration_days || 0) - Number(b.average_duration_days || 0);
          break;
        case 'average_price':
          comparison = Number(a.average_price || 0) - Number(b.average_price || 0);
          break;
      }
      return cardSortDirection === 'asc' ? comparison : -comparison;
    });
    return items;
  }, [filteredCardProducts, cardSortDirection, cardSortKey]);

  const visibleCardProducts = useMemo(() => {
    const start = (cardPage - 1) * cardPageSize;
    return sortedCardProducts.slice(start, start + cardPageSize);
  }, [sortedCardProducts, cardPage, cardPageSize]);

  const cardTotalPages = Math.max(1, Math.ceil(sortedCardProducts.length / cardPageSize));
  const lowOrZeroStockCount = products.filter((item) => Number(item.current_stock) <= 0).length;
  const openCount = products.filter((item) => item.is_open).length;

  return (
    <main className="page">
      {message ? <div className="notice">{message}</div> : null}
      {error ? <div className="error">{error}</div> : null}
      <Card>
        <div className="form-grid four">
          <div className="form-field">
            <label>Reference date</label>
            <input
              className="input"
              type="date"
              value={referenceDate}
              onChange={(e) => setReferenceDate(e.target.value)}
            />
          </div>
          <div className="metric">
            <div className="label">Products tracked</div>
            <div className="value">{products.length}</div>
          </div>
          <div className="metric">
            <div className="label">Open now</div>
            <div className="value">{openCount}</div>
          </div>
          <div className="metric">
            <div className="label">Low / zero stock</div>
            <div className="value">{lowOrZeroStockCount}</div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="section-header">
          <div>
            <h2>Pantry overview</h2>
            <p className="muted">Track product state, filter by status, and sort by the metrics that matter.</p>
          </div>
          <div className="table-controls">
            <div className="form-field compact-field">
              <label>Status</label>
              <select className="select" value={tableStatusFilter} onChange={(e) => setTableStatusFilter(e.target.value as StatusFilter)}>
                {statusOptions.map((option) => (
                  <option key={option.value} value={option.value}>{option.label}</option>
                ))}
              </select>
            </div>
            <div className="form-field compact-field">
              <label>Rows</label>
              <select className="select" value={tablePageSize} onChange={(e) => setTablePageSize(Number(e.target.value))}>
                {TABLE_PAGE_SIZE_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>
          </div>
        </div>
        <div className="table-wrap">
          <table className="table">
            <thead>
              <tr>
                <th><button className="sort-button" type="button" onClick={() => toggleTableSort('product_name')}>Product {tableSortKey === 'product_name' ? (tableSortDirection === 'asc' ? '↑' : '↓') : ''}</button></th>
                <th><button className="sort-button" type="button" onClick={() => toggleTableSort('current_stock')}>Stock {tableSortKey === 'current_stock' ? (tableSortDirection === 'asc' ? '↑' : '↓') : ''}</button></th>
                <th><button className="sort-button" type="button" onClick={() => toggleTableSort('last_purchase_date')}>Last purchase {tableSortKey === 'last_purchase_date' ? (tableSortDirection === 'asc' ? '↑' : '↓') : ''}</button></th>
                <th>Avg duration</th>
                <th><button className="sort-button" type="button" onClick={() => toggleTableSort('average_monthly_spend')}>Avg monthly spend {tableSortKey === 'average_monthly_spend' ? (tableSortDirection === 'asc' ? '↑' : '↓') : ''}</button></th>
                <th><button className="sort-button" type="button" onClick={() => toggleTableSort('status')}>Status {tableSortKey === 'status' ? (tableSortDirection === 'asc' ? '↑' : '↓') : ''}</button></th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {pagedTableProducts.map((product) => (
                <tr key={product.product_id}>
                  <td>
                    <strong>{product.product_name}</strong>
                    <div className="muted small">{product.category}</div>
                    <div className="muted small">Related: {product.related_dishes.join(', ') || 'None'}</div>
                  </td>
                  <td>{product.current_stock} {product.unit}</td>
                  <td>{product.last_purchase_date || '—'}</td>
                  <td>{product.average_duration_days ? `${product.average_duration_days} days` : '—'}</td>
                  <td>{formatCurrency(Number(product.average_monthly_spend || 0))}</td>
                  <td>
                    <span className={`status-badge ${product.is_open ? 'open' : Number(product.current_stock) > 0 ? 'in-stock' : product.last_finished_on ? 'finished' : 'out'}`}>
                      {product.status_label}
                    </span>
                  </td>
                  <td>
                    <div className="actions no-top-margin">
                      <button
                        className={`button ${product.can_open ? 'success' : 'secondary'} pantry-action-button`}
                        type="button"
                        onClick={() => logEvent(product.product_id, 'open')}
                        disabled={!product.can_open}
                        title={product.can_open ? 'Mark this product as opened' : 'You can only open products that are in stock and not already open'}
                      >
                        Opened
                      </button>
                      <button
                        className={`button ${product.can_finish_remaining ? 'danger' : 'secondary'} pantry-action-button`}
                        type="button"
                        onClick={() => logEvent(product.product_id, 'finish')}
                        disabled={!product.can_finish_remaining}
                        title={product.can_finish_remaining ? 'Finish the remaining stock for this open product' : 'You can only finish products that are currently open'}
                      >
                        Finish remaining
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="table-footer">
          <span className="muted small">Showing {pagedTableProducts.length} of {sortedTableProducts.length} products</span>
          <div className="actions no-top-margin">
            <button className="button secondary" type="button" onClick={() => setTablePage((page) => Math.max(1, page - 1))} disabled={tablePage === 1}>Previous</button>
            <span className="muted small page-indicator">Page {tablePage} of {tableTotalPages}</span>
            <button className="button secondary" type="button" onClick={() => setTablePage((page) => Math.min(tableTotalPages, page + 1))} disabled={tablePage === tableTotalPages}>Next</button>
          </div>
        </div>
      </Card>

      <Card>
        <div className="section-header">
          <div>
            <h2>Product insights</h2>
            <p className="muted">Sort and filter the product cards to answer questions about quantity, spend, stock, and runout patterns.</p>
          </div>
        </div>
        <div className="form-grid four">
          <div className="form-field">
            <label>Sort cards by</label>
            <select className="select" value={cardSortKey} onChange={(e) => setCardSortKey(e.target.value as CardSortKey)}>
              <option value="quantity_bought_this_month">Quantity bought this month</option>
              <option value="spend_this_month">Spend this month</option>
              <option value="average_monthly_spend">Average monthly spend</option>
              <option value="current_stock">Current stock</option>
              <option value="average_duration_days">Average duration</option>
              <option value="average_price">Average price</option>
              <option value="product_name">Product name</option>
            </select>
          </div>
          <div className="form-field">
            <label>Direction</label>
            <select className="select" value={cardSortDirection} onChange={(e) => setCardSortDirection(e.target.value as SortDirection)}>
              <option value="desc">Highest first</option>
              <option value="asc">Lowest first</option>
            </select>
          </div>
          <div className="form-field">
            <label>Category</label>
            <select className="select" value={cardCategoryFilter} onChange={(e) => setCardCategoryFilter(e.target.value)}>
              <option value="all">All categories</option>
              {categories.map((category) => (
                <option key={category} value={category}>{category}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>Status</label>
            <select className="select" value={cardStatusFilter} onChange={(e) => setCardStatusFilter(e.target.value as StatusFilter)}>
              {statusOptions.map((option) => (
                <option key={option.value} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>Search</label>
            <input className="input" value={cardSearch} onChange={(e) => setCardSearch(e.target.value)} placeholder="Product, category, or related dish" />
          </div>
          <div className="form-field">
            <label>Cards per page</label>
            <select className="select" value={cardPageSize} onChange={(e) => setCardPageSize(Number(e.target.value))}>
              {CARD_PAGE_SIZE_OPTIONS.map((option) => (
                <option key={option} value={option}>{option}</option>
              ))}
            </select>
          </div>
          <div className="form-field">
            <label>&nbsp;</label>
            <button
              className="button secondary"
              type="button"
              onClick={() => {
                setCardSortKey('quantity_bought_this_month');
                setCardSortDirection('desc');
                setCardCategoryFilter('all');
                setCardStatusFilter('all');
                setCardSearch('');
                setCardPageSize(12);
                setCardPage(1);
              }}
            >
              Reset filters
            </button>
          </div>
        </div>
        <div className="split-grid">
          {visibleCardProducts.map((product) => (
            <Card key={`detail-${product.product_id}`}>
              <div className="list-row">
                <h3>{product.product_name}</h3>
                <span className={`status-badge ${product.is_open ? 'open' : Number(product.current_stock) > 0 ? 'in-stock' : product.last_finished_on ? 'finished' : 'out'}`}>
                  {product.status_label}
                </span>
              </div>
              <div className="pills">
                <span className="pill">Bought {product.quantity_bought_this_month} {product.unit} this month</span>
                <span className="pill">Spent this month {formatCurrency(Number(product.spend_this_month || 0))}</span>
                <span className="pill">Avg monthly spend {formatCurrency(Number(product.average_monthly_spend || 0))}</span>
                <span className="pill">Stock {product.current_stock} {product.unit}</span>
                {product.average_price ? <span className="pill">Avg price {formatCurrency(Number(product.average_price))}</span> : null}
                {product.average_duration_days ? <span className="pill">Avg duration {product.average_duration_days} days</span> : null}
              </div>
              <div className="muted small">Related dishes: {product.related_dishes.join(', ') || 'None'}</div>
              <h4>Recent purchases</h4>
              <div className="list">
                {product.recent_purchases.map((purchase, idx) => (
                  <div className="list-item" key={`${product.product_id}-${idx}`}>
                    <div className="list-row">
                      <strong>{purchase.day}</strong>
                      <span>{formatCurrency(Number(purchase.total_price))}</span>
                    </div>
                    <div className="muted small">{purchase.store || 'No store'} · Qty {purchase.quantity}</div>
                  </div>
                ))}
                {!product.recent_purchases.length ? <div className="muted">No purchases yet.</div> : null}
              </div>
            </Card>
          ))}
        </div>
        {!visibleCardProducts.length ? <div className="muted">No products match the current filters.</div> : null}
        <div className="table-footer">
          <span className="muted small">Showing {visibleCardProducts.length} of {sortedCardProducts.length} products</span>
          <div className="actions no-top-margin">
            <button className="button secondary" type="button" onClick={() => setCardPage((page) => Math.max(1, page - 1))} disabled={cardPage === 1}>Previous</button>
            <span className="muted small page-indicator">Page {cardPage} of {cardTotalPages}</span>
            <button className="button secondary" type="button" onClick={() => setCardPage((page) => Math.min(cardTotalPages, page + 1))} disabled={cardPage === cardTotalPages}>Next</button>
          </div>
        </div>
      </Card>
    </main>
  );
}
