"""
Избранное (favorites). Полиморфно: зал ИЛИ исполнитель.

    GET    /favorites                   — мои избранные (залы + исполнители), c type
    POST   /favorites/{hall_guid}       — добавить зал
    DELETE /favorites/{hall_guid}       — убрать зал
    POST   /favorites/provider/{guid}   — добавить исполнителя
    DELETE /favorites/provider/{guid}   — убрать исполнителя

Идемпотентно: повторный POST / DELETE на то же самое — не ошибка, просто no-op.
Каждый элемент списка содержит "type": "hall" | "provider", чтобы фронт
выбрал нужную карточку.
"""
from fastapi import APIRouter, Depends

from connections.connect_postgres import query_db
from handlers.h01_errors import WarnException
from handlers.h03_auth import auth_user
from libs.common import fit_to_sql
from libs.date import get_timestamp_now
from libs.ownership import get_hall_by_guid, get_provider_by_guid


router = APIRouter(prefix='/favorites')


async def _hall_favorites(user_id: int) -> list[dict]:
    rows = await query_db(f"""
        SELECT
            h.id AS hall_id, h.guid AS hall_guid, h.name AS hall_name,
            h.description AS hall_description, h.area_sqm,
            h.capacity_min, h.capacity_max,
            h.price_weekday, h.price_weekend, h.is_active AS hall_is_active,
            v.id AS venue_id, v.guid AS venue_guid, v.name AS venue_name,
            v.address, v.latitude, v.longitude, v.is_active AS venue_is_active,
            c.id AS city_id, c.name_ru AS city_name_ru, c.name_kz AS city_name_kz,
            ph.thumb_path AS main_thumb, ph.file_path AS main_photo,
            COALESCE(r.avg_rating, 0)::float AS avg_rating,
            COALESCE(r.reviews_count, 0)::int AS reviews_count,
            f.created_at AS favorited_at
        FROM favorites f
        JOIN halls h ON h.id = f.hall_id
        JOIN venues v ON v.id = h.venue_id
        JOIN cities c ON c.id = v.city_id
        LEFT JOIN LATERAL (
            SELECT thumb_path, file_path
            FROM hall_photos
            WHERE hall_id = h.id
            ORDER BY sort_order, id
            LIMIT 1
        ) ph ON true
        LEFT JOIN (
            SELECT hall_id,
                   AVG(rating)::float AS avg_rating,
                   COUNT(*)::int AS reviews_count
            FROM reviews
            WHERE hall_id IS NOT NULL
            GROUP BY hall_id
        ) r ON r.hall_id = h.id
        WHERE f.user_id = {fit_to_sql(user_id)}
          AND f.hall_id IS NOT NULL
        ORDER BY f.created_at DESC, h.id DESC
    """)
    items = []
    for r in rows:
        items.append({
            'type': 'hall',
            'hall': {
                'id': r['hall_id'],
                'guid': r['hall_guid'],
                'name': r['hall_name'],
                'description': r['hall_description'],
                'area_sqm': r['area_sqm'],
                'capacity_min': r['capacity_min'],
                'capacity_max': r['capacity_max'],
                'price_weekday': r['price_weekday'],
                'price_weekend': r['price_weekend'],
                'is_active': r['hall_is_active'],
            },
            'venue': {
                'id': r['venue_id'],
                'guid': r['venue_guid'],
                'name': r['venue_name'],
                'address': r['address'],
                'latitude': float(r['latitude']) if r['latitude'] is not None else None,
                'longitude': float(r['longitude']) if r['longitude'] is not None else None,
                'is_active': r['venue_is_active'],
            },
            'city': {
                'id': r['city_id'],
                'name_ru': r['city_name_ru'],
                'name_kz': r['city_name_kz'],
            },
            'main_photo': r['main_photo'],
            'main_thumb': r['main_thumb'],
            'rating': {'avg': round(r['avg_rating'], 2), 'count': r['reviews_count']},
            'favorited_at': r['favorited_at'],
        })
    return items


