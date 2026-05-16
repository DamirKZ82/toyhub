"""
Исполнители (providers) — тамада, артисты, декораторы, кейтеринг, фото-видео.

Плоская сущность (в отличие от venues → halls): одна карточка = один исполнитель.
«Своя модель у категории» выражена через атрибуты (provider_attr_types) и
price_unit (за мероприятие / час / персону / день).

    GET    /providers/my                  — мои исполнители (кратко + превью)
    POST   /providers                     — создать
    GET    /providers/{guid}              — детали (с фото и атрибутами) — владельцу
    PATCH  /providers/{guid}              — обновить
    DELETE /providers/{guid}              — удалить (каскад по FK + удаление файлов)

    POST   /providers/{guid}/photos       — загрузить пачку фото (multipart: files[])
    DELETE /providers/photos/{photo_id}   — удалить одно фото
    PATCH  /providers/{guid}/photos/order — переупорядочить фото
"""
from typing import List, Optional

from fastapi import APIRouter, Depends, File, UploadFile
from pydantic import BaseModel, field_validator

from connections.connect_postgres import query_db
from handlers.h01_errors import WarnException
from handlers.h03_auth import auth_user
from libs.common import fit_to_sql, new_guid
from libs.date import get_timestamp_now
from libs.ownership import require_provider_owner
from libs.photos import save_provider_photo, delete_photo_files


router = APIRouter(prefix='/providers')


PRICE_UNITS = {'event', 'hour', 'person', 'day'}


# -------------------------------------------------------------------------
# Pydantic
# -------------------------------------------------------------------------

class ProviderCreateBody(BaseModel):
    category_id: int
    city_id: int
    name: str
    description: Optional[str] = None
    phone: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    price_from: Optional[int] = None
    price_unit: Optional[str] = None
    attr_ids: List[int] = []

    @field_validator('name')
    @classmethod
    def name_ok(cls, val):
        val = (val or '').strip()
        if not val:
            raise ValueError('Имя/название не может быть пустым')
        if len(val) > 200:
            raise ValueError('Название не должно быть длиннее 200 символов')
        return val

    @field_validator('description')
    @classmethod
    def description_ok(cls, val):
        if val is None:
            return None
        val = val.strip()
        if len(val) > 5000:
            raise ValueError('Описание не должно быть длиннее 5000 символов')
        return val or None

    @field_validator('phone')
    @classmethod
    def phone_ok(cls, val):
        if val is None:
            return None
        val = val.strip()
        if len(val) > 20:
            raise ValueError('Телефон не должен быть длиннее 20 символов')
        return val or None

    @field_validator('latitude')
    @classmethod
    def lat_ok(cls, val):
        if val is None:
            return None
        if not (-90 <= val <= 90):
            raise ValueError('Широта должна быть в диапазоне [-90, 90]')
        return val

    @field_validator('longitude')
    @classmethod
    def lng_ok(cls, val):
        if val is None:
            return None
        if not (-180 <= val <= 180):
            raise ValueError('Долгота должна быть в диапазоне [-180, 180]')
        return val

    @field_validator('price_from')
    @classmethod
    def price_ok(cls, val):
        if val is None:
            return None
        if val < 0 or val > 1_000_000_000:
            raise ValueError('Некорректная цена')
        return val

    @field_validator('price_unit')
    @classmethod
    def price_unit_ok(cls, val):
        if val is None:
            return None
        val = val.strip()
        if not val:
            return None
        if val not in PRICE_UNITS:
            raise ValueError(f'price_unit должен быть одним из: {sorted(PRICE_UNITS)}')
        return val


class ProviderPatchBody(BaseModel):
    category_id: Optional[int] = None
    city_id: Optional[int] = None
    name: Optional[str] = None
    description: Optional[str] = None
    phone: Optional[str] = None
    latitude: Optional[float] = None
    longitude: Optional[float] = None
    price_from: Optional[int] = None
    price_unit: Optional[str] = None
    attr_ids: Optional[List[int]] = None
    is_active: Optional[bool] = None

    @field_validator('name')
    @classmethod
    def name_ok(cls, val):
        if val is None:
            return None
        val = val.strip()
        if not val:
            raise ValueError('Имя/название не может быть пустым')
        if len(val) > 200:
            raise ValueError('Название не должно быть длиннее 200 символов')
        return val

    @field_validator('description')
    @classmethod
    def description_ok(cls, val):
        if val is None:
            return None
        val = val.strip()
        if len(val) > 5000:
            raise ValueError('Описание не должно быть длиннее 5000 символов')
        return val

    @field_validator('phone')
    @classmethod
    def phone_ok(cls, val):
        if val is None:
            return None
        val = val.strip()
        if len(val) > 20:
            raise ValueError('Телефон не должен быть длиннее 20 символов')
        return val

    @field_validator('latitude')
    @classmethod
    def lat_ok(cls, val):
        if val is not None and not (-90 <= val <= 90):
            raise ValueError('Широта должна быть в диапазоне [-90, 90]')
        return val

    @field_validator('longitude')
    @classmethod
    def lng_ok(cls, val):
        if val is not None and not (-180 <= val <= 180):
            raise ValueError('Долгота должна быть в диапазоне [-180, 180]')
        return val

    @field_validator('price_from')
    @classmethod
    def price_ok(cls, val):
        if val is None:
            return None
        if val < 0 or val > 1_000_000_000:
            raise ValueError('Некорректная цена')
        return val

    @field_validator('price_unit')
    @classmethod
    def price_unit_ok(cls, val):
        if val is None:
            return None
        val = val.strip()
        if not val:
            return None
        if val not in PRICE_UNITS:
            raise ValueError(f'price_unit должен быть одним из: {sorted(PRICE_UNITS)}')
        return val


