"""
Сиды справочников:
- cities   — крупные города Казахстана
- holidays — праздничные даты РК (MVP-диапазон: текущий и следующий год)
- event_types — типы мероприятий
- hall_amenities — опции зала (чекбоксы)

Идемпотентно: используем INSERT ... ON CONFLICT DO NOTHING.
"""
import pathlib
from datetime import datetime

from connections.connect_postgres import query_db
from libs.common import fit_to_sql
from libs.date import get_timestamp_now, KZ_TZ


# -------------------------------------------------------------------------
# Миграции
# -------------------------------------------------------------------------

async def apply_migrations():
    """Применить db/migrations.sql. Все CREATE TABLE — IF NOT EXISTS."""
    sql_path = pathlib.Path(__file__).resolve().parent.parent / 'db' / 'migrations.sql'
    sql_text = sql_path.read_text(encoding='utf-8')
    # asyncpg умеет выполнять несколько statement'ов через execute()
    # но наш query_db делает fetch только для SELECT; для DDL-батча
    # используем прямое соединение.
    from connections.connect_postgres import _pool
    if _pool is None:
        raise RuntimeError('DB pool is not initialized')
    async with _pool.acquire() as conn:
        await conn.execute(sql_text)
    print(f"[{get_timestamp_now()}] ✅ Migrations applied")


# -------------------------------------------------------------------------
# Данные
# -------------------------------------------------------------------------

CITIES = [
    # Крупные города Казахстана. Список исчерпывающий для MVP; при необходимости дополним.
    ('Астана',       'Астана'),
    ('Алматы',       'Алматы'),
    ('Шымкент',      'Шымкент'),
    ('Караганда',    'Қарағанды'),
    ('Актобе',       'Ақтөбе'),
    ('Тараз',        'Тараз'),
    ('Павлодар',     'Павлодар'),
    ('Усть-Каменогорск', 'Өскемен'),
    ('Семей',        'Семей'),
    ('Атырау',       'Атырау'),
    ('Костанай',     'Қостанай'),
    ('Кызылорда',    'Қызылорда'),
    ('Уральск',      'Орал'),
    ('Петропавловск','Петропавл'),
    ('Актау',        'Ақтау'),
    ('Темиртау',     'Теміртау'),
    ('Туркестан',    'Түркістан'),
    ('Кокшетау',     'Көкшетау'),
    ('Талдыкорган',  'Талдықорған'),
    ('Экибастуз',    'Екібастұз'),
    ('Рудный',       'Рудный'),
    ('Жезказган',    'Жезқазған'),
    ('Балхаш',       'Балқаш'),
    ('Кентау',       'Кентау'),
    ('Жанаозен',     'Жаңаөзен'),
    ('Сатпаев',      'Сәтбаев'),
    ('Риддер',       'Риддер'),
    ('Степногорск',  'Степногорск'),
    ('Щучинск',      'Щучинск'),
    ('Шу',           'Шу'),
    ('Каскелен',     'Қаскелең'),
    ('Капшагай (Қонаев)', 'Қонаев'),
    ('Сарыагаш',     'Сарыағаш'),
    ('Жаркент',      'Жаркент'),
    ('Аягоз',        'Аягөз'),
    ('Байконур',     'Байқоңыр'),
]

# Фиксированные ежегодные праздники РК (месяц-день, название ru/kz).
# Наурыз — 21-22-23 марта, все три дня выходные.
ANNUAL_HOLIDAYS = [
    ('01-01', 'Новый год',                   'Жаңа жыл'),
    ('01-02', 'Новый год',                   'Жаңа жыл'),
    ('03-08', 'Международный женский день',  'Халықаралық әйелдер күні'),
    ('03-21', 'Наурыз мейрамы',              'Наурыз мейрамы'),
    ('03-22', 'Наурыз мейрамы',              'Наурыз мейрамы'),
    ('03-23', 'Наурыз мейрамы',              'Наурыз мейрамы'),
    ('05-01', 'Праздник единства народа Казахстана', 'Қазақстан халқының бірлігі мерекесі'),
    ('05-07', 'День защитника Отечества',    'Отан Қорғаушы күні'),
    ('05-09', 'День Победы',                 'Жеңіс күні'),
    ('07-06', 'День столицы',                'Астана күні'),
    ('08-30', 'День Конституции',            'Қазақстан Республикасы Конституциясы күні'),
    ('10-25', 'День Республики',             'Республика күні'),
    ('12-16', 'День Независимости',          'Тәуелсіздік күні'),
]

