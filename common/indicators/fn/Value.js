'use strict';

define(['lodash'], function(_) {

    return {

        param_names: ['val'],

        input: ['_+'],
        output: 'num',

        initialize: function(params, input_streams, output) {
        },

        on_bar_update: function(params, input_streams, output) {
            output.set(params.val);
        }
    };

});
