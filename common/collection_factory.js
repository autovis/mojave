'use strict';

var dataprovider; // must be set explicitly by caller
var datasources;  // populated after dataprovider is set

define(['require', 'lodash', 'async', 'd3', 'node-uuid', 'config/instruments', 'config/timesteps', 'stream', 'indicator_collection', 'jsonoc'],
    function(requirejs, _, async, d3, uuid, instruments, tsconfig, Stream, IndicatorCollection, jsonoc) {

    var jsonoc_parse = jsonoc.get_parser();

    function create(collection_path, config, callback) {
        if (!collection_path) return callback('No indicator collection is defined, or is not a string');

        if (_.isString(collection_path)) {
            dataprovider.load_resource('collections/' + collection_path + '.js', function(err, jsonoc_payload) {
                if (err) return callback(err);
                try {
                    var jsnc = jsonoc_parse(jsonoc_payload.toString());
                    config.collection_path = collection_path;
                    _.assign(jsnc.vars, config.vars);

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

                        // resolve var refs within indicators
                        jsnc.indicators = _.fromPairs(_.map(_.toPairs(jsnc.indicators), ind => [ind[0], ind[1]._resolve(config.vars)]));

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

    //
    function load_collection(jsnc, config, callback) {
        if (!dataprovider) throw new Error('Dataprovider must be set using "set_dataprovider()" method');
        // create client on dataprovider
        var dpclient = dataprovider.register(config.collection_path);

        var inputs = _.map(jsnc.inputs, function(inp, id) {
            inp = inp._resolve(config.vars);
            inp.id = id;
            inp.stream = new Stream(inp.options.buffersize || 100, 'input:' + inp.id || '[' + inp.type + ']', {
                type: inp.type,
                instrument: config.instrument || inp.instrument,
                tstep: inp.tstep
            });
            if (_.has(tsconfig.defs, inp.tstep)) inp.tstepconf = tsconfig.defs[inp.tstep];
            return inp;
        });

        var input_streams = _.fromPairs(_.map(inputs, inp => [inp.id, inp.stream]));

        var collection = new IndicatorCollection(jsnc, input_streams);
        collection.dpclient = dpclient;

        // function to trigger start of input feeds, to be called after all event listeners are in place
        collection.start = function(callback) {

            async.each(_.isArray(config.source) ? config.source : [config.source], function(src, cb) {
                var srcpath = src.split('/');
                var src_properties = datasources[srcpath[0]];
                async.each(_.isArray(config.instrument) ? config.instrument : [config.instrument], function(instr, cb) {

                    // filter on inputs that match current source and instrument
                    var subinputs = _.filter(inputs, function(inp) {
                        return (!inp.source || src === inp.source) && (!inp.instrument || instr === inp.instrument);
                    });

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
                        ['_args', '_resolve', 'setup', 'stream', 'tstepconf', 'container', 'options'].forEach(x => delete conn_config[x]);

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
                                    input.stream.emit('update', {modified: [input.stream.current_index()], tsteps: [input.tstep]});
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
