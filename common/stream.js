'use strict';

define(['lodash', 'eventemitter2', 'config/stream_types', 'config/instruments'],
    function(_, EventEmitter2, stream_types, instruments) {

// constructors:
//   Stream(id, options?)
//   Stream(buffer_size, id, options?)

function Stream() {
    if (!(this instanceof Stream)) return Stream.apply(Object.create(Stream.prototype), arguments);

    var args = arguments;
    var buffer_size = 100;
    if (_.isNumber(_.head(args))) {
        buffer_size = _.head(args);
        if (!(buffer_size > 0)) throw new Error('buffer_size must be at least 1');
        args = _.drop(args);
    }
    this.id = args[0] || null;
    this.params = args[1] || {};
    this.buffer = new Array(buffer_size);
    this.index = -1;
    this.modified = new Set();
    this.path = [this.id];
    if (this.params.type) this.type = this.params.type; else this.type = stream_types.default_type;
    if (this.params.tstep) this.tstep = this.params.tstep;
    if (this.params.instrument) {
        if (!instruments[this.params.instrument]) throw new Error('Unknown instrument: ' + this.params.instrument);
        this.instrument = _.clone(instruments[this.params.instrument]);
        this.instrument.id = this.params.instrument;
    }
    if (this.params.source) this.source = this.params.source;
    this.fieldmap = stream_types.fieldmapOf(this.type);
    this.record_templater = stream_types.recordTemplateGenerator(this.fieldmap);
    this.setMaxListeners(32);
    this.root = this;
    return this;
}

Stream.super_ = EventEmitter2;

Stream.prototype = Object.create(EventEmitter2.prototype, {
    constructor: {
        value: Stream,
        enumerable: false,
        writable: true,
        configurable: true
    }
});

Stream.prototype.set_buffer_size = function(size) {
    if (!_.isEmpty(this.buffer)) throw new Error("Cannot call 'set_buffer_size' on stream after it has been used");
    if (!_.isFinite(size) || size < 1) throw new Error('Invalid buffer size: ' + size);
    this.buffer = new Array(size);
    return this;
};

/*
Stream.prototype.type = function(type) {
    if (!_.isEmpty(this.buffer)) throw new Error("Cannot call 'type' on stream after it has been used");
    this.type = type;
    this.fieldmap = stream_types.fieldmapOf(type);
    this.record_template = stream_types.recordTemplateGenerator(this.type);
    return this;
};
*/

Stream.prototype.next = function(tstep_set) {
    // if update already applied to this stream's timestep
    if (tstep_set === undefined || this.tstep === undefined || tstep_set.has(this.tstep)) {
        this.index += 1;
        this.buffer[this.current_index() % this.buffer.length] = this.record_templater();
    }
    this.modified.clear();
};

Stream.prototype.get = function(bars_ago) {
    bars_ago = !_.isUndefined(bars_ago) ? bars_ago : 0;
    if (bars_ago > this.buffer.length - 1)
        //throw new Error("bars_ago value bigger than stream size.");
        return null;
    return this.buffer[(this.current_index() - bars_ago) % this.buffer.length];
};

Stream.prototype.get_index = function(index) {
    return this.buffer[index % this.buffer.length];
};

Stream.prototype.current_index = function() {
    return this.index;
};

// only used by .simple()
Stream.prototype.sub = function(key, bars_ago) {
    bars_ago = bars_ago === undefined ? 0 : bars_ago;
    var bar = this.get(bars_ago);
    return bar ? bar[key] : undefined;
};

Stream.prototype.sub_index = function(key, index) {
    var bar = this.get_index(index);
    return bar ? bar[key] : undefined;
};
//

Stream.prototype.slice = function(begin, end) {
    var range;
    if (end === undefined) { // last number of bars is specified
        begin = _.isFinite(begin) ? Math.abs(begin) : 1;
        range = _.range(this.index - begin, this.index + 1);
    } else {  // start and end indexes are specified
        begin = _.isFinite(begin) ? Math.abs(begin) : this.index - this.buffer.length - 1;
        range = _.range(begin, _.isFinite(end) ? Math.abs(end) + 1 : this.index + 1);
    }
    return _.map(range, idx => this.get_index(idx));
};

// Returns a virtual stream that get/sets a subproperty of an object-based stream
Stream.prototype.substream = function(key) {

    var sublist = _.map(this.fieldmap, x => x[0]);
    if (!sublist.includes(key)) throw new Error(this.id + ": '" + key + "' is not a subfield of type '" + this.type + "'");

    var sup = this;
    var sub = Object.create(Stream.prototype);
    // Relay all events from root stream to this substream
    sup.onAny(value => sub.emit(this.event, value));
    sub.root = this.root || this;
    var node = _.find(sup.fieldmap, field => field[0] === key)[1];
    sub.type = node.type;
    sub.fieldmap = node.recurse || [];
    sub.id = this.id + '.' + key;
    sub.subpath = (this.subpath || []).concat(key);
    sub.path = _.initial(this.path).concat(_.last(this.path) + '.' + key);
    sub.tstep = this.tstep;
    sub.instrument = this.instrument;
    sub.params = this.params;
    sub.buffer = this.buffer;
    sub.is_sub = true;

    sub.get = function(bars_ago) {
        return this.subpath.reduce((rec, subkey) => (rec || null) && rec[subkey], this.root.get(!_.isUndefined(bars_ago) ? bars_ago : 0));
    };
    sub.get_index = function(index) {
        return this.subpath.reduce((rec, subkey) => (rec || null) && rec[subkey], this.root.get_index(index));
    };
    sub.set = function(value, bars_ago) {
        bars_ago = bars_ago === undefined ? 0 : bars_ago;
        var index = this.root.index - bars_ago;
        this.root.modified.add(index);
        var rootrec = this.buffer[index % this.buffer.length];
        var obj = (sup.subpath || []).reduce((rec, subkey) => rec[subkey], rootrec);
        obj[key] = value;
    };
    sub.set_index = function(value, index) {
        this.root.modified.add(index);
        var rootrec = this.buffer[index % this.buffer.length];
        var obj = (sup.subpath || []).reduce((rec, subkey) => rec[subkey], rootrec);
        obj[key] = value;
    };
    sub.slice = function(begin, end) {
        var range;
        if (end === undefined) { // last number of bars is specified
            begin = _.isFinite(begin) ? Math.abs(begin) : 1;
            range = _.range(this.root.index - begin + 1, this.root.index + 1);
        } else {  // start and end indexes are specified
            begin = _.isFinite(begin) ? Math.abs(begin) : this.root.index - this.root.buffer.length - 1;
            range = _.range(begin, _.isFinite(end) ? Math.abs(end) + 1 : this.root.index + 1);
        }
        return _.map(range, function(idx) {
            return sub.subpath.reduce((rec, subkey) => (rec || null) && rec[subkey], sub.root.get_index(idx));
        });
    };
    // disabled to prevent accidentally calling next() multiple times on same stream
    //sub.next = sup.next.bind(sub.root);
    sub.current_index = this.current_index.bind(sub.root);
    sub.substream = this.substream;

    // TODO: ensure key paths are followed for simple() objects derived from substreams
    sub.simple = this.simple;
    return sub;
};

// if use_index is true, absolute indexing is used to get values rather than bars_ago
Stream.prototype.simple = function(use_index) {
    var self = this;
    var obj;
    if (_.isEmpty(self.fieldmap)) {
        obj = (use_index ? self.get_index : self.get).bind(self);
    } else {
        obj = new EventEmitter2();
        obj.onAny(function(value) {self.emit(self.event, value);});
        _.each(self.fieldmap, function(field) {
            obj[field[0]] = (use_index ? self.sub_index : self.sub).bind(self, field[0]);
        });
    }
    return obj;
};

Stream.prototype.set = function(value, bars_ago) {
    bars_ago = bars_ago === undefined ? 0 : bars_ago;
    var index = this.current_index() - bars_ago;
    this.modified.add(index);
    this.buffer[index % this.buffer.length] = value;
};

Stream.prototype.set_type = function(type) {
    if (this.index > -1) throw new Error('Cannot set type when stream is not empty');
    this.type = type;
    this.fieldmap = stream_types.fieldmapOf(this.type);
    this.record_templater = stream_types.recordTemplateGenerator(this.fieldmap);
};

Stream.prototype.set_index = function(value, index) {
    this.modified.add(index);
    this.buffer[index % this.buffer.length] = value;
};

Stream.prototype.subtype_of = function(type) {
    if (!this.type) return false;
    return stream_types.isSubtypeOf(this.type, type instanceof Stream ? type.type : type);
};

return Stream;

});
