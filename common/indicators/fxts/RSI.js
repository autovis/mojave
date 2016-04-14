'use strict';

/*

Does not pass testing

*/

define(['lodash'], function(_) {
    return {

        param_names: ['period'],

        input: 'num',
        output: 'num',

        initialize: function(params, input_streams, output) {
            this.input = input_streams[0];
            this.range = _.range(0, params.period).reverse();

            this.pos = this.stream('pos');
            this.neg = this.stream('neg');
        },

        on_bar_update: function(params, input_streams, output) {

            var input = this.input;

            /*
            if period >= first then
                local i = 0;
                local sump = 0;
                local sumn = 0;
                local positive = 0;
                local negative = 0;
                local diff = 0;
                if (period == first) then
                    for i = period - n + 1, period do
                        diff = source[i] - source[i - 1];
                        if (diff >= 0) then
                            sump = sump + diff;
                        else
                            sumn = sumn - diff;
                        end
                    end
                    positive = sump / n;
                    negative = sumn / n;
                else
                    diff = source[period] - source[period - 1];
                    if (diff > 0) then
                        sump = diff;
                    else
                        sumn = -diff;
                    end
                    positive = (pos[period - 1] * (n - 1) + sump) / n;
                    negative = (neg[period - 1] * (n - 1) + sumn) / n;
                end
                pos[period] = positive;
                neg[period] = negative;
                if (negative == 0) then
                    RSI[period] = 0;
                else
                    RSI[period] = 100 - (100 / (1 + positive / negative));
                end
            end
            */

            var sump = 0;
            var sumn = 0;
            var positive = 0;
            var negative = 0;
            var diff = 0;

            if (this.current_index() >= params.period) {
                _.each(this.range, function(i) {
                    diff = input.get(i) - input.get(i + 1);
                    if (diff >= 0)
                        sump += diff;
                    else
                        sumn -= diff;
                });
                positive = sump / params.period;
                negative = sumn / params.period;
            } else {
                diff = input.get(0) - input.get(1);
                if (diff > 0)
                    sump = diff;
                else
                    sumn = -diff;
                positive = (this.pos.get(1) * (params.period - 1) + sump) / params.period;
                negative = (this.neg.get(1) * (params.period - 1) + sumn) / params.period;
            }
            this.pos.set(positive);
            this.neg.set(negative);

            if (negative === 0)
                output.set(0);
            else
                output.set(100 - (100 / (1 + positive / negative)));
        }
    };
});
