define({

    param_names: [],

    input: 'candle_bar',
    output: 'float',

    initialize: function(params, input_streams, output_stream) {
        this.input = input_streams[0].simple();
    },

    on_bar_update: function(params, input_streams, output) {

        var input = this.input;

        /*
		if (CurrentBar == 0)
			Value.Set(0);
		else
		{
			if (Close[0] > Close[1])
				Value.Set(Value[1]+ Volume[0]);
			else if (Close[0]  < Close[1])
				Value.Set(Value[1] - Volume[0]);
			else
				Value.Set(Value[1]);
		}
        */
        if (this.current_index() == 0) {
            output.set(0);
        } else {
            if (input.close(0) > input.close(1))
                output.set(output.get(1) + input.volume(0));
            else if (input.close(0) < input.close(1))
                output.set(output.get(1) - input.volume(0));
            else
                output.set(output.get(1));
        }
    },

    // VISUAL #################################################################

    vis_init: function(d3, vis, options) {
    },

    vis_render: function(d3, vis, options, cont) {

        //var finite = function(num) {return _.isFinite(num) ? num : 0};

        var line = d3.svg.line()
            .x(function(d,i) {return Math.round(i*vis.x_factor+vis.chart.config.bar_width/2)})
            .y(function(d) {return vis.y_scale(d.value)});

        cont.append("path")
            .datum(vis.data)
            .style("fill", "none")
            .style("stroke", "rgb(21, 99, 22)")
            .style("stroke-width", 2)
            .style("stroke-opacity", 0.8)
            .attr("d", line);
    }
})
