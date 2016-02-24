var _ = require("underscore");

var type_defs = [
    "datetime",
    ["num", null, [
        ["float", null, [
            "price",
            "price_difference",
            "confidence",
            "direction_confidence"
        ]],
        ["int", null, [
            "uint",
            "direction"
        ]]
    ]],
    ["object", null, [
        "json",
        ["bar", [["date", "datetime"]], [
            ["tick", ['ask', 'bid']],
            ["candle", [["volume", "uint"]], [
                ["price_bar", ["open", "high", "low", "close", ["wasabi", "test"]]],
                ["ask_price_bar", ["ask_open", "ask_high", "ask_low", "ask_close"]],
                ["bid_price_bar", ["bid_open", "bid_high", "bid_low", "bid_close"]],
                ["dual_price_bar", [["ask", "price_bar"], ["bid", "price_bar"]]]
            ]]
        ]],
        ["trade", ["params"]],
        "awsm",
        ["superfield", [['test_anc', 'string']], [
            ["test", ["a", "b", ["c", "string"]]]
        ]]
    ]],
    "array",
    "string",
    "bool"
];

var default_type = "num";

var conv_null_filter = function(num) {return isFinite(num) ? num : null}

var db_types = {
    "num": ["FLOAT", conv_null_filter],
    "float": ["FLOAT", conv_null_filter],
    "int":   ["INT(10)", conv_null_filter],
    "uint":  ["INT(10) UNSIGNED", conv_null_filter],
    "datetime": ["DATETIME", function(date) {return date.toISOString().slice(0, 19).replace('T', ' ')}],
    "double": ["DOUBLE", conv_null_filter],
    "string": ["TEXT"],
    "json": ["TEXT", JSON.stringify, JSON.parse],
    "array": ["TEXT", JSON.stringify, JSON.parse],
    "bool": ["TINYINT(1)", conv_null_filter]
}

///////////////////////////////////////////////////

console.log("start...");


var subfields_lookup = _.object(subfields_table(type_defs));
console.log(fieldmap_of("asdf"));
//console.log("subfields_lookup:", subfields_lookup);
console.log("done.")

// ========================================================================================

// Return list of type preceded by its ancestors, starting with root
function type_chain(succtype, defs) {
    return _.reduce(_.map(defs, function(type) {
        if (_.isString(type) && type === succtype) {
            return succtype;
        } else if (_.isArray(type)) {
            if (succtype === type[0]) return [type];
            if (_.isArray(type[2])) {
                var t = type_chain(succtype, type[2])
                return _.isArray(t) && t.length > 0 ? [type.slice(0,2)].concat(t) : false;
            }
            return false;
        }
        return false;
    }), function(memo, type) {
        return type ? memo.concat(type) : memo
    }, []);
}

