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
  todayIso,
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

type MealIngredientRow = MealIngredient & {
  rowId: string;
};

function makeRowId() {
  return Math.random().toString(36).slice(2, 10);
}

function emptyPurchaseItem(defaultCategory: string, defaultUnit: string): PurchaseDraft {
  return {
    product_id: null,
    product_name: '',
    quantity: 1,
    unit_price: 0,
    total_price: 0,
    unit: defaultUnit,
    category: defaultCategory,
  };
}

function roundMoney(value: number) {
  return Math.round((Number(value || 0) + Number.EPSILON) * 100) / 100;
}

function emptyMealIngredient(): MealIngredientRow {
  return {
    rowId: makeRowId(),
    product_id: null,
    product_name: '',
    quantity: 1,
  };
}

function ingredientFromDish(ingredient: DishIngredient): MealIngredientRow {
  return {
    rowId: makeRowId(),
    product_id: ingredient.product_id ?? null,
    product_name: ingredient.product_name || '',
    quantity: Number(ingredient.quantity),
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
    unit: product?.unit || item.unit || defaultUnit,
    category: product?.category || item.category || defaultCategory,
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
  const [selectedDishId, setSelectedDishId] = useState('');
  const [mealName, setMealName] = useState('');
  const [mealCategory, setMealCategory] = useState('dinner');
  const [mealNote, setMealNote] = useState('');
  const [mealIngredients, setMealIngredients] = useState<MealIngredientRow[]>([]);

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
      api.getMetaCategories(),
    ]);

    setProducts(productsData);
    setDishes(dishesData);
    setCategories(categoriesData);
    setUnits(unitsData);
    setMealCategories(meta.meal_categories);

    setPurchaseItems((current) =>
      current.length
        ? current
        : [emptyPurchaseItem(meta.product_categories[0] || 'general', meta.units[0] || 'unit')]
    );

    setMealIngredients((current) => (current.length ? current : [emptyMealIngredient()]));
    setMealCategory((current) => current || meta.meal_categories[0] || 'dinner');
  }

  async function loadDateData(day: string) {
    const [detail, report] = await Promise.all([
      api.getDayDetail(day),
      api.getMonthlyReport(day.slice(0, 7)),
    ]);
    setDayDetail(detail);
    setMonthSpend(Number(report.total_grocery_spend));
  }

  useEffect(() => {
    loadBaseData().catch((err) =>
      setError(err instanceof Error ? err.message : 'Failed to load base data')
    );
  }, []);

  useEffect(() => {
    loadDateData(selectedDate).catch((err) =>
      setError(err instanceof Error ? err.message : 'Failed to load selected day')
    );
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
    setMealIngredients([emptyMealIngredient()]);
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
            category: item.category,
          })),
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
        ingredients: mealIngredients
          .filter((ingredient) => ingredient.product_id || ingredient.product_name?.trim())
          .map(({ rowId, ...ingredient }) => ({
            ...ingredient,
            product_name: ingredient.product_name?.trim() || undefined,
          })),
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
    const match = products.find(
      (product) => product.name.toLowerCase() === value.trim().toLowerCase()
    );

    updatePurchaseItem(index, {
      product_name: value,
      product_id: match?.id || null,
      unit: match?.unit || defaultUnit,
      category: match?.category || defaultCategory,
      ...(match ? { unit_price: Number(match.last_unit_price ?? 0) } : {}),
    });
  }

  function updateMealIngredient(index: number, patch: Partial<MealIngredientRow>) {
    setMealIngredients((current) =>
      current.map((ingredient, idx) =>
        idx === index ? { ...ingredient, ...patch } : ingredient
      )
    );
  }

  function updateMealIngredientProduct(index: number, value: string) {
    const match = products.find(
      (product) => product.name.toLowerCase() === value.trim().toLowerCase()
    );

    updateMealIngredient(index, {
      product_name: value,
      product_id: match?.id || null,
    });
  }

  function hydrateDish(dishId: number | '') {
    setSelectedDishId(dishId ? String(dishId) : '');

    if (!dishId) {
      setMealName('');
      setMealCategory(mealCategories[0] || 'dinner');
      setMealIngredients([emptyMealIngredient()]);
      return;
    }

    const dish = dishes.find((entry) => entry.id === Number(dishId));
    if (!dish) return;

    setMealName(dish.name);
    setMealCategory(dish.category);
    setMealIngredients(
      dish.ingredients.length ? dish.ingredients.map(ingredientFromDish) : [emptyMealIngredient()]
    );
  }

  function startEditPurchase(purchase: Purchase) {
    setEditingPurchaseId(purchase.id);
    setPurchaseStore(purchase.store || '');
    setPurchaseNote(purchase.note || '');
    setPurchaseItems(
      purchase.items.length
        ? purchase.items.map((item) =>
            draftFromPurchaseItem(item, products, defaultCategory, defaultUnit)
          )
        : [emptyPurchaseItem(defaultCategory, defaultUnit)]
    );
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function startEditMeal(meal: Meal) {
    setEditingMealId(meal.id);
    setSelectedDishId(meal.dish_id ? String(meal.dish_id) : '');
    setMealName(meal.name_snapshot);
    setMealCategory(meal.category_snapshot);
    setMealNote(meal.note || '');
    setMealIngredients(
      meal.ingredients.length
        ? meal.ingredients.map((ingredient) => ({
            rowId: makeRowId(),
            product_id: ingredient.product_id ?? null,
            product_name: ingredient.product_name || '',
            quantity: Number(ingredient.quantity),
          }))
        : [emptyMealIngredient()]
    );
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const spendToday = Number(dayDetail?.total_spend || 0);
  const mealCount = dayDetail?.meals.length || 0;
  const purchaseCount = dayDetail?.items_bought.length || 0;
  const finishedCount = dayDetail?.products_finished.length || 0;

  return (
    <>
      {message ? <div className="alert alert-success">{message}</div> : null}
      {error ? <div className="alert alert-error">{error}</div> : null}

      <datalist id="product-options">
        {products.map((product) => (
          <option key={product.id} value={product.name} />
        ))}
      </datalist>

      <Card>
        <div className="form-grid">
          <label>
            <span>Date</span>
            <input
              type="date"
              value={selectedDate}
              onChange={(e) => setSelectedDate(e.target.value)}
            />
          </label>

          <div>
            <strong>Spent today</strong>
            <div>{formatCurrency(spendToday)}</div>
          </div>

          <div>
            <strong>This month</strong>
            <div>{formatCurrency(monthSpend)}</div>
          </div>

          <div>
            <strong>Purchase items</strong>
            <div>{purchaseCount}</div>
          </div>

          <div>
            <strong>Meals logged</strong>
            <div>{mealCount}</div>
          </div>

          <div>
            <strong>Ran out</strong>
            <div>{finishedCount}</div>
          </div>

          <div>
            <strong>Products opened</strong>
            <div>{dayDetail?.products_opened.length || 0}</div>
          </div>
        </div>
      </Card>

      <Card>
        <h2>{editingPurchaseId ? 'Edit purchase' : 'Log purchase'}</h2>
        <p>Type a product name to reuse it, or type a new one and pick its unit/category.</p>

        <form className="form-grid" onSubmit={handlePurchaseSubmit}>
          <label>
            <span>Store</span>
            <input value={purchaseStore} onChange={(e) => setPurchaseStore(e.target.value)} />
          </label>

          <label className="span-2">
            <span>Note</span>
            <input value={purchaseNote} onChange={(e) => setPurchaseNote(e.target.value)} />
          </label>

          <div className="span-2 stack">
            {purchaseItems.map((item, index) => {
              const isExistingProduct = Boolean(item.product_id);

              return (
                <div className="ingredient-card" key={`${index}-${item.product_name}`}>
                  <div className="form-grid">
                    <label>
                      <span>Product</span>
                      <input
                        list="product-options"
                        value={item.product_name}
                        onChange={(e) => updatePurchaseProduct(index, e.target.value)}
                        placeholder="Type to autocomplete"
                      />
                    </label>

                    <label>
                      <span>Quantity ({item.unit || 'unit'})</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.quantity}
                        onChange={(e) =>
                          updatePurchaseItem(index, { quantity: Number(e.target.value) })
                        }
                      />
                    </label>

                    <label>
                      <span>Unit price</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={item.unit_price}
                        onFocus={(e) => e.currentTarget.select()}
                        onChange={(e) =>
                          updatePurchaseItem(index, { unit_price: Number(e.target.value) })
                        }
                      />
                    </label>

                    <label>
                      <span>Total price</span>
                      <input type="number" value={item.total_price} readOnly />
                    </label>

                    <label>
                      <span>Unit for new product</span>
                      <select
                        value={item.unit}
                        onChange={(e) => updatePurchaseItem(index, { unit: e.target.value })}
                        disabled={isExistingProduct}
                      >
                        {unitOptions.map((unit) => (
                          <option key={unit} value={unit}>
                            {unit}
                          </option>
                        ))}
                      </select>
                    </label>

                    <label>
                      <span>Category for new product</span>
                      <select
                        value={item.category}
                        onChange={(e) => updatePurchaseItem(index, { category: e.target.value })}
                        disabled={isExistingProduct}
                      >
                        {productCategoryOptions.map((category) => (
                          <option key={category} value={category}>
                            {category}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <div className="actions">
                    {!item.product_id && item.product_name.trim() ? (
                      <small>New product will be created</small>
                    ) : item.product_id ? (
                      <small>
                        Existing product · {item.unit}
                        {item.unit_price ? ` · last price ${formatCurrency(item.unit_price)}` : ''}
                      </small>
                    ) : (
                      <span />
                    )}

                    <button
                      type="button"
                      className="secondary"
                      onClick={() =>
                        setPurchaseItems((current) => current.filter((_, idx) => idx !== index))
                      }
                    >
                      Remove line
                    </button>
                  </div>
                </div>
              );
            })}

            <button
              type="button"
              className="secondary"
              onClick={() =>
                setPurchaseItems((current) => [
                  ...current,
                  emptyPurchaseItem(defaultCategory, defaultUnit),
                ])
              }
            >
              Add line item
            </button>
          </div>

          <div className="actions span-2">
            <button type="submit">
              {editingPurchaseId ? 'Update purchase' : 'Save purchase'}
            </button>
            {editingPurchaseId ? (
              <button type="button" className="secondary" onClick={resetPurchaseForm}>
                Cancel edit
              </button>
            ) : null}
          </div>
        </form>
      </Card>

      <Card>
        <h2>{editingMealId ? 'Edit meal / dish' : 'Log meal / dish'}</h2>
        <p>Start from a dish template, then add or remove ingredients before saving.</p>

        <form className="form-grid" onSubmit={handleMealSubmit}>
          <label>
            <span>Dish template</span>
            <select
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
          </label>

          <label>
            <span>Meal name</span>
            <input value={mealName} onChange={(e) => setMealName(e.target.value)} />
          </label>

          <label>
            <span>Category</span>
            <select value={mealCategory} onChange={(e) => setMealCategory(e.target.value)}>
              {mealCategories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </label>

          <label className="span-2">
            <span>Note</span>
            <input value={mealNote} onChange={(e) => setMealNote(e.target.value)} />
          </label>

          <div className="span-2 stack">
            {mealIngredients.map((ingredient, index) => {
              const product = ingredient.product_id
                ? products.find((entry) => entry.id === ingredient.product_id)
                : products.find(
                    (entry) =>
                      entry.name.toLowerCase() ===
                      (ingredient.product_name || '').trim().toLowerCase()
                  );

              const ingredientName = ingredient.product_name || product?.name || '';

              return (
                <div className="ingredient-card" key={ingredient.rowId}>
                  <div className="form-grid">
                    <label>
                      <span>Ingredient</span>
                      <input
                        list="product-options"
                        value={ingredientName}
                        onChange={(e) => updateMealIngredientProduct(index, e.target.value)}
                        placeholder="Type to autocomplete"
                      />
                    </label>

                    <label>
                      <span>Quantity ({product?.unit || 'unit'})</span>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={ingredient.quantity}
                        onChange={(e) =>
                          updateMealIngredient(index, { quantity: Number(e.target.value) })
                        }
                      />
                    </label>

                    <div className="actions" style={{ alignItems: 'end' }}>
                      <button
                        type="button"
                        className="secondary"
                        onClick={() =>
                          setMealIngredients((current) => current.filter((_, idx) => idx !== index))
                        }
                      >
                        Remove ingredient
                      </button>
                    </div>
                  </div>

                  {!ingredient.product_id && ingredientName.trim() ? (
                    <div className="muted small">
                      New ingredient will be created with default unit/category.
                    </div>
                  ) : null}
                </div>
              );
            })}

            <button
              type="button"
              className="secondary"
              onClick={() =>
                setMealIngredients((current) => [...current, emptyMealIngredient()])
              }
            >
              Add ingredient
            </button>
          </div>

          <div className="actions span-2">
            <button type="submit">{editingMealId ? 'Update meal' : 'Save meal'}</button>
            {editingMealId ? (
              <button type="button" className="secondary" onClick={resetMealForm}>
                Cancel edit
              </button>
            ) : null}
          </div>
        </form>
      </Card>

      <Card>
        <h2>What happened on {selectedDate}</h2>

        <div className="stack">
          <section>
            <h3>Purchases</h3>

            {dayDetail?.purchases.map((purchase) => (
              <div key={purchase.id} className="list-card">
                <div className="row-between">
                  <strong>{purchase.store || 'No store'}</strong>
                  <div className="actions">
                    <span>
                      {formatCurrency(
                        purchase.items.reduce((sum, item) => sum + Number(item.total_price), 0)
                      )}
                    </span>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => startEditPurchase(purchase)}
                    >
                      Edit
                    </button>
                  </div>
                </div>

                {purchase.note ? <div className="muted">{purchase.note}</div> : null}

                <div className="muted">
                  {purchase.items
                    .map((item) => `${item.product_name} (${item.quantity})`)
                    .join(', ')}
                </div>
              </div>
            ))}

            {!dayDetail?.purchases.length ? <p>No purchases yet.</p> : null}
          </section>

          <section>
            <h3>Meals cooked / eaten</h3>

            {dayDetail?.meals.map((meal) => (
              <div key={meal.id} className="list-card">
                <div className="row-between">
                  <strong>{meal.name_snapshot}</strong>
                  <div className="actions">
                    <span className="muted">{meal.category_snapshot}</span>
                    <button
                      type="button"
                      className="secondary"
                      onClick={() => startEditMeal(meal)}
                    >
                      Edit
                    </button>
                  </div>
                </div>

                {meal.note ? <div className="muted">{meal.note}</div> : null}

                <div className="muted">
                  {meal.ingredients
                    .map((ingredient) => `${ingredient.product_name} (${ingredient.quantity})`)
                    .join(', ')}
                </div>
              </div>
            ))}

            {!dayDetail?.meals.length ? <p>No meals logged yet.</p> : null}
          </section>
        </div>
      </Card>
    </>
  );
}
