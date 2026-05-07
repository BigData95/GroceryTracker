export const API_BASE_URL = '/api';

export type Category = {
  id: number;
  name: string;
};

export type Unit = {
  id: number;
  name: string;
};

export type Product = {
  id: number;
  name: string;
  unit: string;
  category: string;
  notes?: string | null;
  last_unit_price?: number | null;
};

export type DishIngredient = {
  id?: number;
  product_id?: number | null;
  product_name?: string;
  quantity: number;
  optional: boolean;
};

export type Dish = {
  id: number;
  name: string;
  category: string;
  notes?: string | null;
  ingredients: DishIngredient[];
};

export type PurchaseItem = {
  id?: number;
  product_id?: number | null;
  product_name?: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  unit?: string;
  category?: string;
};

export type Purchase = {
  id: number;
  purchased_on: string;
  store?: string | null;
  note?: string | null;
  items: PurchaseItem[];
};

export type MealIngredient = {
  id?: number;
  product_id?: number | null;
  product_name?: string;
  quantity: number;
};

export type Meal = {
  id: number;
  occurred_on: string;
  dish_id?: number | null;
  name_snapshot: string;
  category_snapshot: string;
  note?: string | null;
  ingredients: MealIngredient[];
};

export type DayDetail = {
  day: string;
  total_spend: number;
  purchases: Purchase[];
  items_bought: PurchaseItem[];
  meals: Meal[];
  ingredients_used: MealIngredient[];
  products_opened: string[];
  products_finished: string[];
  note?: string | null;
};

export type CalendarDay = {
  day: string;
  total_spend: number;
  purchases_count: number;
  meals_count: number;
  ran_out_count: number;
  occasion_count: number;
  bike_nutrition_count: number;
};

export type PantryRecentPurchase = {
  day: string;
  store?: string | null;
  quantity: number;
  total_price: number;
};

export type PantryProduct = {
  product_id: number;
  product_name: string;
  unit: string;
  category: string;
  current_stock: number;
  last_purchase_date?: string | null;
  average_duration_days?: number | null;
  average_monthly_spend: number;
  average_price?: number | null;
  recent_purchases: PantryRecentPurchase[];
  related_dishes: string[];
  quantity_bought_this_month: number;
  spend_this_month: number;
  is_open: boolean;
  last_opened_on?: string | null;
  last_finished_on?: string | null;
  status_label: string;
  can_open: boolean;
  can_finish_remaining: boolean;
};

export type MonthlyReport = {
  month: string;
  total_grocery_spend: number;
  spend_by_category: { category: string; total_spend: number }[];
  most_purchased_items: {
    product_name: string;
    purchases_count: number;
    quantity: number;
    spend: number;
  }[];
  dishes_count: { dish_name: string; count: number }[];
  occasions_count: number;
  average_dinner_variety: number;
  items_ran_out_fastest: { product_name: string; average_duration_days: number }[];
  items_bought_unusually_often: {
    product_name: string;
    this_month_count: number;
    average_monthly_count: number;
  }[];
  most_used_ingredients: {
    product_name: string;
    used_times: number;
    total_quantity: number;
    dishes: string[];
  }[];
};

export type CategoriesMeta = {
  product_categories: string[];
  meal_categories: string[];
  units: string[];
};

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options?.headers || {})
    },
    cache: 'no-store'
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
  getMetaCategories: () => request<CategoriesMeta>('/meta/categories'),
  getCategories: () => request<Category[]>('/categories'),
  createCategory: (payload: { name: string }) =>
    request<Category>('/categories', { method: 'POST', body: JSON.stringify(payload) }),
  updateCategory: (categoryId: number, payload: { name: string }) =>
    request<Category>(`/categories/${categoryId}`, { method: 'PUT', body: JSON.stringify(payload) }),

  getUnits: () => request<Unit[]>('/units'),
  createUnit: (payload: { name: string }) =>
    request<Unit>('/units', { method: 'POST', body: JSON.stringify(payload) }),
  updateUnit: (unitId: number, payload: { name: string }) =>
    request<Unit>(`/units/${unitId}`, { method: 'PUT', body: JSON.stringify(payload) }),

  getProducts: () => request<Product[]>('/products'),
  createProduct: (payload: Omit<Product, 'id'>) =>
    request<Product>('/products', { method: 'POST', body: JSON.stringify(payload) }),
  updateProduct: (productId: number, payload: Omit<Product, 'id'>) =>
    request<Product>(`/products/${productId}`, { method: 'PUT', body: JSON.stringify(payload) }),

  getDishes: () => request<Dish[]>('/dishes'),
  createDish: (payload: Omit<Dish, 'id'>) =>
    request<Dish>('/dishes', { method: 'POST', body: JSON.stringify(payload) }),
  updateDish: (dishId: number, payload: Omit<Dish, 'id'>) =>
    request<Dish>(`/dishes/${dishId}`, { method: 'PUT', body: JSON.stringify(payload) }),

  createPurchase: (payload: {
    purchased_on: string;
    store?: string;
    note?: string;
    items: PurchaseItem[];
  }) => request<Purchase>('/purchases', { method: 'POST', body: JSON.stringify(payload) }),
  updatePurchase: (
    purchaseId: number,
    payload: { purchased_on: string; store?: string; note?: string; items: PurchaseItem[] }
  ) => request<Purchase>(`/purchases/${purchaseId}`, { method: 'PUT', body: JSON.stringify(payload) }),

  createMeal: (payload: {
    occurred_on: string;
    dish_id?: number | null;
    name_snapshot?: string;
    category_snapshot?: string;
    note?: string;
    ingredients: MealIngredient[];
  }) => request<Meal>('/meals', { method: 'POST', body: JSON.stringify(payload) }),
  updateMeal: (
    mealId: number,
    payload: {
      occurred_on: string;
      dish_id?: number | null;
      name_snapshot?: string;
      category_snapshot?: string;
      note?: string;
      ingredients: MealIngredient[];
    }
  ) => request<Meal>(`/meals/${mealId}`, { method: 'PUT', body: JSON.stringify(payload) }),

  getDayDetail: (day: string) => request<DayDetail>(`/days/${day}`),
  saveDayNote: (day: string, note: string) =>
    request(`/days/${day}/note`, { method: 'PUT', body: JSON.stringify({ note }) }),
  getCalendar: (month: string) => request<CalendarDay[]>(`/calendar?month=${month}`),
  getPantry: (referenceDate: string) => request<PantryProduct[]>(`/pantry?reference_date=${referenceDate}`),
  logProductEvent: (
    productId: number,
    payload: { occurred_on: string; event_type: string; quantity?: number; note?: string }
  ) => request(`/products/${productId}/events`, { method: 'POST', body: JSON.stringify(payload) }),
  getMonthlyReport: (month: string) => request<MonthlyReport>(`/reports/monthly?month=${month}`)
};

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

export function monthIso(day = new Date()) {
  return day.toISOString().slice(0, 7);
}

export function formatCurrency(value: number) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 2
  }).format(value || 0);
}

export function startOfMonthGrid(month: string) {
  const firstDay = new Date(`${month}-01T00:00:00`);
  return firstDay.getDay();
}

export function daysInMonth(month: string) {
  const [year, monthValue] = month.split('-').map(Number);
  return new Date(year, monthValue, 0).getDate();
}
