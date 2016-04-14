'use strict';

define(['lodash', 'config/timesteps'], function(_, tsconfig) {
    return {
        description: `Returns "true" if date value is the start of an interval in <timestep>`,

        param_names: ['timestep'],

        input: 'dated',
        output: 'bool',

        initialize: function(params, input_streams, output_stream) {
            if (!_.has(tsconfig.defs, params.timestep)) throw new Error('Unrecognized timestep: ' + params.timestep);
            if (!_.isFunction(tsconfig.defs[params.timestep].hash)) throw new Error('Hash function not defined for timestep: ' + params.timestep);
            this.hash = tsconfig.defs[params.timestep].hash;
        },

        on_bar_update: function(params, input_streams, output_stream) {
            var bar = input_streams[0].get();
            var val = this.hash(bar).getTime() === bar.date.getTime();
            output_stream.set(val);
        }
    };
});
