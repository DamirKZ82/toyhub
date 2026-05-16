-- Toyhana — полный DDL.
-- Применяется один раз при первом запуске (idempotent: IF NOT EXISTS).
-- Даты/таймштампы — CHAR(10)/CHAR(19) согласно гайдлайнам.

-- =========================================================================
-- Справочники
-- =========================================================================

CREATE TABLE IF NOT EXISTS cities (
    id           SERIAL PRIMARY KEY,
    name_ru      VARCHAR(100) NOT NULL,
    name_kz      VARCHAR(100) NOT NULL,
    is_active    BOOLEAN DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS holidays (
    id           SERIAL PRIMARY KEY,
    date         CHAR(10) NOT NULL UNIQUE,
    name_ru      VARCHAR(200) NOT NULL,
    name_kz      VARCHAR(200) NOT NULL
);

CREATE TABLE IF NOT EXISTS event_types (
    id           SERIAL PRIMARY KEY,
    code         VARCHAR(50) UNIQUE NOT NULL,
    name_ru      VARCHAR(100) NOT NULL,
    name_kz      VARCHAR(100) NOT NULL
);

CREATE TABLE IF NOT EXISTS hall_amenities (
    id           SERIAL PRIMARY KEY,
    code         VARCHAR(50) UNIQUE NOT NULL,
    name_ru      VARCHAR(100) NOT NULL,
    name_kz      VARCHAR(100) NOT NULL,
    icon         VARCHAR(50)
);

-- =========================================================================
-- Пользователи
-- =========================================================================

CREATE TABLE IF NOT EXISTS users (
    id           SERIAL PRIMARY KEY,
    guid         CHAR(36) UNIQUE NOT NULL,
    phone        VARCHAR(20) UNIQUE NOT NULL,
    full_name    VARCHAR(200),
    language     CHAR(2) DEFAULT 'ru',
    fcm_token    VARCHAR(500),
    is_blocked   BOOLEAN DEFAULT FALSE,
    created_at   CHAR(19) NOT NULL,
    updated_at   CHAR(19) NOT NULL
);

CREATE TABLE IF NOT EXISTS otp_codes (
    id           SERIAL PRIMARY KEY,
    phone        VARCHAR(20) NOT NULL,
    code         CHAR(4) NOT NULL,
    created_at   CHAR(19) NOT NULL,
    expires_at   CHAR(19) NOT NULL,
    used         BOOLEAN DEFAULT FALSE
);

CREATE INDEX IF NOT EXISTS idx_otp_phone ON otp_codes(phone);

-- =========================================================================
-- Заведения и залы
-- =========================================================================

CREATE TABLE IF NOT EXISTS venues (
    id           SERIAL PRIMARY KEY,
    guid         CHAR(36) UNIQUE NOT NULL,
    owner_id     INT NOT NULL REFERENCES users(id),
    city_id      INT NOT NULL REFERENCES cities(id),
    name         VARCHAR(200) NOT NULL,
    address      VARCHAR(500) NOT NULL,
    latitude     DECIMAL(10, 7),
    longitude    DECIMAL(10, 7),
    description  TEXT,
    phone        VARCHAR(20),
    is_active    BOOLEAN DEFAULT TRUE,
    created_at   CHAR(19) NOT NULL,
    updated_at   CHAR(19) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_venues_owner ON venues(owner_id);
CREATE INDEX IF NOT EXISTS idx_venues_city  ON venues(city_id);

CREATE TABLE IF NOT EXISTS halls (
    id                SERIAL PRIMARY KEY,
    guid              CHAR(36) UNIQUE NOT NULL,
    venue_id          INT NOT NULL REFERENCES venues(id) ON DELETE CASCADE,
    name              VARCHAR(200) NOT NULL,
    description       TEXT,
    area_sqm          INT,
    capacity_min      INT,
    capacity_max      INT,
    price_weekday     INT NOT NULL,
    price_weekend     INT NOT NULL,
    is_active         BOOLEAN DEFAULT TRUE,
    created_at        CHAR(19) NOT NULL,
    updated_at        CHAR(19) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_halls_venue ON halls(venue_id);

CREATE TABLE IF NOT EXISTS hall_amenity_links (
    hall_id      INT NOT NULL REFERENCES halls(id) ON DELETE CASCADE,
    amenity_id   INT NOT NULL REFERENCES hall_amenities(id),
    PRIMARY KEY (hall_id, amenity_id)
);

CREATE TABLE IF NOT EXISTS hall_photos (
    id           SERIAL PRIMARY KEY,
    hall_id      INT NOT NULL REFERENCES halls(id) ON DELETE CASCADE,
    file_path    VARCHAR(500) NOT NULL,
    thumb_path   VARCHAR(500) NOT NULL,
    sort_order   INT DEFAULT 0,
    created_at   CHAR(19) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_hall_photos_hall ON hall_photos(hall_id);

-- =========================================================================
-- Бронирование
-- =========================================================================

CREATE TABLE IF NOT EXISTS bookings (
    id               SERIAL PRIMARY KEY,
    guid             CHAR(36) UNIQUE NOT NULL,
    hall_id          INT NOT NULL REFERENCES halls(id),
    client_id        INT NOT NULL REFERENCES users(id),
    event_date       CHAR(10) NOT NULL,
    guests_count     INT NOT NULL,
    event_type_id    INT REFERENCES event_types(id),
    comment          TEXT,
    status           VARCHAR(20) NOT NULL,    -- 'pending' | 'confirmed' | 'rejected' | 'cancelled'
    rejected_reason  TEXT,
    created_at       CHAR(19) NOT NULL,
    updated_at       CHAR(19) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_bookings_hall_date ON bookings(hall_id, event_date);
CREATE INDEX IF NOT EXISTS idx_bookings_client    ON bookings(client_id);

-- =========================================================================
-- Отзывы
-- =========================================================================

CREATE TABLE IF NOT EXISTS reviews (
    id              SERIAL PRIMARY KEY,
    guid            CHAR(36) UNIQUE NOT NULL,
    booking_id      INT NOT NULL UNIQUE REFERENCES bookings(id),
    hall_id         INT NOT NULL REFERENCES halls(id),
    client_id       INT NOT NULL REFERENCES users(id),
    rating          INT NOT NULL,
    text            TEXT,
    owner_reply     TEXT,
    owner_reply_at  CHAR(19),
    created_at      CHAR(19) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_reviews_hall ON reviews(hall_id);

-- =========================================================================
-- Избранное
-- =========================================================================

CREATE TABLE IF NOT EXISTS favorites (
    user_id      INT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    hall_id      INT NOT NULL REFERENCES halls(id) ON DELETE CASCADE,
    created_at   CHAR(19) NOT NULL,
    PRIMARY KEY (user_id, hall_id)
);

-- =========================================================================
-- Служебные (ошибки и варны)
-- =========================================================================

CREATE TABLE IF NOT EXISTS errors_back (
    id           SERIAL PRIMARY KEY,
    message      TEXT,
    traceback    TEXT,
    sql          TEXT,
    method       VARCHAR(10),
    path         VARCHAR(500),
    user_id      INT,
    created_at   CHAR(19) NOT NULL
);

CREATE TABLE IF NOT EXISTS errors_front (
    id           SERIAL PRIMARY KEY,
    message      TEXT,
    stack        TEXT,
    screen       VARCHAR(200),
    user_id      INT,
    created_at   CHAR(19) NOT NULL
);

CREATE TABLE IF NOT EXISTS warns (
    id           SERIAL PRIMARY KEY,
    code         INT,
    message      TEXT,
    method       VARCHAR(10),
    path         VARCHAR(500),
    user_id      INT,
    created_at   CHAR(19) NOT NULL
);

-- =========================================================================
-- Миграции (ALTER-ы). Добавляются в конец, все идемпотентные.
-- =========================================================================

-- Этап 3: цена фиксируется в момент бронирования.
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS price_at_booking INT;

-- =========================================================================
-- Этап 11: Чаты (переписка между клиентом и владельцем по залу)
--
-- Чат привязан к ЗАЛУ, а не к заявке. Один чат между клиентом и залом.
-- booking_id опционально — прикрепляется когда клиент оформляет заявку.
-- =========================================================================

-- Сносим старые таблицы, если они были созданы до этапа 11 (схема с booking_id UNIQUE)
DO $mig$
BEGIN
    IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'chats')
       AND NOT EXISTS (
           SELECT 1 FROM information_schema.columns
           WHERE table_name = 'chats' AND column_name = 'hall_id'
       )
    THEN
        DROP TABLE IF EXISTS chat_messages CASCADE;
        DROP TABLE IF EXISTS chats CASCADE;
    END IF;
END
$mig$;

CREATE TABLE IF NOT EXISTS chats (
    id                  SERIAL PRIMARY KEY,
    guid                CHAR(36) UNIQUE NOT NULL,
    hall_id             INT NOT NULL REFERENCES halls(id) ON DELETE CASCADE,
    client_id           INT NOT NULL REFERENCES users(id),
    owner_id            INT NOT NULL REFERENCES users(id),
    booking_id          INT REFERENCES bookings(id) ON DELETE SET NULL,
    last_message_at     CHAR(19),
    last_message_preview TEXT,
    created_at          CHAR(19) NOT NULL,
    UNIQUE (hall_id, client_id)
);

CREATE INDEX IF NOT EXISTS idx_chats_client ON chats(client_id, last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_chats_owner  ON chats(owner_id,  last_message_at DESC);
CREATE INDEX IF NOT EXISTS idx_chats_hall   ON chats(hall_id);

CREATE TABLE IF NOT EXISTS chat_messages (
    id          SERIAL PRIMARY KEY,
    guid        CHAR(36) UNIQUE NOT NULL,
    chat_id     INT NOT NULL REFERENCES chats(id) ON DELETE CASCADE,
    sender_id   INT NOT NULL REFERENCES users(id),
    text        TEXT NOT NULL,
    created_at  CHAR(19) NOT NULL,
    read_at     CHAR(19)    -- заполняется когда получатель прочитал
);

CREATE INDEX IF NOT EXISTS idx_chat_messages_chat ON chat_messages(chat_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_messages_unread ON chat_messages(chat_id, sender_id) WHERE read_at IS NULL;

-- =========================================================================
-- Этап 12: Категории и исполнители (providers)
--
-- Рестораны (venues/halls) НЕ трогаем. Новые категории (тамада, артисты,
-- декораторы, кейтеринг, фото-видео) — плоская сущность providers.
-- bookings / reviews / chats / favorites становятся полиморфными:
-- ссылаются ЛИБО на hall_id, ЛИБО на provider_id (ровно одно из двух).
-- =========================================================================

CREATE TABLE IF NOT EXISTS categories (
    id           SERIAL PRIMARY KEY,
    code         VARCHAR(50) UNIQUE NOT NULL,
    name_ru      VARCHAR(100) NOT NULL,
    name_kz      VARCHAR(100) NOT NULL,
    icon         VARCHAR(50),
    sort_order   INT DEFAULT 0
);

CREATE TABLE IF NOT EXISTS providers (
    id           SERIAL PRIMARY KEY,
    guid         CHAR(36) UNIQUE NOT NULL,
    owner_id     INT NOT NULL REFERENCES users(id),
    category_id  INT NOT NULL REFERENCES categories(id),
    city_id      INT NOT NULL REFERENCES cities(id),
    name         VARCHAR(200) NOT NULL,
    description  TEXT,
    phone        VARCHAR(20),
    latitude     DECIMAL(10, 7),
    longitude    DECIMAL(10, 7),
    price_from   INT,
    price_unit   VARCHAR(20),   -- 'event' | 'hour' | 'person' | 'day'
    is_active    BOOLEAN DEFAULT TRUE,
    created_at   CHAR(19) NOT NULL,
    updated_at   CHAR(19) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_providers_owner    ON providers(owner_id);
CREATE INDEX IF NOT EXISTS idx_providers_category ON providers(category_id);
CREATE INDEX IF NOT EXISTS idx_providers_city     ON providers(city_id);

CREATE TABLE IF NOT EXISTS provider_photos (
    id           SERIAL PRIMARY KEY,
    provider_id  INT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    file_path    VARCHAR(500) NOT NULL,
    thumb_path   VARCHAR(500) NOT NULL,
    sort_order   INT DEFAULT 0,
    created_at   CHAR(19) NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_provider_photos_provider ON provider_photos(provider_id);

-- Атрибуты по категориям (паттерн hall_amenities / hall_amenity_links).
-- Это «своя модель у категории»: для каждой категории — свой набор атрибутов
-- (артист → певец/танцор/фокусник; кейтеринг → кухня; и т.д.). Фильтруемые в поиске.
CREATE TABLE IF NOT EXISTS provider_attr_types (
    id           SERIAL PRIMARY KEY,
    category_id  INT NOT NULL REFERENCES categories(id),
    code         VARCHAR(50) NOT NULL,
    name_ru      VARCHAR(100) NOT NULL,
    name_kz      VARCHAR(100) NOT NULL,
    icon         VARCHAR(50),
    sort_order   INT DEFAULT 0,
    UNIQUE (category_id, code)
);

CREATE TABLE IF NOT EXISTS provider_attr_links (
    provider_id  INT NOT NULL REFERENCES providers(id) ON DELETE CASCADE,
    attr_id      INT NOT NULL REFERENCES provider_attr_types(id),
    PRIMARY KEY (provider_id, attr_id)
);

-- ---- Полиморфизм: bookings ----
ALTER TABLE bookings ADD COLUMN IF NOT EXISTS provider_id INT REFERENCES providers(id);
ALTER TABLE bookings ALTER COLUMN hall_id DROP NOT NULL;
DO $mig$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'bookings_subject_chk') THEN
        ALTER TABLE bookings ADD CONSTRAINT bookings_subject_chk
            CHECK ((hall_id IS NOT NULL) <> (provider_id IS NOT NULL));
    END IF;
END
$mig$;
CREATE INDEX IF NOT EXISTS idx_bookings_provider_date ON bookings(provider_id, event_date);

-- ---- Полиморфизм: reviews ----
ALTER TABLE reviews ADD COLUMN IF NOT EXISTS provider_id INT REFERENCES providers(id);
ALTER TABLE reviews ALTER COLUMN hall_id DROP NOT NULL;
DO $mig$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reviews_subject_chk') THEN
        ALTER TABLE reviews ADD CONSTRAINT reviews_subject_chk
            CHECK ((hall_id IS NOT NULL) <> (provider_id IS NOT NULL));
    END IF;
END
$mig$;
CREATE INDEX IF NOT EXISTS idx_reviews_provider ON reviews(provider_id);

-- ---- Полиморфизм: chats ----
ALTER TABLE chats ADD COLUMN IF NOT EXISTS provider_id INT REFERENCES providers(id);
ALTER TABLE chats ALTER COLUMN hall_id DROP NOT NULL;
ALTER TABLE chats DROP CONSTRAINT IF EXISTS chats_hall_id_client_id_key;
CREATE UNIQUE INDEX IF NOT EXISTS uq_chats_hall_client
    ON chats(hall_id, client_id) WHERE hall_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS uq_chats_provider_client
    ON chats(provider_id, client_id) WHERE provider_id IS NOT NULL;
DO $mig$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'chats_subject_chk') THEN
        ALTER TABLE chats ADD CONSTRAINT chats_subject_chk
            CHECK ((hall_id IS NOT NULL) <> (provider_id IS NOT NULL));
    END IF;
END
$mig$;
CREATE INDEX IF NOT EXISTS idx_chats_provider ON chats(provider_id);

-- ---- Полиморфизм: favorites ----
-- Старый PK (user_id, hall_id) больше не годится — заменяем на два
-- обычных UNIQUE-индекса (NULL'ы трактуются как различные, поэтому
-- избранные-исполнители с hall_id=NULL не конфликтуют между собой).
ALTER TABLE favorites ADD COLUMN IF NOT EXISTS provider_id INT REFERENCES providers(id);
ALTER TABLE favorites ALTER COLUMN hall_id DROP NOT NULL;
ALTER TABLE favorites DROP CONSTRAINT IF EXISTS favorites_pkey;
CREATE UNIQUE INDEX IF NOT EXISTS uq_favorites_user_hall
    ON favorites(user_id, hall_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_favorites_user_provider
    ON favorites(user_id, provider_id);
DO $mig$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'favorites_subject_chk') THEN
        ALTER TABLE favorites ADD CONSTRAINT favorites_subject_chk
            CHECK ((hall_id IS NOT NULL) <> (provider_id IS NOT NULL));
    END IF;
END
$mig$;

