
SET statement_timeout = 0;
SET lock_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET client_min_messages = warning;
SET row_security = off;

CREATE DATABASE mojave_primary;
\connect mojave_primary;

CREATE TABLE users (
    id text NOT NULL,
    permissions jsonb DEFAULT '{}'::jsonb NOT NULL,
    last_signon timestamp with time zone
);

ALTER TABLE ONLY users
    ADD CONSTRAINT user_id_pk PRIMARY KEY (id);

CREATE TABLE selections (
    sel_uuid uuid NOT NULL,
    sel_id text NOT NULL,
    origin text,
    instrument text,
    bounds daterange
);

ALTER TABLE ONLY selections
    ADD CONSTRAINT sel_key PRIMARY KEY (sel_uuid);

CREATE INDEX bounds_idx ON selections USING btree (bounds);
CREATE INDEX sel_id_idx ON selections USING btree (sel_id);

CREATE TABLE selection_data (
    sel_data_uuid uuid NOT NULL,
    sel_uuid uuid NOT NULL,
    sel_id text NOT NULL,
    inputs jsonb DEFAULT '{}'::jsonb NOT NULL,
    tags jsonb DEFAULT '{}'::jsonb NOT NULL,
    date timestamp with time zone NOT NULL
);

ALTER TABLE ONLY selection_data
    ADD CONSTRAINT sel_data_key PRIMARY KEY (sel_data_uuid);

CREATE UNIQUE INDEX sel_uuid_date_idx ON selection_data USING btree (sel_uuid, date);
CREATE INDEX sel_uuid_idx ON selection_data USING btree (sel_uuid);
