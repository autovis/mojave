'use strict';

define(['lodash', 'd3', 'simple-statistics'], function(_, d3, ss) {

    var default_config = {

        margin: {
            left: 10,
            right: 10
        },

        width: 400,
        height: 600,

        yscale: 400,

        tradenum: 200,
        iterations: 100,
        zval: 4,

        clrrange: [50, 200],
        clralpha: 0.1,

        drawlines: true
    };

    function EquityChart(config, container) {
    	if (!(this instanceof EquityChart)) return EquityChart.apply(Object.create(EquityChart.prototype), arguments);

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


    EquityChart.prototype = {

        constructor: EquityChart,

        init: function() {

            this.x = d3.scale.linear()
                .domain([0, this.config.tradenum])
                .range([0, this.config.width]);

            this.y = d3.scale.linear()
                .domain([-this.config.yscale, this.config.yscale])
                .range([this.config.height, 0]);

            for (var j = 0; j <= this.config.tradenum - 1; j++) {
                this.trades[j] = [];
            }

        },

        render: function() {

            for (var i = 0; i <= this.config.iterations - 1; i++) {

              var equity = 0;

              this.context.beginPath();
              this.context.moveTo(this.x(0), this.y(0));
              for (var j=0; j<=this.config.tradenum-1; j++) {
                var tr = this.data[Math.floor(Math.random()*this.data.length)];
                equity += tr;
                this.context.lineTo(this.x(j), this.y(equity));
                this.trades[j][i] = equity;
              }
              this.context.lineWidth = 1;
              var clr = "rgba("+Math.floor(Math.random()*(this.config.clrrange[1]-this.config.clrrange[0])+this.config.clrrange[0])+","+Math.floor(Math.random()*(this.config.clrrange[1]-this.config.clrrange[0])+this.config.clrrange[0])+","+Math.floor(Math.random()*(this.config.clrrange[1]-this.config.clrrange[0])+this.config.clrrange[0])+","+this.config.clralpha+")";
              this.context.strokeStyle = clr;
              this.context.stroke();

            }

            // Expectancy (mean)
            var expectancy = sum(this.data) / this.data.length;
            var stdev = ss.standard_deviation(this.data);

            console.log("expectancy =", expectancy);

            if (this.config.drawlines) {

                // Draw zero line
                this.context.beginPath();
                this.context.moveTo(this.x(0), this.y(0));
                this.context.lineTo(this.x(this.config.width), this.y(0));
                this.context.lineWidth = 1;
                this.context.strokeStyle = "#000";
                this.context.stroke();

                // Calculate/draw actual mean line
                this.context.beginPath();
                this.context.moveTo(this.x(0), this.y(0));
                for (var j=0; j<=this.config.tradenum-1; j++) {
                    var mean = sum(this.trades[j])/this.config.iterations;
                    this.context.lineTo(this.x(j), this.y(mean));
                }
                this.context.lineWidth = 1;
                this.context.strokeStyle = "#00c";
                this.context.stroke();

                // Calculate/draw theoretical mean line
                this.context.beginPath();
                this.context.moveTo(this.x(0), this.y(0));
                this.context.lineTo(this.x(this.config.tradenum-1), this.y((this.config.tradenum-1) * expectancy));
                this.context.lineWidth = 1;
                this.context.strokeStyle = "#aaf";
                this.context.stroke();

                // Calculate/draw actual upper limit
                this.context.beginPath();
                this.context.moveTo(this.x(0), this.y(0));
                for (var j=1; j<=this.config.tradenum; j++) {
                    var ul = expectancy + (this.config.zval * getStandardDeviation(_.filter(this.trades[j], function(x) {return x>=expectancy;}), 3));
                    this.context.lineTo(this.x(j), this.y(ul));
                }
                this.context.lineWidth = 1;
                this.context.strokeStyle = "#0c0";
                this.context.stroke();

                // Calculate/draw theoretical upper limit
                this.context.beginPath();
                this.context.moveTo(this.x(0), this.y(0));
                for (var j=1; j<=this.config.tradenum; j++) {
                    var ul = j * expectancy + stdev * Math.sqrt(j) * this.config.zval;
                    this.context.lineTo(this.x(j), this.y(ul));
                }
                this.context.lineWidth = 2;
                this.context.strokeStyle = "#beb";
                this.context.stroke();

                // Calculate/draw actual lower limit
                this.context.beginPath();
                this.context.moveTo(this.x(0), this.y(0));
                for (var j=1; j<=this.config.tradenum; j++) {
                    var ll = expectancy - (this.config.zval * getStandardDeviation(_.filter(this.trades[j], function(x) {return x<=expectancy;}), 3));
                    this.context.lineTo(this.x(j), this.y(ll));
                }
                this.context.lineWidth = 1;
                this.context.strokeStyle = "#f00";
                this.context.stroke();

                // Calculate/draw theoretical lower limit
                this.context.beginPath();
                this.context.moveTo(this.x(0), this.y(0));
                for (var j=1; j<=this.config.tradenum; j++) {
                    var ll = j * expectancy - stdev * Math.sqrt(j) * this.config.zval;
                    this.context.lineTo(this.x(j), this.y(ll));
                }
                this.context.lineWidth = 2;
                this.context.strokeStyle = "#fdd";
                this.context.stroke();

                // Draw actual trade path
                this.context.beginPath();
                this.context.moveTo(this.x(0), this.y(0));
                var equity = 0;
                for (var j=0; j<=this.config.tradenum-1; j++) {
                    equity += this.data[j];
                    this.context.lineTo(this.x(j), this.y(equity));
                }
                this.context.lineWidth = 4;
                this.context.strokeStyle = "#4ad";
                this.context.stroke();


            }

        }


    };

    return EquityChart;

    /////////////////////////////////////////////////////////////////////////////////////

    function sum(list) {
      return _.reduce(list, function(memo, num){ return memo + num; }, 0);
    }

    // Programmer: Larry Battle
    // Date: Mar 06, 2011
    // Purpose: Calculate standard deviation, variance, and average among an array of numbers.
    // 2013-03-10 (cfont): Added dependency to underscore.js
    function getNumWithSetDec( num, numOfDec ){
    	var pow10s = Math.pow( 10, numOfDec || 0 );
    	return ( numOfDec ) ? Math.round( pow10s * num ) / pow10s : num;
    }
    function getAverageFromNumArr( numArr, numOfDec ) {
        var sum;
    	if( !_.isArray( numArr ) ){ return false;	}
    	var i = numArr.length,
    		sum = 0;
    	while( i-- ){
    		sum += numArr[ i ];
    	}
    	return getNumWithSetDec( (sum / numArr.length ), numOfDec );
    }
    function getVariance( numArr, numOfDec ){
    	if( !_.isArray(numArr) ){ return false; }
    	var avg = getAverageFromNumArr( numArr, numOfDec ),
    		i = numArr.length,
    		v = 0;

    	while( i-- ){
    		v += Math.pow( (numArr[ i ] - avg), 2 );
    	}
    	v /= numArr.length;
    	return getNumWithSetDec( v, numOfDec );
    }
    function getStandardDeviation( numArr, numOfDec ){
    	if( !_.isArray(numArr) ){ return false; }
    	var stdDev = Math.sqrt( getVariance( numArr, numOfDec ) );
    	return getNumWithSetDec( stdDev, numOfDec );
    };

});
