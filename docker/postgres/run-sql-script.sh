
SCRIPT_FILE=$1

docker cp "$SCRIPT_FILE" mojave_postgres:/var/lib/postgresql
docker exec mojave_postgres psql -U postgres -f "/var/lib/postgresql/$(basename $SCRIPT_FILE)"
