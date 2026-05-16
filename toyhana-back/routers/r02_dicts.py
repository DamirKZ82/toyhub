"""
Справочники для фронта.
Бэк отдаёт оба языковых поля (name_ru, name_kz) — фронт выбирает сам,
это позволяет мгновенно переключать язык без повторного запроса.
"""
from typing import Optional

from fastapi import APIRouter, Query

from connections.connect_postgres import query_db
from libs.common import fit_to_sql


router = APIRouter(prefix='/dicts')


@router.get('/cities')
async def get_cities():
    rows = await query_db("""
        SELECT id, name_ru, name_kz
        FROM cities
        WHERE is_active = true
        ORDER BY name_ru
    """)
    return {'items': rows}


@router.get('/amenities')
async def get_amenities():
    rows = await query_db("""
        SELECT id, code, name_ru, name_kz, icon
        FROM hall_amenities
        ORDER BY id
    """)
    return {'items': rows}


@router.get('/event-types')
async def get_event_types():
    rows = await query_db("""
        SELECT id, code, name_ru, name_kz
        FROM event_types
        ORDER BY id
    """)
    return {'items': rows}


@router.get('/categories')
async def get_categories():
    rows = await query_db("""
        SELECT id, code, name_ru, name_kz, icon, sort_order
        FROM categories
        ORDER BY sort_order, id
    """)
    return {'items': rows}


@router.get('/provider-attr-types')
async def get_provider_attr_types(
    category: Optional[str] = Query(None, description='Код категории, напр. "artist"'),
):
    """Атрибуты исполнителей. Если задан category — только его атрибуты."""
    where = ''
    if category:
        where = f"WHERE c.code = {fit_to_sql(category)}"
    rows = await query_db(f"""
        SELECT pat.id, pat.code, pat.name_ru, pat.name_kz, pat.icon,
               pat.sort_order, c.code AS category_code
        FROM provider_attr_types pat
        JOIN categories c ON c.id = pat.category_id
        {where}
        ORDER BY pat.category_id, pat.sort_order, pat.id
    """)
    return {'items': rows}


@router.get('/holidays')
async def get_holidays():
    rows = await query_db("""
        SELECT date, name_ru, name_kz
        FROM holidays
        ORDER BY date
    """)
    return {'items': rows}
