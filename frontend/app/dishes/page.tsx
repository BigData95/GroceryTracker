'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/Card';
import { api, Dish, DishIngredient, Product } from '@/lib/api';

type IngredientRow = DishIngredient & {
  rowId: string;
};

function makeRowId() {
  return Math.random().toString(36).slice(2, 10);
}

function emptyIngredient(): IngredientRow {
  return {
    rowId: makeRowId(),
    product_id: null,
    product_name: '',
    quantity: 1,
    optional: false,
  };
}

export default function DishesPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [selectedDishId, setSelectedDishId] = useState('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('dinner');
  const [notes, setNotes] = useState('');
  const [ingredients, setIngredients] = useState<IngredientRow[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    try {
      const [productsData, dishesData] = await Promise.all([
        api.getProducts(),
        api.getDishes(),
      ]);

      setProducts(productsData);
      setDishes(dishesData);
      setIngredients((current) => (current.length ? current : [emptyIngredient()]));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load dishes');
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  const selectedDish = useMemo(
    () => dishes.find((dish) => dish.id === Number(selectedDishId)),
    [dishes, selectedDishId]
  );

  useEffect(() => {
    if (!selectedDish) return;

    setName(selectedDish.name);
    setCategory(selectedDish.category);
    setNotes(selectedDish.notes || '');
    setIngredients(
      selectedDish.ingredients.map((ingredient) => ({
        rowId: makeRowId(),
        product_id: ingredient.product_id ?? null,
        product_name: ingredient.product_name || '',
        quantity: Number(ingredient.quantity),
        optional: ingredient.optional,
      }))
    );
  }, [selectedDish]);

  function resetForm() {
    setSelectedDishId('');
    setName('');
    setCategory('dinner');
    setNotes('');
    setIngredients([emptyIngredient()]);
  }

  function updateIngredient(index: number, patch: Partial<IngredientRow>) {
    setIngredients((current) =>
      current.map((ingredient, idx) =>
        idx === index ? { ...ingredient, ...patch } : ingredient
      )
    );
  }

  function updateIngredientProduct(index: number, value: string) {
    const trimmed = value.trim();
    const match = products.find(
      (product) => product.name.toLowerCase() === trimmed.toLowerCase()
    );

    updateIngredient(index, {
      product_name: value,
      product_id: match?.id || null,
    });
  }

  function removeIngredient(index: number) {
    setIngredients((current) => {
      const next = current.filter((_, idx) => idx !== index);
      return next.length ? next : [emptyIngredient()];
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    try {
      const payload = {
        name,
        category,
        notes,
        ingredients: ingredients
          .filter((ingredient) => ingredient.product_id || ingredient.product_name?.trim())
          .map(({ rowId, ...ingredient }) => ingredient),
      };

      if (selectedDishId) {
        await api.updateDish(Number(selectedDishId), payload);
        setMessage('Dish updated.');
      } else {
        await api.createDish(payload);
        setMessage('Dish created.');
      }

      await loadData();
      resetForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save dish');
    }
  }

  return (
    <>
      {message ? <div className="alert alert-success">{message}</div> : null}
      {error ? <div className="alert alert-error">{error}</div> : null}

      <datalist id="dish-products">
        {products.map((product) => (
          <option key={product.id} value={product.name} />
        ))}
      </datalist>

      <Card>
        <h2>Dish editor / cookbook</h2>
        <p>
          Fixed consumption lives here too. Example: Movie Night can deduct 1 popcorn
          bag and 1 Doritos bag by default.
        </p>

        <form className="form-grid" onSubmit={handleSubmit}>
          <label>
            <span>Load existing dish</span>
            <select
              value={selectedDishId}
              onChange={(e) => setSelectedDishId(e.target.value)}
            >
              <option value="">New dish</option>
              {dishes.map((dish) => (
                <option key={dish.id} value={dish.id}>
                  {dish.name}
                </option>
              ))}
            </select>
          </label>

          <label>
            <span>Dish name</span>
            <input value={name} onChange={(e) => setName(e.target.value)} required />
          </label>

          <label>
            <span>Category</span>
            <select value={category} onChange={(e) => setCategory(e.target.value)}>
              {['breakfast', 'dinner', 'snack', 'bike_nutrition', 'occasion'].map(
                (entry) => (
                  <option key={entry} value={entry}>
                    {entry}
                  </option>
                )
              )}
            </select>
          </label>

          <label className="span-2">
            <span>Notes</span>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)} />
          </label>

          <div className="span-2">
            <h3>Ingredients</h3>

            {ingredients.map((ingredient, index) => {
              const product = ingredient.product_id
                ? products.find((entry) => entry.id === ingredient.product_id)
                : products.find(
                    (entry) =>
                      entry.name.toLowerCase() ===
                      (ingredient.product_name || '').trim().toLowerCase()
                  );

              const ingredientName = ingredient.product_name || product?.name || '';

              return (
                <div className="ingredient-row" key={ingredient.rowId}>
                  <label>
                    <span>Ingredient</span>
                    <input
                      list="dish-products"
                      value={ingredientName}
                      onChange={(e) =>
                        updateIngredientProduct(index, e.target.value)
                      }
                      placeholder="Type to autocomplete"
                    />
                  </label>

                  <label>
                    <span>Quantity ({product?.unit || 'unit'})</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={ingredient.quantity}
                      onChange={(e) =>
                        updateIngredient(index, {
                          quantity: Number(e.target.value),
                        })
                      }
                    />
                  </label>

                  <label>
                    <span>Optional</span>
                    <select
                      value={ingredient.optional ? 'yes' : 'no'}
                      onChange={(e) =>
                        updateIngredient(index, {
                          optional: e.target.value === 'yes',
                        })
                      }
                    >
                      <option value="no">Required</option>
                      <option value="yes">Optional</option>
                    </select>
                  </label>

                  <div className="ingredient-row-actions">
                    {!ingredient.product_id && ingredientName.trim() ? (
                      <small>New ingredient will be created</small>
                    ) : (
                      <span />
                    )}

                    <button
                      type="button"
                      className="secondary"
                      onClick={() => removeIngredient(index)}
                    >
                      Remove ingredient
                    </button>
                  </div>
                </div>
              );
            })}

            <button
              type="button"
              className="secondary"
              onClick={() =>
                setIngredients((current) => [...current, emptyIngredient()])
              }
            >
              Add ingredient
            </button>
          </div>

          <div className="actions span-2">
            <button type="submit">
              {selectedDishId ? 'Update dish' : 'Create dish'}
            </button>
            <button type="button" className="secondary" onClick={resetForm}>
              Reset form
            </button>
          </div>
        </form>
      </Card>

      <Card>
        <h2>Saved dishes</h2>

        <div className="stack">
          {dishes.map((dish) => (
            <div key={dish.id} className="list-card">
              <strong>
                {dish.name} <span className="muted">· {dish.category}</span>
              </strong>

              <div className="muted">
                {dish.ingredients
                  .map(
                    (ingredient) =>
                      `${ingredient.product_name} (${ingredient.quantity}${
                        ingredient.optional ? ', optional' : ''
                      })`
                  )
                  .join(', ')}
              </div>

              {dish.notes ? <div className="muted">{dish.notes}</div> : null}
            </div>
          ))}
        </div>
      </Card>
    </>
  );
}
