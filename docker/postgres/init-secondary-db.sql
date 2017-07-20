
SET statement_timeout = 0;
SET lock_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET client_min_messages = warning;
SET row_security = off;

CREATE DATABASE mojave_secondary;
\connect mojave_secondary;

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

CREATE TABLE segments (
    id uuid DEFAULT uuid_generate_v4() NOT NULL,
    name text NOT NULL,
    timestep text,
    instrument text,
    bounds tsrange,
    created timestamp with time zone DEFAULT now() NOT NULL,
    properties jsonb DEFAULT '{}'::jsonb NOT NULL
);

ALTER TABLE ONLY segments
    ADD CONSTRAINT seg_key PRIMARY KEY (id);

CREATE INDEX seg_name_idx ON segments USING btree (name);
CREATE INDEX seg_instr_tstep_idx ON segments USING btree (instrument, timestep);
CREATE INDEX seg_bnds_idx ON segments USING gist (bounds);

CREATE TABLE segment_data (
    seg_id uuid references segments(id) on delete cascade,
    datetime timestamp with time zone NOT NULL,
    data jsonb DEFAULT '{}'::jsonb NOT NULL
);

CREATE INDEX seg_data_tstamp_idx ON segment_data USING btree (seg_id, datetime);
