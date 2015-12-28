define(['lodash', 'd3', 'stream', 'config/stream_types'], function(_, d3, Stream, stream_types) {

    var defs = {

        'T': { // tick
            type: 'dated',
            hash: function(rec) {return rec.date;}, // simply returns date
        },

        // Fixed timeframes
        's1': {
            type: 'dated',
            hash: function(rec) {return d3.time.second(rec.date);},
            format: function(rec) {return rec.date.getSeconds();},
            tg_format: d3.time.format('%H:%M'),
            tg_hash: function(rec) {return d3.time.minute(rec.date);},
            unit: 1
        },
        'm1': {
            type: 'dated',
            hash: function(rec) {return d3.time.minute(rec.date);},
            format: function(rec) {return rec.date.getMinutes();},
            tg_format: d3.time.format('%H:%M'),
            tg_hash: function(rec) {return new Date(Math.floor(rec.date.valueOf() / (15 * 60 * 1000)) * 15 * 60 * 1000);},
            unit: 60
        },
        'm5': {
            type: 'dated',
            hash: function(rec) {return new Date(Math.floor(rec.date.valueOf() / ( 5 * 60 * 1000)) * 5 * 60 * 1000);},
            format: function(rec) {return rec.date.getMinutes();},
            tg_format: d3.time.format('%H:%M'),
            tg_hash: function(rec) {return d3.time.hour(rec.date);},
            unit: 5 * 60
        },
        'm15': {
            type: 'dated',
            hash: function(rec) {return new Date(Math.floor(rec.date.valueOf() / ( 15 * 60 * 1000)) * 15 * 60 * 1000);},
            format: function(rec) {return rec.date.getMinutes();},
            tg_format: d3.time.format('%H:%M'),
            tg_hash: function(rec) {return d3.time.hour(rec.date);},
            unit: 15 * 60
        },
        'm30': {
            type: 'dated',
            hash: function(rec) {return new Date(Math.floor(rec.date.valueOf() / (30 * 60 * 1000)) * 30 * 60 * 1000);},
            format: function(rec) {return rec.date.getMinutes();},
            tg_format: d3.time.format('%a %-m/%-d'),
            tg_hash: function(rec) {return d3.time.day(rec.date);},
            unit: 30 * 60
        },
        'H1': {
            type: 'dated',
            hash: function(rec) {return d3.time.hour(rec.date);},
            format: function(rec) {return d3.time.format('%H')(rec.date);},
            tg_format: d3.time.format('%a %-d-%-b-%Y'),
            tg_hash: function(rec) {return d3.time.day(rec.date);},
            unit: 60 * 60
        },
        'D1': {
            type: 'dated',
            hash: function(rec) {return d3.time.day(rec.date);},
            format: d3.time.format('%-m/%-d'),
            tg_format: d3.time.format('Week of %m/%d/%Y'),
            tg_hash: function(rec) {return d3.time.sunday(rec.date);},
            unit: 24 * 60 * 60
        },
        'W1': {
            type: 'dated',
            hash: function(rec) {return d3.time.sunday(rec.date);},
            unit: 5 * 24 * 60 * 60
            // timegroup: month
        },
        'M1': {
            type: 'dated',
            unit: 20 * 24 * 60 * 60
            // timegroup: year
        },

        // Time-independent chart types

        'Renko': {
            type: 'tick',
            limit: 'T', // only T timeframe is accepted?
            hash_init: function() {},
            hash: function() {return this.options;}
        },
        'PointAndFigure': {
            type: 'tick',
        },
        'Kagi': {},
        'EquiVolume': {},
        'HeikinAshi': {},
        'ThreeLineBreak': {}

    };

    var differential = function(streams, target, options) {
        var tf = defs[target];
        if (!tf) throw new Error('Unknown timeframe: ' + tf);

        // get list of stream indexes which are valid inputs for this differential
        var valid_idxs = _.filter(_.map(streams, function(str, idx) {
            return str instanceof Stream && stream_types.isSubtypeOf(str.type, tf.type) ? idx : null;
        }), function(idx) {return idx !== null;});

        var new_hash = null;
        var last_hash = null;

        var context = _.extend(tf, {target: target, options: options});
        if (tf.hash_init) tf.hash_init.apply(context);

        return function(src_idx) {
            if (valid_idxs.indexOf(src_idx) === -1) throw new Error('Source index passed to TF differential hashing function references incompatible stream/object');
            new_hash = tf.hash.apply(context, [streams[src_idx].get(0)]).valueOf();
            if (last_hash !== new_hash) {
                last_hash = new_hash;
                return true;
            }
            return false;
        }.bind(context);
    };

    return {
        defs: defs,
        differential: differential
    };

});
