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
        'ThreeLineBreak': {}

    };

    var differential = function(in_streams, target_tstep, options) {
        var tstep = defs[target_tstep];
        if (!tstep) throw new Error(`Unknown timestep: ${target_tstep}`);

        var context = _.extend(tstep, {target: target_tstep, options: options});
        if (tstep.hash_init) tstep.hash_init.apply(context);

        var checks = _.map(in_streams, (str, idx) => {
            var last_hash = null;
            var new_hash = null;

            if (!(str instanceof Stream)) { // input must be a stream
                return () => {throw new Error('Source is not a stream');};
            } else if (str.tstep === target_tstep) { // input tstep is the same as output, skip differential
                return () => true;
            } else if (!stream_types.isSubtypeOf(str.type, tstep.type)) { // stream must be subtype of type imposed by timestep
                return () => {throw new Error(`Source stream type ("${str.type}") is not a subtype of "${tstep.type}" for tstep ${target_tstep}`);};
            } else {
                if (!_.has(str, 'tstep_diff')) throw new Error(`Input #${idx + 1} must have "<-" or "==" prefix when importing stream from another timestep to designate whether to apply differential`);
                if (!_.isBoolean(str.tstep_diff)) throw new Error('"tstep_diff" property must be a boolean value');
                if (str.tstep_diff) {
                    return () => { // apply differential for "->"
                        try {
                            new_hash = tstep.hash.apply(context, [str.get(0)]).valueOf();
                        } catch (e) {
                            throw new Error(`Within hash function for timestep '${target_tstep}' called on source #${idx + 1} :: ${e.message}`);
                        }
                        if (last_hash !== new_hash) {
                            last_hash = new_hash;
                            return true;
                        } else {
                            return false;
                        }
                    };
                } else {
                    return () => true; // passthru for "=="
                }
            }
        });

        return function(src_idx) {
            return checks[src_idx]();
        };
    };

    return {
        defs: defs,
        differential: differential
    };

});
