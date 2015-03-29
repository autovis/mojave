define([], function() {
    return {

        param_names: ["period"],

        output_fields: [],

        initialize: function(params, input_streams, output_stream) {
            this.input = input_streams[0];

            this.currentZigZagHigh = 0;
            this.currentZigZagLow = 0;
            this.deviationType = "points";
            this.deviationValue = 0.5;
            this.zigZagHighZigZags = this.stream("high_zigzags");
            this.zigZagLowZigZags = this.stream("low_zigzags");
            this.zigZagHighSeries = this.stream("high_series");
            this.zigZagLowSeries = this.stream("low_series");
            this.lastSwingIdx = -1;
            this.lastSwingPrice = 0.0;
            this.trendDir = 0;
            this.useHighLow = false;
        },

        on_bar_update: function(params, input_streams, output) {
	        // Value.Set(CurrentBar == 0 ? Input[0] : Input[0] * (2.0 / (1 + Period))        + (1 - (2.0 / (1 + Period)))        * Value[1]);  // or input(0) if undefined
            var value = this.current_index() == 0 ? this.input.get(0) : this.input.get(0) * (2.0 / (1 + params.period)) + (1 - (2.0 / (1 + params.period))) * output_stream.get(1) || this.input.get(0);
            output_stream.set(value);
        }
    }

    function LowBar(barsAgo, instance, lookBackPeriod) {
        if (instance < 1)
            throw new Error("ZigZag.LowBar: instance must be greater/equal 1 but was " + instance);
        else if (barsAgo < 0)
            throw new Error("ZigZag.HighBar: barsAgo must be greater/equal 0 but was " + barsAgo);
        else if (barsAgo >= Count)
            1;
    }

    function HighBar(barsAgo, instance, lookBackPeriod) {

    }
})