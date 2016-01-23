'use strict';

var dataprovider; // must be set explicitly by caller

define(['require', 'lodash', 'async', 'd3', 'config/instruments', 'config/timesteps', 'stream', 'indicator_collection', 'jsonoc'], function(requirejs, _, async, d3, instruments, tsconfig, Stream, IndicatorCollection, jsonoc) {

    var jsonoc_parse = jsonoc.get_parser();

    function create(collection_path, config, callback) {
        if (!collection_path) return callback('No indicator collection is defined, or is not a string');

        if (_.isString(collection_path)) {
            dataprovider.load_resource('collections/' + collection_path + '.js', function(err, jsonoc_payload) {
                if (err) return callback(err);
                try {
                    var jsonoc = jsonoc_parse(jsonoc_payload.toString());
                    config.collection_path = collection_path;
                    load_collection(jsonoc, config, function(err, collection) {
                        if (err) return callback(err);
                        callback(null, collection);
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
        // ensure all modules that correspond with every indicator are preloaded
        var dependencies = _.unique(_.flattenDeep(_.map(jsnc, function get_ind(obj) {
            if (jsonoc.instance_of(obj, '$Collection.$Timestep.Ind') && _.isString(obj.name)) {
                return ['indicators/' + obj.name.replace(':', '/')].concat(obj.src.map(get_ind));
            } else if (_.isArray(obj) || _.isObject(obj) && !_.isString(obj)) {
                return _.map(obj, get_ind);
            } else {
                return [];
            }
        })));
        requirejs(dependencies, function() {
            _.assign(jsnc.vars, config.vars);
            var inputs = _.map(jsnc.inputs, function(inp, id) {
                inp = inp._resolve(config.vars);
                inp.id = id;
                inp.stream = new Stream(inp.options.buffersize || 100, 'input:' + inp.id || '[' + inp.type + ']');
                inp.stream.type = inp.type;
                inp.stream.tstep = inp.tstep;
                var instr = config.instrument || inp.instrument;
                if (!_.has(instruments, instr)) throw new Error('Unrecognized instrument: ' + instr);
                inp.stream.instrument = instruments[instr];
                if (_.has(tsconfig.defs, inp.tstep)) inp.tstepconf = tsconfig.defs[inp.tstep];
                return inp;
            });

            var input_streams = _.object(_.map(inputs, function(inp) {
                return [inp.id, inp.stream];
            }));

            // resolve var refs within indicators
            jsnc.indicators = _.object(_.map(_.pairs(jsnc.indicators), function(ind) {
                return [ind[0], ind[1]._resolve(config.vars)];
            }));
            var collection = new IndicatorCollection(jsnc, input_streams);
            collection.dpclient = dpclient;

            // sort from higher to lower timestep unit_size
            var sorted = _.sortBy(inputs, function(inp) {
                return inp.tstepconf.unit_size ? -inp.tstepconf.unit_size : 0;
            });

            // function to trigger start of input feeds
            collection.start = function(callback) {
                // get historical and subscribe to data
                async.eachSeries(sorted, function(input, cb) {

                    // config param has priority over input config
                    var input_config = _.assign({}, input, config);
                    async.series([
                        // get historical data if applicable
                        function(cb) {
                            if (input.tstep === 'T') return cb();
                            var conn;
                            if (config.range) {
                                if (_.isObject(input_config.range) && !_.isArray(input_config.range)) {
                                    input_config.range = input_config.range[input.tstep];
                                }
                                conn = dpclient.connect('get_range', input_config);
                            } else if (config.count) {
                                if (_.isObject(input_config.count) && !_.isArray(input_config.range)) {
                                    input_config.count = input_config.count[input.tstep];
                                }
                                conn = dpclient.connect('get_last_period', input_config);
                            } else {
                                conn = dpclient.connect('get', input_config);
                            }
                            conn.on('data', function(pkt) {
                                input.stream.next();
                                input.stream.set(pkt.data);
                                input.stream.emit('update', {modified: [input.stream.current_index()], tsteps: [input.tstep]});
                            });
                            conn.on('error', cb);
                            conn.on('end', function() {
                                cb();
                            });
                        },
                        // subscribe to stream data if applicable
                        function(cb) {
                            if (config.subscribe && input.options.subscribe) {
                                var conn = dpclient.connect('subscribe', input_config);
                                conn.on('data', function(pkt) {
                                    input.stream.next();
                                    input.stream.set(pkt.data);
                                    input.stream.emit('update', {modified: [input.stream.current_index()], tsteps: [input.tstep]});
                                });
                                conn.on('error', cb);
                            }
                            cb();
                        }
                    ], cb);
                }, function(err) {
                    callback(err, collection);
                });

            }; // collection.start

            callback(null, collection);
        });
    }

    return {
        create: create,
        is_collection: is_collection,
        set_dataprovider: function(dp) {
            dataprovider = dp;
        },
        get_dataprovider: function() {
            return dataprovider;
        }
    };

});
