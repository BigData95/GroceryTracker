from __future__ import annotations

import os
from collections import defaultdict
from datetime import date, timedelta
from decimal import Decimal, ROUND_HALF_UP
from statistics import mean
from typing import Optional

from fastapi import Depends, FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import func, select
from sqlalchemy.orm import Session, joinedload

from .db import Base, engine, get_db, session_scope
from .models import (
    Category,
    DayNote,
    Dish,
    DishIngredient,
    Meal,
    MealIngredient,
    Product,
    ProductEvent,
    Unit,
    Purchase,
    PurchaseItem,
)
from .schemas import (
    CalendarDaySummary,
    CategoryCreate,
    CategoryRead,
    DayDetail,
    DayNoteInput,
    DishCountReport,
    DishCreate,
    DishIngredientRead,
    DishRead,
    FastRunoutItem,
    IngredientUsageReport,
    MealCreate,
    MealIngredientRead,
    MealRead,
    MonthlyReport,
    PantryProductSummary,
    PantryRecentPurchase,
    ProductCreate,
    ProductEventCreate,
    UnitCreate,
    UnitRead,
    ProductRead,
    PurchaseCreate,
    PurchaseItemInput,
    PurchaseItemRead,
    PurchaseRead,
    PurchasedItemReport,
    SpendByCategory,
    UnusualFrequencyItem,
)

app = FastAPI(title="Grocery Tracker API")

