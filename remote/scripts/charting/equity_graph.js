'use strict';

define(['lodash', 'd3', 'simple-statistics'], function(_, d3, ss) {

    var default_config = {

        margin: {
            left: 10,
            right: 10
        },

        width: 400,
        height: 600,

        yscale: 800,

        tradenum: 100,
        iterations: 1000,
        zval: 3.2,

        clrrange: [70, 220],
        clralpha: 0.04,

        drawlines: true,
        montecarlo: true
    };

    function EquityGraph(config, container) {
        if (!(this instanceof EquityGraph)) return EquityGraph.apply(Object.create(EquityGraph.prototype), arguments);

        this.config = _.assign(default_config, config);

        this.canvas = d3.select(container).append('canvas')
            .attr('width', this.config.width)
            .attr('height', this.config.height);
        this.context = this.canvas.node().getContext('2d');
        this.rendered = false;

        this.trades = [];
        this.x = null;
        this.y = null;

        return this;
    }


    EquityGraph.prototype = {

        constructor: EquityGraph,

        render: function() {

            var j, equity, ll, ul, mean;

            var expectancy = sum(this.data) / this.data.length;
            var stdev = ss.standardDeviation(this.data);

            this.x = d3.scale.linear()
                .domain([0, this.config.tradenum])
                .range([0, this.config.width]);

            this.y = d3.scale.linear()
                .domain([-this.config.yscale, this.config.yscale])
                .range([this.config.height, 0]);

            for (j = 0; j <= this.config.tradenum - 1; j++) {
                this.trades[j] = [];
            }

            if (this.config.montecarlo) {
                for (var i = 0; i <= this.config.iterations - 1; i++) {
                    equity = 0;
                    this.context.beginPath();
                    this.context.moveTo(this.x(0), this.y(0));
                    for (j = 0; j <= this.config.tradenum - 1; j++) {
                        var tr = this.data[Math.floor(Math.random() * this.data.length)];
                        equity += tr;
                        this.context.lineTo(this.x(j), this.y(equity));
                        this.trades[j][i] = equity;
                    }
                    this.context.lineWidth = 2;
                    var clr = 'rgba(' + Math.floor(Math.random() * (this.config.clrrange[1] - this.config.clrrange[0]) + this.config.clrrange[0]) + ',' + Math.floor(Math.random() * (this.config.clrrange[1] - this.config.clrrange[0]) + this.config.clrrange[0]) + ',' + Math.floor(Math.random() * (this.config.clrrange[1] - this.config.clrrange[0]) + this.config.clrrange[0]) + ',' + this.config.clralpha + ')';
                    this.context.strokeStyle = clr;
                    this.context.stroke();
                }
            }

            if (this.config.drawlines) {

                // border
                this.context.beginPath();
                this.context.moveTo(0, 0);
                this.context.lineTo(this.config.width, 0);
                this.context.lineTo(this.config.width, this.config.height);
                this.context.lineTo(0, this.config.height);
                this.context.lineTo(0, 0);
                this.context.lineWidth = 4;
                this.context.strokeStyle = '#ccc';
                this.context.stroke();

                // zero line
                this.context.beginPath();
                this.context.moveTo(this.x(0), this.y(0));
                this.context.lineTo(this.x(this.config.width), this.y(0));
                this.context.lineWidth = 2;
                this.context.strokeStyle = '#444';
                this.context.stroke();

                /////////////////////////////////////////////////////////////////////////
                // MEAN

                // actual
                this.context.beginPath();
                this.context.moveTo(this.x(0), this.y(0));
                for (j = 0; j <= this.config.tradenum - 1; j++) {
                    mean = sum(this.trades[j]) / this.config.iterations;
                    this.context.lineTo(this.x(j + 1), this.y(mean));
                }
                this.context.lineWidth = 1;
                this.context.strokeStyle = 'rgba(0, 0, 204, 0.5)';
                this.context.stroke();

                // theoretical
                this.context.beginPath();
                this.context.moveTo(this.x(0), this.y(0));
                this.context.lineTo(this.x(this.config.tradenum - 1), this.y((this.config.tradenum - 1) * expectancy));
                this.context.lineWidth = 1;
                this.context.strokeStyle = 'rgb(0, 0, 204)';
                this.context.stroke();

                /////////////////////////////////////////////////////////////////////////
                // UPPER LIMIT

                // actual
                this.context.beginPath();
                this.context.moveTo(this.x(0), this.y(0));
                for (j = 1; j <= this.config.tradenum - 1; j++) {
                    mean = sum(this.trades[j]) / this.config.iterations;
                    ul = mean + this.config.zval * ss.standardDeviation(this.trades[j]);
                    this.context.lineTo(this.x(j + 1), this.y(ul));
                }
                this.context.lineWidth = 1;
                this.context.strokeStyle = 'rgb(13, 206, 13)';
                this.context.stroke();

                // theoretical
                this.context.beginPath();
                this.context.moveTo(this.x(0), this.y(0));
                for (j = 1; j <= this.config.tradenum - 1; j++) {
                    ul = j * expectancy + stdev * Math.sqrt(j) * this.config.zval;
                    this.context.lineTo(this.x(j + 1), this.y(ul));
                }
                this.context.lineWidth = 2;
                this.context.strokeStyle = 'rgba(13, 206, 13, 0.5)';
                this.context.stroke();

                /////////////////////////////////////////////////////////////////////////
                // LOWER LIMIT

                // actual
                this.context.beginPath();
                this.context.moveTo(this.x(0), this.y(0));
                for (j = 1; j <= this.config.tradenum - 1; j++) {
                    mean = sum(this.trades[j]) / this.config.iterations;
                    ll = mean - this.config.zval * ss.standardDeviation(this.trades[j]);
                    this.context.lineTo(this.x(j + 1), this.y(ll));
                }
                this.context.lineWidth = 1;
                this.context.strokeStyle = 'rgb(236, 26, 52)';
                this.context.stroke();

                // theoretical
                this.context.beginPath();
                this.context.moveTo(this.x(0), this.y(0));
                for (j = 1; j <= this.config.tradenum - 1; j++) {
                    ll = j * expectancy - stdev * Math.sqrt(j) * this.config.zval;
                    this.context.lineTo(this.x(j + 1), this.y(ll));
                }
                this.context.lineWidth = 2;
                this.context.strokeStyle = 'rgba(236, 26, 52, 0.5)';
                this.context.stroke();

                /////////////////////////////////////////////////////////////////////////
                // EQUITY PATH

                this.context.beginPath();
                this.context.moveTo(this.x(0), this.y(0));
                equity = 0;
                for (j = 0; j <= this.data.length - 1; j++) {
                    equity += this.data[j];
                    this.context.lineTo(this.x(j + 1), this.y(equity));
                }
                this.context.lineWidth = 4;
                this.context.strokeStyle = '#4ad';
                this.context.stroke();

            }

        }


    };

    return EquityGraph;

    /////////////////////////////////////////////////////////////////////////////////////

    function sum(list) {
        return _.reduce(list, (memo, num) => memo + num, 0);
    }

});
