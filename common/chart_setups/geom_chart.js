define({

    description: "",
	collection: "geom",

    streams: [],

    // chart-level indicators
    indicators: {},

    // geometry
    bar_width: 9,
    bar_padding: 3,

    margin: {
        left: 20,
        right: 250
    },

    maxsize: 180,
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
                {id: "selection_label", type: "label", text: "Selection:"},
                {id: "selection_radio", type: "radio", options: [
                    "- none -",
                    "Trade Log"
                ]}
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

        // m1 candles
		{
			title: "{{instrument}}  @m1",
            anchor: "m1.dual",
            height: 500,
            indicators: {
                "m1_volvol": {def:["m1.mid.volume,m1.atr", "vis:VolVol2"], vol_thres: 100, atr_thres: 3.0, thres_dist: 100},
                "m1_ask_candle_plot": {def:["m1.ask", "vis:Price"], visible: ['$switch', "ask_bid_radio", {"Ask": true, "Both": true}, false], fillopacity: ['$switch', "ask_bid_radio", {'Both': 0.3}], wickoffset: ['$switch', "ask_bid_radio", {'Both': -0.1}]},
                "m1_bid_candle_plot": {def:["m1.bid", "vis:Price"], visible: ['$switch', "ask_bid_radio", {"Bid": true, "Both": true}, false], dasharray: ['$switch', "ask_bid_radio", {'Both': "3,3"}], fillopacity: ['$switch', "ask_bid_radio", {'Both': 0.3}], wickoffset: ['$switch', "ask_bid_radio", {'Both': 0.1}]},
                "m1_mid_candle_plot": {def:["m1.mid", "vis:Price"], visible: ['$switch', "ask_bid_radio", {"Mid": true}, false]},
                "m1_ema5_line": {def:[[["m1.mid.close", "EMA", 5]], "vis:SharpSlopeColorLine"], width: 1.0, threshold: 0},
                "m1_highlow_peaks": {def:["m1.highlow.one,m1.highlow.two", "vis:ThreePeaks"]},
                "m1_markings_plot": {def:["m1.polys", "vis:Markings"]},
                "m1_trade_plot": {def: ["trade_evts", "vis:Trade"]}
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

        // m1 matrix
        {
            type: "matrix",
            title: "m1 matrix",
            anchor: "m1.dual",
            indicators: {
                "m1_m5_trend_bnc_vis": {def: ["m1.m5_trend_bnc"]},
                "m1_trend_bnc_vis": {def: ['m1.trend_bnc']},
                "trend_entry": {def: ['m1.trend.entry']},
                "geom_trades": {def: ['m1.trades']}
            },
            margin: {
                top: 1,
                bottom: 5
            },
            collapsed: false
        },

        // m5 candles
		{
			title: "{{instrument}}  @m5",
            anchor: "m5.dual",
            height: 800,
            indicators: {
                "m5_volvol": {def:["m5.mid.volume,m5.atr", "vis:VolVol"], vol_thres: 300, atr_thres: 3.0, thres_dist: 30},
                //"ema10_line": {def:[[["m5.mid.close", "EMA", 10]], "vis:Line"], opacity: 0.1, width: 7.0, color: "white"},
                "m5_ask_candle_plot": {def:["m5.ask", "vis:Price"], visible: ['$switch', "ask_bid_radio", {"Ask": true, "Both": true}, false], fillopacity: ['$switch', "ask_bid_radio", {'Both': 0.3}], wickoffset: ['$switch', "ask_bid_radio", {'Both': -0.1}]},
                "m5_bid_candle_plot": {def:["m5.bid", "vis:Price"], visible: ['$switch', "ask_bid_radio", {"Bid": true, "Both": true}, false], dasharray: ['$switch', "ask_bid_radio", {'Both': "3,3"}], fillopacity: ['$switch', "ask_bid_radio", {'Both': 0.3}], wickoffset: ['$switch', "ask_bid_radio", {'Both': 0.1}]},
                "m5_mid_candle_plot": {def:["m5.mid", "vis:Price"], visible: ['$switch', "ask_bid_radio", {"Mid": true}, false]},
                "m5_ema5_line": {def:[[["m5.mid.close", "EMA", 5]], "vis:SharpSlopeColorLine"], width: 1.0, threshold: 0},
                "m5_highlow_peaks": {def:["m5.highlow.one,m5.highlow.two,m5.highlow.three", "vis:ThreePeaks"]},
                "m5_markings_plot": {def:["m5.polys", "vis:Markings"]}
                //"m5_trade_plot": {def: ["trade_evts", "vis:Trade"]}
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

        // m5 matrix
        {
            type: "matrix",
            title: "m5 matrix",
            anchor: "m5.dual",
            indicators: {
                "m5_trend_bnc_vis": {def: ["m5.trend_bnc"]}
            },
            margin: {
                top: 1,
                bottom: 5
            },
            collapsed: false
        },

        // m30 candles
		{
			title: "{{instrument}}  @m30",
            anchor: "m30.dual",
            height: 250,
            indicators: {
                "m30_volvol": {def:["m30.mid.volume,m30.atr", "vis:VolVol"], vol_thres: 2000, atr_thres: 40.0, thres_dist: 20},
                "m30_ask_candle_plot": {def:["m30.ask", "vis:Price"], visible: ['$switch', "ask_bid_radio", {"Ask": true, "Both": true}, false], fillopacity: ['$switch', "ask_bid_radio", {'Both': 0.3}], wickoffset: ['$switch', "ask_bid_radio", {'Both': -0.1}]},
                "m30_bid_candle_plot": {def:["m30.bid", "vis:Price"], visible: ['$switch', "ask_bid_radio", {"Bid": true, "Both": true}, false], dasharray: ['$switch', "ask_bid_radio", {'Both': "3,3"}], fillopacity: ['$switch', "ask_bid_radio", {'Both': 0.3}], wickoffset: ['$switch', "ask_bid_radio", {'Both': 0.1}]},
                "m30_mid_candle_plot": {def:["m30.mid", "vis:Price"], visible: ['$switch', "ask_bid_radio", {"Mid": true}, false]},
                //"m30_highlow_peaks": {def:["m30.highlow.one,m30.highlow.two,m30.highlow.three", "vis:ThreePeaks"]},
                //"m30_markings_plot": {def:["m30.trends", "vis:Markings"]},
                "pivot_lines": {def: ["dpivots", "vis:Pivot"], width: 1}
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
		}

	]
});
