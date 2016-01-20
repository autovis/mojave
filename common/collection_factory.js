'use strict';

var dataprovider; // must be set explicitly by caller

define(['require', 'lodash', 'async', 'd3', 'config/instruments', 'stream', 'indicator_collection', 'jsonoc'], function(requirejs, _, async, d3, instruments, Stream, IndicatorCollection, jsonoc) {

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
            var input_streams = _.object(_.map(jsnc.inputs, function(inp, id) {
                inp = inp._resolve(config.vars);
                var istream = create_input_stream(dpclient, config, inp, callback);
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

    function create_input_stream(dpclient, config, input, callback) {
        var stream = new Stream(100, 'inp:' + input.id || '[' + input.type + ']');
        // Config passed in has priority
        var combined_config = _.assign({}, input, config);
        if (!_.has(instruments, combined_config.instrument)) throw new Error('Unknown instrument: ' + combined_config.instrument);
        stream.instrument = instruments[combined_config.instrument];
        combined_config.timeframe = input.tstep;
        async.series([
            //
            function(cb) {
                if (input.tstep === 'T') return cb();
                var conn;
                if (config.range) {
                    if (_.isObject(combined_config.range) && !_.isArray(combined_config.range)) {
                        combined_config.range = combined_config.range[input.tstep];
                    }
                    conn = dpclient.connect('get_range', combined_config);
                } else if (config.count) {
                    if (_.isObject(combined_config.count) && !_.isArray(combined_config.range)) {
                        combined_config.count = combined_config.count[input.tstep];
                    }
                    conn = dpclient.connect('get_last_period', combined_config);
                } else {
                    conn = dpclient.connect('get', combined_config);
                }
                conn.on('data', function(pkt) {
                    stream.next();
                    stream.set(pkt.data);
                    stream.emit('update', {modified: [stream.current_index()], tsteps: [input.tstep]});
                });
                conn.on('error', cb);
                conn.on('end', function() {
                    cb();
                });
            },
            //
            function(cb) {
                if (config.subscribe && input.options.subscribe) {
                    var conn = dpclient.connect('subscribe', combined_config);
                    conn.on('data', function(pkt) {
                        stream.next();
                        stream.set(pkt.data);
                        stream.emit('update', {modified: [stream.current_index()], tsteps: [input.tstep]});
                        console.log(pkt.data);
                    });
                    conn.on('error', cb);
                }
                cb();
            }
        ], function(err) {
            if (err) callback(err);
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
