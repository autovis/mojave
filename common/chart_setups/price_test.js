define({

    description: "Live chart for SDL89/KVO/OBV setup",
	//collection: "chart_test",
	collection: "SDL89L",
    anchor: "avg",
	components: [

        // Price
		{   
			title: "{{name}} {{instrument}} {{timeframe}}",
            height: 400,
            indicators: {
                //"volvol": {def:["avg.volume,atr", "vis:VolVol"], vol_thres: 400, atr_thres: 0.0004, thres_dist: 20},
                "avg": {},
                "sdl_s_clr": {def:["sdl_s", "vis:SlopeColorLine"], threshold: 0.00005, width: 10, opacity: 0.5},
                //"sdl_s_line": {def:["sdl_f", "vis:Line"], color:"#e6b", width: 2, dasharray: "7,2", opacity: 0.9}
                //"test": {def:["m30.close", "SDL", 2]}
                "sdl_test": {def:["sdl_f", "vis:Line"]}
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
		}

	]
})