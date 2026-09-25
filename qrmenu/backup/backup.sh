#!/bin/sh
# Daily pg_dump into /backups, keeping BACKUP_KEEP_DAYS days of dumps.
# Restore: pg_restore --clean --if-exists -d "$DATABASE" /backups/<file>.dump
set -eu

: "${BACKUP_TIME:=03:30}"      # local time of the daily run, HH:MM (TZ sets the zone)
: "${BACKUP_KEEP_DAYS:=14}"
DIR=/backups

run_backup() {
    file="$DIR/qrmenu-$(date +%Y%m%d-%H%M%S).dump"
    # Write to a temp name first so a half-written dump never looks like a good one
    if pg_dump --format=custom --file="$file.partial"; then
        mv "$file.partial" "$file"
        echo "$(date -Iseconds) backup ok: $file ($(du -h "$file" | cut -f1))"
    else
        rm -f "$file.partial"
        echo "$(date -Iseconds) backup FAILED" >&2
        return 1
    fi
    find "$DIR" -name 'qrmenu-*.dump' -mtime +"$((BACKUP_KEEP_DAYS - 1))" -print -delete
}

if [ "${1:-}" = "once" ]; then
    run_backup
    exit
fi

echo "backups daily at $BACKUP_TIME, keeping $BACKUP_KEEP_DAYS days"
while true; do
    now=$(date +%s)
    next=$(date -d "$(date +%Y-%m-%d) $BACKUP_TIME" +%s)
    [ "$next" -le "$now" ] && next=$((next + 86400))
    sleep $((next - now))
    run_backup || true
done
