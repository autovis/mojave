'use strict';

define(['lodash', 'expression'], function(_, Expression) {

    var default_options = {
        eval_on: 'update' // 'update' or 'close'
    };

    return {

        param_names: ['states', 'options'],

        input: ['_*'],
        output: [
            ['state', 'state'],
            ['vars', 'object']
        ],

        initialize: function() {
            this.options = _.defaults(this.param.options, default_options);
            var expr_vars = _.defaults(this.param.vars, {
                type: this.output.type,
                unitsize: _.isObject(this.output.instrument) ? this.output.instrument.unit_size : null,
                ticksize: _.isObject(this.output.instrument) ? this.output.instrument.tick_size : null
            });
            this.first_state = undefined;
            this.states = {};
            _.each(this.param.states, (config, state) => {
                if (_.isUndefined(this.first_state)) this.first_state = state;
                _.each(config.transitions, (trans_config, trans_state) => {
                    if (_.isString(trans_config[0])) {
                        let expr = new Expression(trans_config[0], {vars: expr_vars, streams: this.inputs});
                        if (expr === null) throw new Error('Invalid expression: ' + trans_config[0]);
                        trans_config[0] = expr;
                    }
                });
                config.enter = _.isArray(config.enter) && config.enter.map(en => _.isArray(en) ? en : [en]) || [];
                config.exit = _.isArray(config.exit) && config.exit.map(ex => _.isArray(ex) ? ex : [ex]) || [];
                this.states[state] = config;
            });
            this.current_state = this.first_state;
            this.eval_on = this.options.eval_on;
            if (!_.includes(['update', 'close'], this.eval_on)) throw new Error(`Invalid option for eval_on: ${this.eval_on}`);
        },

        on_bar_update: function() {
            if (this.eval_on === 'update') return take_step.apply(this, arguments);
        },

        on_bar_close: function() {
            if (this.eval_on === 'close') return take_step.apply(this, arguments);
        },

    };

    /////////////////////////////////////////////////////////////////////////////////////

    function take_step() {

        // execute a FSM command
        var process_cmd = _.bind(function(cmd) {
            let [command, p1, p2] = cmd;
            switch (command) {
                case 'reset':
                    this.vars = {};
                    break;
                case 'resetvar':
                    this.vars[p1] = undefined;
                    break;
                case 'setvar':
                    this.vars[p1] = p2;
                    break;
                default:
                    throw new Error(`Unrecognized FSM command: ${command}`);
            }            
        }, this);

        let state_config = this.states[this.current_state];
        this.vars.idx = this.index;
        for (let trans_state in state_config.transitions) {
            if ({}.hasOwnProperty.call(state_config.transitions, trans_state)) {
                let [expr] = state_config.transitions[trans_state];
                let val = expr.evaluate();
                if (val) {
                    state_config.exit.forEach(process_cmd);
                    this.current_state = trans_state;
                    state_config = this.states[this.current_state];
                    if (state_config.options && _.isString(state_config.options.eval_on)) {
                        this.eval_on = state_config.options.eval_on;
                    }
                    state_config.enter.forEach(process_cmd);
                    break;
                }
            }
        }

        this.output.set({
            state: this.current_state,
            vars: _.clone(this.vars)
        });

    }

});
