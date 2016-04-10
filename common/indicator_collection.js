'use strict';

define(['lodash', 'eventemitter2', 'indicator_instance', 'config/timesteps', 'stream', 'jsonoc_tools', 'deferred'],
    function(_, EventEmitter2, IndicatorInstance, tsconfig, Stream, jt, Deferred) {

function Collection(jsnc, in_streams) {
    if (!(this instanceof Collection)) return Collection.apply(Object.create(Collection.prototype), arguments);

    var coll = this;
    coll.config = jsnc;
    coll.input_streams = in_streams;

    // define and construct indicators
    coll.indicators = {};

    _.each(coll.input_streams, function(str, key) {
        var ind;
        // create dummy indicator to house input steam, make output steam same as input
        ind = IndicatorInstance(_.assign(jt.create('$Collection.$Timestep.Ind', [null]), {debug: jsnc.debug}), [str]);
        ind.id = key;
        ind.output_stream = str;
        ind.output_name = key;
        coll.indicators[key] = ind;
    });

    //
    // track source dependencies not yet defined to be injected later
    // {ind_id => [<Source>]}
    var deferred_defs = {};
    _.each(jsnc.indicators, function(jsnc_ind, key) {
        jsnc_ind.id = key;
        jsnc_ind.debug = jsnc.debug;
        var ind = define_indicator.call(coll, key, jsnc_ind);
        // check indicator inputs for sources that are deferred and track them
        _.each(ind.input_streams, function(inp) {
            if (inp instanceof Deferred) {
                if (!_.has(deferred_defs, inp.src)) deferred_defs[inp.src] = [];
                deferred_defs[inp.src].push(inp);
            }
        });
    });

    // iterate over sources with deferred inputs and substitute them with actual input source
    var inds_deferred_inps = [];
    _.each(deferred_defs, function(deferred_list, src) {
        _.each(deferred_list, function(inp) {
            if (!_.has(coll.indicators, src)) throw new Error("Indicator '" + src + "' is not defined in collection");
            var input = inp.sub.reduce((str, key) => str.substream(key), coll.indicators[inp.src].output_stream);
            inp.indicator.input_streams[inp.index] = input;
            inds_deferred_inps.push(inp.indicator);
        });
    });

    // initialize and prepare indicators that had deferred inputs
    _.each(_.uniq(inds_deferred_inps), function(ind) {
        ind.indicator.initialize.apply(ind.context, [ind.params, ind.input_streams, ind.output_stream]);
        prepare_indicator(ind);
    });

    // collection output template
    this.output_template = _.fromPairs(_.map(this.indicators, (ind, key) => [key, ind.output_template]));

    this.create_indicator = create_indicator.bind(this);
    this.define_indicator = define_indicator.bind(this);
    this.resolve_sources = resolve_sources.bind(this);
    this.resolve_src = resolve_src.bind(this);

    this.start = cb => _.isFunction(cb) && cb();

    return this;

    // ========================================================================

    // define a new indicator for collection
    function define_indicator(key, jsnc_ind) {
        if (_.has(coll.indicators, key)) throw new Error('Item "' + key + '" is already defined in collection');

        var ind;
        var opt = key.split('?');
        var sup = key.split('~');

        if (opt.length > 1 && _.last(sup) === '') {
            key = sup[0];
        }

        ind = create_indicator.call(coll, jsnc_ind);

        if (sup.length > 1 && sup[0] === '') {
            ind.suppress = true;
            key = sup[1];
        }
        ind.output_stream.id = key;
        ind.output_name = key;
        coll.indicators[key] = ind;

        return ind;
    }

    // create an indicator object based on JSONOC object: $Collection.$Timestep.Ind
    function create_indicator(jsnc_ind) {

        var ind;
        try {
            ind = new IndicatorInstance(jsnc_ind, resolve_sources(jsnc_ind.src));
        } catch (e) {
            if (jsnc_ind.id) {
                e.message = 'Indicator "' + jsnc_ind.id + '":: ' + e.message;
            } else if (jsnc_ind.name) {
                e.message = '(anon "' + jsnc_ind.name + '"):: ' + e.message;
            } else {
                e.message = '(anon ind):: ' + e.message;
            }
            throw e;
        }

        ind.options = jsnc_ind.options;

        _.each(ind.input_streams, (input, idx) => {
            if (input instanceof Deferred) {
                input.dependent = jsnc_ind.id;
                input.indicator = ind;
                input.index = idx;
                input.tstep = jsnc_ind.tstep;
            }
        });

        // Output stream instrument defaults to that of first input stream
        if (ind.input_streams[0].instrument) ind.output_stream.instrument = ind.input_streams[0].instrument;

        if (!_.some(ind.input_streams, str => str instanceof Deferred)) {
            prepare_indicator(ind);
        }

        return ind;
    }

    // post-initialization: define instrument, set up tstep differential, set up update event propagation
    function prepare_indicator(ind) {

        // Apply timestep differential to indicator if it is defined under a different timestep than its first source
        var source_tstep = ind.input_streams[0].tstep;
        var target_tstep = ind.output_stream.tstep;
        if (target_tstep && target_tstep !== source_tstep) {
            // sanity checks
            if (!_.has(tsconfig.defs, target_tstep)) throw new Error('Unknown timestep: ' + target_tstep);
            if (!source_tstep) {
                throw new Error('First input stream of indicator must define a timestep for differential');
            }
            if (!_.has(tsconfig.defs, source_tstep)) throw new Error('Unknown timestep: ' + source_tstep);

            ind.tstep_differential = tsconfig.differential(ind.input_streams, target_tstep);
        }

        // Propagate update events down to output stream -- wait to receive update events
        // from synchronized input streams before firing with unique concat of their tsteps
        var synch_groups = {};
        _.each(ind.input_streams, function(stream, idx) {
            var key;
            if (!(stream instanceof Stream) || _.head(ind.synch[idx]) === 'p' || ind.synch[idx] === undefined) {
                return; // passive - ignore update events
            } else if (_.head(ind.synch[idx]) === 's') {
                key = ind.synch[idx]; // synchronized - buffer events received across group
            } else if (_.head(ind.synch[idx]) === 'a' || _.head(ind.synch[idx]) === 'b') {
                key = ind.synch[idx] + ':' + idx; // active - propagate all update events immediately
            } else {
                throw new Error('Unrecognized synchronization token: ' + ind.synch[idx]);
            }
            if (!_.has(synch_groups, key)) synch_groups[key] = {};
            synch_groups[key][idx] = null;

            stream.on('update', function(event) {
                // if synch type 'b' then do not propagate tsteps to create new bars
                synch_groups[key][idx] = event && _.head(key) !== 'b' && event.tsteps || [];
                if (_.every(_.values(synch_groups[key]))) {
                    if (coll.config.debug && console.group) console.group(ind.input_streams[0].current_index() + ' / ' + ind.output_stream.current_index(), ind.jsnc && ind.jsnc.id || null, '-', ind.name + ' - [src:' + idx + ']');
                    ind.update(_.uniq(_.flattenDeep(_.values(synch_groups[key]))), idx);
                    if (coll.config.debug && console.groupEnd) console.groupEnd();
                    _.each(synch_groups[key], (val, idx) => synch_groups[key][idx] = null);
                }
            });
        });

    }

    // Interprets one or more stream sources
    function resolve_sources(srcs) {
        if (_.isArray(srcs)) {
            return srcs.map(resolve_src).reduce((memo, i) => memo.concat(i), []);
        } else if (_.isString(srcs)) {
            return _.map(srcs.split(','), subsrc => resolve_src(subsrc.trim()));
        } else if (jt.instance_of(srcs, '$Collection.$Timestep.Src')) { // if nested indicator
            return resolve_src(srcs);
        } else if (_.isEmpty(srcs)) {
            return [];
        } else {
            throw new Error('Unexpected type given for "sources": ' + JSON.stringify(srcs));
        }
    }

    // Expects and interprets a single stream source
    function resolve_src(src) {
        var stream, subind;
        if (jt.instance_of(src, '$Collection.$Timestep.Src')) { // if nested indicator
            subind = create_indicator.call(coll, src);
            stream = subind.output_stream;
            if (src.options.sub) stream = (_.isArray(src.options.sub) ? src.options.sub : [src.options.sub]).reduce((str, key) => str.substream(key), stream);
            return stream;
        } else if (_.isArray(src)) { // assume indicator definition if array
            var jsnc_ind = jt.create('$Collection.$Timestep.Ind', src);
            subind = create_indicator.call(coll, jsnc_ind);
            stream = subind.output_stream;
            if (src.options.sub) stream = (_.isArray(src.options.sub) ? src.options.sub : [src.options.sub]).reduce((str, key) => str.substream(key), stream);
            return stream;
        } else if (_.isString(src)) {
            var src_path = src.split('.');
            if (src_path[0] === '$') { // use collection output (not a stream)
                stream = coll.indicators;
            } else if (coll.input_streams[src_path[0]]) { // collection input stream id
                stream = coll.input_streams[src_path[0]];
            } else if (coll.indicators[src_path[0]]) { // indicator already defined
                stream = coll.indicators[src_path[0]].output_stream;
            } else if (coll.config.indicators[src_path[0]]) { // indicator not yet defined (return jsnc with `deferred` property)
                stream = Deferred({
                    src: _.head(src_path),
                    sub: _.drop(src_path)
                });
            }
            if (!stream) throw Error('Unrecognized indicator source: ' + src_path[0]);
            // follow substream path if applicable
            if (!(stream instanceof Deferred) && src_path.length > 1) {
                stream = _.drop(src_path).reduce((str, key) => str.substream(key), stream);
            }
            return stream;
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

Collection.prototype.clone = function() {
    var coll = this;
    var newcol = new Collection(coll.config, coll.input_streams);
    _.each(coll.indicators, (ind, key) => newcol.indicators[key] = ind);
    newcol.start = cb => coll.start(cb);
    return newcol;
};

return Collection;

});