async def _provider_favorites(user_id: int) -> list[dict]:
    rows = await query_db(f"""
        SELECT
            p.id AS provider_id, p.guid AS provider_guid, p.name AS provider_name,
            p.description AS provider_description,
            p.price_from, p.price_unit,
            p.latitude, p.longitude, p.is_active AS provider_is_active,
            cat.id AS category_id, cat.code AS category_code,
            cat.name_ru AS category_name_ru, cat.name_kz AS category_name_kz,
            c.id AS city_id, c.name_ru AS city_name_ru, c.name_kz AS city_name_kz,
            ph.thumb_path AS main_thumb, ph.file_path AS main_photo,
            COALESCE(r.avg_rating, 0)::float AS avg_rating,
            COALESCE(r.reviews_count, 0)::int AS reviews_count,
            f.created_at AS favorited_at
        FROM favorites f
        JOIN providers p ON p.id = f.provider_id
        JOIN categories cat ON cat.id = p.category_id
        JOIN cities c ON c.id = p.city_id
        LEFT JOIN LATERAL (
            SELECT thumb_path, file_path
            FROM provider_photos
            WHERE provider_id = p.id
            ORDER BY sort_order, id
            LIMIT 1
        ) ph ON true
        LEFT JOIN (
            SELECT provider_id,
                   AVG(rating)::float AS avg_rating,
                   COUNT(*)::int AS reviews_count
            FROM reviews
            WHERE provider_id IS NOT NULL
            GROUP BY provider_id
        ) r ON r.provider_id = p.id
        WHERE f.user_id = {fit_to_sql(user_id)}
          AND f.provider_id IS NOT NULL
        ORDER BY f.created_at DESC, p.id DESC
    """)
    items = []
    for r in rows:
        items.append({
            'type': 'provider',
            'provider': {
                'id': r['provider_id'],
                'guid': r['provider_guid'],
                'name': r['provider_name'],
                'description': r['provider_description'],
                'price_from': r['price_from'],
                'price_unit': r['price_unit'],
                'latitude': float(r['latitude']) if r['latitude'] is not None else None,
                'longitude': float(r['longitude']) if r['longitude'] is not None else None,
                'is_active': r['provider_is_active'],
            },
            'category': {
                'id': r['category_id'],
                'code': r['category_code'],
                'name_ru': r['category_name_ru'],
                'name_kz': r['category_name_kz'],
            },
            'city': {
                'id': r['city_id'],
                'name_ru': r['city_name_ru'],
                'name_kz': r['city_name_kz'],
            },
            'main_photo': r['main_photo'],
            'main_thumb': r['main_thumb'],
            'rating': {'avg': round(r['avg_rating'], 2), 'count': r['reviews_count']},
            'favorited_at': r['favorited_at'],
        })
    return items


@router.get('')
async def list_favorites(user=Depends(auth_user)):
    """Залы + исполнители, объединённый список по дате добавления (новые сверху)."""
    halls = await _hall_favorites(user['id'])
    providers = await _provider_favorites(user['id'])
    merged = halls + providers
    merged.sort(key=lambda x: x['favorited_at'], reverse=True)
    return {'items': merged}


@router.post('/provider/{guid}')
async def add_provider_favorite(guid: str, user=Depends(auth_user)):
    provider = await get_provider_by_guid(guid)
    if provider is None:
        raise WarnException(404, 'Исполнитель не найден')

    now = get_timestamp_now()
    await query_db(f"""
        INSERT INTO favorites (user_id, provider_id, created_at)
        VALUES ({fit_to_sql(user['id'])}, {fit_to_sql(provider['id'])}, {fit_to_sql(now)})
        ON CONFLICT (user_id, provider_id) DO NOTHING
    """)
    return {'ok': True}


@router.delete('/provider/{guid}')
async def remove_provider_favorite(guid: str, user=Depends(auth_user)):
    provider = await get_provider_by_guid(guid)
    if provider is None:
        raise WarnException(404, 'Исполнитель не найден')

    await query_db(f"""
        DELETE FROM favorites
        WHERE user_id = {fit_to_sql(user['id'])}
          AND provider_id = {fit_to_sql(provider['id'])}
    """)
    return {'ok': True}


@router.post('/{hall_guid}')
async def add_favorite(hall_guid: str, user=Depends(auth_user)):
    hall = await get_hall_by_guid(hall_guid)
    if hall is None:
        raise WarnException(404, 'Зал не найден')

    now = get_timestamp_now()
    await query_db(f"""
        INSERT INTO favorites (user_id, hall_id, created_at)
        VALUES ({fit_to_sql(user['id'])}, {fit_to_sql(hall['id'])}, {fit_to_sql(now)})
        ON CONFLICT (user_id, hall_id) DO NOTHING
    """)
    return {'ok': True}


@router.delete('/{hall_guid}')
async def remove_favorite(hall_guid: str, user=Depends(auth_user)):
    hall = await get_hall_by_guid(hall_guid)
    if hall is None:
        raise WarnException(404, 'Зал не найден')

    await query_db(f"""
        DELETE FROM favorites
        WHERE user_id = {fit_to_sql(user['id'])}
          AND hall_id = {fit_to_sql(hall['id'])}
    """)
    return {'ok': True}
