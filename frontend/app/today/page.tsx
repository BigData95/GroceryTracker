'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/Card';
import {
  api,
  Category,
  DayDetail,
  Dish,
  DishIngredient,
  Meal,
  MealIngredient,
  Product,
  Purchase,
  PurchaseItem,
  Unit,
  formatCurrency,
  todayIso
} from '@/lib/api';

type PurchaseDraft = {
  product_id?: number | null;
  product_name: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  unit: string;
  category: string;
};

function emptyPurchaseItem(defaultCategory: string, defaultUnit: string): PurchaseDraft {
  return {
    product_id: null,
    product_name: '',
    quantity: 1,
    unit_price: 0,
    total_price: 0,
    unit: defaultUnit,
    category: defaultCategory
  };
}

function roundMoney(value: number) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function emptyMealIngredient(): MealIngredient {
  return {
    product_id: null,
    product_name: '',
    quantity: 1
  };
}

function ingredientFromDish(ingredient: DishIngredient): MealIngredient {
  return {
    product_id: ingredient.product_id ?? null,
    product_name: ingredient.product_name || '',
    quantity: Number(ingredient.quantity)
  };
}

function draftFromPurchaseItem(
  item: PurchaseItem,
  products: Product[],
  defaultCategory: string,
  defaultUnit: string
): PurchaseDraft {
  const product = products.find((entry) => entry.id === item.product_id);
  return {
    product_id: item.product_id,
    product_name: item.product_name || product?.name || '',
    quantity: Number(item.quantity),
    unit_price: Number(item.unit_price),
    total_price: roundMoney(Number(item.total_price)),
    unit: product?.unit || defaultUnit,
    category: product?.category || defaultCategory
  };
}

