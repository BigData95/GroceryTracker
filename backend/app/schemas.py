from __future__ import annotations

from datetime import date
from decimal import Decimal
from typing import Optional

from pydantic import BaseModel, ConfigDict, Field


class CategoryCreate(BaseModel):
    name: str


class CategoryRead(CategoryCreate):
    id: int
    model_config = ConfigDict(from_attributes=True)




class UnitCreate(BaseModel):
    name: str


class UnitRead(UnitCreate):
    id: int
    model_config = ConfigDict(from_attributes=True)


class ProductCreate(BaseModel):
    name: str
    unit: str = "unit"
    category: str = "general"
    notes: Optional[str] = None


class ProductRead(ProductCreate):
    id: int
    last_unit_price: Optional[Decimal] = None
    model_config = ConfigDict(from_attributes=True)


class DishIngredientInput(BaseModel):
    product_id: Optional[int] = None
    product_name: Optional[str] = None
    quantity: Decimal = Decimal("1")
    optional: bool = False


class DishCreate(BaseModel):
    name: str
    category: str = "dinner"
    notes: Optional[str] = None
    ingredients: list[DishIngredientInput] = Field(default_factory=list)


class DishIngredientRead(BaseModel):
    id: int
    product_id: int
    product_name: str
    quantity: Decimal
    optional: bool


class DishRead(BaseModel):
    id: int
    name: str
    category: str
    notes: Optional[str]
    ingredients: list[DishIngredientRead]


class PurchaseItemInput(BaseModel):
    product_id: Optional[int] = None
    product_name: Optional[str] = None
    quantity: Decimal = Decimal("1")
    unit_price: Decimal = Decimal("0")
    total_price: Decimal = Decimal("0")
    unit: Optional[str] = None
    category: Optional[str] = None


class PurchaseCreate(BaseModel):
    purchased_on: date
    store: Optional[str] = None
    note: Optional[str] = None
    items: list[PurchaseItemInput]


class PurchaseItemRead(BaseModel):
    id: int
    product_id: int
    product_name: str
    quantity: Decimal
    unit_price: Decimal
    total_price: Decimal


class PurchaseRead(BaseModel):
    id: int
    purchased_on: date
    store: Optional[str]
    note: Optional[str]
    items: list[PurchaseItemRead]


class MealIngredientInput(BaseModel):
    product_id: Optional[int] = None
    product_name: Optional[str] = None
    quantity: Decimal = Decimal("1")


class MealCreate(BaseModel):
    occurred_on: date
    dish_id: Optional[int] = None
    name_snapshot: Optional[str] = None
    category_snapshot: Optional[str] = None
    note: Optional[str] = None
    ingredients: list[MealIngredientInput]


class MealIngredientRead(BaseModel):
    id: int
    product_id: int
    product_name: str
    quantity: Decimal


class MealRead(BaseModel):
    id: int
    occurred_on: date
    dish_id: Optional[int]
    name_snapshot: str
    category_snapshot: str
    note: Optional[str]
    ingredients: list[MealIngredientRead]


class ProductEventCreate(BaseModel):
    occurred_on: date
    event_type: str
    quantity: Optional[Decimal] = None
    note: Optional[str] = None


class DayNoteInput(BaseModel):
    note: str


class CalendarDaySummary(BaseModel):
    day: date
    total_spend: Decimal
    purchases_count: int
    meals_count: int
    ran_out_count: int
    occasion_count: int
    bike_nutrition_count: int


class DayDetail(BaseModel):
    day: date
    total_spend: Decimal
    purchases: list[PurchaseRead]
    items_bought: list[PurchaseItemRead]
    meals: list[MealRead]
    ingredients_used: list[MealIngredientRead]
    products_opened: list[str]
    products_finished: list[str]
    note: Optional[str]


class PantryRecentPurchase(BaseModel):
    day: date
    store: Optional[str]
    quantity: Decimal
    total_price: Decimal


class PantryProductSummary(BaseModel):
    product_id: int
    product_name: str
    unit: str
    category: str
    current_stock: Decimal
    last_purchase_date: Optional[date]
    average_duration_days: Optional[float]
    average_monthly_spend: Decimal
    average_price: Optional[Decimal]
    recent_purchases: list[PantryRecentPurchase]
    related_dishes: list[str]
    quantity_bought_this_month: Decimal
    spend_this_month: Decimal
    is_open: bool
    last_opened_on: Optional[date]
    last_finished_on: Optional[date]
    status_label: str
    can_open: bool
    can_finish_remaining: bool


class SpendByCategory(BaseModel):
    category: str
    total_spend: Decimal


class PurchasedItemReport(BaseModel):
    product_name: str
    purchases_count: int
    quantity: Decimal
    spend: Decimal


class DishCountReport(BaseModel):
    dish_name: str
    count: int


class FastRunoutItem(BaseModel):
    product_name: str
    average_duration_days: float


class UnusualFrequencyItem(BaseModel):
    product_name: str
    this_month_count: int
    average_monthly_count: float


class IngredientUsageReport(BaseModel):
    product_name: str
    used_times: int
    total_quantity: Decimal
    dishes: list[str]


class MonthlyReport(BaseModel):
    month: str
    total_grocery_spend: Decimal
    spend_by_category: list[SpendByCategory]
    most_purchased_items: list[PurchasedItemReport]
    dishes_count: list[DishCountReport]
    occasions_count: int
    average_dinner_variety: float
    items_ran_out_fastest: list[FastRunoutItem]
    items_bought_unusually_often: list[UnusualFrequencyItem]
    most_used_ingredients: list[IngredientUsageReport]
