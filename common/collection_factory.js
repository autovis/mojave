'use strict';

define(['lodash', 'dataprovider', 'd3', 'stream', 'indicator_collection'], function(_, dataprovider, d3, Stream, IndicatorCollection) {

    function create(collection_path, input_streams, config, callback) {
        if (!collection_path) return callback('No indicator collection is defined, or is not a string');
        var get_ind = function(o) {
            if (!_.isArray(o)) return null;
            if (_.first(o) === '$xs') {
                return o.slice(1).map(get_ind);
            } else if (_.isObject(o[0]) && !_.isArray(o[0])) {
                return [get_ind(o[1]), o[2]];
            } else {
                return [get_ind(o[0]), o[1]];
            }
        };

        if (_.isString(collection_path)) {
            requirejs(['collections/' + collection_path], function(ind_defs) {
                // ensure all dependency indicator modules are loaded
                var deps = _.unique(_.compact(_.flatten(_.map(ind_defs, function(def) {return get_ind(def)}), true)));
                deps = _.map(deps, function(dep) {return 'indicators/' + dep.replace(':', '/')});
                requirejs(deps, function() {
                    var collection = new IndicatorCollection(ind_defs, input_streams);
                    callback(null, collection);
                });
            });
        } else {
            return callback(new Error("Unexpected type for 'collection_path' parameter"));
        }
    }

    function is_collection(coll) {
        return coll instanceof IndicatorCollection;
    }

    return {
        create: create,
        is_collection: is_collection
    }

});