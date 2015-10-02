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
            if (_.isNumber(this.options)) {
                if (this.options < 0) throw new Error("'options' parameter must be non-negative when provided as a number");
                this.triggers = {};
                this.triggers[this.options * input_streams[0].instrument.unit_size] = 0.0;
            } else if (_.isObject(this.options)) {
                this.options = _.defaults(params.options || {}, default_options);
                throw new Error("object type for 'options' not yet supported");
            }
            if (this.options.step && !_.isNumber(this.options.step)) throw new Error("'step' option must be a number");
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
                            _.each(this.triggers, function(pnl, trigger_price) {
                                if (bid.close > trigger_price) {
                                    this.commands.push(['set_stop', { 
                                        id: pos.id,
                                        price: pos.entry + (pnl * input_streams[0].instrument.unit_size)
                                    }]);
                                }
                            }, this);
                        } else if (pos.direction === SHORT) {
                            _.each(this.triggers, function(pnl, trigger_price) {
                                if (ask.close < trigger_price) {
                                    this.commands.push(['set_stop', {
                                        id: pos.id,
                                        price: pos.entry - (pnl * input_streams[0].instrument.unit_size)
                                    }]);
                                }
                            }, this)
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
