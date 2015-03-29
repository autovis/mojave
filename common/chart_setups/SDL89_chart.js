define({

    description: "Live chart for SDL89/KVO/OBV setup",
	//collection: "chart_test",
	collection: "SDL89L",
    anchor: "dual",

    // chart-level indicators
    indicators: {

    },

    // geometry
    bar_width: 12,
    bar_padding: 4,

    margin: {
        left: 50,
        right: 50
    },

	components: [

        // Price
		{
			title: "{{chart_setup}}  ::  {{instrument}}  ::  {{timeframe}}",
            height: 400,
            indicators: {
                "volvol": {def:["pri.ask.volume,atr", "vis:VolVol"], vol_thres: 400, atr_thres: 0.0004, thres_dist: 20},
                "pivtest": {def:[{tf:"m5"},["d1", "pivot:Standard"], "vis:Pivot"]},
                "ask_price": {def:["pri.ask", "vis:Price"]}, // candles
                "sdl_med_clr": {def:["sdl_m", "vis:SlopeColorLine"], threshold: 0.00003, width: 5, opacity: 0.75},
                "sdl_slo_clr": {def:["sdl_s", "vis:SlopeColorLine"], threshold: 0.00005, width: 10, opacity: 0.9},
                "sdl_fas_line": {def:["sdl_f", "vis:Line"], color:"orange", width: 2, dasharray: "7,2", opacity: 0.9}
                //"test": {def:[{sub:"close"}, [{tf:"m5"},"m30", "tf:Candle2Candle"], "vis:Line"], color: "orange"}
            },
            margin: {
                top: 15,
                bottom: 30
            },
            y_scale: {
                cursor_format: function(x) {return x.toFixed(5)},
                format: function(x) {return x.toFixed(4)},
                autoscale: true,
                ticks: 15
            },
            show_x_labels: true
		},

        // KVO
		{
            title: "KVO",
            height: 150,
			indicators: {
				"kvo_t_clr": {def:["kvo.T", "vis:SlopeColorLine"], threshold: 100, width: 4, opacity: 0.8, dasharray: "4,4"},
                "kvo_sdl_clr": {def:["kvo_sdl", "vis:SharpSlopeColorLine"], threshold: 100},
				"kvo_k": {def:["kvo.KO", "vis:Line"]}
			},
			y_lines: [
				{y:0, color:"#59c", width:1, opacity:0.7},
			],
            margin: {
                top: 0,
                bottom: 5
            },
            y_scale: {autoscale: true, ticks: 7},
		},

        // OBV
		{
            title: "OBV",
            height: 150,
			indicators: {
                "obv_sdl_clr": {def:["obv_sdl", "vis:SlopeColorLine"], threshold: 50, width: 4, opacity: 0.8, dasharray: "4,4"},
                "obv_t_clr": {def:["obv_t", "vis:SharpSlopeColorLine"], threshold: 50, width: 2, opacity: 0.9},
				"obv_line": {def:["obv", "vis:Line"], color: "violet"}
                //"obv_sdl": {}
			},
            margin: {
                top: 0,
                bottom: 30
            },
            show_x_labels: true,
            y_scale: {autoscale: true, ticks: 5},
		},

        // StochRSI
		{
            title: "StochRSI",
            height: 100,
			indicators: {
				"srsi_m_clr": {def:["srsi_m.K", "vis:SharpSlopeColorLine"], threshold: 3, width: 4, opacity: 0.6, dasharray: "15,1"},
				"srsi_f_clr": {def:["srsi_f.K", "vis:SharpSlopeColorLine"], threshold: 3, width: 2, opacity: 0.8}
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
            y_scale: {domain: [0, 100], ticks: 4},
		},

	]
})