origins = [o.strip() for o in os.getenv("CORS_ORIGINS", "http://localhost:3000").split(",") if o.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

PRODUCT_CATEGORY_DEFAULTS = [
    "general",
    "breakfast",
    "dinner",
    "snack",
    "bike_nutrition",
    "occasion",
]
MEAL_CATEGORY_OPTIONS = ["breakfast", "dinner", "snack", "bike_nutrition", "occasion"]
UNIT_DEFAULTS = ["unit", "kg", "g", "liter", "ml", "bag", "cup", "tbsp", "scoop"]


@app.on_event("startup")
def startup() -> None:
    Base.metadata.create_all(bind=engine)
    seed_initial_data()


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/meta/categories")
def get_categories_meta(db: Session = Depends(get_db)) -> dict:
    product_categories = db.scalars(select(Category.name).order_by(Category.name)).all()
    units = db.scalars(select(Unit.name).order_by(Unit.name)).all()
    return {"product_categories": list(product_categories), "meal_categories": MEAL_CATEGORY_OPTIONS, "units": list(units)}


@app.get("/categories", response_model=list[CategoryRead])
def list_categories(db: Session = Depends(get_db)):
    return db.scalars(select(Category).order_by(Category.name)).all()


@app.post("/categories", response_model=CategoryRead)
def create_category(payload: CategoryCreate, db: Session = Depends(get_db)):
    normalized = payload.name.strip()
    if not normalized:
        raise HTTPException(status_code=400, detail="Category name is required")
    existing = db.scalar(select(Category).where(func.lower(Category.name) == normalized.lower()))
    if existing:
        return existing
    category = Category(name=normalized)
    db.add(category)
    db.commit()
    db.refresh(category)
    return category


@app.put("/categories/{category_id}", response_model=CategoryRead)
def update_category(category_id: int, payload: CategoryCreate, db: Session = Depends(get_db)):
    category = db.get(Category, category_id)
    if not category:
        raise HTTPException(status_code=404, detail="Category not found")
    normalized = payload.name.strip()
    if not normalized:
        raise HTTPException(status_code=400, detail="Category name is required")
    duplicate = db.scalar(
        select(Category).where(func.lower(Category.name) == normalized.lower(), Category.id != category_id)
    )
    if duplicate:
        raise HTTPException(status_code=400, detail="Category already exists")
    old_name = category.name
    category.name = normalized
    for product in db.scalars(select(Product).where(Product.category == old_name)).all():
        product.category = normalized
    db.commit()
    db.refresh(category)
    return category


@app.get("/units", response_model=list[UnitRead])
def list_units(db: Session = Depends(get_db)):
    return db.scalars(select(Unit).order_by(Unit.name)).all()


@app.post("/units", response_model=UnitRead)
def create_unit(payload: UnitCreate, db: Session = Depends(get_db)):
    normalized = payload.name.strip()
    if not normalized:
        raise HTTPException(status_code=400, detail="Unit name is required")
    existing = db.scalar(select(Unit).where(func.lower(Unit.name) == normalized.lower()))
    if existing:
        return existing
    unit = Unit(name=normalized)
    db.add(unit)
    db.commit()
    db.refresh(unit)
    return unit


@app.put("/units/{unit_id}", response_model=UnitRead)
def update_unit(unit_id: int, payload: UnitCreate, db: Session = Depends(get_db)):
    unit = db.get(Unit, unit_id)
    if not unit:
        raise HTTPException(status_code=404, detail="Unit not found")
    normalized = payload.name.strip()
    if not normalized:
        raise HTTPException(status_code=400, detail="Unit name is required")
    duplicate = db.scalar(select(Unit).where(func.lower(Unit.name) == normalized.lower(), Unit.id != unit_id))
    if duplicate:
        raise HTTPException(status_code=400, detail="Unit already exists")
    old_name = unit.name
    unit.name = normalized
    for product in db.scalars(select(Product).where(Product.unit == old_name)).all():
        product.unit = normalized
    db.commit()
    db.refresh(unit)
    return unit


@app.get("/products", response_model=list[ProductRead])
def list_products(db: Session = Depends(get_db)):
    products = db.scalars(select(Product).order_by(Product.name)).all()
    return [serialize_product(db, product) for product in products]


@app.post("/products", response_model=ProductRead)
def create_product(payload: ProductCreate, db: Session = Depends(get_db)):
    product = upsert_product_by_name(db, payload.name, payload.unit, payload.category, payload.notes)
    db.commit()
    db.refresh(product)
    return serialize_product(db, product)


@app.put("/products/{product_id}", response_model=ProductRead)
def update_product(product_id: int, payload: ProductCreate, db: Session = Depends(get_db)):
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    duplicate = db.scalar(
        select(Product).where(func.lower(Product.name) == payload.name.strip().lower(), Product.id != product_id)
    )
    if duplicate:
        raise HTTPException(status_code=400, detail="Another product already uses that name")
    product.name = payload.name.strip()
    product.unit = (payload.unit or "unit").strip()
    product.category = (payload.category or "general").strip()
    product.notes = payload.notes
    ensure_unit_exists(db, product.unit)
    ensure_category_exists(db, product.category)
    db.commit()
    db.refresh(product)
    return serialize_product(db, product)


@app.get("/dishes", response_model=list[DishRead])
def list_dishes(db: Session = Depends(get_db)):
    dishes = db.scalars(
        select(Dish).options(joinedload(Dish.ingredients).joinedload(DishIngredient.product)).order_by(Dish.name)
    ).unique().all()
    return [serialize_dish(dish) for dish in dishes]


@app.post("/dishes", response_model=DishRead)
def create_dish(payload: DishCreate, db: Session = Depends(get_db)):
    existing = db.scalar(select(Dish).where(func.lower(Dish.name) == payload.name.strip().lower()))
    if existing:
        raise HTTPException(status_code=400, detail="Dish already exists")
    dish = Dish(name=payload.name.strip(), category=payload.category, notes=payload.notes)
    db.add(dish)
    db.flush()
    _replace_dish_ingredients(db, dish, payload.ingredients)
    db.commit()
    refreshed = db.scalar(
        select(Dish).options(joinedload(Dish.ingredients).joinedload(DishIngredient.product)).where(Dish.id == dish.id)
    )
    return serialize_dish(refreshed)


@app.put("/dishes/{dish_id}", response_model=DishRead)
def update_dish(dish_id: int, payload: DishCreate, db: Session = Depends(get_db)):
    dish = db.get(Dish, dish_id)
    if not dish:
        raise HTTPException(status_code=404, detail="Dish not found")
    dish.name = payload.name.strip()
    dish.category = payload.category
    dish.notes = payload.notes
    _replace_dish_ingredients(db, dish, payload.ingredients)
    db.commit()
    refreshed = db.scalar(
        select(Dish).options(joinedload(Dish.ingredients).joinedload(DishIngredient.product)).where(Dish.id == dish.id)
    )
    return serialize_dish(refreshed)


@app.post("/purchases", response_model=PurchaseRead)
def create_purchase(payload: PurchaseCreate, db: Session = Depends(get_db)):
    purchase = Purchase(purchased_on=payload.purchased_on, store=payload.store, note=payload.note)
    db.add(purchase)
    db.flush()
    replace_purchase_items(db, purchase, payload.items)
    db.commit()
    created = db.scalar(
        select(Purchase)
        .options(joinedload(Purchase.items).joinedload(PurchaseItem.product))
        .where(Purchase.id == purchase.id)
    )
    return serialize_purchase(created)


@app.put("/purchases/{purchase_id}", response_model=PurchaseRead)
def update_purchase(purchase_id: int, payload: PurchaseCreate, db: Session = Depends(get_db)):
    purchase = db.scalar(
        select(Purchase).options(joinedload(Purchase.items)).where(Purchase.id == purchase_id)
    )
    if not purchase:
        raise HTTPException(status_code=404, detail="Purchase not found")
    purchase.purchased_on = payload.purchased_on
    purchase.store = payload.store
    purchase.note = payload.note
    clear_purchase_items(db, purchase)
    replace_purchase_items(db, purchase, payload.items)
    db.commit()
    updated = db.scalar(
        select(Purchase)
        .options(joinedload(Purchase.items).joinedload(PurchaseItem.product))
        .where(Purchase.id == purchase.id)
    )
    return serialize_purchase(updated)


@app.post("/meals", response_model=MealRead)
def create_meal(payload: MealCreate, db: Session = Depends(get_db)):
    meal = Meal(
        occurred_on=payload.occurred_on,
        dish_id=payload.dish_id,
        name_snapshot=(payload.name_snapshot or "Custom meal").strip(),
        category_snapshot=(payload.category_snapshot or "dinner").strip(),
        note=payload.note,
    )
    db.add(meal)
    db.flush()
    replace_meal_ingredients(db, meal, payload.ingredients)
    db.commit()
    created = db.scalar(
        select(Meal)
        .options(joinedload(Meal.ingredients).joinedload(MealIngredient.product))
        .where(Meal.id == meal.id)
    )
    return serialize_meal(created)


@app.put("/meals/{meal_id}", response_model=MealRead)
def update_meal(meal_id: int, payload: MealCreate, db: Session = Depends(get_db)):
    meal = db.scalar(select(Meal).options(joinedload(Meal.ingredients)).where(Meal.id == meal_id))
    if not meal:
        raise HTTPException(status_code=404, detail="Meal not found")
    meal.occurred_on = payload.occurred_on
    meal.dish_id = payload.dish_id
    meal.name_snapshot = (payload.name_snapshot or meal.name_snapshot or "Custom meal").strip()
    meal.category_snapshot = (payload.category_snapshot or meal.category_snapshot or "dinner").strip()
    meal.note = payload.note
    clear_meal_ingredients(db, meal)
    replace_meal_ingredients(db, meal, payload.ingredients)
    db.commit()
    updated = db.scalar(
        select(Meal)
        .options(joinedload(Meal.ingredients).joinedload(MealIngredient.product))
        .where(Meal.id == meal.id)
    )
    return serialize_meal(updated)


@app.post("/products/{product_id}/events")
def log_product_event(product_id: int, payload: ProductEventCreate, db: Session = Depends(get_db)):
    product = db.get(Product, product_id)
    if not product:
        raise HTTPException(status_code=404, detail="Product not found")
    if payload.event_type not in {"open", "finish", "adjust"}:
        raise HTTPException(status_code=400, detail="Unsupported event type")

    state = get_product_state(db, product_id, payload.occurred_on)
    quantity_delta = Decimal("0")
    if payload.event_type == "open":
        if state["current_stock"] <= 0:
            raise HTTPException(status_code=400, detail="You can only open products that are in stock")
        if state["is_open"]:
            raise HTTPException(status_code=400, detail="That product is already marked as open")
    elif payload.event_type == "finish":
        if not state["is_open"]:
            raise HTTPException(status_code=400, detail="You can only finish products that are currently open")
        current_stock = state["current_stock"]
        quantity_delta = -(payload.quantity if payload.quantity is not None else current_stock)
    elif payload.event_type == "adjust":
        if payload.quantity is None:
            raise HTTPException(status_code=400, detail="Quantity is required for adjustments")
        quantity_delta = payload.quantity

    event = ProductEvent(
        product_id=product_id,
        occurred_on=payload.occurred_on,
        event_type=payload.event_type,
        quantity_delta=quantity_delta,
        note=payload.note,
    )
    db.add(event)
    db.commit()
    return {"status": "ok"}


@app.get("/days/{day}", response_model=DayDetail)
def get_day_detail(day: date, db: Session = Depends(get_db)):
    purchases = db.scalars(
        select(Purchase)
        .options(joinedload(Purchase.items).joinedload(PurchaseItem.product))
        .where(Purchase.purchased_on == day)
        .order_by(Purchase.id.desc())
    ).unique().all()
    meals = db.scalars(
        select(Meal)
        .options(joinedload(Meal.ingredients).joinedload(MealIngredient.product))
        .where(Meal.occurred_on == day)
        .order_by(Meal.id.desc())
    ).unique().all()
    opened = db.scalars(
        select(Product.name)
        .join(ProductEvent, ProductEvent.product_id == Product.id)
        .where(ProductEvent.occurred_on == day, ProductEvent.event_type == "open")
        .order_by(Product.name)
    ).all()
    finished = db.scalars(
        select(Product.name)
        .join(ProductEvent, ProductEvent.product_id == Product.id)
        .where(ProductEvent.occurred_on == day, ProductEvent.event_type == "finish")
        .order_by(Product.name)
    ).all()
    note = db.scalar(select(DayNote.note).where(DayNote.day == day))

    purchase_payloads = [serialize_purchase(purchase) for purchase in purchases]
    items_bought = [item for purchase in purchase_payloads for item in purchase.items]
    meal_payloads = [serialize_meal(meal) for meal in meals]
    ingredients_used = [ingredient for meal in meal_payloads for ingredient in meal.ingredients]
    total_spend = sum((Decimal(item.total_price) for item in items_bought), Decimal("0"))

    return DayDetail(
        day=day,
        total_spend=total_spend,
        purchases=purchase_payloads,
        items_bought=items_bought,
        meals=meal_payloads,
        ingredients_used=ingredients_used,
        products_opened=opened,
        products_finished=finished,
        note=note,
    )


@app.put("/days/{day}/note")
def upsert_day_note(day: date, payload: DayNoteInput, db: Session = Depends(get_db)):
    note = db.scalar(select(DayNote).where(DayNote.day == day))
    if note:
        note.note = payload.note
    else:
        note = DayNote(day=day, note=payload.note)
        db.add(note)
    db.commit()
    return {"status": "ok"}


@app.get("/calendar", response_model=list[CalendarDaySummary])
def get_calendar_summary(month: str = Query(..., description="YYYY-MM"), db: Session = Depends(get_db)):
    start = date.fromisoformat(f"{month}-01")
    next_month = (start.replace(day=28) + timedelta(days=4)).replace(day=1)
    end = next_month - timedelta(days=1)

    purchase_rows = db.execute(
        select(
            Purchase.purchased_on,
            func.coalesce(func.sum(PurchaseItem.total_price), 0),
            func.count(func.distinct(Purchase.id)),
        )
        .join(PurchaseItem, PurchaseItem.purchase_id == Purchase.id)
        .where(Purchase.purchased_on >= start, Purchase.purchased_on < next_month)
        .group_by(Purchase.purchased_on)
    ).all()
    meal_rows = db.execute(
        select(Meal.occurred_on, func.count(Meal.id))
        .where(Meal.occurred_on >= start, Meal.occurred_on < next_month)
        .group_by(Meal.occurred_on)
    ).all()
    finish_rows = db.execute(
        select(ProductEvent.occurred_on, func.count(ProductEvent.id))
        .where(
            ProductEvent.occurred_on >= start,
            ProductEvent.occurred_on < next_month,
            ProductEvent.event_type == "finish",
        )
        .group_by(ProductEvent.occurred_on)
    ).all()
    occasion_rows = db.execute(
        select(Meal.occurred_on, func.count(Meal.id))
        .where(Meal.occurred_on >= start, Meal.occurred_on < next_month, Meal.category_snapshot == "occasion")
        .group_by(Meal.occurred_on)
    ).all()
    bike_rows = db.execute(
        select(Meal.occurred_on, func.count(Meal.id))
        .where(Meal.occurred_on >= start, Meal.occurred_on < next_month, Meal.category_snapshot == "bike_nutrition")
        .group_by(Meal.occurred_on)
    ).all()

    spend_by_day = {row[0]: Decimal(row[1]) for row in purchase_rows}
    purchases_count = {row[0]: int(row[2]) for row in purchase_rows}
    meals_count = {row[0]: int(row[1]) for row in meal_rows}
    finish_count = {row[0]: int(row[1]) for row in finish_rows}
    occasion_count = {row[0]: int(row[1]) for row in occasion_rows}
    bike_count = {row[0]: int(row[1]) for row in bike_rows}

    summaries = []
    current = start
    while current <= end:
        summaries.append(
            CalendarDaySummary(
                day=current,
                total_spend=spend_by_day.get(current, Decimal("0")),
                purchases_count=purchases_count.get(current, 0),
                meals_count=meals_count.get(current, 0),
                ran_out_count=finish_count.get(current, 0),
                occasion_count=occasion_count.get(current, 0),
                bike_nutrition_count=bike_count.get(current, 0),
            )
        )
        current += timedelta(days=1)
    return summaries


@app.get("/pantry", response_model=list[PantryProductSummary])
def pantry_summary(reference_date: Optional[date] = None, db: Session = Depends(get_db)):
    reference_date = reference_date or date.today()
    month_start = reference_date.replace(day=1)
    products = db.scalars(select(Product).order_by(Product.name)).all()
    summaries = []

    for product in products:
        current_stock = get_current_stock(db, product.id, reference_date)
        purchase_items = db.execute(
            select(PurchaseItem, Purchase)
            .join(Purchase, Purchase.id == PurchaseItem.purchase_id)
            .where(PurchaseItem.product_id == product.id, Purchase.purchased_on <= reference_date)
            .order_by(Purchase.purchased_on.desc(), PurchaseItem.id.desc())
        ).all()
        purchase_dates = [row[1].purchased_on for row in purchase_items]
        last_purchase_date = purchase_dates[0] if purchase_dates else None
        recent_purchases = [
            PantryRecentPurchase(
                day=row[1].purchased_on,
                store=row[1].store,
                quantity=row[0].quantity,
                total_price=row[0].total_price,
            )
            for row in purchase_items[:5]
        ]
        related_dishes = db.scalars(
            select(Dish.name)
            .join(DishIngredient, DishIngredient.dish_id == Dish.id)
            .where(DishIngredient.product_id == product.id)
            .order_by(Dish.name)
        ).all()
        quantity_bought_this_month = db.scalar(
            select(func.coalesce(func.sum(PurchaseItem.quantity), 0))
            .join(Purchase, Purchase.id == PurchaseItem.purchase_id)
            .where(
                PurchaseItem.product_id == product.id,
                Purchase.purchased_on >= month_start,
                Purchase.purchased_on <= reference_date,
            )
        ) or Decimal("0")
        spend_this_month = db.scalar(
            select(func.coalesce(func.sum(PurchaseItem.total_price), 0))
            .join(Purchase, Purchase.id == PurchaseItem.purchase_id)
            .where(
                PurchaseItem.product_id == product.id,
                Purchase.purchased_on >= month_start,
                Purchase.purchased_on <= reference_date,
            )
        ) or Decimal("0")
        state = get_product_state(db, product.id, reference_date, current_stock=current_stock)

        summaries.append(
            PantryProductSummary(
                product_id=product.id,
                product_name=product.name,
                unit=product.unit,
                category=product.category,
                current_stock=current_stock,
                last_purchase_date=last_purchase_date,
                average_duration_days=compute_average_duration_days(db, product.id),
                average_monthly_spend=compute_average_monthly_spend(purchase_items),
                average_price=compute_average_price(purchase_items),
                recent_purchases=recent_purchases,
                related_dishes=list(related_dishes),
                quantity_bought_this_month=Decimal(quantity_bought_this_month),
                spend_this_month=Decimal(spend_this_month),
                is_open=state["is_open"],
                last_opened_on=state["last_opened_on"],
                last_finished_on=state["last_finished_on"],
                status_label=state["status_label"],
                can_open=state["can_open"],
                can_finish_remaining=state["can_finish_remaining"],
            )
        )
    return summaries


@app.get("/reports/monthly", response_model=MonthlyReport)
def get_monthly_report(month: str = Query(..., description="YYYY-MM"), db: Session = Depends(get_db)):
    start = date.fromisoformat(f"{month}-01")
    next_month = (start.replace(day=28) + timedelta(days=4)).replace(day=1)

    total_spend = db.scalar(
        select(func.coalesce(func.sum(PurchaseItem.total_price), 0))
        .join(Purchase, Purchase.id == PurchaseItem.purchase_id)
        .where(Purchase.purchased_on >= start, Purchase.purchased_on < next_month)
    ) or Decimal("0")

    spend_by_category_rows = db.execute(
        select(Product.category, func.coalesce(func.sum(PurchaseItem.total_price), 0))
        .join(PurchaseItem, PurchaseItem.product_id == Product.id)
        .join(Purchase, Purchase.id == PurchaseItem.purchase_id)
        .where(Purchase.purchased_on >= start, Purchase.purchased_on < next_month)
        .group_by(Product.category)
        .order_by(func.sum(PurchaseItem.total_price).desc())
    ).all()

    most_purchased_rows = db.execute(
        select(
            Product.name,
            func.count(PurchaseItem.id),
            func.coalesce(func.sum(PurchaseItem.quantity), 0),
            func.coalesce(func.sum(PurchaseItem.total_price), 0),
        )
        .join(PurchaseItem, PurchaseItem.product_id == Product.id)
        .join(Purchase, Purchase.id == PurchaseItem.purchase_id)
        .where(Purchase.purchased_on >= start, Purchase.purchased_on < next_month)
        .group_by(Product.name)
        .order_by(func.count(PurchaseItem.id).desc(), func.sum(PurchaseItem.total_price).desc())
        .limit(10)
    ).all()

    dish_count_rows = db.execute(
        select(Meal.name_snapshot, func.count(Meal.id))
        .where(Meal.occurred_on >= start, Meal.occurred_on < next_month)
        .group_by(Meal.name_snapshot)
        .order_by(func.count(Meal.id).desc(), Meal.name_snapshot.asc())
        .limit(10)
    ).all()

    occasions_count = db.scalar(
        select(func.count(Meal.id)).where(
            Meal.occurred_on >= start,
            Meal.occurred_on < next_month,
            Meal.category_snapshot == "occasion",
        )
    ) or 0

    dinner_counts = db.execute(
        select(Meal.name_snapshot)
        .where(Meal.occurred_on >= start, Meal.occurred_on < next_month, Meal.category_snapshot == "dinner")
    ).scalars().all()
    distinct_dinners = len(set(dinner_counts))
    dinner_variety = round((distinct_dinners / len(dinner_counts)), 2) if dinner_counts else 0.0

    durations = []
    for product in db.scalars(select(Product)).all():
        duration = compute_average_duration_days(db, product.id)
        if duration is not None:
            durations.append((product.name, duration))
    fast_runout_items = [
        FastRunoutItem(product_name=name, average_duration_days=duration)
        for name, duration in sorted(durations, key=lambda item: item[1])[:5]
    ]

    ingredient_usage_rows = db.execute(
        select(
            Product.name,
            func.count(MealIngredient.id),
            func.coalesce(func.sum(MealIngredient.quantity), 0),
        )
        .join(MealIngredient, MealIngredient.product_id == Product.id)
        .join(Meal, Meal.id == MealIngredient.meal_id)
        .where(Meal.occurred_on >= start, Meal.occurred_on < next_month)
        .group_by(Product.id, Product.name)
        .order_by(func.count(MealIngredient.id).desc(), func.sum(MealIngredient.quantity).desc(), Product.name.asc())
        .limit(10)
    ).all()
    most_used_ingredients = []
    for product_name, used_times, total_quantity in ingredient_usage_rows:
        dish_names = db.scalars(
            select(Meal.name_snapshot)
            .join(MealIngredient, MealIngredient.meal_id == Meal.id)
            .join(Product, Product.id == MealIngredient.product_id)
            .where(
                Product.name == product_name,
                Meal.occurred_on >= start,
                Meal.occurred_on < next_month,
            )
            .distinct()
            .order_by(Meal.name_snapshot.asc())
        ).all()
        most_used_ingredients.append(
            IngredientUsageReport(
                product_name=product_name,
                used_times=int(used_times),
                total_quantity=Decimal(total_quantity),
                dishes=list(dish_names),
            )
        )

    return MonthlyReport(
        month=month,
        total_grocery_spend=Decimal(total_spend),
        spend_by_category=[SpendByCategory(category=row[0], total_spend=Decimal(row[1])) for row in spend_by_category_rows],
        most_purchased_items=[
            PurchasedItemReport(
                product_name=row[0],
                purchases_count=int(row[1]),
                quantity=Decimal(row[2]),
                spend=Decimal(row[3]),
            )
            for row in most_purchased_rows
        ],
        dishes_count=[DishCountReport(dish_name=row[0], count=int(row[1])) for row in dish_count_rows],
        occasions_count=occasions_count,
        average_dinner_variety=dinner_variety,
        items_ran_out_fastest=fast_runout_items,
        items_bought_unusually_often=compute_unusual_frequency_items(db, start, next_month),
        most_used_ingredients=most_used_ingredients,
    )


def get_last_unit_price(db: Session, product_id: int) -> Optional[Decimal]:
    latest_item = db.scalar(
        select(PurchaseItem)
        .join(Purchase, Purchase.id == PurchaseItem.purchase_id)
        .where(PurchaseItem.product_id == product_id)
        .order_by(Purchase.purchased_on.desc(), PurchaseItem.id.desc())
        .limit(1)
    )
    return latest_item.unit_price if latest_item else None


def serialize_product(db: Session, product: Product) -> ProductRead:
    return ProductRead(
        id=product.id,
        name=product.name,
        unit=product.unit,
        category=product.category,
        notes=product.notes,
        last_unit_price=get_last_unit_price(db, product.id),
    )


def serialize_dish(dish: Dish) -> DishRead:
    return DishRead(
        id=dish.id,
        name=dish.name,
        category=dish.category,
        notes=dish.notes,
        ingredients=[
            DishIngredientRead(
                id=ingredient.id,
                product_id=product.id,
                product_name=ingredient.product.name,
                quantity=ingredient.quantity,
                optional=ingredient.optional,
            )
            for ingredient in sorted(dish.ingredients, key=lambda item: (item.optional, item.product.name.lower()))
        ],
    )


def serialize_purchase_item(item: PurchaseItem) -> PurchaseItemRead:
    return PurchaseItemRead(
        id=item.id,
        product_id=item.product_id,
        product_name=item.product.name,
        quantity=item.quantity,
        unit_price=item.unit_price,
        total_price=item.total_price,
    )


def serialize_purchase(purchase: Purchase) -> PurchaseRead:
    ordered_items = sorted(purchase.items, key=lambda item: (item.product.name.lower(), item.id))
    return PurchaseRead(
        id=purchase.id,
        purchased_on=purchase.purchased_on,
        store=purchase.store,
        note=purchase.note,
        items=[serialize_purchase_item(item) for item in ordered_items],
    )


def serialize_meal(meal: Meal) -> MealRead:
    return MealRead(
        id=meal.id,
        occurred_on=meal.occurred_on,
        dish_id=meal.dish_id,
        name_snapshot=meal.name_snapshot,
        category_snapshot=meal.category_snapshot,
        note=meal.note,
        ingredients=[
            MealIngredientRead(
                id=ingredient.id,
                product_id=ingredient.product_id,
                product_name=ingredient.product.name,
                quantity=ingredient.quantity,
            )
            for ingredient in meal.ingredients
        ],
    )


def ensure_category_exists(db: Session, category_name: str) -> None:
    normalized = (category_name or "general").strip()
    if not normalized:
        normalized = "general"
    existing = db.scalar(select(Category).where(func.lower(Category.name) == normalized.lower()))
    if not existing:
        db.add(Category(name=normalized))
        db.flush()


def ensure_unit_exists(db: Session, unit_name: str) -> None:
    normalized = (unit_name or "unit").strip()
    if not normalized:
        normalized = "unit"
    existing = db.scalar(select(Unit).where(func.lower(Unit.name) == normalized.lower()))
    if not existing:
        db.add(Unit(name=normalized))
        db.flush()


def upsert_product_by_name(
    db: Session,
    name: str,
    unit: Optional[str] = None,
    category: Optional[str] = None,
    notes: Optional[str] = None,
) -> Product:
    normalized_name = (name or "").strip()
    if not normalized_name:
        raise HTTPException(status_code=400, detail="Product name is required")
    existing = db.scalar(select(Product).where(func.lower(Product.name) == normalized_name.lower()))
    if existing:
        if unit and existing.unit == "unit" and unit.strip() and unit.strip() != "unit":
            existing.unit = unit.strip()
            ensure_unit_exists(db, existing.unit)
        if category and existing.category == "general" and category.strip() and category.strip() != "general":
            existing.category = category.strip()
            ensure_category_exists(db, existing.category)
        if notes and not existing.notes:
            existing.notes = notes
        db.flush()
        return existing

    category_value = (category or "general").strip() or "general"
    unit_value = (unit or "unit").strip() or "unit"
    ensure_category_exists(db, category_value)
    ensure_unit_exists(db, unit_value)
    product = Product(name=normalized_name, unit=unit_value, category=category_value, notes=notes)
    db.add(product)
    db.flush()
    return product


def resolve_purchase_product(db: Session, item: PurchaseItemInput) -> Product:
    if item.product_id:
        product = db.get(Product, item.product_id)
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {item.product_id} not found")
        return product
    if not item.product_name:
        raise HTTPException(status_code=400, detail="Each purchase item needs a product")
    return upsert_product_by_name(db, item.product_name, item.unit, item.category)


def normalize_money(value: Decimal) -> Decimal:
    return Decimal(value).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)


