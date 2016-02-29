'use strict';

// A `Deferred` object is used as a placeholder for another object when there is insufficient information available to
// create the instance of that object.  The `Deferred` object collects necessary information along the way which is later
// used to create and initialize the final true object that will replace the `Deferred` object.

define(['lodash'], function(_) {

    function Deferred(obj) {
        if (!(this instanceof Deferred)) return Deferred.apply(Object.create(Deferred.prototype), arguments);
        var self = this;
        if (obj) {
            if (!_.isObject(obj)) throw new Error('Deferred constructor accepts single argument of type Object');
            _.each(obj, function(val, key) {
                self[key] = val;
            });
        }
        return self;
    }

    return Deferred;
});
