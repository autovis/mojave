'use strict';

var dataprovider; // must be set explicitly by caller
var datasources;  // populated after dataprovider is set

define(['require', 'lodash', 'async', 'd3', 'node-uuid', 'config/instruments', 'config/timesteps', 'stream', 'indicator_collection', 'jsonoc', 'jsonoc_tools'],
    function(requirejs, _, async, d3, uuid, instruments, tsconfig, Stream, IndicatorCollection, jsonoc, jt) {

    const collection_config = {}; // immutable reference to config object used during JSONOC parsing
    var jsonoc_parse = jsonoc.get_parser(collection_config);

    function create(collection_path, config, callback) {
        if (!collection_path) return callback('No indicator collection is defined, or is not a string');

        if (_.isString(collection_path)) {
            dataprovider.load_resource('collections/' + collection_path + '.js', function(err, jsonoc_payload) {
                if (err) return callback(err);
                try {
                    // prepare collection_vars
                    _.each(collection_config, (v, k) => delete collection_config[k]);
                    _.each(config, (v, k) => collection_config[k] = v);
                    // parse payload
                    var jsnc = jsonoc_parse(jsonoc_payload.toString());
                    config.collection_path = collection_path;
                    // assign vars collected from parsing, overridding existing ones
                    _.assign(jsnc.vars, config.vars);
                    jsnc.debug = config.debug;

                    // ensure all modules that correspond with every indicator are preloaded
                    var dependencies = _.uniq(_.flattenDeep(_.map(jsnc, function get_ind(obj) {
                        if (jsonoc.instance_of(obj, '$Collection.$Timestep.Ind') && _.isString(obj.name)) {
                            return ['indicators/' + obj.name.replace(':', '/')].concat((obj.src || []).map(get_ind));
                        } else if (_.isArray(obj) || _.isObject(obj) && !_.isString(obj)) {
                            return _.map(obj, get_ind);
                        } else {
                            return [];
                        }
                    })));

                    requirejs(dependencies, function() {

                        if (config.input_streams) {
                            // input streams already provided
                            var collection = new IndicatorCollection(jsnc, config.input_streams);
                            callback(null, collection);
                        } else {
                            // create and initialize input streams from jsnc
                            load_collection(jsnc, config, function(err, collection) {
                                if (err) return callback(err);
                                callback(null, collection);
                            });
                        }
                    });

                } catch (err) {
                    return callback(err);
                }
            });
        } else {
            return callback(new Error("Unexpected type for 'collection_path' parameter"));
        }
    }

    function is_collection(coll) {
        return coll instanceof IndicatorCollection;
    }

    /////////////////////////////////////////////////////////////////////////////////////

    function load_collection(jsnc, config, callback) {
        if (!dataprovider) throw new Error('Dataprovider must be set using "set_dataprovider()" method');
        // create client on dataprovider
        var dpclient = dataprovider.register(config.collection_path);

        // create flattened reference map to input stream defs with long keys
        var input_streams_jsnc = _.fromPairs((function flatten_input_streams(obj, path) {
            return _.map(obj, (subobj, key) => {
                var inp = subobj;
                if (jt.instance_of(inp, '$Collection.$Timestep.Input')) {
                    inp.stream = new Stream(inp.options.buffersize || 100, 'input:' + inp.id || '[' + inp.type + ']', {
                        type: inp.type,
                        instrument: config.instrument || inp.instrument,
                        tstep: inp.tstep
                    });
                    if (_.has(tsconfig.defs, inp.tstep)) inp.tstepconf = tsconfig.defs[inp.tstep];
                    return [path.concat(key).join('.'), inp];
                } else {
                    return _.flatten(flatten_input_streams(inp, path.concat(key)));
                }
            });
        })(jsnc.inputs, []));

        // create reference map to streams themselves
        var input_streams = _.fromPairs(_.map(_.toPairs(input_streams_jsnc), pair => {
            return [pair[0], pair[1].stream];
        }));

        var collection = new IndicatorCollection(jsnc, input_streams);
        collection.dpclient = dpclient;

        // function to trigger start of input feeds, to be called after all event listeners are in place
        collection.start = function(callback) {

            async.each(_.isArray(config.source) ? config.source : [config.source], function(src, cb) {
                var srcpath = src.split('/');
                var src_properties = datasources[srcpath[0]];
                async.each(_.isArray(config.instrument) ? config.instrument : [config.instrument], function(instr, cb) {

                    // filter on inputs that match current source and instrument
                    var subinputs = _.fromPairs(_.filter(_.toPairs(input_streams_jsnc), pair => {
                        return (!pair[1].source || src === pair[1].source) && (!pair[1].instrument || instr === pair[1].instrument);
                    }));

                    // sort from higher to lower timestep unit_size
                    var sorted_inputs = _.sortBy(subinputs, inp => inp.tstepconf.unit_size ? -inp.tstepconf.unit_size : 0);

                    // get historical and subscribe to data
                    async.eachSeries(sorted_inputs, function(input, cb) {

                        // config param has priority over input config
                        var input_config = _.assign({}, input, config);

                        if (_.isObject(input_config.range) && !_.isArray(input_config.range)) {
                            input_config.range = input_config.range[input.id];
                        } else if (_.isObject(input_config.count) && !_.isArray(input_config.count)) {
                            input_config.count = input_config.count[input.id] || 0;
                        }

                        // Define custom dataprovider client config derived from input's config
                        var conn_config = _.assign({}, input_config, {
                            // overriding parameters
                            source: src,
                            instrument: instr,
                            interpreter: input.options.interpreter,
                            id: input_config.id
                        });
                        // remove irrelevant properties
                        ['_args', 'setup', 'stream', 'tstepconf', 'container', 'options'].forEach(x => delete conn_config[x]);

                        async.series([
                            // get historical data if applicable
                            function(cb) {
                                if (input.tstep === 'T') return cb();
                                var conn;
                                if (_.isArray(conn_config.range)) {
                                    conn = dpclient.connect('get_range', conn_config);
                                } else if (_.isNumber(conn_config.count)) {
                                    if (conn_config.count === 0) return cb();
                                    conn = dpclient.connect('get_last_period', conn_config);
                                } else {
                                    conn = dpclient.connect('get', conn_config);
                                }
                                input.stream.conn = conn;
                                conn.on('data', function(pkt) {
                                    input.stream.emit('next', input.stream.get(), input.stream.current_index());
                                    input.stream.next();
                                    input.stream.set(pkt.data);
                                    if (config.debug && console.groupCollapsed) console.groupCollapsed(input.stream.current_index(), input.id);
                                    input.stream.emit('update', {modified: [input.stream.current_index()], tsteps: [input.tstep]});
                                    if (config.debug && console.groupEnd) console.groupEnd();
                                });
                                conn.on('error', function(err) {
                                    collection.emit('error', err);
                                });
                                conn.on('end', function() {
                                    input.stream.conn = null;
                                    cb();
                                });
                            },
                            // subscribe to stream data if applicable
                            function(cb) {
                                if (config.subscribe && input.options.subscribe) {
                                    var conn = dpclient.connect('subscribe', conn_config);
                                    input.stream.conn = conn;
                                    conn.on('data', function(pkt) {
                                        input.stream.emit('next', input.stream.get(), input.stream.current_index());
                                        input.stream.next();
                                        input.stream.set(pkt.data);
                                        input.stream.emit('update', {modified: [input.stream.current_index()], tsteps: [input.tstep]});
                                    });
                                    conn.on('error', function(err) {
                                        collection.emit('error', err);
                                    });
                                }
                                cb();
                            }
                        ], cb); // async.series [historical, subscribe]

                    }, cb); // async.eachSeries sorted_inputs

                }, cb); // async.each instrument

            }, function(err) { // async.each source
                callback(err, collection);
            });

        }; // collection.start

        callback(null, collection);
    }

    return {
        create: create,
        is_collection: is_collection,
        set_dataprovider: function(dp) {
            dataprovider = dp;
            datasources = dataprovider.get_datasources(); // get supported datasources and their properties
        },
        get_dataprovider: function() {
            return dataprovider;
        }
    };

});
