'use strict';

define(['require', 'lodash', 'stream', 'jsonoc_tools', 'config/stream_types', 'd3', 'deferred'],
    function(requirejs, _, Stream, jt, stream_types, d3, Deferred) {

// Identity indicator - simply passes first input straight through as the output
var identity_indicator = {
    initialize: function() {},
    on_bar_update: function(params, input_streams, output_stream) {
        output_stream.set(input_streams[0].get(0));
    }
};

function Indicator(jsnc_ind, in_streams, buffer_size) {
    if (!(this instanceof Indicator)) return Indicator.apply(Object.create(Indicator.prototype), arguments);

    buffer_size = parseInt(buffer_size) || 100;
    if (_.isEmpty(in_streams)) throw new Error('Indicator must accept at least one input stream');
    in_streams = _.isArray(in_streams) ? in_streams : [in_streams];
    // if any input is an indicator, use its output stream
    in_streams = _.map(in_streams, str => str instanceof Indicator ? str.output_stream : str);

    var ind = this;
    ind.jsnc = jsnc_ind;

    if (jsnc_ind.module || jsnc_ind.name) {
        if (jsnc_ind.module) { // indicator module directly provided
            ind.name = '[unknown]';
            ind.indicator = jsnc_ind.module;
        } else { // name provided
            ind.name = jsnc_ind.name;
            var ind_path = jsnc_ind.name.split(':');
            var path = ['indicators'].concat(_.initial(ind_path), _.last(ind_path)).join('/');
            ind.indicator = requirejs(path);
        }
        ind.input = _.clone(ind.indicator.input);
        ind.synch = _.clone(ind.indicator.synch);
        ind.output = ind.indicator.output !== undefined ? _.clone(ind.indicator.output) : ind.input[0];
        ind.param_names = _.isArray(ind.indicator.param_names) ? _.clone(ind.indicator.param_names) : [];
    } else if (jsnc_ind.name) { // named indicator
        ind.input = _.clone(ind.indicator.input);
        ind.synch = _.clone(ind.indicator.synch);
        ind.output = ind.indicator.output !== undefined ? _.clone(ind.indicator.output) : ind.input[0];
        ind.param_names = _.isArray(ind.indicator.param_names) ? _.clone(ind.indicator.param_names) : [];
    } else { // default to identity indicator if no name provided
        ind.name = '[ident]';
        ind.indicator = identity_indicator;
        if (in_streams.length > 1) throw new Error('Identity indicator only accepts single input - multiple are given');
        ind.input = _.clone(in_streams[0].type || stream_types.default_type);
        ind.output = ind.input;
    }

    // map params by index and name
    ind.params = {};
    var params = ind.params;
    _.each(jsnc_ind.params, function(val, key) {
        params[key] = val;
        if (ind.param_names && _.isString(ind.param_names[key])) params[ind.param_names[key]] = val;
    });

    // verify input stream types against indicator input definition, and expand definition wildcards
    ind.input_streams = in_streams;
    if (!ind.input_streams[0] instanceof Stream) throw new Error('First input of indicator must be a stream');
    // if 'input' is defined on ind, assert that corresponding input streams are of compatible type
    var repeat = null;
    var zipped = _.zip(ind.input_streams, _.isArray(ind.input) ? ind.input : [ind.input], _.isArray(ind.synch) ? ind.synch : ['s']);
    var gen = {}; // track and match generic types
    _.each(zipped, function(tup, idx) {
        var optional = false;
        if (tup[1] === undefined && repeat !== null) {
            tup[1] = repeat.type;
            tup[2] = repeat.synch;
        } else if (tup[1].length > 1 && (_.last(tup[1]) === '*' || _.last(tup[1]) === '+')) {
            if (_.last(tup[1]) === '*') optional = true;
            tup[1] = _.initial(tup[1]).join('');
            repeat = {type: tup[1], synch: tup[2]};
        } else if (_.last(tup[1]) === '?') {
            tup[1] = _.initial(tup[1]).join('');
            optional = true;
        }

        // do checks
        if (tup[0] !== undefined) { // if stream is provided
            if (tup[0] instanceof Deferred) {
                // defining of indicator input is deferred for later
            } else if (tup[1] === undefined) {
                throw new Error(jsnc_ind.id + ' (' + ind.name + '): Found unexpected input #' + (idx + 1) + " of type '" + tup[0].type + "' where no input is defined");
            } else if (tup[1] === '_') { // allows any type
                // do nothing
            } else if (_.isString(tup[1]) && _.head(tup[1]) === '^') { // "^" glob to match on any type
                var gename = _.drop(tup[1]).join('');
                if (_.has(gen, gename)) {
                    if (gen[gename] !== tup[0].type) throw new Error('Type "' + tup[0].type + '" does not match previously defined type "' + gen[gename] + '" for generic: ^' + gename);
                } else {
                    gen[gename] = tup[0].type;
                }
            } else { // if indicator enforces type-checking for this input
                if (!tup[0].hasOwnProperty('type'))
                    throw new Error(jsnc_ind.id + ' (' + ind.name + '): No type is defined for input #' + (idx + 1) + " to match '" + tup[1] + "'");
                if (!stream_types.isSubtypeOf(tup[0].type, tup[1]))
                    throw new Error(jsnc_ind.id + ' (' + ind.name + '): Input #' + (idx + 1) + " type '" + (_.isObject(tup[0].type) ? JSON.stringify(tup[0].type) : tup[0].type) + "' is not a subtype of '" + tup[1] + "'");
            }
        } else {
            if (!optional) {throw new Error(ind.name + ': No stream provided for required input #' + (idx + 1) + " of type '" + tup[1] + "'");};
        }
    });
    // Use synch expanded to number of input streams
    ind.synch = _.map(zipped, x => x[2]);

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

    ind.output_stream = new Stream(buffer_size, ind.name + '.out', {type: ind.output});

    // if tstep not available from jsnc, output_stream inherits first input streams's tstep by default -- indicator_collection may override after construction
    ind.output_stream.tstep = ind.jsnc.tstep || ind.input_streams[0].tstep;

    if (_.isEmpty(ind.output_fields) && !_.isEmpty(ind.output_template)) {
       // TODO
    }

    // context is "this" object within the indicator's initialize()/on_bar_update() functions
    ind.context = {
        output_fields: ind.output_fields,
        current_index: ind.output_stream.current_index.bind(ind.output_stream),
        // Provide indicator with contructors to create nested stream/indicator instances with
        // update() function defaulting to host indicator's tsteps value from it's own last update
        stream: function() {
            var str = Stream.apply(Object.create(Stream.prototype), arguments);
            str.next = function(tsteps) {
                tsteps = tsteps === undefined ? ind.last_update_tsteps : tsteps;
                Stream.prototype.next.call(this, tsteps);
            };
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
            var sub = Indicator.apply(Object.create(Indicator.prototype), [jsnc_ind2, jsnc_ind2.src, bsize]);
            sub.update = function(tsteps, src_idx) {
                tsteps = tsteps === undefined ? ind.last_update_tsteps : tsteps;
                Indicator.prototype.update.call(this, tsteps, src_idx);
            };
            return sub;
        },
        stop_propagation: function() {
            ind.stop_propagation = true;
        }
    };

    // initialize indicator if there are no deferred inputs
    if (!_.some(ind.input_streams, str => !!(_.isObject(str) && str.deferred))) {
        ind.indicator.initialize.apply(ind.context, [ind.params, ind.input_streams, ind.output_stream]);
    }

    ind.tstep_differential = () => false; // this is overridden by indicator_collection for indicators implementing

    return ind;
}

Indicator.prototype = {

    constructor: Indicator,

    update: function(tsteps, src_idx) {
        // .tstep_differential(src_idx) does hash comparison for given source index only if
        //    a target TF was defined for this indicator in collection def, otherwise false returned
        // .tstep_differential(src_idx) must execute at every bar and remain first if conditional
        if (src_idx !== undefined && this.tstep_differential(src_idx)) {
            this.output_stream.next();
            tsteps = _.uniq(tsteps.concat(this.output_stream.tstep));
        // tsteps param already contains this indicator's timestep (and therefore create new bar)
        } else if (_.isArray(tsteps) && _.includes(tsteps, this.output_stream.tstep)) {
            this.output_stream.next();
        // always create new bar when tstep not applicable (catch-all for when src_idx not defined)
        /* catch-all to create new bar when tstep is not applicable??
        } else if (this.output_stream.step === undefined) {
            this.output_stream.next();
        */
        }
        this.last_update_tsteps = tsteps; // track timesteps that will be inherited by embedded indicators
        this.indicator.on_bar_update.apply(this.context, [this.params, this.input_streams, this.output_stream, src_idx]);
        // TODO: define 'modified' even when timesteps is null?
        if (this.stop_propagation) {
            delete this.stop_propagation;
            return;
        }
        var event = {modified: this.output_stream.modified, tsteps: tsteps};
        this.output_stream.emit('update', event);
    },

    get: function(bars_ago) {
        return this.output_stream.get(bars_ago);
    },

    simple: function() {
        var str = this.output_stream.simple();
        //var that = this;
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
        comp.chart.register_directives(ind_attrs, function() {
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
