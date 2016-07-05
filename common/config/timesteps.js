'use strict';

define(['lodash', 'd3', 'stream', 'config/stream_types'], function(_, d3, Stream, stream_types) {

    var defs = {

        'T': { // tick
            type: 'dated',
            hash: rec => rec.date,
            format: rec => rec.date.getSeconds(),
            tg_format: d3.time.format('%H:%M:00'),
            tg_hash: rec => d3.time.minute(rec.date)
        },

        // Fixed timeframes
        's1': {
            type: 'dated',
            hash: rec => d3.time.second(rec.date),
            format: rec => rec.date.getSeconds(),
            tg_format: d3.time.format('%H:%M'),
            tg_hash: rec => d3.time.minute(rec.date),
            unit_size: 1
        },
        'm1': {
            type: 'dated',
            hash: rec => d3.time.minute(rec.date),
            format: rec => rec.date.getMinutes(),
            tg_format: d3.time.format('%H:%M'),
            tg_hash: rec => new Date(Math.floor(rec.date.valueOf() / (5 * 60 * 1000)) * 5 * 60 * 1000),
            unit_size: 60
        },
        'm5': {
            type: 'dated',
            hash: rec => new Date(Math.floor(rec.date.valueOf() / ( 5 * 60 * 1000)) * 5 * 60 * 1000),
            format: rec => rec.date.getMinutes(),
            tg_format: d3.time.format('%H:%M'),
            tg_hash: rec => d3.time.hour(rec.date),
            unit_size: 5 * 60
        },
        'm15': {
            type: 'dated',
            hash: rec => new Date(Math.floor(rec.date.valueOf() / ( 15 * 60 * 1000)) * 15 * 60 * 1000),
            format: rec => rec.date.getMinutes(),
            tg_format: d3.time.format('%H:%M'),
            tg_hash: rec => d3.time.hour(rec.date),
            unit_size: 15 * 60
        },
        'm30': {
            type: 'dated',
            hash: rec => new Date(Math.floor(rec.date.valueOf() / (30 * 60 * 1000)) * 30 * 60 * 1000),
            format: rec => rec.date.getMinutes(),
            tg_format: d3.time.format('%a %-m/%-d'),
            tg_hash: rec => d3.time.day(rec.date),
            unit_size: 30 * 60
        },
        'H1': {
            type: 'dated',
            hash: rec => d3.time.hour(rec.date),
            format: rec => d3.time.format('%H')(rec.date),
            tg_format: d3.time.format('%a %-d-%-b-%Y'),
            tg_hash: rec => d3.time.day(rec.date),
            unit_size: 60 * 60
        },
        'D1': {
            type: 'dated',
            hash: rec => d3.time.day(rec.date),
            format: d3.time.format('%-m/%-d'),
            tg_format: d3.time.format('Week of %m/%d/%Y'),
            tg_hash: rec => d3.time.sunday(rec.date),
            unit_size: 24 * 60 * 60
        },
        'W1': {
            type: 'dated',
            hash: rec => d3.time.sunday(rec.date),
            unit_size: 5 * 24 * 60 * 60
            // timegroup: month
        },
        'M1': {
            type: 'dated',
            unit_size: 20 * 24 * 60 * 60
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
        var tstep = defs[target];
        if (!tstep) throw new Error('Unknown timestep: ' + tstep);

        var checks = _.map(streams, (str, idx) => {
            if (!(str instanceof Stream)) {
                return () => {throw new Error('source is not a stream');};
            } else if (!stream_types.isSubtypeOf(str.type, tstep.type)) {
                return () => {throw new Error('source stream type ("' + str.type + '") is not a subtype of "' + tstep.type + '" for tstep ' + target);};
            } else {
                return () => true;
            }
        });

        var check_src_idx = function(src_idx) {
            return checks[src_idx]();
        };

        var new_hash = null;
        var last_hash = null;

        var context = _.extend(tstep, {target: target, options: options});
        if (tstep.hash_init) tstep.hash_init.apply(context);

        return function(src_idx) {
            try {
                if (!check_src_idx(src_idx)) return null;
                new_hash = tstep.hash.apply(context, [streams[src_idx].get(0)]).valueOf();
                if (last_hash !== new_hash) {
                    last_hash = new_hash;
                    return true;
                }
            } catch (e) {
                throw new Error('Within differential function called on source #' + src_idx + ' :: ' + e.message);
            }
            return false;
        }.bind(context);
    };

    return {
        defs: defs,
        differential: differential
    };

});
