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
            hash_init: () => null,
            hash: () => null)
        },
        'PointAndFigure': {
            type: 'tick',
        },
        'Kagi': {},
        'EquiVolume': {},
        'ThreeLineBreak': {}

    };

    var differential = function(indicator, collection) {
        var in_streams = indicator.input_streams;
        var target_tstep = indicator.output_stream.tstep;
        if (!target_tstep) throw new Error('Target timestep must be provided for differential');
        var tstep = defs[target_tstep];
        if (!tstep) throw new Error(`Unknown timestep: ${target_tstep}`);

        var context = _.extend(tstep, {target: target_tstep, options: {}});
        if (tstep.hash_init) tstep.hash_init.apply(context);

        var dgrp_lookup = indicator.dgrps.reduce((m, v, k) => {if (_.isArray(m[v])) m[v].push(k); else m[v] = [k]; return m;}, {});

        var dgrp_curr_hash = {}; // track current hash per differential group
        var checks = _.map(in_streams, (str, idx) => { // side-effect: str.tstep is updated to target_tstep when diff is used
            if (target_tstep !== str.tstep) {
                switch (str.symbol) {
                    case '<-': // apply timestep differential
                        str.tstep = target_tstep;
                        return apply_differential(str, idx);
                    case '==': // don't apply differential
                        return () => true;
                    case undefined:
                        throw new Error(`Input #${idx + 1} must have a symbol prefix (== or <-) when importing stream from another timestep to designate how to apply differential`);
                    default:
                        throw new Error(`Unrecognized input symbol: ${str.symbol}`);
                }
            } else { // target_tstep === str.tstep
                let dgrp = indicator.dgrps[idx] || idx;
                let update_hash = !_.isEmpty(dgrp_lookup[dgrp].filter(i => in_streams[i].tstep !== target_tstep))
                if (update_hash) { // timestep differential being applied on another input within same diff group
                    let diff = apply_differential(str, idx); // to update current hash for group
                    return tstep_set => {
                        let is_new_bar = diff();
                        if (tstep_set.has(target_tstep)) {
                            return true;
                        } else {
                            return is_new_bar;
                        }
                    };
                } else {
                    return tstep_set => {
                        if (tstep_set.has(target_tstep)) {
                            return true;
                        } else {
                            return false;
                        }
                    };
                }
            }

        });

        function apply_differential(stream, index) {
            let dgrp = indicator.dgrps[index] || index;
            if (!stream_types.isSubtypeOf(stream.type, tstep.type)) { // stream must be subtype of type imposed by timestep
                stream = find_provider_of_type_and_timestep(indicator.output_stream, tstep);
                if (!stream) throw new Error(`Unable to find a provider for stream that is a subtype of "${tstep.type}" for tstep ${target_tstep}`);
            }
            return () => {
                let new_hash;
                try {
                    new_hash = tstep.hash.apply(context, [stream.get(0)]).valueOf();
                } catch (e) {
                    throw new Error(`Within hash function for timestep '${target_tstep}' called on source #${index + 1} :: ${e.message}`);
                }
                if (dgrp_curr_hash[dgrp] !== new_hash) {
                    dgrp_curr_hash[dgrp] = new_hash;
                    return true;
                } else {
                    return false;
                }
            };
        }

        return function(src_idx, tstep_set) {
            return checks[src_idx](tstep_set);
        };

        /////////////////////////////////////////////////////////////////////////////////

        function find_provider_of_type_and_timestep(stream, tstep) {
            if (!(stream instanceof Stream)) return null;
            if (stream_types.isSubtypeOf(stream.type, tstep.type)) return stream;
            if (!stream.indicator) return null;
            var inputs = _.filter(stream.indicator.input_streams, inp => inp.tstep === tstep.id);
            for (let i = 0; i <= inputs.length - 1; i++) {
                let str = find_provider_of_type_and_timestep(inputs[i], tstep);
                if (str) return str;
            }
            return null;
        }

        function check_provider_and_children(stream, tstep) {
            if (!(stream instanceof Stream)) return null;
            if (stream_types.isSubtypeOf(stream.type, tstep.type)) return stream;
            if (!stream.indicator) return null;
            return _.find(stream.indicator.input_streams, inp => {
                return check_provider_and_children(inp, tstep);
            });
        }

    };

    return {
        defs: defs,
        differential: differential
    };

});
