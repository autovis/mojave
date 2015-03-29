define({

    description: "Timeframe testing",
	//collection: "chart_test",
	collection: "TF_test",
    anchor: "ask",

    // geometry
    bar_width: 12,
    bar_padding: 4,

    margin: {
        left: 50,
        right: 50
    },

	components: [

        // Price
		{
			title: "{{chart_setup}}  ::  {{instrument}}  ::  {{timeframe}}",
            height: 200,
            indicators: {
                "ask_price": {def:["dual.ask", "vis:Price"]}, // candles
                "test": {def:[{sub:"close"}, [{tf:"m5"}, [{tf:"m30"}, "dual.ask", "tf:Candle2Candle"], "tf:Candle2Candle"], "vis:Line"], color: "orange"},
                "pivtest": {def:[{tf:"m5"},[[{tf:"H1"}, "dual.ask", "tf:Candle2Candle"], "pivot:Standard"], "vis:Pivot"]}
            },
            margin: {
                top: 15,
                bottom: 30
            },
            y_scale: {
                cursor_format: function(x) {return x.toFixed(5)},
                format: function(x) {return x.toFixed(4)},
                autoscale: true,
                ticks: 15
            },
            show_x_labels: true
		}

	]
})