// Returns deep expansion of all subfields for a type including ancestors
function fieldmap_of(type, oldchain) {

    // TODO: add 'suppress' flag for field names starting with ~

    if (_.isEmpty(type)) return [];
    if (_.isArray(type)) { // handle anonymous types
        return _.map(type, function(field) {
            var node = {}
            if (_.isArray(field)) {
                var fieldmap = fieldmap_of(field[1]);
                var node = {type:field[1]};
                if (!_.isEmpty(fieldmap)) node.recurse = fieldmap;
                return [field[0], node];
            } else {
                return [field, {type:default_type}];
            }
            return _.isArray(field) ? [field[0], fieldmap_of(field[1], oldchain)] : [field, default_type];
        });
    } else { // named type
        oldchain = oldchain || [];
        var newchain = type_chain(type, type_defs);
        if (_.isEmpty(newchain)) throw new Error("Unknown type: "+type);
        var mergechain = _.flatten(_.map(oldchain, function(oldlink) {
            return _.reduce(newchain, function(memo, newlink) {
                return _.isArray(oldlink) && _.isArray(newlink) && oldlink[0] === newlink[0] ? memo.concat([newlink]) : memo;
            }, [])
        }), true)
        // collect and flatten subfields of mergechain links
        var chainfields = _.flatten(_.map(mergechain, function(link) {
            return _.map(link[1], function(sub) {return sub[0]});
        }), true);

        // subfields
        var subfields = _.flatten(_.map(newchain, function(link) {
            return _.compact(_.map(subfields_lookup[link[0]], function(field) {
                var name = _.isArray(field) ? field[0] : field;
                // skip if field already gathered by previous type
                if (chainfields.indexOf(name) > -1) return false;
                if (_.isArray(field)) {
                    return {name:field[0], type:field[1], chain:oldchain.concat(newchain)};
                } else {
                    return {name:field};
                }
            }));
        }), true);

        // create node and recurse down
        return _.map(subfields, function(field) {
            if (!_.isEmpty(field.type)) {
                var recurse = fieldmap_of(field.type, field.chain);
                if (!_.isEmpty(recurse)) {
                    return [field.name, {type:field.type, recurse:recurse}];
                } else {
                    return [field.name, {type:field.type}];
                }
            } else {
                return [field.name, {type:default_type}];
            }
        });
    }
}


// Returns table of subfields
function subfields_table(typelist) {
    return _.reduce(_.map(typelist, function(type) {
        if (_.isString(type)) {
            return [[type, null]];
        } else if (_.isArray(type)) {
            return [type.slice(0,2)].concat(_.isArray(type[2]) ? subfields_table(type[2]) : [])
        }
    }), function(memo, type) {
        return memo.concat(type);
    }, [])
}

// Converts a list of stream-type field defs to a list of SQL field defs
function fields2sql(fields) {
    return _.flatten(_.map(fields, function(field) {
        if (_.isArray(field)) {
            var prefix = field[0];
            var subfields = field[1];
            if (_.isArray(subfields)) {
                return _.map(fields2sql(subfields), function(sub) {
                    return [prefix+":"+sub[0], sub[1]];
                });
            } else {
                return [[field[0], sql_type(field[1])]]
            }
        } else {
            return [[field, sql_type("num")]];
        }
    }), true)
}

function record_template_generator(fieldmap) {

    var master_template = _.isEmpty(fieldmap) ? null : recurse(fieldmap);

    return function() {
        // Get cloned copy
        return JSON.parse(JSON.stringify(master_template));
    }

    function recurse(fields) {
        return _.object(_.map(fields, function(field) {
            var name = field[0];
            var node = field[1];
            return node.recurse ? [name, recurse(node.recurse)] : [name, null];
        }));
    }
}

function create_field_mapper(collection) {

    var fieldlist = collection.get_fieldlist();

    return _.map(fieldlist, function(field) {
        var ind = collection.indicators[field[0]];
        var opts = {
            stream: ind.output_stream,
            suppress: ind.suppress && true
        }
        if (_.isArray(field[1])) {
            opts.recurse = recurse(field[1], [field[0]], ind.output_stream);
        } else {
            add_type_info(opts, field[1]);
        }
        return [field[0], opts];
    });

    function recurse(fields, path, stream) {
        _.map(fields, function(field) {
            var opts = {};
            if (_.isString(field)) {
                add_type_info(opts, field);
            } else if (_.isArray(field[1])) {
                opts.recurse = recurse(field[1], path.concat(field[0]), stream.substream(field[0]));
            } else {
                add_type_info(opts, field[1]);
            }
            return [field[0], opts];
        });
    }

    function add_type_info(opts, type) {
        opts.type = type;
        if (_.has(db_types, type)) {
            opts.sqltype = db_types[type][0];
            opts.out_conv = db_types[type][1];
            opts.in_conv = db_types[type][2];
        }
    }
}

function flat_record_transporter(collection) {

    var field_mapper = create_field_mapper(collection);

    return {
        "import": function() {

        },
        "export": function() {

        }
    };
}