class PhotoOrderBody(BaseModel):
    photo_ids: List[int]

    @field_validator('photo_ids')
    @classmethod
    def not_empty(cls, val):
        if not val:
            raise ValueError('Список photo_ids не может быть пустым')
        return val


# -------------------------------------------------------------------------
# Хелперы
# -------------------------------------------------------------------------

async def _category_exists(category_id: int) -> bool:
    rows = await query_db(f"SELECT 1 AS x FROM categories WHERE id = {fit_to_sql(category_id)}")
    return bool(rows)


async def _city_exists(city_id: int) -> bool:
    rows = await query_db(f"SELECT 1 AS x FROM cities WHERE id = {fit_to_sql(city_id)}")
    return bool(rows)


async def _validate_attrs(attr_ids: List[int], category_id: int) -> None:
    """Атрибуты должны существовать И принадлежать категории исполнителя."""
    if not attr_ids:
        return
    ids_sql = ', '.join(str(int(i)) for i in attr_ids)
    rows = await query_db(f"""
        SELECT id FROM provider_attr_types
        WHERE id IN ({ids_sql})
          AND category_id = {fit_to_sql(category_id)}
    """)
    found = {r['id'] for r in rows}
    missing = set(attr_ids) - found
    if missing:
        raise WarnException(400, f'Неизвестные атрибуты для этой категории: {sorted(missing)}')


async def _replace_attrs(provider_id: int, attr_ids: List[int]) -> None:
    await query_db(f"DELETE FROM provider_attr_links WHERE provider_id = {fit_to_sql(provider_id)}")
    for aid in attr_ids:
        await query_db(f"""
            INSERT INTO provider_attr_links (provider_id, attr_id)
            VALUES ({fit_to_sql(provider_id)}, {fit_to_sql(aid)})
        """)


async def _provider_photos(provider_id: int) -> List[dict]:
    return await query_db(f"""
        SELECT id, file_path, thumb_path, sort_order
        FROM provider_photos
        WHERE provider_id = {fit_to_sql(provider_id)}
        ORDER BY sort_order, id
    """)


async def _provider_attrs(provider_id: int) -> List[dict]:
    return await query_db(f"""
        SELECT a.id, a.code, a.name_ru, a.name_kz, a.icon
        FROM provider_attr_links pal
        JOIN provider_attr_types a ON a.id = pal.attr_id
        WHERE pal.provider_id = {fit_to_sql(provider_id)}
        ORDER BY a.sort_order, a.id
    """)


def _provider_public(row: dict) -> dict:
    return {
        'id': row['id'],
        'guid': row['guid'],
        'category_id': row['category_id'],
        'city_id': row['city_id'],
        'name': row['name'],
        'description': row['description'],
        'phone': row['phone'],
        'latitude': float(row['latitude']) if row['latitude'] is not None else None,
        'longitude': float(row['longitude']) if row['longitude'] is not None else None,
        'price_from': row['price_from'],
        'price_unit': row['price_unit'],
        'is_active': row['is_active'],
        'created_at': row['created_at'],
        'updated_at': row['updated_at'],
    }


# -------------------------------------------------------------------------
# Роуты — CRUD
# -------------------------------------------------------------------------