EVENT_TYPES = [
    ('wedding',     'Свадьба',                  'Үйлену тойы'),
    ('kyz_uzatu',   'Кыз узату',                'Қыз ұзату'),
    ('betashar',    'Беташар',                  'Беташар'),
    ('anniversary', 'Юбилей',                   'Мерейтой'),
    ('birthday',    'День рождения',            'Туған күн'),
    ('tusau_kesu',  'Тұсау кесу',               'Тұсау кесу'),
    ('sundet_toi',  'Сүндет той',               'Сүндет той'),
    ('corporate',   'Корпоратив',               'Корпоратив'),
    ('other',       'Другое',                   'Басқа'),
]

HALL_AMENITIES = [
    ('own_kitchen',    'Своя кухня',                 'Өз асүйі',              'kitchen'),
    ('bring_food',     'Можно со своей едой',        'Өз тағаммен келуге болады', 'food'),
    ('alcohol',        'Алкоголь разрешён',          'Алкоголь рұқсат етілген','wine'),
    ('stage',          'Сцена',                      'Сахна',                 'stage'),
    ('parking',        'Парковка',                   'Тұрақ',                 'parking'),
    ('air_conditioner','Кондиционер',                'Кондиционер',           'ac'),
    ('kids_zone',      'Детская зона',               'Балалар аймағы',        'kids'),
    ('dance_floor',    'Танцпол',                    'Би алаңы',              'dance'),
    ('sound_system',   'Звуковая аппаратура',        'Дыбыстық жабдық',       'sound'),
]


CATEGORIES = [
    # code, name_ru, name_kz, icon (MaterialCommunityIcons), sort_order
    ('restaurant', 'Рестораны и залы', 'Мейрамханалар мен залдар', 'silverware-fork-knife', 1),
    ('host',       'Тамада',           'Тамада',                    'microphone-variant',    2),
    ('artist',     'Артисты',          'Әртістер',                  'star',                  3),
    ('decorator',  'Декораторы',       'Декораторлар',              'balloon',               4),
    ('catering',   'Кейтеринг',        'Кейтеринг',                 'food-takeout-box',      5),
    ('media',      'Фото и видео',     'Фото және видео',           'camera',                6),
]

# Атрибуты по категориям: (category_code, attr_code, name_ru, name_kz, icon, sort_order).
# Категория restaurant атрибутов не имеет — у залов своя система hall_amenities.
PROVIDER_ATTR_TYPES = [
    # Тамада
    ('host', 'lang_kz',   'Казахский язык',      'Қазақ тілі',       None, 1),
    ('host', 'lang_ru',   'Русский язык',        'Орыс тілі',        None, 2),
    ('host', 'with_show', 'Шоу-программа',        'Шоу-бағдарлама',   None, 3),
    # Артисты
    ('artist', 'singer',   'Певец / вокалист',   'Әнші',             None, 1),
    ('artist', 'dancer',   'Танцор',             'Биші',             None, 2),
    ('artist', 'magician', 'Фокусник',           'Фокусшы',          None, 3),
    ('artist', 'band',     'Музыкальная группа', 'Музыкалық топ',    None, 4),
    ('artist', 'showman',  'Шоумен',             'Шоумен',           None, 5),
    # Декораторы
    ('decorator', 'flowers',  'Живые цветы',          'Тірі гүлдер',         None, 1),
    ('decorator', 'textile',  'Текстиль / драпировка', 'Тоқыма безендіру',    None, 2),
    ('decorator', 'balloons', 'Воздушные шары',       'Ауа шарлары',         None, 3),
    ('decorator', 'lighting', 'Световое оформление',  'Жарықпен безендіру',  None, 4),
    # Кейтеринг
    ('catering', 'european',   'Европейская кухня', 'Еуропалық тағамдар', None, 1),
    ('catering', 'kazakh',     'Казахская кухня',   'Қазақ тағамдары',    None, 2),
    ('catering', 'banquet',    'Банкетное меню',    'Банкет мәзірі',      None, 3),
    ('catering', 'fourchette', 'Фуршет',            'Фуршет',             None, 4),
    # Фото и видео
    ('media', 'photo',  'Фотосъёмка',        'Фотоға түсіру',        None, 1),
    ('media', 'video',  'Видеосъёмка',       'Видеоға түсіру',       None, 2),
    ('media', 'drone',  'Аэросъёмка (дрон)', 'Аэротүсірілім (дрон)', None, 3),
    ('media', 'studio', 'Студийная съёмка',  'Студиялық түсірілім',  None, 4),
]


