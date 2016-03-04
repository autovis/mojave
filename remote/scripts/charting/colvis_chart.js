'use strict';

define(['underscore', 'async', 'd3', 'config/timeframes', 'indicator_collection'],
    function(_, async, d3, timeframes, IndicatorCollection) {

var default_config = {

    width: 500,
    height: 500,

    margin: {
        top: 10,
        bottom: 10,
        left: 10,
        right: 10
    },

    padding: 10,
    inputs: {
        col_width: 75,
        node_padding: 10
    },
    chart: {
        col_width: 100
    },
    input_col_width: 75,
    input_width: 50,
    input_height: 30,

    indicators: {
        nose_len: 10,
        input_outer_pad: 10,
        input_inter_pad: 10,
        lead_len: 30
    }

};

function ColvisChart(container, collection_id) {
    if (!(this instanceof ColvisChart)) return ColvisChart.apply(Object.create(ColvisChart.prototype), arguments);

    this.container = container;
    this.collection_id = collection_id;
    this.config = default_config;
    this.margin = this.config.margin;
    this.width = this.config.width;
    this.height = this.config.height;
    this.data = [];

    this.rendered = false;

    return this;
}

ColvisChart.prototype = {

    constructor: ColvisChart,

    // To be called after data and components are defined and before render()
    init: function(callback) {
        if (!_.isFunction(callback)) throw new Error('No (valid) callback given for Chart.init(cb)');

        var vis = this;

        async.series([

            // load saved data
            function(cb) {
                vis.data = [
                    {id: 'first', category: 'input', y: 60},
                    {id: 'second', category: 'input', y: 140},
                    {id: 'pri', type: 'stream:Tick2Candle', x: 137, y: 39, width: 40, height: 20, input_leads: [{type: 'tick', src: 'first'}], output_lead: {type: 'dual_candle_bar'}, tf: 'm5'},
                    {id: 'sdl', type: 'tf:Candle2Candle', x: 135, y: 133, width: 50, height: 25, input_leads: [{type: 'candle_bar', src: 'second'}], output_lead: {type: 'num'}},
                    {id: 'rsi', type: 'RSI', x: 254, y: 71, width: 50, height: 50, input_leads: [{type: 'num', src: 'pri.ask.close'}, {type: 'num', src: 'sdl'}], output: 'num'}
                ];
                cb();
            },

            // initialize components
            function(cb) {
                vis.inputs = _.filter(vis.data, inp => inp.category === 'input');
                vis.indicators = _.filter(vis.data, inp => inp.category === 'indicator' || inp.category === undefined);
                vis.hashtable = {};
                _.each(vis.data, function(elem) {
                    vis.hashtable[elem.id] = elem;
                });
                _.each(vis.data, function(elem) {
                    if (_.isArray(elem.input_leads)) {
                        _.each(elem.input_leads, function(lead) {
                            if (_.isString(lead.src)) {
                                var src = lead.src.match(/^([^.]+)(?:.(.*))?$/);
                                lead.link = vis.hashtable[src[1]];
                                if (lead.link) {
                                    if (!lead.link.output_lead) lead.link.output_lead = {};
                                    if (!_.isArray(lead.link.output_lead.links)) lead.link.output_lead.links = [];
                                    lead.link.output_lead.links.push([src[2], elem]);
                                }
                                lead.key = src[2];
                            }
                        });
                    }
                });
                console.log(vis.data);
                cb();
            }

        ], callback);
    },

    resize: function() {
        var vis = this;

        var vport = getViewport();
        vis.width = vport[0];
        vis.height = vport[1];
        //var size = Math.min(vis.config.maxsize, vis.anchor.current_index()+1);

    },

    // Render entire chart
    render: function() {
        var vis = this;

        vis.container.selectAll('svg').remove();
        vis.resize();

        var zoom = d3.behavior.zoom()
            .scaleExtent([1, 4])
            .on('zoom', zoomed);

        vis.svg = vis.container.append('svg') // top-most svg element
                .attr('width', vis.margin.left + vis.width + vis.margin.right)
                .attr('height', vis.height)  // margins already included in overall chart height
                .call(zoom);

        vis.defs = vis.svg.append('defs');

        vis.chart = vis.svg.append('g')
            .attr('class', 'chart')
            .attr('transform', 'translate(0.5,0.5)');

        var drag = d3.behavior.drag()
            .origin(d => d)
            .on('dragstart', dragstarted)
            .on('dragend', dragended)
            .on('drag', function(d) {
                var x = d3.event.x;
                var y = d3.event.y;
                d.x = Math.min(Math.max(x, vis.config.inputs.col_width + vis.config.padding), vis.width - vis.config.chart.col_width - d.width - vis.config.padding);
                d.y = Math.min(Math.max(y, vis.config.padding), vis.height - d.height - vis.config.padding);
                plot_indicators.call(vis);
            });

        // Inputs

        vis.chart.append('rect')
            .attr('class', 'inputs-bg')
            .attr('x', 0)
            .attr('y', 0)
            .attr('width', vis.config.inputs.col_width)
            .attr('height', vis.height)
            .style('fill', 'rgb(187, 167, 62)')
            .style('fill-opacity', 0.3);

        var inputs_svg = vis.chart.append('g');

        var inp_node = inputs_svg.selectAll('circle.inp_node')
              .data(vis.inputs)
                .attr('cy', d => d.y);
        inp_node.enter().append('circle')
                .attr('class', 'inp_node')
                .attr('cx', vis.config.inputs.col_width - this.config.inputs.node_padding)
                .attr('cy', d => d.y)
                .attr('r', 2.5)
                .attr('fill', 'none')
                .attr('stroke-width', 2)
                .attr('stroke', '#777')
                .attr('stroke-opacity', 0.7);

        var text_inp = inputs_svg.selectAll('text.inp')
              .data(this.inputs)
                .attr('y', d => d.y);
        text_inp.enter().append('text')
                .attr('class', 'inp')
                .attr('x', vis.config.inputs.col_width - vis.config.inputs.node_padding - 10)
                .attr('y', d => d.y + 4)
                .attr('text-anchor', 'end')
                .style('fill', '#000')
                .style('font-family', 'arial')
                .style('font-size', 12)
                .text(d => d.id);

        // Chart Indicators

        vis.chart.append('rect')
            .attr('class', 'chartind-bg')
            .attr('x', vis.width - vis.config.chart.col_width)
            .attr('y', 0)
            .attr('width', vis.config.inputs.col_width)
            .attr('height', vis.height)
            .style('fill', '#359')
            .style('fill-opacity', 0.25);

        // Indicators

        var indsymbols = vis.chart.append('g').attr('class', 'indicators');

        plot_indicators.call(vis);
        //plot_links();

        function plot_indicators() {

            var vis = this;

            indsymbols.selectAll('*').remove();

            var indsym = indsymbols.selectAll('g.ind')
                .data(vis.indicators)
              .enter().append('g')
                .attr('class', 'ind')
                .attr('transform', d => 'translate(' + d.x + ','  + d.y + ')')
                .call(drag);

            indsym.append('path')
                .attr('d', d => get_indicator_path.call(vis, d))
                .attr('stroke', '#467')
                .attr('stroke-opacity', 0.7)
                .attr('fill', 'rgba(100,110,140,.2)');
            indsym.append('text')
                .attr('x', d => d.width / 2)
                .attr('y', d => d.height * 0.75)
                .attr('text-anchor', 'middle')
                .text(d => d.id);

            indsym.append('text')
                .attr('x', d => d.width / 2)
                .attr('y', d => -3)
                .attr('text-anchor', 'middle')
                .style('font-size', '10px')
                .text(d => d.type);

            var indsym_tf = indsym.filter(d => d.tf !== undefined);

            indsym_tf.append('text')
                .attr('x', d => d.width / 2)
                .attr('y', d => d.height + 11)
                .attr('text-anchor', 'middle')
                .style('font-size', '10px')
                .style('font-weight', 'bold')
                .style('fill', '#a00')
                .html(d => '&#916; ' + d.tf);

            // input leads
            var inp_lead = indsym.selectAll('g.lead')
                .data(d => d.input_leads)
              .enter().append('g')
                .attr('class', 'inp_lead')
                .attr('transform', (d, i) => 'translate(0,' + get_lead_pos(vis, null, i) + ')');

            inp_lead.append('line')
                .attr('x1', -vis.config.indicators.lead_len + 2)
                .attr('y1', 0)
                .attr('x2', 0)
                .attr('y2', 0)
                .style('stroke', '#777');

            inp_lead.append('circle')
                .attr('cx', -vis.config.indicators.lead_len)
                .attr('cy', 0)
                .attr('r', 2)
                .style('fill', 'none')
                .style('stroke', '#777');

            // output lead
            var out_lead = indsym.append('g')
                .attr('class', 'out_lead')
                .attr('transform', (d, i) => 'translate(' + (d.width + vis.config.indicators.nose_len + 3) + ',' + Math.round(d.height / 2) + ')');

            out_lead.append('circle')
                .attr('cx', 0)
                .attr('cy', 0)
                .attr('r', 3)
                .style('fill', 'none')
                .style('stroke', '#777');

            ////////////////////////////////////////

            function get_indicator_path(ind) {
                var path = 'M0,0 ';
                path += 'H' + (ind.width) + ' ';
                path += 'L' + (ind.width + this.config.indicators.nose_len) + ',' + (ind.height / 2) + ' ';
                path += 'L' + (ind.width) + ',' + (ind.height) + ' ';
                path += 'H0 ';
                path += 'Z';
                return path;
            }

            // calculates y position of input lead
            function get_lead_pos(vis, ind, idx) {
                return (idx * vis.config.indicators.input_inter_pad) + vis.config.indicators.input_outer_pad;
            }

            function get_link_path(x0, y0, x1, y1) {
                return 'M' + x0 + ' ' + y0 + ' L' + x1 + ' ' + y1;
            }

        } // plot_indicators()

        function plot_edge() {

        }

        // ------------------------------------------------------------------------------------------------------------

        vis.rendered = true;
        vis.trans = [];
        ////////////////////////////////////////////////////////

        function zoomed() {
            var trans = d3.event.translate;
            if (trans[0] > 0) trans[0] = 0;
            vis.chart.attr('transform', 'translate(' + trans + ')scale(' + d3.event.scale + ')');
        }

        function dragstarted(d) {
            d3.event.sourceEvent.stopPropagation();
            d3.select(this).classed('dragging', true);
        }

        /*
        function dragged(d) {
            d3.select(this).attr('cx', d.x = d3.event.x).attr('cy', d.y = d3.event.y);
        }
        */

        function dragended(d) {
            d3.select(this).classed('dragging', false);
        }

    }, // render()

    // Called when anchor indicator gets new bar and chart.maxsize isn't reached
    update: function() {

        var vis = this;

        if (!vis.rendered) throw new Error('update() method called on chart before it is rendered');

        var size = Math.min(vis.config.maxsize, vis.anchor.current_index() + 1);
        vis.width = (vis.config.bar_width + vis.config.bar_padding) * size;

        vis.svg.attr('width', vis.margin.left + vis.width + vis.margin.right);

        // cursor
        vis.svg.select('#cursor .y-line').attr('x2', vis.width - Math.floor(vis.config.bar_padding / 2) - 0.5);
    },

    destroy: function() {

        var vis = this;

        vis.rendered = false;
        vis.chart.remove();
    }
};

// ----------------------------------------------------------------------------

return ColvisChart;

});

function getViewport() {

    var viewPortWidth;
    var viewPortHeight;

    // the more standards compliant browsers (mozilla/netscape/opera/IE7) use window.innerWidth and window.innerHeight
    if (typeof window.innerWidth != 'undefined') {
        viewPortWidth = window.innerWidth;
        viewPortHeight = window.innerHeight;
    // IE6 in standards compliant mode (i.e. with a valid doctype as the first line in the document)
    } else if (typeof document.documentElement !== 'undefined'
        && typeof document.documentElement.clientWidth !==
        'undefined' && document.documentElement.clientWidth !== 0) {
        viewPortWidth = document.documentElement.clientWidth;
        viewPortHeight = document.documentElement.clientHeight;
    // older versions of IE
    } else {
        viewPortWidth = document.getElementsByTagName('body')[0].clientWidth;
        viewPortHeight = document.getElementsByTagName('body')[0].clientHeight;
    }
    return [viewPortWidth, viewPortHeight];
}
