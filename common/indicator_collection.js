'use strict';

define(['lodash', 'eventemitter2', 'indicator_instance', 'config/timesteps', 'stream', 'jsonoc_tools', 'deferred'],
    function(_, EventEmitter2, IndicatorInstance, tsconfig, Stream, jt, Deferred) {

function Collection(jsnc, in_streams) {
    if (!(this instanceof Collection)) return Collection.apply(Object.create(Collection.prototype), arguments);

    var coll = this;
    this.create_indicator = create_indicator.bind(this);
    this.initialize_indicator = initialize_indicator.bind(this);
    this.resolve_sources = resolve_sources.bind(this);
    this.resolve_src = resolve_src.bind(this);
    this.get_unique_key = get_unique_key.bind(this);

    coll.config = jsnc;
    coll.input_streams = in_streams;

    coll.sources = {}; // named source streams, use nested objects
    coll.anon_indicators = new Map(); // anonymous indicator, use Map() and use jsnc for key

    _.each(coll.input_streams, (str, key) => {
        var ind, jsnc_ind;
        // create dummy indicator to house input steam, make output stream same as input
        jsnc_ind = _.assign(jt.create('$Collection.$Timestep.Ind', [null]), {debug: jsnc.debug});
        ind = IndicatorInstance(jsnc_ind, [str]);
        ind.id = key;
        ind.output_stream = str;
        ind.output_name = key;
        str.indicator = ind;
        _.set(coll.sources, key, str);
        coll.anon_indicators.set(jsnc_ind, ind);
    });

    // traverse all indicators to build dependency table
    coll.dependency_table = new Map();
    coll.provider_table = new Map();
    (function traverse_named_indicators(sources, path) {
        _.each(sources, (src, key) => {
            if (jt.instance_of(src, '$Collection.$Timestep.SrcType')) {
                (function traverse_anonymous_indicators(src) {
                    _.each(src.inputs, inp => {
                        if (_.isString(inp)) inp = inp.replace(/^[^a-z]*/i, ''); // strip symbols
                        add_dependency(inp, src);
                        if (jt.instance_of(src, '$Collection.$Timestep.SrcType')) {
                            traverse_anonymous_indicators(inp);
                        }
                    });
                })(src);
                src.debug = jsnc.debug; // TODO: remove?
            } else if (_.isObject(src)) {
                traverse_named_indicators(src, path.concat(key));
            } else {
                throw new Error('Unexpected value type found for source: ' + key);
            }
        });
    })(jsnc.indicators, []);

    function add_dependency(key, dep) {
        key = get_unique_key(key, true);
        dep = get_unique_key(dep, true);
        let deplist = coll.dependency_table.get(key);
        if (_.isArray(deplist)) {
            deplist.push(dep);
        } else {
            coll.dependency_table.set(key, [dep]);
        }
        let provlist = coll.provider_table.get(dep);
        if (_.isArray(provlist)) {
            provlist.push(key);
        } else {
            coll.provider_table.set(dep, [key]);
        }
    };

    // ----------------------------------------------------------------------------------

    // find dependency cycles - create lookup table where key is a source and the value is
    // an array of its circular inputs only
    coll.cycles_table = new Map();
    _.each(coll.input_streams, (input_stream, input_key) => {
        _.set(coll.sources, input_key, input_stream);
        (function find_cycles(crumbs, key) {
            if (crumbs.includes(key)) {
                let prev_key = _.last(crumbs);
                let cyclist = coll.cycles_table.get(key);
                if (_.isArray(cyclist)) {
                    if (!cyclist.includes(prev_key)) cyclist.push(prev_key);
                } else {
                    coll.cycles_table.set(key, [prev_key]);
                }
                return;
            }
            let deps = this.dependency_table.get(key);
            _.each(deps, dep => {
                find_cycles.call(this, crumbs.concat(key), dep);
            });
        }).call(this, [], input_key);
    });

    // ----------------------------------------------------------------------------------

    // walk dependencies starting from inputs to create indicators and build sources and anon_indicators
    let deferred_defs = new Map();  // {Indicator => [Deferred]}
    let provider_ready = new Map(); // {source => bool}
    _.each(coll.input_streams, (input_stream, input_key) => {
        _.set(coll.sources, input_key, input_stream);
        provider_ready.set(input_key, true);
        let input_deps = this.dependency_table.get(input_key);
        _.each(input_deps, inp_dep => instantiate_source_if_ready.call(this, [input_key], inp_dep));
    });

    // instantiate a source and recurse down into its dependents
    function instantiate_source(crumbs, src_key, src_jsnc) {
        if (provider_ready.get(src_key)) return;
        let src_ind = this.create_indicator(src_jsnc);
        let src_stream = src_ind.output_stream;
        if (src_ind) {
            if (_.isString(src_key)) _.set(coll.sources, src_key, src_ind);
            //try {
                if (_.every(src_ind.input_streams, str => !(str instanceof Deferred))) this.initialize_indicator(src_ind);
            //} catch (e) {
            //    let indpathstr = crumbs.concat([src_key]).map(s => _.isString(s) ? s : s.id || '[anon]').join('>>');
            //    throw new Error(`While initializing indicator "${indpathstr}" :: ${e.message}`);
            //}
        }
        if (_.isString(src_key) && src_ind) _.set(coll.sources, src_key, src_stream);
        provider_ready.set(src_key, true);
        let dependents = this.dependency_table.get(src_key);
        _.each(dependents, dep => {
            let dep_key = get_unique_key(dep, true);
            instantiate_source_if_ready.call(this, crumbs.concat(src_key), dep_key);
        });
    }

    // instantiate a source only if: all its inputs are fulfilled *OR* all remaining unfulfilled inputs are UCIs,
    // in which case instantiate indicator which will create Deferred inputs for each UCI (Unfulfilled Circular Input)
    function instantiate_source_if_ready(crumbs, src_key) {
        let src_jsnc = _.isString(src_key) ? _.get(jsnc.indicators, src_key) : src_key;
        // instantiate dep and recurse only if all of indicator's dependencies are fulfilled
        if (_.every(this.provider_table.get(src_key), pkey => provider_ready.has(pkey) && provider_ready.get(pkey))) {
            instantiate_source.call(this, crumbs, src_key, src_jsnc);
        } else {
            let cyclist = coll.cycles_table.get(src_key);
            if (!_.isEmpty(cyclist)) {
                let unfulfilled = _.filter(this.provider_table.get(src_key), pkey => !provider_ready.has(pkey) || !provider_ready.get(pkey));
                // if all unfulfilled inputs are cyclic, allow indicator to be created normally, while substituting
                // in Deferred objects where inputs are not yet defined
                if (_.every(unfulfilled, unf => cyclist.includes(unf))) instantiate_source.call(this, crumbs, src_key, src_jsnc);
            }
        }
    }

    // ----------------------------------------------------------------------------------

    // iterate over indicators with deferred inputs and substitute each def with actual stream
    deferred_defs.forEach((deflist, dep_ind) => {
        _.each(_.clone(deflist), def => {
            let def_key = def.src_path.join('.');
            if (provider_ready.get(def_key)) {
                var src = _.get(coll.sources, def_key);
                var input = def.src_sub_path.reduce((str, key) => str.substream(key), src);
                dep_ind.input_streams[def.index] = input;
                _.remove(deflist, d => d === def);
            }
        });
        if (_.isEmpty(deflist)) {
            this.initialize_indicator(dep_ind);
            let dep_key = get_unique_key(dep_ind.jsnc, true);
            instantiate_source.call(this, [], dep_key, dep_ind.jsnc);
            deferred_defs.delete(dep_ind);
        }
    });

    // associate Deferred object with indicator in `deferred_defs` lookup table
    function queue_deferred(provider, deferred) {
        let deflist = deferred_defs.get(provider);
        if (!_.isEmpty(deflist)) {
            deflist.push(deferred);
        } else {
            deferred_defs.set(provider, [deferred]);
        }
    }

    // normalize a source into a key-compatible value - if deponly == true, return key with
    // non-dependent portion truncated
    function get_unique_key(src, deponly = false) {
        if (src instanceof Stream) {
            if (deponly && src.root) src = src.root;
            return src.indicator && (src.indicator.id || (src.indicator.jsnc && (src.indicator.jsnc.id || src.indicator.jsnc)));
        } else if (jt.instance_of(src, '$Collection.$Timestep.SrcType')) {
            return src.id || src;
        } else if (_.isString(src)) {
            return deponly ? strip_non_dep(src.split('.')).join('.') : src;
        } else {
            throw new Error('Unsupported object provided for use as key: ' + _.isObject(src) ? JSON.stringify(src) : src.toString());
        }

        // return only the root source object without subpaths
        function strip_non_dep(full_path) {
            for (let i = 0; i <= full_path.length - 1; i++) {
                let src_path = full_path.slice(0, i + 1);
                let src = _.get(jsnc.indicators, src_path.join('.'));
                if (!_.isObject(src)) throw new Error(`Unrecognized source path or wrong type: ${src_path.join('.')}`);
                if (jt.instance_of(src, '$Collection.$Timestep.SrcType')) {
                    return src_path;
                }
            }
        }
    }

    // ----------------------------------------------------------------------------------

    // collection output template
    // TODO: fix to account for hierarchical indicators
    //this.output_template = _.fromPairs(_.map(this.indicators, (ind, key) => [key, ind.output_template]));

    this.start = cb => _.isFunction(cb) && cb();

    return this;

    // ========================================================================

    // create and define a named indicator as a source
    /*
    function define_source(key, jsnc_ind) {
        if (_.get(coll.sources, key)) return; // skip of key already defined
        var ind = create_indicator.call(this, jsnc_ind);
        if (!(ind instanceof Deferred)) provider_ready.set(key, false);
    }
    */

    // create an indicator object based on JSONOC object: $Collection.$Timestep.Ind
    function create_indicator(jsnc_ind) {

        // check if indicator has already been created for this jsnc object, if so retrieve existing copy
        if (coll.anon_indicators.has(jsnc_ind)) return coll.anon_indicators.get(jsnc_ind);

        let jsnc_conf; // config prototype jsnc for creating indicator
        // Import() sources are treated as ident indicators
        if (jt.instance_of(jsnc_ind, '$Collection.$Timestep.Import')) {
            jsnc_conf = jt.create('$Collection.$Timestep.Ind', jsnc_ind.inputs);
        } else {
            jsnc_conf = jsnc_ind;
        }

        try {
            var inputs = jsnc_conf.inputs.map(inp => {
               // [..] array-form syntax for indicator definition, as used in chart_setups
                if (_.isArray(inp)) {
                    let jsnc_inp = jt.create('$Collection.$Timestep.Ind', inp);
                    jsnc_inp.tstep = jsnc_ind.tstep;
                    return jsnc_inp;
                }
                return inp;
            });

            var ind = new IndicatorInstance(jsnc_conf, this.resolve_sources(inputs));

            ind.options = jsnc_ind.options;
            ind.input_streams.forEach((inp, idx) => {
                if (inp instanceof Deferred) { // queue Deferred inputs to be replaced later
                    inp.index = idx;
                    queue_deferred.call(this, ind, inp);
                }
            });
            if (jt.instance_of(jsnc_ind, '$Collection.$Timestep.Import')) {
                ind.name = '[Import]';
                ind.output_stream.id = '[Import].out';
                ind.output_stream.tstep = ind.input_streams[0].tstep;
                ind.output_stream.symbol = jsnc_ind.options.symbol;
            }
            coll.anon_indicators.set(jsnc_ind, ind);
            return ind;
        } catch (e) {
            if (jsnc_ind.id) {
                e.message = 'Indicator "' + jsnc_ind.id + '" (' + jsnc_ind.name + ') :: ' + e.message;
            } else if (jsnc_ind.name) {
                e.message = '(anon "' + jsnc_ind.name + '") :: ' + e.message;
            } else {
                e.message = '(anon ind) :: ' + e.message;
            }
            throw e;
        }
    }

    // initialization executed when all indicator inputs are fully available (no deferred)
    // set up tstep differential and set up update event propagation
    function initialize_indicator(ind) {

        // set a default output source/timestep/instrument based on its inputs,
        // which can then be overridden as needed by indicator's init() function

        // all sources/instruments on inputs must be the same to inherit, otherwise null
        ind.output_stream.source = _.reduce(ind.input_streams, (acc, inp) => acc === inp.source || _.isUndefined(acc) ? inp.source : null, undefined);
        ind.output_stream.instrument = _.reduce(ind.input_streams, (acc, inp) => _.isObject(inp.instrument) && (acc && acc.id === inp.instrument.id || _.isUndefined(acc)) ? inp.instrument : null, undefined);

        try {
            ind.init();
        } catch (e) {
            throw new Error(`Error occurred while initializing indicator "${ind.id}" (${ind.name}) :: ${e.message}`);
        }

        // apply timestep differential based on inputs
        try {
            ind.tstep_differential = tsconfig.differential(ind, this);
        } catch (e) {
            throw new Error(`Error occurred while initializing timestep differential on indicator "${ind.id}" (${ind.name}) :: ${e.message}`);
        }

        // propagate update events down to output stream -- wait to receive update events
        // from synchronized input streams before firing with set of tsteps
        var synch_groups = {};
        _.each(ind.input_streams, (stream, idx) => {
            var key;
            if (!(stream instanceof Stream) || _.head(ind.synch[idx]) === 'p' || ind.synch[idx] === undefined) {
                return; // passive - ignore update events from input
            } else if (_.head(ind.synch[idx]) === 's') {
                key = ind.synch[idx]; // synchronized - call update() only after all inputs in group have been updated
            } else if (_.head(ind.synch[idx]) === 'a' || _.head(ind.synch[idx]) === 'b') {
                key = ind.synch[idx] + ':' + idx; // active - propagate all update events immediately from this input
            } else {
                throw new Error('Unrecognized synchronization token: ' + ind.synch[idx]);
            }
            if (!_.has(synch_groups, key)) synch_groups[key] = {};
            synch_groups[key][idx] = null;

            stream.on('update', event => {
                // if synch == 'b' then do same as 'a' but do not propagate tsteps to skip creating new bars here and downstream
                synch_groups[key][idx] = event && _.head(key) !== 'b' && event.tstep_set || new Set();
                if (_.every(_.values(synch_groups[key]))) { // all inputs in group have been fired
                    if (coll.config.debug && console.group) console.group('[' + ind.input_streams.map(inp => inp.current_index()).join(',') + '] => ' + ind.output_stream.current_index(), ind.jsnc && ind.jsnc.id || null, '-', ind.name + ' - (src=' + idx + ') tsteps:', Array.from(event.tstep_set));

                    // consolidate synch tstep_sets that are in same group;
                    //let tsteps = _.uniq(_.flatten(_.values(synch_groups[key])));
                    let tstep_set = new Set();
                    _.each(synch_groups[key], set => {
                        set.forEach(tstep => {
                            tstep_set.add(tstep);
                        });
                    });
                    ind.update(tstep_set, idx);
                    stream.emit('update_tail', event); // called after children are updated

                    if (coll.config.debug && console.groupEnd) console.groupEnd();
                    // reset synch group
                    _.each(synch_groups[key], (val, idx) => synch_groups[key][idx] = null);
                }
            });
        });

    }

    // interprets multiple stream sources in an array or comma-delimited string
    function resolve_sources(srcs) {
        if (_.isArray(srcs)) {
            return srcs.map(this.resolve_src).reduce((memo, i) => memo.concat(i), []);
        } else if (_.isString(srcs)) {
            return _.map(srcs.split(','), subsrc => this.resolve_src(subsrc.trim()));
        } else if (jt.instance_of(srcs, '$Collection.$Timestep.SrcType')) { // nested indicator
            return this.resolve_src(srcs);
        } else if (_.isEmpty(srcs)) {
            return [];
        } else {
            throw new Error('Unexpected type given for "sources": ' + JSON.stringify(srcs));
        }
    }

    // interprets a single stream source
    function resolve_src(src) {
        var stream;
        let subind, i;
        // Source() literal reference
        if (jt.instance_of(src, '$Collection.$Timestep.Source')) { // if source stream reference
            stream = this.resolve_src(src.inputs[0]);
            return stream;
        // Import() to pull sources from other timesteps
        } else if (jt.instance_of(src, '$Collection.$Timestep.Import')) {
            subind = this.create_indicator(src);
            stream = subind.output_stream;
            return stream;
        // Ind() nested indicator
        } else if (jt.instance_of(src, '$Collection.$Timestep.Ind')) {
            subind = this.create_indicator(src);
            stream = subind.output_stream;
            if (src.options.sub) stream = (_.isArray(src.options.sub) ? src.options.sub : [src.options.sub]).reduce((str, key) => str.substream(key), stream);
            return stream;
        // Stream-typed src is already a stream
        } else if (src instanceof Stream || _.isObject(src) && _.isFunction(src.get)) {
            return src;
        // named source to look up in collection.sources
        } else if (_.isString(src)) {
            let full_path = src.split('.');
            let src_path, sub_path, target;
            for (i = 0; i <= full_path.length - 1; i++) {
                src_path = full_path.slice(0, i + 1);
                sub_path = full_path.slice(i + 1);
                // check if src is a collection input source
                target = _.get(coll.config.inputs, src_path.join('.'));
                if (target && jt.instance_of(target, '$Collection.$Timestep.Input')) {
                    if (!target.stream) throw new Error('A stream has not be defined for input: ' + src_path.join('.'));
                    stream = target.stream;
                    break;
                }
                // check if src is a source already created
                target = _.get(coll.sources, src_path.join('.'));
                if (target && target.root instanceof Stream) {
                    stream = target;
                    break;
                }
                // check if src is a source that is defined but not yet created
                target = _.get(coll.config.indicators, src_path.join('.'));
                if (target && jt.instance_of(target, '$Collection.$Timestep.SrcType')) {
                    stream = Deferred({
                        src_path: src_path,
                        src_sub_path: sub_path
                    });
                    break;
                }
            }
            if (!stream) throw Error('Unrecognized stream source: ' + src);
            // follow substream path if applicable
            if (!(stream instanceof Deferred) && sub_path.length > 0) {
                stream = sub_path.reduce((str, key) => str.substream(key), stream);
            }
            return stream;
        } else if (src instanceof Deferred) {
            return src;
        } else {
            throw new Error('Unexpected source defined for indicator: ' + JSON.stringify(src));
        }
    }

}

Collection.super_ = EventEmitter2;

Collection.prototype = Object.create(EventEmitter2.prototype, {
    constructor: {
        value: Collection,
        enumerable: false,
        writable: true,
        configurable: true
    }
});

// TODO: fix to account for hierarchical indicators
/*
Collection.prototype.get_fieldmap = function() {
    return _.map(this.indicators, function(ind, key) {
        var node = {};
        node.type = ind.output_stream.type;
        node.stream = ind.output_stream;
        if (ind.suppress) node.suppress = true;
        var subs = ind.output_stream.fieldmap;
        if (!_.isEmpty(subs)) node.recurse = recurse(subs, node.stream);
        return [key, node];
    });

    // Adds stream property to fieldmap nodes
    function recurse(fields, stream) {
        return _.map(fields, function(field) {
            var name = field[0];
            var node = field[1];
            node.stream = stream.substream(name);
            if (node.recurse) node.recurse = recurse(node.recurse, node.stream);
            return [name, node];
        });
    }
};
*/

Collection.prototype.clone = function() {
    var coll = this;
    var newcol = new Collection(coll.config, coll.input_streams);
    _.each(coll.sources, (ind, key) => newcol.sources[key] = ind);
    newcol.start = (options, cb) => coll.start(options, cb);
    return newcol;
};

return Collection;

});
