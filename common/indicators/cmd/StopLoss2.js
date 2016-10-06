'use strict';

// Options:

// dist  - maximum distance between price and stop position
// step      - trail stop at stopgaps that are 'step' units apart
// use_close - whether to use 'close' price or 'high/low' price to calculate stop distance
// start_bar - number of bars to wait before trailing the stop

define(['lodash', 'node-uuid', 'expression'], function(_, uuid, Expression) {

    const LONG = 1, SHORT = -1;

    const default_options = {
        mode: 'pips',
        step: false,
        use_close: false,
        allowgoback: false
    };

    return {
        description: `Issues commands to position and move stop loss based on an expression rule`,

        param_names: ['rule_expr', 'options'],

        //      price              trade events      extra
        input: ['dual_candle_bar', 'trade_evts',     '_*'],
        synch: ['s',               'b',              's'],

        output: 'trade_cmds',

        initialize() {
            this.positions = {};
            this.commands = [];
            this.unit_size = this.inputs[0].instrument.unit_size;
            this.rule_expr = new Expression(this.param.rule_expr, {
                streams: this.inputs,
                vars: this.vars
            });

            // filter on items that haven't been seen in 'n' unique instances
            var seen_items = Array(20), seen_idx = 0;
            this.is_first_seen = function(item) {
                if (_.includes(seen_items, item)) return false;
                seen_items[seen_idx % seen_items.length] = item;
                seen_idx += 1;
                return true;
            };

            this.vars.unitsize = this.unit_size;
            this.vars.entry = 0;
            this.vars.dir = 0;
            this.vars.bar = -1;

            this.param.options = this.param.options || {};
            _.each(default_options, (val, key) => {
                if (!_.has(this.param.options, key)) this.param.options[key] = val;
            });

            this.rule_expr.init();
        },

        on_bar_open() {
            this.commands = [];
            //_.defaults(this.param.options, default_options);
        },

        on_bar_update(params, input_streams, output_stream, src_idx) {

            var bar = this.inputs[0].get();

            switch (src_idx) {
                case 0: // price
                    check_positions.call(this, bar);

                    // DEBUG ###############
                    if (this.debug && !_.isEmpty(this.commands)) console.log(JSON.stringify(this.commands, null, 4));

                    this.output.set(_.cloneDeep(this.commands));
                    break;

                case 1: // trade events
                    var events = this.inputs[1].get();

                    // detect changes in position from trade proxy/simulator
                    _.each(events, evt => {
                        if (!this.is_first_seen(evt[1].evt_uuid)) return; // skip events already processed
                        switch (evt[0]) {
                            case 'trade_start':
                                var pos = evt[1];
                                pos.entry_bar = this.output.index;
                                pos.get_price = _.bind(get_price, this, pos);
                                pos.apply_step = _.bind(apply_step, this, pos);
                                this.positions[evt[1].pos_uuid] = pos;
                                check_positions.call(this, bar);
                                break;
                            case 'trade_end':
                                delete this.positions[evt[1].pos_uuid];
                                break;
                            case 'stop_updated':
                                if (_.has(this.positions, evt[1].pos_uuid)) {
                                    this.positions[evt[1].pos_uuid].stop = evt[1].price;
                                }
                                break;
                            case 'limit_updated':
                                if (_.has(this.positions, evt[1].pos_uuid)) {
                                    this.positions[evt[1].pos_uuid].limit = evt[1].price;
                                }
                                break;
                            default:
                        }
                    });

                    var new_cmds = _.filter(this.commands, cmd => this.is_first_seen(cmd[1].cmd_uuid));
                    if (!_.isEmpty(new_cmds)) {
                        this.output.set(_.cloneDeep(new_cmds));
                    } else {
                        this.stop_propagation();
                    }
                    break;
                default:
                    throw Error('Unexpected src_idx: ' + src_idx);
            }

        }

    };

    function check_positions(bar) {
        _.each(this.positions, pos => {
            this.vars.entry = pos.entry_price;
            this.vars.dir = pos.direction;
            this.vars.bar = this.index - pos.entry_bar;
            if (this.vars.dir === LONG) {
                let base_price = this.param.options.use_close ? bar.bid.close : bar.bid.low;
                let stop = pos.apply_step(pos.entry_price, pos.get_price(base_price, this.rule_expr.evaluate()));
                if (this.param.options.allowgoback ? stop !== pos.stop : stop > pos.stop) {
                    this.commands.push(['set_stop', {
                        cmd_uuid: uuid.v4(),
                        pos_uuid: pos.pos_uuid,
                        price: stop,
                        comment: 'Trailing stop adjustment'
                    }]);
                }
            } else if (this.vars.dir === SHORT) {
                let base_price = this.param.options.use_close ? bar.ask.close : bar.ask.high;
                let stop = pos.apply_step(pos.entry_price, pos.get_price(base_price, this.rule_expr.evaluate()));
                if (this.param.options.allowgoback ? stop !== pos.stop : stop < pos.stop) {
                    this.commands.push(['set_stop', {
                        cmd_uuid: uuid.v4(),
                        pos_uuid: pos.pos_uuid,
                        price: stop,
                        comment: 'Trailing stop adjustment'
                    }]);
                }
            }
        });
    }

    // calculates price if mode is set to 'pips'
    function get_price(pos, base_price, offset) {
        if (this.param.options.mode === 'pips') {
            return pos.direction === LONG ? (base_price + offset * this.unit_size) : (base_price - offset * this.unit_size);
        } else { // assume mode is 'price'
            return offset;
        }
    }

    // rounds offset_price to interval based on 'step' option
    function apply_step(pos, base_price, offset_price) {
        if (this.param.options.step) {
            var stepsize = this.param.options.step * this.unit_size;
            if (pos.direction === LONG) {
                return Math.floor((offset_price - base_price) / stepsize) * stepsize + base_price;
            } else if (pos.direction === SHORT) {
                return Math.ceil((offset_price - base_price) / stepsize) * stepsize + base_price;
            }
        } else { // if not 'step' defined, just return offset_price as is
            return offset_price;
        }
    }

});
