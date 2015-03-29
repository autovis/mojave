define([], function() {

    return  {
        param_names: [],

        input: 'candle_bar',
        output: 'candle_bar',

        initialize: function(params, input_streams, output) {
        },

        on_bar_update: function(params, input_streams, output) {
            output.set(input_streams[0].get(0));
        },

        // VISUAL #################################################################

        vis_render_fields: ['open', 'high', 'low', 'close'],

        vis_init: function(d3, vis, options) {
        },

        vis_render: function(d3, vis, options, cont) {

            cont.selectAll("*").remove();

            this.wicks = cont.append("g").attr("class", "wicks");
            this.candles = cont.append("g").attr("class", "candles");

            options._indicator.indicator.vis_update.apply(this, [d3, vis, options]);
        },

        vis_update: function(d3, vis, options) {

            var wick = this.wicks.selectAll("line.wick")
              .data(vis.data, function(d) {return d.key})
                .attr("x1", function(d,i) {return i*(vis.chart.config.bar_width+vis.chart.config.bar_padding)+Math.floor((vis.chart.config.bar_width)/2)})
                .attr("x2", function(d,i) {return i*(vis.chart.config.bar_width+vis.chart.config.bar_padding)+Math.floor((vis.chart.config.bar_width)/2)})
                .attr("y1", function(d) {return vis.y_scale(d.value.low)})
                .attr("y2", function(d) {return vis.y_scale(d.value.high)})
                .classed("fall",function(d) {return d.value.open > d.value.close});
            wick.enter().append("line")
                .attr("class", "wick")
                .attr("x1", function(d,i) {return i*(vis.chart.config.bar_width+vis.chart.config.bar_padding)+Math.floor((vis.chart.config.bar_width)/2)})
                .attr("x2", function(d,i) {return i*(vis.chart.config.bar_width+vis.chart.config.bar_padding)+Math.floor((vis.chart.config.bar_width)/2)})
                .attr("y1", function(d) {return vis.y_scale(d.value.low)})
                .attr("y2", function(d) {return vis.y_scale(d.value.high)})
                .classed("fall",function(d) {return d.value.open > d.value.close})
                .on("mousemove", function() {vis.updateCursor()});
            wick.exit().remove();

            var candle = this.candles.selectAll("rect.cndl")
              .data(vis.data, function(d) {return d.key})
                .attr("x", function(d,i) {return i*(vis.chart.config.bar_width+vis.chart.config.bar_padding)})
                .attr("y", function(d) {return vis.y_scale(Math.max(d.value.open,d.value.close))})
                .attr("height", function(d) {return Math.max(0.1,Math.abs(vis.y_scale(d.value.open)-vis.y_scale(d.value.close)))})
                .classed("fall",function(d) {return d.value.open > d.value.close});
            candle.enter().append("rect")
                .attr("class", "cndl")
                .attr("x", function(d,i) {return i*(vis.chart.config.bar_width+vis.chart.config.bar_padding)})
                .attr("y", function(d) {return vis.y_scale(Math.max(d.value.open,d.value.close))})
                .attr("width", function(d) {return vis.chart.config.bar_width})
                .attr("height", function(d) {return Math.max(0.1,Math.abs(vis.y_scale(d.value.open)-vis.y_scale(d.value.close)))})
                .classed("fall",function(d) {return d.value.open > d.value.close})
                .on("mousemove", function() {vis.updateCursor()});
            candle.exit().remove();

        }

    }
})
