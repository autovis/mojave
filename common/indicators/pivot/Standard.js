'use strict';

define({

    param_names: [],

    input: 'candle_bar',
    output: 'pivot',

    initialize: function(params, input_streams, output_stream) {
    },

    on_bar_update: function(params, input_streams, output_stream) {
        /*
        R3 = H + 2( Pivot - L
        R2 = Pivot + ( H - L )
        R1 = ( 2 x Pivot ) - L
        Pivot = ( H + L + C ) / 3
        S1 = ( 2 x Pivot ) - H
        S2 = Pivot - ( H - L )
        S3 = L - 2( H - Pivot )

        http://www.actionforex.com/markets/pivot-points/pivot-point-forumlas-2010040952149/

        */
        var inp = input_streams[0].get(0);
        var out = output_stream.get(0);

        out.date = inp.date;
        out.p  = (inp.high + inp.low + inp.close) / 3;
        out.r3 = inp.high + 2 * (out.p - inp.low);
        out.r2 = out.p + (inp.high - inp.low);
        out.r1 = (2 * out.p) - inp.low;
        out.s1 = (2 * out.p) - inp.high;
        out.s2 = out.p - (inp.high - inp.low);
        out.s3 = inp.low - 2 * (inp.high - out.p);
    }
});
