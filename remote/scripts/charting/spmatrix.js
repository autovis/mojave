'use strict';

define(['underscore', 'async', 'd3', 'config/timeframes', 'config/stream_types', 'indicator_collection', 'charting/indicator_plot_component'],
    function(_, async, d3, timeframes, stream_types, IndicatorCollection, IndicatorPlot) {

var default_config = {
    margin: {
        left: 50,
        right: 50
    },
    bar_width: 6,
    bar_padding: 3,
    cursor: {
        y_label_height: 15,
        fast_delay: 5,
        slow_delay: 10
    },
    x_label_min_height: 15,
    x_label_maj_height: 11,

    maxsize: 90
};

function ScatterplotMatrix(container) {
	if (!(this instanceof ScatterplotMatrix)) return ScatterplotMatrix.apply(Object.create(ScatterplotMatrix.prototype), arguments);

    this.width = 800;
    this.height = 600;

	return this;
}

ScatterplotMatrix.prototype = {

	constructor: ScatterplotMatrix,

    // To be called after data and components are defined and before render()
    init: function(callback) {
        this.container = container;
        this.rendered = false;
    },

    render: function() {
        var vis = this;

        vis.svg = vis.container.append('svg') // top-most svg element
                .attr('width', vis.margin.left + vis.width + vis.margin.right)
                .attr('height', vis.height);  // margins already included in overall chart height

        vis.spmatrix = vis.svg.append('g')
            .attr('class', 'spmatrix');

        var bg = vis.spmatrix.append('rect')
            .attr('class', 'bg')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', vis.chart.width)
            .attr('height', vis.height);

        vis.rendered = true;
    }
};

// ----------------------------------------------------------------------------

return ScatterplotMatrix;

});