def replace_purchase_items(db: Session, purchase: Purchase, items_payload: list[PurchaseItemInput]) -> None:
    if not items_payload:
        raise HTTPException(status_code=400, detail="At least one purchase item is required")
    for item in items_payload:
        product = resolve_purchase_product(db, item)
        quantity = Decimal(item.quantity)
        unit_price = normalize_money(item.unit_price)
        total_price = normalize_money(quantity * unit_price)
        purchase_item = PurchaseItem(
            purchase_id=purchase.id,
            product_id=product.id,
            quantity=quantity,
            unit_price=unit_price,
            total_price=total_price,
        )
        db.add(purchase_item)
        db.flush()
        db.add(
            ProductEvent(
                product_id=product.id,
                occurred_on=purchase.purchased_on,
                event_type="purchase",
                quantity_delta=quantity,
                note=f"Purchase at {purchase.store}" if purchase.store else "Purchase",
                purchase_item_id=purchase_item.id,
            )
        )
    db.flush()


def clear_purchase_items(db: Session, purchase: Purchase) -> None:
    item_ids = [item.id for item in purchase.items]
    if item_ids:
        db.query(ProductEvent).filter(ProductEvent.purchase_item_id.in_(item_ids)).delete(synchronize_session=False)
        db.query(PurchaseItem).filter(PurchaseItem.id.in_(item_ids)).delete(synchronize_session=False)
        db.flush()


