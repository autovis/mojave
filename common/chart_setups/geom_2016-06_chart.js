define({

    description: "",
	collection: "geom_2016-06",

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
            height: 300,
            indicators: {
                "m1_volvol": {def:["m1.mid.volume,m1.atr", "vis:VolVol"], vol_thres: 100, atr_thres: 3.0, thres_dist: 30},
                "m1_ask_candle_plot": {def:["m1.ask", "vis:Price"], visible: ['$switch', "ask_bid_radio", {"Ask": true, "Both": true}, false], fillopacity: ['$switch', "ask_bid_radio", {'Both': 0.3}], wickoffset: ['$switch', "ask_bid_radio", {'Both': -0.1}]},
                "m1_bid_candle_plot": {def:["m1.bid", "vis:Price"], visible: ['$switch', "ask_bid_radio", {"Bid": true, "Both": true}, false], dasharray: ['$switch', "ask_bid_radio", {'Both': "3,3"}], fillopacity: ['$switch', "ask_bid_radio", {'Both': 0.3}], wickoffset: ['$switch', "ask_bid_radio", {'Both': 0.1}]},
                "m1_mid_candle_plot": {def:["m1.mid", "vis:Price"], visible: ['$switch', "ask_bid_radio", {"Mid": true}, false]},
                "m1_zz_peaks": {def:["m1.zz.one,m1.zz.two,m1.zz.three", "vis:ThreePeaks"]},
                "m1_markings_plot": {def:["m1.trends", "vis:Markings"]}
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

        // m5 candles
		{
			title: "{{instrument}}  @m5",
            anchor: "m5.dual",
            height: 800,
            indicators: {
                "m5_volvol": {def:["m5.mid.volume,m5.atr", "vis:VolVol"], vol_thres: 300, atr_thres: 3.0, thres_dist: 30},
                "ema10_line": {def:[[["m5.mid.close", "EMA", 10]], "vis:Line"], opacity: 0.1, width: 7.0, color: "white"},
                "m5_ask_candle_plot": {def:["m5.ask", "vis:Price"], visible: ['$switch', "ask_bid_radio", {"Ask": true, "Both": true}, false], fillopacity: ['$switch', "ask_bid_radio", {'Both': 0.3}], wickoffset: ['$switch', "ask_bid_radio", {'Both': -0.1}]},
                "m5_bid_candle_plot": {def:["m5.bid", "vis:Price"], visible: ['$switch', "ask_bid_radio", {"Bid": true, "Both": true}, false], dasharray: ['$switch', "ask_bid_radio", {'Both': "3,3"}], fillopacity: ['$switch', "ask_bid_radio", {'Both': 0.3}], wickoffset: ['$switch', "ask_bid_radio", {'Both': 0.1}]},
                "m5_mid_candle_plot": {def:["m5.mid", "vis:Price"], visible: ['$switch', "ask_bid_radio", {"Mid": true}, false]},
                "ema5_line": {def:[[["m5.mid.close", "EMA", 5]], "vis:SharpSlopeColorLine"], width: 1.0, threshold: 0},
                "frac_peaks": {def:["frac", "vis:MultiPeaks"]},
                "m5_zz_peaks": {def:["m5.zz.one,m5.zz.two,m5.zz.three", "vis:ThreePeaks"]},
                "m5_markings_plot": {def:["m5.trends", "vis:Markings"]},
                "main_trade_mark": {def: ["trade_evts", "vis:Trade"]},
            },

            selections: [
                {
                    id: "gfont_trade_log",
                    name: "Trade Log",
                    description: "",
                    base: null,
                    color: "maroon",
                    inputs: [
                        "m5.dual"
                    ],
                    tags: {
                        dir: {
                            type: "options",
                            label: "Direction of Trade:",
                            options: {
                                'Long': 1,
                                'Short': -1,
                                'N/A': null
                            }
                        },
                        action: {
                            type: "options",
                            label: "Action:",
                            options: {
                                "Executed": "executed",
                                "Missed": "missed",
                                "Skipped": "skipped"
                            }
                        },
                        pips: {type: "text", label: "Pips:"},
                        strategy: {
                            type: "options",
                            label: "Strategy:",
                            options: {
                                'T': 'T',
                                'PT': 'PT',
                                'T-R': 'T-R',
                                'S1': 'S1'
                            }
                        },
                        notes: {type: "text", label: "Notes:"}
                    },
                    visible: ['$switch', 'selection_radio', {'Trade Log': true}, false]
                }
            ], // end selections

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

        // H1 candles
		{
			title: "{{instrument}}  @H1",
            anchor: "H1.dual",
            height: 250,
            indicators: {
                "H1_volvol": {def:["H1.mid.volume,H1.atr", "vis:VolVol"], vol_thres: 2000, atr_thres: 40.0, thres_dist: 20},
                "H1_ask_candle_plot": {def:["H1.ask", "vis:Price"], visible: ['$switch', "ask_bid_radio", {"Ask": true, "Both": true}, false], fillopacity: ['$switch', "ask_bid_radio", {'Both': 0.3}], wickoffset: ['$switch', "ask_bid_radio", {'Both': -0.1}]},
                "H1_bid_candle_plot": {def:["H1.bid", "vis:Price"], visible: ['$switch', "ask_bid_radio", {"Bid": true, "Both": true}, false], dasharray: ['$switch', "ask_bid_radio", {'Both': "3,3"}], fillopacity: ['$switch', "ask_bid_radio", {'Both': 0.3}], wickoffset: ['$switch', "ask_bid_radio", {'Both': 0.1}]},
                "H1_mid_candle_plot": {def:["H1.mid", "vis:Price"], visible: ['$switch', "ask_bid_radio", {"Mid": true}, false]},
                "H1_zz_peaks": {def:["H1.zz.one,H1.zz.two,H1.zz.three", "vis:ThreePeaks"]},
                "H1_markings_plot": {def:["H1.trends", "vis:Markings"]},
                "dpivot_lines": {def: ["dpivots", "vis:Pivot"], width: 1}
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

        // Strategy matrix
        {
            type: "matrix",
            title: "Geom Strategy",
            anchor: "m5.dual",
            indicators: {
                "near_dip_long": {def: ['near_dip.long']},
                "near_dip_short": {def: ['near_dip.short']},
                "pullback": {name: "Pullback (EMA5)"},
                "bounce": {def: ["bounce.dir"], name: "Trend Bounce"},
                "nsnd": {name: "NSND"}
            },
            margin: {
                top: 1,
                bottom: 5
            },
            collapsed: false
        },

		// Chop
        {
            title: "CHOP",
            anchor: "m5.dual",
            height: 80,
			indicators: {
                "chop_line": {def: ["chop", "vis:Line"], width: 2, color: "blue"}
			},
			levels: [
				{y: 0.0, color: "red", width:1, opacity: 0.4, dasharray: "20,4"}
			],
            margin: {
                top: 0,
                bottom: 5
            },
            y_scale: {domain: [0, 1], tick_interval: 0.1},
            collapsed: false
		}

	]
});
