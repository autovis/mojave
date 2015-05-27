'use strict';

// Basic Trend+Execution strategy set up

// Enters trade when:
//     - trend and exec streams go in same direction
//     - climate stream is true
//     - not already in trade

// Uses fixed limit and stop

define(['lodash'], function(_) {

    var LONG = 1, SHORT = -1, FLAT = 0;

    var stop_distance = 20;
    var limit_distance = 25;

    return {
        param_names: [],
        //      price              climate trend        exec         trade events
        input: ['dual_candle_bar', 'bool', 'direction', 'direction', 'trade_evts?'],
        synch: ['s',               's',    's',         's',         'a'],

        output: 'trade_cmds',

        initialize: function(params, input_streams, output_stream) {
            this.next_trade_id = 1;
            this.position = FLAT;
            this.last_index = null;

            this.commands = [];
        },

        on_bar_update: function(params, input_streams, output_stream, src_idx) {

            if (this.current_index() !== this.last_index) {
                this.commands = [];
            }

            switch (src_idx) {
                case 0: // price
                case 1: // climate
                case 2: // trend
                case 3: // exec
                    var price = input_streams[0].get();
                    //var climate = input_streams[1].get();
                    var trend = input_streams[2].get();
                    var exec = input_streams[3].get();

                    if (true) { // climate check
                        if (this.position === FLAT && trend === LONG && exec === LONG) {
                            this.commands.push(['enter', {
                                id: this.next_trade_id,
                                direction: LONG,
                                entry: price.ask.close,
                                units: 1,
                                stop: price.ask.close - (stop_distance * input_streams[0].instrument.unit_size),
                                limit: price.ask.close + (limit_distance * input_streams[0].instrument.unit_size)
                            }]);
                            this.next_trade_id++;
                        } else if (this.position === FLAT && trend === SHORT && exec === SHORT) {
                            this.commands.push(['enter', {
                                id: this.next_trade_id,
                                direction: SHORT,
                                entry: price.bid.close,
                                units: 1,
                                stop: price.bid.close + (stop_distance * input_streams[0].instrument.unit_size),
                                limit: price.bid.close - (limit_distance * input_streams[0].instrument.unit_size)
                            }]);
                            this.next_trade_id++;
                        }
                    }
                    output_stream.set(_.cloneDeep(this.commands));
                    break;

                case 4: // trade
                    var events = input_streams[4].get();

                    // detect changes in position from trade proxy/simulator
                    _.each(events, function(evt) {
                        switch (_.first(evt)) {
                            case 'trade_start':
                                console.log('TRADE STARTED:', input_streams[0].get().date, evt[1]);
                                this.position = evt[1].direction;
                                break;
                            case 'trade_end':
                                console.log('TRADE ENDED:', input_streams[0].get().date, evt[1]);
                                this.position = FLAT;
                                break;
                            default:
                        }
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
