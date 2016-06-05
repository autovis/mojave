define({

    description: "",
	collection: "2016-06_BB",

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
                    "Entries",
                    "Trade Log",
                    "(Both)"
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

        // Price
		{
			title: "{{instrument}} @{{timestep}}",
            anchor: "dual",
            height: 400,
            indicators: {
                "volvol": {def: ["src_bar.volume,atr", "vis:VolVol"], vol_thres: 300, atr_thres: 3.0, thres_dist: 30},
                //"pivot": {def:[{tf:"m5"},"dpivot", "vis:Pivot"], width: 1},
                // >> bb/dns bands
                "bb_mean_line": {def: ["bb.mean", "vis:SharpSlopeColorLine"], threshold: .00005, width: 2, opacity: 0.9},
                "bb_upper_band": {def: ["bb.upper", "vis:Line"], color: "#a83", opacity: 0.6, width: 2, suppress: true},
                "bb_lower_band": {def: ["bb.lower", "vis:Line"], color: "#a83", opacity: 0.6, width: 2, suppress: true},
                //"dnc_upper_band": {def: ["dnc.upper", "vis:Line"], color: "rgba(255,111,0,0.7)"},
                //"dnc_lower_band": {def: ["dnc.lower", "vis:Line"], color: "rgba(255,111,0,0.7)"},
                // >> candles
                "ask_price_candle": {def: ["askbid.ask", "vis:Price"], visible: ['$switch', "ask_bid_radio", {"Ask": true, "Both": true}, false], fillopacity: ['$switch', "ask_bid_radio", {'Both': 0.3}], wickoffset: ['$switch', "ask_bid_radio", {'Both': -0.1}]},
                "bid_price_candle": {def: ["askbid.bid", "vis:Price"], visible: ['$switch', "ask_bid_radio", {"Bid": true, "Both": true}, false], dasharray: ['$switch', "ask_bid_radio", {'Both': "3,3"}], fillopacity: ['$switch', "ask_bid_radio", {'Both': 0.3}], wickoffset: ['$switch', "ask_bid_radio", {'Both': 0.1}]},
                "mid_price_candle": {def: ["src_bar", "vis:Price"], visible: ['$switch', "ask_bid_radio", {"Mid": true}, false]},
                // >> moving averages
				//"ema12_dely_line": {def: ["ema12_dely", "vis:SharpSlopeColorLine"], opacity: 1.0, threshold: 0.0001, width: 6, colorscale: ["#f00", "#777", "#0d0"]},
                // >> trade markings
                "trend_trade_mark": {def: ["trades.trend", "vis:Trade"], visible: ['$switch', "strategy_radio", {"Trend": true}, false]},
                "main_trade_mark": {def: ["trade_evts", "vis:Trade"], visible: ['$switch', "strategy_radio", {"(Combined)": true, "(Filter)": true}, false]},
                "zigzag_peaks": {def:["zz.one,zz.two,zz.three", "vis:ThreePeaks"]}
            },
            selections: [
                {
                    id: "gfont_trade_log",
                    name: "Trade Log",
                    description: "",
                    base: null, // allow selection of any bar
                    color: "maroon",
                    inputs: [
                        "dual"
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
                        pips: {type: "text", label: "Pips:"},
                        strategy: {
                            type: "options",
                            label: "Strategy:",
                            options: {
                                'T': 'T',
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
                        "dual"
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

        // Strategy Panel
        {
            type: "panel",
            anchor: "dual",
            height: 30,
            margin: {
                top: 3,
                bottom: 3
            },
            controls: [
                {id: "strategy_label", type: "label", text: "Strategy:"},
                {id: "strategy_radio", type: "radio", options: ["(Combined)", "Trend", "(Filter)"]}
            ]
        },

        // Climate/filtering matrix
        {
            type: "matrix",
            title: "Filtering",
            anchor: "dual",
            indicators: {
                "near_dip_long": {def: ['near_dip.long']},
                "near_dip_short": {def: ['near_dip.short']},
                "base_clim": {name: "Hours/ATR/Volume", color: "rgba(177, 119, 13, 0.8)"},
                "chan_width_clim": {name: "BB width >= 3xATR", color: "rgba(177, 119, 13, 0.8)"},
                "climate": {name: "MAIN FILTER", color: "red"},
                "trend_climate": {name: "Trend Filter"}
            },
            margin: {
                top: 1,
                bottom: 5
            },
            collapsed: false,
            visible: ['$switch', 'strategy_radio', {'(Filter)': true}, false]
        },

        // Strategy entry aggregate matrix
        {
            type: "matrix",
            title: "Strategy entries",
            anchor: "dual",
            indicators: {
                "trend.entry": {name: "Trend entry"}
            },
            margin: {
                top: 1,
                bottom: 5
            },
            collapsed: false,
            visible: ['$switch', 'strategy_radio', {'(Combined)': true}, false]
        },

        // T :: Trend matrix
        {
            type: "matrix",
            title: "TREND",
            anchor: "dual",
            indicators: {
                "trend-pb": {name: "Pullback to BB-AL", def: ["trend_pullback"], color: "yellow"},
                "trend-cl": {name: "Trend Climate", def: ["trend_climate"], color: "rgba(243, 173, 45, 0.8)"},
                "trend-1": {name: "BB-A direction", def: ["src,bb.mean", "dir:RelativeTo"]},
                //"trend-2": {name: "%B outside threshold", def: ["percb", "dir:Calc", "$1 > ${percb_thres} ? 1 : ($1 < -${percb_thres} ? -1 : 0)"]},
                "trend-4": {name: "STO3/RSI2 hook", def: ["storsi_trig"]},
                "trend.entry": {name: "ENTRY command"}
            },
            margin: {
                top: 1,
                bottom: 5
            },
            collapsed: false,
            visible: ['$switch', 'strategy_radio', {'Trend': true}, false]
        },

        // RSI/StochRSI
		{
            title: "RSI/StochRSI",
            anchor: "dual",
            height: 100,
			indicators: {
                "rsi_fast_line": {def: ["rsi_fast", "vis:Line"], width: 2, dasharray: "4,4"},
				"srsi_fast_line": {def: ["srsi_fast", "vis:SharpSlopeColorLine"], threshold: 1, width: 2, colorscale: ["#f00", "#777", "#0d0"]}
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
		},

        // %B
		{
            title: "%B",
            anchor: "dual",
            height: 100,
			indicators: {
                "percb_line": {def: ["percb", "vis:Line"], width: 2},
                "percb_sdl8_line": {def: ["percb_sdl8", "vis:SharpSlopeColorLine"], width: 2, threshold: 0.01},
                "percb_pbma_line": {def: [[["percb", "SDL", 4]], "vis:Line"], width: 1, color: "red", dasharray: "5,5", threshold: 0.01}
			},
			levels: [
				{y: 1.0, color: "rgb(170, 136, 51)", width:2, opacity: 0.7},
				{y: 0.7, color: "red", width:1, opacity: 0.5, dasharray: "5,5"},
				{y: 0.5, color: "#59c", width: 1, opacity: 0.8},
				{y: 0.3, color: "red", width:1, opacity: 0.5, dasharray: "5,5"},
				{y: 0.0, color: "rgb(170, 136, 51)", width:2, opacity: 0.7}
			],
            margin: {
                top: 0,
                bottom: 5
            },
            y_scale: {domain: [-0.25, 1.25], tick_interval: 0.25},
            collapse: false
		},

        // OBV
		{
            title: "OBV",
            anchor: "dual",
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
