#!/usr/bin/env bash
# cleanup-s3-orphans.sh — Поиск и удаление осиротевших файлов в S3.
#
# Осиротевшие файлы (orphans) появляются когда:
#   1. Удаление книги не смогло удалить файлы из S3 (best-effort cleanup в books.service.ts)
#   2. Загрузка файла прошла, но сохранение в БД не удалось
#   3. Пользователь заменил файл (обложку, шрифт, звук), но старый не был удалён
#
# Алгоритм:
#   1. Получает список всех ключей в S3-бакете
#   2. Собирает все URL-ссылки на S3-файлы из БД (все таблицы с *Url полями)
#   3. Сравнивает — файлы в S3, не найденные в БД, считаются orphans
#   4. В режиме --dry-run (по умолчанию) — только выводит список
#   5. С флагом --delete — удаляет осиротевшие файлы
#
# Использование:
#   ./scripts/cleanup-s3-orphans.sh                   # Dry run (только отчёт)
#   ./scripts/cleanup-s3-orphans.sh --delete           # Удалить orphans
#   ./scripts/cleanup-s3-orphans.sh --older-than 7     # Только файлы старше 7 дней
#
# Переменные окружения:
#   DATABASE_URL  — строка подключения PostgreSQL (обязательно)
#   S3_ENDPOINT   — S3 endpoint (обязательно)
#   S3_BUCKET     — S3 bucket name (обязательно)
#   S3_ACCESS_KEY — S3 access key (обязательно)
#   S3_SECRET_KEY — S3 secret key (обязательно)
#   S3_REGION     — S3 region (по умолчанию: us-east-1)

set -euo pipefail

# --- Аргументы ---
DELETE_MODE=false
OLDER_THAN_DAYS=0

while [[ $# -gt 0 ]]; do
  case "$1" in
    --delete) DELETE_MODE=true; shift ;;
    --older-than) OLDER_THAN_DAYS="$2"; shift 2 ;;
    *) echo "Неизвестный аргумент: $1"; exit 1 ;;
  esac
done

# --- Проверки ---
for var in DATABASE_URL S3_ENDPOINT S3_BUCKET S3_ACCESS_KEY S3_SECRET_KEY; do
  if [ -z "${!var:-}" ]; then
    echo "ОШИБКА: $var не задан"
    exit 1
  fi
done

if ! command -v psql &> /dev/null; then
  echo "ОШИБКА: psql не найден. Установите postgresql-client"
  exit 1
fi

if ! command -v aws &> /dev/null && ! command -v mc &> /dev/null; then
  echo "ОШИБКА: aws CLI или mc (MinIO Client) не найден"
  exit 1
fi

REGION="${S3_REGION:-us-east-1}"
TMPDIR=$(mktemp -d)
trap 'rm -rf "$TMPDIR"' EXIT

echo "[$(date -Iseconds)] === S3 Orphan Cleanup ==="
echo "Бакет: ${S3_BUCKET}"
echo "Режим: $([ "$DELETE_MODE" = true ] && echo "УДАЛЕНИЕ" || echo "dry-run (только отчёт)")"
[ "$OLDER_THAN_DAYS" -gt 0 ] && echo "Фильтр: старше ${OLDER_THAN_DAYS} дней"

# --- Шаг 1: Список файлов в S3 ---
echo ""
echo "[$(date -Iseconds)] Получаем список файлов в S3..."

if command -v aws &> /dev/null; then
  aws s3api list-objects-v2 \
    --endpoint-url "${S3_ENDPOINT}" \
    --bucket "${S3_BUCKET}" \
    --region "${REGION}" \
    --query 'Contents[].{Key: Key, LastModified: LastModified}' \
    --output text 2>/dev/null \
    | sort > "${TMPDIR}/s3_files.txt"
else
  mc alias set _cleanup "${S3_ENDPOINT}" "${S3_ACCESS_KEY}" "${S3_SECRET_KEY}" --api S3v4 > /dev/null 2>&1
  mc ls --recursive "_cleanup/${S3_BUCKET}" 2>/dev/null \
    | awk '{print $NF}' \
    | sort > "${TMPDIR}/s3_files.txt"
fi

S3_COUNT=$(wc -l < "${TMPDIR}/s3_files.txt" | tr -d ' ')
echo "Файлов в S3: ${S3_COUNT}"

if [ "$S3_COUNT" -eq 0 ]; then
  echo "S3-бакет пуст, нечего проверять."
  exit 0
fi

# --- Шаг 2: Список URL из БД ---
echo "[$(date -Iseconds)] Получаем URL из базы данных..."

