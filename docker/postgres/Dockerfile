FROM postgres:9-alpine

VOLUME /var/lib/postgresql/data

EXPOSE 5432

ENV POSTGRES_USER postgres
ENV POSTGRES_PASSWORD postgres

ADD ./scripts/1-create-primary-db.sql /docker-entrypoint-initdb.d/
ADD ./scripts/2-create-secondary-db.sql /docker-entrypoint-initdb.d/
