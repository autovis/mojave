define({

    description: "BollingerBar-based strategy",
	collection: "BB",

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
                    "Entries",
                    "Trade Log",
                    "(Both)"
                ]},
                {id: "trendlines_label", type: "label", text: "Trendlines"},
                {id: "trendlines_radio", type: "radio", options: [
                    "OFF",
                    "ON"
                ]}
            ]
        },

        // Ticks
		{
			title: "{{instrument}} @{{timestep}}",
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
            height: 400,
            indicators: {
                "m1_volvol": {def:["m1.mid.volume,m1.atr", "vis:VolVol"], vol_thres: 100, atr_thres: 3.0, thres_dist: 30},
                "m1_ask_candle_plot": {def:["m1.askbid.ask", "vis:Price"], visible: ['$switch', "ask_bid_radio", {"Ask": true, "Both": true}, false], fillopacity: ['$switch', "ask_bid_radio", {'Both': 0.3}], wickoffset: ['$switch', "ask_bid_radio", {'Both': -0.1}]},
                "m1_bid_candle_plot": {def:["m1.askbid.bid", "vis:Price"], visible: ['$switch', "ask_bid_radio", {"Bid": true, "Both": true}, false], dasharray: ['$switch', "ask_bid_radio", {'Both': "3,3"}], fillopacity: ['$switch', "ask_bid_radio", {'Both': 0.3}], wickoffset: ['$switch', "ask_bid_radio", {'Both': 0.1}]},
                "m1_mid_candle_plot": {def:["m1.mid", "vis:Price"], visible: ['$switch', "ask_bid_radio", {"Mid": true}, false]},
                "m1_zz_peaks": {def:["m1.zz.one,m1.zz.two", "vis:ThreePeaks"]}
                //"m1_markings_plot": {def:["m1.trends", "vis:Markings"]},
                //"m1_trade_plot": {def: ["trade_evts", "vis:Trade"]},
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
            },
            margin: {
                top: 1,
                bottom: 5
            },
            collapsed: false
        },

        // m5 price
		{
			title: "{{instrument}} @{{timestep}}",
            anchor: "m5.dual",
            height: 400,
            indicators: {
                "volvol": {def: ["m5.mid.volume,m5.atr", "vis:VolVol"], vol_thres: 300, atr_thres: 3.0, thres_dist: 30},
                //"pivot": {def:[{tf:"m5"},"dpivot", "vis:Pivot"], width: 1},
                // >> bb/dns bands
                "bb_mean_line": {def: ["bb.mean", "vis:SharpSlopeColorLine"], threshold: .00005, width: 2, opacity: 0.9},
                "bb_upper_band": {def: ["bb.upper", "vis:Line"], color: "#a83", opacity: 0.6, width: 2, suppress: true},
                "bb_lower_band": {def: ["bb.lower", "vis:Line"], color: "#a83", opacity: 0.6, width: 2, suppress: true},
                //"dnc_upper_band": {def: ["dnc.upper", "vis:Line"], color: "rgba(255,111,0,0.7)"},
                //"dnc_lower_band": {def: ["dnc.lower", "vis:Line"], color: "rgba(255,111,0,0.7)"},
                // >> candles
                "ask_price_candle": {def: ["m5.askbid.ask", "vis:Price"], visible: ['$switch', "ask_bid_radio", {"Ask": true, "Both": true}, false], fillopacity: ['$switch', "ask_bid_radio", {'Both': 0.3}], wickoffset: ['$switch', "ask_bid_radio", {'Both': -0.1}]},
                "bid_price_candle": {def: ["m5.askbid.bid", "vis:Price"], visible: ['$switch', "ask_bid_radio", {"Bid": true, "Both": true}, false], dasharray: ['$switch', "ask_bid_radio", {'Both': "3,3"}], fillopacity: ['$switch', "ask_bid_radio", {'Both': 0.3}], wickoffset: ['$switch', "ask_bid_radio", {'Both': 0.1}]},
                "mid_price_candle": {def: ["m5.mid", "vis:Price"], visible: ['$switch', "ask_bid_radio", {"Mid": true}, false]},
                // >> moving averages
				//"ema12_dely_line": {def: ["ema12_dely", "vis:SharpSlopeColorLine"], opacity: 1.0, threshold: 0.0001, width: 6, colorscale: ["#f00", "#777", "#0d0"]},
                // >> trade markings
                //"trend_trade_mark": {def: ["trades.trend", "vis:Trade"], visible: ['$switch', "strategy_radio", {"Trend": true}, false]},
                //"main_trade_mark": {def: ["trade_evts", "vis:Trade"], visible: ['$switch', "strategy_radio", {"(Combined)": true, "(Filter)": true}, false]},
                "zigzag_peaks": {def:["m5.zz.one,m5.zz.two,m5.zz.three", "vis:ThreePeaks"]},
                "m5_markings_plot": {def:["m5.trendlines", "vis:Markings"]}
            },
            selections: [
                {
                    id: "gfont_trade_log",
                    name: "Trade Log",
                    description: "",
                    base: null, // allow selection of any bar
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
                            //predict: ""
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
                    visible: ['$switch', 'selection_radio', {'Trade Log': true, '(Both)': true}, false]
                },
                {
                    id: "entries",
                    name: "Entries",
                    description: "Highlight predicted entries and add supplemental info",
                    base: null, // allow selection of any bar
                    color: "#369",
                    inputs: [
                        "m5.dual"
                    ],
                    tags: {
                        valid: {
                            type: "options",
                            label: "Valid signal?",
                            options: {
                                'Yes': true,
                                'No': false,
                                'N/A': null
                            }
                        },
                        dir: {
                            type: "options",
                            label: "Direction of Trade:",
                            options: {
                                'Long': 1,
                                'Short': -1,
                                'N/A': null
                            }
                        },
                        notes: {type: "text", label: "Notes:"}
                    },
                    visible: ['$switch', 'selection_radio', {'Entries': true, '(Both)': true}, false]
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

        // m5 matrix
        {
            type: "matrix",
            title: "m5",
            anchor: "m5.dual",
            indicators: {
                "m5_trending_dir_cell": {def: ["m5.trending.dir"]}
            },
            margin: {
                top: 1,
                bottom: 5
            },
            collapsed: false
        },

        // RSI/StochRSI
		{
            title: "RSI/StochRSI",
            anchor: "m5.dual",
            height: 100,
			indicators: {
                "rsi_fast_line": {def: ["rsi_fast", "vis:Line"], width: 2, dasharray: "4,4"},
				"srsi_fast_line": {def: ["srsi_fast", "vis:SharpSlopeColorLine"], threshold: 1, width: 2, colorscale: ["#f00", "#777", "#0d0"]},
				"srsi_med_line": {def: ["srsi_med", "vis:SharpSlopeColorLine"], threshold: 1, width: 4, colorscale: ["#f00", "#777", "#0d0"], opacity: 0.5}
			},
			levels: [
				{y: 80, color: "#800", width:1, opacity: 0.4, dasharray: "10,4"},
				{y: 50, color: "red", width:1, opacity: 0.7}, // #59c
				{y: 20, color: "#800", width:1, opacity: 0.4, dasharray: "10,4"}
			],
            margin: {
                top: 0,
                bottom: 5
            },
            y_scale: {domain: [0, 100], tick_interval: 10},
            collapsed: false
		},

        // OBV
		{
            title: "OBV",
            anchor: "m5.dual",
            height: 150,
			indicators: {
                "obv_trig_clr": {def: ["obv_ema", "vis:SharpSlopeColorLine"], threshold: 50, width: 2, opacity: 0.9},
				"obv_line": {def: ["obv", "vis:Line"], color: "rgb(217, 58, 248)", opacity: "0.6"}
			},
			levels: [
				{y: 0, color: "#59c", width: 1, opacity: 0.7},
			],
            margin: {
                top: 0,
                bottom: 30
            },
            y_scale: {autoscale: true, tick_interval: 1000, round: true},
            show_x_labels: true,
            collapsed: false
		}

	]
});
