'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';
import { Card } from '@/components/Card';
import { api, Category, Product, Unit } from '@/lib/api';

export default function ManagePage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [units, setUnits] = useState<Unit[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [editingProductId, setEditingProductId] = useState<number | null>(null);
  const [newProduct, setNewProduct] = useState({ name: '', unit: 'unit', category: 'general', notes: '' });

  const [newCategoryName, setNewCategoryName] = useState('');
  const [editingCategoryId, setEditingCategoryId] = useState<number | null>(null);
  const [editingCategoryName, setEditingCategoryName] = useState('');

  const [newUnitName, setNewUnitName] = useState('');
  const [editingUnitId, setEditingUnitId] = useState<number | null>(null);
  const [editingUnitName, setEditingUnitName] = useState('');

  async function loadData() {
    const [productsData, categoriesData, unitsData] = await Promise.all([
      api.getProducts(),
      api.getCategories(),
      api.getUnits()
    ]);
    setProducts(productsData);
    setCategories(categoriesData);
    setUnits(unitsData);
  }

  useEffect(() => {
    loadData().catch((err) => setError(err.message));
  }, []);

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

  function resetMessages() {
    setMessage(null);
    setError(null);
  }

  function resetProductForm() {
    setEditingProductId(null);
    setNewProduct({
      name: '',
      unit: unitOptions[0] || 'unit',
      category: productCategoryOptions[0] || 'general',
      notes: ''
    });
  }

  async function handleCreateOrUpdateProduct(e: FormEvent) {
    e.preventDefault();
    resetMessages();
    try {
      if (editingProductId) {
        await api.updateProduct(editingProductId, newProduct);
        setMessage('Product updated.');
      } else {
        await api.createProduct(newProduct);
        setMessage('Product created.');
      }
      await loadData();
      resetProductForm();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save product');
    }
  }

  async function handleCreateCategory(e: FormEvent) {
    e.preventDefault();
    resetMessages();
    try {
      await api.createCategory({ name: newCategoryName });
      setNewCategoryName('');
      await loadData();
      setMessage('Category created.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create category');
    }
  }

  async function handleUpdateCategory(categoryId: number) {
    resetMessages();
    try {
      await api.updateCategory(categoryId, { name: editingCategoryName });
      setEditingCategoryId(null);
      setEditingCategoryName('');
      await loadData();
      setMessage('Category updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update category');
    }
  }

  async function handleCreateUnit(e: FormEvent) {
    e.preventDefault();
    resetMessages();
    try {
      await api.createUnit({ name: newUnitName });
      setNewUnitName('');
      await loadData();
      setMessage('Unit created.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create unit');
    }
  }

  async function handleUpdateUnit(unitId: number) {
    resetMessages();
    try {
      await api.updateUnit(unitId, { name: editingUnitName });
      setEditingUnitId(null);
      setEditingUnitName('');
      await loadData();
      setMessage('Unit updated.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update unit');
    }
  }

  function startEditProduct(product: Product) {
    setEditingProductId(product.id);
    setNewProduct({
      name: product.name,
      unit: product.unit,
      category: product.category,
      notes: product.notes || ''
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  return (
    <main className="page">
      {message ? <div className="notice">{message}</div> : null}
      {error ? <div className="error">{error}</div> : null}

      <div className="page-grid">
        <div className="page">
          <Card>
            <h2>{editingProductId ? 'Edit product' : 'Add product'}</h2>
            <p className="muted small">Manage reusable products, their units, and categories.</p>
            <form onSubmit={handleCreateOrUpdateProduct}>
              <div className="form-grid">
                <div className="form-field">
                  <label>Name</label>
                  <input
                    className="input"
                    value={newProduct.name}
                    onChange={(e) => setNewProduct({ ...newProduct, name: e.target.value })}
                  />
                </div>
                <div className="form-field">
                  <label>Unit</label>
                  <select
                    className="select"
                    value={newProduct.unit}
                    onChange={(e) => setNewProduct({ ...newProduct, unit: e.target.value })}
                  >
                    {unitOptions.map((unit) => (
                      <option key={unit} value={unit}>
                        {unit}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label>Category</label>
                  <select
                    className="select"
                    value={newProduct.category}
                    onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                  >
                    {productCategoryOptions.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-field">
                  <label>Notes</label>
                  <input
                    className="input"
                    value={newProduct.notes}
                    onChange={(e) => setNewProduct({ ...newProduct, notes: e.target.value })}
                  />
                </div>
              </div>
              <div className="actions">
                <button className="button success" type="submit">
                  {editingProductId ? 'Update product' : 'Create product'}
                </button>
                {editingProductId ? (
                  <button className="button secondary" type="button" onClick={resetProductForm}>
                    Cancel edit
                  </button>
                ) : null}
              </div>
            </form>

            <div className="list" style={{ marginTop: 16 }}>
              {products.map((product) => (
                <div className="list-item" key={product.id}>
                  <div className="list-row">
                    <div>
                      <strong>{product.name}</strong>
                      <div className="muted small">
                        {product.unit} · {product.category}
                      </div>
                    </div>
                    <button className="button secondary" type="button" onClick={() => startEditProduct(product)}>
                      Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>

        <div className="page">
          <Card>
            <h2>Categories</h2>
            <form onSubmit={handleCreateCategory}>
              <div className="form-grid">
                <div className="form-field">
                  <label>New category</label>
                  <input className="input" value={newCategoryName} onChange={(e) => setNewCategoryName(e.target.value)} />
                </div>
              </div>
              <div className="actions">
                <button className="button success" type="submit">
                  Add category
                </button>
              </div>
            </form>
            <div className="list" style={{ marginTop: 16 }}>
              {categories.map((category) => (
                <div className="list-item" key={category.id}>
                  {editingCategoryId === category.id ? (
                    <div className="form-grid">
                      <div className="form-field">
                        <label>Category name</label>
                        <input
                          className="input"
                          value={editingCategoryName}
                          onChange={(e) => setEditingCategoryName(e.target.value)}
                        />
                      </div>
                      <div className="actions" style={{ alignItems: 'end' }}>
                        <button className="button success" type="button" onClick={() => handleUpdateCategory(category.id)}>
                          Save
                        </button>
                        <button
                          className="button secondary"
                          type="button"
                          onClick={() => {
                            setEditingCategoryId(null);
                            setEditingCategoryName('');
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="list-row">
                      <strong>{category.name}</strong>
                      <button
                        className="button secondary"
                        type="button"
                        onClick={() => {
                          setEditingCategoryId(category.id);
                          setEditingCategoryName(category.name);
                        }}
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>

          <Card>
            <h2>Units</h2>
            <p className="muted small">Examples: unit, kg, g, liter, ml, bag, scoop.</p>
            <form onSubmit={handleCreateUnit}>
              <div className="form-grid">
                <div className="form-field">
                  <label>New unit</label>
                  <input className="input" value={newUnitName} onChange={(e) => setNewUnitName(e.target.value)} />
                </div>
              </div>
              <div className="actions">
                <button className="button success" type="submit">
                  Add unit
                </button>
              </div>
            </form>
            <div className="list" style={{ marginTop: 16 }}>
              {units.map((unit) => (
                <div className="list-item" key={unit.id}>
                  {editingUnitId === unit.id ? (
                    <div className="form-grid">
                      <div className="form-field">
                        <label>Unit name</label>
                        <input className="input" value={editingUnitName} onChange={(e) => setEditingUnitName(e.target.value)} />
                      </div>
                      <div className="actions" style={{ alignItems: 'end' }}>
                        <button className="button success" type="button" onClick={() => handleUpdateUnit(unit.id)}>
                          Save
                        </button>
                        <button
                          className="button secondary"
                          type="button"
                          onClick={() => {
                            setEditingUnitId(null);
                            setEditingUnitName('');
                          }}
                        >
                          Cancel
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div className="list-row">
                      <strong>{unit.name}</strong>
                      <button
                        className="button secondary"
                        type="button"
                        onClick={() => {
                          setEditingUnitId(unit.id);
                          setEditingUnitName(unit.name);
                        }}
                      >
                        Edit
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Card>
        </div>
      </div>
    </main>
  );
}
