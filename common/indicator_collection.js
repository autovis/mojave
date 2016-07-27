'use strict';

define(['lodash', 'eventemitter2', 'indicator_instance', 'config/timesteps', 'stream', 'jsonoc_tools', 'deferred'],
    function(_, EventEmitter2, IndicatorInstance, tsconfig, Stream, jt, Deferred) {

function Collection(jsnc, in_streams) {
    if (!(this instanceof Collection)) return Collection.apply(Object.create(Collection.prototype), arguments);

    var coll = this;
    this.create_indicator = create_indicator.bind(this);
    this.define_indicator = define_indicator.bind(this);
    this.prepare_indicator = prepare_indicator.bind(this);
    this.resolve_sources = resolve_sources.bind(this);
    this.resolve_src = resolve_src.bind(this);

    coll.config = jsnc;
    coll.input_streams = in_streams;

    // define and construct indicators
    coll.indicators = {};

    _.each(coll.input_streams, function(str, key) {
        var ind;
        // create dummy indicator to house input steam, make output stream same as input
        ind = IndicatorInstance(_.assign(jt.create('$Collection.$Timestep.Ind', [null]), {debug: jsnc.debug}), [str]);
        ind.id = key;
        ind.output_stream = str;
        ind.output_name = key;
        _.set(coll.indicators, key, ind);
    });

    //
    // track source dependencies not yet defined to be injected later
    // {ind_id => <Source> | Object}
    coll.deferred_defs = new Map();
    (function track_deps(sources, path) {
        _.each(sources, (src, key) => {
            if (jt.instance_of(src, '$Collection.$Timestep.SrcType')) {
                src.id = path.concat(key).join('.');
                src.debug = jsnc.debug;
                define_indicator.call(coll, path.concat(key).join('.'), src);
            } else if (_.isObject(src)) {
                track_deps(src, path.concat(key));
            } else {
                throw new Error('Unexpected value type found for source: ' + key);
            }
        });
    })(jsnc.indicators, []);

    // iterate over sources with deferred inputs and substitute them with actual input source
    coll.deferred_defs.forEach((dependent_list, provider) => {
        _.each(dependent_list, dep => {
            var input = dep.sub.reduce((str, key) => str.substream(key), provider.output_stream);
            dep.indicator.input_streams[dep.index] = input;
            if (dep.index === 0) {
                if (!_.has(input.root, 'dependents')) input.root.dependents = [];
                input.root.dependents.push(dep.indicator);
            }
        });
    });

    // walk dependency tree connected to each input, preparing each indicator
    _.each(coll.input_streams, (input, key) => {
        (function propagate_init(crumbs, stream) {
            _.each(stream.dependents, dep => {
                if (stream.instrument) dep.output_stream.instrument = stream.instrument;
                prepare_indicator.call(coll, dep);
                if (crumbs.includes(dep.id)) return; // prevent inf loop
                propagate_init(crumbs.concat(_.compact([dep.id])), dep.output_stream);
            });
        })([input.id], input);
    });

    // collection output template
    // TODO: fix to account for hierarchical indicators
    //this.output_template = _.fromPairs(_.map(this.indicators, (ind, key) => [key, ind.output_template]));

    this.start = cb => _.isFunction(cb) && cb();

    return this;

    // ========================================================================

    // define a new indicator for collection
    function define_indicator(key, jsnc_ind) {
        if (_.get(coll.indicators, key)) throw new Error('Item "' + key + '" is already defined in collection');

        var ind;
        var opt = key.split('?');
        var sup = key.split('~');

        if (opt.length > 1 && _.last(sup) === '') {
            key = sup[0];
        }

        ind = this.create_indicator(jsnc_ind);

        if (sup.length > 1 && sup[0] === '') {
            ind.suppress = true;
            key = sup[1];
        }
        ind.output_stream.id = key;
        ind.output_name = key;
        _.set(coll.indicators, key, ind);

        ind.input_streams.filter(inp => inp instanceof Deferred).forEach(def => link_deferred.call(this, ind, def));

        return ind;
    }

    // create an indicator object based on JSONOC object: $Collection.$Timestep.Ind
    function create_indicator(jsnc_ind) {

        var ind;
            let inputs = _.isArray(jsnc_ind.inputs) ? jsnc_ind.inputs : [jsnc_ind.inputs];
            ind = new IndicatorInstance(jsnc_ind, this.resolve_sources(inputs));
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

        ind.options = jsnc_ind.options;

        _.each(ind.input_streams, (input, idx) => {
            if (input instanceof Deferred) {
                input.dependent = jsnc_ind.id;
                input.indicator = ind;
                input.index = idx;
                input.tstep = jsnc_ind.tstep;
            } else if (idx === 0) {
                if (!_.has(input.root, 'dependents')) input.root.dependents = [];
                input.root.dependents.push(ind);
            }
        });

        return ind;
    }

    // post-initialization: set up tstep differential and set up update event propagation
    function prepare_indicator(ind) {

        ind.indicator.initialize.apply(ind.context, [ind.params, ind.input_streams, ind.output_stream]);

        // Apply timestep differential to indicator if it is defined under a different timestep than its first source
        var source_tstep = ind.input_streams[0].tstep;
        var target_tstep = ind.output_stream.tstep;
        if (target_tstep && target_tstep !== source_tstep && !_.has(ind.input_streams[0], 'apply_tstep_diff')) throw new Error('Sources from a different timestep must explicitly define a timestep access prefix (<- or ==)');
        if (target_tstep && target_tstep !== source_tstep && ind.input_streams[0].apply_tstep_diff) {
            // sanity checks
            if (!_.has(tsconfig.defs, target_tstep)) throw new Error('Unknown timestep: ' + target_tstep);
            if (!source_tstep) {
                throw new Error('First input stream of indicator must define a timestep for differential');
            }
            if (!_.has(tsconfig.defs, source_tstep)) throw new Error('Unknown timestep: ' + source_tstep);

            ind.tstep_differential = tsconfig.differential(ind.input_streams, target_tstep);
        } else if (target_tstep === source_tstep && ind.input_streams[0].apply_tstep_diff) {
            throw new Error('Timestep differentials can only be applied to a source from a different timestep');
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
            return srcs.map(this.resolve_src).reduce((memo, i) => memo.concat(i), []);
        } else if (_.isString(srcs)) {
            return _.map(srcs.split(','), subsrc => this.resolve_src(subsrc.trim()));
        } else if (jt.instance_of(srcs, '$Collection.$Timestep.SrcType')) { // if nested indicator
            return this.resolve_src(srcs);
        } else if (_.isEmpty(srcs)) {
            return [];
        } else {
            throw new Error('Unexpected type given for "sources": ' + JSON.stringify(srcs));
        }
    }

    // Expects and interprets a single stream source
    function resolve_src(src) {
        var stream;
        let subind, i;
        if (jt.instance_of(src, '$Collection.$Timestep.Source')) { // if source stream reference
            return this.resolve_src(_.isArray(src) ? src.inputs.join('.') : src.inputs);
        } else if (jt.instance_of(src, '$Collection.$Timestep.Import')) { // if import constr
            subind = create_indicator.call(coll, jt.create('$Collection.$Timestep.Ind', src.inputs));
            subind.output_stream.set_type(subind.input_streams[0].type);
            if (src.options && src.options.tstep_diff) subind.output_stream.apply_tstep_diff = true;
            return subind.output_stream;
        } else if (jt.instance_of(src, '$Collection.$Timestep.Ind')) { // if nested indicator
            subind = create_indicator.call(coll, src);
            subind.input_streams.filter(inp => inp instanceof Deferred).forEach(def => link_deferred.call(this, subind, def));
            stream = subind.output_stream;
            if (src.options.sub) stream = (_.isArray(src.options.sub) ? src.options.sub : [src.options.sub]).reduce((str, key) => str.substream(key), stream);
            if (src.options.apply_tstep_diff) stream.apply_tstep_diff = true;
            return stream;
        } else if (_.isArray(src)) { // assume indicator definition if array
            let jsnc_ind = jt.create('$Collection.$Timestep.Ind', src);
            subind = create_indicator.call(coll, jsnc_ind);
            subind.input_streams.filter(inp => inp instanceof Deferred).forEach(def => link_deferred.call(this, subind, def));
            stream = subind.output_stream;
            if (jsnc_ind.options.sub) stream = (_.isArray(jsnc_ind.options.sub) ? jsnc_ind.options.sub : [jsnc_ind.options.sub]).reduce((str, key) => str.substream(key), stream);
            return stream;
        } else if (src instanceof Stream || _.isObject(src) && _.isFunction(src.get)) {
            return src; // src is already a stream
        } else if (_.isString(src)) {
            let props;
            [src, props] = extract_src_props(src);
            let full_path = src.split('.');
            let src_path, sub_path, target;
            for (i = 0; i <= full_path.length - 1; i++) {
                src_path = full_path.slice(0, i + 1);
                sub_path = full_path.slice(i + 1);
                // check if src is an input
                target = _.get(coll.input_streams, src_path.join('.'));
                if (target && jt.instance_of(target, '$Collection.$Timestep.Input')) {
                    if (!target.stream) throw new Error('A stream has not be defined for input: ' + src_path.join('.'));
                    stream = target.stream;
                    break;
                }
                // check if src is an indicator already defined
                target = _.get(coll.indicators, src_path.join('.'));
                if (target && target instanceof IndicatorInstance) {
                    stream = target.output_stream;
                    break;
                }
                // check if src is an indicator not yet defined
                target = _.get(coll.config.indicators, src_path.join('.'));
                if (target && jt.instance_of(target, '$Collection.$Timestep.SrcType')) {
                    stream = Deferred({
                        src: src_path,
                        sub: sub_path
                    });
                    break;
                }
            }
            if (!stream) throw Error('Unrecognized stream source: ' + src);
            // follow substream path if applicable
            if (!(stream instanceof Deferred) && sub_path.length > 0) {
                stream = sub_path.reduce((str, key) => str.substream(key), stream);
            }
            // substitute symbolic markers for corresp. jsonoc constructor
            if (_.has(props, 'apply_tstep_diff')) {
                let opts = jt.create('Opt', [{tstep_diff: props.apply_tstep_diff}]);
                let imp_jsnc = jt.create('$Collection.$Timestep.Import', [stream, opts]);
                stream = this.resolve_src(imp_jsnc);
            }
            return stream;
        } else if (src instanceof Deferred) {
            return src;
        } else {
            throw new Error('Unexpected source defined for indicator: ' + JSON.stringify(src));
        }
    }

    // add deferred to deferred_defs lookup table
    function link_deferred(provider, deferred) {
        let target = this.deferred_defs.get(provider);
        if (!_.isEmpty(target)) {
            target.push(deferred);
        } else {
            this.deferred_defs.set(provider, [deferred]);
        }
    }

    function extract_src_props(src) {
        var newsrc = src;
        var props = {};
        let match = src.match(/^([^a-z]*)([a-z].*)/i);
        if (match) {
            newsrc = match[2];
            if (match[1] === '<-') props.apply_tstep_diff = true;
            if (match[1] === '==') props.apply_tstep_diff = false;
        }
        return [newsrc, props];
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
    _.each(coll.indicators, (ind, key) => newcol.indicators[key] = ind);
    newcol.start = cb => coll.start(cb);
    return newcol;
};

return Collection;

});
