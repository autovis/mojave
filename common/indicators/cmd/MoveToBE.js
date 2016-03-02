'use strict';

// Options:

// If 'options' param is a number, action is to move stoploss to breakeven when price reaches given param (value must be non-negative)

define(['lodash', 'node-uuid'], function(_, uuid) {

    var LONG = 1, SHORT = -1, FLAT = 0;

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
                ind.commands = [];
            }

            var bar = input_streams[0].get();
            var ask = bar.ask;
            var bid = bar.bid;

            switch (src_idx) {
                case 0: // price
                    _.each(ind.positions, function(pos) {
                        if (pos.direction === LONG) {
                            _.each(ind.triggers, function(trig) {
                                if (bid.close > pos.entry_price + (trig[0] * input_streams[0].instrument.unit_size)) {
                                    var newstop = pos.entry_price + trig[1];
                                    if (newstop > pos.stop) {
                                        ind.commands.push(['set_stop', {
                                            cmd_uuid: uuid.v4(),
                                            pos_uuid: pos.pos_uuid,
                                            price: newstop,
                                            comment: 'Move to ' + (trig[1] === 0 ? 'B/E' : ('(Pnl = ' + trig[1] + '0')) + ' after PnL > ' + trig[0]
                                        }]);
                                    }
                                }
                            });
                        } else if (pos.direction === SHORT) {
                            _.each(ind.triggers, function(trig) {
                                if (ask.close < pos.entry_price - (trig[0] * input_streams[0].instrument.unit_size)) {
                                    var newstop = pos.entry_price - trig[1];
                                    if (newstop < pos.stop) {
                                        ind.commands.push(['set_stop', {
                                            cmd_uuid: uuid.v4(),
                                            pos_uuid: pos.pos_uuid,
                                            price: newstop,
                                            comment: 'Move to ' + (trig[1] === 0 ? 'B/E' : ('(Pnl = ' + trig[1] + '0')) + ' after PnL > ' + trig[0]
                                        }]);
                                    }
                                }
                            });
                        }
                    });
                    output_stream.set(_.cloneDeep(ind.commands));
                    break;

                case 1: // trade events
                    var events = input_streams[1].get();

                    // detect changes in position from trade proxy/simulator
                    _.each(events, function(evt) {
                        if (!ind.is_first_seen(evt[1].evt_uuid)) return; // skip events already processed
                        switch (evt[0]) {
                            case 'trade_start':
                                ind.positions[evt[1].pos_uuid] = evt[1];
                                break;
                            case 'trade_end':
                                delete ind.positions[evt[1].pos_uuid];
                                break;
                            case 'stop_updated':
                                if (_.has(ind.positions, evt[1].pos_uuid)) {
                                    ind.positions[evt[1].pos_uuid].stop = evt[1].price;
                                }
                                break;
                            case 'limit_updated':
                                if (_.has(ind.positions, evt[1].pos_uuid)) {
                                    ind.positions[evt[1].pos_uuid].limit = evt[1].price;
                                }
                                break;
                            default:
                        }
                    });

                    ind.stop_propagation();
                    break;
                default:
                    throw Error('Unexpected src_idx: ' + src_idx);
            }

            ind.last_index = ind.current_index();
        }
    };

});
