define({

    description: "",
	collection: "2016-04",

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
                "dnc_upper_band": {def: ["dnc.upper", "vis:Line"], color: "rgba(255,111,0,0.7)"},
                "dnc_lower_band": {def: ["dnc.lower", "vis:Line"], color: "rgba(255,111,0,0.7)"},
                "upper_band_line": {def: [[["dnc.upper,bb.upper", "fn:Avg"]], "vis:Line"], color: "rgba(255,111,0,0.7)", opacity: 0.7, dasharray: "4,4"},
                "lower_band_line": {def: [[["dnc.lower,bb.lower", "fn:Avg"]], "vis:Line"], color: "rgba(255,111,0,0.7)", opacity: 0.7, dasharray: "4,4"},
                // >> candles
                "ask_price_candle": {def: ["askbid.ask", "vis:Price"], visible: ['$switch', "ask_bid_radio", {"Ask": true, "Both": true}, false], fillopacity: ['$switch', "ask_bid_radio", {'Both': 0.3}], wickoffset: ['$switch', "ask_bid_radio", {'Both': -0.1}]},
                "bid_price_candle": {def: ["askbid.bid", "vis:Price"], visible: ['$switch', "ask_bid_radio", {"Bid": true, "Both": true}, false], dasharray: ['$switch', "ask_bid_radio", {'Both': "3,3"}], fillopacity: ['$switch', "ask_bid_radio", {'Both': 0.3}], wickoffset: ['$switch', "ask_bid_radio", {'Both': 0.1}]},
                "mid_price_candle": {def: ["src_bar", "vis:Price"], visible: ['$switch', "ask_bid_radio", {"Mid": true}, false]},
                // >> moving averages
				//"ema12_dely_line": {def: ["ema12_dely", "vis:SharpSlopeColorLine"], opacity: 1.0, threshold: 0.0001, width: 6, colorscale: ["#f00", "#777", "#0d0"]},
                // >> trade markings
                "trend_trade_mark": {def: ["trades.trend", "vis:Trade"], visible: ['$switch', "strategy_radio", {"Trend": true}, false]},
                "rev_trade_mark": {def: ["trades.rev", "vis:Trade"], visible: ['$switch', "strategy_radio", {"Reversal": true}, false]},
                "s1_trade_mark": {def: ["trades.s1", "vis:Trade"], visible: ['$switch', "strategy_radio", {"Swing 1": true}, false]},
                "s3_trade_mark": {def: ["trades.s3", "vis:Trade"], visible: ['$switch', "strategy_radio", {"Swing 3": true}, false]},
                "master_trade_mark": {def: ["trade_evts", "vis:Trade"], visible: ['$switch', "strategy_radio", {"(Combined)": true}, false]}
            },
            selections: [
                /*
                {
                    id: "oppdiv",
                    name: "Oppos Diverg",
                    description: "Signal for formation of opposing divergence",
                    base: ["trend.base,rev.base,s1.base,s3.base", "dir:Or"],
                    color: "#468",
                    inputs: [
                        "dual"
                    ],
                    tags: {
                        dir: {
                            type: "options",
                            label: "Direction of divergence:",
                            options: {
                                'Short': -1,
                                'Flat': 0,
                                'Long': 1
                            }
                            //predict: ""
                        },
                        strength: {
                            type: "options",
                            label: "Strength of divergence:",
                            options: {
                                'N/A': null,
                                'Weak': 0.0,
                                'Average': 0.5,
                                'Strong': 1.0
                            }
                        },
                        notes: {type: "text", label: "Notes:"}
                    },
                    visible: ['$switch', 'selection_radio', {'Oppos Diverg': true}, false]
                },
                {
                    id: "bbm_bounce",
                    name: "BB.mean bounce",
                    description: "Signal for price bouncing off upper/lower bands",
                    base: ["trend.base,rev.base,s1.base,s3.base", "dir:Or"],
                    color: "#468",
                    inputs: [
                        [[[[[[["src", "EMA", 3]], "_:BarsAgo", 1]], "fn:Slope"]], "fn:Pow", 0.75],
                        [[["src_bar", "pip:Open2Close"]], "SMA", 2],
                        ["bb.mean,src_bar.close", "fn:RelativeTo"],
                        [[[[["bb.mean", "EMA", 3]], "fn:Slope"]], "fn:Pow", 0.75]
                    ],
                    tags: {
                        dir: {
                            type: "options",
                            label: "Direction of bounce:",
                            options: {
                                'Short': -1,
                                'Flat': 0,
                                'Long': 1
                            }
                            //predict: ""
                        },
                        strength: {
                            type: "options",
                            label: "Strength of signal:",
                            options: {
                                'N/A': null,
                                'Weak': 0.0,
                                'Average': 0.5,
                                'Strong': 1.0
                            }
                        },
                        notes: {type: "text", label: "Notes:"}
                    },
                    visible: ['$switch', 'selection_radio', {'BB.mean bounce': true}, false]
                },
                {
                    id: "bblu_bounce",
                    name: "BB.lu bounce",
                    description: "Signal for price bouncing off upper/lower bands",
                    base: ["trend.base,rev.base,s1.base,s3.base", "dir:Or"],
                    color: "#468",
                    inputs: [
                        "dual"
                    ],
                    tags: {
                        dir: {
                            type: "options",
                            label: "Direction of bounce:",
                            options: {
                                'Short': -1,
                                'Flat': 0,
                                'Long': 1
                            }
                            //predict: ""
                        },
                        strength: {
                            type: "options",
                            label: "Strength of signal:",
                            options: {
                                'N/A': null,
                                'Weak': 0.0,
                                'Average': 0.5,
                                'Strong': 1.0
                            }
                        },
                        notes: {type: "text", label: "Notes:"}
                    },
                    visible: ['$switch', 'selection_radio', {'BB.lu bounce': true}, false]
                },
                {
                    id: "trend_climate",
                    name: "Trend Climate",
                    description: "",
                    base: ["trend.base,rev.base", "dir:Or"],
                    color: "#468",
                    inputs: [
                        "dual"
                    ],
                    tags: {
                        dnc: {
                            type: "options",
                            label: "Donchian reflects trend?",
                            options: {
                                'N/A': null,
                                'Yes': true,
                                'No': false
                            }
                            //predict: ""
                        },
                        candle_size: {
                            type: "options",
                            label: "Candle length favorable?",
                            options: {
                                'N/A': null,
                                'Yes': true,
                                'No': false
                            }
                            //predict: ""
                        },
                        tails: {
                            type: "options",
                            label: "Tails are favorable?",
                            options: {
                                'N/A': null,
                                'Yes': true,
                                'No': false
                            }
                        },
                        notes: {type: "text", label: "Notes:"}
                    },
                    visible: ['$switch', 'selection_radio', {'Trend Climate': true}, false]
                },
                {
                    id: "swing_climate",
                    name: "Swing Climate",
                    description: "",
                    base: ["s1.base,s3.base", "dir:Or"],
                    color: "#468",
                    inputs: [
                        "dual"
                    ],
                    tags: {
                        dnc: {
                            type: "options",
                            label: "Donchian reflects swing conditions?",
                            options: {
                                'N/A': null,
                                'Yes': true,
                                'No': false
                            }
                            //predict: ""
                        },
                        candle_size: {
                            type: "options",
                            label: "Candle length favorable?",
                            options: {
                                'N/A': null,
                                'Yes': true,
                                'No': false
                            }
                            //predict: ""
                        },
                        tails: {
                            type: "options",
                            label: "Tails are favorable?",
                            options: {
                                'N/A': null,
                                'Yes': true,
                                'No': false
                            }
                        },
                        notes: {type: "text", label: "Notes:"}
                    },
                    visible: ['$switch', 'selection_radio', {'Swing Climate': true}, false]
                },
                */
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
                            //predict: ""
                        },
                        pips: {type: "text", label: "Pips:"},
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
                {id: "strategy_radio", type: "radio", options: ["- none -", "(Filtering)", "(Combined)", "Trend", "Reversal", "Swing 1", "Swing 3"]}
            ]
        },

        // Climate/filtering matrix
        {
            type: "matrix",
            title: "Filtering",
            anchor: "dual",
            indicators: {
                "base_clim": {name: "Hours/ATR/Volume", color: "rgba(177, 119, 13, 0.8)"},
                "cndl_clim": {name: "Candle length OK", color: "rgba(177, 119, 13, 0.8)"},
                "chan_width_clim": {name: "DNC/BB channel >= 12 pips", color: "rgba(177, 119, 13, 0.8)"},
                //"tail_clim": {name: "Tails OK"}
                "climate": {name: "MASTER FILTER", color: "red"},
                "trend_climate": {name: "Trend Filter"},
                "swing_climate": {name: "Swing Filter"}
            },
            margin: {
                top: 1,
                bottom: 5
            },
            collapsed: false,
            visible: ['$switch', 'strategy_radio', {'(Filtering)': true}, false]
        },

        // Strategy entry aggregate matrix
        {
            type: "matrix",
            title: "Strategy entries",
            anchor: "dual",
            indicators: {
                "trend.entry": {name: "Trend entry"},
                "rev.entry": {name: "Reversal entry"},
                "s1.entry": {name: "Swing #1 entry"},
                "s3.entry": {name: "Swing #3 entry"}
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
                "trend-2": {name: "MACD12 rising OR MACD > TL", def: ["macd_chk"]},
                "trend-3": {name: "STO3/RSI2 hook", def: ["storsi_trig"]},
                "trend.entry": {name: "ENTRY command"}
            },
            margin: {
                top: 1,
                bottom: 5
            },
            collapsed: false,
            visible: ['$switch', 'strategy_radio', {'Trend': true}, false]
        },

        // T-R :: Reversal matrix
        {
            type: "matrix",
            title: "REVERSAL",
            anchor: "dual",
            indicators: {
                "rev-pb": {name: "Pullback to BB-AL", def: ["trend_pullback"], color: "yellow"},
                "rev-cl": {name: "Trend Climate", def: ["trend_climate"], color: "rgba(243, 173, 45, 0.8)"},
                "rev-0":  {name: "Preceded by opp. trend", def: [[["ema12_dely", "dir:Direction"]], "dir:Flip"]},
                "rev-1":  {name: "BB-A direction", def: ["src,bb.mean", "dir:RelativeTo"]},
                "rev-2": {name: "MACD12 rising OR MACD > TL", def: ["macd_chk"]},
                "rev-3": {name: "STO3 hooks from 20/80", def: ["storsi_trig"]},
                "rev.entry": {name: "ENTRY command"}
            },
            margin: {
                top: 1,
                bottom: 5
            },
            collapsed: false,
            visible: ['$switch', 'strategy_radio', {'Reversal': true}, false]
        },

        // S1 :: Swing #1 matrix
        {
            type: "matrix",
            title: "SWING #1",
            anchor: "dual",
            indicators: {
                "s1-cl": {name: "Swing Climate", def: ["swing_climate"], color: "rgba(243, 173, 45, 0.8)"},
                "s1-test1": {name: "STO14 <20", def:["srsi_slow", "dir:ThresholdFlip", [80, 20]]},
                "s1-test2": {name: "STO14 comes from >50", def:[[["srsi_slow", "dir:Threshold", [50]]], "_:BarsAgo", 6]},
                ///
                "s1-1": {name: "STO14 <20 &from >50", def: [[
                    ["srsi_slow", "dir:ThresholdFlip", [80, 20]],
                    [[["srsi_slow", "dir:Threshold", [50]]], "_:BarsAgo", 6]
                ], "dir:And"], color: "rgba(243, 173, 45, 0.8)"},
                "s1-2":  {name: "STO3/RSI2 hook", def: ["storsi_trig"]},
                "s1.entry": {name: "ENTRY -- Trade commands"}
            },
            margin: {
                top: 1,
                bottom: 5
            },
            collapsed: false,
            visible: ['$switch', 'strategy_radio', {'Swing 1': true}, false]
        },

        // S3 :: Swing #3 matrix
        /*
        {
            type: "matrix",
            title: "SWING #3",
            anchor: "dual",
            indicators: {
                "s3-cl": {name: "Swing Climate", def: ["swing_climate"], color: "rgba(243, 173, 45, 0.8)"},
                "s3-1": {name: "STO14 green", def: ["srsi_slow", "dir:Direction"]},
                "s3-2": {name: "STO14 coming from <20", def: [[["srsi_slow", "dir:ThresholdFlip", [80, 20]]], "_:Sticky", 6]},
                "s3-3": {name: "STO14 is <50", def: ["srsi_slow", "dir:ThresholdFlip", [50]]},
                "s3-4": {name: "MACD12 green", def: ["macd12", "dir:Direction"]},
                "s3-6": {name: "OBV.SDL green", def: ["obv_sdl", "dir:Direction"]},
                "s3-7": {name: "STO3/RSI2 hook", def: ["storsi_trig"]},
                "s3.entry": {name: "ENTRY -- Trade commands"}
            },
            margin: {
                top: 1,
                bottom: 5
            },
            collapsed: false,
            visible: ['$switch', 'strategy_radio', {'Swing 3': true}, false]
        },
        */

        // Exit strategy - matrix
        /*
        {
            type: "matrix",
            title: "exit strategy",
            anchor: "dual",
            indicators: {
                "exit_strat": {name: "exit"}
            },
            margin: {
                top: 1,
                bottom: 5
            },
            collapsed: false
        },
        */

        // RSI/StochRSI
		{
            title: "RSI/StochRSI",
            anchor: "dual",
            height: 100,
			indicators: {
                "rsi_fast_line": {def: ["rsi_fast", "vis:Line"], width: 2, dasharray: "4,4"},
				"srsi_fast_line": {def: ["srsi_fast", "vis:SharpSlopeColorLine"], threshold: 1, width: 2, colorscale: ["#f00", "#777", "#0d0"]},
                "srsi_med_line": {def: ["srsi_med", "vis:SharpSlopeColorLine"], opacity: 0.7, threshold: 5, width: 4, colorscale: ["#f00", "#777", "#0d0"]},
				"srsi_slow_line": {def: ["srsi_slow", "vis:SharpSlopeColorLine"], opacity: 0.4, threshold: 5, width: 8, colorscale: ["#f00", "#777", "#0d0"]}
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

        // MACD12
		{
            title: "MACD12",
            anchor: "dual",
            height: 70,
			indicators: {
				"macd12_line": {def: ["macd12", "vis:SharpSlopeColorLine"], threshold: .00003, dasharray: "8,4", opacity: "0.7"},
				"macd12_tl_line": {def: ["macd12_tl", "vis:SharpSlopeColorLine"], threshold: .00003, width: 3.0, opacity: "0.8"}
			},
			levels: [
				{y: 0, color: "#59c", width: 1, opacity: 0.7},
			],
            margin: {
                top: 0,
                bottom: 0
            },
            y_scale: {autoscale: true, tick_interval: 1000, round: 5},
            collapsed: false
		},

        // OBV
		{
            title: "OBV",
            anchor: "dual",
            height: 150,
			indicators: {
                "obv_trig_clr": {def: ["obv_ema", "vis:SharpSlopeColorLine"], threshold: 50, width: 2, opacity: 0.9},
				"obv_line": {def: ["obv", "vis:Line"], color: "rgb(217, 58, 248)", opacity: "0.6"},
                "obv_sdl_clr": {def: ["obv_sdl", "vis:SharpSlopeColorLine"], threshold: 50, width: 2,  dasharray: "8,4", opacity: 0.8}
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
            collapsed: true
		},

		// Candle length
        {
            title: "Candle length",
            anchor: "dual",
            height: 80,
			indicators: {
                "cndl_len_line": {def: ["cndl_len", "vis:Line"], width: 2}
			},
			levels: [
				{y: 5.0, color: "blue", width:1, opacity: 0.7},
				{y: 0.0, color: "#a83", width:1, opacity: 0.4, dasharray: "20,4"}
			],
            margin: {
                top: 0,
                bottom: 5
            },
            y_scale: {autoscale: true, tick_interval: 1000, round: 5},
            //visible: ['$switch', 'strategy_radio', {'(Filtering)': true}, false]
		},

		// BB/DNC width
        {
            title: "BB/DNC width",
            anchor: "dual",
            height: 80,
			indicators: {
                "chan_width_line": {def: ["chan_width", "vis:Line"], width: 2, color: '#ab3'}
			},
			levels: [
				{y: 12.0, color: "red", width:1, opacity: 0.7},
				{y: 0.0, color: "#a83", width:1, opacity: 0.4, dasharray: "20,4"}
			],
            margin: {
                top: 0,
                bottom: 5
            },
            y_scale: {autoscale: true, tick_interval: 1000, round: 5},
            //visible: ['$switch', 'strategy_radio', {'(Filtering)': true}, false]
		}
        // HTF
        /*
        {
            title: "HTF ({{timestep}})",
            anchor: "m30",
            height: 100,
            indicators: {
                // TODO: Fix below --
                //"volvol_htf": {def:[["$xs", ["m30.volume"], ["m30", "ATR", 9]], "vis:VolVol"], vol_thres: 18000, atr_thres: 24, thres_dist: 20},
                "htf_price": {def:["m30", "vis:Price"]}, // candles
                //"sdl_m30_line": {def:[["m30.close", "SDL", 34], "vis:SharpSlopeColorLine"], threshold: .0001, width: 5, opacity: 0.6},
            },
            margin: {
                top: 5,
                bottom: 31
            },
            y_scale: {
                autoscale: true,
                price: true
            },
            show_x_labels: true,
            collapsed: true
        }
        */
	]
});