export default function TodayPage() {
  const [selectedDate, setSelectedDate] = useState(todayIso());
  const [products, setProducts] = useState<Product[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [mealCategories, setMealCategories] = useState<string[]>([]);
  const [dayDetail, setDayDetail] = useState<DayDetail | null>(null);
  const [monthSpend, setMonthSpend] = useState(0);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [editingPurchaseId, setEditingPurchaseId] = useState<number | null>(null);
  const [purchaseStore, setPurchaseStore] = useState('');
  const [purchaseNote, setPurchaseNote] = useState('');
  const [purchaseItems, setPurchaseItems] = useState<PurchaseDraft[]>([]);

  const [editingMealId, setEditingMealId] = useState<number | null>(null);
  const [selectedDishId, setSelectedDishId] = useState<number | ''>('');
  const [mealName, setMealName] = useState('');
  const [mealCategory, setMealCategory] = useState('dinner');
  const [mealNote, setMealNote] = useState('');
  const [mealIngredients, setMealIngredients] = useState<MealIngredient[]>([]);

  const selectedDish = useMemo(
    () => dishes.find((dish) => dish.id === Number(selectedDishId)),
    [dishes, selectedDishId]
  );

  const productCategoryOptions = useMemo(() => {
    const names = new Set(categories.map((category) => category.name));
    if (!names.size) names.add('general');
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [categories]);

  const unitOptions = useMemo(() => {
    const names = new Set(units.map((unit) => unit.name));
    if (!names.size) names.add('unit');
    return Array.from(names).sort((a, b) => a.localeCompare(b));
  }, [units]);

  const defaultCategory = productCategoryOptions[0] || 'general';
  const defaultUnit = unitOptions[0] || 'unit';

  async function loadBaseData() {
    const [productsData, dishesData, categoriesData, unitsData, meta] = await Promise.all([
      api.getProducts(),
      api.getDishes(),
      api.getCategories(),
      api.getUnits(),
      api.getMetaCategories()
    ]);
    setProducts(productsData);
    setDishes(dishesData);
    setCategories(categoriesData);
    setUnits(unitsData);
    setMealCategories(meta.meal_categories);
    setPurchaseItems((current) =>
      current.length ? current : [emptyPurchaseItem(meta.product_categories[0] || 'general', meta.units[0] || 'unit')]
    );
  }

  async function loadDateData(day: string) {
    const [detail, report] = await Promise.all([api.getDayDetail(day), api.getMonthlyReport(day.slice(0, 7))]);
    setDayDetail(detail);
    setMonthSpend(Number(report.total_grocery_spend));
  }

  useEffect(() => {
    loadBaseData().catch((err) => setError(err.message));
  }, []);

  useEffect(() => {
    loadDateData(selectedDate).catch((err) => setError(err.message));
  }, [selectedDate]);

  function resetMessages() {
    setMessage(null);
    setError(null);
  }

  function resetPurchaseForm() {
    setEditingPurchaseId(null);
    setPurchaseStore('');
    setPurchaseNote('');
    setPurchaseItems([emptyPurchaseItem(defaultCategory, defaultUnit)]);
  }

  function resetMealForm() {
    setEditingMealId(null);
    setSelectedDishId('');
    setMealName('');
    setMealCategory(mealCategories[0] || 'dinner');
    setMealNote('');
    setMealIngredients([]);
  }

  async function refreshAll(day = selectedDate) {
    await Promise.all([loadBaseData(), loadDateData(day)]);
  }

  async function handlePurchaseSubmit(e: FormEvent) {
    e.preventDefault();
    resetMessages();
    try {
      const payload = {
        purchased_on: selectedDate,
        store: purchaseStore,
        note: purchaseNote,
        items: purchaseItems
          .filter((item) => item.product_id || item.product_name.trim())
          .map((item) => ({
            product_id: item.product_id || undefined,
            product_name: item.product_name.trim() || undefined,
            quantity: item.quantity,
            unit_price: item.unit_price,
            total_price: roundMoney(item.quantity * item.unit_price),
            unit: item.unit,
            category: item.category
          }))
      };

      if (editingPurchaseId) {
        await api.updatePurchase(editingPurchaseId, payload);
        setMessage('Purchase updated.');
      } else {
        await api.createPurchase(payload);
        setMessage('Purchase logged.');
      }
      resetPurchaseForm();
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save purchase');
    }
  }

  async function handleMealSubmit(e: FormEvent) {
    e.preventDefault();
    resetMessages();
    try {
      const payload = {
        occurred_on: selectedDate,
        dish_id: selectedDish ? selectedDish.id : null,
        name_snapshot: mealName || selectedDish?.name || 'Custom meal',
        category_snapshot: mealCategory || selectedDish?.category || 'dinner',
        note: mealNote,
        ingredients: mealIngredients.filter((ingredient) => ingredient.product_id || ingredient.product_name?.trim())
      };

      if (editingMealId) {
        await api.updateMeal(editingMealId, payload);
        setMessage('Meal updated.');
      } else {
        await api.createMeal(payload);
        setMessage('Meal logged.');
      }
      resetMealForm();
      await refreshAll();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save meal');
    }
  }

  function updatePurchaseItem(index: number, patch: Partial<PurchaseDraft>) {
    setPurchaseItems((current) =>
      current.map((item, idx) => {
        if (idx !== index) return item;
        const next = { ...item, ...patch };
        next.total_price = roundMoney(Number(next.quantity || 0) * Number(next.unit_price || 0));
        return next;
      })
    );
  }

  function updatePurchaseProduct(index: number, value: string) {
    const match = products.find((product) => product.name.toLowerCase() === value.trim().toLowerCase());
    updatePurchaseItem(index, {
      product_name: value,
      product_id: match?.id || null,
      unit: match?.unit || defaultUnit,
      category: match?.category || defaultCategory,
      ...(match ? { unit_price: Number(match.last_unit_price ?? 0) } : {})
    });
  }

  function updateMealIngredient(index: number, patch: Partial<MealIngredient>) {
    setMealIngredients((current) =>
      current.map((ingredient, idx) => (idx === index ? { ...ingredient, ...patch } : ingredient))
    );
  }


  function updateMealIngredientProduct(index: number, value: string) {
    const match = products.find((product) => product.name.toLowerCase() === value.trim().toLowerCase());
    updateMealIngredient(index, {
      product_name: value,
      product_id: match?.id || null
    });
  }

  function hydrateDish(dishId: number | '') {
    setSelectedDishId(dishId);
    if (!dishId) {
      setMealName('');
      setMealCategory(mealCategories[0] || 'dinner');
      setMealIngredients([]);
      return;
    }

    const dish = dishes.find((entry) => entry.id === Number(dishId));
    if (!dish) return;
    setMealName(dish.name);
    setMealCategory(dish.category);
    setMealIngredients(dish.ingredients.map(ingredientFromDish));
  }

  function startEditPurchase(purchase: Purchase) {
    setEditingPurchaseId(purchase.id);
    setPurchaseStore(purchase.store || '');
    setPurchaseNote(purchase.note || '');
    setPurchaseItems(
      purchase.items.length
        ? purchase.items.map((item) => draftFromPurchaseItem(item, products, defaultCategory, defaultUnit))
        : [emptyPurchaseItem(defaultCategory, defaultUnit)]
    );
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function startEditMeal(meal: Meal) {
    setEditingMealId(meal.id);
    setSelectedDishId(meal.dish_id || '');
    setMealName(meal.name_snapshot);
    setMealCategory(meal.category_snapshot);
    setMealNote(meal.note || '');
    setMealIngredients(
      meal.ingredients.map((ingredient) => ({
        product_id: ingredient.product_id,
        product_name: ingredient.product_name || '',
        quantity: Number(ingredient.quantity)
      }))
    );
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const spendToday = Number(dayDetail?.total_spend || 0);
  const mealCount = dayDetail?.meals.length || 0;
  const purchaseCount = dayDetail?.items_bought.length || 0;
  const finishedCount = dayDetail?.products_finished.length || 0;

  return (
    <main className="page">
      {message ? <div className="notice">{message}</div> : null}
      {error ? <div className="error">{error}</div> : null}

      <datalist id="product-options">
        {products.map((product) => (
          <option key={product.id} value={product.name} />
        ))}
      </datalist>

      <Card>
        <div className="form-grid three">
          <div className="form-field">
            <label>Date</label>
            <input
              className="input"
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </div>
          <div className="metric">
            <div className="label">Spent today</div>
            <div className="value">{formatCurrency(spendToday)}</div>
          </div>
          <div className="metric">
            <div className="label">This month</div>
            <div className="value">{formatCurrency(monthSpend)}</div>
          </div>
        </div>
      </Card>

      <Card>
        <div className="metric-grid">
          <div className="metric">
            <div className="label">Purchase items</div>
            <div className="value">{purchaseCount}</div>
          </div>
          <div className="metric">
            <div className="label">Meals logged</div>
            <div className="value">{mealCount}</div>
          </div>
          <div className="metric">
            <div className="label">Ran out</div>
            <div className="value">{finishedCount}</div>
          </div>
          <div className="metric">
            <div className="label">Products opened</div>
            <div className="value">{dayDetail?.products_opened.length || 0}</div>
          </div>
        </div>
      </Card>

      <div className="page-grid">
        <div className="page">
          <Card>
            <h2>{editingPurchaseId ? 'Edit purchase' : 'Log purchase'}</h2>
            <p className="muted small">Type a product name to reuse it, or type a new one and pick its unit/category.</p>
            <form onSubmit={handlePurchaseSubmit}>
              <div className="form-grid">
                <div className="form-field">
                  <label>Store</label>
                  <input className="input" value={purchaseStore} onChange={(e) => setPurchaseStore(e.target.value)} />
                </div>
                <div className="form-field">
                  <label>Note</label>
                  <input className="input" value={purchaseNote} onChange={(e) => setPurchaseNote(e.target.value)} />
                </div>
              </div>
              <div className="list" style={{ marginTop: 12 }}>
                {purchaseItems.map((item, index) => {
                  const isExistingProduct = Boolean(item.product_id);
                  return (
                    <div className="list-item" key={index}>
                      <div className="form-grid three">
                        <div className="form-field">
                          <label>Product</label>
                          <input
                            className="input"
                            list="product-options"
                            value={item.product_name}
                            onChange={(e) => updatePurchaseProduct(index, e.target.value)}
                            placeholder="Type to autocomplete"
                          />
                        </div>
                        <div className="form-field">
                          <label>Quantity ({item.unit || 'unit'})</label>
                          <input
                            className="input"
                            type="number"
                            step="0.01"
                            value={item.quantity}
                            onChange={(e) => updatePurchaseItem(index, { quantity: Number(e.target.value) })}
                          />
                        </div>
                        <div className="form-field">
                          <label>Unit price</label>
                          <input
                            className="input"
                            type="number"
                            step="0.01"
                            value={item.unit_price}
                            onFocus={(e) => e.currentTarget.select()}
                            onChange={(e) => updatePurchaseItem(index, { unit_price: Number(e.target.value) })}
                          />
                        </div>
                      </div>
                      <div className="form-grid three">
                        <div className="form-field">
                          <label>Total price</label>
                          <input className="input" type="number" step="0.01" value={item.total_price} readOnly />
                        </div>
                        <div className="form-field">
                          <label>Unit for new product</label>
                          <select
                            className="select"
                            value={item.unit}
                            disabled={isExistingProduct}
                            onChange={(e) => updatePurchaseItem(index, { unit: e.target.value })}
                          >
                            {unitOptions.map((unit) => (
                              <option key={unit} value={unit}>
                                {unit}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div className="form-field">
                          <label>Category for new product</label>
                          <select
                            className="select"
                            value={item.category}
                            disabled={isExistingProduct}
                            onChange={(e) => updatePurchaseItem(index, { category: e.target.value })}
                          >
                            {productCategoryOptions.map((category) => (
                              <option key={category} value={category}>
                                {category}
                              </option>
                            ))}
                          </select>
                        </div>
                      </div>
                      <div className="actions">
                        {!item.product_id && item.product_name.trim() ? (
                          <span className="pill">New product will be created</span>
                        ) : item.product_id ? (
                          <span className="pill">Existing product · {item.unit}</span>
                        ) : null}
                        <button
                          className="button danger"
                          type="button"
                          onClick={() => setPurchaseItems((current) => current.filter((_, idx) => idx !== index))}
                        >
                          Remove line
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="actions">
                <button
                  className="button secondary"
                  type="button"
                  onClick={() => setPurchaseItems((current) => [...current, emptyPurchaseItem(defaultCategory, defaultUnit)])}
                >
                  Add line item
                </button>
                <button className="button" type="submit">
                  {editingPurchaseId ? 'Update purchase' : 'Save purchase'}
                </button>
                {editingPurchaseId ? (
                  <button className="button secondary" type="button" onClick={resetPurchaseForm}>
                    Cancel edit
                  </button>
                ) : null}
              </div>
            </form>
          </Card>
        </div>

        <div className="page">
          <Card>
            <h2>{editingMealId ? 'Edit meal / dish' : 'Log meal / dish'}</h2>
            <p className="muted small">Start from a dish template, then add or remove ingredients before saving.</p>
            <form onSubmit={handleMealSubmit}>
              <div className="form-grid">
                <div className="form-field">
                  <label>Dish template</label>
                  <select
                    className="select"
                    value={selectedDishId}
                    onChange={(e) => hydrateDish(e.target.value ? Number(e.target.value) : '')}
                  >
                    <option value="">Custom / no template</option>
                    {dishes.map((dish) => (
                      <option key={dish.id} value={dish.id}>
                        {dish.name}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label>Meal name</label>
                  <input className="input" value={mealName} onChange={(e) => setMealName(e.target.value)} />
                </div>
                <div className="form-field">
                  <label>Category</label>
                  <select className="select" value={mealCategory} onChange={(e) => setMealCategory(e.target.value)}>
                    {mealCategories.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label>Note</label>
                  <input className="input" value={mealNote} onChange={(e) => setMealNote(e.target.value)} />
                </div>
              </div>

              <div className="list" style={{ marginTop: 12 }}>
                {mealIngredients.map((ingredient, index) => {
                  const product = ingredient.product_id
                    ? products.find((entry) => entry.id === ingredient.product_id)
                    : products.find((entry) => entry.name.toLowerCase() === (ingredient.product_name || '').trim().toLowerCase());
                  const ingredientName = ingredient.product_name || product?.name || '';
                  return (
                    <div className="list-item" key={`${ingredientName || 'ingredient'}-${index}`}>
                      <div className="form-grid three">
                        <div className="form-field">
                          <label>Ingredient</label>
                          <input
                            className="input"
                            list="product-options"
                            value={ingredientName}
                            onChange={(e) => updateMealIngredientProduct(index, e.target.value)}
                            placeholder="Type to autocomplete"
                          />
                        </div>
                        <div className="form-field">
                          <label>Quantity ({product?.unit || 'unit'})</label>
                          <input
                            className="input"
                            type="number"
                            step="0.01"
                            value={ingredient.quantity}
                            onChange={(e) => updateMealIngredient(index, { quantity: Number(e.target.value) })}
                          />
                        </div>
                        <div className="actions" style={{ alignItems: 'end' }}>
                          <button
                            className="button danger"
                            type="button"
                            onClick={() => setMealIngredients((current) => current.filter((_, idx) => idx !== index))}
                          >
                            Remove ingredient
                          </button>
                        </div>
                      </div>
                      {!ingredient.product_id && ingredientName.trim() ? (
                        <div className="muted small">New ingredient will be created with default unit/category.</div>
                      ) : null}
                    </div>
                  );
                })}
              </div>

              <div className="actions">
                <button
                  className="button secondary"
                  type="button"
                  onClick={() =>
                    setMealIngredients((current) => [...current, emptyMealIngredient()])
                  }
                >
                  Add ingredient
                </button>
                <button className="button" type="submit">
                  {editingMealId ? 'Update meal' : 'Save meal'}
                </button>
                {editingMealId ? (
                  <button className="button secondary" type="button" onClick={resetMealForm}>
                    Cancel edit
                  </button>
                ) : null}
              </div>
            </form>
          </Card>
        </div>
      </div>

      <Card>
        <h2>What happened on {selectedDate}</h2>
        <div className="split-grid">
          <div>
            <h3>Purchases</h3>
            <div className="list">
              {dayDetail?.purchases.map((purchase) => (
                <div className="list-item" key={purchase.id}>
                  <div className="list-row">
                    <strong>{purchase.store || 'No store'}</strong>
                    <div className="actions" style={{ marginTop: 0 }}>
                      <span>{formatCurrency(purchase.items.reduce((sum, item) => sum + Number(item.total_price), 0))}</span>
                      <button className="button secondary" type="button" onClick={() => startEditPurchase(purchase)}>
                        Edit
                      </button>
                    </div>
                  </div>
                  {purchase.note ? <div className="muted small">{purchase.note}</div> : null}
                  <div className="muted small" style={{ marginTop: 8 }}>
                    {purchase.items.map((item) => `${item.product_name} (${item.quantity})`).join(', ')}
                  </div>
                </div>
              ))}
              {!dayDetail?.purchases.length ? <div className="muted">No purchases yet.</div> : null}
            </div>
          </div>
          <div>
            <h3>Meals cooked / eaten</h3>
            <div className="list">
              {dayDetail?.meals.map((meal) => (
                <div className="list-item" key={meal.id}>
                  <div className="list-row">
                    <strong>{meal.name_snapshot}</strong>
                    <div className="actions" style={{ marginTop: 0 }}>
                      <span className="pill">{meal.category_snapshot}</span>
                      <button className="button secondary" type="button" onClick={() => startEditMeal(meal)}>
                        Edit
                      </button>
                    </div>
                  </div>
                  {meal.note ? <div className="muted small">{meal.note}</div> : null}
                  <div className="muted small" style={{ marginTop: 8 }}>
                    {meal.ingredients.map((ingredient) => `${ingredient.product_name} (${ingredient.quantity})`).join(', ')}
                  </div>
                </div>
              ))}
              {!dayDetail?.meals.length ? <div className="muted">No meals logged yet.</div> : null}
            </div>
          </div>
        </div>
      </Card>
    </main>
  );
}
