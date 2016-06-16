'use strict';

define(['lodash'], function(_) {

    return  {
        param_names: [],

        input: ['peak+'],
        output: ['zz1'],
        synch: ['s'],

        initialize: function(params, input_streams, output) {
        },

        on_bar_update: function(params, input_streams, output) {
            output.set({
                zz1: input_streams[0].get(0)
            });
        },

        // VISUAL #################################################################

        vis_render_fields: [],

        vis_init: function(d3, vis, options) {
        },

        vis_render: function(d3, vis, options, cont) {
            options._indicator.indicator.vis_update.apply(this, [d3, vis, options, cont]);
        },

        //vis_render_fields: [],

        vis_update: function(d3, vis, options, cont) {

            var zz1data = [];

            _.each(vis.data, function(d) {
                if (_.isObject(d.value.zz1) && _.isFinite(d.value.zz1.high)) zz1data.push([d.key, d.value.zz1.high, -1]);
                if (_.isObject(d.value.zz1) && _.isFinite(d.value.zz1.low)) zz1data.push([d.key, d.value.zz1.low, 1]);
            });

            var first_idx = _.head(vis.data).key;
            var unit = vis.chart.setup.bar_width / 8;
            var y_scale = 1.3;
            var x_scale = 1.7;
            //var hyp_scale = Math.sqrt(Math.pow(x_scale, 2) + Math.pow(y_scale, 2));

            var peak1 = function (x, y, side) {
                var o = {x: (x - first_idx) * (vis.chart.setup.bar_width + vis.chart.setup.bar_padding) + Math.floor((vis.chart.setup.bar_width) / 2), y: vis.y_scale(y) + (3 * unit * y_scale * side)};
                return 'M' + (o.x - 3 * unit * x_scale) + ',' + (o.y) + 'H' + (o.x + 3 * unit * x_scale) + 'L' + (o.x) + ',' + (o.y + 2 * unit * y_scale * side) + 'Z';
            };

            var zz1peak = cont.selectAll('path.mpeak')
                .data(zz1data)
                .attr('d', d => peak1(d[0], d[1], d[2]));
            zz1peak.enter().append('path')
                .classed({mpeak: true})
                .attr('d', d => peak1(d[0], d[1], d[2]))
                .style('fill', '#555');
            zz1peak.exit().remove();


        }

    };
});