def resolve_ingredient_product(db: Session, ingredient) -> Product:
    if getattr(ingredient, "product_id", None):
        product = db.get(Product, ingredient.product_id)
        if not product:
            raise HTTPException(status_code=404, detail=f"Product {ingredient.product_id} not found")
        return product
    product_name = getattr(ingredient, "product_name", None)
    if not product_name:
        raise HTTPException(status_code=400, detail="Each ingredient needs a product")
    return upsert_product_by_name(db, product_name, unit="unit", category="general")


def replace_meal_ingredients(db: Session, meal: Meal, ingredients_payload) -> None:
    if not ingredients_payload:
        raise HTTPException(status_code=400, detail="At least one ingredient is required")
    for ingredient in ingredients_payload:
        product = resolve_ingredient_product(db, ingredient)
        meal_ingredient = MealIngredient(
            meal_id=meal.id,
            product_id=product.id,
            quantity=ingredient.quantity,
        )
        db.add(meal_ingredient)
        db.flush()
        db.add(
            ProductEvent(
                product_id=product.id,
                occurred_on=meal.occurred_on,
                event_type="consume",
                quantity_delta=-Decimal(ingredient.quantity),
                note=f"Used in {meal.name_snapshot}",
                meal_ingredient_id=meal_ingredient.id,
            )
        )
    db.flush()


