Template([

    Main({
        description: "Basic MTF strategy chart template",
        collection: "basic_mtf_strategy"
    }),

    Geometry({
        bar_width: 3,
        bar_padding: 3,
        margin: {
            left: 5,
            right: 80
        },
        bars: 100, // initial width of chart in bars
    }),

    Behavior({
        pan_and_zoom: false,        // allow D3 to pan/zoom chart
        lock_bars_to_width: false,  // updates 'bars' and rerenders to fit chart to client width
        max_bars: 200,              // max width allowable in bars
        show_cursor: true
    }),

    // ----------------------------------------------------------------------------------

    // Chart panel
    PanelComponent([
        //SetVar("foo", 1),
        //Main({}),
        Geometry({
           height: 30,
           margin: {
               top: 15,
               bottom: 0
           }
        }),
        LabelControl("price_type_label", "Price type:"),
        RadioControl("ask_bid_radio", ["Ask", "Bid", "Both", "Mid"], "Mid")
    ]),

    // m1 price
    PlotComponent([
        Main({
            title: "{{instrument}} @ m1",
            anchor: "m1.dual",
            show_x_labels: true,
            y_scale: {
                autoscale: true,
                price: true
            }
        }),
        Geometry({
            height: 400,
            margin: {
                top: 5,
                bottom: 31
            }
        }),
        ///
        Plot(Ind("m1.mid.volume,m1.atr", "plot:VolVol"), {vol_thres: 200, atr_thres: 2, thres_dist: 20}),
        Plot(Ind("m1.askbid.ask", "plot:Candle"), { // ask candles
            visible:     Switch("ask_bid_radio", {"Ask": true, "Both": true}, false),
            fillopacity: Switch("ask_bid_radio", {"Both": 0.4}),
            wickoffset:  Switch("ask_bid_radio", {"Both": -0.1})
        }),
        Plot(Ind("pri.bid", "plot:Candle"), { // bid candles
            visible:     Switch("ask_bid_radio", {"Bid": true, "Both": true}, false),
            dasharray:   Switch("ask_bid_radio", {"Both": "2,2"}),
            fillopacity: Switch("ask_bid_radio", {"Both": 0.5}),
            wickoffset:  Switch("ask_bid_radio", {"Both": 0.1})
        }),
        Plot(Ind("m1.mid", "plot:Candle"), { // ask/bid midpoint candles
            visible:     Switch("ask_bid_radio", {"Mid": true}, false)
        }),
        // indicator plots
        Plot(Ind("fast_ema", "plot:Line"), {dasharray: "3,3", color: "orange"}),
        Plot(Ind("slow_ema", "plot:Line"), {color: "maroon"}),
        // markings
        Plot(Ind("trade_evts", "plot:Trade")),
        ///
        Dataset()
    ]),

    // Strategy and trade execution/management
    MatrixComponent([
        Main({
            title: "Strategy",
            collapsed: false
        }),
        Geometry({
            margin: {
                top: 1,
                bottom: 1
            }
        }),
        Row("HTF EMA dir", "exec"),
        Row("LTF EMA crosses", "trend_hook"),
        Row("Trigger", "srsi_fast_thres"),
        Row("Entries", "entry"),
        Row("Trades", "trades")
    ]),

    // m5 price
    PlotComponent([
        Main({
            title: "M5",
            anchor: "m5.dual",
            show_x_labels: true,
            y_scale: {
                autoscale: true,
                price: true
            },
            collapsed: true
        }),
        Geometry({
            height: 400,
            margin: {
                top: 5,
                bottom: 31
            }
        }),
        ///
        Plot(Ind("m5.mid.volume,m5.atr", "plot:VolVol"), {vol_thres: 200, atr_thres: 2, thres_dist: 20}),
        Plot(Ind("m5.askbid.ask", "plot:Candle"), { // ask candles
            visible:     Switch("ask_bid_radio", {"Ask": true, "Both": true}, false),
            fillopacity: Switch("ask_bid_radio", {"Both": 0.4}),
            wickoffset:  Switch("ask_bid_radio", {"Both": -0.1})
        }),
        Plot(Ind("m5.askbid.bid", "plot:Candle"), { // bid candles
            visible:     Switch("ask_bid_radio", {"Bid": true, "Both": true}, false),
            dasharray:   Switch("ask_bid_radio", {"Both": "2,2"}),
            fillopacity: Switch("ask_bid_radio", {"Both": 0.5}),
            wickoffset:  Switch("ask_bid_radio", {"Both": 0.1})
        }),
        Plot(Ind("m5.mid", "plot:Candle"), { // ask/bid midpoint candles
            visible:     Switch("ask_bid_radio", {"Mid": true}, false)
        }),
        // indicator plots
        Plot(Ind("htf_ema", "plot:SharpSlopeColorLine", {width: 5, opacity: 0.6}),
        Plot(Ind("<-trade_evts", "plot:Trade")),
        ///
        Dataset()
    ])

])
