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
                if (_.includes(seen_items, item)) return false;
                seen_items[seen_idx % seen_items.length] = item;
                seen_idx += 1;
                return true;
            };
        },

        on_bar_update: function(params, input_streams, output_stream, src_idx) {

            var ind = this;

            if (ind.current_index() !== ind.last_index) {
                ind.events = [];
            }

            var bar = input_streams[0].get();

            if (src_idx === 0) { // dual_candle_bar

                var date = bar.date;

                // Check for conditions that will terminate any open positions
                if (ind.position === LONG) {
                    if (ind.stop && bar.bid.low <= ind.stop) {
                        ind.events.push(['trade_end', {
                            evt_uuid: uuid.v4(),
                            pos_uuid: ind.pos_uuid,
                            date: date,
                            reason: 'stop',
                            direction: ind.position,
                            units: ind.units,
                            entry_price: ind.entry,
                            exit_price: ind.stop,
                            pips: Math.round((ind.stop - ind.entry) / input_streams[0].instrument.unit_size * 10) / 10
                        }]);
                        ind.pos_uuid = null;
                        ind.position = FLAT;
                        ind.entry = null;
                        ind.units = null;
                        ind.stop = null;
                        ind.limit = null;
                    } else if (ind.limit && bar.bid.high >= ind.limit) {
                        ind.events.push(['trade_end', {
                            evt_uuid: uuid.v4(),
                            pos_uuid: ind.pos_uuid,
                            date: date,
                            reason: 'limit',
                            direction: ind.position,
                            units: ind.units,
                            entry_price: ind.entry,
                            exit_price: ind.limit,
                            pips: Math.round((ind.limit - ind.entry) / input_streams[0].instrument.unit_size * 10) / 10
                        }]);
                        ind.pos_uuid = null;
                        ind.position = FLAT;
                        ind.entry = null;
                        ind.units = null;
                        ind.stop = null;
                        ind.limit = null;
                    }
                } else if (ind.position === SHORT) {
                    if (ind.stop && bar.ask.high >= ind.stop) {
                        ind.events.push(['trade_end', {
                            evt_uuid: uuid.v4(),
                            pos_uuid: ind.pos_uuid,
                            date: date,
                            reason: 'stop',
                            direction: ind.position,
                            units: ind.units,
                            entry_price: ind.entry,
                            exit_price: ind.stop,
                            pips: Math.round((ind.entry - ind.stop) / input_streams[0].instrument.unit_size * 10) / 10
                        }]);
                        ind.pos_uuid = null;
                        ind.position = FLAT;
                        ind.entry = null;
                        ind.units = null;
                        ind.stop = null;
                        ind.limit = null;
                    } else if (ind.limit && bar.ask.low <= ind.limit) {
                        ind.events.push(['trade_end', {
                            evt_uuid: uuid.v4(),
                            pos_uuid: ind.pos_uuid,
                            date: date,
                            reason: 'limit',
                            direction: ind.position,
                            units: ind.units,
                            entry_price: ind.entry,
                            exit_price: ind.limit,
                            pips: Math.round((ind.entry - ind.limit) / input_streams[0].instrument.unit_size * 10) / 10
                        }]);
                        ind.pos_uuid = null;
                        ind.position = FLAT;
                        ind.entry = null;
                        ind.units = null;
                        ind.stop = null;
                        ind.limit = null;
                    }
                } else { // FLAT
                    // No reactions to price when position is FLAT
                }

            } else if (src_idx === 1) { // trade_cmds

                var commands = input_streams[1].get();

                _.each(commands, function(cmd) {
                    if (!ind.is_first_seen(cmd[1].cmd_uuid)) return; // skip events already processed
                    switch (cmd[0]) {
                        case 'enter':
                            if (ind.position === FLAT) {
                                ind.pos_uuid = cmd[1].pos_uuid;
                                ind.position = cmd[1].direction;
                                ind.entry = cmd[1].entry;
                                ind.units = cmd[1].units;
                                if (cmd[1].stop) ind.stop = cmd[1].stop;
                                if (cmd[1].limit) ind.limit = cmd[1].limit;
                                ind.events.push(['trade_start', {
                                    evt_uuid: uuid.v4(),
                                    pos_uuid: cmd[1].pos_uuid,
                                    label: cmd[1].label || null,
                                    date: bar.date,
                                    direction: ind.position,
                                    units: ind.units,
                                    entry_price: ind.entry || (ind.position === LONG ? bar.ask.close : bar.bid.close),
                                    stop: ind.stop,
                                    limit: ind.limit
                                }]);
                            }
                            break;
                        case 'exit': // exits current position, regardless of pos_uuid provided
                            if (ind.position !== FLAT) {
                                var exit_price = ind.position === LONG ? bar.bid.close : bar.ask.close;
                                ind.events.push(['trade_end', {
                                    evt_uuid: uuid.v4(),
                                    pos_uuid: ind.pos_uuid,
                                    date: bar.date,
                                    reason: 'exit',
                                    direction: ind.position,
                                    units: ind.units,
                                    entry_price: ind.entry,
                                    exit_price: exit_price,
                                    pips: Math.round((ind.entry - exit_price) / input_streams[0].instrument.unit_size * 10) / 10
                                }]);
                                ind.pos_uuid = null;
                                ind.position = FLAT;
                                ind.entry = null;
                                ind.units = null;
                            }
                            break;
                        case 'set_stop':
                            ind.stop = cmd[1].price;
                            if (ind.position !== FLAT) ind.events.push(['stop_updated', {
                                evt_uuid: uuid.v4(),
                                pos_uuid: cmd[1].pos_uuid,
                                date: bar.date,
                                price: cmd[1].price
                            }]);
                            break;
                        case 'set_limit':
                            ind.limit = cmd[1].price;
                            if (ind.position !== FLAT) ind.events.push(['limit_updated', {
                                evt_uuid: uuid.v4(),
                                pos_uuid: cmd[1].pos_uuid,
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

            output_stream.set(_.cloneDeep(ind.events));
            ind.last_index = ind.current_index();
        }
    };
});
