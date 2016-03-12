define({

    description: "",
	collection: "event_test",
    anchor: "dual",

    streams: [],

    // chart-level indicators
    indicators: {},

    // geometry
    bar_width: 10,
    bar_padding: 3,

    margin: {
        left: 5,
        right: 250
    },

    maxsize: 120,

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

        // Price
		{
			title: "{{instrument}}  @  {{timestep}}",
            height: 600,
            indicators: {
                "ask_price": {def:["pri.ask", "vis:Price"], visible: ['$switch', "ask_bid_radio", {"Ask": true, "Both": true}, false], fillopacity: ['$switch', "ask_bid_radio", {'Both': 0.3}], wickoffset: ['$switch', "ask_bid_radio", {'Both': -0.1}]},
                "bid_price": {def:["pri.bid", "vis:Price"], visible: ['$switch', "ask_bid_radio", {"Bid": true, "Both": true}, false], dasharray: ['$switch', "ask_bid_radio", {'Both': "3,3"}], fillopacity: ['$switch', "ask_bid_radio", {'Both': 0.3}], wickoffset: ['$switch', "ask_bid_radio", {'Both': 0.1}]},
                "sdl_slow_line": {def:["sdl_slow", "vis:SharpSlopeColorLine"], threshold: .0001, width: 7, opacity: 0.6},
                "sdl_fast_line": {def:["sdl_fast", "vis:SharpSlopeColorLine"], threshold: .0001, width: 3, opacity: 0.9},
                "tradesim-vis": {def:["trade_evts", "vis:Trade"]},
                "dnc_ub": {def:["dnc.ub", "vis:Line"], color: "rgba(167, 121, 0, 0.6)"},
                "dnc_ul": {def:["dnc.lb", "vis:Line"], color: "rgba(167, 121, 0, 0.6)"}
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
                "trend_en":  {name: "A.ENTRY -- Trade commands"}
            },
            margin: {
                top: 1,
                bottom: 5
            },
            collapsed: false
        }

	]
});
