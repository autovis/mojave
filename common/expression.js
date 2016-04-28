'use strict';

define(['lodash', 'config/stream_types'], (_, stream_types) => {

var default_config = {
    vars: {},
    streams: [],
    return_type: 'num'
};

function Expression(expr_string, config) {
    if (!(this instanceof Expression)) return Expression.apply(Object.create(Expression.prototype), arguments);
    this.config = _.defaults(config, default_config);
    this.expr_string = expr_string;
    this.ident = {};
    // add Math.* functions without Math. prefix if they are used in expression
    _.each(Object.getOwnPropertyNames(Math), fn_name => {
        if (expr_string.match(new RegExp('\\b' + fn_name + '\\b'))) this.ident[fn_name] = () => Math[fn_name];
    });
    // add vars
    _.each(this.config.vars, (val, key) => {
        this.ident[key] = () => val;
    });
    // add streams
    _.each(this.config.streams, (str, idx) => {
        this.ident['$' + (idx + 1)] = () => this.config.streams[idx].get();
    });
    try {
        this.expr_fn = Function.apply({}, _.keys(this.ident).concat('return ' + expr_string));
    } catch (e) {
        throw new Error('Invalid expression string: ' + expr_string + '\n\n>>> ' + e.toString());
    }
    this.val_fns = _.values(this.ident);
    return this;
}

Expression.prototype.evaluate = function() {
    try {
        return this.expr_fn.apply(null, this.val_fns.map(fn => fn()));
    } catch (e) {
        throw new Error('Error while evaluation expression: ' + this.expr_string + '\n\n>>> ' + e.toString());
    }
};

return Expression;

});