async def seed_cities():
    rows = await query_db("SELECT COUNT(*)::int AS n FROM cities")
    if rows and rows[0]['n'] >= len(CITIES):
        return
    for name_ru, name_kz in CITIES:
        await query_db(f"""
            INSERT INTO cities (name_ru, name_kz)
            SELECT {fit_to_sql(name_ru)}, {fit_to_sql(name_kz)}
            WHERE NOT EXISTS (SELECT 1 FROM cities WHERE name_ru = {fit_to_sql(name_ru)})
        """)
    print(f"[{get_timestamp_now()}] 🌱 Cities seeded")


async def seed_event_types():
    for code, ru, kz in EVENT_TYPES:
        await query_db(f"""
            INSERT INTO event_types (code, name_ru, name_kz)
            VALUES ({fit_to_sql(code)}, {fit_to_sql(ru)}, {fit_to_sql(kz)})
            ON CONFLICT (code) DO NOTHING
        """)
    print(f"[{get_timestamp_now()}] 🌱 Event types seeded")


async def seed_amenities():
    for code, ru, kz, icon in HALL_AMENITIES:
        await query_db(f"""
            INSERT INTO hall_amenities (code, name_ru, name_kz, icon)
            VALUES ({fit_to_sql(code)}, {fit_to_sql(ru)}, {fit_to_sql(kz)}, {fit_to_sql(icon)})
            ON CONFLICT (code) DO NOTHING
        """)
    print(f"[{get_timestamp_now()}] 🌱 Amenities seeded")


async def seed_holidays():
    """
    Раскатываем ежегодные праздники на текущий и следующий год.
    Если в будущем потребуется расширить — просто вызови функцию ещё раз.
    """
    now_year = datetime.now(KZ_TZ).year
    for year in (now_year, now_year + 1):
        for md, ru, kz in ANNUAL_HOLIDAYS:
            date = f"{year}-{md}"
            await query_db(f"""
                INSERT INTO holidays (date, name_ru, name_kz)
                VALUES ({fit_to_sql(date)}, {fit_to_sql(ru)}, {fit_to_sql(kz)})
                ON CONFLICT (date) DO NOTHING
            """)
    print(f"[{get_timestamp_now()}] 🌱 Holidays seeded ({now_year}, {now_year + 1})")


async def seed_categories():
    for code, ru, kz, icon, order in CATEGORIES:
        await query_db(f"""
            INSERT INTO categories (code, name_ru, name_kz, icon, sort_order)
            VALUES ({fit_to_sql(code)}, {fit_to_sql(ru)}, {fit_to_sql(kz)},
                    {fit_to_sql(icon)}, {fit_to_sql(order)})
            ON CONFLICT (code) DO NOTHING
        """)
    print(f"[{get_timestamp_now()}] 🌱 Categories seeded")


async def seed_provider_attr_types():
    for cat_code, code, ru, kz, icon, order in PROVIDER_ATTR_TYPES:
        await query_db(f"""
            INSERT INTO provider_attr_types
                (category_id, code, name_ru, name_kz, icon, sort_order)
            SELECT c.id, {fit_to_sql(code)}, {fit_to_sql(ru)}, {fit_to_sql(kz)},
                   {fit_to_sql(icon)}, {fit_to_sql(order)}
            FROM categories c
            WHERE c.code = {fit_to_sql(cat_code)}
              AND NOT EXISTS (
                  SELECT 1 FROM provider_attr_types pat
                  WHERE pat.category_id = c.id
                    AND pat.code = {fit_to_sql(code)}
              )
        """)
    print(f"[{get_timestamp_now()}] 🌱 Provider attribute types seeded")


async def seed_all():
    await seed_cities()
    await seed_event_types()
    await seed_amenities()
    await seed_holidays()
    await seed_categories()
    await seed_provider_attr_types()
