'use strict';

define(['indicators/price/typical', 'indicators/EMA'], function(typical, EMA) {
    return {

        param_names: ['FastN', 'SlowN', 'TrigN'],

        input: 'candle_bar',
        output: ['KO', 'T'],

        initialize: function(params, input_streams, output) {
            this.input = input_streams[0].simple();
            this.out_ko = output.substream('KO');
            this.out_t = output.substream('T');

            this.dm = this.stream('dm');
            this.cm = this.stream('cm');
            this.trend = this.stream('trend');
            this.vf = this.stream('vf');

            this.typical = this.indicator([typical], input_streams[0]);
            this.emaf = this.indicator([EMA, params.FastN], this.vf);
            this.emas = this.indicator([EMA, params.SlowN], this.vf);
            this.emat = this.indicator([EMA, params.TrigN], output.substream('KO'));
        },

        on_bar_update: function(params, input_streams, output_stream) {

            var input = this.input;
            var out_ko = this.out_ko;
            var out_t = this.out_t;

            var dm = this.dm;
            var cm = this.cm;
            var trend = this.trend;
            var vf = this.vf;

            var typical = this.typical;
            var emaf = this.emaf;
            var emas = this.emas;
            var emat = this.emat;

            cm.next();
            dm.next();
            trend.next();
            vf.next();

            // first0
            trend.set(0);
            cm.set(0);
            dm.set(input.high(0) - input.low(0));

            // first1
            typical.update();
            var trend_ = trend.get(1);
            if (typical.get(0) > typical.get(1)) {
                trend_ = 1;
            } else if (typical.get(0) < typical.get(1)) {
                trend_ = -1;
            }
            trend.set(trend_);
            if (trend.get(0) === trend.get(1)) {
                cm.set(cm.get(0) + dm.get(0));
            } else {
                cm.set(dm.get(1) + dm.get(0));
            }
            if (cm.get(0) === 0) {
                vf.set(0);
            } else {
                vf.set(input.volume(0) * Math.abs(2 * dm.get(0) / cm.get(0) - 1) * trend_ * 100);
            }

            // first2
            emaf.update();
            emas.update();
            out_ko.set(emaf.get(0) - emas.get(0));

            // first3
            emat.update();
            out_t.set(emat.get(0));
        },

    };
});
