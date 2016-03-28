define({

    description: "",
	collection: "2016-02",
    anchor: "dual",

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

    maxsize: 100,

    // behavior
    pan_and_zoom: false,

	components: [

        // Control Panel
        {
            type: "panel",
            height: 30,
            margin: {
                top: 15,
                bottom: 0
            },
            controls: {
                "price_type_label": {type: "label", text: "Price type:"},
                "ask_bid_radio": {type: "radio", options: ["Ask", "Bid", "Both"], selected: "Both"}
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
            height: 300,
            indicators: {
                "volvol": {def:["pri.ask.volume,atr", "vis:VolVol"], vol_thres: 300, atr_thres: 3.0, thres_dist: 30},
                //"pivot": {def:[{tf:"m5"},"dpivot", "vis:Pivot"], width: 1},
                "bb_mean": {def:["bb.mean", "vis:Line"], color: "#a83", opacity: 0.6, width: 1, dasharray: "4,2"},
                "bb_upper": {def:["bb.upper", "vis:Line"], color: "#a83", opacity: 0.6, width: 1, suppress: true},
                "bb_lower": {def:["bb.lower", "vis:Line"], color: "#a83", opacity: 0.6, width: 1, suppress: true},
                "ask_price": {def:["pri.ask", "vis:Price"], visible: ['$switch', "ask_bid_radio", {"Ask": true, "Both": true}, false], fillopacity: ['$switch', "ask_bid_radio", {'Both': 0.3}], wickoffset: ['$switch', "ask_bid_radio", {'Both': -0.1}]},
                "bid_price": {def:["pri.bid", "vis:Price"], visible: ['$switch', "ask_bid_radio", {"Bid": true, "Both": true}, false], dasharray: ['$switch', "ask_bid_radio", {'Both': "3,3"}], fillopacity: ['$switch', "ask_bid_radio", {'Both': 0.3}], wickoffset: ['$switch', "ask_bid_radio", {'Both': 0.1}]},
                //"sdl_slow_line": {def:["sdl_slow", "vis:SharpSlopeColorLine"], threshold: .0001, width: 7, opacity: 0.6},
                "tradesim-vis": {def:["trade_evts", "vis:Trade"]}
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

        // Climate - matrix
        {
            type: "matrix",
            title: "climate",
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
            indicators: {
                "trend-cl":  {name: "Trend Climate", def: ["trend_climate"], color: "rgba(243, 173, 45, 0.8)"},
                "trend-1":   {name: "A.1 BB.AL.SDL10 direction", def: ["bbm_sdl", "dir:Direction"]},
                "trend-2":   {name: "A.2 OBV - OBV.EMA", def: ["obv,obv_ema", "dir:Difference"]},
                "trend-3":   {name: "A.3 MACD12 - MACD12.T", def: ["macd12,macd12_tl", "dir:Difference"]},
                "trend-4":   {name: "A.4 MACD12 direction", def: ["macd12", "dir:Direction"]},
                "trend-5":   {name: "A.5 MACD6 direction", def: ["macd6", "dir:Direction"]},
                "trend-6":   {name: "A.6 OBV - OBV.SDL", def: ["obv,obv_sdl", "dir:Difference"]},
                "trend-7":   {name: "A.7 STO3/RSI2 hooks", def: ["trend_exec"]},
                "trend_en":  {name: "A.ENTRY -- Trade commands"}
            },
            margin: {
                top: 1,
                bottom: 5
            },
            collapsed: false
        },

        /*
        // B. Correction - matrix
        {
            type: "matrix",
            title: "correction entry",
            indicators: {
                "corr-1": {name: "B.1 BB.AL.SDL10 direction", def: ["bbm_sdl", "dir:Direction"]},
                "corr-2": {name: "B.2 MACD12.T direction", def: ["macd12_tl", "dir:Direction"]},
                "corr-3": {name: "B.3 OBV - OBV.EMA", def: ["obv,obv_ema", "dir:Difference"]},
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
            indicators: {
                "rev-1": {name: "C.1 OBV.EMA direction", def: ["obv_ema", "dir:Direction"]},
                "rev-2": {name: "C.2 OBV - OBV.EMA", def: ["obv,obv_ema", "dir:Difference"]},
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
        */

        // Exit strategy - matrix
        /*
        {
            type: "matrix",
            title: "exit strategy",
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
