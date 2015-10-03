'use strict';

// Options:

// If 'options' param is a number, action is to move stoploss to breakeven when price reaches given param (value must be non-negative)

define(['lodash'], function(_) {

    var LONG = 1, SHORT = -1, FLAT = 0;
    var event_uuids_maxsize = 10;

    var default_options = {
    };

    return {
        param_names: ['options'],
        //      price              trade events+
        input: ['dual_candle_bar', 'trade_evts'],
        synch: ['a',               'b'],

        output: 'trade_cmds',

        initialize: function(params, input_streams, output_stream) {
            if (_.isNumber(params.options)) {
                if (params.options < 0) throw new Error("'options' parameter must be non-negative when provided as a number");
                this.triggers = [[params.options, 0.0]];
            } else if (_.isObject(params.options)) {
                this.options = _.defaults(params.options || {}, default_options);
                if (this.options.triggers) {
                    if (!_.isArray(this.options.triggers)) throw new Error("'triggers' option must be an array");
                    this.triggers = _.cloneDeep(this.options.triggers);
                    for (var i = 0; i <= this.triggers.length - 1; i++) {
                        if (!_.isArray(this.triggers[i]) || this.triggers[i].length !== 2) throw new Error("Each element of 'triggers' array must be a 2-element array of [trigger_pnl, stop]");
                        this.triggers[i][1] *= input_streams[0].instrument.unit_size;
                    }
                } else {
                    throw new Error("'triggers' property must be defined when 'options' param is an object");
                }
            }
            this.positions = {};
            this.last_index = null;
            this.event_uuids = [];
        },

        on_bar_update: function(params, input_streams, output_stream, src_idx) {

            if (this.current_index() !== this.last_index) {
                this.commands = [];
            }

            var bar = input_streams[0].get();
            var ask = bar.ask;
            var bid = bar.bid;

            switch (src_idx) {
                case 0: // price
                    _.each(this.positions, function(pos) {
                        if (pos.direction === LONG) {
                            _.each(this.triggers, function(trig) {
                                if (bid.close > pos.entry_price + (trig[0] * input_streams[0].instrument.unit_size)) {
                                    var newstop = pos.entry_price + trig[1];
                                    if (newstop > pos.stop) {
                                        this.commands.push(['set_stop', {
                                            id: pos.id,
                                            price: newstop,
                                            comment: 'Move to ' + (trig[1] == 0 ? 'B/E' : ('(Pnl = ' + trig[1] + '0')) + ' after PnL > ' + trig[0]
                                        }]);
                                    }
                                }
                            }, this);
                        } else if (pos.direction === SHORT) {
                            _.each(this.triggers, function(trig) {
                                if (ask.close < pos.entry_price - (trig[0] * input_streams[0].instrument.unit_size)) {
                                    var newstop = pos.entry_price - trig[1];
                                    if (newstop < pos.stop) {
                                        this.commands.push(['set_stop', {
                                            id: pos.id,
                                            price: newstop,
                                            comment: 'Move to ' + (trig[1] == 0 ? 'B/E' : ('(Pnl = ' + trig[1] + '0')) + ' after PnL > ' + trig[0]
                                        }]);
                                    }
                                }
                            }, this);
                        }
                    }, this);
                    output_stream.set(_.cloneDeep(this.commands));
                    break;

                case 1: // trade events
                    var events = input_streams[1].get();

                    // detect changes in position from trade proxy/simulator
                    _.each(events, function(evt) {
                        if (evt[1] && this.event_uuids.indexOf(evt[1].uuid) > -1) return;
                        switch (_.first(evt)) {
                            case 'trade_start':
                                this.positions[evt[1].id] = evt[1];
                                break;
                            case 'trade_end':
                                delete this.positions[evt[1].id];
                                break;
                            case 'stop_updated':
                                if (_.has(this.positions, evt[1].id)) {
                                    this.positions[evt[1].id].stop = evt[1].price;
                                }
                                break;
                            case 'limit_updated':
                                if (_.has(this.positions, evt[1].id)) {
                                    this.positions[evt[1].id].limit = evt[1].price;
                                }
                                break;
                            default:
                        }
                        this.event_uuids.push(evt[1].uuid);
                        if (this.event_uuids.length > event_uuids_maxsize) this.event_uuids.shift();
                    }, this);

                    this.stop_propagation();
                    break;
                default:
                    throw Error('Unexpected src_idx: ' + src_idx);
            }

            this.last_index = this.current_index();
        }
    };

});
