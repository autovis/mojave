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
            hash: () => null
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
                let update_hash = !_.isEmpty(dgrp_lookup[dgrp].filter(i => in_streams[i].tstep !== target_tstep));
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

        // lookaround stream graph for source that has subtype compatible with tstep
        // return stream if found else return null
        function find_provider_of_type_and_timestep(stream, tstep) {

            // first check stream and its inputs recursively
            var retval = check_provider_and_inputs_recursive(stream);
            if (retval) return retval;

            // then check inputs of stream's dependents and their children, and recurse upwards
            return (function check_dependents(stream) {
                var src_key = collection.get_unique_key(stream, true);
                var deps = collection.dependency_table.get(src_key);
                let cycles = collection.cycles_table.get(src_key);
                var retval = null;
                for (let dep of deps) {
                    if (_.isArray(cycles) && cycles.includes(dep)) return null; // skip cycles
                    for (let inp of stream.indicator.input_streams) {
                        let inp_key = collection.get_unique_key(inp, true);
                        if (inp_key === src_key) continue;
                        let cycles = collection.cycles_table.get(dep);
                        if (_.isArray(cycles) && cycles.includes(src_key)) return null; // skip cycles
                        retval = check_provider_and_inputs_recursive(inp);
                        if (retval) return retval;
                    }
                }
                for (let dep of deps) {
                    retval = do_check(dep);
                    if (retval) return retval;
                    if (_.isArray(cycles) && cycles.includes(dep)) return null; // skip cycles
                    retval = check_dependents(dep);
                    if (retval) return retval;
                }
                return null;
            })(stream);

            /////////////////////////////////////////////////////////////////////////////

            // check source and check recursively decending its inputs
            function check_provider_and_inputs_recursive(stream) {
                var str_key = collection.get_unique_key(stream, true);
                var retval = do_check(str_key);
                if (retval) return stream;

                for (let inp of stream.indicator.input_streams) {
                    let inp_key = collection.get_unique_key(inp, true);
                    let cycles = collection.cycles_table.get(str_key);
                    if (_.isArray(cycles) && cycles.includes(inp_key)) return null; // skip cycles
                    let retval = check_provider_and_inputs_recursive(inp, tstep);
                    if (retval) return retval;
                }
                return null;
            }

            // check if source is subtype of tstep
            function do_check(key) {
                let stream = collection.resolve_src(key);
                if (!(stream instanceof Stream)) return null;
                if (stream.source && indicator.output_stream.source && stream.source !== indicator.output_stream.source) return null;
                if (_.isObject(stream.instrument) && _.isObject(indicator.output_stream.instrument) && stream.instrument.id !== indicator.output_stream.instrument.id) return null;
                if (stream_types.isSubtypeOf(stream.type, tstep.type)) return stream;
                if (!stream.indicator) return null;
            }
        }
    };

    return {
        defs: defs,
        differential: differential
    };

});
