define({

    description: "",
	//collection: "chart_test",
	collection: "obvkvo",
    anchor: "dual",

    streams: [
        ""
    ],

    // chart-level indicators
    indicators: {
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

	components: [

        // Price
		{
			title: "{{chart_setup}}  |  {{instrument}}  @  {{timeframe}}",
            height: 400,
            indicators: {
                "volvol": {def:["pri.ask.volume,atr9", "vis:VolVol"], vol_thres: 60, atr_thres: 3, thres_dist: 20},
                //"pivot": {def:[{tf:"m5"},["d1", "pivot:Standard"], "vis:Pivot"], width: 1},
                /*"sdl89_clr": {def:["sdl89", "vis:SlopeColorLine"], threshold: 0.00005, width: 12, opacity: 0.7},*/
                /*"lreg34regr_clr": {def:["lreg34", "vis:SharpSlopeColorLine"], threshold: 0.00005, width: 9, opacity: 0.6},*/
                "ask_price": {def:["pri.ask", "vis:Price"]}, // candles
                /*"sdl5_clr": {def:["sdl5", "vis:SlopeColorLine"], threshold: 0.00003, width: 3, dasharray: "10,5", opacity: 0.9, colorscale: ["#ff0000", "yellow", "#00ff00"]}*/
                /*"threepeaks": {def:["zz1,zz2,zz3", "vis:ThreePeaks"]},*/
                "test-vis": {def:["test", "vis:Trade"]},
                "tradesim-vis": {def:["basic_sim", "vis:Trade"]},
                "ema_fast_line": {def:[["pri.ask.close", "EMA", 8], "vis:Line"], dasharray: "4,2", width: 2, color:"#fd5", opacity: 0.8},
                "ema_slow_line": {def:[["pri.ask.close", "EMA", 34], "vis:Line"], width: 3, color:"#fd5", opacity: 0.8},
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
        /*
        {
            type: "matrix",
            title: "Top Matrix",
            indicators: {
                "hook_3332": {def:["srsi3332.K", "dir:HooksFrom", [20, 80]], name:"3332_HK"},
                "hook_sdl5": {def:["sdl5", "dir:Hooks"], name:"SDL5_HK"},
                "hook_rsi2": {def:["rsi2", "dir:Hooks"], name:"RSI2_HK"},
                "kvo_T_x": {def:["kvo.KO,kvo.T", "fn:Diff"], name:"KVO_T_X", near_lim: 5, far_lim: 100},
                "kvo_sdl_x": {def:["kvo.KO,kvo_sdl", "fn:Diff"], name:"KVO_SDL_X", near_lim: 5, far_lim: 100},
                "volvol": {def:["pri.ask.volume,atr9", "bool:VolVol", 300, 4], name:"VolVol", color:"blue"}
            },
            margin: {
                top: 1,
                bottom: 0
            }
        },
        */

        /*
        // Bottom Matrix
        {
            type: "matrix",
            indicators: {
                //"sdl5_mat": {def:["sdl5", "fn:Slope"], name:"SDL5", near_lim: 0.00003, far_lim: 0.0002},
                //"kvo_sdl_mat": {def:["kvo_sdl", "fn:Slope"], name:"KVO SDL", near_lim: 10, far_lim: 100},
                //"kvo_t_mat": {def:["kvo_t_sl"], name:"KVO_T_SL", near_lim: 10, far_lim: 50},
                //"obv_t_mat": {def:["obv_t_sl"], name:"OBV_T_SL", near_lim: 10, far_lim: 50},
                "obv_kvo_conf": {def:["obvkvo_conf"], name:"OBV_KVO_CONF", near_lim: 10, far_lim: 50},
                //"kvo_lreg_mat": {def:["kvo_lreg", "fn:Slope"], name:"KVO REG", near_lim: 10, far_lim: 100},
                //"lreg34_mat": {def:["lreg34", "fn:Slope"], name:"LREG34", near_lim: 0.00001, far_lim: 0.00005},
                "preg34_mat": {def:["preg34", "fn:Slope"], name:"PREG34", near_lim: 0.00001, far_lim: 0.00005},
                "sdl89_mat": {def:["sdl89", "fn:Slope"], name:"SDL89", near_lim: 0.00001, far_lim: 0.00005}
                // "test": {domain:[100,200], }
            },
            margin: {
                top: 1,
                bottom: 5
            }
        },
        */

        // TEST
        /*
        {
            title: "__TEST__",
            height: 150,
            indicators: {
                "preg34_clr": {def:["preg34", "vis:SlopeColorLine"], threshold: 0.00005, width: 6, opacity: 0.6},
                "preg34_clr2": {def:[["pri.ask.close", "fxts:PolyRegSlope", 34, 2], "vis:SlopeColorLine"], threshold: 0.00005, width: 2, opacity: 0.9},
                //"preg34_clr2_end": {def:[{sub:"end"}, ["pri.ask.close", "fxts:PolyRegSlope", 34, 2], "vis:SlopeColorLine"], threshold: 0.00005, width: 2, dasharray: "10,4", opacity: 0.9}
            },
            margin: {
                top: 0,
                bottom: 5
            },
			levels: [
				{y:0, color:"#000", width:1, opacity:1.0}
			],
            y_scale: {autoscale: true, ticks: 3}
        },
        */

        // ATR
        /*
        {
            title: "ATR",
            height: 50,
            indicators: {
                "atr9_line" : {def:["atr9", "vis:Line"]}
            },
            margin: {
                top: 0,
                bottom: 5
            },
            y_scale: {autoscale: true, ticks: 3}
        },
        */

        /*
        // StochRSI
		{
            title: "StochRSI",
            height: 100,
			indicators: {
				//"srsi8853_clr": {def:["srsi8853.K", "vis:SharpSlopeColorLine"], threshold: 3, width: 4, dasharray: "15,7", colorscale: ["#c00", "violet", "#00c"]},
                //"rsi4_clr": {def:["rsi4", "vis:SharpSlopeColorLine"], threshold: 3, width: 2, colorscale: ["#f00", "#777", "#0d0"], dasharray: "4,4"},
				"srsi3332_clr": {def:["srsi3332.K", "vis:SharpSlopeColorLine"], threshold: 3, width: 2, colorscale: ["#f00", "#777", "#0d0"]}
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
        */

        // KVO
        /*
		{
            title: "KVO  @  {{timeframe}}",
            anchor: "m5",
            height: 150,
			indicators: {
                //"kvo_lreg_clr": {def:["kvo_lreg", "vis:SlopeColorLine"], threshold: 100, width: 12, opacity: 0.5},
                //"kvo_t_clr": {def:["kvo.T", "vis:SharpSlopeColorLine"], threshold: 100, width: 4},
				//"kvo_sdl_clr": {def:["kvo_sdl", "vis:SharpSlopeColorLine"], threshold: 100, width: 4, opacity: 0.8, dasharray: "6,4"},
                "kvo_t_diff": {def:["kvo_t_sl", "vis:Bar"]}
				//"kvo_k": {def:["kvo.KO", "vis:Line"], color: "#4444ff", opacity: "0.7"}
			},
			levels: [
				{y:0, color:"#59c", width:1, opacity:0.7},
			],
            margin: {
                top: 5,
                bottom: 30
            },
            y_scale: {autoscale: true, tick_interval: 50},
            show_x_labels: true
		},
    */

            /*
        // OBV
		{
            title: "OBV  @  {{timeframe}}",
            anchor: "m5",
            height: 150,
			indicators: {
                "obv_t_clr": {def:["obv_t", "vis:SharpSlopeColorLine"], threshold: 50, width: 4, opacity: 0.9},
				"obv_line": {def:["obv", "vis:Line"], color: "rgb(217, 58, 248)", opacity: "0.6"}
                //"obv_sdl": {}
			},
			levels: [
				{y:0, color:"#59c", width:1, opacity:0.7},
			],
            margin: {
                top: 0,
                bottom: 30
            },
            y_scale: {autoscale: true, tick_interval: 1000},
            show_x_labels: true
		},
            */

        // Higher
        {
            title: "{{instrument}} | {{timeframe}}",
            anchor: "m5",
            height: 200,
            indicators: {
                "volvol_htf": {def:["m5.volume,atr9", "vis:VolVol"], vol_thres: 300, atr_thres: 4, thres_dist: 20},
                "higher_price": {def:["m5", "vis:Price"]}, // candles
                "zigzag_vis_m5": {def:["zigzag_m5", "vis:ThreePeaks"]}
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

        // H1
        {
            title: "H1 Test  @  {{timeframe}}",
            anchor: "h1",
            height: 200,
            indicators: {
                "volvol_htf": {def:["h1.volume,atr9", "vis:VolVol"], vol_thres: 3000, atr_thres: 4, thres_dist: 20},
                "higher_price": {def:["h1", "vis:Price"]}, // candles
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