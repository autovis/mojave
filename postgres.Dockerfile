FROM postgres:9-alpine

ADD ./scripts/1-create-primary-db.sql /docker-entrypoint-initdb.d/
ADD ./scripts/2-create-secondary-db.sql /docker-entrypoint-initdb.d/
