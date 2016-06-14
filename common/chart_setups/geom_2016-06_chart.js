define({

    description: "",
	collection: "geom_2016-06",

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

    maxsize: 168,
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
                    "Trade Log"
                ]}
            ]
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
            height: 800,
            indicators: {
                "volvol": {def:["src_bar.volume,atr", "vis:VolVol"], vol_thres: 300, atr_thres: 3.0, thres_dist: 30},
                "ema10_line": {def:[[["src", "EMA", 10]], "vis:Line"], opacity: 0.1, width: 7.0, color: "white"},
                "ask_price": {def:["askbid.ask", "vis:Price"], visible: ['$switch', "ask_bid_radio", {"Ask": true, "Both": true}, false], fillopacity: ['$switch', "ask_bid_radio", {'Both': 0.3}], wickoffset: ['$switch', "ask_bid_radio", {'Both': -0.1}]},
                "bid_price": {def:["askbid.bid", "vis:Price"], visible: ['$switch', "ask_bid_radio", {"Bid": true, "Both": true}, false], dasharray: ['$switch', "ask_bid_radio", {'Both': "3,3"}], fillopacity: ['$switch', "ask_bid_radio", {'Both': 0.3}], wickoffset: ['$switch', "ask_bid_radio", {'Both': 0.1}]},
                "mid_price": {def:["src_bar", "vis:Price"], visible: ['$switch', "ask_bid_radio", {"Mid": true}, false]},
                "ema5_line": {def:[[["src", "EMA", 5]], "vis:SharpSlopeColorLine"], width: 1.0, threshold: 0},
                "zigzag_peaks": {def:["zz.one,zz.two,zz.three", "vis:ThreePeaks"]},
                "lightrays_plot": {def:["channel", "vis:LightRays"]},
                "main_trade_mark": {def: ["trade_evts", "vis:Trade"]},
            },

            selections: [
                {
                    id: "gfont_trade_log",
                    name: "Trade Log",
                    description: "",
                    base: null,
                    color: "maroon",
                    inputs: [
                        "dual"
                    ],
                    tags: {
                        dir: {
                            type: "options",
                            label: "Direction of Trade:",
                            options: {
                                'Long': 1,
                                'Short': -1,
                                'N/A': null
                            }
                        },
                        action: {
                            type: "options",
                            label: "Action:",
                            options: {
                                "Executed": "executed",
                                "Missed": "missed",
                                "Skipped": "skipped"
                            }
                        },
                        pips: {type: "text", label: "Pips:"},
                        strategy: {
                            type: "options",
                            label: "Strategy:",
                            options: {
                                'T': 'T',
                                'PT': 'PT',
                                'T-R': 'T-R',
                                'S1': 'S1'
                            }
                        },
                        notes: {type: "text", label: "Notes:"}
                    },
                    visible: ['$switch', 'selection_radio', {'Trade Log': true}, false]
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

        // Strategy matrix
        {
            type: "matrix",
            title: "Geom Strategy",
            anchor: "dual",
            indicators: {
                "near_dip_long": {def: ['near_dip.long']},
                "near_dip_short": {def: ['near_dip.short']},
                "pullback": {name: "Pullback (EMA5)"},
                "bounce": {name: "Trend Bounce"},
                "nsnd": {name: "NSND"}
            },
            margin: {
                top: 1,
                bottom: 5
            },
            collapsed: false
        },

        // RSI/StochRSI
		{
            title: "RSI/StochRSI",
            anchor: "dual",
            height: 100,
			indicators: {
                "srsi_med_line": {def: ["srsi_med", "vis:SharpSlopeColorLine"], opacity: 0.7, threshold: 5, width: 4, colorscale: ["#f00", "#777", "#0d0"]}
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
		}

	]
});
