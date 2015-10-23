define({

    description: "SYSTEM: Combined September 2015",
	collection: "2015-09",
    anchor: "dual",

    streams: [],

    // chart-level indicators
    indicators: {},

    // geometry
    bar_width: 9,
    bar_padding: 3,

    margin: {
        left: 5,
        right: 80
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
                "ask_bid_radio": {type: "radio", options: ["Ask", "Bid", "Both"]},
                "test_radio": {type: "radio", options: ["First", "Second", "Third"], selected: "Third"}
            }
        },

        // Price
		{
			title: "{{instrument}}  @  {{timeframe}}",
            height: 300,
            indicators: {
                "volvol": {def:["pri.ask.volume,atr", "vis:VolVol"], vol_thres: 200, atr_thres: 2, thres_dist: 20},
                //"pivot": {def:[{tf:"m5"},"dpivot", "vis:Pivot"], width: 1},
                "bb_mean": {def:["bb.mean", "vis:Line"], color: "#a83", opacity: 0.6, width: 1, dasharray: "4,2"},
                "bb_upper": {def:["bb.upper", "vis:Line"], color: "#a83", opacity: 0.6, width: 1, suppress: true},
                "bb_lower": {def:["bb.lower", "vis:Line"], color: "#a83", opacity: 0.6, width: 1, suppress: true},
                "ask_price": {def:["pri.ask", "vis:Price"], visible: ['$switch', "ask_bid_radio", {"Ask": true, "Both": true}, false], fillopacity: ['$switch', "ask_bid_radio", {'Both': 0.4}], wickoffset: ['$switch', "ask_bid_radio", {'Both': -0.1}]},
                "bid_price": {def:["pri.bid", "vis:Price"], visible: ['$switch', "ask_bid_radio", {"Bid": true, "Both": true}, false], dasharray: ['$switch', "ask_bid_radio", {'Both': "2,2"}], fillopacity: ['$switch', "ask_bid_radio", {'Both': 0.5}], wickoffset: ['$switch', "ask_bid_radio", {'Both': 0.1}]},
                "sdl_slow_line": {def:["sdl_slow", "vis:SharpSlopeColorLine"], threshold: .0001, width: 7, opacity: 0.6},
                "tradesim-vis": {def:["sim", "vis:Trade"]}
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

        // Execution Matrix
        {
            type: "matrix",
            title: "Exec Matrix  @  {{timeframe}}",
            indicators: {
                "exec": {name: "∎EXEC∎"},
                "trend_hook": {name: "Trend☇"},
                "srsi_fast_thres": {name:"3332_zone"},
                "rsi_fast_hook": {name:"RSI2☇"}
                //"dbl_hook": {name: "OBV_Dbl☇"},
                //"obv_bounce": {name: "OBV_bounce"}
            },
            margin: {
                top: 1,
                bottom: 5
            },
            collapsed: false
        },

        // Trend/Climate Matrix
        {
            type: "matrix",
            title: "Trend/Climate Matrix  @  {{timeframe}}",
            indicators: {
                "trend":            {name: "∎TREND∎"},
                //"macd_sdl_dir":     {def: ["macd_sdl",     "dir:Direction"], name: "MACD_SDL⇅"},
                "obv_ema_diff":     {name: "OBVΔ′EMA⇅"},
                //"volvol":           {name:"VolVol◉", color:"blue"}
                "hours_atr_vol":    {name: "Hours+ATR", color:"#369"},
                "tails":            {name: "Tails", color:"rgb(156, 183, 210)"},
                "climate":            {name: "Climate", color:"blue"}
            },
            margin: {
                top: 1,
                bottom: 5
            },
            collapsed: false
        },

        // StochRSI
		{
            title: "RSI  @  {{timeframe}}",
            height: 80,
			indicators: {
				//"srsi8853_clr": {def:["srsi8853.K", "vis:SharpSlopeColorLine"], threshold: 3, width: 4, dasharray: "15,7", colorscale: ["#c00", "violet", "#00c"]},
                "rsi_fast_line": {def:["rsi_fast", "vis:Line"], width: 2, dasharray: "4,4"},
				"srsi_fast_line": {def:["srsi_fast.K", "vis:SharpSlopeColorLine"], threshold: 3, width: 2, colorscale: ["#f00", "#777", "#0d0"]}
			},
			levels: [
				{y:80, color:"#800", width:1, opacity:0.4, dasharray: "10,4"},
				{y:50, color:"#59c", width:1, opacity:0.7},
				{y:20, color:"#800", width:1, opacity:0.4, dasharray: "10,4"}
			],
            margin: {
                top: 0,
                bottom: 5
            },
            y_scale: {domain: [0, 100], tick_interval: 10},
		},

        // OBV
		{
            title: "OBV  @  {{timeframe}}",
            anchor: "m5",
            height: 150,
			indicators: {
                "obv_trig_clr": {def:["obv_trig", "vis:SharpSlopeColorLine"], threshold: 50, width: 2, dasharray: "8,4", opacity: 0.9},
				"obv_line": {def:["obv", "vis:Line"], color: "rgb(217, 58, 248)", opacity: "0.6"},
                "obv_sdl_clr": {def:["obv_sdl", "vis:SharpSlopeColorLine"], threshold: 50, width: 2, opacity: 0.8}
			},
			levels: [
				{y:0, color:"#59c", width:1, opacity:0.7},
			],
            margin: {
                top: 0,
                bottom: 30
            },
            y_scale: {autoscale: true, tick_interval: 1000, round: true},
            show_x_labels: true
		},

        // MACD
        /*
		{
            title: "MACD  @  {{timeframe}}",
            anchor: "m5",
            height: 150,
			indicators: {
				"macd_line": {def:["macd", "vis:SharpSlopeColorLine"], threshold: .00005, opacity: "0.8"},
				"macd_sig_line": {def:[["macd", "EMA", 9], "vis:SharpSlopeColorLine"], threshold: .00005, dasharray: "8,4", opacity: "0.8"}
                //"obv_sdl": {}
			},
			levels: [
				{y:0, color:"#59c", width:1, opacity:0.7},
			],
            margin: {
                top: 0,
                bottom: 0
            },
            y_scale: {autoscale: true, tick_interval: 1000, round: 5},
            collapsed: true
		},
        */

        // m30
        {
            title: "HTF: {{timeframe}}",
            anchor: "m30",
            height: 160,
            indicators: {
                // TODO: Fix below --
                "volvol_htf": {def:[["$xs", ["m30.volume"], ["m30", "ATR", 9]], "vis:VolVol"], vol_thres: 18000, atr_thres: 24, thres_dist: 20},
                "htf_price": {def:["m30", "vis:Price"]}, // candles
                "sdl_m30_line": {def:[["m30.close", "SDL", 34], "vis:SharpSlopeColorLine"], threshold: .0001, width: 5, opacity: 0.6},
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
