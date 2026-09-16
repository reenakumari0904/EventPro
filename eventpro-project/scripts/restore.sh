#!/usr/bin/env bash
# ============================================================
# EventPro database restore
# ============================================================
# Milestone 3 — Platform Reliability & Security (backup & recovery).
#
# Restores a backup produced by scripts/backup.sh. DESTRUCTIVE: this
# replaces the contents of the target database, so it asks for
# confirmation unless -y/--yes is passed (for scripted/CI use).
#
# Usage:
#   ./scripts/restore.sh backups/eventpro_20260903_020000.sql.gz
#   ./scripts/restore.sh --yes backups/eventpro_20260903_020000.sql.gz
#
# Via Docker Compose:
#   gunzip -c backups/eventpro_20260903_020000.sql.gz | docker compose exec -T postgres psql -U eventpro -d eventpro

set -euo pipefail

CONFIRM=true
if [ "${1:-}" = "-y" ] || [ "${1:-}" = "--yes" ]; then
  CONFIRM=false
  shift
fi

BACKUP_FILE="${1:-}"
if [ -z "$BACKUP_FILE" ]; then
  echo "Usage: $0 [-y|--yes] <backup-file.sql.gz>" >&2
  exit 1
fi
if [ ! -f "$BACKUP_FILE" ]; then
  echo "Backup file not found: $BACKUP_FILE" >&2
  exit 1
fi
if [ -z "${DATABASE_URL:-}" ]; then
  echo "DATABASE_URL is not set. Export it, or source backend/.env first." >&2
  exit 1
fi

if [ "$CONFIRM" = true ]; then
  read -r -p "This will overwrite the database at \$DATABASE_URL with the contents of ${BACKUP_FILE}. Continue? [y/N] " reply
  case "$reply" in
    [yY][eE][sS]|[yY]) ;;
    *) echo "Aborted."; exit 1 ;;
  esac
fi

echo "Restoring ${BACKUP_FILE} ..."
gunzip -c "$BACKUP_FILE" | psql "$DATABASE_URL"
echo "Restore complete."
