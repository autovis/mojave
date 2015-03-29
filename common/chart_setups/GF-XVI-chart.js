define({

    description: "",
	//collection: "chart_test",
	collection: "XVI",
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
        left: 60,
        right: 60
    },

    maxsize: 100,

	components: [

        // Price
		{
			title: "{{chart_setup}}  |  {{instrument}}  |  {{timeframe}}",
            height: 400,
            indicators: {
                "volvol": {def:["pri.ask.volume,atr9", "vis:VolVol"], vol_thres: 400, atr_thres: 4, thres_dist: 20},
                "pivot": {def:[{tf:"m5"},["d1", "pivot:Standard"], "vis:Pivot"], width: 1},
                "sdl89_clr": {def:["sdl89", "vis:SlopeColorLine"], threshold: 0.00005, width: 12, opacity: 0.7},
                "ask_price": {def:["pri.ask", "vis:Price"]}, // candles
                "sdl5_clr": {def:["sdl5", "vis:SlopeColorLine"], threshold: 0.00003, width: 3, dasharray: "10,5", opacity: 0.9, colorscale: ["#ff0000", "yellow", "#00ff00"]},
                "mva8_line": {def:["mva8", "vis:Line"], color:"blue", width: 2, dasharray: "7,5", opacity: 0.9}
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
            indicators: {
                "hook_3332": {def:["srsi3332.K", "dir:HooksFrom", [20, 80]], name:"3332_HK"}
                // "test": {domain:[100,200], }
            },
            margin: {
                top: 1,
                bottom: 15
            }
        },

        // Bottom Matrix
        {
            type: "matrix",
            indicators: {
                "kvo_sdl_mat": {def:["kvo_sdl", "fn:Slope"], name:"KVO SDL", near_lim: 10, far_lim: 100},
                "obv_t_mat": {def:["kvo.T", "fn:Slope"], name:"OBV_T", near_lim: 10, far_lim: 50},
                "kvo_lreg_mat": {def:["kvo_lreg", "fn:Slope"], name:"KVO REG", near_lim: 10, far_lim: 100},
                "sdl89_mat": {def:["sdl89", "fn:Slope"], name:"SDL89", near_lim: 0.00001, far_lim: 0.00005}
                // "test": {domain:[100,200], }
            },
            margin: {
                top: 1,
                bottom: 5
            }
        },

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

        // StochRSI
		{
            title: "StochRSI",
            height: 100,
			indicators: {
				"srsi8853_clr": {def:["srsi8853.K", "vis:SharpSlopeColorLine"], threshold: 3, width: 4, dasharray: "15,7", colorscale: ["#c00", "violet", "#00c"]},
				"srsi3332_clr": {def:["srsi3332.K", "vis:SharpSlopeColorLine"], threshold: 3, width: 3, colorscale: ["#f00", "#777", "#0d0"]}
			},
			y_lines: [
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

        // KVO
		{
            title: "KVO",
            height: 150,
			indicators: {
                "kvo_lreg_clr": {def:["kvo_lreg", "vis:SlopeColorLine"], threshold: 100, width: 12, opacity: 0.5},
                "kvo_t_clr": {def:["kvo.T", "vis:SharpSlopeColorLine"], threshold: 100, width: 4},
				"kvo_sdl_clr": {def:["kvo_sdl", "vis:SharpSlopeColorLine"], threshold: 100, width: 4, opacity: 0.8, dasharray: "6,4"},
				"kvo_k": {def:["kvo.KO", "vis:Line"], color: "#4444ff", opacity: "0.7"}
			},
			y_lines: [
				{y:0, color:"#59c", width:1, opacity:0.7},
			],
            margin: {
                top: 0,
                bottom: 5
            },
            y_scale: {autoscale: true, tick_interval: 1000},
		},

        // OBV
		{
            title: "OBV",
            height: 150,
			indicators: {
                "obv_t_clr": {def:["obv_t", "vis:SharpSlopeColorLine"], threshold: 50, width: 4, opacity: 0.9},
				"obv_line": {def:["obv", "vis:Line"], color: "rgb(217, 58, 248)", opacity: "0.6"}
                //"obv_sdl": {}
			},
			y_lines: [
				{y:0, color:"#59c", width:1, opacity:0.7},
			],
            margin: {
                top: 0,
                bottom: 30
            },
            show_x_labels: true,
            y_scale: {autoscale: true, tick_interval: 1000},
		},

	]
})