def clear_meal_ingredients(db: Session, meal: Meal) -> None:
    ingredient_ids = [ingredient.id for ingredient in meal.ingredients]
    if ingredient_ids:
        db.query(ProductEvent).filter(ProductEvent.meal_ingredient_id.in_(ingredient_ids)).delete(
            synchronize_session=False
        )
        db.query(MealIngredient).filter(MealIngredient.id.in_(ingredient_ids)).delete(synchronize_session=False)
        db.flush()


def _replace_dish_ingredients(db: Session, dish: Dish, ingredients_payload) -> None:
    db.query(DishIngredient).filter(DishIngredient.dish_id == dish.id).delete(synchronize_session=False)
    db.flush()
    for ingredient in ingredients_payload:
        product = resolve_ingredient_product(db, ingredient)
        db.add(
            DishIngredient(
                dish_id=dish.id,
                product_id=product.id,
                quantity=ingredient.quantity,
                optional=ingredient.optional,
            )
        )
    db.flush()


def get_current_stock(db: Session, product_id: int, on_or_before: Optional[date] = None) -> Decimal:
    stmt = select(func.coalesce(func.sum(ProductEvent.quantity_delta), 0)).where(ProductEvent.product_id == product_id)
    if on_or_before is not None:
        stmt = stmt.where(ProductEvent.occurred_on <= on_or_before)
    total = db.scalar(stmt)
    return Decimal(total or 0)


