#!/bin/sh
set -e
# Migrations are applied automatically on every api start
alembic upgrade head
# Settings row + first admin; runs once here so parallel workers do not race
python -m app.services.bootstrap
# DEMO_DATA=true: fill an empty database with the demo café (see app/demo)
if [ "${DEMO_DATA:-false}" = "true" ]; then
    python -m app.demo --if-empty
fi
exec "$@"
