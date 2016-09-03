'use strict';

// Issues 'trade_start' trade command when:
//     - climate stream is true
//     - exec stream is LONG or SHORT
//     - not currently in a position

// Options:

//   stop      - initial stop value to use
//   limit     - initial limit value to use
//   gap       - distance in pips to place order from 'close' price

define(['lodash', 'node-uuid', 'expression'], function(_, uuid, Expression) {

    const LONG = 1, SHORT = -1, FLAT = 0;

    const default_options = {
        label: '',  // label to identify type of entry (1-4 chars)
        stop: 10,   // stop-loss distance in pips
        limit: 15,  // take-profit distance in pips
        stop_price: null,
        limit_price: null,
        gap: 0,     // gap to leave between entry order and market price
        units: 1    // default units to use
    };

    return {
        description: 'Triggers a single trade at a time based on climate bool and directional execution streams',

        param_names: ['options'],
        //      price              climate      entry        trade events    <extra>
        input: ['dual_candle_bar', 'bool',      'direction', 'trade_evts',   '_*'],
        synch: ['s',               's',         's',         'b',            's'],

        output: 'trade_cmds',

        initialize: function(params, input_streams, output_stream) {
            this.options = _.defaults(params.options || {}, default_options);
            this.unit_size = this.inputs[0].instrument.unit_size;
            if (this.options.stop_price) {
                if (!_.isString(this.options.stop_price)) throw new Error("'stop_price' option must be a string expression");
                this.stop_expr = new Expression(this.options.stop_price, {streams: this.inputs, vars: this.vars});
            } else if (this.options.stop) {
                if (!_.isNumber(this.options.stop) || this.options.stop < 0) throw new Error("'stop' option must be a positive number");
            }
            if (this.options.limit_price) {
                if (!_.isString(this.options.limit_price)) throw new Error("'limit_price' option must be a string expression");
                this.limit_expr = new Expression(this.options.limit_price, {streams: this.inputs, vars: this.vars});
            } else if (this.options.limit) {
                if (!_.isNumber(this.options.limit) || this.options.limit < 0) throw new Error("'limit' option must be a positive number");
            }
            this.options.gap_price = this.options.gap ? this.options.gap * input_streams[0].instrument.unit_size : 0;

            this.position = FLAT;
            this.commands = [];
            this.last_index = null;

            this.pos_uuid_pending = null; // set when cmd was issued, but corresp. evt not yet received

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

            if (ind.current_index() !== ind.last_index) { // if new bar
                ind.commands = [];
                ind.pos_uuid_pending = null;
            }

            switch (src_idx) {

                case 0: // price
                case 1: // climate
                case 2: // entry
                    var price = input_streams[0].get();
                    var climate = input_streams[1].get();
                    var entry = input_streams[2].get();

                    if (climate && ind.position === FLAT && !ind.pos_uuid_pending) {
                        if (entry === LONG) {
                            ind.pos_uuid_pending = uuid.v4(); // pending receipt of corresp. event
                            ind.commands.push(['enter', {
                                cmd_uuid: uuid.v4(),
                                pos_uuid: ind.pos_uuid_pending,
                                label: params.options.label,
                                direction: LONG,
                                entry: price.ask.close + ind.options.gap_price,
                                units: ind.options.units,
                                stop: this.options.stop_price ? this.stop_expr.evaluate() : price.ask.close - (ind.options.stop * this.unit_size),
                                limit: this.options.limit_price ? this.limit_expr.evaluate() : price.ask.close + (ind.options.limit * this.unit_size)
                            }]);
                        } else if (entry === SHORT) {
                            ind.pos_uuid_pending = uuid.v4();
                            ind.commands.push(['enter', {
                                cmd_uuid: uuid.v4(),
                                pos_uuid: ind.pos_uuid_pending,
                                label: params.options.label,
                                direction: SHORT,
                                entry: price.bid.close - ind.options.gap_price,
                                units: ind.options.units,
                                stop: this.options.stop_price ? this.stop_expr.evaluate() : price.bid.close + (ind.options.stop * this.unit_size),
                                limit: this.options.limit_price ? this.limit_expr.evaluate() : price.bid.close - (ind.options.limit * this.unit_size)
                            }]);
                        }
                    }

                    if (self.debug && !_.isEmpty(ind.commands)) console.log(JSON.stringify(ind.commands, null, 4));

                    output_stream.set(_.cloneDeep(ind.commands));
                    break;

                case 3: // trade
                    var events = input_streams[3].get();

                    // detect changes in position from trade proxy/simulator
                    _.each(events, function(evt) {
                        if (!ind.is_first_seen(evt[1].evt_uuid)) return; // skip events already processed
                        switch (_.head(evt)) {
                            case 'trade_start':
                                ind.position = evt[1].direction;
                                if (ind.pos_uuid_pending && ind.pos_uuid_pending === evt[1].pos_uuid) ind.pos_uuid_pending = null;
                                break;
                            case 'trade_end':
                                ind.position = FLAT;
                                if (ind.pos_uuid_pending && ind.pos_uuid_pending === evt[1].pos_uuid) ind.pos_uuid_pending = null;
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
