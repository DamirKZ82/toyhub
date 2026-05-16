"""
Чаты — переписка между клиентом и владельцем по КОНКРЕТНОМУ ЗАЛУ.

Один чат между клиентом и залом (UNIQUE hall_id + client_id).
Чат создаётся либо явно (POST /halls/{guid}/chat — кнопка "Написать"),
либо автоматически при создании заявки на этот зал.

Если клиент уже писал в чат и потом подал заявку — booking_id обновляется
в существующем чате.

Эндпоинты:
    GET  /chats                       — список чатов текущего юзера
    GET  /chats/unread-count          — общее число непрочитанных
    GET  /chats/{guid}                — детали чата + список сообщений
    POST /chats/{guid}/messages       — отправить сообщение
    POST /chats/{guid}/mark-read      — пометить как прочитанные
    POST /halls/{guid}/chat           — создать или вернуть существующий чат по залу
"""

from fastapi import APIRouter, Depends

from connections.connect_postgres import query_db, transaction
from handlers.h01_errors import WarnException
from handlers.h03_auth import auth_user
from libs.common import fit_to_sql, new_guid
from libs.date import get_timestamp_now
from libs.fcm import send_push
from libs.ownership import get_hall_by_guid, get_provider_by_guid


router = APIRouter(tags=['chats'])


# -------------------------------------------------------------------------
# Вспомогательное
# -------------------------------------------------------------------------

_CHAT_COLS = """
    c.id, c.guid, c.hall_id, c.provider_id, c.client_id, c.owner_id,
    c.booking_id, c.last_message_at, c.last_message_preview, c.created_at
"""


async def _get_chat_by_guid(guid: str) -> dict | None:
    rows = await query_db(f"""
        SELECT {_CHAT_COLS}
        FROM chats c
        WHERE c.guid = {fit_to_sql(guid)}
    """)
    return rows[0] if rows else None


async def _get_chat_access(guid: str, user_id: int) -> dict | None:
    """Вернёт чат, если юзер имеет доступ (клиент или владелец)."""
    chat = await _get_chat_by_guid(guid)
    if chat is None:
        return None
    if chat['client_id'] != user_id and chat['owner_id'] != user_id:
        return None
    return chat


async def _chat_list_row(chat_row: dict, current_user_id: int) -> dict:
    """Обогатить запись чата для списка/деталей."""
    # Собеседник
    other_id = chat_row['owner_id'] if chat_row['client_id'] == current_user_id else chat_row['client_id']
    rows = await query_db(f"""
        SELECT full_name, phone FROM users WHERE id = {fit_to_sql(other_id)}
    """)
    other_name = rows[0]['full_name'] if rows else None
    other_phone = rows[0]['phone'] if rows else None

    # Subject чата — зал ИЛИ исполнитель (для карточки в шапке и превью в списке)
    hall = None
    provider = None
    if chat_row['hall_id'] is not None:
        rows = await query_db(f"""
            SELECT
                h.guid AS hall_guid, h.name AS hall_name,
                h.price_weekday, h.price_weekend,
                (SELECT p.thumb_path FROM hall_photos p
                    WHERE p.hall_id = h.id
                    ORDER BY p.sort_order ASC, p.id ASC LIMIT 1) AS main_thumb,
                (SELECT p.file_path FROM hall_photos p
                    WHERE p.hall_id = h.id
                    ORDER BY p.sort_order ASC, p.id ASC LIMIT 1) AS main_photo
            FROM halls h
            WHERE h.id = {fit_to_sql(chat_row['hall_id'])}
        """)
        hr = rows[0] if rows else {}
        hall = {
            'guid': hr.get('hall_guid'),
            'name': hr.get('hall_name'),
            'main_thumb': hr.get('main_thumb'),
            'main_photo': hr.get('main_photo'),
            'price_weekday': hr.get('price_weekday'),
            'price_weekend': hr.get('price_weekend'),
        } if hr else None
        subject = {
            'type': 'hall',
            'guid': hr.get('hall_guid'),
            'name': hr.get('hall_name'),
            'main_thumb': hr.get('main_thumb'),
            'main_photo': hr.get('main_photo'),
        }
    else:
        rows = await query_db(f"""
            SELECT
                p.guid AS provider_guid, p.name AS provider_name,
                p.price_from, p.price_unit, cat.code AS category_code,
                (SELECT pp.thumb_path FROM provider_photos pp
                    WHERE pp.provider_id = p.id
                    ORDER BY pp.sort_order ASC, pp.id ASC LIMIT 1) AS main_thumb,
                (SELECT pp.file_path FROM provider_photos pp
                    WHERE pp.provider_id = p.id
                    ORDER BY pp.sort_order ASC, pp.id ASC LIMIT 1) AS main_photo
            FROM providers p
            JOIN categories cat ON cat.id = p.category_id
            WHERE p.id = {fit_to_sql(chat_row['provider_id'])}
        """)
        pr = rows[0] if rows else {}
        provider = {
            'guid': pr.get('provider_guid'),
            'name': pr.get('provider_name'),
            'main_thumb': pr.get('main_thumb'),
            'main_photo': pr.get('main_photo'),
            'price_from': pr.get('price_from'),
            'price_unit': pr.get('price_unit'),
            'category_code': pr.get('category_code'),
        } if pr else None
        subject = {
            'type': 'provider',
            'guid': pr.get('provider_guid'),
            'name': pr.get('provider_name'),
            'main_thumb': pr.get('main_thumb'),
            'main_photo': pr.get('main_photo'),
            'category_code': pr.get('category_code'),
        }

    # Заявка (если есть)
    booking = None
    if chat_row['booking_id']:
        rows = await query_db(f"""
            SELECT guid, event_date, status
            FROM bookings WHERE id = {fit_to_sql(chat_row['booking_id'])}
        """)
        if rows:
            booking = {
                'guid': rows[0]['guid'],
                'event_date': rows[0]['event_date'],
                'status': rows[0]['status'],
            }

    # Unread (для меня)
    rows = await query_db(f"""
        SELECT COUNT(*) AS n FROM chat_messages
        WHERE chat_id = {fit_to_sql(chat_row['id'])}
          AND sender_id <> {fit_to_sql(current_user_id)}
          AND read_at IS NULL
    """)
    unread = rows[0]['n'] if rows else 0

    # Информация о последнем сообщении — для галочек прочитанности в превью
    rows = await query_db(f"""
        SELECT sender_id, read_at
        FROM chat_messages
        WHERE chat_id = {fit_to_sql(chat_row['id'])}
        ORDER BY id DESC LIMIT 1
    """)
    last_sender_id = rows[0]['sender_id'] if rows else None
    last_read_at = rows[0]['read_at'] if rows else None

    return {
        'guid': chat_row['guid'],
        'subject': subject,
        'hall': hall,
        'provider': provider,
        'booking': booking,
        'other_user': {
            'name': other_name,
            'phone': other_phone,
        },
        'last_message_at': chat_row['last_message_at'],
        'last_message_preview': chat_row['last_message_preview'],
        'last_message_is_mine': last_sender_id == current_user_id if last_sender_id else None,
        'last_message_read': last_read_at is not None if last_sender_id else None,
        'unread_count': unread,
        'is_owner': chat_row['owner_id'] == current_user_id,
    }


