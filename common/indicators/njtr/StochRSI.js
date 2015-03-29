/*

UNCONFIRMED

*/

define(['indicators/RSI', 'indicators/MIN', 'indicators/MAX', 'indicators/SMA'], function(RSI, MIN, MAX, SMA) {
    return {

        param_names: ["RSI_period", "K_period", "KS_period", "D_period"],

        input: "num",
        output: ["K", "D"],

        // Initialize indicator
        initialize: function(params, input_streams, output) {
            this.out_k = output.substream("K");
            this.out_d = output.substream("D");

            this.rsi = this.indicator([RSI, params.RSI_period], input_streams[0]);
            this.min = this.indicator([MIN, params.K_period], this.rsi);
            this.max = this.indicator([MAX, params.K_period], this.rsi);

            this.ski = this.stream("ski");
            this.sma_ski = this.indicator([SMA, params.KS_period], this.ski);
            this.sma_k = this.indicator([SMA, params.D_period], this.out_k);
        },

        // Called when input streams are updated
        on_bar_update: function() {
            var rsi = this.rsi;
            var min = this.min;
            var max = this.max;
            var ski = this.ski;
            var sma_ski = this.sma_ski;
            var sma_k = this.sma_k;

            /*
		    Indicator rsi  = RSI(Inputs[0], periodRSI, 1);

		    double min  = MIN(rsi, periodK)[0];
		    double max  = MAX(rsi, periodK)[0];
		    if (min == max) {
			    SKI[0] = 100;
		    } else {
			    SKI[0] = (rsi[0] - min) / (max - min) * 100;
		    }

		    K.Set(SMA(SKI, periodKS)[0]);
		    D.Set(SMA(K,periodD)[0]);
            */

            rsi.update();
            min.update();
            max.update();

            var min_ = min.get(0);
            var max_ = max.get(0);
            ski.next();
            if (min_ == max_) {
                ski.set(100);
            } else {
                ski.set((rsi.get(0) - min_) / (max_ - min_) * 100);
            }
            sma_ski.update();
            this.out_k.set(sma_ski.get(0));
            sma_k.update();
            this.out_d.set(sma_k.get(0));
        }
    }
})
