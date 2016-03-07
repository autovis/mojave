'use strict';

// Basic Trade Simulation - simulates a broker by consuming trade commands and producing trade events

// Behavior:
// - One open position at a time, 'exit' commands always exits current position.
// - Operates on single instrument (that of Input#1)

define(['lodash', 'node-uuid'], function(_, uuid) {

    const LONG = 1, SHORT = -1, FLAT = 0;

    return {

        param_names: [],

        input: ['dual_candle_bar', 'trade_cmds'],
        synch: ['a',               'b'],
        output: 'trade_evts',

        initialize: function(params, input_streams, output_stream) {

            this.position = FLAT;
            this.entry = null;
            this.label = null;

            this.stop = null;
            this.limit = null;
            this.units = null;

            this.last_index = null;
            this.pos_uuid = null;

            this.events = [];

            // filter on items that haven't been seen in 'n' unique instances
            var seen_items = Array(20), seen_idx = 0;
            this.is_first_seen = function(item) {
                if (_.includes(seen_items, item)) return false;
                seen_items[seen_idx % seen_items.length] = item;
                seen_idx += 1;
                return true;
            };
        },

        on_bar_update: function(params, input_streams, output_stream, src_idx) {

            var self = this;

            if (self.current_index() !== self.last_index) {
                self.events = [];
            }

            var bar = input_streams[0].get();

            if (src_idx === 0) { // dual_candle_bar

                var date = bar.date;

                // Check for conditions that will terminate any open positions
                if (self.position === LONG) {
                    if (self.stop && bar.bid.low <= self.stop) {
                        self.events.push(['trade_end', {
                            evt_uuid: uuid.v4(),
                            pos_uuid: self.pos_uuid,
                            label: self.label,
                            date: date,
                            reason: 'stop',
                            direction: self.position,
                            units: self.units,
                            entry_price: self.entry,
                            exit_price: self.stop,
                            pips: Math.round((self.stop - self.entry) / input_streams[0].instrument.unit_size * 10) / 10
                        }]);
                        self.pos_uuid = null;
                        self.position = FLAT;
                        self.entry = null;
                        self.units = null;
                        self.stop = null;
                        self.limit = null;
                    } else if (self.limit && bar.bid.high >= self.limit) {
                        self.events.push(['trade_end', {
                            evt_uuid: uuid.v4(),
                            pos_uuid: self.pos_uuid,
                            label: self.label,
                            date: date,
                            reason: 'limit',
                            direction: self.position,
                            units: self.units,
                            entry_price: self.entry,
                            exit_price: self.limit,
                            pips: Math.round((self.limit - self.entry) / input_streams[0].instrument.unit_size * 10) / 10
                        }]);
                        self.pos_uuid = null;
                        self.position = FLAT;
                        self.entry = null;
                        self.units = null;
                        self.stop = null;
                        self.limit = null;
                    }
                } else if (self.position === SHORT) {
                    if (self.stop && bar.ask.high >= self.stop) {
                        self.events.push(['trade_end', {
                            evt_uuid: uuid.v4(),
                            pos_uuid: self.pos_uuid,
                            label: self.label,
                            date: date,
                            reason: 'stop',
                            direction: self.position,
                            units: self.units,
                            entry_price: self.entry,
                            exit_price: self.stop,
                            pips: Math.round((self.entry - self.stop) / input_streams[0].instrument.unit_size * 10) / 10
                        }]);
                        self.pos_uuid = null;
                        self.position = FLAT;
                        self.entry = null;
                        self.units = null;
                        self.stop = null;
                        self.limit = null;
                    } else if (self.limit && bar.ask.low <= self.limit) {
                        self.events.push(['trade_end', {
                            evt_uuid: uuid.v4(),
                            pos_uuid: self.pos_uuid,
                            label: self.label,
                            date: date,
                            reason: 'limit',
                            direction: self.position,
                            units: self.units,
                            entry_price: self.entry,
                            exit_price: self.limit,
                            pips: Math.round((self.entry - self.limit) / input_streams[0].instrument.unit_size * 10) / 10
                        }]);
                        self.pos_uuid = null;
                        self.position = FLAT;
                        self.entry = null;
                        self.units = null;
                        self.stop = null;
                        self.limit = null;
                    }
                } else { // FLAT
                    // No reactions to price when position is FLAT
                }

            } else if (src_idx === 1) { // trade_cmds

                var commands = input_streams[1].get();

                _.each(commands, function(cmd) {
                    if (!self.is_first_seen(cmd[1].cmd_uuid)) return; // skip events already processed
                    switch (cmd[0]) {
                        case 'enter':
                            if (self.position === FLAT) {
                                self.pos_uuid = cmd[1].pos_uuid;
                                self.label = cmd[1].label;
                                self.position = cmd[1].direction;
                                self.entry = cmd[1].entry;
                                self.units = cmd[1].units;
                                if (cmd[1].stop) self.stop = cmd[1].stop;
                                if (cmd[1].limit) self.limit = cmd[1].limit;
                                self.events.push(['trade_start', {
                                    evt_uuid: uuid.v4(),
                                    pos_uuid: cmd[1].pos_uuid,
                                    label: cmd[1].label || null,
                                    date: bar.date,
                                    direction: self.position,
                                    units: self.units,
                                    entry_price: self.entry || (self.position === LONG ? bar.ask.close : bar.bid.close),
                                    stop: self.stop,
                                    limit: self.limit
                                }]);
                            }
                            break;
                        case 'exit': // exits current position, regardless of pos_uuid provided
                            if (self.position !== FLAT && cmd[1].pos_uuid === self.pos_uuid) {
                                var exit_price = self.position === LONG ? bar.bid.close : bar.ask.close;
                                self.events.push(['trade_end', {
                                    evt_uuid: uuid.v4(),
                                    pos_uuid: self.pos_uuid,
                                    label: self.label,
                                    date: bar.date,
                                    reason: 'exit',
                                    direction: self.position,
                                    units: self.units,
                                    entry_price: self.entry,
                                    exit_price: exit_price,
                                    pips: Math.round((self.entry - exit_price) / input_streams[0].instrument.unit_size * 10) / 10
                                }]);
                                self.pos_uuid = null;
                                self.position = FLAT;
                                self.entry = null;
                                self.units = null;
                            }
                            break;
                        case 'set_stop':
                            self.stop = cmd[1].price;
                            if (self.position !== FLAT && cmd[1].pos_uuid === self.pos_uuid) self.events.push(['stop_updated', {
                                evt_uuid: uuid.v4(),
                                pos_uuid: self.pos_uuid,
                                label: self.label,
                                date: bar.date,
                                price: cmd[1].price
                            }]);
                            break;
                        case 'set_limit':
                            self.limit = cmd[1].price;
                            if (self.position !== FLAT && cmd[1].pos_uuid === self.pos_uuid) self.events.push(['limit_updated', {
                                evt_uuid: uuid.v4(),
                                pos_uuid: self.pos_uuid,
                                label: self.label,
                                date: bar.date,
                                price: cmd[1].price
                            }]);
                            break;
                        default:
                    }
                });

            } else {
                throw Error('Unexpected src_idx: ' + src_idx);
            }

            output_stream.set(_.cloneDeep(self.events));
            self.last_index = self.current_index();
        }
    };
});