async def _get_or_create_chat(subject_col: str, subject_id: int,
                              owner_id: int, client_id: int) -> dict:
    """
    Вернёт существующий чат между клиентом и subject (зал/исполнитель) или создаст.
    subject_col — 'hall_id' либо 'provider_id'.
    Если клиент == владелец — WarnException 400.
    """
    if client_id == owner_id:
        raise WarnException(400, 'Нельзя написать самому себе')

    rows = await query_db(f"""
        SELECT {_CHAT_COLS.replace('c.', '')}
        FROM chats
        WHERE {subject_col} = {fit_to_sql(subject_id)}
          AND client_id = {fit_to_sql(client_id)}
    """)
    if rows:
        return rows[0]

    guid = new_guid()
    now = get_timestamp_now()
    await query_db(f"""
        INSERT INTO chats (guid, {subject_col}, client_id, owner_id, created_at)
        VALUES (
            {fit_to_sql(guid)},
            {fit_to_sql(subject_id)},
            {fit_to_sql(client_id)},
            {fit_to_sql(owner_id)},
            {fit_to_sql(now)}
        )
    """)
    rows = await query_db(f"""
        SELECT {_CHAT_COLS.replace('c.', '')}
        FROM chats WHERE guid = {fit_to_sql(guid)}
    """)
    return rows[0]


# -------------------------------------------------------------------------
# POST /halls/{guid}/chat — кнопка "Написать"
# -------------------------------------------------------------------------

@router.post('/halls/{guid}/chat')
async def open_chat_with_hall(guid: str, user=Depends(auth_user)):
    """
    Создать чат с владельцем зала (или вернуть существующий).
    Используется кнопкой "Написать" на карточке зала.
    """
    hall = await get_hall_by_guid(guid)
    if hall is None or not hall.get('is_active', True):
        raise WarnException(404, 'Зал не найден')

    # Владелец зала — ищем через venue
    rows = await query_db(f"""
        SELECT v.owner_id
        FROM venues v
        WHERE v.id = {fit_to_sql(hall['venue_id'])}
    """)
    if not rows:
        raise WarnException(404, 'Заведение не найдено')
    owner_id = rows[0]['owner_id']

    chat = await _get_or_create_chat('hall_id', hall['id'], owner_id, user['id'])
    return {'chat_guid': chat['guid']}


@router.post('/providers/{guid}/chat')
async def open_chat_with_provider(guid: str, user=Depends(auth_user)):
    """
    Создать чат с исполнителем (или вернуть существующий).
    Используется кнопкой "Написать" на карточке исполнителя.
    """
    provider = await get_provider_by_guid(guid)
    if provider is None or not provider.get('is_active', True):
        raise WarnException(404, 'Исполнитель не найден')

    chat = await _get_or_create_chat(
        'provider_id', provider['id'], provider['owner_id'], user['id'],
    )
    return {'chat_guid': chat['guid']}


