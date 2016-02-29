'use strict';

define(['lodash'], function(_) {

    var type_defs = [
        'datetime',
        ['num', null, [
            ['float', null, [
                'price',
                'price_difference',
                'confidence',
                'direction_confidence'
            ]],
            ['int', null, [
                'uint',
                'direction'
            ]]
        ]],
        ['object', null, [
            ['dated', [['date', 'datetime']], [
                ['tick', ['ask', 'bid'], [
                    ['tickvol', [['volume', 'uint']]],
                ]],
                ['bar', [['volume', 'uint']], [
                    ['candle_bar', ['open', 'high', 'low', 'close']],
                    ['dual_candle_bar', [['ask', 'candle_bar'], ['bid', 'candle_bar']]],

                    ['renko_bar', ['open', 'close']]
                ]],
                ['pivot', ['p', 's1', 's2', 's3', 's4', 'r1', 'r2', 'r3', 'r4']],
                ['peak', ['high', 'low']],
                ['datedvol', [['volume', 'uint']]]
            ]],
            ['qual', [['type', 'string'], ['data', 'object'], ['note', 'object'], ['level', 'uint']]], // qualifier
            'json',
            'awsm'
        ]],
        ['array', null, [
            'poly',
            'trade_cmds',
            'trade_evts',
            'trade_positions'
        ]],
        'string',
        'bool'
    ];

    var default_type = 'num';

    // return null if not a valid number
    var conv_null_filter = function(num) {
        return isFinite(num) ? num : null;
    };

    var db_types = {
        'num': ['FLOAT', conv_null_filter],
        'float': ['FLOAT', conv_null_filter],
        'int':   ['INT(10)', conv_null_filter],
        'uint':  ['INT(10) UNSIGNED', conv_null_filter],
        'datetime': ['DATETIME', function(date) {
            return date.getFullYear() + '-' +
            ('00' + (date.getMonth() + 1)).slice(-2) + '-' +
            ('00' + date.getDate()).slice(-2) + ' ' +
            ('00' + date.getHours()).slice(-2) + ':' +
            ('00' + date.getMinutes()).slice(-2) + ':' +
            ('00' + date.getSeconds()).slice(-2);
        }],
        'double': ['DOUBLE', conv_null_filter],
        'string': ['TEXT'],
        'json': ['TEXT', JSON.stringify, JSON.parse],
        'array': ['TEXT', JSON.stringify, JSON.parse],
        'bool': ['TINYINT(1)', conv_null_filter]
    };

    //
    var subfields_lookup = _.fromPairs(subfields_table(type_defs));

    return {

        // whether subtype inherits from supertype
        isSubtypeOf: function(subtype, supertype) {
            if (_.isObject(subtype) && supertype === 'object') return true;
            return _.find(type_chain(subtype, type_defs), link => _.isArray(link) ? link[0] === supertype : link === supertype);
        },

        // fieldmap contains full hierarchy of subfields and their types; node info is
        // augmented by other functions
        fieldmapOf: fieldmap_of.bind(null),

        /*
        rootOf: function(type) {
            return _.head(type_chain(type, type_defs));
        },
        */

        // template is initial blank value to use
        recordTemplateGenerator: record_template_generator,

        // handles transport of flat records
        flatRecordTransporter: flat_record_transporter,

        // default_type == 'num'
        default_type: default_type

    };

    ///////////////////////////////////////////////////////////////////////////////

    // Return list of type preceded by its ancestors, starting with root
    function type_chain(succtype, defs) {
        return _.reduce(_.map(defs, function(type) {
            if (_.isString(type) && type === succtype) {
                return succtype;
            } else if (_.isArray(type)) {
                if (succtype === type[0]) return [type];
                if (_.isArray(type[2])) {
                    var t = type_chain(succtype, type[2]);
                    return _.isArray(t) && t.length > 0 ? [type.slice(0, 2)].concat(t) : false;
                }
                return false;
            }
            return false;
        }), function(memo, type) {
            return type ? memo.concat(type) : memo;
        }, []);
    }

    // Returns table of types and their immediate subfields
    function subfields_table(typelist) {
        return _.reduce(_.map(typelist, function(type) {
            if (_.isString(type)) {
                return [[type, null]];
            } else if (_.isArray(type)) {
                return [type.slice(0, 2)].concat(_.isArray(type[2]) ? subfields_table(type[2]) : []);
            }
        }), function(memo, type) {
            return memo.concat(type);
        }, []);
    }

    // Returns deep expansion of all subfields for a type including ancestors
    function fieldmap_of(type, oldchain) {

        // TODO: add 'suppress' flag for field names starting with ~

        if (_.isEmpty(type)) return [];
        if (_.isArray(type)) { // handle anonymous types
            return _.map(type, function(field) {
                var node = {};
                if (_.isArray(field)) {
                    var fieldmap = fieldmap_of(field[1]);
                    node = {type:field[1]};
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
            if (_.isEmpty(newchain)) throw new Error('Unknown type: ' + type);
            var mergechain = _.flatten(_.map(oldchain, function(oldlink) {
                return _.reduce(newchain, function(memo, newlink) {
                    return _.isArray(oldlink) && _.isArray(newlink) && oldlink[0] === newlink[0] ? memo.concat([newlink]) : memo;
                }, []);
            }));
            // collect and flatten subfields of mergechain links
            var chainfields = _.flatten(_.map(mergechain, function(link) {
                return _.map(link[1], sub => sub[0]);
            }));

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
            }));

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

    function record_template_generator(fieldmap) {

        var master_template = _.isEmpty(fieldmap) ? null : recurse(fieldmap);

        return function() {
            // Get cloned copy
            return JSON.parse(JSON.stringify(master_template));
        };

        function recurse(fields) {
            return _.fromPairs(_.map(fields, function(field) {
                var name = field[0];
                var node = field[1];
                return node.recurse ? [name, recurse(node.recurse)] : [name, null];
            }));
        }
    }

    function flat_record_transporter(collection) {

        var fieldmap = recurse_fieldmap(collection.get_fieldmap());

        // Apply relevant transporter markings to collection fieldmap nodes
        function recurse_fieldmap(fields) {
            return _.map(fields, function(field) {
                var name = field[0];
                var node = field[1];
                var dbtype = _.find(type_chain(node.type, type_defs).reverse(), function(link) {
                    return _.has(db_types, _.isArray(link) ? link[0] : link);
                });
                if (dbtype) {
                    dbtype = db_types[_.isArray(dbtype) ? dbtype[0] : dbtype];
                    node.dbtype = dbtype[0];
                    if (_.isFunction(dbtype[1])) node.out_conv = dbtype[1];
                    if (_.isFunction(dbtype[2])) node.in_conv = dbtype[2];
                }
                if (node.recurse) node.recurse = recurse_fieldmap(node.recurse, node.stream);
                return [name, node];
            });
        }

        return {
            'getSchema': function() {
                return recurse_schema(fieldmap);
            },
            'import': function(rec) {
                recurse_import(fieldmap, rec);
            },
            'export': function() {
                return recurse_export(fieldmap);
            }
        };

        function recurse_schema(fields) {
            return _.flatten(_.map(fields, function(field) {
                var name = field[0];
                var node = field[1];
                if (node.suppress) {
                    return [];
                } else if (node.dbtype) {
                    return [[name, node.dbtype]];
                } else if (node.recurse) {
                    return _.map(recurse_schema(node.recurse), function(subfield) {
                        return [name + ':' + subfield[0], subfield[1]];
                    });
                } else {
                    throw new Error('Type "' + node.type + '" has no subfields and no DB type');
                }
            }));
        }

        function recurse_import(fields, rec) { // (doesn't really recurse)
            // steps:
            // 1. convert flat rec into normal rec
            // 2. recurse down rec and fields together
            //var newrec =
        }

        function recurse_export(fields) {
            return _.fromPairs(_.flatten(_.map(fields, function(field) {
                var name = field[0];
                var node = field[1];
                if (node.suppress) {
                    return [];
                } else if (node.dbtype) {
                    var output = node.out_conv ? node.out_conv(node.stream.get(0)) : node.stream.get(0);
                    return [[name, output]];
                } else if (node.recurse) {
                    return _.map(recurse_export(node.recurse), function(val, key) {
                        return [name + ':' + key, val];
                    });
                } else {
                    throw new Error('Type "' + node.type + '" has no subfields and no DB type');
                }
            })));

        }
    }

});
