'use strict';

// Basic Trend+Execution strategy set up

// Enters trade when:
//     - trend and exec streams go in same direction
//     - climate stream is true
//     - not already in trade

// Uses fixed limit and stop

define(['lodash', 'node-uuid'], function(_, uuid) {

    var LONG = 1, SHORT = -1, FLAT = 0;
    var event_uuids_maxsize = 10;
    
    var default_options = {
        stop: 10,
        limit: 15    
    };

    return {
        param_names: ['options'],
        //      price              climate trend        exec         trade events
        input: ['dual_candle_bar', 'bool', 'direction', 'direction', 'trade_evts?'],
        synch: ['s',               's',    's',         's',         'b'],

        output: 'trade_cmds',

        initialize: function(params, input_streams, output_stream) {
            this.options = _.defaults(params.options || {}, default_options);
            if (this.options.stop && (!_.isNumber(this.options.stop) || this.options.stop < 0)) throw new Error("'stop' option must be a positive number");
            if (this.options.limit && (!_.isNumber(this.options.limit) || this.options.limit < 0)) throw new Error("'limit' option must be a positive number");

            this.next_trade_id = 1;
            this.position = FLAT;
            this.last_index = null;

            this.commands = [];
            this.event_uuids = [];
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
                    var climate = input_streams[1].get();
                    var trend = input_streams[2].get();
                    var exec = input_streams[3].get();

                    if (climate) { // climate check
                        if (this.position === FLAT && trend === LONG && exec === LONG) {
                            this.commands.push(['enter', {
                                id: this.next_trade_id,
                                uuid: uuid.v4(),
                                direction: LONG,
                                entry: price.ask.close,
                                units: 1,
                                stop: price.ask.close - (this.options.stop * input_streams[0].instrument.unit_size),
                                limit: price.ask.close + (this.options.limit * input_streams[0].instrument.unit_size)
                            }]);
                            this.next_trade_id++;
                        } else if (this.position === FLAT && trend === SHORT && exec === SHORT) {
                            this.commands.push(['enter', {
                                id: this.next_trade_id,
                                uuid: uuid.v4(),
                                direction: SHORT,
                                entry: price.bid.close,
                                units: 1,
                                stop: price.bid.close + (this.options.stop * input_streams[0].instrument.unit_size),
                                limit: price.bid.close - (this.options.limit * input_streams[0].instrument.unit_size)
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
                        if (evt[1] && this.event_uuids.indexOf(evt[1].uuid) > -1) return;
                        switch (_.first(evt)) {
                            case 'trade_start':
                                this.position = evt[1].direction;
                                break;
                            case 'trade_end':
                                this.position = FLAT;
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
