"""
Работа с фото:
    - определение формата (jpg/png/webp/heic)
    - ресайз до 1920 по длинной стороне, JPEG 85%
    - превью 400 по длинной стороне
    - сохранение в uploads/halls/{hall_id}/{uuid}.jpg и _thumb.jpg

Всё сохраняется как JPEG — это упрощает раздачу и избавляет от проблем с HEIC в браузерах.
"""
import io
import os
import pathlib
import uuid
from typing import Tuple

from PIL import Image, ImageOps

from config import config
from handlers.h01_errors import WarnException


# Регистрируем HEIC-декодер для Pillow. Если пакет не установлен — работаем без HEIC.
try:
    import pillow_heif
    pillow_heif.register_heif_opener()
    HEIC_SUPPORTED = True
except ImportError:
    HEIC_SUPPORTED = False


ALLOWED_EXTENSIONS = {'.jpg', '.jpeg', '.png', '.webp', '.heic', '.heif'}
MAX_FILE_BYTES = 15 * 1024 * 1024   # 15 МБ


def _uploads_root() -> pathlib.Path:
    root = pathlib.Path(config['uploads']['root']).resolve()
    root.mkdir(parents=True, exist_ok=True)
    return root


def _hall_dir(hall_id: int) -> pathlib.Path:
    dir_path = _uploads_root() / 'halls' / str(hall_id)
    dir_path.mkdir(parents=True, exist_ok=True)
    return dir_path


def _provider_dir(provider_id: int) -> pathlib.Path:
    dir_path = _uploads_root() / 'providers' / str(provider_id)
    dir_path.mkdir(parents=True, exist_ok=True)
    return dir_path


def _validate_extension(filename: str) -> str:
    """Вернёт расширение в нижнем регистре или бросит WarnException."""
    if not filename:
        raise WarnException(400, 'Имя файла обязательно')
    ext = pathlib.Path(filename).suffix.lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise WarnException(
            400,
            f'Неподдерживаемый формат файла: {ext}. Разрешены: jpg, jpeg, png, webp, heic'
        )
    return ext


def _resize_preserve_aspect(img: Image.Image, max_side: int) -> Image.Image:
    """Ресайз с сохранением пропорций: длинная сторона = max_side (или меньше, если исходник меньше)."""
    w, h = img.size
    long_side = max(w, h)
    if long_side <= max_side:
        return img.copy()
    ratio = max_side / long_side
    return img.resize((int(w * ratio), int(h * ratio)), Image.Resampling.LANCZOS)


async def _save_image(content: bytes, filename: str,
                      dir_path: pathlib.Path, url_dir: str) -> Tuple[str, str]:
    """
    Общая логика сохранения фото (валидация, ресайз, запись на диск).
    url_dir — относительный префикс вида 'halls/1' или 'providers/1'.
    Вернёт (file_path, thumb_path) — относительные URL под /uploads/.
    """
    if len(content) > MAX_FILE_BYTES:
        raise WarnException(400, 'Размер файла превышает 15 МБ')
    if len(content) == 0:
        raise WarnException(400, 'Пустой файл')

    _validate_extension(filename)

    # Открываем через Pillow. Любая ошибка парсинга = "битый файл".
    try:
        img = Image.open(io.BytesIO(content))
        # EXIF-ориентация (iPhone часто снимает "на боку" и добавляет поворот в EXIF)
        img = ImageOps.exif_transpose(img)
        # Приводим к RGB (JPEG не поддерживает прозрачность)
        if img.mode not in ('RGB', 'L'):
            img = img.convert('RGB')
    except Exception:
        raise WarnException(400, 'Файл повреждён или не является изображением')

    # Ресайз
    main = _resize_preserve_aspect(img, config['uploads']['photo_max_long_side'])
    thumb = _resize_preserve_aspect(img, config['uploads']['photo_thumb_side'])

    # Имя файла — uuid, чтобы избежать коллизий и не светить оригинальное имя
    base = uuid.uuid4().hex
    main_fs = dir_path / f'{base}.jpg'
    thumb_fs = dir_path / f'{base}_thumb.jpg'

    quality = config['uploads']['photo_jpeg_quality']
    main.save(main_fs, format='JPEG', quality=quality, optimize=True)
    thumb.save(thumb_fs, format='JPEG', quality=quality, optimize=True)

    # Отдаём относительные URL — их поймёт и раздача через FastAPI, и nginx.
    return (
        f'/uploads/{url_dir}/{base}.jpg',
        f'/uploads/{url_dir}/{base}_thumb.jpg',
    )


async def save_hall_photo(hall_id: int, filename: str, content: bytes) -> Tuple[str, str]:
    """Сохранить фото зала -> /uploads/halls/{hall_id}/{uuid}.jpg."""
    return await _save_image(content, filename, _hall_dir(hall_id), f'halls/{hall_id}')


async def save_provider_photo(provider_id: int, filename: str, content: bytes) -> Tuple[str, str]:
    """Сохранить фото исполнителя -> /uploads/providers/{provider_id}/{uuid}.jpg."""
    return await _save_image(content, filename, _provider_dir(provider_id), f'providers/{provider_id}')


def delete_photo_files(file_path: str, thumb_path: str) -> None:
    """Удаляет файлы с диска. Не бросает — если файл уже удалён, просто пропускаем."""
    root = _uploads_root().parent   # /.../uploads/halls/... -> /.../
    for rel in (file_path, thumb_path):
        if not rel:
            continue
        # rel вида '/uploads/halls/1/abc.jpg' -> реальный путь = config.uploads.root + 'halls/1/abc.jpg'
        # (срезаем ведущий '/uploads/')
        prefix = '/uploads/'
        if rel.startswith(prefix):
            rel_inside = rel[len(prefix):]
        else:
            rel_inside = rel.lstrip('/')
        fs_path = _uploads_root() / rel_inside
        try:
            if fs_path.exists():
                os.remove(fs_path)
        except OSError:
            pass
