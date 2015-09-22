'use strict';

//

define(['lodash'], function(_) {

    var LONG = 1, SHORT = -1, FLAT = 0;
    var default_dist = 10.0;
    var event_uuids_maxsize = 10;

    return {
        param_names: ['distance'],
        //      price              trade events+
        input: ['dual_candle_bar', 'trade_evts'],
        synch: ['a',               'b'],

        output: 'trade_cmds',

        initialize: function(params, input_streams, output_stream) {
            this.positions = {};
            this.last_index = null;
            this.pricedist = (params.distance || default_dist) * input_streams[0].instrument.unit_size;
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
                            if (pos.stop && bid.low - this.pricedist > pos.stop) {
                                this.commands.push(['set_stop', {
                                    id: pos.id,
                                    price: bid.low - this.pricedist
                                }]);
                            }
                        } else if (pos.direction === SHORT) {
                            if (pos.stop && ask.high + this.pricedist < pos.stop) {
                                this.commands.push(['set_stop', {
                                    id: pos.id,
                                    price: ask.high + this.pricedist
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
