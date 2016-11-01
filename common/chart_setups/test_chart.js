define({

    description: "Basic chart setup with no indicators",
	collection: "test",

    // geometry
    bar_width: 9,
    bar_padding: 3,

    margin: {
        left: 20,
        right: 50
    },

    maxsize: 120,
    //show_labels: 'both',

    // behavior
    pan_and_zoom: false,

	components: [

        // Chart Panel
        {
            type: "panel",
            anchor: "dual",
            height: 30,
            margin: {
                top: 15,
                bottom: 0
            },
            controls: [
                {id: "price_type_label", type: "label", text: "Price type:"},
                {id: "ask_bid_radio", type: "radio", options: ["Ask", "Bid", "Both", "Mid"], selected: "Mid"},
                {id: "comment_label", type: "label", text: "This chart is for testing new features"}
            ]
        },

        // Ticks
		{
			title: "{{instrument}}  @  {{timestep}}",
            anchor: "tick",
            height: 100,
            indicators: {
                "tick_ask": {def:["tick.ask", "plot:Line"], color:"#2196F3", width: 1},
                "tick_bid": {def:["tick.bid", "plot:Line"], color:"red", width: 1}
            },
            margin: {
                top: 5,
                bottom: 28
            },
            y_scale: {
                autoscale: true,
                price: true
            },
            show_x_labels: true
		},

        // Price
		{
			title: "{{instrument}}  @  {{timestep}}",
            anchor: "dual",
            height: 400,
            indicators: {
                "mid_price": {def:["src_bar", "plot:Candle"]}
                //"tradesim-vis": {def:["trade_evts", "plot:Trade"]}
            },

            margin: {
                top: 5,
                bottom: 31
            },
            y_scale: {
                autoscale: true,
                price: true
            },
            show_x_labels: true
		},

        // Heikin-Ashi
		{
			title: "Heikin-Ashi",
            anchor: "dual",
            height: 400,
            indicators: {
                "ha_price": {def:["src_bar", "stream:HeikinAshi"]}
                //"tradesim-vis": {def:["trade_evts", "plot:Trade"]}
            },

            margin: {
                top: 5,
                bottom: 31
            },
            y_scale: {
                autoscale: true,
                price: true
            },
            show_x_labels: true
		},

		// TEST
        {
            title: "TEST",
            anchor: "dual",
            height: 80,
			indicators: {
                "test1_line": {def: ["test1", "plot:Line"], width: 8, opacity: 0.4, color: "red"},
                "test2_line": {def: ["test2", "plot:Line"], width: 2, color: "blue"}
			},
			levels: [
				{y: 0.0, color: "red", width:1, opacity: 0.4, dasharray: "20,4"}
			],
            margin: {
                top: 0,
                bottom: 5
            },
            y_scale: {autoscale: true, tick_interval: 1000, round: 5},
            collapsed: true
		}

	]
});
