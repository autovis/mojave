define({

    param_names: [],

    input: 'candle_bar',
    output: 'pivot',

    initialize: function(params, input_streams, output_stream) {
    },

    on_bar_update: function(params, input_streams, output_stream) {
        /*
        R3 = Pivot + 1.000 * (H - L)
        R2 = Pivot + 0.618 * (H - L)
        R1 = Pivot + 0.382 * (H - L)
        Pivot = ( H + L + C ) / 3 
        S1 = Pivot - 0.382 * (H - L)
        S2 = Pivot - 0.618 * (H - L) 
        S3 = Pivot - 1.000 * (H - L) 
        */
        var inp = input_streams[0].get(0);
        var out = output_stream.get(0);

        out.date = inp.date;
        out.p  = (inp.high + inp.low + inp.close) / 3;
        out.r3 = out.p + 1.000 * (out.high - inp.low);
        out.r2 = out.p + 0.618 * (out.high - inp.low);
        out.r1 = out.p + 0.382 * (out.high - inp.low);
        out.s1 = out.p + 0.382 * (out.high - inp.low);
        out.s2 = out.p + 0.618 * (out.high - inp.low);
        out.s3 = out.p + 1.000 * (out.high - inp.low);
    }
})
