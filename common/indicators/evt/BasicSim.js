'use strict';

// Basic Trade Simulation - simulates a broker by consuming trade commands and producing trade events

// Behavior:
// - One open position at a time, 'exit' commands always exits current position.
// - Operates on single instrument (that of Input#1)

define(['lodash', 'node-uuid'], function(_, uuid) {

    var LONG = 1, SHORT = -1, FLAT = 0;

    return {

        param_names: [],

        input: ['dual_candle_bar', 'trade_cmds'],
        synch: ['a',               'b'],
        output: 'trade_evts',

        initialize: function(params, input_streams, output_stream) {

            this.position = FLAT;
            this.entry = null;

            this.stop = null;
            this.limit = null;
            this.units = null;

            this.last_index = null;
            this.pos_uuid = null;

            this.events = [];

            // filter on items that haven't been seen in 'n' unique instances
            var seen_items = Array(20), seen_idx = 0;
            this.is_first_seen = function(item) {
                if (seen_items.indexOf(item) > -1) return false;
                seen_items[seen_idx % seen_items.length] = item;
                seen_idx += 1;
                return true;
            };
        },

        on_bar_update: function(params, input_streams, output_stream, src_idx) {

            if (this.current_index() !== this.last_index) {
                this.events = [];
            }

            if (src_idx === 0) { // dual_candle_bar

                var bar = input_streams[0].get();
                var date = bar.date;
                var ask = bar.ask;
                var bid = bar.bid;

                // Check for conditions that will terminate any open positions
                if (this.position === LONG) {
                    if (this.stop && bid.low <= this.stop) {
                        this.events.push(['trade_end', {
                            evt_uuid: uuid.v4(),
                            pos_uuid: this.pos_uuid,
                            date: date,
                            reason: 'stop',
                            direction: this.position,
                            units: this.units,
                            entry_price: this.entry,
                            exit_price: this.stop,
                            pips: Math.round((this.stop - this.entry) / input_streams[0].instrument.unit_size * 10) / 10
                        }]);
                        this.pos_uuid = null;
                        this.position = FLAT;
                        this.entry = null;
                        this.units = null;
                        this.stop = null;
                        this.limit = null;
                    } else if (this.limit && bid.high >= this.limit) {
                        this.events.push(['trade_end', {
                            evt_uuid: uuid.v4(),
                            pos_uuid: this.pos_uuid,
                            date: date,
                            reason: 'limit',
                            direction: this.position,
                            units: this.units,
                            entry_price: this.entry,
                            exit_price: this.limit,
                            pips: Math.round((this.limit - this.entry) / input_streams[0].instrument.unit_size * 10) / 10
                        }]);
                        this.pos_uuid = null;
                        this.position = FLAT;
                        this.entry = null;
                        this.units = null;
                        this.stop = null;
                        this.limit = null;
                    }
                } else if (this.position === SHORT) {
                    if (this.stop && ask.high >= this.stop) {
                        this.events.push(['trade_end', {
                            evt_uuid: uuid.v4(),
                            pos_uuid: this.pos_uuid,
                            date: date,
                            reason: 'stop',
                            direction: this.position,
                            units: this.units,
                            entry_price: this.entry,
                            exit_price: this.stop,
                            pips: Math.round((this.entry - this.stop) / input_streams[0].instrument.unit_size * 10) / 10
                        }]);
                        this.pos_uuid = null;
                        this.position = FLAT;
                        this.entry = null;
                        this.units = null;
                        this.stop = null;
                        this.limit = null;
                    } else if (this.limit && ask.low <= this.limit) {
                        this.events.push(['trade_end', {
                            evt_uuid: uuid.v4(),
                            pos_uuid: this.pos_uuid,
                            date: date,
                            reason: 'limit',
                            direction: this.position,
                            units: this.units,
                            entry_price: this.entry,
                            exit_price: this.limit,
                            pips: Math.round((this.entry - this.limit) / input_streams[0].instrument.unit_size * 10) / 10
                        }]);
                        this.pos_uuid = null;
                        this.position = FLAT;
                        this.entry = null;
                        this.units = null;
                        this.stop = null;
                        this.limit = null;
                    }
                } else { // FLAT
                    // No reactions to price when position is FLAT
                }

            } else if (src_idx === 1) { // trade_cmds

                var price = input_streams[0].get();
                var commands = input_streams[1].get();

                _.each(commands, function(cmd) {
                    if (!this.is_first_seen(cmd[1].cmd_uuid)) return; // skip events already processed
                    switch (cmd[0]) {
                        case 'enter':
                            if (this.position === FLAT) {
                                this.pos_uuid = cmd[1].pos_uuid;
                                this.position = cmd[1].direction;
                                this.entry = cmd[1].entry;
                                this.units = cmd[1].units;
                                if (cmd[1].stop) this.stop = cmd[1].stop;
                                if (cmd[1].limit) this.limit = cmd[1].limit;
                                this.events.push(['trade_start', {
                                    evt_uuid: uuid.v4(),
                                    pos_uuid: cmd[1].pos_uuid,
                                    date: price.date,
                                    direction: this.position,
                                    units: this.units,
                                    entry_price: this.entry || (this.position === LONG ? ask.close : bid.close),
                                    stop: this.stop,
                                    limit: this.limit
                                }]);
                            }
                            break;
                        case 'exit': // exits current position, regardless of pos_uuid provided
                            if (this.position !== FLAT) {
                                var exit_price = this.position === LONG ? bid.close : ask.close;
                                this.events.push(['trade_end', {
                                    evt_uuid: uuid.v4(),
                                    pos_uuid: this.pos_uuid,
                                    date: price.date,
                                    reason: 'exit',
                                    direction: this.position,
                                    units: this.units,
                                    entry_price: this.entry,
                                    exit_price: exit_price,
                                    pips: Math.round((this.entry - exit_price) / input_streams[0].instrument.unit_size * 10) / 10
                                }]);
                                this.pos_uuid = null;
                                this.position = FLAT;
                                this.entry = null;
                                this.units = null;
                            }
                            break;
                        case 'set_stop':
                            this.stop = cmd[1].price;
                            if (this.position !== FLAT) this.events.push(['stop_updated', {
                                evt_uuid: uuid.v4(),
                                pos_uuid: cmd[1].pos_uuid,
                                date: price.date,
                                price: cmd[1].price
                            }]);
                            break;
                        case 'set_limit':
                            this.limit = cmd[1].price;
                            if (this.position !== FLAT) this.events.push(['limit_updated', {
                                evt_uuid: uuid.v4(),
                                pos_uuid: cmd[1].pos_uuid,
                                date: price.date,
                                price: cmd[1].price
                            }]);
                            break;
                        default:
                    }
                }, this);

            } else {
                throw Error('Unexpected src_idx: ' + src_idx);
            }

            output_stream.set(_.cloneDeep(this.events));
            this.last_index = this.current_index();
        }
    };
});
