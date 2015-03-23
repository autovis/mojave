﻿define(['underscore', 'eventemitter2', 'config/stream_types', 'config/instruments'],
    function(_, EventEmitter2, stream_types, instruments) {

    // constructors:
    //   Stream(id, options?)
    //   Stream(buffer_size, id, options?)

    function Stream() {
	    if (!(this instanceof Stream)) return Stream.apply(Object.create(Stream.prototype), arguments);

        var args = arguments;
        var buffer_size = 100;
        if (_.isNumber(_.first(args))) {
            buffer_size = _.first(args);
            if (!(buffer_size > 0)) throw new Error("buffer_size must be at least 1");
            args = _.rest(args);
        }
        this.id = args[0] || null;
        this.params = args[1] || {};
        this.type = this.params.type ? this.params.type : stream_types.default_type;
        this.buffer = new Array(buffer_size);
        this.index=-1;
        this.modified = [];
        this.path = [this.id];
        if (this.params.type) this.type = this.params.type; else this.type = stream_types.default_type;
        if (this.params.tf) this.tf = this.params.tf;
        if (this.params.instrument) {
            if (!instruments[this.params.instrument]) throw new Error("Unknown instrument: "+this.params.instrument);
            this.instrument = _.clone(instruments[this.params.instrument]);
            this.instrument.id = this.params.instrument;
        }
        this.fieldmap = stream_types.fieldmapOf(this.type);
        this.record_templater = stream_types.recordTemplateGenerator(this.fieldmap);
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
        if (!_.isFinite(size) || size < 1) throw new Error("Invalid buffer size: "+size);
        this.buffer = new Array(size);
        return this;
    };

    Stream.prototype.type = function(type) {
        if (!_.isEmpty(this.buffer)) throw new Error("Cannot call 'type' on stream after it has been used");
        this.type = type;
        this.fieldmap = stream_types.fieldmapOf(type);
        this.record_template = stream_types.recordTemplateGenerator(this.type);
        return this;
    };

    Stream.prototype.next = function(timeframes) {
        // if update already applied to this stream's timeframe
        if (timeframes === undefined || this.tf === undefined || _.isArray(timeframes) && timeframes.indexOf(this.tf) > -1) {
            this.index++;
            this.buffer[this.current_index() % this.buffer.length] = this.record_templater();
        }
        this.modified = [];
    };

    Stream.prototype.get = function(bars_ago) {
        bars_ago = !_.isUndefined(bars_ago) ? bars_ago : 0;
        if (bars_ago > this.buffer.length-1)
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
            range = _.range(this.index-begin, this.index+1);
        } else {  // start and end indexes are specified
            begin = _.isFinite(begin) ? Math.abs(begin) : this.index-this.buffer.length-1;
            range = _.range(begin, _.isFinite(end) ? Math.abs(end)+1 : this.index+1);
        }
        return _.map(range, function(idx) {return this.get_index(idx)});
    };

    // Returns a virtual stream that get/sets a subproperty of an object-based stream
    Stream.prototype.substream = function(key) {

        var sublist = _.pluck(this.fieldmap, 0);
        if (sublist.indexOf(key) == -1) throw new Error(this.id+": '"+key+"' is not a subfield of type '"+this.type+"'");

        var sup = this;
        var sub = Object.create(Stream.prototype);
        // Relay all events from root stream to this substream
        sup.onAny(function(value) {sub.emit(this.event, value)});
        sub.root = this.root || this;
        var node = _.find(sup.fieldmap, function(field) {return field[0] === key})[1];
        sub.type = node.type;
        sub.fieldmap = node.recurse || [];        
        sub.id = this.id+"."+key;
        sub.subpath = (this.subpath || []).concat(key);
        sub.path = _.initial(this.path).concat(_.last(this.path)+"."+key);
        sub.tf = this.tf;
        sub.instrument = this.instrument;
        sub.params = this.params;
        sub.buffer = this.buffer;
        sub.is_sub = true;

        sub.get = function(bars_ago) {
            return this.subpath.reduce(function(rec, subkey) {
                return (rec || null) && rec[subkey]
            }, this.root.get(!_.isUndefined(bars_ago) ? bars_ago : 0));
        };
        sub.get_index = function(index) {
            return this.subpath.reduce(function(rec, subkey) {
                return (rec || null) && rec[subkey]
            }, this.root.get_index(index));
        };
        sub.set = function(value, bars_ago) {
            bars_ago = bars_ago === undefined ? 0 : bars_ago;
            var index = this.root.index - bars_ago;
            this.root.modified.push(index);
            var rootrec = this.buffer[index % this.buffer.length];
            var obj = (sup.subpath || []).reduce(function(rec, subkey) {return rec[subkey]}, rootrec)
            obj[key] = value;
        };
        sub.set_index = function(value, index) {
            this.root.modified.push(index);
            var rootrec = this.buffer[index % this.buffer.length];
            var obj = (sup.subpath || []).reduce(function(rec, subkey) {return rec[subkey]}, rootrec)
            obj[key] = value;
        };
        sub.slice = function(begin, end) {
            var range;
            if (end === undefined) { // last number of bars is specified
                begin = _.isFinite(begin) ? Math.abs(begin) : 1;
                range = _.range(this.root.index-begin+1, this.root.index+1);
            } else {  // start and end indexes are specified
                begin = _.isFinite(begin) ? Math.abs(begin) : this.root.index-this.root.buffer.length-1;
                range = _.range(begin, _.isFinite(end) ? Math.abs(end)+1 : this.root.index+1);
            }
            return _.map(range, function(idx) {
                return sub.subpath.reduce(function(rec, subkey) {
                    return (rec || null) && rec[subkey]
                }, sub.root.get_index(idx));
            });            
        }
        sub.next = sup.next.bind(sub.root);
        // Unconfirmed whether below code is needed in place of above line
        /*
        sub.next = function(timeframes) {
            if (timeframes === undefined || this.root.tf === undefined || _.isArray(timeframes) && timeframes.indexOf(this.tf) > -1) {
                this.root.index++;
                this.root.buffer[this.root.index % this.root.buffer.length] = this.root.record_templater();
            }
            this.root.modified = [];            
        };
        */
        sub.current_index = this.current_index.bind(sub.root);
        sub.substream = this.substream;

        // TODO: ensure key paths are followed for simple() objects derived from substreams
        sub.simple = this.simple;
        return sub;
    };

    // if use_index is true, absolute indexing is used to get values rather than bars_ago
    Stream.prototype.simple = function(use_index) {
        var that = this;
        var obj;
        if (_.isEmpty(this.fieldmap)) {
            obj = (use_index ? this.get_index : this.get).bind(this);
        } else {
            obj = new EventEmitter2();
            obj.onAny(function(value) {that.emit(this.event, value)});
            _.each(this.fieldmap, function(field) {
                obj[field[0]] = (use_index ? this.sub_index : this.sub).bind(this, field[0]);
            }, this);
        }
        return obj;
    };

    Stream.prototype.set = function(value, bars_ago) {
        bars_ago = bars_ago === undefined ? 0 : bars_ago;
        // TODO: if type is subtype of object, validate that value is object
        var index = this.current_index() - bars_ago;
        this.modified.push(index);
        //this.buffer.set(idx, value);
        this.buffer[index % this.buffer.length] = value;
    };

    Stream.prototype.set_index = function(value, index) {
        // TODO: if type is subtype of object, validate that value is object
        this.modified.push(index);
        //this.buffer.set(idx, value);
        this.buffer[index % this.buffer.length] = value;
    };

    Stream.prototype.subtype_of = function(type) {
        if (!this.type) return false;        
        return stream_types.isSubtypeOf(this.type, type instanceof Stream ? type.type : type);
    };

    return Stream;
})