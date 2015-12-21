'use strict';

var dataprovider; // must be set explicitly by caller

define(['lodash', 'd3', 'stream', 'indicator_collection', 'jsonoc'], function(_, d3, Stream, IndicatorCollection, jsonoc) {

    var jsonoc_parse = jsonoc.get_parser();

    function create(collection_path, config, callback) {
        if (!collection_path) return callback('No indicator collection is defined, or is not a string');

        if (_.isString(collection_path)) {
            dataprovider.load_resource('collections/' + collection_path + '.js', function(err, jsonoc_payload) {
                if (err) return callback(err);
                try {
                    var jsonoc = jsonoc_parse(jsonoc_payload.toString());
                    console.log('jsonoc', jsonoc);
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
            if (jsonoc.instance_of(obj, '$Collection.$Timestep.Ind')) {
                return 'indicators/' + obj.name.replace(':', '/');
            } else if (_.isArray(obj) || _.isObject(obj) && !_.isString(obj)) {
                return _.map(obj, get_ind);
            } else {
                return [];
            }
        })));
        requirejs(dependencies, function() {
            var input_streams = _.object(_.map(jsnc.inputs, function(inp, id) {
                return [id, create_input_stream(dpclient, config, inp)];
            }));
            console.log('inputs_streams:', input_streams);
            var collection = new IndicatorCollection(jsnc, input_streams);
            collection.dpclient = dpclient;
            callback(null, collection);
        });
    }

    function create_input_stream(dpclient, config, input) {
        var stream = new Stream(100, 'inp:' + input.id);
        // Config passed in has priority
        var input_config = _.assign({}, input, config);
        var conn;
        if (config.range) {
            conn = dpclient.connect('get_range', config);
        } else if (config.count) {
            conn = dpclient.connect('get_last_period', config);
        } else {
            conn = dpclient.connect('get', config);
        }
        conn.on('data', function(pkt) {
            console.log('packet:', pkt);
            stream.next();
            stream.set(pkt.data);
            stream.emit('update', {timeframes: [config.timeframe]});
        });
        conn.on('end', function() {
            console.log('END.');
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
