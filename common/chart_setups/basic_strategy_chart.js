define({

    description: "Basic strategy chart setup",
	collection: "basic_strategy",

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

        // Price
		{
			title: "{{instrument}}  @  {{timestep}}",
            anchor: "dual",
            height: 400,
            indicators: {
                "volvol": {def:["mid.volume,atr", "plot:VolVol"], vol_thres: 300, atr_thres: 3.0, thres_dist: 30},
                "ask_price": {def:["askbid.ask", "plot:Candle"], visible: ['$switch', "ask_bid_radio", {"Ask": true, "Both": true}, false], fillopacity: ['$switch', "ask_bid_radio", {'Both': 0.3}], wickoffset: ['$switch', "ask_bid_radio", {'Both': -0.1}]},
                "bid_price": {def:["askbid.bid", "plot:Candle"], visible: ['$switch', "ask_bid_radio", {"Bid": true, "Both": true}, false], dasharray: ['$switch', "ask_bid_radio", {'Both': "3,3"}], fillopacity: ['$switch', "ask_bid_radio", {'Both': 0.3}], wickoffset: ['$switch', "ask_bid_radio", {'Both': 0.1}]},
                "mid_price": {def:["mid", "plot:Candle"], visible: ['$switch', "ask_bid_radio", {"Mid": true}, false]},
                "fast_ema_line": {def:["fast_ema", "plot:Line"], dasharray: "3,3", color: "orange"},
                "slow_ema_line": {def:["slow_ema", "plot:Line"], color: "maroon"},
                "trades-vis": {def:["trade_evts", "plot:Trade"]}
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

        // Trade execution/management
        {
            type: "matrix",
            title: "Trade_Exec",
            anchor: "dual",
            indicators: {
                "trigger": {name: 'Trigger'},
                "entry": {name: 'Entry'}
            },
            margin: {
                top: 1,
                bottom: 1
            },
            collapsed: false
        }

	]
});