# -------------------------------------------------------------------------
# GET /chats — список чатов
# -------------------------------------------------------------------------

@router.get('/chats')
async def list_chats(user=Depends(auth_user)):
    rows = await query_db(f"""
        SELECT {_CHAT_COLS}
        FROM chats c
        WHERE c.client_id = {fit_to_sql(user['id'])}
           OR c.owner_id  = {fit_to_sql(user['id'])}
        ORDER BY
            CASE WHEN c.last_message_at IS NULL THEN 1 ELSE 0 END,
            c.last_message_at DESC,
            c.created_at DESC
    """)
    items = []
    for r in rows:
        items.append(await _chat_list_row(r, user['id']))
    return {'items': items}


# -------------------------------------------------------------------------
# GET /chats/unread-count
# -------------------------------------------------------------------------

@router.get('/chats/unread-count')
async def unread_count(user=Depends(auth_user)):
    rows = await query_db(f"""
        SELECT COUNT(*) AS n
        FROM chat_messages m
        JOIN chats c ON c.id = m.chat_id
        WHERE m.read_at IS NULL
          AND m.sender_id <> {fit_to_sql(user['id'])}
          AND (c.client_id = {fit_to_sql(user['id'])} OR c.owner_id = {fit_to_sql(user['id'])})
    """)
    return {'unread_count': rows[0]['n'] if rows else 0}


# -------------------------------------------------------------------------
# GET /chats/{guid} — детали + сообщения
# -------------------------------------------------------------------------

@router.get('/chats/{guid}')
async def get_chat(guid: str, user=Depends(auth_user)):
    chat = await _get_chat_access(guid, user['id'])
    if chat is None:
        raise WarnException(404, 'Чат не найден')

    messages = await query_db(f"""
        SELECT id, guid, sender_id, text, created_at, read_at
        FROM chat_messages
        WHERE chat_id = {fit_to_sql(chat['id'])}
        ORDER BY id ASC
    """)

    header = await _chat_list_row(chat, user['id'])

    return {
        'chat': header,
        'messages': [
            {
                'guid': m['guid'],
                'text': m['text'],
                'sender_id': m['sender_id'],
                'is_mine': m['sender_id'] == user['id'],
                'created_at': m['created_at'],
                'read_at': m['read_at'],
            }
            for m in messages
        ],
    }


# -------------------------------------------------------------------------
# POST /chats/{guid}/messages — отправить
# -------------------------------------------------------------------------

@router.post('/chats/{guid}/messages')
async def send_message(guid: str, body: dict, user=Depends(auth_user)):
    text = (body.get('text') or '').strip()
    if not text:
        raise WarnException(400, 'Сообщение не может быть пустым')
    if len(text) > 2000:
        raise WarnException(400, 'Сообщение слишком длинное (максимум 2000 символов)')

    chat = await _get_chat_access(guid, user['id'])
    if chat is None:
        raise WarnException(404, 'Чат не найден')

    ts = get_timestamp_now()
    msg_guid = new_guid()

    preview = text.replace('\n', ' ').replace('\r', ' ')
    if len(preview) > 100:
        preview = preview[:100]

    async with transaction() as tx:
        await tx.query(f"""
            INSERT INTO chat_messages (guid, chat_id, sender_id, text, created_at)
            VALUES (
                {fit_to_sql(msg_guid)},
                {fit_to_sql(chat['id'])},
                {fit_to_sql(user['id'])},
                {fit_to_sql(text)},
                {fit_to_sql(ts)}
            )
        """)
        await tx.query(f"""
            UPDATE chats
            SET last_message_at = {fit_to_sql(ts)},
                last_message_preview = {fit_to_sql(preview)}
            WHERE id = {fit_to_sql(chat['id'])}
        """)

    recipient_id = chat['owner_id'] if chat['client_id'] == user['id'] else chat['client_id']
    await send_push(
        recipient_id,
        title='Новое сообщение',
        body=preview,
        data={'type': 'chat_message', 'chat_guid': guid},
    )

    return {
        'message': {
            'guid': msg_guid,
            'text': text,
            'sender_id': user['id'],
            'is_mine': True,
            'created_at': ts,
            'read_at': None,
        },
    }


# -------------------------------------------------------------------------
# POST /chats/{guid}/mark-read
# -------------------------------------------------------------------------

@router.post('/chats/{guid}/mark-read')
async def mark_read(guid: str, user=Depends(auth_user)):
    chat = await _get_chat_access(guid, user['id'])
    if chat is None:
        raise WarnException(404, 'Чат не найден')

    ts = get_timestamp_now()
    await query_db(f"""
        UPDATE chat_messages
        SET read_at = {fit_to_sql(ts)}
        WHERE chat_id = {fit_to_sql(chat['id'])}
          AND sender_id <> {fit_to_sql(user['id'])}
          AND read_at IS NULL
    """)
    return {'marked': True}
