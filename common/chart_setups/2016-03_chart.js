define({

    description: "",
	collection: "2016-03",

    streams: [],

    // chart-level indicators
    indicators: {},

    // geometry
    bar_width: 9,
    bar_padding: 3,

    margin: {
        left: 5,
        right: 250
    },

    maxsize: 121,
    //show_labels: 'both',

    // behavior
    pan_and_zoom: false,

	components: [

        // Control Panel
        {
            type: "panel",
            anchor: "dual",
            height: 30,
            margin: {
                top: 15,
                bottom: 0
            },
            controls: {
                "price_type_label": {type: "label", text: "Price type:"},
                "ask_bid_radio": {type: "radio", options: ["Ask", "Bid", "Both", "Mid"], selected: "Mid"},
                "selection_label": {type: "label", text: "Selection:"},
                "selection_radio": {type: "radio", options: [
                    "- none -",
                    "Trend Climate",
                    "T Trig",
                    "Swing Climate"
                ], selected: null}
            }
        },

        // Ticks
		{
			title: "{{instrument}}  @  {{timestep}}",
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
                "volvol": {def:["src_bar.volume,atr", "vis:VolVol"], vol_thres: 300, atr_thres: 3.0, thres_dist: 30},
                //"pivot": {def:[{tf:"m5"},"dpivot", "vis:Pivot"], width: 1},
                "bb_mean": {def:["bb.mean", "vis:Line"], color: "#a83", opacity: 0.6, width: 1, dasharray: "4,2"},
                "bb_upper": {def:["bb.upper", "vis:Line"], color: "#a83", opacity: 0.6, width: 1, suppress: true},
                "bb_lower": {def:["bb.lower", "vis:Line"], color: "#a83", opacity: 0.6, width: 1, suppress: true},
                "ask_price": {def:["askbid.ask", "vis:Price"], visible: ['$switch', "ask_bid_radio", {"Ask": true, "Both": true}, false], fillopacity: ['$switch', "ask_bid_radio", {'Both': 0.3}], wickoffset: ['$switch', "ask_bid_radio", {'Both': -0.1}]},
                "bid_price": {def:["askbid.bid", "vis:Price"], visible: ['$switch', "ask_bid_radio", {"Bid": true, "Both": true}, false], dasharray: ['$switch', "ask_bid_radio", {'Both': "3,3"}], fillopacity: ['$switch', "ask_bid_radio", {'Both': 0.3}], wickoffset: ['$switch', "ask_bid_radio", {'Both': 0.1}]},
                "mid_price": {def:["src_bar", "vis:Price"], visible: ['$switch', "ask_bid_radio", {"Mid": true}, false]},
                //"sdl_slow_line": {def:["sdl_slow", "vis:SharpSlopeColorLine"], threshold: .0001, width: 7, opacity: 0.6},
                "tradesim-vis": {def:["trade_evts", "vis:Trade"]}
            },
            selections: [
                {
                    id: "trend_climate",
                    name: "Trend Climate",
                    description: "Detect conditions for trend strategies",
                    base: "trend_climate_base",
                    color: "#149C14",
                    inputs: ["obv_sl", "sdl_slow_sl"],
                    tags: {
                        stop: {
                            type: 'chart_value',
                            label: 'Mark stop-loss placement',
                            color: 'red',
                            initial: 'src.close',
                            initial_offset: 0
                        },
                        is_trend: {
                            type: "options",
                            label: "In trend conditions?",
                            options: {
                                'Yes': true,
                                'No': false,
                                '???': null
                            },
                            predict: "trend_climate_svc"
                        },
                        notes: {type: "text", label: "Notes:"}
                    },
                    visible: ['$switch', 'selection_radio', {'Trend Climate': true}, false]
                },
                {
                    id: "swing_climate",
                    name: "Swing climate",
                    description: "Detect conditions for swing strategies",
                    base: "swing_climate_base",
                    color: "#475DC3",
                    inputs: [
                        "srsi_slow",
                        "sdl_slow"
                        // price stdev
                        // flat slow price avg
                    ],
                    tags: {
                        is_swing: {
                            type: "options",
                            label: "In swing conditions?",
                            options: {
                                'Yes': true,
                                'No': false,
                                '???': null
                            },
                            predict: "swing_climate_svc"
                        },
                        notes: {type: "text", label: "Notes:"}
                    },
                    visible: ['$switch', 'selection_radio', {'Swing Climate': true}, false]
                },
                {
                    id: "T_trig",
                    name: "T Trig",
                    description: "Trend trigger",
                    base: "trend_dir_base",
                    color: "#ff6600",
                    inputs: ["obv_sl", "sdl_slow_sl"],
                    tags: {
                        is_trig: {
                            type: "options",
                            label: "Is a valid trigger?",
                            options: {
                                'Yes': true,
                                'No': false
                            },
                            predict: "storsi_trig_svc"
                        },
                        trig_quality: {
                            type: "options",
                            label: "Trigger strength:",
                            options: {
                                'N/A': null,
                                'Weak': 1,
                                'Avg': 2,
                                'Strong': 3,
                                'Strongest': 4
                            },
                            predict: "t_trig_svc"
                        },
                        notes: {type: "text", label: "Notes:"}
                    },
                    visible: ['$switch', 'selection_radio', {'T Trig': true}, false]
                }
            ],
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

        // Climate - matrix
        {
            type: "matrix",
            title: "climate",
            anchor: "dual",
            indicators: {
                "climate": {name: "Climate (trading hours & ATR)"},
            },
            margin: {
                top: 1,
                bottom: 5
            },
            collapsed: false
        },

        // A. Trend - matrix
        {
            type: "matrix",
            title: "trend entry",
            anchor: "dual",
            indicators: {
                "trend-cl":  {name: "Trend Climate", def: ["trend_climate"], color: "rgba(243, 173, 45, 0.8)"},
                "trend-1":   {name: "A.1 BB.AL.SDL10 direction", def: ["bbm_sdl", "dir:Direction"]},
                "trend-2":   {name: "A.2 OBV - OBV.EMA", def: ["obv,obv_ema", "dir:RelativeTo"]},
                "trend-3":   {name: "A.3 MACD12 - MACD12.T", def: ["macd12,macd12_tl", "dir:RelativeTo"]},
                "trend-4":   {name: "A.4 MACD12 direction", def: ["macd12", "dir:Direction"]},
                "trend-5":   {name: "A.5 MACD6 direction", def: ["macd6", "dir:Direction"]},
                "trend-6":   {name: "A.6 OBV - OBV.SDL", def: ["obv,obv_sdl", "dir:RelativeTo"]},
                "trend-7":   {name: "A.7 STO3/RSI2 hooks", def: ["storsi_trig_base"]},
                "trend_en":  {name: "A.ENTRY -- Trade commands"}
            },
            margin: {
                top: 1,
                bottom: 5
            },
            collapsed: false
        },

        // B. Correction - matrix
        {
            type: "matrix",
            title: "correction entry",
            anchor: "dual",
            indicators: {
                "corr-1": {name: "B.1 BB.AL.SDL10 direction", def: ["bbm_sdl", "dir:Direction"]},
                "corr-2": {name: "B.2 MACD12.T direction", def: ["macd12_tl", "dir:Direction"]},
                "corr-3": {name: "B.3 OBV - OBV.EMA", def: ["obv,obv_ema", "dir:RelativeTo"]},
                "corr-4": {name: "B.4 STO3 hooks from 20/80", def: ["srsi_fast", "dir:HooksFrom", [20, 80]]},
                "corr_en": {name: "B.ENTRY -- Trade commands"}
            },
            margin: {
                top: 1,
                bottom: 5
            },
            collapsed: false
        },

        // C. Reversal - matrix
        {
            type: "matrix",
            title: "reversal entry",
            anchor: "dual",
            indicators: {
                "rev-1": {name: "C.1 OBV.EMA direction", def: ["obv_ema", "dir:Direction"]},
                "rev-2": {name: "C.2 OBV - OBV.EMA", def: ["obv,obv_ema", "dir:RelativeTo"]},
                "rev-3": {name: "C.3 MACD12 direction", def: ["macd12", "dir:Direction"]},
                "rev-4": {name: "C.4 MACD6 direction", def: ["macd6", "dir:Direction"]},
                "rev-5": {name: "C.5 STO3 hooks from 20/80", def: ["srsi_fast", "dir:HooksFrom", [20, 80]]},
                "rev_en": {name: "C.ENTRY -- Trade commands"}
            },
            margin: {
                top: 1,
                bottom: 5
            },
            collapsed: false
        },

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
            height: 80,
			indicators: {
                "rsi_fast_line": {def: ["rsi_fast", "vis:Line"], width: 2, dasharray: "4,4"},
				"srsi_fast_line": {def: ["srsi_fast", "vis:SharpSlopeColorLine"], threshold: 3, width: 2, colorscale: ["#f00", "#777", "#0d0"]},
				"srsi_slow_line": {def: ["srsi_slow", "vis:SharpSlopeColorLine"], opacity: 0.7, threshold: 10, width: 4, colorscale: ["#f00", "#777", "#0d0"], dasharray: "8,3"}
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
            show_x_labels: true
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

        // MACD6
		{
            title: "MACD6",
            anchor: "dual",
            height: 70,
			indicators: {
				"macd6_line": {def: ["macd6", "vis:SharpSlopeColorLine"], threshold: .00003, dasharray: "8,4", opacity: "0.7"}
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

        // HTF
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
	]
});
