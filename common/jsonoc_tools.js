'use strict';

define(['lodash'], function(_) {

var schema = null;

function get_schema() {
    return schema;
}

function set_schema(sch) {
    schema = sch;
}

function create(constr, args) {
    var val;
    if (_.isString(constr)) {
        val = constr.split('.').reduce(function(memo, tok) {
            if (!_.has(memo, tok)) throw new Error('Token "' + tok + '" not found in path string: ' + constr);
            return memo[tok];
        }, schema);
    } else {
        val = constr;
    }
    val = _.isArray(val) ? val : [val, {}, val];
    var obj = _.create(val[2].prototype);
    var retval = val[0].apply(obj, args);
    return retval;
}

function instance_of(obj, constr) {
    var path = constr.split('.');
    var constr = path.reduce(function(memo, tok) {
        if (!_.has(memo, tok)) throw new Error('Token "' + tok + '" not found in path string: ' + constr);
        return memo[tok];
    }, schema);
    constr = _.isArray(constr) ? constr[2] || constr[0] : constr;
    return obj instanceof constr;
}

return {
    get_schema: get_schema,
    set_schema: set_schema,
    create: create,
    instance_of: instance_of
};

});
