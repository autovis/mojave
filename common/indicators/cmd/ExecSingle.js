'use strict';

// Enters trade when:
//     - climate stream is true
//     - exec stream is NOT FLAT
//     - not already in trade

// Options:

//   stop      - initial stop value to use
//   limit     - initial limit value to use
//   gap       - distance in pips to place order from 'close' price

define(['lodash', 'node-uuid'], function(_, uuid) {

    var LONG = 1, SHORT = -1, FLAT = 0;
    var event_uuids_maxsize = 10;

    var default_options = {
        stop: 10,   // stop-loss distance in pips
        limit: 15,  // take-profit distance in pips
        gap: 0      // gap to leave between entry order and market price
    };

    return {
        description: 'Triggers a single trade at a time based on climate bool and directional execution streams',

        param_names: ['options'],
        //      price              climate      exec         trade events
        input: ['dual_candle_bar', 'bool',      'direction', 'trade_evts'],
        synch: ['s',               's',         's',         'b'],

        output: 'trade_cmds',

        initialize: function(params, input_streams, output_stream) {
            this.options = _.defaults(params.options || {}, default_options);
            if (this.options.stop && (!_.isNumber(this.options.stop) || this.options.stop < 0)) throw new Error("'stop' option must be a positive number");
            if (this.options.limit && (!_.isNumber(this.options.limit) || this.options.limit < 0)) throw new Error("'limit' option must be a positive number");
            this.options.gap_price = this.options.gap ? this.options.gap * input_streams[0].instrument.unit_size : 0;

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
                case 1: // exec
                case 2: // climate
                    var price = input_streams[0].get();
                    var climate = input_streams[1].get();
                    var exec = input_streams[2].get();

                    if (climate && this.position === FLAT) {
                        if (exec === LONG) {
                            this.commands.push(['enter', {
                                id: this.next_trade_id,
                                uuid: uuid.v4(),
                                direction: LONG,
                                entry: price.ask.close + this.options.gap_price,
                                units: 1,
                                stop: price.ask.close - (this.options.stop * input_streams[0].instrument.unit_size),
                                limit: price.ask.close + (this.options.limit * input_streams[0].instrument.unit_size)
                            }]);
                            this.next_trade_id++;
                        } else if (exec === SHORT) {
                            this.commands.push(['enter', {
                                id: this.next_trade_id,
                                uuid: uuid.v4(),
                                direction: SHORT,
                                entry: price.bid.close - this.options.gap_price,
                                units: 1,
                                stop: price.bid.close + (this.options.stop * input_streams[0].instrument.unit_size),
                                limit: price.bid.close - (this.options.limit * input_streams[0].instrument.unit_size)
                            }]);
                            this.next_trade_id++;
                        }
                    }

                    output_stream.set(_.cloneDeep(this.commands));
                    break;

                case 3: // trade
                    var events = input_streams[3].get();

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
