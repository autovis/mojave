define({

	collection: "heikin-ashi",

    // geometry
    bar_width: 9,
    bar_padding: 3,

    margin: {
        left: 20,
        right: 50
    },

    maxsize: 60,
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
                {id: "ask_bid_radio", type: "radio", options: ["Ask", "Bid", "Both", "Mid"], selected: "Mid"}
            ]
        },

        // Ticks
		{
			title: "{{instrument}}  @TICK",
            anchor: "tick",
            height: 100,
            indicators: {
                "tick_ask": {def:["tick.ask", "vis:Line"], color:"#2196F3", width: 1},
                "tick_bid": {def:["tick.bid", "vis:Line"], color:"red", width: 1}
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
                "volvol": {def:["mid.volume,atr", "vis:VolVol"], vol_thres: 300, atr_thres: 3.0, thres_dist: 30},
                "ask_price": {def:["ha_ask", "vis:Price"], visible: ['$switch', "ask_bid_radio", {"Ask": true, "Both": true}, false], fillopacity: ['$switch', "ask_bid_radio", {'Both': 0.3}], wickoffset: ['$switch', "ask_bid_radio", {'Both': -0.1}]},
                "bid_price": {def:["ha_bid", "vis:Price"], visible: ['$switch', "ask_bid_radio", {"Bid": true, "Both": true}, false], dasharray: ['$switch', "ask_bid_radio", {'Both': "3,3"}], fillopacity: ['$switch', "ask_bid_radio", {'Both': 0.3}], wickoffset: ['$switch', "ask_bid_radio", {'Both': 0.1}]},
                "mid_price": {def:["ha_mid", "vis:Price"], visible: ['$switch', "ask_bid_radio", {"Mid": true}, false]}
                //"fast_ema_line": {def:["fast_ema", "vis:Line"], dasharray: "3,3", color: "orange"},
                //"slow_ema_line": {def:["slow_ema", "vis:Line"], color: "maroon"},
                //"trades-vis": {def:["trade_evts", "vis:Trade"]}
            },

            margin: {
                top: 5,
                bottom: 31
            },
            y_scale: {autoscale: true, price: true},
            show_x_labels: true
		},

        // Trade execution/management
        {
            type: "matrix",
            title: "Trade_Exec",
            anchor: "dual",
            indicators: {
                //"trigger": {name: 'Trigger'},
                //"entry": {name: 'Entry'}
            },
            margin: {
                top: 1,
                bottom: 1
            },
            collapsed: false
        },

        // RSI/StochRSI
		{
            title: "RSI/StochRSI",
            anchor: "dual",
            height: 100,
			indicators: {
				"srsi_med_line": {def: ["srsi_med", "vis:SharpSlopeColorLine"], threshold: 1, width: 2, colorscale: ["#f00", "#777", "#0d0"]}
			},
			levels: [
				{y: 80, color: "#800", width:1, opacity: 0.4, dasharray: "10,4"},
				{y: 50, color: "#59c", width:1, opacity: 0.7},
				{y: 20, color: "#800", width:1, opacity: 0.4, dasharray: "10,4"}
			],
            margin: {
                top: 0,
                bottom: 5
            },
            y_scale: {domain: [0, 100], tick_interval: 10},
            collapsed: false
		}


	]
});
