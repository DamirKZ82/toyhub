# Toyhana 🎉

Мобильное приложение для бронирования банкетных залов в Казахстане. Аналог Krisha.kz, но для тойхана — мест проведения свадеб, юбилеев и других торжеств.

> **Статус:** MVP в активной разработке. Этап 11 завершён.

## ✨ Функционал

### Для гостей (без регистрации)
- 🔍 Поиск залов с фильтрами (город, дата, число гостей, цена, удобства)
- 📍 Сортировка по близости к текущей геолокации
- 🏛 Просмотр деталей зала: фото, цены, описание, удобства, отзывы
- 📅 Календарь занятости зала
- 🌗 Светлая и тёмная темы
- 🌐 Русский и казахский языки

### Для зарегистрированных клиентов
- ❤️ Избранные залы
- 💬 Чат с владельцем зала (даже до подачи заявки)
- 📨 Заявки на бронирование
- ⭐ Отзывы после посещения

### Для владельцев заведений
- 🏢 Создание заведения и нескольких залов
- 📷 Загрузка фотографий зала
- 📨 Управление входящими заявками (подтвердить / отклонить)
- 📅 Календарь занятости с управлением вручную (праздничные дни, ремонт)
- 💬 Переписка с клиентами
- 💬 Ответы на отзывы

## 🛠 Стек

### Бэкенд (`toyhana-back/`)
- **Python 3.12** + **FastAPI**
- **PostgreSQL 16** через `asyncpg`
- JWT аутентификация
- Inline f-string SQL через `fit_to_sql` (без ORM)
- Self-applying миграции при старте

### Фронтенд (`toyhana-front/`)
- **React Native 0.81** + **Expo SDK 54**
- **TypeScript**
- **Zustand** — state management
- **React Navigation v7** — навигация
- **React Native Paper** — UI компоненты
- **i18next** — мультиязычность
- **Axios** — HTTP клиент

## 📁 Структура

```
toyhana/
├── toyhana-back/         # Python FastAPI сервер
│   ├── routers/         # Эндпоинты (r01_auth, r20_venues, r30_bookings, ...)
│   ├── handlers/        # Auth, errors, CORS, route registration
│   ├── libs/            # Общие утилиты (auth, photos, sms, fcm, pricing)
│   ├── connections/     # Подключение к Postgres
│   ├── services/        # Сидеры (города, удобства, праздники)
│   ├── db/              # Миграции SQL
│   └── main.py          # Точка входа
│
└── toyhana-front/       # React Native Expo приложение
    ├── src/
    │   ├── screens/     # Экраны (auth, client, owner, messages, common)
    │   ├── components/  # Переиспользуемые компоненты
    │   ├── navigation/  # Навигация (стеки, табы, root)
    │   ├── api/         # API клиенты для каждого роутера
    │   ├── store/       # Zustand сторы
    │   ├── theme/       # Цвета, отступы, useStyles
    │   ├── utils/       # Вспомогательные функции
    │   └── i18n/        # Переводы (ru, kz)
    └── App.tsx
```

## 🚀 Локальный запуск

### Требования
- Python 3.12
- Node.js 20+
- PostgreSQL 16
- Expo Go на смартфоне (для дев-разработки)

### Подготовка БД

В PostgreSQL создай юзера и базу:

```sql
CREATE USER toyhana_user WITH PASSWORD 'твой_пароль';
CREATE DATABASE toyhana OWNER toyhana_user;
```

Все таблицы создадутся автоматически при первом запуске бэка.

### Запуск бэка

```powershell
cd toyhana-back

# Создать виртуальное окружение
python -m venv .venv
.\.venv\Scripts\Activate.ps1

# Установить зависимости
pip install -r requirements.txt

# Создать .env на основе примера
Copy-Item .env.example .env
# Отредактируй .env: пароль БД, JWT_SECRET (32+ случайных символа)

# Запустить
python main.py
```

Бэк поднимется на `http://localhost:4000`. Swagger: `http://localhost:4000/docs`.

### Запуск фронта

```powershell
cd toyhana-front

npm install --legacy-peer-deps

# Запустить Expo
npm start
```

Откроется Metro Bundler. На смартфоне открой Expo Go и отсканируй QR-код. Смартфон и компьютер должны быть **в одной WiFi сети**.

⚠️ В `toyhana-front/app.json` укажи актуальный IP компьютера:
```json
"extra": {
  "API_BASE_URL": "http://ВАШ_IP:4000"
}
```

Узнать IP в PowerShell: `ipconfig` → искать `IPv4 Address` (обычно `192.168.x.x`).

## 🧪 Тестовый OTP

В режиме разработки SMS не отправляются. Код для входа всегда **`0000`**.

Чтобы включить настоящие SMS — настроить SMS-провайдера в `libs/sms.py` (например Mobizon).

## 📌 Что в разработке

- [ ] Деплой бэка на VPS
- [ ] Реальные SMS через Mobizon/SMSC.kz
- [ ] EAS build (нативные APK/IPA, чтобы заработали push-уведомления)
- [ ] Интеграция 2ГИС для адресов
- [ ] Дизайнерский орнамент в фоне приложения
- [ ] Иконки и подготовка к публикации в App Store / Google Play

## 📝 Лицензия

Закрытый проект. Все права защищены.

## 👤 Автор

Damir — [@DamirKZ82](https://github.com/DamirKZ82)
