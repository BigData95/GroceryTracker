'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/Card';
import { api, Dish, DishIngredient, Product } from '@/lib/api';

function emptyIngredient(products: Product[]): DishIngredient {
  return {
    product_id: products[0]?.id || 0,
    quantity: 1,
    optional: false
  };
}

export default function DishesPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [dishes, setDishes] = useState<Dish[]>([]);
  const [selectedDishId, setSelectedDishId] = useState<number | ''>('');
  const [name, setName] = useState('');
  const [category, setCategory] = useState('dinner');
  const [notes, setNotes] = useState('');
  const [ingredients, setIngredients] = useState<DishIngredient[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function loadData() {
    try {
      const [productsData, dishesData] = await Promise.all([api.getProducts(), api.getDishes()]);
      setProducts(productsData);
      setDishes(dishesData);
      if (!ingredients.length) {
        setIngredients([emptyIngredient(productsData)]);
      }
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
        product_id: ingredient.product_id,
        quantity: Number(ingredient.quantity),
        optional: ingredient.optional
      }))
    );
  }, [selectedDish]);

  function resetForm() {
    setSelectedDishId('');
    setName('');
    setCategory('dinner');
    setNotes('');
    setIngredients([emptyIngredient(products)]);
  }

  function updateIngredient(index: number, patch: Partial<DishIngredient>) {
    setIngredients((current) =>
      current.map((ingredient, idx) =>
        idx === index ? { ...ingredient, ...patch } : ingredient
      )
    );
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
        ingredients: ingredients.filter((ingredient) => ingredient.product_id)
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
    <main className="page">
      {message ? <div className="notice">{message}</div> : null}
      {error ? <div className="error">{error}</div> : null}

      <div className="page-grid">
        <Card>
          <h2>Dish editor / cookbook</h2>
          <p className="muted small">
            Fixed consumption lives here too. Example: Movie Night can deduct 1 popcorn bag and 1 Doritos bag by default.
          </p>
          <form onSubmit={handleSubmit}>
            <div className="form-grid">
              <div className="form-field">
                <label>Load existing dish</label>
                <select
                  className="select"
                  value={selectedDishId}
                  onChange={(e) => setSelectedDishId(e.target.value ? Number(e.target.value) : '')}
                >
                  <option value="">New dish</option>
                  {dishes.map((dish) => (
                    <option key={dish.id} value={dish.id}>
                      {dish.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label>Dish name</label>
                <input className="input" value={name} onChange={(e) => setName(e.target.value)} />
              </div>
              <div className="form-field">
                <label>Category</label>
                <select className="select" value={category} onChange={(e) => setCategory(e.target.value)}>
                  {['breakfast', 'dinner', 'snack', 'bike_nutrition', 'occasion'].map((entry) => (
                    <option key={entry} value={entry}>
                      {entry}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-field">
                <label>Notes</label>
                <input className="input" value={notes} onChange={(e) => setNotes(e.target.value)} />
              </div>
            </div>

            <div className="list" style={{ marginTop: 12 }}>
              {ingredients.map((ingredient, index) => (
                <div className="list-item" key={index}>
                  <div className="form-grid three">
                    <div className="form-field">
                      <label>Ingredient</label>
                      <select
                        className="select"
                        value={ingredient.product_id}
                        onChange={(e) => updateIngredient(index, { product_id: Number(e.target.value) })}
                      >
                        {products.map((product) => (
                          <option key={product.id} value={product.id}>
                            {product.name}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="form-field">
                      <label>Quantity</label>
                      <input
                        className="input"
                        type="number"
                        step="0.01"
                        value={ingredient.quantity}
                        onChange={(e) => updateIngredient(index, { quantity: Number(e.target.value) })}
                      />
                    </div>
                    <div className="form-field">
                      <label>Optional</label>
                      <select
                        className="select"
                        value={ingredient.optional ? 'yes' : 'no'}
                        onChange={(e) => updateIngredient(index, { optional: e.target.value === 'yes' })}
                      >
                        <option value="no">Required</option>
                        <option value="yes">Optional</option>
                      </select>
                    </div>
                  </div>
                  <div className="actions">
                    <button
                      className="button danger"
                      type="button"
                      onClick={() =>
                        setIngredients((current) => current.filter((_, idx) => idx !== index))
                      }
                    >
                      Remove ingredient
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div className="actions">
              <button
                className="button secondary"
                type="button"
                onClick={() => setIngredients((current) => [...current, emptyIngredient(products)])}
              >
                Add ingredient
              </button>
              <button className="button" type="submit">
                {selectedDishId ? 'Update dish' : 'Create dish'}
              </button>
              <button className="button secondary" type="button" onClick={resetForm}>
                Reset form
              </button>
            </div>
          </form>
        </Card>

        <Card>
          <h2>Saved dishes</h2>
          <div className="list">
            {dishes.map((dish) => (
              <div className="list-item" key={dish.id}>
                <div className="list-row">
                  <strong>{dish.name}</strong>
                  <span className="pill">{dish.category}</span>
                </div>
                <div className="muted small">
                  {dish.ingredients
                    .map((ingredient) =>
                      `${ingredient.product_name} (${ingredient.quantity}${ingredient.optional ? ', optional' : ''})`
                    )
                    .join(', ')}
                </div>
                {dish.notes ? <div className="muted small">{dish.notes}</div> : null}
              </div>
            ))}
          </div>
        </Card>
      </div>
    </main>
  );
}
