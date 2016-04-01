'use strict';

define(['lodash', 'async', 'd3', 'config/timesteps', 'config/stream_types', 'indicator_collection', 'charting/plot_component'],
    function(_, async, d3, timesteps, stream_types, IndicatorCollection, IndicatorPlot) {

const default_config = {
    margin: {
        top: 25,
        bottom: 75,
        left: 75,
        right: 25
    },
    cell_size: 250,
    scale_gap: 10,
    scale_tick_size: 5,
    cell_margin: {
        top: 10,
        bottom: 10,
        left: 10,
        right: 10
    }
};

function ScatterplotMatrix(container, config) {
	if (!(this instanceof ScatterplotMatrix)) return ScatterplotMatrix.apply(Object.create(ScatterplotMatrix.prototype), arguments);
    this.config = _.defaults(config, default_config);

    this.container = container;
    if (_.isEmpty(this.config.data)) throw new Error('"data" parameter must be supplied with data elements');
    this.data = this.config.data;
    if (!_.isArray(this.config.inputs) || this.config.inputs.length < 2) throw new Error('Config "inputs" parameter must be an array of minimum length 2');
    this.inputs = this.config.inputs;
    this.dim = this.inputs.length;

    this.rendered = false;
	return this;
}

ScatterplotMatrix.prototype = {

	constructor: ScatterplotMatrix,

    // To be called after data and components are defined and before render()
    init: function() {
        var vis = this;
        var i, j;

        vis.cells = [];
        for (i = 0; i <= vis.dim - 1; i++) {
            for (j = 0; j <= vis.dim - 1; j++) {
                if (i > j) vis.cells.push({i: i, j: j});
            }
        }

        console.log('vis.data', vis.data);

        vis.scales = _.map(this.inputs, inp => {
            var inp_data = _.map(vis.data, d => d[inp]);
            console.log('inp:', inp, inp_data);
            return d3.scale.linear()
                .domain([_.min(inp_data), _.max(inp_data)])
                .range([0, vis.config.cell_size]);
        });

        console.log('scales', _.map(vis.scales, s => s.domain()));

    },

    render: function() {
        var vis = this;
        var i, j;

        vis.width = vis.config.margin.left + (vis.dim - 1) * (vis.config.cell_margin.left + vis.config.cell_size + vis.config.cell_margin.right) + vis.config.margin.right;
        vis.height = vis.config.margin.top + (vis.dim - 1) * (vis.config.cell_margin.top + vis.config.cell_size + vis.config.cell_margin.bottom) + vis.config.margin.bottom;

        vis.svg = vis.container.append('svg')
            .attr('width', vis.width)
            .attr('height', vis.height);

        vis.svg.append('rect')
            .attr('class', 'bg')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', vis.width)
            .attr('height', vis.height);

        vis.spmatrix = vis.svg.append('g')
            .attr('class', 'spmatrix');

        // plot scales
        // y-scales
        var scale_g;
        for (i = 1; i <= vis.dim - 1; i++) {
            scale_g = vis.spmatrix.append('g').attr('class', 'scale');
            scale_g.append('line')
                .classed({backing: true})
                .attr('x1', vis.config.margin.left - vis.config.scale_gap)
                .attr('y1', vis.config.margin.top + (i - 1) * (vis.config.cell_margin.top + vis.config.cell_size + vis.config.cell_margin.bottom) + vis.config.cell_margin.top)
                .attr('x2', vis.config.margin.left - vis.config.scale_gap)
                .attr('y2', vis.config.margin.top + i * (vis.config.cell_margin.top + vis.config.cell_size + vis.config.cell_margin.bottom) - vis.config.cell_margin.bottom);

            var y_ticks = vis.scales[i].ticks(5);
            scale_g.selectAll('line.tick')
                .data(y_ticks)
              .enter().append('line')
                .classed({tick: true})
                .attr('x1', vis.config.margin.left - vis.config.scale_gap)
                .attr('y1', d => vis.config.margin.top + (i - 1) * (vis.config.cell_margin.top + vis.config.cell_size + vis.config.cell_margin.bottom) + vis.config.cell_margin.top + vis.scales[i](d))
                .attr('x2', vis.config.margin.left - vis.config.scale_gap + vis.config.scale_tick_size)
                .attr('y2', d => vis.config.margin.top + (i - 1) * (vis.config.cell_margin.top + vis.config.cell_size + vis.config.cell_margin.bottom) + vis.config.cell_margin.top + vis.scales[i](d));

            scale_g.selectAll('text.y-label')
                .data(y_ticks)
              .enter().append('text')
                .classed({'y-label': true})
                .attr('x', vis.config.margin.left - vis.config.scale_gap - 4)
                .attr('y', d => vis.config.margin.top + (i - 1) * (vis.config.cell_margin.top + vis.config.cell_size + vis.config.cell_margin.bottom) + vis.config.cell_margin.top + vis.scales[i](d))
                .text(d => d.toFixed(1));
        }
        // x-scales
        for (j = 0; j <= vis.dim - 2; j++) {
            scale_g = vis.spmatrix.append('g').attr('class', 'scale');
            scale_g.append('line')
                .attr('class', 'backing')
                .attr('x1', vis.config.margin.left + j * (vis.config.cell_margin.left + vis.config.cell_size + vis.config.cell_margin.right) + vis.config.cell_margin.right)
                .attr('y1', vis.config.margin.top + (vis.dim - 1) * (vis.config.cell_margin.left + vis.config.cell_size + vis.config.cell_margin.right) + vis.config.scale_gap)
                .attr('x2', vis.config.margin.left + (j + 1) * (vis.config.cell_margin.left + vis.config.cell_size + vis.config.cell_margin.right) - vis.config.cell_margin.right)
                .attr('y2', vis.config.margin.top + (vis.dim - 1) * (vis.config.cell_margin.left + vis.config.cell_size + vis.config.cell_margin.right) + vis.config.scale_gap);

            var x_ticks = vis.scales[j].ticks(5);
            scale_g.selectAll('line.tick')
                .data(x_ticks)
              .enter().append('line')
                .classed({tick: true})
                .attr('x1', d => vis.config.margin.left + j * (vis.config.cell_margin.left + vis.config.cell_size + vis.config.cell_margin.right) + vis.config.cell_margin.right + vis.scales[j](d))
                .attr('y1', vis.config.margin.top + (vis.dim - 1) * (vis.config.cell_margin.left + vis.config.cell_size + vis.config.cell_margin.right) + vis.config.scale_gap)
                .attr('x2', d => vis.config.margin.left + j * (vis.config.cell_margin.left + vis.config.cell_size + vis.config.cell_margin.right) + vis.config.cell_margin.right + vis.scales[j](d))
                .attr('y2', vis.config.margin.top + (vis.dim - 1) * (vis.config.cell_margin.left + vis.config.cell_size + vis.config.cell_margin.right) + vis.config.scale_gap - vis.config.scale_tick_size)

            scale_g.selectAll('text.x-label')
                .data(x_ticks)
              .enter().append('text')
                .classed({'x-label': true})
                .attr('transform', d => 'translate(' + (vis.config.margin.left + j * (vis.config.cell_margin.left + vis.config.cell_size + vis.config.cell_margin.right) + vis.config.cell_margin.right + vis.scales[j](d)) + ',' + (vis.config.margin.top + (vis.dim - 1) * (vis.config.cell_margin.left + vis.config.cell_size + vis.config.cell_margin.right) + vis.config.scale_gap + 4) + ')rotate(90)')
                .attr('x', 0)
                .attr('y', 0)
                //.attr('transform', 'rotate(90)')
                .text(d => d.toFixed(1));
        }


        // plot cells
        _.each(vis.cells, cell => plot_cell.apply(vis, [vis.config, cell]));

        vis.rendered = true;
    },

    destroy: function() {
        this.container.select('svg').remove();
        this.rendered = false;
    }
};

function plot_cell(config, cell) {

    var vis = this;

    var trans_x = config.margin.left + cell.j * (config.cell_margin.left + config.cell_size + config.cell_margin.right) + config.cell_margin.left;
    var trans_y = config.margin.top + (cell.i - 1) * (config.cell_margin.top + config.cell_size + config.cell_margin.bottom) + config.cell_margin.top;

    var cell_g = vis.spmatrix.append('g')
        .attr('class', 'cell')
        .attr('transform', 'translate(' + trans_x + ',' + trans_y + ')');

    cell_g.append('rect')
        .attr('class', 'cell')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', config.cell_size)
        .attr('height', config.cell_size);

    var x_scale = vis.scales[cell.i];
    var y_scale = vis.scales[cell.j];
    var inp_x = vis.inputs[cell.i];
    var inp_y = vis.inputs[cell.j];

    _.each(vis.data, d => {
        var clr;
        switch (d.species) {
            case 'setosa':
                clr = 'blue';
                break;
            case 'versicolor':
                clr = 'red';
                break;
            case 'virginica':
                clr = 'green';
                break;
            default:
                clr = '#ccc';
        }
        cell_g.append('circle')
            .attr('class', 'point')
            .attr('cx', x_scale(d[inp_x]))
            .attr('cy', y_scale(d[inp_y]))
            .attr('r', 3)
            .attr('fill', clr);
    });

}

// ----------------------------------------------------------------------------

return ScatterplotMatrix;

});