@router.get('/my')
async def my_providers(user=Depends(auth_user)):
    providers = await query_db(f"""
        SELECT p.id, p.guid, p.category_id, p.city_id, p.name, p.description,
               p.phone, p.latitude, p.longitude, p.price_from, p.price_unit,
               p.is_active, p.created_at, p.updated_at,
               cat.code AS category_code,
               cat.name_ru AS category_name_ru,
               cat.name_kz AS category_name_kz
        FROM providers p
        JOIN categories cat ON cat.id = p.category_id
        WHERE p.owner_id = {fit_to_sql(user['id'])}
        ORDER BY p.id DESC
    """)
    if not providers:
        return {'items': []}

    ids = [p['id'] for p in providers]
    ids_sql = ', '.join(str(i) for i in ids)
    thumbs = await query_db(f"""
        SELECT DISTINCT ON (provider_id) provider_id, thumb_path
        FROM provider_photos
        WHERE provider_id IN ({ids_sql})
        ORDER BY provider_id, sort_order, id
    """)
    thumb_by_provider = {t['provider_id']: t['thumb_path'] for t in thumbs}

    items = []
    for p in providers:
        item = _provider_public(p)
        item['category'] = {
            'id': p['category_id'],
            'code': p['category_code'],
            'name_ru': p['category_name_ru'],
            'name_kz': p['category_name_kz'],
        }
        item['main_thumb'] = thumb_by_provider.get(p['id'])
        items.append(item)
    return {'items': items}


@router.post('')
async def create_provider(body: ProviderCreateBody, user=Depends(auth_user)):
    if not await _category_exists(body.category_id):
        raise WarnException(400, 'Категория не найдена в справочнике')
    if not await _city_exists(body.city_id):
        raise WarnException(400, 'Город не найден в справочнике')
    await _validate_attrs(body.attr_ids, body.category_id)

    now = get_timestamp_now()
    guid = new_guid()
    rows = await query_db(f"""
        INSERT INTO providers (
            guid, owner_id, category_id, city_id, name, description,
            phone, latitude, longitude, price_from, price_unit,
            is_active, created_at, updated_at
        )
        VALUES (
            {fit_to_sql(guid)},
            {fit_to_sql(user['id'])},
            {fit_to_sql(body.category_id)},
            {fit_to_sql(body.city_id)},
            {fit_to_sql(body.name)},
            {fit_to_sql(body.description)},
            {fit_to_sql(body.phone)},
            {fit_to_sql(body.latitude)},
            {fit_to_sql(body.longitude)},
            {fit_to_sql(body.price_from)},
            {fit_to_sql(body.price_unit)},
            true,
            {fit_to_sql(now)},
            {fit_to_sql(now)}
        )
        RETURNING id, guid, category_id, city_id, name, description,
                  phone, latitude, longitude, price_from, price_unit,
                  is_active, created_at, updated_at
    """)
    provider = rows[0]
    await _replace_attrs(provider['id'], body.attr_ids)

    result = _provider_public(provider)
    result['attrs'] = await _provider_attrs(provider['id'])
    result['photos'] = []
    return {'provider': result}


@router.get('/{guid}')
async def get_provider(guid: str, user=Depends(auth_user)):
    provider = await require_provider_owner(guid, user)
    result = _provider_public(provider)
    result['photos'] = await _provider_photos(provider['id'])
    result['attrs'] = await _provider_attrs(provider['id'])
    return {'provider': result}


@router.patch('/{guid}')
async def patch_provider(guid: str, body: ProviderPatchBody, user=Depends(auth_user)):
    provider = await require_provider_owner(guid, user)

    # Категория, относительно которой валидируем атрибуты (новая или текущая)
    target_category = body.category_id if body.category_id is not None else provider['category_id']

    updates = []
    if body.category_id is not None:
        if not await _category_exists(body.category_id):
            raise WarnException(400, 'Категория не найдена в справочнике')
        updates.append(f"category_id = {fit_to_sql(body.category_id)}")
    if body.city_id is not None:
        if not await _city_exists(body.city_id):
            raise WarnException(400, 'Город не найден в справочнике')
        updates.append(f"city_id = {fit_to_sql(body.city_id)}")
    if body.name is not None:
        updates.append(f"name = {fit_to_sql(body.name)}")
    if body.description is not None:
        updates.append(f"description = {fit_to_sql(body.description)}")
    if body.phone is not None:
        updates.append(f"phone = {fit_to_sql(body.phone)}")
    if body.latitude is not None:
        updates.append(f"latitude = {fit_to_sql(body.latitude)}")
    if body.longitude is not None:
        updates.append(f"longitude = {fit_to_sql(body.longitude)}")
    if body.price_from is not None:
        updates.append(f"price_from = {fit_to_sql(body.price_from)}")
    if body.price_unit is not None:
        updates.append(f"price_unit = {fit_to_sql(body.price_unit)}")
    if body.is_active is not None:
        updates.append(f"is_active = {fit_to_sql(body.is_active)}")

    if body.attr_ids is not None:
        await _validate_attrs(body.attr_ids, target_category)
        await _replace_attrs(provider['id'], body.attr_ids)

    if not updates and body.attr_ids is None:
        raise WarnException(400, 'Нет полей для обновления')

    if updates:
        updates.append(f"updated_at = {fit_to_sql(get_timestamp_now())}")
        set_clause = ', '.join(updates)
        await query_db(f"""
            UPDATE providers SET {set_clause}
            WHERE id = {fit_to_sql(provider['id'])}
        """)

    fresh = await query_db(f"""
        SELECT id, guid, category_id, city_id, name, description,
               phone, latitude, longitude, price_from, price_unit,
               is_active, created_at, updated_at
        FROM providers WHERE id = {fit_to_sql(provider['id'])}
    """)
    result = _provider_public(fresh[0])
    result['photos'] = await _provider_photos(provider['id'])
    result['attrs'] = await _provider_attrs(provider['id'])
    return {'provider': result}


