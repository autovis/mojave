'use strict';

define(['require', 'lodash', 'stream', 'jsonoc_tools', 'config/stream_types', 'd3', 'deferred'],
    function(requirejs, _, Stream, jt, stream_types, d3, Deferred) {

// Identity indicator - straight passthru from input to output
var identity_indicator = {
    initialize: function() {},
    on_bar_update: function() {
        if (this.modified && this.modified.size > 0) {
            this.modified.forEach(idx => this.output.set_index(this.inputs[0].get_index(idx), idx));
        } else {
            this.output.set(this.inputs[0].get(0));
        }
    }
};

function Indicator(jsnc_ind, in_streams, buffer_size) {
    if (!(this instanceof Indicator)) return Indicator.apply(Object.create(Indicator.prototype), arguments);

    var ind = this;

    ind.buffer_size = parseInt(buffer_size) || 100;
    if (_.isEmpty(in_streams)) throw new Error('Indicator must accept at least one input stream');
    in_streams = _.isArray(in_streams) ? in_streams : [in_streams];
    // if any input is an indicator, use its output stream
    in_streams = _.map(in_streams, str => str instanceof Indicator ? str.output_stream : str);
    ind.input_streams = in_streams;
    ind.jsnc = jsnc_ind;

    if (ind.jsnc.module || ind.jsnc.name) {
        if (ind.jsnc.module) { // indicator module directly provided
            ind.name = '[unknown]';
            ind.indicator = ind.jsnc.module;
        } else { // name provided
            ind.name = ind.jsnc.name;
            var ind_path = ind.jsnc.name.split(':');
            let path = ['indicators'].concat(_.initial(ind_path), _.last(ind_path)).join('/');
            ind.indicator = requirejs(path);
        }
        ind.input = _.clone(ind.indicator.input);
        ind.synch = jsnc_ind.options.synch || _.clone(ind.indicator.synch);
        ind.dgrps = jsnc_ind.options.dgrps || _.clone(ind.indicator.dgrps);
        ind.output = ind.indicator.output !== undefined ? _.clone(ind.indicator.output) : ind.input[0];
        ind.param_names = _.isArray(ind.indicator.param_names) ? _.clone(ind.indicator.param_names) : [];
    } else if (ind.jsnc.name) { // named indicator
        ind.input = _.clone(ind.indicator.input);
        ind.synch = jsnc_ind.options.synch || _.clone(ind.indicator.synch);
        ind.dgrps = jsnc_ind.options.dgrps || _.clone(ind.indicator.dgrps);
        ind.output = ind.indicator.output !== undefined ? _.clone(ind.indicator.output) : ind.input[0];
        ind.param_names = _.isArray(ind.indicator.param_names) ? _.clone(ind.indicator.param_names) : [];
    } else { // default to identity indicator if no name provided
        ind.name = '[ident]';
        ind.indicator = identity_indicator;
        if (in_streams.length > 1) throw new Error('Identity indicator only accepts single input - multiple are given');
        let inp = _.clone(in_streams[0].type || stream_types.default_type);
        ind.input = [inp];
        ind.output = inp;
    }
    //if (_.isEmpty(ind.output_fields) && !_.isEmpty(ind.output_template)) {}
    ind.vars = { // fixed ind vars, intercepted by proxy
        index: null
    };

    // verify input stream types against indicator input definition, and expand definition wildcards
    if (!ind.input_streams[0] instanceof Stream) throw new Error('First input of indicator must be a stream');
    // if 'input' is defined on ind, assert that corresponding input streams are of compatible type
    var repeat = null;
    var zipped = _.zip(
        ind.input_streams,
        _.isArray(ind.input) ? ind.input : [ind.input],
        _.isArray(ind.synch) ? ind.synch : ['s'],
        _.isArray(ind.dgrps) ? ind.dgrps : _.keys(ind.input_streams));
    var gen = {}; // track and match generic types
    _.each(zipped, ([stream, input, synch, dgrp], idx) => {
        let optional = false;
        //let is_array = false;
        if (_.isUndefined(input)) { // if input not defined
            if (repeat) {
                input = repeat.type;
                synch = repeat.synch;
                dgrp = repeat.dgrp;
            } else {
                throw new Error(ind.jsnc.id + ' (' + ind.name + '): Unexpected stream #' + (idx + 1) + ' of type "' + stream.type + '"');
            }
        } else if (input.length > 1 && (_.last(input) === '*' || _.last(input) === '+')) {
            if (_.last(input) === '*') optional = true;
            input = _.initial(input).join('');
            repeat = {type: input, synch: synch, dgrp: dgrp};
        } else if (_.last(input) === '?') {
            input = _.initial(input).join('');
            optional = true;
        }
        /* support for array types: num[]
        if (_.isString(input)) {
            let [, inp] = input.match(/^(.*)\[\]$/) || [];
            if (inp) {
                input = inp;
                is_array = true;
            }
        }
        */

        // do checks
        if (!_.isUndefined(stream)) { // if stream is provided
            if (_.isObject(stream) && stream instanceof Deferred) {
                // defining of indicator input is deferred for later
            } else if (input === undefined) {
                throw new Error(ind.jsnc.id + ' (' + ind.name + '): Unexpected input #' + (idx + 1) + " of type '" + stream.type + "' where no input is defined");
            } else if (input === '_') { // allows any type
                // do nothing
            } else if (_.isString(input) && _.head(input) === '^') { // "^" glob to match on any type
                var gename = _.drop(input).join('');
                if (_.has(gen, gename)) {
                    if (gen[gename] !== stream.type) throw new Error('Type "' + stream.type + '" does not match previously defined type "' + gen[gename] + '" for generic: ^' + gename);
                } else {
                    gen[gename] = stream.type;
                }
            } else { // if indicator enforces type-checking for this input
                if (!stream.hasOwnProperty('type')) throw new Error(ind.jsnc.id + ' (' + ind.name + '): No type is defined for input #' + (idx + 1) + " to match '" + input + "'");
                if (!stream_types.isSubtypeOf(stream.type, input)) throw new Error(ind.jsnc.id + ' (' + ind.name + '): Input #' + (idx + 1) + " type '" + (_.isObject(stream.type) ? JSON.stringify(stream.type) : stream.type) + "' is not a subtype of '" + input + "'");
            }
        } else {
            if (!optional) {throw new Error(ind.name + ': No stream provided for required input #' + (idx + 1) + " of type '" + input + "'");};
        }

        zipped[idx] = [stream, input, synch, dgrp];
    });
    // expand synch and dgrps to number of input streams
    ind.synch = _.map(zipped, x => x[2]);
    ind.dgrps = _.map(zipped, x => x[3]);

    // If output defines generic type, replace it with actual type
    if (_.head(ind.output) === '^') {
        var gename = _.drop(ind.output).join('');
        if (_.has(gen, gename)) {
            ind.output = gen[gename];
        } else {
            throw new Error('Generic "^' + gename + '" in output must have corresponding type associated from one or more input streams');
        }
    } else if (ind.output === '_') {
        throw new Error('Matching with "_" is not permitted in output type definition, use generic or real type');
    }

    // define and initialize output stream
    ind.output_stream = new Stream(ind.buffer_size, ind.name + '.out', {type: ind.output});
    ind.output_stream.tstep = ind.jsnc.tstep;
    ind.output_stream.instrument = ind.input_streams[0].instrument;
    ind.output_stream.indicator = ind;
    if (ind.id) ind.output_stream.id = ind.id;

    // create proxy for indicator vars to intercept references to fixed vars for eval
    var vars_proxy = new Proxy(ind.vars, {
        get(target, key) {
            switch (key) {
                case 'index':
                    return ind.current_index();
                default:
                    return target[key];
            }
        }
    });

    // create object of indicator parameters, substituting proxies where applicable
    ind.param_proxies = [];
    ind.params = (function substitute_proxy(obj, path = []) {
        // check if any value is a JSONOC proxy.* constructor
        let proxies = _.fromPairs(_.toPairs(obj).filter(p => jt.instance_of(p[1], 'proxy.Proxy')));
        ind.param_proxies = ind.param_proxies.concat(_.values(proxies));
        if (!_.isEmpty(proxies)) {
            return new Proxy(obj, {
                get(target, key) {
                    if (proxies.hasOwnProperty(key)) {
                        return proxies[key]._eval(vars_proxy, ind.input_streams);
                    } else if (key in target) {
                        return target[key];
                    } else {
                        return undefined;
                        //throw new ReferenceError('Indicator parameter "' + path.concat(key).join('.') + '" is undefined');
                    }
                },
                set(target, key, value) {
                    if (proxies.hasOwnProperty(key)) throw new Error('Cannot mutate value of indicator param: ' + key);
                    target[key] = value;
                    return true;
                },
                deleteProperty(target, key) {
                    if (proxies.hasOwnProperty(key)) throw new Error('Cannot delete indicator param: ' + key);
                    delete target[key];
                    return true;
                }
            });
        } else {
            // return normal object, recurse down its values
            return _.fromPairs(_.toPairs(obj).map(p => _.isObject(p[1]) && !_.isArray(p[1]) ? [p[0], substitute_proxy(p[1], path.concat(p[0]))] : [p[0], p[1]]));
        }
    })(_.zipObject(ind.param_names, ind.jsnc.params));

    // context is "this" object within the indicator's initialize()/on_bar_update() functions
    var context = {
        param: ind.params,
        inputs: ind.input_streams,
        output: ind.output_stream,
        output_fields: ind.output_fields,
        current_index: ind.output_stream.current_index.bind(ind.output_stream),
        // Provide indicator with contructors to create nested stream/indicator instances with
        // update() function defaulting to host indicator's tsteps value from it's own last update
        stream: function() {
            var str = Stream.apply(Object.create(Stream.prototype), arguments);
            str.next = function(tstep_set) {
                if (!tstep_set) tstep_set = ind.last_update_tstep_set || new Set();
                Stream.prototype.next.call(this, tstep_set);
            };
            str.source = ind.output_stream.source;
            str.instrument = ind.output_stream.instrument;
            str.tstep = ind.output_stream.tstep;
            return str;
        },
        indicator: function(ind_def, istreams, bsize) {
            var jsnc_ind2;
            if (_.isString(_.head(ind_def))) {
                jsnc_ind2 = jt.create('$Collection.$Timestep.Ind', [istreams].concat(ind_def));
            } else { // Indicator module passed in directly in place of name
                jsnc_ind2 = jt.create('$Collection.$Timestep.Ind', [istreams, null].concat(_.drop(ind_def)));
                jsnc_ind2.module = _.head(ind_def);
            }
            var sub = Indicator.apply(Object.create(Indicator.prototype), [jsnc_ind2, jsnc_ind2.inputs, bsize]);
            sub.indicator.initialize.apply(sub.context, [sub.params, sub.input_streams, sub.output_stream]);
            sub.update = function(tstep_set, src_idx) {
                if (!tstep_set) tstep_set = ind.last_update_tstep_set;
                Indicator.prototype.update.call(this, tstep_set, src_idx);
            };
            sub.output_stream.tstep = ind.output_stream.tstep;
            if (sub.output_stream.tstep) {
                sub.tstep_differential = (src_idx, tstep_set) => {
                    if (!tstep_set || tstep_set.has(sub.output_stream.tstep)) {
                        return true;
                    } else {
                        return false;
                    }
                };
            }

            return sub;
        },
        vars: vars_proxy,
        stop_propagation: function() {
            ind.stop_propagation = true;
        },
        modified: new Set(),
        debug: ind.jsnc.debug
    };

    // use a proxy to validate access to context
    var context_immut_keys = _.keys(context);
    ind.context = new Proxy(context, {
        get(target, key) {
            if (key === 'index') {
                return ind.current_index();
            } else if (key in target) {
                return target[key];
            } else {
                throw new ReferenceError('Undefined context property: ' + key);
            }
        },
        set(target, key, value) {
            if (context_immut_keys.includes(key)) {
                throw new Error('Cannot change immutable context property: ' + key);
            }
            target[key] = value;
            return true;
        },
        deleteProperty(target, key) {
            if (context_immut_keys.includes(key)) {
                throw new Error('Cannot delete immutable context property: ' + key);
            }
            delete target[key];
            return true;
        }
    });

    ind.tstep_differential = () => true; // this is overridden by indicator_collection for indicators implementing

    // initialize any parameter proxies
    _.each(ind.param_proxies, prox => prox._init(vars_proxy, ind.input_streams));

    return ind;
}

Indicator.prototype = {

    constructor: Indicator,

    init: function() {

        var ind = this;

        // call initialize() method on indicator
        ind.indicator.initialize.apply(ind.context, [ind.params, ind.input_streams, ind.output_stream]);

    },

    update: function(tstep_set, src_idx, modified) {

        this.context.modified.clear();
        if (modified) {
            modified.forEach(i => this.context.modified.add(i));
        } else if (src_idx) {
            let idx = this.input_streams[src_idx].current_index();
            this.context.modified.add(idx);
        } else {
            let idx = this.input_streams[0].current_index();
            this.context.modified.add(idx);
        }
        var modified_close = new Set();
        try {

            if (this.tstep_differential(src_idx, tstep_set)) {
                create_new_bar.call(this);
                tstep_set.add(this.output_stream.tstep);
            }

            this.last_update_tstep_set = tstep_set; // track set that will be given to any embedded indicators
            this.indicator.on_bar_update.apply(this.context, [this.params, this.input_streams, this.output_stream, src_idx]);
            if (this.stop_propagation) {
                delete this.stop_propagation;
                return;
            }
        } catch (e) {
            throw new Error('Within update() in indicator "' + this.id + '" (' + this.name + ') :: ' + e.message);
        }
        var event = {modified: new Set([...modified_close, ...this.output_stream.modified]), tstep_set: tstep_set};
        this.output_stream.emit('update', event);

        ////////////////////////////////////

        function create_new_bar() {
            if (_.isFunction(this.indicator.on_bar_close) && this.output_stream.index > 0) {
                this.indicator.on_bar_close.apply(this.context, [this.params, this.input_streams, this.output_stream, src_idx]);
            }
            modified_close = new Set(this.output_stream.modified);
            this.output_stream.next();
            if (_.isFunction(this.indicator.on_bar_open)) {
                this.indicator.on_bar_open.apply(this.context, [this.params, this.input_streams, this.output_stream, src_idx]);
            }
        }
    },

    get: function(bars_ago) {
        return this.output_stream.get(bars_ago);
    },

    simple: function() {
        var str = this.output_stream.simple();
        str.update = this.update.bind(this);
        return str;
    },

    current_index: function() {
        return this.output_stream.current_index();
    },

    // Methods applicable to visual indicators only, otherwise will throw error if called

    vis_init: function(comp, ind_attrs) {
        var ind = this;
        if (!_.isFunction(this.indicator.vis_init)) throw new Error("vis_init() called on indicator instance with no 'vis_init' function defined on implementation");
        if (!_.isFunction(this.indicator.vis_render)) throw new Error("vis_init() called on indicator instance with no 'vis_render' function defined on implementation");
        if (!_.isFunction(this.indicator.vis_update)) throw new Error("vis_init() called on indicator instance with no 'vis_update' function defined on implementation");
        comp.chart.register_directives(ind_attrs, () => {
            var cont = comp.indicators_cont.select('#' + ind_attrs.id);
            var ind_attrs_evaled = comp.chart.eval_directives(ind_attrs);
            comp.data = ind_attrs.data;
            if (!cont) throw new Error('Indicator container missing for indicator: ' + ind_attrs.id);
            if (cont) ind.vis_render(comp, ind_attrs_evaled, cont);
        });
        var ind_attrs_evaled = comp.chart.eval_directives(ind_attrs);
        this.indicator.vis_init.apply(this.context, [d3, comp, ind_attrs_evaled]);
    },

    vis_render: function(comp, ind_attrs, cont) {
        var ind_attrs_evaled = comp.chart.eval_directives(ind_attrs);
        cont.selectAll('*').remove();
        if (_.has(ind_attrs_evaled, 'visible') && !ind_attrs_evaled.visible) return;
        comp.data = ind_attrs.data;
        this.indicator.vis_render.apply(this.context, [d3, comp, ind_attrs_evaled, cont]);
    },

    vis_update: function(comp, ind_attrs, cont) {
        var ind_attrs_evaled = comp.chart.eval_directives(ind_attrs);
        if (_.has(ind_attrs_evaled, 'visible') && !ind_attrs_evaled.visible) return;
        comp.data = ind_attrs.data;
        this.indicator.vis_update.apply(this.context, [d3, comp, ind_attrs_evaled, cont]);
    }
};

return Indicator;

});
