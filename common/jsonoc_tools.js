'use strict';

define(['lodash'], function(_) {

var schema = null;

function set_schema(sch) {
    schema = sch;
}

function instance_of(obj, pathstr) {
    var path = pathstr.split('.');
    var constr = path.reduce(function(memo, tok) {
        if (!_.has(memo, tok)) throw new Error('Token "' + tok + '" not found in path string: ' + pathstr);
        return memo[tok];
    }, schema);
    constr = _.isArray(constr) ? constr[2] || constr[0] : constr;
    return obj instanceof constr;
}

return {
    set_schema: set_schema,
    instance_of: instance_of
};

});
