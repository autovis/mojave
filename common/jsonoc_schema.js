'use strict';

define(['lodash', 'jsonoc_tools', 'expression'], function(_, jt, Expression) {

var config; // Config object accessible to constructors from outside

// --------------------------------------------------------------------------------------

// helper functions

function resolve(obj) {
    if (jt.instance_of(obj, 'Var')) {
        let val = _.get(config.vars, obj.var);
        if (!val) throw new Error('Undefined var: ' + obj.var);
        return val;
    } else if (jt.instance_of(obj, '_')) {
        _.each(obj, (val, key) => {
            obj[key] = resolve(val);
            return true;
        });
        return obj;
    } else if (_.isArray(obj)) {
        return _.map(obj, val => resolve(val));
    } else if (_.isFunction(obj)) {
        return obj;
    } else if (_.isObject(obj)) {
        return _.fromPairs(_.toPairs(obj).map(p => [p[0], resolve(p[1])]));
    } else if (_.isString(obj)) {
        return obj.replace(new RegExp('\\${([A-Za-z_\.]+)}', 'g'), (m, p1) => _.get(config.vars, p1));
    } else {
        return obj;
    }
};

// --------------------------------------------------------------------------------------

var schema = {

    // Global constructors
    '$_': {
        'Var': '@Var',

        'MapOn': '@MapOn',

        'Item': '@Item'
    },

    // *************************************
    // Collection
    // *************************************

    'Collection': [function() {
        this.vars = {};
        this.inputs = {};
        this.indicators = {};
        _.each(arguments[0], item => {
            if (jt.instance_of(item, '$Collection.Timestep')) {
                _.each(item.inputs, (inp, key) => {
                    if (_.has(this.inputs, key)) throw new Error('Input "' + key + "' is already defined elsewhere");
                    this.inputs[key] = inp;
                });
                _.each(item.indicators, (ind, key) => {
                    if (_.has(this.indicators, key)) throw new Error('Indicator "' + key + "' is already defined elsewhere");
                    this.indicators[key] = ind;
                });
            }
        });
        return this;
    }, {pre: ['SAInit', 'SAOptHolder']}],

    '$Collection': {

        'SetVars': '@SetVars',
        'SetDefaultVars': '@SetDefaultVars',

        'Timestep': [function(tstep, sources) {
            if (!(_.isString(tstep) || jt.instance_of(tstep, 'Var')) || !_.isObject(sources)) throw new Error('Usage: Timestep(<timestep:(str|Var)>, <streams:map>)');
            this.inputs = {};
            this.indicators = {};
            this.tstep = resolve(tstep);
            (function collect_sources(srcs, path) {
                _.each(srcs, (val, key) => {
                    if (_.isString(val)) val = jt.create('$Collection.$Timestep.Source', [val]);
                    if (jt.instance_of(val, '$Collection.$Timestep.SrcType')) {
                        val.tstep = this.tstep;
                        // recursively assign tstep to all anonymous indicators within inputs
                        (function recurse_indicator_inputs(ind, inputs) {
                            _.each(inputs, inp => {
                                if (jt.instance_of(inp, '$Collection.$Timestep.SrcType')) {
                                    inp.tstep = this.tstep;
                                    recurse_indicator_inputs.call(this, inp, inp.inputs);
                                }
                            });
                        }).call(this, val, val.inputs);
                    }
                    if (jt.instance_of(val, '$Collection.$Timestep.Input')) {
                        val.id = path.concat(key).join('.');
                        _.set(this.inputs, val.id, val);
                        _.set(this.indicators, val.id, val);
                    } else if (jt.instance_of(val, '$Collection.$Timestep.Ind')) {
                        val.id = path.concat(key).join('.');
                        _.set(this.indicators, val.id, val);
                    } else if (jt.instance_of(val, '$Collection.$Timestep.Source')) {
                        val.id = path.concat(key).join('.');
                        _.set(this.indicators, val.id, val);
                    } else if (_.isObject(val)) {
                        collect_sources.call(this, val, path.concat(key));
                    }
                });
            }).call(this, sources, []);
            return this;
        }],

        '$Timestep': {

            'Collection': '@Collection',

            'SrcType': [function() {
                this.inputs = [];
            }, {virtual: true, pre: 'OptHolder'}],

            '$SrcType': {
                'Opt': '@Opt'
            },

            'Input': [function(type, options) {
                if (!type) throw new Error('Usage: Input(<type>, <options_map>) where "type" parameter is required');
                this.type = resolve(type);
                this.options = resolve(options || {});
                if (this.options.instrument) this.instrument = this.options.instrument;
            }, {extends: '$Collection.$Timestep.SrcType'}],

            'Ind': [function() { // variable parameters
                var err_msg = 'Usage: Ind(<source>, <ind_name_str>, <param1>, <param2>, ...) where "source" may be a comma-delimited list of sources, an array of sources, or a nested Ind(...) value';
                var args = _.filter(arguments, arg => !jt.instance_of(arg, 'Opt'));
                if (_.isNull(args[0]) || args.length === 0) {
                    this.inputs = null; // defer setting source and use ident indicator
                } else if (jt.instance_of(args[0], '$Collection.$Timestep.Ind')) {
                    this.inputs = [args[0]];
                } else if (_.isString(args[0])) {
                    this.inputs = args[0].split(',').map(x => x.trim());
                } else if (_.isObject(args[0])) {
                    this.inputs = args[0];
                } else {
                    throw new Error(err_msg);
                }
                this.name = args[1];
                this.params = Array.prototype.slice.call(args, 2).map(resolve);
                this._stringify = function(stringify) {
                    var args = _.flatten(_.compact([this.src, this.name, this.params]));
                    if (!_.isEmpty(this.options)) args.push(jt.create('Opt', [this.options]));
                    return _.last(this._path) + '(' + args.map(stringify).join(', ') + ')';
                };
                //return this;
            }, {extends: '$Collection.$Timestep.SrcType', post: 'ExtractInputSymbols'}],

            '$Ind': {
                'Ind': '@$Collection.$Timestep.Ind',
                'Source': '@$Collection.$Timestep.Source',
                'Proxy': '@proxy.Proxy',
                'Calc': '@proxy.Calc',
                'CondSeq': '@proxy.CondSeq',
                'Switch': '@Switch',
                'opt': '@optimizer'
            },

            'Source': [function() {
                this.path = _.filter(arguments, a => !jt.instance_of(a, 'Opt'));
                if (_.every(this.path, p => _.isString(p))) {
                    this.inputs = [this.path.join('.')];
                    jt.apply(this, 'ExtractInputSymbols');
                }
            }, {extends: '$Collection.$Timestep.SrcType'}],

            '$Source': {
                'Source': '@$Collection.$Timestep.Source'
            },

            'Import': [function() {
                this.inputs = _.filter(arguments, arg => !(jt.instance_of(arg, 'Opt') || _.isObject(arg) && !_.isArray(arg) && !_.isString(arg) && !jt.instance_of(arg, '_')));
            }, {extends: '$Collection.$Timestep.SrcType'}]

        },

    },

    // Proxied values
    proxy: {

        'Proxy': [function() {
            this._init = () => null;
            this._eval = () => null;
        }, {virtual: true}],

        // ---------------------------------

        'Calc': [function(expr_string, local_vars = {}) {
            this._init = (vars, streams) => {
                this.expr = new Expression(resolve(expr_string), {
                    vars: new Proxy(vars, {
                        get(target, key) {
                            return local_vars.hasOwnProperty(key) ? local_vars[key] : target[key];
                        },
                        has(target, key) {
                            return _.has(local_vars, key) || _.has(target, key);
                        },
                        ownKeys(target) {
                            return _.uniq(_.union(_.keys(target), _.keys(local_vars)));
                        }
                    }),
                    streams: streams
                });
            };
            this._eval = (vars, streams) => this.expr.evaluate();
        }, {extends: 'proxy.Proxy'}],

        'Match': [function() {
            this._init = () => null;
            this._eval = () => null;
            throw new Error('Not implemented');
        }, {extends: 'proxy.Proxy'}],

        'Cond': [function() {
            this._init = () => null;
            this._eval = () => null;
            throw new Error('Not implemented');
        }, {extends: 'proxy.Proxy'}],

        'CondSeq': [function(initial_expr, cond_statements) {
            if (arguments.length !== 2) throw new Error('Constructor accepts exactly 2 parameters: (initial_expr, cond_statements)');
            if (_.isUndefined(initial_expr)) throw new Error('<initial_expr> parameter must be defined');
            if (!_.isObject(cond_statements)) throw new Error('<cond_statements> parameter must be defined as an object');
            this._init = function(vars, streams) {
                var expr_config = {vars: vars, streams: streams};
                vars._statements = _.map(cond_statements, stat => {
                    if (!_.isArray(stat) || stat.length < 2) throw new TypeError('Each statement must be a 2-element array');
                    return [
                        new Expression(resolve(stat[0]).toString(), expr_config),
                        _.isString(stat[1]) || _.isNumber(stat[1]) ? new Expression(resolve(stat[1]).toString(), expr_config) : stat[1]
                    ];
                });
                vars._statement_idx = 0;
                vars._initial_expr = new Expression(resolve(initial_expr).toString(), expr_config);
                vars._current_expr = vars._initial_expr;
            };
            this._eval = function(vars, streams) {
                while (vars._statement_idx <= vars._statements.length - 1 && vars._statements[vars._statement_idx][0].evaluate()) {
                    vars._current_expr = vars._statements[vars._statement_idx][1];
                    if (jt.instance_of(vars._current_expr, 'proxy.$CondSeq.Reset')) {
                        vars._statement_idx = 0;
                        vars._current_expr = vars._initial_expr;
                    } else {
                        vars._statement_idx += 1;
                    }
                }
                //this._debug(vars, streams);
                return vars._current_expr.evaluate();
            };
            this._debug = function(vars, streams) {
                console.log(_.map(vars, (val, key) => key + ': ' + (val || '').toString()).join(', '));
                console.log("index: " + vars.index);
                console.log('vars: ', vars);
                console.log("_statement_idx: " + vars._statement_idx);
                //console.log("_statements:\n", _.map(vars._statements, stat => "[" + stat[0].evaluate() + ", " + stat[1].evaluate() + "]").join("\n"));
                console.trace();
            };
            return this;
        }, {extends: 'proxy.Proxy'}],

        '$CondSeq': {
            'Reset': function() {}
        },

        // finite state machine
        'FSM': [function() {
            this._init = () => null;
            this._eval = () => null;
            throw new Error('Not implemented');
        }, {extends: 'proxy.Proxy'}],
    },


    // *************************************
    // ChartSetup
    // *************************************

    'ChartSetup': [function() {
        this.components = _.filter(this.array, item => jt.instance_of(item, 'Component'));
    }, {pre: ['SAInit', 'SAGeometryHolder', 'SABehaviorHolder', 'SAMarkerHolder', 'SAOptHolder']}],

    '$ChartSetup': {

        'SetVars': '@SetVars',
        'SetDefaultVars': '@SetDefaultVars',

        'Geometry': '@KeyValueMap',
        'Behavior': '@KeyValueMap',

        // chart-level plots
        'Plot': function() {
            this.options = {};
            for (var i = 0; i <= arguments.length - 1; i++) {
                var arg = arguments[i];
                if (_.isString(arg)) {
                    this.id = arg;
                } else if (jt.instance_of(arg, '$Collection.$Timestep.Ind')) {
                    this.indicator = arg;
                } else if (jt.instance_of(arg, 'Opt')) {
                    this.options = _.assign(this.options, arg);
                } else if (_.isObject(arg)) {
                    this.options = _.assign(this.options, arg);
                }
            }
            if (!this.id) throw new Error('Usage: Plot(<id_str>, <>)');
        },

        '$Plot': {
            'Ind': '@$Collection.$Timestep.Ind',
            'Switch': '@Switch'
        },

        'Component': '@Component',

        'PlotComponent': [function(arr) {
            this.plots = _.filter(arr, item => jt.instance_of(item, '$ChartSetup.Plot'));
        }, {extends: '$ChartSetup.Component'}],

        '$PlotComponent': {
            'Plot': '@$ChartSetup.Plot',
        },

        'PanelComponent': [function(arr) {
            this.controls = _.filter(arr, item => jt.instance_of(item, 'Control'));
        }, {extends: '$ChartSetup.Component'}],

        '$PanelComponent': {
            'Control': '@Control'
        },

        'MatrixComponent': [function(arr) {
            this.rows = _.filter(arr, item => jt.instance_of(item, '$ChartSetup.$MatrixComponent.MatrixRow'));
        }, {extends: '$ChartSetup.Component'}],

        '$MatrixComponent': {
            'MatrixRow': function(id, name) {
                this.id = id;
                this.name = name;
            }
        },

        'NullComponent': '@$ChartSetup.Component'

    },

    /////////////////////////////////////////////////////////////////////////////////////
    /////////////////////////////////////////////////////////////////////////////////////

    'Var': function(varname) {
        this.var = varname;
        return this;
    },

    'SetVars': [function(vars) {
        _.each(vars, (val, key) => config.vars[key] = val);
    }, {extends: 'KeyValueMap'}],

    'SetDefaultVars': [function(vars) {
        _.each(vars, (val, key) => {
            if (!_.has(config.vars, key)) config.vars[key] = val;
        });
    }, {extends: 'KeyValueMap'}],

    'MapOn': function(list, target) {
        var obj = {};
        list = resolve(list);
        if (!_.isArray(list) || !_.every(list, item => _.isString(item))) throw new Error('"MapOn" macro must have array of strings as first parameter');
        _.each(list, item => {
            var target_copy = _.cloneDeep(target);
            target_copy.prototype = _.create(target.prototype);
            obj[item] = (function replace_item(o) {
                if (jt.instance_of(o, 'Item')) {
                    return item;
                } else if (_.isObject(o)) {
                    _.each(o, (val, key) => {
                        o[key] = replace_item(val);
                    });
                    if (jt.instance_of(o, '$Collection.$Timestep.Source') && _.every(o.path, p => _.isString(p) || jt.instance_of(p, 'Opt'))) {
                        o.inputs = [o.path.join('.')];
                        jt.apply(o, 'ExtractInputSymbols');
                    }
                    return o;
                } else {
                    return o;
                }
            })(target_copy);
        });
        return obj;
    },

    'Item': function() {}, // placeholder value

    // Base of all constructors that accept a single parameter of Object type
    'KeyValueMap': function(obj) {
        _.each(obj, (val, key) => this[key] = val);
        this._stringify = stringify => {
            var pairs = _.filter(_.toPairs(this), pair => _.head(pair[0]) !== '_');
            return _.last(this._path) + '({' + pairs.map(p => JSON.stringify(p[0]) + ': ' + stringify(p[1])).join(', ') + '})';
        };
        return this;
    },

    // Represent an element's parameters/settings/properties using key/value map
    'Opt': '@KeyValueMap',

    // Collects all arguments that are objects and merges their properties into this.options
    'OptHolder': function() {
        this.options = jt.create('Opt', [{}]);
        for (var i = 0; i <= arguments.length - 1; i++) {
            var arg = arguments[i];
            if (jt.instance_of(arg, 'Opt') || _.isObject(arg) && !_.isArray(arg) && !_.isString(arg) && !jt.instance_of(arg, '_')) {
                _.each(arg, (val, key) => this.options[key] = val);
            }
        }
    },

    // Parse prefix symbols from SrcType's inputs
    'ExtractInputSymbols': function() {
        if (_.isArray(this.inputs)) {
            for (let i = 0; i <= this.inputs.length - 1; i++) {
                if (_.isString(this.inputs[i])) {
                    let [, sym, inp] = this.inputs[i].match(/^([^a-z]*)([a-z].*)/i);
                    if (!_.isEmpty(sym)) {
                        this.inputs[i] = jt.create('$Collection.$Timestep.Import', [inp, {symbol: sym}]);
                    }
                }
            }
        }
    },

    // To validate that the constructor is only taking a single array parameter
    'SAInit': function() {
        if (arguments.length === 0 || arguments.length > 1 || !_.isArray(arguments[0])) throw new Error('Constructor only accepts a single array as parameter');
        this.array = arguments[0];
        this._stringify = stringify => {
            return _.last(this._path) + '([' + _.flatten(_.map(_.values(this), function(item) {
                if (jt.instance_of(item, '_')) {
                    return stringify(item);
                } else if (_.isArray(item)) {
                    return _.map(item, stringify);
                } else if (_.isObject(item)) {
                    return _.map(_.values(item), stringify);
                } else {
                    return stringify(item);
                }

            })).join(', ') + '])';
        };
    },

    // Traverses single array to collect all objects and merge their properties into this.options
    'SAOptHolder': function() {
        this.options = {};
        for (var i = 0; i <= arguments[0].length - 1; i++) {
            var elem = arguments[0][i];
            if (jt.instance_of(elem, '_')) {
                var type = _.last(elem._path);
                if (type === 'Opt' || type === 'Opt') {
                    assign_properties(elem);
                }
            }
        }
        function assign_properties(elem) {
            var newobj = _.fromPairs(_.filter(_.toPairs(elem), function(p) {return _.head(p[0]) !== '_';}));
            this.options = _.assign(this.options, newobj);
        }
    },

    'SAGeometryHolder': function() {
        var geoms = _.filter(arguments[0], item => jt.instance_of(item, '$ChartSetup.Geometry'));
        this.geom = geoms.reduce(function(memo, geom) {
            if (_.isNull(memo)) {
                return geom;
            } else {
                _.each(geom, function(v, k) {
                    memo[k] = v;
                });
                return memo;
            }
        }, null);
    },

    'SABehaviorHolder': function() {
        var behaviors = _.filter(arguments[0], item => jt.instance_of(item, '$ChartSetup.Behavior'));
        this.behavior = behaviors.reduce(function(memo, beh) {
            if (_.isNull(memo)) {
                return beh;
            } else {
                _.each(beh, function(v, k) {
                    memo[k] = v;
                });
                return memo;
            }
        }, {});
    },

    'SAMarkerHolder': function() {
        this.markers = _.filter(arguments[0], item => jt.instance_of(item, 'Marker'));
    },

    'Switch': function() {
        if (arguments.length < 2 || !_.isString(arguments[0]) || !_.isObject(arguments[1])) throw new Error('Usage: Switch(<varname_str>, <condition_map>)');
        this.var = arguments[0];
        this.mapping = arguments[1];
        if (arguments[2] !== undefined) this.default = arguments[2];
        return this;
    },

    // $ChartSetup ----------------------------------------------------------------------

    'Component': [function() {
    }, {virtual: true, pre: ['SAInit', 'SAGeometryHolder', 'SABehaviorHolder', 'SAMarkerHolder', 'SAOptHolder']}],

    '$Component': {

        'Geometry': '@$ChartSetup.Geometry',
        'Behavior': '@$ChartSetup.Behavior',
        'Marker': '@Marker',

        'Opt': '@Opt'
    },

    // Markers

    'Marker': [function() {
    }, {virtual: true}],

    '$Marker': {
        'Opt': '@Opt',
    },

    'HLine': [function() {
        this.ypos = arguments[0];
        this.color = arguments[1];
        this.line_width = arguments[2];
        this.options = arguments[3] || {};
    }, {extends: 'Marker'}],

    // Controls

    'Control': [function() {
        if (!_.isString(arguments[0])) throw new Error('Usage: ' + _.last(this._path) + '(<control_id_str>, ...)');
        this.id = arguments[0];
    }, {virtual: true}],

    'LabelControl': [function() {
        this.text = arguments[1];
    }, {extends: 'Control'}],

    'RadioControl': [function() {
        this.choices = arguments[1];
        this.selected = arguments[2];
    }, {extends: 'Control'}],

    'DropdownControl': [function() {
        this.choices = arguments[1];
        this.selected = arguments[2];
    }, {extends: 'Control'}],

    'CheckboxControl': [function() {
        this.text = arguments[1];
        this.selected = arguments[2];
    }, {extends: 'Control'}],

    // Optimizer ------------------------------------------------------------------------

    optimizer: {

        'Optimization': function() {

        },

        'Numrange': [function() {

        }, {extends: 'optimizer.Optimization'}]

    },

    /////////////////////////////////////////////////////////////////////////////////////
    // Meta-level methods for configuring schema
    /////////////////////////////////////////////////////////////////////////////////////

    // Set 'config' object to be available to constructors during parsing
    '@setConfig': function(conf) {
        config = conf;
    }

};

jt.set_schema(schema);

return schema;

});
