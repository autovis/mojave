var util = require('util');
var path = require('path');

var requirejs = require("requirejs");

var _ = requirejs('underscore');
var Stream = requirejs("stream")
var IndicatorInstance = requirejs("indicator_instance");
var IndicatorCollection = requirejs("indicator_collection");
var EventEmitter2 = requirejs("eventemitter2");

(function (global) {

function Delegate(name, options, in_streams) {
	if (!(this instanceof Delegate)) return new Delegate(name, options, in_streams);

    in_streams = _.isArray(in_streams) ? in_streams : [in_streams];
 
    this.name = name;
    var dlg_path = name.split(":");
    this.delegate = require(path.join.apply(null, [__dirname, "delegates"].concat(_.initial(dlg_path),_.last(dlg_path)+".js")))();
    this.options = options;

    this.input_streams = in_streams;
    this.current_index = -1;

    this.context = {
        delegate: Delegate,
        indicator: indicator_instance,
        indicator_collection: indicator_collection,
        stream: stream,
        simple_stream: function(id) {return (new stream(null, id)).simple_stream();},
        emit: this.emit.bind(this)
    };

    return this;
}

// delegate inherits EventEmitter2
Delegate.super_ = EventEmitter2;
Delegate.prototype = Object.create(EventEmitter2.prototype, {
    constructor: {
        value: Delegate,
        enumerable: false,
        writable: true,
        configurable: true
    }
});
Delegate.prototype.wildcard = true;

Delegate.prototype.initialize = function(callback) {
    this.delegate.initialize.apply(this.context, [this.options, this.input_streams, callback]);    
};

Delegate.prototype.update = function(callback) {
    this.current_index++;
    this.delegate.on_bar_update.apply(this.context, [callback]);
};

module.exports = Delegate;

}(this)); 