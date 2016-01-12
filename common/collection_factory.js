'use strict';

var dataprovider; // must be set explicitly by caller

define(['require', 'lodash', 'async', 'd3', 'stream', 'indicator_collection', 'jsonoc'], function(requirejs, _, async, d3, Stream, IndicatorCollection, jsonoc) {

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
                return 'indicators/' + obj.name.replace(':', '/');
            } else if (_.isArray(obj) || _.isObject(obj) && !_.isString(obj)) {
                return _.map(obj, get_ind);
            } else {
                return [];
            }
        })));
        requirejs(dependencies, function() {
            _.assign(jsnc.vars, config.vars);
            var input_streams = _.object(_.map(jsnc.inputs, function(inp, id) {
                var istream = create_input_stream(dpclient, config, jsnc.vars, inp, callback);
                istream.id = 'inp:' + id;
                istream.type = inp.type;
                istream.tstep = inp.tstep;
                return [id, istream];
            }));
            // Resolve var refs within indicators
            jsnc.indicators = _.object(_.map(_.pairs(jsnc.indicators), function(ind) {
                return [ind[0], ind[1]._resolve(config.vars)];
            }));
            var collection = new IndicatorCollection(jsnc, input_streams);
            collection.dpclient = dpclient;
            callback(null, collection);
        });
    }

    function create_input_stream(dpclient, config, vars, input, callback) {
        input = input._resolve(vars);
        var stream = new Stream(100, 'inp:' + input.id || '[' + input.type + ']');
        // Config passed in has priority
        var input_config = _.assign({}, input, config);
        stream.instrument = input_config.instrument;
        input_config.timeframe = input.tstep;
        async.series([
            //
            function(cb) {
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
                    stream.next();
                    stream.set(pkt.data);
                    stream.emit('update', {timeframes: [input_config.timeframe]});
                });
                conn.on('end', function() {
                    cb();
                });
            },
            //
            function(cb) {
                if (config.subscribe) {
                    var conn = dpclient.connect('subscribe', input_config);
                    conn.on('data', function(pkt) {
                        stream.next();
                        stream.set(pkt.data);
                        stream.emit('update', {timeframes: [config.timeframe]});
                    });
                } else {
                    cb();
                }
            }
        ], function(err) {
            if (err) callback(err); // use callback to propagate errors only
        });
        return stream;
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
