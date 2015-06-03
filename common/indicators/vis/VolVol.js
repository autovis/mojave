define([], function() {

    return  {
        param_names: ["vol_thres", "atr_thres", "thres_dist"],

        input: ['num', 'num'],
        output: ['vol', 'atr'],

        initialize: function(params, input_streams, output) {
            if (!_.isObject(input_streams[1].instrument)) throw new Error("VolVol indicator's second input stream (ATR) must define an instrument");
            this.unit_size = input_streams[1].instrument.unit_size;
        },

        on_bar_update: function(params, input_streams, output) {
            var adj_atr = input_streams[1].get(0) / this.unit_size;
            output.set({
                vol: input_streams[0].get(0),
                atr: _.isFinite(adj_atr) ? adj_atr : 0
            });
        },

        // VISUAL #################################################################

        vis_init: function(d3, vis, options) {
            var ind = this;

            ind.atr_line = d3.svg.line()
                .x(function(d,i) {return Math.round(i*vis.x_factor+vis.chart.setup.bar_width/2)})
                .y(function(d) {return vis.height-ind.atr_scale(d.value.atr)});

        },


        vis_render: function(d3, vis, options, cont) {
            var ind = this;

            ind.vol_scale = d3.scale.linear().domain([0, options.vol_thres]).range([0,options.thres_dist])
            ind.atr_scale = d3.scale.linear().domain([0, options.atr_thres]).range([0,options.thres_dist])

            cont.selectAll("*").remove();

            // vol/atr threshold line
            cont.append("line")
                .attr("class", "volvol_thres")
                .attr("x1", -Math.floor(vis.chart.setup.bar_padding/2)-0.5)
                .attr("y1", function(d) {return Math.round(vis.height - options.thres_dist)})
                .attr("x2", vis.width-Math.floor(vis.chart.setup.bar_padding/2)-0.5)
                .attr("y2", function(d) {return Math.round(vis.height - options.thres_dist)})

            ind.atr_path = cont.append("g").attr("class", "atr");
            ind.volumes = cont.append("g").attr("class", "volume");

            ind.atr_path.append("path")
                .datum(vis.data)
                .attr("class", "atr_plot")
                .attr("d", ind.atr_line);

            ind.volumes.selectAll("rect.vol")
              .data(vis.data)
                .enter().append("rect")
                .attr("class", "vol")
                .attr("x", function(d,i) {return i*(vis.chart.setup.bar_width+vis.chart.setup.bar_padding)})
                .attr("y", function(d) {return vis.height-Math.ceil(ind.vol_scale(d.value.vol))})
                .attr("width", function(d) {return vis.chart.setup.bar_width})
                .attr("height", function(d) {return Math.ceil(ind.vol_scale(d.value.vol))})
                .on("mousemove", function() {vis.updateCursor()})

            options._indicator.indicator.vis_update.apply(this, [d3, vis, options, cont]);

        },

        vis_render_fields: [],

        vis_update: function(d3, vis, options, cont) {
            var ind = this;

            cont.select("line.volvol_thres")
                .attr("x2", vis.width-Math.floor(vis.chart.setup.bar_padding/2)-0.5)

            var vol = ind.volumes.selectAll("rect.vol")
              .data(vis.data)
                .attr("x", function(d,i) {return i*(vis.chart.setup.bar_width+vis.chart.setup.bar_padding)})
                .attr("y", function(d) {return vis.height-Math.ceil(ind.vol_scale(d.value.vol))})
                .attr("width", function(d) {return vis.chart.setup.bar_width})
                .attr("height", function(d) {return Math.ceil(ind.vol_scale(d.value.vol))});
            vol.enter().append("rect")
                .attr("class", "vol")
                .attr("x", function(d,i) {return i*(vis.chart.setup.bar_width+vis.chart.setup.bar_padding)})
                .attr("y", function(d) {return vis.height-Math.ceil(ind.vol_scale(d.value.vol))})
                .attr("width", function(d) {return vis.chart.setup.bar_width})
                .attr("height", function(d) {return Math.ceil(ind.vol_scale(d.value.vol))})
            vol.exit().remove();

            ind.atr_path.select("path.atr_plot")
                .attr("d", ind.atr_line);

        },

    }
})
