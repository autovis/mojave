'use strict';

// Imported from Ninjatrader -- UNCONFIRMED

define(['indicators/Range', 'indicators/EMA'], function(Range, EMA) {
    return {

        param_names: ['fast', 'slow', 'trigger'],

        input: 'candle_bar',
        output: ['klinger', 'signal'],

        initialize: function(params, input_streams, output) {

            this.input = input_streams[0].simple();
            this.klinger = output.substream('klinger');
            this.signal = output.substream('signal');

            this.force = this.stream('force');
            this.range = this.indicator([Range], input_streams);
            this.ema_fast = this.indicator([EMA, params.fast], this.force);
            this.ema_slow = this.indicator([EMA, params.slow], this.force);
            this.ema_trig = this.indicator([EMA, params.trigger], this.klinger);
        },

        on_bar_update: function(params, input_streams) {

            var input = this.input;
            var klinger = this.klinger;
            var signal = this.signal;

            var range = this.range;
            var force = this.force;

            var ema_fast = this.ema_fast;
            var ema_slow = this.ema_slow;
            var ema_trig = this.ema_trig;

            var trend;
            var prev_trend;

            /*
		    if (CurrentBar < 2)
		    {
			    Klinger.Set(0);
			    Signal.Set(0);
		    }
		    else
		    {
			    // set current trend
			    if (HLC(0) > HLC(1)) { intTrend = 1; }
			    else { intTrend = -1; }

			    // set previous trend
			    if (HLC(1) > HLC(2)) { intPrevTrend = 1; }
			    else { intPrevTrend = -1; }

			    // set CM
			    dblCM = intTrend == intPrevTrend ? dblCM += Range()[0] : Range()[0] + Range()[1];

			    // populate temp data series
			    vForce.Set(dblCM == 0 ? 0 : VOL()[0] * Math.Abs(2 * Range()[0] / dblCM - 1) * intTrend * 100);
			    vKVO.Set(EMA(vForce, Fast)[0] - EMA(vForce, Slow)[0]);
			    vTrigger.Set(EMA(vKVO, Trigger)[0]);

			    // set plots
			    if (Smooth > 1)
			    {
				    Klinger.Set(SMA(vKVO, Smooth)[0]);
				    Signal.Set(SMA(vTrigger, Smooth)[0]);
			    }
			    else
			    {
				    Klinger.Set(EMA(vForce, Fast)[0] - EMA(vForce, Slow)[0]);
				    Signal.Set(vTrigger[0]);
			    }
		    }
            */

            if (hlc(0) > hlc(1)) trend = 1;
            else trend = -1;

            if (hlc(1) > hlc(2)) prev_trend = 1;
            else prev_trend = -1;

            range.update();
            this.cm = trend === prev_trend ? this.cm += range.get(0) : range.get(0) + range.get(1);

            force.next();
            force.set(this.cm === 0 ? 0 : input.volume(0) * Math.abs(2 * range.get(0) / this.cm - 1) * trend * 100);
            ema_fast.update();
            ema_slow.update();

            klinger.set(ema_fast.get(0) - ema_slow.get(0));
            ema_trig.update();
            signal.set(ema_trig.get(0));

            function hlc(bars_ago) {
                return input.high(bars_ago) + input.low(bars_ago) + input.close(bars_ago);
            }
        }
    };
});
