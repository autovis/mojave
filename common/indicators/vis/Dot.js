'use strict';

define(['lodash'], function(_) {

    return  {
        param_names: [],

        input: ['num'],

        initialize: function(params, input_streams, output) {
        },

        on_bar_update: function(params, input_streams, output) {
            output.set(input_streams[0].get(0));
        },

        /////////////////////////////////////////////////////////////////////////////////

        plot_init: function(d3, vis, options) {
        },

        plot_render: function(d3, vis, options, cont) {
            options._indicator.indicator.plot_update.apply(this, [d3, vis, options, cont]);
        },

        //plot_render_fields: [],

        plot_update: function(d3, vis, options, cont) {

            var filtered = vis.data.filter(i => i !== null && !isNaN(i) && i !== undefined);

            var dot = cont.selectAll('circle')
                .data(filtered)
                .attr('cy', d => vis.y_scale(_.isFinite(d.value) ? d.value : 0));
            dot.enter().append('circle')
                .attr('class', 'dot');

            dot.exit().remove();
        }

    };
});
