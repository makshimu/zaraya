#!/bin/sh
set -e
# Migrations are applied automatically on every api start
alembic upgrade head
# Settings row + first admin; runs once here so parallel workers do not race
python -m app.services.bootstrap
exec "$@"
