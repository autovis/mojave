define(['underscore', 'indicator_instance', 'config/timeframes', 'stream', 'deferred', 'config/stream_types'],
    function(_, IndicatorInstance, tfconfig, Stream, Deferred, stream_types) {

function Collection(defs, in_streams) {
	if (!(this instanceof Collection)) return Collection.apply(Object.create(Collection.prototype), arguments);

    this.definitions = defs;
    this.input_streams = in_streams;

    // input stream lookup table by id
    var input_by_id = _.object(_.map(this.input_streams, function(val, key) {
        return [val.id, val];
    }));

    // define and construct indicators
    this.indicators = {};
    var deferred_defs = {}; // track any dependencies not yet defined to be injected later
    _.each(this.definitions, function(val, key) {
        var ind = define_indicator.call(this, key, val);
        // search for deferred objects and track them
        _.each(ind.input_streams, function(input) {
            if (input instanceof Deferred) {
                if (!_.has(deferred_defs, input.src)) deferred_defs[input.src] = [];
                deferred_defs[input.src].push(input);
            }
        }, this);
    }, this);

    var inds_deferred_inps = [];
    // iterate over deferred_defs and inject respective stream input sources
    _.each(deferred_defs, function(deferred_list, src) {
        _.each(deferred_list, function(def) {
            if (!_.has(this.indicators, src)) throw new Error("Indicator '" + src + "' is not defined in collection");
            var input = def.sub.reduce(function(str, key) {return str.substream(key)}, this.indicators[src].output_stream);
            def.indicator.input_streams[def.index] = input;
            inds_deferred_inps.push(def.indicator);
        }, this);
    }, this);

    // initialize indicators that had deferred inputs
    _.each(_.uniq(inds_deferred_inps), function(ind) {
        ind.indicator.initialize.apply(ind.context, [ind.params, ind.input_streams, ind.output_stream]);
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
    function define_indicator(key, def) {

        var collection = this;
        var optional = false;
        var opt = key.split("?");

        if (opt.length > 1 && _.last(sup) === "") {
            key = sup[0];
            optional = true;
        }
        try {
            var ind = create_indicator.call(collection, def);
        } catch (e) {
            if (optional) return; // if indicator is optional, any exceptions it throws ignore and leave it out
            else throw(e);
        }
        var sup = key.split("~");
        if (sup.length > 1 && sup[0] === "") {
            ind.suppress = true;
            key = sup[1];
        }
        ind.output_stream.id = key;
        ind.output_name = key;
        collection.indicators[key] = ind;

        return ind;
    }

    // create an indicator object based on definition array: [<source>,<indicator>,<param1>,<param2>,...]
    function create_indicator(def) {

        var collection = this;
        var ind_input, ind_def, target_tf;

        // check if first element is object, assume indicator options
        var first = _.first(def);
        var options = {};
        if (_.isObject(first) && !_.isArray(first)) {
            options = first;
            ind_input = def[1];
            ind_def = def.slice(2);
        } else {
            ind_input = first;
            ind_def = _.rest(def);
        }
        // check whether indicator is marked for timeframe differential
        if (options.tf) target_tf = options.tf;

        if (ind_input === undefined) throw new Error("Indicator must define at least one input");
        var ind = new IndicatorInstance(ind_def, process_input(ind_input));

        _.each(ind.input_streams, function(input, idx) {
            if (input instanceof Deferred) {
                input.indicator = ind;
                input.index = idx;
            }
        });

        // takes indicator source and returns array of streams
        function process_input(input) {
            if (_.isArray(input)) {
                if (_.first(input) === "$xs") { // array of inputs
                    return input.slice(1).map(process_input).reduce(function(memo, i) {return memo.concat(i)}, []);
                } else { // nested indicator
                    var subind = create_indicator.call(collection, input);
                    subind.output_stream.id = "["+subind.name+"]";
                    var stream = subind.output_stream;
                    // option to output a substream
                    if (options.sub) stream = (_.isArray(options.sub) ? options.sub : [options.sub]).reduce(function(str, key) {return str.substream(key)}, stream);
                    return stream;
                }
            } else { // else assume comma-delimited list of (streams or previously defined indicators)
                var inputs = _.map(input.split(","), function(src) {
                    var src_path = src.split(/\./);
                    var stream = null;
                    if (src_path[0]=="$") { // use collection output (not a stream)
                        stream = collection.indicators;
                    } else if (_.isFinite(src_path[0])) { // collection input stream index
                        stream = collection.input_streams[src_path[0]];
                    } else if (input_by_id[src_path[0]]) { // collection input stream id
                        stream = input_by_id[src_path[0]];
                    } else if (collection.indicators[src_path[0]]) { // indicator already defined
                        stream = collection.indicators[src_path[0]].output_stream;
                    } else if (collection.definitions[src_path[0]]) { // indicator not yet defined
                        stream = new Deferred({
                            src: _.first(src_path),
                            sub: _.rest(src_path)
                        });
                    }
                    if (!stream) throw Error("Unrecognized indicator source: "+src_path[0]);
                    // follow substream path if applicable
                    if (!(stream instanceof Deferred) && src_path.length > 1)
                        stream = _.rest(src_path).reduce(function(str, key) {return str.substream(key)}, stream);

                    return stream;
                });
                return inputs;
            }
        }

        // Output stream instrument defaults to that of first input stream
        if (ind.input_streams[0].instrument) ind.output_stream.instrument = ind.input_streams[0].instrument;


        // Apply timeframe differential to indicator if marked in collection
        if (target_tf) {
            var source_tf = ind.input_streams[0].tf;
            // sanity checks
            if (!_.has(tfconfig.defs, target_tf)) throw new Error("Unknown timeframe: "+target_tf);
            if (!source_tf)
                throw new Error("First input stream of indicator must define a timeframe for differential");
            if (!_.has(tfconfig.defs, source_tf)) throw new Error("Unknown timeframe: "+source_tf);

            ind.tf_differential = tfconfig.differential(ind.input_streams, target_tf);
            ind.output_stream.tf = target_tf; // overrides default value set at indicators' constructor (input_streams[0].tf)
        }

        // Propagate update events down to output stream -- wait to receive update events
        // from synchronized input streams before firing with unique concat of their timeframes
        if (ind.synch === undefined) { // set a default if stream event synchronization is not defined
            ind.synch = _.map(ind.input_streams, function(str, idx) {
                // first stream is synchronized with all others of same instrument and tf, rest are passive
                return (idx === 0 || (str instanceof Stream && _.isObject(ind.input_streams[0].instrument) && _.isObject(str.instrument) &&
                    ind.input_streams[0].instrument.id === str.instrument.id && ind.input_streams[0].tf === str.tf)) ? "s0" : "p";
            });
        }

        var synch_groups = {};
        _.each(ind.input_streams, function(stream, idx) {
            var key;
            if (!(stream instanceof Stream) || _.first(ind.synch[idx]) === "p" || ind.synch[idx] === undefined) {
                return; // passive - ignore update events
            } else if (_.first(ind.synch[idx]) === "s") {
                key = ind.synch[idx]; // synchronized - buffer events received across group
            } else if (_.first(ind.synch[idx]) === "a") {
                key = ind.synch[idx] + ":" + idx; // active - propagate all update events immediately
            } else {
                throw new Error("Unrecognized synchronization token: "+ind.synch[idx]);
            }
            if (!_.has(synch_groups, key)) synch_groups[key] = {};
            synch_groups[key][idx] = null;

            stream.on("update", function(event) {
                synch_groups[key][idx] = event && event.timeframes || [];
                if (_.all(_.values(synch_groups[key]))) {
                    ind.update(_.unique(_.flatten(_.values(synch_groups[key]))), idx);
                    _.each(synch_groups[key], function(val, idx) {synch_groups[key][idx] = null});
                }
            });
        });

        return ind;

    } // create_indicator
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
        })

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
        var newcol = new Collection({}, in_streams);
        _.each(this.indicators, function(ind, key) {
            newcol.indicators[key] = ind;
        });
        return newcol;
    }

};

return Collection;

})
