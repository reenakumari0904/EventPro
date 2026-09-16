#!/usr/bin/env bash
# ============================================================
# EventPro database backup
# ============================================================
# Milestone 3 — Platform Reliability & Security (backup & recovery).
#
# Dumps the Postgres database to a timestamped, gzip-compressed file and
# prunes backups older than RETENTION_DAYS. Works against either a
# Docker-Compose-managed database or a bare-metal one — it just needs a
# reachable DATABASE_URL.
#
# Usage:
#   ./scripts/backup.sh                          # uses $DATABASE_URL
#   DATABASE_URL=postgres://... ./scripts/backup.sh
#   BACKUP_DIR=/mnt/backups ./scripts/backup.sh   # override the output dir
#
# Via Docker Compose (dumps from inside the postgres container, so it
# doesn't need pg_dump installed on the host):
#   docker compose exec -T postgres pg_dump -U eventpro eventpro | gzip > backups/eventpro_$(date +%Y%m%d_%H%M%S).sql.gz
#
# Schedule it with cron for unattended nightly backups, e.g.:
#   0 2 * * * cd /path/to/eventpro-project && ./scripts/backup.sh >> logs/backup.log 2>&1

set -euo pipefail

BACKUP_DIR="${BACKUP_DIR:-$(dirname "$0")/../backups}"
RETENTION_DAYS="${RETENTION_DAYS:-14}"
TIMESTAMP="$(date +%Y%m%d_%H%M%S)"
OUTPUT_FILE="${BACKUP_DIR}/eventpro_${TIMESTAMP}.sql.gz"

if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set. Export it, or source backend/.env first (e.g. 'set -a; source backend/.env; set +a')." >&2
  exit 1
fi

mkdir -p "$BACKUP_DIR"

echo "Backing up EventPro database to ${OUTPUT_FILE} ..."
pg_dump "$DATABASE_URL" | gzip > "$OUTPUT_FILE"
echo "Backup complete: $(du -h "$OUTPUT_FILE" | cut -f1)"

echo "Pruning backups older than ${RETENTION_DAYS} days ..."
find "$BACKUP_DIR" -name 'eventpro_*.sql.gz' -mtime "+${RETENTION_DAYS}" -print -delete

echo "Done. Restore with: ./scripts/restore.sh ${OUTPUT_FILE}"