def get_product_state(
    db: Session,
    product_id: int,
    reference_date: Optional[date] = None,
    *,
    current_stock: Optional[Decimal] = None,
) -> dict:
    reference_date = reference_date or date.today()
    if current_stock is None:
        current_stock = get_current_stock(db, product_id, reference_date)

    last_open_event = db.execute(
        select(ProductEvent.id, ProductEvent.occurred_on)
        .where(
            ProductEvent.product_id == product_id,
            ProductEvent.event_type == "open",
            ProductEvent.occurred_on <= reference_date,
        )
        .order_by(ProductEvent.occurred_on.desc(), ProductEvent.id.desc())
        .limit(1)
    ).first()
    last_finish_event = db.execute(
        select(ProductEvent.id, ProductEvent.occurred_on)
        .where(
            ProductEvent.product_id == product_id,
            ProductEvent.event_type == "finish",
            ProductEvent.occurred_on <= reference_date,
        )
        .order_by(ProductEvent.occurred_on.desc(), ProductEvent.id.desc())
        .limit(1)
    ).first()

    last_opened_on = last_open_event[1] if last_open_event else None
    last_finished_on = last_finish_event[1] if last_finish_event else None

    latest_lifecycle_event = db.execute(
        select(ProductEvent.event_type, ProductEvent.occurred_on, ProductEvent.id)
        .where(
            ProductEvent.product_id == product_id,
            ProductEvent.event_type.in_(["open", "finish"]),
            ProductEvent.occurred_on <= reference_date,
        )
        .order_by(ProductEvent.occurred_on.desc(), ProductEvent.id.desc())
        .limit(1)
    ).first()

    is_open = bool(latest_lifecycle_event and latest_lifecycle_event[0] == "open")
    has_stock = current_stock > 0
    if is_open and last_opened_on:
        status_label = f"Open since {last_opened_on.isoformat()}"
    elif has_stock:
        status_label = "In stock"
    elif last_finished_on:
        status_label = f"Finished on {last_finished_on.isoformat()}"
    else:
        status_label = "Out of stock"

    return {
        "current_stock": current_stock,
        "is_open": is_open,
        "last_opened_on": last_opened_on,
        "last_finished_on": last_finished_on,
        "status_label": status_label,
        "can_open": bool(has_stock and not is_open),
        "can_finish_remaining": bool(is_open),
    }


