"""
Утилиты для загрузки venue/hall по guid и проверки что юзер — владелец.
Используются в роутерах r20/r21/r22/r30/r31, поэтому вынесены в общий модуль.
"""
from typing import Optional

from connections.connect_postgres import query_db
from handlers.h01_errors import WarnException
from libs.common import fit_to_sql


async def get_venue_by_guid(guid: str) -> Optional[dict]:
    rows = await query_db(f"""
        SELECT id, guid, owner_id, city_id, name, address,
               latitude, longitude, description, phone, is_active,
               created_at, updated_at
        FROM venues
        WHERE guid = {fit_to_sql(guid)}
    """)
    return rows[0] if rows else None


async def get_hall_by_guid(guid: str) -> Optional[dict]:
    rows = await query_db(f"""
        SELECT id, guid, venue_id, name, description, area_sqm,
               capacity_min, capacity_max,
               price_weekday, price_weekend, is_active,
               created_at, updated_at
        FROM halls
        WHERE guid = {fit_to_sql(guid)}
    """)
    return rows[0] if rows else None


async def get_provider_by_guid(guid: str) -> Optional[dict]:
    rows = await query_db(f"""
        SELECT id, guid, owner_id, category_id, city_id, name, description,
               phone, latitude, longitude, price_from, price_unit, is_active,
               created_at, updated_at
        FROM providers
        WHERE guid = {fit_to_sql(guid)}
    """)
    return rows[0] if rows else None


async def require_provider_owner(provider_guid: str, user: dict) -> dict:
    """Вернёт provider или бросит 404/403."""
    provider = await get_provider_by_guid(provider_guid)
    if provider is None:
        raise WarnException(404, 'Исполнитель не найден')
    if provider['owner_id'] != user['id']:
        raise WarnException(403, 'Недостаточно прав')
    return provider


async def require_venue_owner(venue_guid: str, user: dict) -> dict:
    """Вернёт venue или бросит 404/403."""
    venue = await get_venue_by_guid(venue_guid)
    if venue is None:
        raise WarnException(404, 'Заведение не найдено')
    if venue['owner_id'] != user['id']:
        raise WarnException(403, 'Недостаточно прав')
    return venue


async def require_hall_owner(hall_guid: str, user: dict) -> tuple[dict, dict]:
    """
    Вернёт (hall, venue) или бросит 404/403.
    Зал принадлежит юзеру, если его venue принадлежит юзеру.
    """
    hall = await get_hall_by_guid(hall_guid)
    if hall is None:
        raise WarnException(404, 'Зал не найден')
    venues = await query_db(f"""
        SELECT id, owner_id FROM venues WHERE id = {fit_to_sql(hall['venue_id'])}
    """)
    if not venues or venues[0]['owner_id'] != user['id']:
        raise WarnException(403, 'Недостаточно прав')
    return hall, venues[0]
