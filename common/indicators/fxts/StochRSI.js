define(['underscore', 'indicators/RSI', 'indicators/SMA'], function(_, RSI, SMA) {

    return {

        param_names: ["RSI_period", "K_period", "KS_period", "D_period"],

        input: "num",
        output: ["K", "D"],

        initialize: function(params, input_streams, output) {
            this.rsi = this.indicator([RSI, params.RSI_period], input_streams[0]);

            this.out_k = output.substream("K");
            this.out_d = output.substream("D");

            this.ski = this.stream("ski");
            this.mva1 = this.indicator([SMA, params.KS_period], this.ski);
            this.mva2 = this.indicator([SMA, params.D_period], this.out_k);
            this.range = _.range(0, params.K_period).reverse();
        },

        on_bar_update: function(params, input_streams, output) {

            var ski = this.ski;
            var rsi = this.rsi;
            var mva1 = this.mva1;
            var mva2 = this.mva2;

            /*
            RSI:update(mode);

            if (period >= firstSKI) then
                local min, max;
                local range;
                range = core.rangeTo(period, K);
                min = core.min(RSI.DATA, range);
                max = core.max(RSI.DATA, range);
                if (min == max) then
                    SKI[period] = 100;
                else
                    SKI[period] = (RSI.DATA[period] - min) / (max - min) * 100;
                end
            end

            MVA1:update(mode);

            if period >= firstK then
                SK[period] = MVA1.DATA[period];
            end

            MVA2:update(mode);

            if (period >= firstD) then
                SD[period] = MVA2.DATA[period];
            end
            */

            rsi.update();
            if (this.current_index() >= params.K_period) {
                var min = Math.min.apply(null, _.map(this.range, function(n) {return rsi.get(n)}));
                var max = Math.max.apply(null, _.map(this.range, function(n) {return rsi.get(n)}));
                //console.log("idx: " + this.current_index() + " - MIN: " + );
                ski.next();
                if (min == max) {
                    ski.set(100);
                } else {
                    ski.set((rsi.get(0) - min) / (max - min) * 100);
                }
                mva1.update();
                this.out_k.set(mva1.get(0));
                mva2.update();
                this.out_d.set(mva2.get(0));
            } else {
                //ski.next();
                //mva1.update();
                //mva2.update();
            }
        },

        // VISUAL #################################################################

        vis_init: function(d3, vis, options) {
        },

        vis_render: function(d3, vis, options, cont) {

            var finite = function(num) {return _.isFinite(num) ? num : 0};

            var d_line = d3.svg.line()
                .x(function(d,i) {return Math.round(i*vis.x_factor+vis.chart.config.bar_width/2)})
                .y(function(d) {return vis.y_scale(finite(d.value.D))});

            cont.append("path")
                .datum(vis.data)
                .attr("class", "d-line")
                .style("fill", "none")
                .style("stroke", "rgb(159, 73, 28)")
                .style("stroke-width", 1)
                .style("stroke-opacity", 0.8)
                .attr("d", d_line);

            var k_line = d3.svg.line()
                .x(function(d,i) {return Math.round(i*vis.x_factor+vis.chart.config.bar_width/2)})
                .y(function(d) {return vis.y_scale(finite(d.value.K))});

            cont.append("path")
                .datum(vis.data)
                .attr("class", "k-line")
                .style("fill", "none")
                .style("stroke", "cornflowerblue")
                .style("stroke-width", 2)
                .style("stroke-opacity", 0.8)
                .attr("d", k_line);
        },

        vis_render_fields: ["K", "D"]

    }
})
