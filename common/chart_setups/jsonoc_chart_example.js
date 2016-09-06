ChartSetup([

    Main({
        description: "SYSTEM: Combined September 2015",
        collection: "2015-09",
        anchor: "dual"
    }),

    Geometry({
        bar_width: 3,
        bar_padding: 3,
        margin: {
            left: 5,
            right: 80
        },
        maxbars: 100 // instead of maxsize
    }),

    Behavior({
        pan_and_zoom: false
    }),

    // Selections:

    Dataset({
        id: "test_selection",
        label: "",
        color: "red"
    }),

    // ----------------------------------------------------------------------------------

    PanelComponent([ // Control Panel
        Var("foo", 1),
        Main({}),
        Geometry({
           height: 30,
           margin: {
               top: 15,
               bottom: 0
           }
        }),
        LabelControl("price_type_label", "Price type:"),
        RadioControl("ask_bid_radio", ["Ask", "Bid", "Both"], "Ask")
    ]),

    PlotComponent([ // Price Chart
        Main({
            title: "{{instrument}} @ {{timeframe}}",
            show_x_labels: true,
            y_scale: {
                autoscale: true,
                price: true
            }
        }),
        Geometry({
            height: 300,
            margin: {
                top: 5,
                bottom: 31
            }
        }),
        PlotInd("volvol", Ind("pri.ask.volume,atr", "vis:VolVol"), {vol_thres: 200, atr_thres: 2, thres_dist: 20}),
        //Plot("pivot", Ind("dpivot", "vis:Pivot"), {width: 1}),
        PlotInd("bb_mean", Ind("bb.mean", "vis:Line"), {color: "#a83", opacity: 0.6, width: 1, dasharray: "4,2"}),
        PlotInd("bb_upper", Ind("bb.upper", "vis:Line"), {color: "#a83", opacity: 0.6, width: 1, suppress: true}),
        PlotInd("bb_lower", Ind("bb.upper", "vis:Line"), {color: "#a83", opacity: 0.6, width: 1, suppress: true}),
        PlotInd("ask_price", Ind("pri.ask", "vis:Price"), {
            visible:     Switch("ask_bid_radio", {"Ask": true, "Both": true}, false),
            fillopacity: Switch("ask_bid_radio", {"Both": 0.4}),
            wickoffset:  Switch("ask_bid_radio", {"Both": -0.1})
        }),
        PlotInd("bid_price", Ind("pri.bid", "vis:Price"), {
            visible:     Switch("ask_bid_radio", {"Bid": true, "Both": true}, false),
            dasharray:   Switch("ask_bid_radio", {"Both": "2,2"}),
            fillopacity: Switch("ask_bid_radio", {"Both": 0.5}),
            wickoffset:  Switch("ask_bid_radio", {"Both": 0.1})
        }),
        PlotInd("sdl_slow_line", Ind("sdl_slow", "vis:SharpSlopeColorLine"), {threshold: 0.0001, width: 7, opacity: 0.6}),
        PlotInd("tradesim-vis", Ind("sim", "vis:Trade"))
    ]),

    MatrixComponent([ // Execution Matrix
        Main({
            title: "Exec Matrix @ {{timeframe}}",
            collapsed: false
        }),
        Geometry({
            margin: {
                top: 1,
                bottom: 5
            }
        }),
        Row("exec",            "∎EXEC∎"),
        Row("trend_hook",      "Trend☇"),
        Row("srsi_fast_thres", "3332_zone"),
        Row("rsi_fast_hook",   "RSI2☇")
    ]),

    MatrixComponent([ // Climate Matrix
        Main({
            title: "Trend/Climate Matrix @ {{timeframe}}",
            collapse: false
        }),
        Geometry({
            margin: {
                top: 1,
                bottom: 5
            }
        }),
        Row("trend", "∎TREND∎"),
        //MatrixRow("macd_sdl_dir":     {def: ["macd_sdl",     "dir:Direction"], name: "MACD_SDL⇅"}),
        Row("obv_ema_diff", "OBVΔ′EMA⇅"),
        //MatrixRow("volvol":           {name:"VolVol◉", color:"blue"})
        Row("hours_atr_vol", "Hours+ATR", {color:"#369"}),
        Row("tails", "Tails", {color: "rgb(156, 183, 210)"}),
        Row("climate", "Climate", {color:"blue"})
    ]),

    PlotComponent([ // StockRSI
        Main({
            title: "RSI @ {{timeframe}}",
            y_scale: {domain: [0, 100], tick_interval: 10}
        }),
        Geometry({
            height: 80,
            margin: {
                top: 0,
                bottom: 5
            }
        }),
        HLine(80, "#800", 1, {opacity: 0.4, dasharray: "10,4"}),
        HLine(50, "#59c", 2, {opacity: 0.7}),
        HLine(20, "#800", 1, {opacity: 0.4, dasharray: "10,4"}),
		//Plot("srsi8853_clr", {def:["srsi8853.K", "vis:SharpSlopeColorLine"], threshold: 3, width: 4, dasharray: "15,7", colorscale: ["#c00", "violet", "#00c"]}),
        PlotInd("rsi_fast_line", Ind("rsi_fast", "vis:Line"), {width: 2, dasharray: "4,4"}),
		PlotInd("srsi_fast_line", Ind("srsi_fast.K", "vis:SharpSlopeColorLine"), {threshold: 3, width: 2, colorscale: ["#f00", "#777", "#0d0"]})
    ]),

    PlotComponent([ // OBV
        Main({
            title: "OBV @ {{timeframe}}",
            anchor: "m5",
            y_scale: {
                autoscale: true,
                tick_interval: 1000,
                round: true
            },
            show_x_labels: true
        }),
        Geometry({
            height: 150,
            margin: {
                top: 0,
                bottom: 30
            }
        }),
        PlotInd("obv_trig_clr", Ind("obv_trig", "vis:SharpSlopeColorLine"), {threshold: 50, width: 2, dasharray: "8,4", opacity: 0.9}),
		PlotInd("obv_line", Ind("obv", "vis:Line"), {color: "rgb(217, 58, 248)", opacity: "0.6"}),
        PlotInd("obv_sdl_clr", Ind("obv_sdl", "vis:SharpSlopeColorLine"), {threshold: 50, width: 2, opacity: 0.8}),
        HLine(0, "#59c", 1, {opacity: 0.7})
    ]),

    PlotComponent([ // m30
        Main({
            title: "HTF: {{timeframe}}",
            anchor: "m30",
            show_x_labels: true,
            y_scale: {
                autoscale: true,
                price: true
            },
            collapsed: true
        }),
        Geometry({
            height: 160,
            margin: {
                top: 5,
                bottom: 31
            }
        }),
        Plot("volvol_htf", Ind(["m30.volume", Ind("m30", "ATR", 9)], "vis:VolVol"), {vol_thres: 18000, atr_thres: 24, thres_dist: 20}),
        Plot("htf_price", Ind("m30", "vis:Price")), // candles
        Plot("sdl_m30_line", Ind(Ind("m30.close", "SDL", 34), "vis:SharpSlopeColorLine"), {threshold: 0.0001, width: 5, opacity: 0.6})
    ])

])
