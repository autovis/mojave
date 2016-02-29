'use strict';

// Options:

// distance  - maximum distance between price and stop position
// step      - trail stop at stopgaps that are 'step' units apart
// use_close - whether to use 'close' price or 'high/low' price to calculate stop distance
// start_bar - number of bars to wait before trailing the stop

define(['lodash', 'node-uuid'], function(_, uuid) {

    var LONG = 1, SHORT = -1, FLAT = 0;

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
                        var price, stop;
                        if (pos.direction === LONG) {
                            price = ind.options.use_close ? bid.close : bid.low;
                            stop = ind.options.step ? stopgap_round(pos.entry_price, price - ind.pricedist, ind.options.step * input_streams[0].instrument.unit_size, LONG) : price - ind.pricedist;
                            if (stop > pos.stop && input_streams[0].current_index() - pos.start_bar >= ind.options.start_bar) {
                                ind.commands.push(['set_stop', {
                                    cmd_uuid: uuid.v4(),
                                    pos_uuid: pos.pos_uuid,
                                    price: stop,
                                    comment: 'Trailing stop adjustment'
                                }]);
                            }
                        } else if (pos.direction === SHORT) {
                            price = ind.options.use_close ? ask.close : ask.high;
                            stop = ind.options.step ? stopgap_round(pos.entry_price, price + ind.pricedist, ind.options.step * input_streams[0].instrument.unit_size, SHORT) : price + ind.pricedist;
                            if (stop < pos.stop && input_streams[0].current_index() - pos.start_bar >= ind.options.start_bar) {
                                ind.commands.push(['set_stop', {
                                    cmd_uuid: uuid.v4(),
                                    pos_uuid: pos.pos_uuid,
                                    price: stop,
                                    comment: 'Trailing stop adjustment'
                                }]);
                            }
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
                                var pos = evt[1];
                                pos.start_bar = input_streams[0].current_index();
                                ind.positions[evt[1].pos_uuid] = pos;
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

    function stopgap_round(basenum, offsetnum, interval, direction) {
        if (direction === LONG) {
            return Math.floor((offsetnum - basenum) / interval) * interval + basenum;
        } else if (direction === SHORT) {
            return Math.ceil((offsetnum - basenum) / interval) * interval + basenum;
        }
    }

});
