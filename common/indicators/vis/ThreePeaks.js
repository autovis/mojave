'use strict';

define(['lodash'], function(_) {

    return  {
        param_names: [],

        input: ['peak', 'peak?', 'peak?'],
        output: ['zz1', 'zz2', 'zz3'],
        synch: ['s', 's', 's'],

        initialize: function(params, input_streams, output) {
        },

        on_bar_update: function(params, input_streams, output) {
            output.set({
                zz1: input_streams[0].get(0),
                zz2: input_streams[1] ? input_streams[1].get(0) : null,
                zz3: input_streams[2] ? input_streams[2].get(0) : null
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
            var zz2data = [];
            var zz3data = [];

            _.each(vis.data, function(d) {
                if (_.isObject(d.value.zz1) && _.isFinite(d.value.zz1.high)) zz1data.push([d.key, d.value.zz1.high, -1]);
                if (_.isObject(d.value.zz1) && _.isFinite(d.value.zz1.low)) zz1data.push([d.key, d.value.zz1.low, 1]);

                if (_.isObject(d.value.zz2) && _.isFinite(d.value.zz2.high)) zz2data.push([d.key, d.value.zz2.high, -1]);
                if (_.isObject(d.value.zz2) && _.isFinite(d.value.zz2.low)) zz2data.push([d.key, d.value.zz2.low, 1]);

                if (_.isObject(d.value.zz3) && _.isFinite(d.value.zz3.high)) zz3data.push([d.key, d.value.zz3.high, -1]);
                if (_.isObject(d.value.zz3) && _.isFinite(d.value.zz3.low)) zz3data.push([d.key, d.value.zz3.low, 1]);
            });

            var first_idx = _.head(vis.data).key;
            var unit = vis.chart.setup.bar_width / 8;
            var y_scale = 0.8;
            var x_scale = 1.3;
            var hyp_scale = Math.sqrt(Math.pow(x_scale, 2) + Math.pow(y_scale, 2));

            var peak1 = function (x, y, side) {
                var o = {x: (x - first_idx) * (vis.chart.setup.bar_width + vis.chart.setup.bar_padding) + Math.floor((vis.chart.setup.bar_width) / 2), y: vis.y_scale(y) + (3 * unit * y_scale * side)};
                return 'M' + (o.x - 3 * unit * x_scale) + ',' + (o.y) + 'H' + (o.x + 3 * unit * x_scale) + 'L' + (o.x) + ',' + (o.y + 2 * unit * y_scale * side) + 'Z';
            };

            var peak2 = function(x, y, side) {
                var o = {x: (x - first_idx) * (vis.chart.setup.bar_width + vis.chart.setup.bar_padding) + Math.floor((vis.chart.setup.bar_width) / 2), y: vis.y_scale(y) + (6.8 * unit * y_scale * side)};
                return 'M' + (o.x - 3 * unit * x_scale) + ',' + (o.y - 2 * unit * y_scale * side) + 'L' + (o.x) + ',' + (o.y) + 'L' + (o.x + 3 * unit * x_scale) + ',' + (o.y - 2 * unit * y_scale * side) + 'A' + (6 * unit * hyp_scale) + ',' + (6 * unit * hyp_scale) + ',0,0,' + (side > 0 ? 1 : 0) + ',' + (o.x) + ',' + (o.y + 2 * unit * y_scale * side) + 'A' + (6 * unit * hyp_scale) + ',' + (6 * unit * hyp_scale) + ',0,0,' + (side > 0 ? 1 : 0) + ',' + (o.x - 3 * unit * x_scale) + ',' + (o.y - 2 * unit * y_scale * side) + 'Z';
            };

            var peak3 = function(x, y, side) {
                var o = {x: (x - first_idx) * (vis.chart.setup.bar_width + vis.chart.setup.bar_padding) + Math.floor((vis.chart.setup.bar_width) / 2), y: vis.y_scale(y) + (11 * unit * y_scale * side)};
                return 'M' + (o.x + 3 * unit * x_scale) + ',' + (o.y - 3.8 * unit * y_scale * side) + 'A' + (6 * unit * hyp_scale) + ',' + (6 * unit * hyp_scale) + ',0,0,' + (side > 0 ? 1 : 0) + ',' + (o.x) + ',' + (o.y) + 'A' + (6 * unit * hyp_scale) + ',' + (6 * unit * hyp_scale) + ',0,0,' + (side > 0 ? 1 : 0) + ',' + (o.x - 3 * unit * x_scale) + ',' + (o.y - 3.8 * unit * y_scale * side) + 'A' + (25 * unit * hyp_scale) + ',' + (25 * unit * hyp_scale) + ',0,0,' + (side > 0 ? 1 : 0) + ',' + (o.x) + ',' + (o.y + 10 * unit * y_scale * side) + 'A' + (25 * unit * hyp_scale) + ',' + (25 * unit * hyp_scale) + ',0,0,' + (side > 0 ? 1 : 0) + ',' + (o.x + 3 * unit * x_scale) + ',' + (o.y - 3.8 * unit * y_scale * side) + 'Z';
            };

            var zz1peak = cont.selectAll('path.tripeak1')
                .data(zz1data)
                .attr('d', d => peak1(d[0], d[1], d[2]));
            zz1peak.enter().append('path')
                .classed({tripeak1: true})
                .attr('d', d => peak1(d[0], d[1], d[2]));
            zz1peak.exit().remove();

            var zz2peak = cont.selectAll('path.tripeak2')
                .data(zz2data)
                .attr('d', d => peak2(d[0], d[1], d[2]));
            zz2peak.enter().append('path')
                .classed({tripeak2: true})
                .attr('d', d => peak2(d[0], d[1], d[2]));
            zz2peak.exit().remove();

            var zz3peak = cont.selectAll('path.tripeak3')
                .data(zz3data)
                .attr('d', d => peak3(d[0], d[1], d[2]));
            zz3peak.enter().append('path')
                .classed({tripeak3: true})
                .attr('d', d => peak3(d[0], d[1], d[2]));
            zz3peak.exit().remove();

        }

    };
});
