define(['require', 'underscore', 'stream', 'deferred', 'config/stream_types'],
    function(requirejs, _, Stream, Deferred, stream_types) {

function Indicator(ind_def, in_streams, buffer_size) {
	if (!(this instanceof Indicator)) return Indicator.apply(Object.create(Indicator.prototype), arguments);

    buffer_size = parseInt(buffer_size) || 100;
    if (_.isEmpty(in_streams)) throw new Error("Indicator must accept at least one input stream");
    in_streams = _.isArray(in_streams) ? in_streams : [in_streams];
    in_streams = _.map(in_streams, function(str) {
        return str instanceof Indicator ? str.output_stream : str;
    });

    var ind = this;

    if (ind_def[0]) { // named indicator
        if (_.isString(ind_def[0])) {
            // load indicator module from name (deprecate?)
            ind.name = ind_def[0];
            var ind_id_arr = ind_def[0].split(":");
            var path = ['indicators'].concat(_.initial(ind_id_arr),_.last(ind_id_arr)).join("/");
            ind.indicator = requirejs(path);
        } else { // assume already loaded indicator module passed in
            ind.name = "[unknown]";
            ind.indicator = ind_def[0];
        }
        if (!ind.indicator.input) throw new Error("Indicator is required to declare an input type");
        ind.input = _.clone(ind.indicator.input);
        ind.synch = _.clone(ind.indicator.synch);
        ind.output = ind.indicator.output !== undefined ? _.clone(ind.indicator.output) : ind.input[0];
        ind.param_names = _.isArray(ind.indicator.param_names) ? _.clone(ind.indicator.param_names) : [];
    } else { // identity indicator, passes input_streams[0] to output_stream unaltered
        ind.name = "[ident]";
        ind.indicator = identity;
        if (in_streams.length > 1) throw new Error("Identity indicator only accepts single input - multiple are given");
        ind.input = _.clone(in_streams[0].type || stream_types.default_type);
        ind.output = ind.input;
    }

    // map params by index and name
    ind.params = {};
    var params = ind.params;
    _.each(_.rest(ind_def), function(val, key) {
        params[key] = val;
        if (ind.param_names && _.isString(ind.param_names[key])) params[ind.param_names[key]] = val;
    });

    // verify input stream types against indicator input definition, and expand definition wildcards
    ind.input_streams = in_streams;
    if (!ind.input_streams[0] instanceof Stream) throw new Error("First input of indicator must be a stream");
    // if 'input' is defined on ind, assert that corresponding input streams are of compatible type
    var repeat = null;
    var zipped = _.zip(ind.input_streams, _.isArray(ind.input) ? ind.input : [ind.input], _.isArray(ind.synch) ? ind.synch : []);
    _.each(zipped, function(tup, idx) {
        var optional = false;
        if (_.last(tup[1]) === "*" || _.last(tup[1]) === "+") {
            if (_.last(tup[1]) === "*") optional = true;
            tup[1] = _.initial(tup[1]).join("");
            repeat = {type: tup[1], synch: tup[2]};
        } else if (_.last(tup[1]) === "?") {
            tup[1] = _.initial(tup[1]).join("");
            optional = true;
        } else if (tup[1] === undefined && repeat !== null) {
            tup[1] = repeat.type;
            tup[2] = repeat.synch;
        }

        // do checks
        if (tup[0] !== undefined) { // if stream is provided
            if (tup[0] instanceof Deferred) {
                // defining of indicator input is deferred for later
            } else if (tup[1] === undefined) {
                throw new Error(ind.name + ": Found unexpected input #"+(idx+1)+" of type '"+tup[0].type+"'");
            } else { // if indicator enforces type-checking for this input
                if (!tup[0].hasOwnProperty("type"))
                    throw new Error(ind.name + ": No type is defined for input #"+(idx+1)+" to match '"+tup[1]+"'");
                if (!stream_types.isSubtypeOf(tup[0].type, tup[1]))
                    throw new Error(ind.name + ": Input #"+(idx+1)+" type '"+(_.isObject(tup[0].type) ? JSON.stringify(tup[0].type) : tup[0].type)+"' is not a subtype of '"+tup[1]+"'");
            }
        } else {
            if (!optional) throw new Error(ind.name + ": No stream provided for required input #"+(idx+1)+" of type '"+tup[1]+"'");
        }
    });
    // if input stream synchronization is defined, replace with one expanded in accordance with any wildcards
    if (ind.synch) ind.synch = _.pluck(zipped, 2);

    ind.output_stream = new Stream(buffer_size, ind.name+".out", {type: ind.output});

    // output_stream inherits first input streams's timeframe by default -- indicator_collection may override after construction
    if (ind.input_streams[0].tf) ind.output_stream.tf = ind.input_streams[0].tf;

    if (_.isEmpty(ind.output_fields) && !_.isEmpty(ind.output_template)) {
       // TODO
    }

    // The "this" object that is presented to indicator's initialize()/on_bar_update() functions
    ind.context = {
        output_fields: ind.output_fields,
        current_index: ind.output_stream.current_index.bind(ind.output_stream),
        // Provide indicator with contructors to create nested stream/indicator instances with
        // update() function defaulting to host indicator's timeframes value from it's own last update
        stream: function(buffer_size, id, params) {
            //var str = new Stream(buffer_size, id, params);
            var str = Stream.apply(Object.create(Stream.prototype), arguments);
            str.next = function(timeframes) {
                timeframes = timeframes === undefined ? ind.last_update_timeframes : timeframes;
                Stream.prototype.next.call(this, timeframes);
            }
            str.instrument = ind.output_stream.instrument;
            str.tf = ind.output_stream.tf;
            return str;
        },
        indicator: function(ind_def, in_streams, buffer_size) {
            //var sub = new Indicator(ind_def, in_streams, buffer_size);
            var sub = Indicator.apply(Object.create(Indicator.prototype), arguments);
            sub.update = function(timeframes, src_idx) {
                timeframes = timeframes === undefined ? ind.last_update_timeframes : timeframes;
                Indicator.prototype.update.call(this, timeframes, src_idx);
            }
            return sub;
        },
        stop_propagation: function() {
            ind.stop_propagation = true;
        }
    };

    ind.indicator.initialize.apply(ind.context, [ind.params, ind.input_streams, ind.output_stream]);

    ind.tf_differential = function() {return false;} // this is overridden by indicator_collection for indicators implementing

    return ind;
}

Indicator.prototype = {

	constructor: Indicator,

    update: function(timeframes, src_idx) {
        // .tf_differential(src_idx) does hash comparison for given source index only if
        //    a target TF was defined for this indicator in collection def, otherwise false returned
        // .tf_differential(src_idx) must execute at every bar and remain first if conditional
        if (src_idx !== undefined && this.tf_differential(src_idx)) {
            this.output_stream.next();
            timeframes = timeframes.concat(this.output_stream.tf);
        // timeframes param already contains this indicator's timeframe (and therefore create new bar)
        } else if (_.isArray(timeframes) && timeframes.indexOf(this.output_stream.tf) > -1) {
            this.output_stream.next();
        // always create new bar when timeframe not applicable (catch-all for when src_idx not defined)
        /* catch-all to create new bar when timeframe is not applicable??
        } else if (this.output_stream.tf === undefined) {
            this.output_stream.next();
        */
        }
        this.last_update_timeframes = timeframes; // track timeframes that will be inherited by embedded indicators
        this.indicator.on_bar_update.apply(this.context, [this.params, this.input_streams, this.output_stream, src_idx]);
        // TODO: define 'modified' even when timeframes is null?
        if (this.stop_propagation) {
            delete this.stop_propagation;
            return;
        }
        var event = {modified: this.output_stream.modified, timeframes: timeframes};
        this.output_stream.emit("update", event);
    },

    get: function(bars_ago) {
        return this.output_stream.get(bars_ago);
    },

    simple: function() {
        var str = this.output_stream.simple();
        //var that = this;
        str.update = this.update.bind(this);
        return str;
    },

    current_index: function() {
        return this.output_stream.current_index();
    }
};

// Identity indicator, passes first input as output
var identity = {
    initialize: function() {},
    on_bar_update: function(params, input_streams, output_stream) {
        output_stream.set(input_streams[0].get(0));
    }
}

return Indicator;

})