def compute_average_price(purchase_rows) -> Optional[Decimal]:
    prices = [
        Decimal(row[0].total_price) / Decimal(row[0].quantity)
        for row in purchase_rows
        if Decimal(row[0].quantity) != 0
    ]
    if not prices:
        return None
    return normalize_money(sum(prices, Decimal("0")) / Decimal(len(prices)))


def compute_average_monthly_spend(purchase_rows) -> Decimal:
    if not purchase_rows:
        return Decimal("0")
    grouped: dict[str, Decimal] = defaultdict(lambda: Decimal("0"))
    for item, purchase in purchase_rows:
        grouped[purchase.purchased_on.strftime("%Y-%m")] += Decimal(item.total_price)
    return normalize_money(sum(grouped.values(), Decimal("0")) / Decimal(len(grouped)))


def compute_usual_store(purchase_rows) -> Optional[str]:
    counts: dict[str, int] = defaultdict(int)
    for _item, purchase in purchase_rows:
        if purchase.store:
            counts[purchase.store] += 1
    return max(counts.items(), key=lambda item: item[1])[0] if counts else None


def compute_average_duration_days(db: Session, product_id: int) -> Optional[float]:
    purchase_dates = db.scalars(
        select(Purchase.purchased_on)
        .join(PurchaseItem, PurchaseItem.purchase_id == Purchase.id)
        .where(PurchaseItem.product_id == product_id)
        .order_by(Purchase.purchased_on.asc())
    ).all()
    finish_dates = db.scalars(
        select(ProductEvent.occurred_on)
        .where(ProductEvent.product_id == product_id, ProductEvent.event_type == "finish")
        .order_by(ProductEvent.occurred_on.asc())
    ).all()

    durations: list[int] = []
    if purchase_dates and finish_dates:
        finish_idx = 0
        for purchased_on in purchase_dates:
            while finish_idx < len(finish_dates) and finish_dates[finish_idx] < purchased_on:
                finish_idx += 1
            if finish_idx < len(finish_dates):
                durations.append((finish_dates[finish_idx] - purchased_on).days)
                finish_idx += 1

    if not durations and len(purchase_dates) >= 2:
        durations = [(purchase_dates[i + 1] - purchase_dates[i]).days for i in range(len(purchase_dates) - 1)]

    return round(mean(durations), 1) if durations else None


