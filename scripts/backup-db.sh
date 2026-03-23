#!/usr/bin/env bash
# backup-db.sh — Бэкап PostgreSQL базы данных Flipbook
#
# Использование:
#   ./scripts/backup-db.sh                    # Бэкап в ./backups/
#   ./scripts/backup-db.sh /path/to/backups   # Бэкап в указанную директорию
#   BACKUP_RETENTION_DAYS=14 ./scripts/backup-db.sh  # Хранение 14 дней
#
# Переменные окружения:
#   DATABASE_URL          — строка подключения PostgreSQL (обязательно)
#   BACKUP_DIR            — директория для бэкапов (по умолчанию: ./backups)
#   BACKUP_RETENTION_DAYS — количество дней хранения (по умолчанию: 7)
#   S3_BACKUP_BUCKET      — S3-бакет для загрузки бэкапов (опционально)
#
# Для cron (ежедневный бэкап в 3:00):
#   0 3 * * * cd /path/to/flipbook && ./scripts/backup-db.sh >> /var/log/flipbook-backup.log 2>&1

set -euo pipefail

# --- Конфигурация ---
BACKUP_DIR="${1:-${BACKUP_DIR:-./backups}}"
RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-7}"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="${BACKUP_DIR}/flipbook_${TIMESTAMP}.sql.gz"

# --- Проверки ---
if [ -z "${DATABASE_URL:-}" ]; then
  echo "ОШИБКА: DATABASE_URL не задан"
  echo "Пример: DATABASE_URL=postgresql://user:pass@host:5432/flipbook ./scripts/backup-db.sh"
  exit 1
fi

if ! command -v pg_dump &> /dev/null; then
  echo "ОШИБКА: pg_dump не найден. Установите postgresql-client"
  exit 1
fi

# --- Создание директории ---
mkdir -p "${BACKUP_DIR}"

# --- Бэкап ---
echo "[$(date -Iseconds)] Начинаем бэкап БД..."
pg_dump "${DATABASE_URL}" \
  --format=plain \
  --no-owner \
  --no-privileges \
  --clean \
  --if-exists \
  | gzip > "${BACKUP_FILE}"

BACKUP_SIZE=$(du -h "${BACKUP_FILE}" | cut -f1)
echo "[$(date -Iseconds)] Бэкап создан: ${BACKUP_FILE} (${BACKUP_SIZE})"

# --- Загрузка в S3 (опционально) ---
if [ -n "${S3_BACKUP_BUCKET:-}" ]; then
  if command -v aws &> /dev/null; then
    echo "[$(date -Iseconds)] Загружаем в S3: ${S3_BACKUP_BUCKET}..."
    aws s3 cp "${BACKUP_FILE}" "s3://${S3_BACKUP_BUCKET}/db-backups/$(basename "${BACKUP_FILE}")"
    echo "[$(date -Iseconds)] Загружено в S3"
  else
    echo "ПРЕДУПРЕЖДЕНИЕ: aws CLI не найден, пропускаем загрузку в S3"
  fi
fi

# --- Ротация старых бэкапов ---
if [ "${RETENTION_DAYS}" -gt 0 ]; then
  DELETED=$(find "${BACKUP_DIR}" -name "flipbook_*.sql.gz" -mtime "+${RETENTION_DAYS}" -print -delete | wc -l)
  if [ "${DELETED}" -gt 0 ]; then
    echo "[$(date -Iseconds)] Удалено старых бэкапов: ${DELETED} (старше ${RETENTION_DAYS} дней)"
  fi
fi

echo "[$(date -Iseconds)] Бэкап завершён успешно"
