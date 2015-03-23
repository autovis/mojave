﻿define({

    description: "",
	//collection: "chart_test",
	collection: "2015.03.MACD_OBV",
    anchor: "dual",

    streams: [
        ""    
    ],

    // chart-level indicators
    indicators: {
        //entry: {def: [["srsi_fast.K", "dir:HooksFrom", [20, 80]], "chart:BarHighlight"]}
      // ch:Comments          
    },

    // geometry
    bar_width: 12,
    bar_padding: 4,
    
    margin: {
        left: 80,
        right: 80
    },

    maxsize: 100,

    // behavior
    pan_and_zoom: false,

	components: [

        // Price
		{   
			title: "{{chart_setup}}  |  {{instrument}}  @  {{timeframe}}",
            height: 400,
            indicators: {
                "volvol": {def:["pri.ask.volume,atr", "vis:VolVol"], vol_thres: 300, atr_thres: 3, thres_dist: 20},
                "pivot": {def:[{tf:"m5"},"dpivot", "vis:Pivot"], width: 1},
                "ask_price": {def:["pri.ask", "vis:Price"]}, // candles
                "test-vis": {def:["test", "vis:Trade"]},
                "tradesim-vis": {def:["basic_sim", "vis:Trade"]},
                "sdl_fast_line": {def:["sdl_fast", "vis:SharpSlopeColorLine"], threshold: .0001, width: 7, opacity: 0.6},
                "sdl_slow_line": {def:["sdl_slow", "vis:SharpSlopeColorLine"], threshold: .0001, width: 2, opacity: 0.9}
            },
            margin: {
                top: 15,
                bottom: 31
            },
            y_scale: {
                autoscale: true,
                price: true
            },
            show_x_labels: true
		},

        // Top Matrix
        {
            type: "matrix",
            title: "Matrix  @  {{timeframe}}",
            indicators: {
                "obv_W": {name:"OBV_W"},
                "srsi_fast_hook": {def:["srsi_fast.K", "dir:HooksFrom", [20, 80]], name:"3332_HK"},
                "sdl_fast_hook": {def:["sdl_fast", "dir:Hooks"], name:"SDL5_HK"},
                "rsi_fast_hook": {def:["rsi_fast", "dir:Hooks"], name:"RSI2_HK"},
                "volvol": {def:["pri.ask.volume,atr", "bool:VolVol", 300, 4], name:"VolVol", color:"blue"}
            },
            margin: {
                top: 1,
                bottom: 5
            }
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
                "obv_sdl": {def:[["obv", "SDL", 13], "vis:SharpSlopeColorLine"], threshold: 50, width: 2, opacity: 0.8}
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
                bottom: 30
            },
            y_scale: {autoscale: true, tick_interval: 1000, round: 5},
            show_x_labels: true
		},

        // m30
        {
            title: "HTF: {{timeframe}}",
            anchor: "m30",
            height: 160,
            indicators: {
                // TODO: Fix below --
                //"volvol_htf": {def:[["$xs", "m30.volume", ["m30.close", "ATR", 9]], "vis:VolVol"], vol_thres: 18000, atr_thres: 4, thres_dist: 20},
                "htf_price": {def:["m30", "vis:Price"]} // candles
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
})