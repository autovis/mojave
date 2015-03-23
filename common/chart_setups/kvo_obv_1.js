define({

    /*

    */

    description: "",
	//collection: "chart_test",
	collection: "kvo_obv_1",
    timeframe: "m5",
    anchor: "ask",
	components: [

        // Price
		{   
			title: "{{name}} {{instrument}} {{timeframe}}",
            height: 400,
            indicators: {
                "volvol": {def:["ask.volume,atr", "vis:VolVol"], vol_thres: 400, atr_thres: 0.0004, thres_dist: 20},
                "ask_price": {def:["ask", "vis:Price"]},
                "sdl_s_clr": {def:["sdl_s", "vis:SlopeColorLine"], threshold: 0.00005, width: 10, opacity: 0.5},
                "sdl_s_line": {def:["sdl_f", "vis:Line"], color:"#e6b", width: 2, dasharray: "7,2", opacity: 0.9}
                //"test": {def:["m30.close", "SDL", 2]}
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
				"kvo_t_clr": {def:["kvo.T", "vis:SlopeColorLine"], threshold: 100, width: 3, opacity: 0.9, dasharray: "3,2"},
                "kvo_sdl_clr": {def:["kvo_sdl", "vis:SlopeColorLine"], threshold: 100},
				"kvo_k": {def:["kvo.KO", "vis:Line"]}
			},
			y_lines: [
				{y:50, color:"#59c", width:1, opacity:0.7},
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
                "obv_sdl_clr": {def:["obv_sdl", "vis:SlopeColorLine"], threshold: 50, width: 3, opacity: 0.9, dasharray: "3,2"},
                "obv_t_clr": {def:["obv_t", "vis:SlopeColorLine"], threshold: 50, width: 2, opacity: 0.9},
				"obv_line": {def:["obv", "vis:Line"]}
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
				"srsi_m_clr": {def:["srsi_m.K", "vis:SlopeColorLine"], threshold: 0.001, width: 4, opacity: 0.6, dasharray: "15,1"},
				"srsi_f_clr": {def:["srsi_f.K", "vis:SharpSlopeColorLine"], threshold: 0.001, width: 2, opacity: 0.9}
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