@router.delete('/{guid}')
async def delete_provider(guid: str, user=Depends(auth_user)):
    """Жёсткий DELETE. Каскад по FK; файлы фото удаляем с диска вручную."""
    provider = await require_provider_owner(guid, user)

    photos = await query_db(f"""
        SELECT file_path, thumb_path FROM provider_photos
        WHERE provider_id = {fit_to_sql(provider['id'])}
    """)
    await query_db(f"DELETE FROM providers WHERE id = {fit_to_sql(provider['id'])}")

    for p in photos:
        delete_photo_files(p['file_path'], p['thumb_path'])
    return {'deleted': True}


# -------------------------------------------------------------------------
# Роуты — фото
# -------------------------------------------------------------------------

@router.post('/{guid}/photos')
async def upload_photos(
    guid: str,
    files: List[UploadFile] = File(...),
    user=Depends(auth_user),
):
    provider = await require_provider_owner(guid, user)

    if not files:
        raise WarnException(400, 'Нет файлов для загрузки')

    existing = await query_db(f"""
        SELECT COUNT(*)::int AS n,
               COALESCE(MAX(sort_order), -1)::int AS max_order
        FROM provider_photos WHERE provider_id = {fit_to_sql(provider['id'])}
    """)
    existing_count = existing[0]['n']
    next_order = existing[0]['max_order'] + 1

    limit = 20
    if existing_count + len(files) > limit:
        raise WarnException(
            400,
            f'Превышен лимит фото: {limit}. Уже загружено {existing_count}, '
            f'в запросе {len(files)}'
        )

    now = get_timestamp_now()
    created = []
    for upload in files:
        content = await upload.read()
        file_path, thumb_path = await save_provider_photo(
            provider_id=provider['id'],
            filename=upload.filename or 'photo',
            content=content,
        )
        rows = await query_db(f"""
            INSERT INTO provider_photos (provider_id, file_path, thumb_path, sort_order, created_at)
            VALUES (
                {fit_to_sql(provider['id'])},
                {fit_to_sql(file_path)},
                {fit_to_sql(thumb_path)},
                {fit_to_sql(next_order)},
                {fit_to_sql(now)}
            )
            RETURNING id, file_path, thumb_path, sort_order
        """)
        created.append(rows[0])
        next_order += 1

    return {'items': created}


@router.delete('/photos/{photo_id}')
async def delete_photo(photo_id: int, user=Depends(auth_user)):
    rows = await query_db(f"""
        SELECT pp.id, pp.provider_id, pp.file_path, pp.thumb_path,
               p.owner_id
        FROM provider_photos pp
        JOIN providers p ON p.id = pp.provider_id
        WHERE pp.id = {fit_to_sql(photo_id)}
    """)
    if not rows:
        raise WarnException(404, 'Фото не найдено')
    photo = rows[0]
    if photo['owner_id'] != user['id']:
        raise WarnException(403, 'Недостаточно прав')

    await query_db(f"DELETE FROM provider_photos WHERE id = {fit_to_sql(photo_id)}")
    delete_photo_files(photo['file_path'], photo['thumb_path'])
    return {'deleted': True}


@router.patch('/{guid}/photos/order')
async def reorder_photos(guid: str, body: PhotoOrderBody, user=Depends(auth_user)):
    provider = await require_provider_owner(guid, user)

    existing = await query_db(f"""
        SELECT id FROM provider_photos WHERE provider_id = {fit_to_sql(provider['id'])}
    """)
    existing_ids = {r['id'] for r in existing}
    requested_ids = set(body.photo_ids)

    if requested_ids != existing_ids:
        raise WarnException(400, 'Список photo_ids должен содержать ВСЕ id текущих фото')

    for order, pid in enumerate(body.photo_ids):
        await query_db(f"""
            UPDATE provider_photos SET sort_order = {fit_to_sql(order)}
            WHERE id = {fit_to_sql(pid)}
        """)

    photos = await _provider_photos(provider['id'])
    return {'items': photos}
