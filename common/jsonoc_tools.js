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
    if (!constr) throw new Error(`jt.create(constr, args) expects <constr> to be defined`);
    if (_.isString(constr)) {
        val = get_constr(constr.split('.'));
    } else {
        val = constr;
        val = _.isArray(val) ? val : [val, {}, val];
    }
    var obj = _.create(val[2].prototype);
    var retval = val[0].apply(obj, args);
    return retval;
}

// apply <constr> as a method on <obj> using <args> (by default use <obj>'s original arguments)
function apply(obj, constr_path, args) {
    if (!constr_path) throw new Error(`jt.apply(obj, constr) expects <constr> to be defined`);
    if (!args) args = obj._args || [];
    let constr = get_constr(constr_path.split('.'));
    constr = _.isArray(constr) ? constr[2] || constr[0] : constr;
    return constr.apply(obj, args);
}

// check whether a jsnc object <obj> is an instance created from <constr>
function instance_of(obj, constr) {
    if (!constr) throw new Error(`jt.instance_of(obj, constr) expects <constr> to be defined`);
    if (_.isString(constr)) {
        constr = get_constr(constr.split('.'));
    }
    constr = _.isArray(constr) ? constr[2] || constr[0] : constr;
    return obj instanceof constr;
}

function get_constr(path) {
    let constr = path.reduce((memo, tok) => {
        if (!_.has(memo, tok)) throw new Error(`Token "${tok}" not found in path string: ${path.join('.')}`);
        return memo[tok];
    }, schema);
    return constr;
}

return {
    get_schema: get_schema,
    set_schema: set_schema,
    create: create,
    apply: apply,
    instance_of: instance_of
};

});