def compute_unusual_frequency_items(db: Session, start: date, next_month: date) -> list[UnusualFrequencyItem]:
    this_month_rows = db.execute(
        select(Product.id, Product.name, func.count(PurchaseItem.id))
        .join(PurchaseItem, PurchaseItem.product_id == Product.id)
        .join(Purchase, Purchase.id == PurchaseItem.purchase_id)
        .where(Purchase.purchased_on >= start, Purchase.purchased_on < next_month)
        .group_by(Product.id, Product.name)
    ).all()

    all_history_rows = db.execute(
        select(Product.id, Product.name, Purchase.purchased_on)
        .join(PurchaseItem, PurchaseItem.product_id == Product.id)
        .join(Purchase, Purchase.id == PurchaseItem.purchase_id)
        .order_by(Product.id, Purchase.purchased_on)
    ).all()

    monthly_counts: dict[int, dict[str, int]] = defaultdict(lambda: defaultdict(int))
    for product_id, _product_name, purchased_on in all_history_rows:
        monthly_counts[product_id][purchased_on.strftime("%Y-%m")] += 1

    results: list[UnusualFrequencyItem] = []
    for product_id, product_name, current_count in this_month_rows:
        counts = monthly_counts.get(product_id, {})
        average = sum(counts.values()) / len(counts) if counts else float(current_count)
        if current_count > average:
            results.append(
                UnusualFrequencyItem(
                    product_name=product_name,
                    this_month_count=int(current_count),
                    average_monthly_count=round(average, 2),
                )
            )
    return sorted(results, key=lambda item: (item.this_month_count - item.average_monthly_count), reverse=True)[:5]


def seed_initial_data() -> None:
    with session_scope() as db:
        for category_name in PRODUCT_CATEGORY_DEFAULTS:
            if not db.scalar(select(Category).where(Category.name == category_name)):
                db.add(Category(name=category_name))
        for unit_name in UNIT_DEFAULTS:
            if not db.scalar(select(Unit).where(Unit.name == unit_name)):
                db.add(Unit(name=unit_name))
        db.flush()

        existing_product_units = db.scalars(select(Product.unit).distinct()).all()
        for unit_name in existing_product_units:
            if unit_name:
                ensure_unit_exists(db, unit_name)
        db.flush()

        products = [
            ("Milk", "liter", "breakfast"),
            ("Oats", "cup", "breakfast"),
            ("Hotcake Mix", "cup", "breakfast"),
            ("Sausages", "unit", "dinner"),
            ("Hot Dog Buns", "unit", "dinner"),
            ("Mayonnaise", "tbsp", "dinner"),
            ("Avocado", "unit", "dinner"),
            ("Onion", "unit", "dinner"),
            ("Popcorn", "bag", "occasion"),
            ("Doritos", "bag", "occasion"),
            ("Yogurt", "cup", "breakfast"),
            ("Energy Gel", "unit", "bike_nutrition"),
            ("Hydration Mix", "scoop", "bike_nutrition"),
            ("Eggs", "unit", "breakfast"),
        ]
        for name, unit, category in products:
            upsert_product_by_name(db, name, unit, category)
        db.flush()

        product_map = {product.name: product for product in db.scalars(select(Product)).all()}

        if not db.scalar(select(Dish).where(Dish.name == "Hot dogs")):
            hotdogs = Dish(name="Hot dogs", category="dinner")
            db.add(hotdogs)
            db.flush()
            db.add_all(
                [
                    DishIngredient(dish_id=hotdogs.id, product_id=product_map["Sausages"].id, quantity=Decimal("2"), optional=False),
                    DishIngredient(dish_id=hotdogs.id, product_id=product_map["Hot Dog Buns"].id, quantity=Decimal("2"), optional=False),
                    DishIngredient(dish_id=hotdogs.id, product_id=product_map["Mayonnaise"].id, quantity=Decimal("1"), optional=True),
                    DishIngredient(dish_id=hotdogs.id, product_id=product_map["Avocado"].id, quantity=Decimal("1"), optional=True),
                    DishIngredient(dish_id=hotdogs.id, product_id=product_map["Onion"].id, quantity=Decimal("0.5"), optional=True),
                ]
            )

        if not db.scalar(select(Dish).where(Dish.name == "Movie Night")):
            movie = Dish(name="Movie Night", category="occasion", notes="Fixed consumption event")
            db.add(movie)
            db.flush()
            db.add_all(
                [
                    DishIngredient(dish_id=movie.id, product_id=product_map["Popcorn"].id, quantity=Decimal("1"), optional=False),
                    DishIngredient(dish_id=movie.id, product_id=product_map["Doritos"].id, quantity=Decimal("1"), optional=True),
                ]
            )

        if not db.scalar(select(Dish).where(Dish.name == "Long Ride")):
            ride = Dish(name="Long Ride", category="bike_nutrition", notes="Fixed consumption event")
            db.add(ride)
            db.flush()
            db.add_all(
                [
                    DishIngredient(dish_id=ride.id, product_id=product_map["Energy Gel"].id, quantity=Decimal("2"), optional=False),
                    DishIngredient(dish_id=ride.id, product_id=product_map["Hydration Mix"].id, quantity=Decimal("1"), optional=False),
                ]
            )

        if not db.scalar(select(Dish).where(Dish.name == "Oatmeal")):
            oatmeal = Dish(name="Oatmeal", category="breakfast")
            db.add(oatmeal)
            db.flush()
            db.add_all(
                [
                    DishIngredient(dish_id=oatmeal.id, product_id=product_map["Oats"].id, quantity=Decimal("1"), optional=False),
                    DishIngredient(dish_id=oatmeal.id, product_id=product_map["Milk"].id, quantity=Decimal("1"), optional=False),
                ]
            )
