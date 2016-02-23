'use strict';

// Issues 'trade_start' trade command when:
//     - climate stream is true
//     - exec stream is LONG or SHORT
//     - not currently in a position

// Options:

//   stop      - initial stop value to use
//   limit     - initial limit value to use
//   gap       - distance in pips to place order from 'close' price

define(['lodash', 'node-uuid'], function(_, uuid) {

    var LONG = 1, SHORT = -1, FLAT = 0;

    var default_options = {
        stop: 10,   // stop-loss distance in pips
        limit: 15,  // take-profit distance in pips
        gap: 0,     // gap to leave between entry order and market price
        units: 1    // default units to use
    };

    return {
        description: 'Triggers a single trade at a time based on climate bool and directional execution streams',

        param_names: ['options'],
        //      price              climate      entry        trade events
        input: ['dual_candle_bar', 'bool',      'direction', 'trade_evts'],
        synch: ['s',               's',         's',         'b'],

        output: 'trade_cmds',

        initialize: function(params, input_streams, output_stream) {
            this.options = _.defaults(params.options || {}, default_options);
            if (this.options.stop && (!_.isNumber(this.options.stop) || this.options.stop < 0)) throw new Error("'stop' option must be a positive number");
            if (this.options.limit && (!_.isNumber(this.options.limit) || this.options.limit < 0)) throw new Error("'limit' option must be a positive number");
            this.options.gap_price = this.options.gap ? this.options.gap * input_streams[0].instrument.unit_size : 0;

            this.position = FLAT;
            this.commands = [];
            this.last_index = null;

            this.pos_uuid_pending = null; // set when cmd was issued, but corresp. evt not yet received

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

            if (this.current_index() !== this.last_index) { // if new bar
                this.commands = [];
                this.pos_uuid_pending = null;
            }

            switch (src_idx) {

                case 0: // price
                case 1: // climate
                case 2: // entry
                    var price = input_streams[0].get();
                    var climate = input_streams[1].get();
                    var entry = input_streams[2].get();

                    if (climate && this.position === FLAT && !this.pos_uuid_pending) {
                        if (entry === LONG) {
                            this.pos_uuid_pending = uuid.v4(); // pending receipt of corresp. event
                            this.commands.push(['enter', {
                                cmd_uuid: uuid.v4(),
                                pos_uuid: this.pos_uuid_pending,
                                direction: LONG,
                                entry: price.ask.close + this.options.gap_price,
                                units: this.options.units,
                                stop: price.ask.close - (this.options.stop * input_streams[0].instrument.unit_size),
                                limit: price.ask.close + (this.options.limit * input_streams[0].instrument.unit_size)
                            }]);
                        } else if (entry === SHORT) {
                            this.pos_uuid_pending = uuid.v4();
                            this.commands.push(['enter', {
                                cmd_uuid: uuid.v4(),
                                pos_uuid: this.pos_uuid_pending,
                                direction: SHORT,
                                entry: price.bid.close - this.options.gap_price,
                                units: this.options.units,
                                stop: price.bid.close + (this.options.stop * input_streams[0].instrument.unit_size),
                                limit: price.bid.close - (this.options.limit * input_streams[0].instrument.unit_size)
                            }]);
                        }
                    }

                    output_stream.set(_.cloneDeep(this.commands));
                    break;

                case 3: // trade
                    var events = input_streams[3].get();

                    // detect changes in position from trade proxy/simulator
                    _.each(events, function(evt) {
                        if (!this.is_first_seen(evt[1].evt_uuid)) return; // skip events already processed
                        switch (_.first(evt)) {
                            case 'trade_start':
                                this.position = evt[1].direction;
                                if (this.pos_uuid_pending && this.pos_uuid_pending === evt[1].pos_uuid) this.pos_uuid_pending = null;
                                break;
                            case 'trade_end':
                                this.position = FLAT;
                                if (this.pos_uuid_pending && this.pos_uuid_pending === evt[1].pos_uuid) this.pos_uuid_pending = null;
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
