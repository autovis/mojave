#!/bin/bash

if [ -z $MOJAVE_PATH ]; then
  echo "MOJAVE_PATH must be defined"
  exit 1
fi

cd $MOJAVE_PATH/docker/postgres

#docker run --name yo -v "$(pwd)":/usr/src/myapp -w /usr/src/myapp ubuntu sh tmp.sh || docker start -ia yo

# Run container in bg
docker run -d \
    --name mojave_postgres \
    -p 5432:5432 \
    -e POSTGRES_USER=postgres \
    -e POSTGRES_PASSWORD=postgres \
    postgres:9-alpine


# Initialize schema for primary DB
./run-sql-script.sh init-primary-db.sql
