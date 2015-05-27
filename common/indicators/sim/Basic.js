'use strict';

// Basic Trade Simulation

// - One open position at a time
// - Can only work with a single instrument

define(['lodash'], function(_) {

    var LONG = 1, SHORT = -1, FLAT = 0;

    return {

        param_names: [],

        input: ['dual_candle_bar', 'trade_cmds'],
        synch: ['s',               's'],
        output: 'trade_evts',

        initialize: function(params, input_streams, output_stream) {

            this.position = FLAT;
            this.entry = null;

            this.stop = null;
            this.limit = null;
            this.units = null;

            this.last_index = null;
            this.trade_id = null;

            this.events = [];
        },

        on_bar_update: function(params, input_streams, output_stream, src_idx) {

            if (this.current_index() !== this.last_index) {
                this.events = [];
            }

            var bar = input_streams[0].get();
            var date = bar.date;
            var ask = bar.ask;
            var bid = bar.bid;

            // Check for conditions that will terminate any open positions
            if (this.position === LONG) {
                if (this.stop && bid.low <= this.stop) {
                    this.events.push(['trade_end', {
                        id: this.trade_id,
                        date: date,
                        reason: 'stop',
                        direction: this.position,
                        units: this.units,
                        entry_price: this.entry,
                        exit_price: this.stop,
                        pips: Math.round((this.stop - this.entry) / input_streams[0].instrument.unit_size * 10) / 10
                        //instrument: inp.enter_short.instrument || (input_streams[0].instrument && input_streams[0].instrument.id)
                    }]);
                    this.trade_id = null;
                    this.position = FLAT;
                    this.entry = null;
                    this.units = null;
                    this.stop = null;
                    this.limit = null;
                } else if (this.limit && bid.high >= this.limit) {
                    this.events.push(['trade_end', {
                        id: this.trade_id,
                        date: date,
                        reason: 'limit',
                        direction: this.position,
                        units: this.units,
                        entry_price: this.entry,
                        exit_price: this.limit,
                        pips: Math.round((this.limit - this.entry) / input_streams[0].instrument.unit_size * 10) / 10
                        //instrument: inp.enter_short.instrument || (input_streams[0].instrument && input_streams[0].instrument.id)
                    }]);
                    this.trade_id = null;
                    this.position = FLAT;
                    this.entry = null;
                    this.units = null;
                    this.stop = null;
                    this.limit = null;
                }
            } else if (this.position === SHORT) {
                if (this.stop && ask.high >= this.stop) {
                    this.events.push(['trade_end', {
                        id: this.trade_id,
                        date: date,
                        reason: 'stop',
                        direction: this.position,
                        units: this.units,
                        entry_price: this.entry,
                        exit_price: this.stop,
                        pips: Math.round((this.entry - this.stop) / input_streams[0].instrument.unit_size * 10) / 10
                        //instrument: inp.enter_short.instrument || (input_streams[0].instrument && input_streams[0].instrument.id)
                    }]);
                    this.trade_id = null;
                    this.position = FLAT;
                    this.entry = null;
                    this.units = null;
                    this.stop = null;
                    this.limit = null;
                } else if (this.limit && ask.low <= this.limit) {
                    this.events.push(['trade_end', {
                        id: this.trade_id,
                        date: date,
                        reason: 'limit',
                        direction: this.position,
                        units: this.units,
                        entry_price: this.entry,
                        exit_price: this.limit,
                        pips: Math.round((this.entry - this.limit) / input_streams[0].instrument.unit_size * 10) / 10
                        //instrument: inp.enter_short.instrument || (input_streams[0].instrument && input_streams[0].instrument.id)
                    }]);
                    this.trade_id = null;
                    this.position = FLAT;
                    this.entry = null;
                    this.units = null;
                    this.stop = null;
                    this.limit = null;
                }
            } else { // FLAT
                // No reactions to price when position is FLAT
            }

            _.each(input_streams[1].get(), function(cmd) {

                switch (_.first(cmd)) {
                    case 'enter':
                        if (this.position === FLAT) {
                            this.trade_id = cmd[1].id;
                            this.position = cmd[1].direction;
                            this.entry = cmd[1].entry;
                            this.units = cmd[1].units;
                            if (cmd[1].stop) this.stop = cmd[1].stop;
                            if (cmd[1].limit) this.limit = cmd[1].limit;
                            this.events.push(['trade_start', {
                                id: this.trade_id,
                                date: date,
                                direction: this.position,
                                units: this.units,
                                entry_price: ask.close,
                                //instrument: inp.enter_long.instrument || (input_streams[0].instrument && input_streams[0].instrument.id)
                                stop: this.stop,
                                limit: this.limit
                            }]);
                        }
                        break;
                    case 'exit':
                        if (this.position !== FLAT) {
                            var exit_price = this.position === LONG ? bid.close : ask.close;
                            this.events.push(['trade_end', {
                                id: cmd[1].id || this.trade_id,
                                date: date,
                                reason: 'exit',
                                direction: this.position,
                                units: this.units,
                                entry_price: this.entry,
                                exit_price: exit_price,
                                pips: Math.round((this.entry - exit_price) / input_streams[0].instrument.unit_size * 10) / 10
                                //instrument: inp.enter_short.instrument || (input_streams[0].instrument && input_streams[0].instrument.id)
                            }]);
                            this.trade_id = null;
                            this.position = FLAT;
                            this.entry = null;
                            this.units = null;
                        }
                        break;
                    case 'set_stop':
                        this.stop = cmd[1].price;
                        if (this.position !== FLAT) this.events.push(['stop_updated', _.assign(cmd[1], {date: date})]);
                        break;
                    case 'set_limit':
                        this.limit = cmd[1].price;
                        if (this.position !== FLAT) this.events.push(['limit_updated', _.assign(cmd[1], {date: date})]);
                        break;
                    default:
                }

            }, this);

            output_stream.set(_.cloneDeep(this.events));
        }
    };
});
