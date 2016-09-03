--
-- PostgreSQL database dump
--

-- Dumped from database version 9.4.6
-- Dumped by pg_dump version 9.5.1

SET statement_timeout = 0;
SET lock_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SET check_function_bodies = false;
SET client_min_messages = warning;
SET row_security = off;

SET search_path = public, pg_catalog;
SET default_tablespace = '';
SET default_with_oids = false;

CREATE TABLE selection_data (
    sel_data_uuid uuid NOT NULL,
    sel_uuid uuid NOT NULL,
    sel_id text NOT NULL,
    inputs jsonb DEFAULT '{}'::jsonb NOT NULL,
    tags jsonb DEFAULT '{}'::jsonb NOT NULL,
    date timestamp with time zone NOT NULL
);

CREATE TABLE selections (
    sel_uuid uuid NOT NULL,
    sel_id text NOT NULL,
    origin text,
    instrument text,
    timestep text,
    bounds daterange
);

ALTER TABLE ONLY selection_data
    ADD CONSTRAINT sel_data_key PRIMARY KEY (sel_data_uuid);

ALTER TABLE ONLY selections
    ADD CONSTRAINT sel_key PRIMARY KEY (sel_uuid);

CREATE INDEX bounds_idx ON selections USING btree (bounds);
CREATE INDEX sel_id_idx ON selections USING btree (sel_id);
CREATE INDEX sel_uuid_idx ON selection_data USING btree (sel_uuid);

-- DATA: selection_data

COPY selection_data (sel_data_uuid, sel_uuid, sel_id, inputs, tags, date) FROM stdin;
87f77182-9de3-4b38-8637-9d71dc7104cf	7682e311-55dd-4fe2-aad2-026ca8e65311	test	[48.29351847893486, 0.00014212538850388867]	{}	2016-03-30 14:55:00+00
81bfb527-e02f-4ba8-a70e-86a8c127d33b	7682e311-55dd-4fe2-aad2-026ca8e65311	test	{"obv_sl": -12.212489058053052, "sdl_slow_sl": -0.0000498893420350921}	{}	2016-03-30 13:25:00+00
2341284b-f993-4a73-9fe5-7911ef0bd9b7	7682e311-55dd-4fe2-aad2-026ca8e65311	test	{"obv_sl": 139.4486490415677, "sdl_slow_sl": -0.000034161092966611406}	{}	2016-03-30 13:05:00+00
b3d60c5a-26c6-4c2b-b21e-8e4bc9260c57	7682e311-55dd-4fe2-aad2-026ca8e65311	test	{"obv_sl": 23.97739620093671, "sdl_slow_sl": -0.000019176367463735744}	{}	2016-03-30 12:45:00+00
c209f1c3-7336-402f-ac0a-e89e433fc1c4	7682e311-55dd-4fe2-aad2-026ca8e65311	test	{"obv_sl": -148.4438677988196, "sdl_slow_sl": -0.000013015700317531298}	{}	2016-03-30 12:35:00+00
80a8a57c-2f40-47e3-9422-4c99a9781de5	7682e311-55dd-4fe2-aad2-026ca8e65311	test	{"obv_sl": -148.4438677988196, "sdl_slow_sl": -0.000013015700317531298}	{}	2016-03-30 12:35:00+00
\.


-- DATA: selections

COPY selections (sel_uuid, sel_id, origin, instrument, timestep, bounds) FROM stdin;
7682e311-55dd-4fe2-aad2-026ca8e65311	test	test	eurusd	m5	\N
\.
