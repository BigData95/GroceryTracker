from __future__ import annotations

from datetime import date, datetime
from decimal import Decimal
from typing import Optional

from sqlalchemy import (
    Date,
    DateTime,
    ForeignKey,
    Numeric,
    String,
    Text,
    UniqueConstraint,
)
from sqlalchemy.orm import Mapped, mapped_column, relationship

from .db import Base


class Category(Base):
    __tablename__ = "categories"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(50), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Unit(Base):
    __tablename__ = "units"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(30), unique=True, index=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)


class Product(Base):
    __tablename__ = "products"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    unit: Mapped[str] = mapped_column(String(30), default="unit")
    category: Mapped[str] = mapped_column(String(50), default="general")
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    purchase_items: Mapped[list[PurchaseItem]] = relationship(back_populates="product")
    dish_ingredients: Mapped[list[DishIngredient]] = relationship(back_populates="product")
    meal_ingredients: Mapped[list[MealIngredient]] = relationship(back_populates="product")
    product_events: Mapped[list[ProductEvent]] = relationship(back_populates="product")


class Dish(Base):
    __tablename__ = "dishes"

    id: Mapped[int] = mapped_column(primary_key=True)
    name: Mapped[str] = mapped_column(String(120), unique=True, index=True)
    category: Mapped[str] = mapped_column(String(50), default="dinner")
    notes: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    ingredients: Mapped[list[DishIngredient]] = relationship(
        back_populates="dish", cascade="all, delete-orphan"
    )
    meals: Mapped[list[Meal]] = relationship(back_populates="dish")


class DishIngredient(Base):
    __tablename__ = "dish_ingredients"

    id: Mapped[int] = mapped_column(primary_key=True)
    dish_id: Mapped[int] = mapped_column(ForeignKey("dishes.id", ondelete="CASCADE"))
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    quantity: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=1)
    optional: Mapped[bool] = mapped_column(default=False)

    dish: Mapped[Dish] = relationship(back_populates="ingredients")
    product: Mapped[Product] = relationship(back_populates="dish_ingredients")


class Purchase(Base):
    __tablename__ = "purchases"

    id: Mapped[int] = mapped_column(primary_key=True)
    purchased_on: Mapped[date] = mapped_column(Date, index=True)
    store: Mapped[Optional[str]] = mapped_column(String(120), nullable=True)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    items: Mapped[list[PurchaseItem]] = relationship(
        back_populates="purchase", cascade="all, delete-orphan"
    )


class PurchaseItem(Base):
    __tablename__ = "purchase_items"

    id: Mapped[int] = mapped_column(primary_key=True)
    purchase_id: Mapped[int] = mapped_column(ForeignKey("purchases.id", ondelete="CASCADE"))
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    quantity: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=1)
    unit_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    total_price: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)

    purchase: Mapped[Purchase] = relationship(back_populates="items")
    product: Mapped[Product] = relationship(back_populates="purchase_items")
    product_event: Mapped[Optional[ProductEvent]] = relationship(
        back_populates="purchase_item", uselist=False
    )


class Meal(Base):
    __tablename__ = "meals"

    id: Mapped[int] = mapped_column(primary_key=True)
    occurred_on: Mapped[date] = mapped_column(Date, index=True)
    dish_id: Mapped[Optional[int]] = mapped_column(ForeignKey("dishes.id"), nullable=True)
    name_snapshot: Mapped[str] = mapped_column(String(120))
    category_snapshot: Mapped[str] = mapped_column(String(50), default="dinner")
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    dish: Mapped[Optional[Dish]] = relationship(back_populates="meals")
    ingredients: Mapped[list[MealIngredient]] = relationship(
        back_populates="meal", cascade="all, delete-orphan"
    )


class MealIngredient(Base):
    __tablename__ = "meal_ingredients"

    id: Mapped[int] = mapped_column(primary_key=True)
    meal_id: Mapped[int] = mapped_column(ForeignKey("meals.id", ondelete="CASCADE"))
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"))
    quantity: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=1)

    meal: Mapped[Meal] = relationship(back_populates="ingredients")
    product: Mapped[Product] = relationship(back_populates="meal_ingredients")
    product_event: Mapped[Optional[ProductEvent]] = relationship(
        back_populates="meal_ingredient", uselist=False
    )


class ProductEvent(Base):
    __tablename__ = "product_events"

    id: Mapped[int] = mapped_column(primary_key=True)
    product_id: Mapped[int] = mapped_column(ForeignKey("products.id"), index=True)
    occurred_on: Mapped[date] = mapped_column(Date, index=True)
    event_type: Mapped[str] = mapped_column(String(30), index=True)
    quantity_delta: Mapped[Decimal] = mapped_column(Numeric(10, 2), default=0)
    note: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    purchase_item_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("purchase_items.id"), nullable=True
    )
    meal_ingredient_id: Mapped[Optional[int]] = mapped_column(
        ForeignKey("meal_ingredients.id"), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    product: Mapped[Product] = relationship(back_populates="product_events")
    purchase_item: Mapped[Optional[PurchaseItem]] = relationship(back_populates="product_event")
    meal_ingredient: Mapped[Optional[MealIngredient]] = relationship(back_populates="product_event")


class DayNote(Base):
    __tablename__ = "day_notes"
    __table_args__ = (UniqueConstraint("day", name="uq_day_notes_day"),)

    id: Mapped[int] = mapped_column(primary_key=True)
    day: Mapped[date] = mapped_column(Date, index=True)
    note: Mapped[str] = mapped_column(Text)
    updated_at: Mapped[datetime] = mapped_column(
        DateTime, default=datetime.utcnow, onupdate=datetime.utcnow
    )
