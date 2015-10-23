'use strict';

// Options:

// distance  - maximum distance between price and stop position
// step      - trail stop at stopgaps that are 'step' units apart
// use_close - whether to use 'close' price or 'high/low' price to calculate stop distance
// start_bar - number of bars to wait before trailing the stop

define(['lodash'], function(_) {

    var LONG = 1, SHORT = -1, FLAT = 0;
    var event_uuids_maxsize = 10;

    var default_options = {
        distance: 10.0,
        step: false,
        use_close: false,
        start_bar: 0
    };

    return {
        param_names: ['options'],
        //      price              trade events+
        input: ['dual_candle_bar', 'trade_evts'],
        synch: ['a',               'b'],

        output: 'trade_cmds',

        initialize: function(params, input_streams, output_stream) {
            this.options = _.defaults(params.options || {}, default_options);
            if (this.options.step && !_.isNumber(this.options.step)) throw new Error("'step' option must be a number");
            this.positions = {};
            this.last_index = null;
            this.pricedist = this.options.distance * input_streams[0].instrument.unit_size;
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
                        var stop;
                        if (pos.direction === LONG) {
                            var price = this.options.use_close ? bid.close : bid.low;
                            stop = this.options.step ? stopgap_round(pos.entry_price, price - this.pricedist, this.options.step * input_streams[0].instrument.unit_size, LONG) : price - this.pricedist;
                            if (stop > pos.stop && input_streams[0].current_index() - pos.start_bar >= this.options.start_bar) {
                                this.commands.push(['set_stop', {
                                    id: pos.id,
                                    price: stop,
                                    comment: 'Trailing stop adjustment'
                                }]);
                            }
                        } else if (pos.direction === SHORT) {
                            var price = this.options.use_close ? ask.close : ask.high;
                            stop = this.options.step ? stopgap_round(pos.entry_price, price + this.pricedist, this.options.step * input_streams[0].instrument.unit_size, SHORT) : price + this.pricedist;
                            if (stop < pos.stop && input_streams[0].current_index() - pos.start_bar >= this.options.start_bar) {
                                this.commands.push(['set_stop', {
                                    id: pos.id,
                                    price: stop,
                                    comment: 'Trailing stop adjustment'
                                }]);
                            }
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
                                var pos = evt[1];
                                pos.start_bar = input_streams[0].current_index();
                                this.positions[evt[1].id] = pos;
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

    function stopgap_round(basenum, offsetnum, interval, direction) {
        if (direction === LONG) {
            return Math.floor((offsetnum - basenum) / interval) * interval + basenum;
        } else if (direction === SHORT) {
            return Math.ceil((offsetnum - basenum) / interval) * interval + basenum;
        }
    }

});
