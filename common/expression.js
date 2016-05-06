'use strict';

define(['lodash', 'config/stream_types'], (_, stream_types) => {

var default_config = {
    vars: {},
    streams: []
};

function Expression(expr_string, config) {
    if (!(this instanceof Expression)) return Expression.apply(Object.create(Expression.prototype), arguments);
    this.config = _.defaults(config, default_config);
    // trim whitespace, and replace non-indexed refs to streams with zero-indexed ones
    this.expr_string = expr_string.trim().replace(/(\$\d+)(?!\s*\()/g, '$1(0)');
    this.ident = {};
    // add Math.* functions without Math. prefix if they are used in expression
    _.each(Object.getOwnPropertyNames(Math), fn_name => {
        if (this.expr_string.match(new RegExp('\\b' + fn_name + '\\b'))) this.ident[fn_name] = () => Math[fn_name];
    });
    // add custom functions
    if (this.expr_string.match(new RegExp('\\bavg\\b'))) {
        this.ident.avg = () => function() {
            return [].reduce.call(arguments, (x, i) => i + x, 0) / arguments.length;
        };
    }
    // add vars
    _.each(this.config.vars, (val, key) => {
        if (this.expr_string.match(new RegExp('\\b' + key + '\\b'))) this.ident[key] = () => this.config.vars[key];
    });
    // add streams, use proxy to allow $1(#) and $1[#] syntax to reference previous bars
    _.each(this.config.streams, (str, idx) => {
        this.ident['$' + (idx + 1)] = () => new Proxy(new Function(), {
            get(target, key) {             // [#] - absolute index
                return str.get_index(key);
            },
            apply(target, thisArg, args) { // (#) - bars ago
                return str.get(args[0]);
            }
        });
    });
    try {
        this.expr_fn = Function.apply({}, _.keys(this.ident).concat('return (' + this.expr_string + ')'));
    } catch (e) {
        throw new Error('Invalid expression string: ' + this.expr_string + '\n\n>>> ' + e.toString());
    }
    this.val_fns = _.values(this.ident);
    return this;
}

Expression.prototype.evaluate = function() {
    try {
        return this.expr_fn.apply(null, this.val_fns.map(fn => fn()));
    } catch (e) {
        throw new Error('Error while evaluating expression: ' + this.expr_string + '\n\n>>> ' + e.toString());
    }
};

return Expression;

});
