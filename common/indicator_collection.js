define(['lodash', 'indicator_instance', 'config/timesteps', 'stream', 'jsonoc_tools', 'deferred'],
    function(_, IndicatorInstance, tsconfig, Stream, jt, Deferred) {

function Collection(jsnc, in_streams) {
	if (!(this instanceof Collection)) return Collection.apply(Object.create(Collection.prototype), arguments);

    this.config = jsnc;
    this.input_streams = in_streams;

    // define and construct indicators
    this.indicators = {};

    // Add all inputs as identity indicators
    // TODO: Use 'interpreter' indicator when specified in JSONOC
    _.each(this.input_streams, function(str, key) {
        var ind = IndicatorInstance(jt.create('$Collection.$Timestep.Ind', [null]), [str]);
        ind.id = key;
        ind.output_stream.id = key;
        ind.output_name = key;
        ind.output_stream.tstep = str.tstep;
        prepare_indicator(ind);
        this.indicators[key] = ind;
    }, this);

    var deferred_defs = {}; // track any dependencies not yet defined to be injected later
    _.each(jsnc.indicators, function(jsnc_ind, key) {
        var ind = define_indicator.call(this, key, jsnc_ind);
        // check indicator inputs for sources that are deferred and track them
        _.each(ind.input_streams, function(input) {
            if (jt.instance_of(input, '$Collection.$Timestep.Src')) {
                var src = input.deferred.src;
                if (!_.has(deferred_defs, src)) deferred_defs[src] = [];
                deferred_defs[src].push(input);
            }
        }, this);
    }, this);

    // iterate over sources with deferred inputs and substitute them with actual input source
    var inds_deferred_inps = [];
    _.each(deferred_defs, function(deferred_list, src) {
        _.each(deferred_list, function(inp) {
            if (!_.has(this.indicators, src)) throw new Error("Indicator '" + src + "' is not defined in collection");
            var input = inp.deferred.sub.reduce(function(str, key) {return str.substream(key);}, this.indicators[src].output_stream);
            inp.deferred.indicator.input_streams[inp.index] = input;
            inds_deferred_inps.push(inp.deferred.indicator);
        }, this);
    }, this);

    // initialize and prepare indicators that had deferred inputs
    _.each(_.uniq(inds_deferred_inps), function(ind) {
        ind.indicator.initialize.apply(ind.context, [ind.params, ind.input_streams, ind.output_stream]);
        prepare_indicator(ind);
    });

    // collection output template
    this.output_template = _.object(_.map(this.indicators, function(ind, key) {
        return [key, ind.output_template];
    }));

    this.create_indicator = create_indicator.bind(this);
    this.define_indicator = define_indicator.bind(this);

    return this;

    // ========================================================================

    // define a new indicator for collection
    function define_indicator(key, jsnc_ind) {

        var ind;
        var collection = this;
        var optional = false;
        var opt = key.split('?');
        var sup = key.split('~');

        if (opt.length > 1 && _.last(sup) === '') {
            key = sup[0];
            optional = true;
        }
        try {
            ind = create_indicator.call(collection, jsnc_ind);
        } catch (e) {
            if (optional) return; // if indicator is optional, any exceptions thrown will be ignored and indicator is skipped
            else {
                // prefix error message with origin info
                e.message = "In indicator '" + key + "' (" + jsnc_ind.name + '): ' + e.message;
                throw e;
            }
        }
        if (sup.length > 1 && sup[0] === '') {
            ind.suppress = true;
            key = sup[1];
        }
        ind.output_stream.id = key;
        ind.output_name = key;
        collection.indicators[key] = ind;

        return ind;
    }

    // create an indicator object based on JSONOC object: $Collection.$Timestep.Ind
    function create_indicator(jsnc_ind) {

        var collection = this;

        var ind = new IndicatorInstance(jsnc_ind, process_input(jsnc_ind.src));

        ind.options = jsnc_ind.options;

        _.each(ind.input_streams, function(input, idx) {
            if (jt.instance_of(input, '$Collection.$Timestep.Src') && _.isObject(input.deferred)) {
                input.deferred.indicator = ind;
                input.deferred.index = idx;
            }
        });

        // takes indicator source and returns array of streams
        function process_input(src) {
            if (jt.instance_of(src, '$Collection.$Timestep.Src')) { // if nested indicator
                var subind = create_indicator.call(collection, src);
                var stream = subind.output_stream;
                if (src.options.sub) stream = (_.isArray(src.options.sub) ? src.options.sub : [src.options.sub]).reduce(function(str, key) {return str.substream(key);}, stream);
                return stream;
            } else if (_.isArray(src)) {
                return src.map(process_input).reduce(function(memo, i) {return memo.concat(i);}, []);
            } else if (_.isString(src)) {
                return _.map(src.split(','), function(subsrc) {
                    var src_path = subsrc.split('.');
                    var stream = null;
                    if (src_path[0] === '$') { // use collection output (not a stream)
                        stream = collection.indicators;
                    } else if (collection.input_streams[src_path[0]]) { // collection input stream id
                        stream = collection.input_streams[src_path[0]];
                    } else if (collection.indicators[src_path[0]]) { // indicator already defined
                        stream = collection.indicators[src_path[0]].output_stream;
                    } else if (collection.config.indicators[src_path[0]]) { // indicator not yet defined
                        stream = collection.config.indicators[src_path[0]];
                        stream.deferred = {src: _.first(src_path), sub: _.rest(src_path)};
                    }
                    if (!stream) throw Error('Unrecognized indicator source: ' + src_path[0]);
                    // follow substream path if applicable
                    if (!(jt.instance_of(stream, '$Collection.$Timestep.Src') && stream.deferred) && src_path.length > 1)
                        stream = _.rest(src_path).reduce(function(str, key) {return str.substream(key);}, stream);
                    return stream;
                });
            } else {
                throw new Error('Unexpected source defined for indicator: ' + JSON.stringify(src));
            }
        }

        if (!_.any(ind.input_streams, function(str) {return jt.instance_of(str, '$Collection.$Timestep.Src') && str.deferred;})) {
            prepare_indicator(ind);
        }

        return ind;

    } // create_indicator()

    // post-initialization: define instrument, set up timeframe differential, set up update event propagation
    function prepare_indicator(ind) {

        // Output stream instrument defaults to that of first input stream
        if (ind.input_streams[0].instrument) ind.output_stream.instrument = ind.input_streams[0].instrument;

        // Apply timestep differential to indicator if it is defined under a different timestep than its first source
        var source_tstep = ind.input_streams[0].tstep;
        var target_tstep = ind.jsnc.tstep;
        if (target_tstep && target_tstep !== source_tstep) {
            // sanity checks
            if (!_.has(tsconfig.defs, target_tstep)) throw new Error('Unknown timestep: ' + target_tstep);
            if (!source_tstep) {
                throw new Error('First input stream of indicator must define a timestep for differential');
            }
            if (!_.has(tsconfig.defs, source_tstep)) throw new Error('Unknown timestep: ' + source_tstep);

            ind.tstep_differential = tsconfig.differential(ind.input_streams, target_tstep);
            ind.output_stream.tstep = target_tstep; // overrides default value set at indicators' constructor (input_streams[0].tstep)
        }

        // Propagate update events down to output stream -- wait to receive update events
        // from synchronized input streams before firing with unique concat of their timeframes
        if (ind.synch === undefined) { // set a default if stream event synchronization is not defined
            ind.synch = _.map(ind.input_streams, function(str, idx) {
                // first stream is synchronized with all others of same instrument and tf, rest are passive
                return (idx === 0 || (str instanceof Stream && _.isObject(ind.input_streams[0].instrument) && _.isObject(str.instrument) &&
                    ind.input_streams[0].instrument.id === str.instrument.id && ind.input_streams[0].tf === str.tf)) ? 's0' : 'p';
            });
        }

        var synch_groups = {};
        _.each(ind.input_streams, function(stream, idx) {
            var key;
            if (!(stream instanceof Stream) || _.first(ind.synch[idx]) === 'p' || ind.synch[idx] === undefined) {
                return; // passive - ignore update events
            } else if (_.first(ind.synch[idx]) === 's') {
                key = ind.synch[idx]; // synchronized - buffer events received across group
            } else if (_.first(ind.synch[idx]) === 'a' || _.first(ind.synch[idx]) === 'b') {
                key = ind.synch[idx] + ':' + idx; // active - propagate all update events immediately
            } else {
                throw new Error('Unrecognized synchronization token: ' + ind.synch[idx]);
            }
            if (!_.has(synch_groups, key)) synch_groups[key] = {};
            synch_groups[key][idx] = null;

            stream.on('update', function(event) {
                // if synch type 'b' then do not propagate timeframes to create new bars
                synch_groups[key][idx] = event && _.first(key) !== 'b' && event.timeframes || [];
                if (_.all(_.values(synch_groups[key]))) {
                    ind.update(_.unique(_.flattenDeep(_.values(synch_groups[key]))), idx);
                    _.each(synch_groups[key], function(val, idx) {synch_groups[key][idx] = null;});
                }
            });
        });

    } // prepare_indicator()

}

Collection.prototype = {

	constructor: Collection,

    get_fieldmap: function() {
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
    },

    clone: function() {
        var newcol = new Collection({}, this.in_streams);
        _.each(this.indicators, function(ind, key) {
            newcol.indicators[key] = ind;
        });
        return newcol;
    }

};

return Collection;

});
