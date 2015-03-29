module.exports = {

    // Initialize indicator
    initialize: function(options, input_streams, callback) {
        this.input = input_streams[0].simple_stream();
        callback();
    },

    // Called when input streams are updated
    on_bar_update: function(options, input_streams) {

        var input = this.input;

        this.emit("debug", "test: "+input(0).close);
    }

};