# Собираем все URL-поля из всех таблиц, содержащих ссылки на S3
psql "${DATABASE_URL}" --no-align --tuples-only --quiet <<'SQL' | sort -u > "${TMPDIR}/db_urls.txt"
-- Chapters: background images
SELECT bg FROM chapters WHERE bg != '' AND bg IS NOT NULL
UNION ALL
SELECT bg_mobile FROM chapters WHERE bg_mobile != '' AND bg_mobile IS NOT NULL
UNION ALL
-- Book covers
SELECT cover_bg FROM books WHERE cover_bg != '' AND cover_bg IS NOT NULL
UNION ALL
SELECT cover_bg_mobile FROM books WHERE cover_bg_mobile != '' AND cover_bg_mobile IS NOT NULL
UNION ALL
SELECT cover_bg_custom_url FROM books WHERE cover_bg_custom_url IS NOT NULL
UNION ALL
-- Sounds
SELECT page_flip_url FROM book_sounds WHERE page_flip_url IS NOT NULL
UNION ALL
SELECT book_open_url FROM book_sounds WHERE book_open_url IS NOT NULL
UNION ALL
SELECT book_close_url FROM book_sounds WHERE book_close_url IS NOT NULL
UNION ALL
-- Ambients
SELECT file_url FROM ambients WHERE file_url IS NOT NULL
UNION ALL
-- Decorative fonts
SELECT file_url FROM decorative_fonts WHERE file_url IS NOT NULL
UNION ALL
-- Reading fonts
SELECT file_url FROM reading_fonts WHERE file_url IS NOT NULL
UNION ALL
-- Appearance: custom images & textures
SELECT light_cover_bg_image_url FROM book_appearances WHERE light_cover_bg_image_url IS NOT NULL
UNION ALL
SELECT dark_cover_bg_image_url FROM book_appearances WHERE dark_cover_bg_image_url IS NOT NULL
UNION ALL
SELECT light_custom_texture_url FROM book_appearances WHERE light_custom_texture_url IS NOT NULL
UNION ALL
SELECT dark_custom_texture_url FROM book_appearances WHERE dark_custom_texture_url IS NOT NULL
UNION ALL
-- User avatars
SELECT avatar_url FROM users WHERE avatar_url IS NOT NULL;
SQL

DB_URL_COUNT=$(wc -l < "${TMPDIR}/db_urls.txt" | tr -d ' ')
echo "URL в БД: ${DB_URL_COUNT}"

# --- Шаг 3: Извлекаем S3-ключи из URL ---
# URL формат: http(s)://<host>/<bucket>/<key>
# Извлекаем только ту часть после bucket name
grep -oP "/${S3_BUCKET}/\K.+" "${TMPDIR}/db_urls.txt" 2>/dev/null \
  | sort -u > "${TMPDIR}/db_keys.txt" || true

# --- Шаг 4: Сравниваем ---
# Извлекаем только ключи из s3_files.txt (формат зависит от инструмента)
if command -v aws &> /dev/null; then
  awk '{print $1}' "${TMPDIR}/s3_files.txt" | sort > "${TMPDIR}/s3_keys.txt"
else
  cp "${TMPDIR}/s3_files.txt" "${TMPDIR}/s3_keys.txt"
fi

# Orphans = в S3, но не в БД
comm -23 "${TMPDIR}/s3_keys.txt" "${TMPDIR}/db_keys.txt" > "${TMPDIR}/orphans.txt"

ORPHAN_COUNT=$(wc -l < "${TMPDIR}/orphans.txt" | tr -d ' ')
echo ""
echo "[$(date -Iseconds)] Осиротевших файлов: ${ORPHAN_COUNT} из ${S3_COUNT}"

if [ "$ORPHAN_COUNT" -eq 0 ]; then
  echo "Осиротевших файлов не найдено."
  exit 0
fi

# --- Шаг 5: Вывод / Удаление ---
echo ""
echo "Список осиротевших файлов:"
head -50 "${TMPDIR}/orphans.txt" | while IFS= read -r key; do
  echo "  - ${key}"
done
[ "$ORPHAN_COUNT" -gt 50 ] && echo "  ... и ещё $((ORPHAN_COUNT - 50)) файлов"

if [ "$DELETE_MODE" = true ]; then
  echo ""
  echo "[$(date -Iseconds)] Удаляем ${ORPHAN_COUNT} осиротевших файлов..."
  DELETED=0
  FAILED=0
  while IFS= read -r key; do
    if command -v aws &> /dev/null; then
      if aws s3api delete-object \
        --endpoint-url "${S3_ENDPOINT}" \
        --bucket "${S3_BUCKET}" \
        --region "${REGION}" \
        --key "${key}" 2>/dev/null; then
        DELETED=$((DELETED + 1))
      else
        FAILED=$((FAILED + 1))
        echo "  ОШИБКА: не удалось удалить ${key}"
      fi
    else
      if mc rm "_cleanup/${S3_BUCKET}/${key}" 2>/dev/null; then
        DELETED=$((DELETED + 1))
      else
        FAILED=$((FAILED + 1))
        echo "  ОШИБКА: не удалось удалить ${key}"
      fi
    fi
  done < "${TMPDIR}/orphans.txt"

  echo "[$(date -Iseconds)] Удалено: ${DELETED}, ошибок: ${FAILED}"
else
  echo ""
  echo "Для удаления запустите с флагом --delete:"
  echo "  ./scripts/cleanup-s3-orphans.sh --delete"
fi

echo "[$(date -Iseconds)] Готово."
