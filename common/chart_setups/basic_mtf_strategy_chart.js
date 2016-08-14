define({

    description: "Basic MTF strategy chart setup",
	collection: "basic_mtf_strategy",

    // geometry
    bar_width: 9,
    bar_padding: 3,

    margin: {
        left: 20,
        right: 50
    },

    maxsize: 100,
    //show_labels: 'both',

    // behavior
    pan_and_zoom: false,

	components: [

        // Chart Panel
        {
            type: "panel",
            anchor: "m1.dual",
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

        // M1 price
		{
			title: "{{instrument}}  @  M1",
            anchor: "m1.dual",
            height: 400,
            indicators: {
                "m1_volvol": {def:["m1.mid.volume,m1.atr", "vis:VolVol"], vol_thres: 300, atr_thres: 3.0, thres_dist: 30},
                "m1_ask_candles": {def:["m1.askbid.ask", "vis:Price"], visible: ['$switch', "ask_bid_radio", {"Ask": true, "Both": true}, false], fillopacity: ['$switch', "ask_bid_radio", {'Both': 0.3}], wickoffset: ['$switch', "ask_bid_radio", {'Both': -0.1}]},
                "m1_bid_candles": {def:["m1.askbid.bid", "vis:Price"], visible: ['$switch', "ask_bid_radio", {"Bid": true, "Both": true}, false], dasharray: ['$switch', "ask_bid_radio", {'Both': "3,3"}], fillopacity: ['$switch', "ask_bid_radio", {'Both': 0.3}], wickoffset: ['$switch', "ask_bid_radio", {'Both': 0.1}]},
                "m1_mid_candles": {def:["m1.mid", "vis:Price"], visible: ['$switch', "ask_bid_radio", {"Mid": true}, false]},
                "fast_ema_line": {def:["fast_ema", "vis:Line"], dasharray: "3,3", color: "orange"},
                "slow_ema_line": {def:["slow_ema", "vis:Line"], color: "maroon"},
                "m1_trades_vis": {def:["trade_evts", "vis:Trade"]}
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
            anchor: "m1.dual",
            indicators: {
                "htf_ema_dir": {name: "HTF EMA"},
                "trigger": {name: 'Trigger'},
                "entry": {name: 'Entry'}
            },
            margin: {
                top: 1,
                bottom: 1
            },
            collapsed: false
        },

        // M5 price
		{
			title: "{{instrument}}  @  M5",
            anchor: "m5.dual",
            height: 400,
            indicators: {
                "m1_volvol": {def:["m5.mid.volume,m5.atr", "vis:VolVol"], vol_thres: 300, atr_thres: 3.0, thres_dist: 30},
                "m5_ask_price": {def:["m5.askbid.ask", "vis:Price"], visible: ['$switch', "ask_bid_radio", {"Ask": true, "Both": true}, false], fillopacity: ['$switch', "ask_bid_radio", {'Both': 0.3}], wickoffset: ['$switch', "ask_bid_radio", {'Both': -0.1}]},
                "m5_bid_price": {def:["m5.askbid.bid", "vis:Price"], visible: ['$switch', "ask_bid_radio", {"Bid": true, "Both": true}, false], dasharray: ['$switch', "ask_bid_radio", {'Both': "3,3"}], fillopacity: ['$switch', "ask_bid_radio", {'Both': 0.3}], wickoffset: ['$switch', "ask_bid_radio", {'Both': 0.1}]},
                "m5_mid_candles": {def:["m5.mid", "vis:Price"], visible: ['$switch', "ask_bid_radio", {"Mid": true}, false]},
                "htf_ema_line": {def:["htf_ema", "vis:SharpSlopeColorLine"], width: 5, opacity: 0.6}
                //"m5_trades_vis": {def:["trade_evts", "vis:Trade"]}
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
		}

	]
});
