'use strict';

define(['lodash', 'indicators/SMA'], function(_, SMA) {
    return {

        param_names: ['period'],

        input: 'num',
        output: 'num',

        initialize() {
            this.input = this.inputs[0];

            this.avg_up = this.stream('avg_up');
            this.avg_down = this.stream('avg_down');
            this.up = this.stream('up');
            this.down = this.stream('down');

            this.sma_up = this.indicator([SMA, this.param.period], this.up);
            this.sma_down = this.indicator([SMA, this.param.period], this.down);
        },

        on_bar_update() {

            var avg_up = this.avg_up;
            var avg_down = this.avg_down;
            var up = this.up;
            var down = this.down;
            var sma_up = this.sma_up;
            var sma_down = this.sma_down;

            avg_up.next();
            avg_down.next();
            up.next();
            down.next();

            if (this.index === 0) {
                down.set(0);
                up.set(0);

                if (this.param.period < 3) this.output.set(50);
                return;
            }

            down.set(Math.max(this.inputs[0].get(1) - this.inputs[0].get(0), 0));
            up.set(Math.max(this.inputs[0].get(0) - this.inputs[0].get(1), 0));

            sma_up.update();
            sma_down.update();

            if ((this.index + 1) < this.param.period) return;

            if ((this.index + 1) === this.param.period) {
                avg_down.set(sma_down.get(0));
                avg_up.set(sma_up.get(0));
            } else {
                avg_down.set((avg_down.get(1) * (this.param.period - 1) + down.get(0)) / this.param.period);
                avg_up.set((avg_up.get(1) * (this.param.period - 1) + up.get(0)) / this.param.period);
            }

            this.output.set(avg_down.get(0) === 0 ? 100 : 100 - 100 / (1 + avg_up.get(0) / avg_down.get(0)));
        },

    };
});
