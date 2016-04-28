'use strict';

define(['lodash', 'd3', 'eventemitter2', 'config/timesteps'], function(_, d3, EventEmitter2, tsconfig) {

const default_config = {
    visible: true,
    height: 200,
    margin: {
        top: 0,
        bottom: 1
    },
    show_x_labels: false,
    hide_x_ticks: false,
    collapsed: false,
    collapsed_height: 19
};

function Component(config) {
    if (!(this instanceof Component)) return Component.apply(Object.create(Component.prototype), arguments);

    this.chart = config.chart;
    this.config = _.defaults(config, default_config);
    this.indicators = _.isObject(config.indicators) ? config.indicators : {};
    this.margin = this.config.margin;
    // inherit left/right margins from chart
    this.margin.left = this.chart.margin.left;
    this.margin.right = this.chart.margin.right;
    this.width = 0; // grows with anchor indicator new bar updates
    this.height = 0;
    this.collapsed = this.config.collapsed;

    this.anchor = null;
    this.anchor_data = [];
    this.timeframe = null;
    this.timegroup = [];    // data used for major x labels
    this.first_index = 0;   // first index used by anchor
    this.prev_index = -1;   // to track new bars in anchor

    return this;
}

Component.super_ = EventEmitter2;

Component.prototype = Object.create(EventEmitter2.prototype, {
    constructor: {
        value: Component,
        enumerable: false,
        writable: true,
        configurable: true
    }
});

Component.prototype.init = function() {

    var vis = this;

    var evaled = vis.chart.eval_directives({visible: vis.config.visible});
    vis.visible = evaled.visible;

    // re-render comp when a corresp. directive is changed
    var comp_attrs = {visible: vis.config.visible};
    vis.chart.register_directives(comp_attrs, () => {
        var evaled = vis.chart.eval_directives({visible: vis.config.visible});
        vis.visible = evaled.visible;
        if (vis.comp) vis.destroy();
        vis.render();
        vis.chart.on_comp_resize();
    });

    // set up anchor indicator
    if (_.isString(vis.config.anchor)) {
        var ind = vis.chart.collection.indicators[vis.config.anchor];
        if (!ind) throw new Error("Unrecognized indicator '" + vis.config.anchor + "' for chart anchor");
        vis.anchor = ind;
    } else if (vis.chart.anchor) {
        vis.anchor = vis.chart.anchor;
    } else if (!vis.config.anchor) {
        throw new Error('Anchor stream/indicator must be defined for component or its containing chart');
    } else { // assume anchor indicator already constructed
        vis.anchor = vis.config.anchor;
    }

    // validate anchor
    //if (!vis.anchor.output_stream.subtype_of('dated')) return cb(new Error("Anchor indicator's output type must be subtype of 'dated'""));
    if (!vis.anchor.output_stream.tstep) throw new Error('Chart anchor must have a defined timestep');
    vis.timestep = tsconfig.defs[vis.anchor.output_stream.tstep];
    if (!vis.timestep) throw new Error('Unrecognized timestep defined in chart anchor: ' + vis.anchor.output_stream.tstep);

    // define anchor indicator update event handler
    vis.anchor.output_stream.on('update', function(args) {
        vis.chart.on_comp_anchor_update(vis);
    }); // on anchor update

    // initialize indicators
    _.each(_.toPairs(vis.indicators), function(pair, idx) {
        var ind = pair[1]._indicator;

        // initialize visual data array
        pair[1].data = [];
        var first_index = 0; // for converting absolute stream indexes to data index
        var prev_index = -1; // tracks when new bars are added

        // define indicator update event handler
        ind.output_stream.on('update', function(args) {

            // update visual data array, insert new bar if applicable
            var current_index = ind.output_stream.current_index();
            if (current_index > prev_index) { // if new bar
                if (pair[1].data.length === vis.chart.setup.maxsize) {
                    pair[1].data.shift();
                    first_index += 1;
                }
                pair[1].data.push({key: current_index, value: ind.output_stream.record_templater()});
                prev_index = current_index;

            }

            // update modified bars
            if (_.isArray(args.modified)) {
                args.modified.forEach(function(idx) {
                    var val = ind.output_stream.get_index(idx);
                    pair[1].data[idx - first_index] = {key: idx, value: val};
                });
            }

            if (vis.chart.rendered && !vis.collapsed && vis.indicators_cont) {
                matrix_indicator_render(d3, vis, pair[1], vis.indicators_cont.select('#' + pair[0]), ind, idx);
            }
        });
    });

    vis.updateCursor = function() {};  // placeholder

    // title
    vis.title = vis.config.title || '';
    if (vis.title) {
        var subs = {
            chart_setup: vis.chart.chart_setup,
            instrument: vis.anchor.output_stream.instrument ? vis.anchor.output_stream.instrument.name : '(no instrument)',
            timestep: vis.anchor.output_stream.tstep
        };
        _.each(subs, function(val, key) {
            vis.title = vis.title.replace(new RegExp('{{' + key + '}}', 'g'), val);
        });
    }

};

Component.prototype.render = function() {
    var vis = this;

    if (!vis.visible) return;

    var chart_svg = vis.chart.chart;

    vis.x_factor = vis.chart.x_factor;
    vis.x = vis.x_factor * (vis.chart.setup.maxsize - Math.min(vis.chart.setup.maxsize, vis.anchor.output_stream.current_index() + 1));

    // handled by .resize()
    //vis.height = Object.keys(vis.indicators).length * (vis.chart.setup.bar_width + vis.chart.setup.bar_padding);

    vis.resize();

    vis.comp = chart_svg.insert('g', '#cursor').attr('class', 'component matrix')
        .attr('transform', 'translate(' + (vis.margin.left + vis.x + 0.5) + ',' + (vis.margin.top + vis.y + 0.5) + ')')
        .on('mouseover', () => vis.chart.showCursor(true))
        .on('mouseout', () => vis.chart.showCursor(false))
        .on('mousemove', () => vis.updateCursor())
        .on('contextmenu', function() {
            //console.log('context menu')
        })
        .on('click', function() {
            var mouse = d3.mouse(vis.comp[0][0]);
            var bar = Math.floor((mouse[0] + vis.chart.setup.bar_padding / 2) / vis.chart.x_factor);
            var indvals = _.fromPairs(_.map(vis.indicators, (val, key) => [key, val.data[bar].value]));
            indvals['_bar'] = bar;
            console.log(indvals);
        });

    vis.comp.append('rect')
        .classed({bg: 1, collapsed: vis.collapsed})
        .attr('x', -Math.floor(vis.chart.setup.bar_padding / 2))
        .attr('y', 0)
        .attr('width', vis.width)
        .attr('height', vis.height);

    if (!vis.collapsed) {
        // ticks & labels
        vis.ylabels = vis.comp.append('g').attr('class', 'y-labels');

        if (!vis.config.hide_x_ticks) {
            vis.xticks = vis.comp.append('g').attr('class', 'x-ticks');
        }

        // x labels
        if (vis.config.show_x_labels) {
            vis.chart.render_xlabels(vis);
        }
    }

    // border
    vis.comp.append('rect')
        .classed({border: 1, collapsed: vis.collapsed})
        .attr('x', -Math.floor(vis.chart.setup.bar_padding / 2))
        .attr('y', 0)
        .attr('width', vis.width)
        .attr('height', vis.height);

    if (!vis.collapsed) {

        // y labels
        vis.ylabels.selectAll('.y-label').remove();

        var ylabel = vis.ylabels.selectAll('.y-label')
            .data(_.toPairs(vis.indicators));

        // left
        if (vis.chart.setup.show_labels === 'both' || vis.chart.setup.show_labels === 'left') {
            ylabel.enter().append('text')
                .attr('class', 'y-label left pri')
                .text(d => d[1].name || d[0])
                .attr('x', -Math.floor(vis.chart.setup.bar_padding / 2) - 3)
                .attr('y', (d, i) => i * (vis.chart.setup.bar_width + vis.chart.setup.bar_padding) + (vis.chart.setup.bar_width + vis.chart.setup.bar_padding) / 2)
                .attr('text-anchor', 'end')
                .attr('dy', 4);
        }
        // right
        if (vis.chart.setup.show_labels === 'both' || vis.chart.setup.show_labels === 'right') {
            ylabel.enter().append('text')
                .attr('class', 'y-label right pri')
                .text(d => d[1].name || d[0])
                .attr('x', vis.width - Math.floor(vis.chart.setup.bar_padding / 2) + 1)
                .attr('y', (d, i) => i * (vis.chart.setup.bar_width + vis.chart.setup.bar_padding) + (vis.chart.setup.bar_width + vis.chart.setup.bar_padding) / 2)
                .attr('text-anchor', 'start')
                .attr('dy', 4);
        }

    }

    // data markings
    vis.indicators_cont = vis.comp.append('g').attr('class', 'indicators');

    // glass pane
    var glass = vis.comp.append('g')
        .attr('class', 'glass');

    // title
    var title_elem = glass.append('text')
        .attr('class', 'title')
        .attr('x', 4)
        .attr('y', 13)
        .text((vis.collapsed ? '►' : '▼') + vis.title)
        .on('click', function() {
            vis.collapsed = !vis.collapsed;
            vis.destroy();
            vis.render();
            vis.chart.on_comp_resize(vis);
        });

    // title bg
    var tb = title_elem.node().getBBox();
    glass.insert('rect', '.title')
        .attr('class', 'title_bg')
        .attr('x', Math.floor(tb.x - 3) + 0.5)
        .attr('y', Math.floor(tb.y) + 0.5)
        .attr('width', tb.width + 6)
        .attr('height', tb.height);

    vis.update();

    if (!vis.collapsed) {
        _.each(_.toPairs(vis.indicators), function(pair, idx) {
            var ind = pair[1]._indicator;
            var cont = vis.indicators_cont.append('g').attr('id', pair[0]).attr('class', 'indicator');
            matrix_indicator_render(d3, vis, pair[1], cont, ind, idx);
        });
    }

};

Component.prototype.resize = function() {
    this.width = (this.chart.setup.bar_width + this.chart.setup.bar_padding) * Math.min(this.chart.setup.maxsize, this.anchor.current_index() + 1);
    if (this.collapsed) {
        this.height = this.config.collapsed_height;
    } else {
        this.height = Object.keys(this.indicators).length * (this.chart.setup.bar_width + this.chart.setup.bar_padding);
    }
};

Component.prototype.reposition = function() {
    this.comp.attr('transform', 'translate(' + (this.margin.left + this.x + 0.5) + ',' + (this.margin.top + this.y + 0.5) + ')');
};

// Update component pieces only (excluding indicators, yticks and ylabels)
Component.prototype.update = function() {

    var vis = this;

    if (!vis.visible) return;

    vis.comp.select('rect.bg').attr('width', vis.width);
    vis.comp.select('rect.border').attr('width', vis.width);

    if (!vis.collapsed) {
        // x ticks
        if (!vis.config.hide_x_ticks) {
            var xtick = vis.xticks.selectAll('.x-tick')
                .data(vis.chart.timegroup)
                .attr('x1', function(d) {return (d.start - vis.chart.first_index) * (vis.chart.setup.bar_width + vis.chart.setup.bar_padding) - Math.floor(vis.chart.setup.bar_padding / 2);})
                .attr('y1', 0)
                .attr('x2', function(d) {return (d.start - vis.chart.first_index) * (vis.chart.setup.bar_width + vis.chart.setup.bar_padding) - Math.floor(vis.chart.setup.bar_padding / 2);})
                .attr('y2', vis.height);
            xtick.enter().append('line')
                .attr('class', 'x-tick')
                .attr('x1', function(d) {return (d.start - vis.chart.first_index) * (vis.chart.setup.bar_width + vis.chart.setup.bar_padding) - Math.floor(vis.chart.setup.bar_padding / 2);})
                .attr('y1', 0)
                .attr('x2', function(d) {return (d.start - vis.chart.first_index) * (vis.chart.setup.bar_width + vis.chart.setup.bar_padding) - Math.floor(vis.chart.setup.bar_padding / 2);})
                .attr('y2', vis.height);
            xtick.exit().remove();
        }

        // left y-label
        if (vis.chart.setup.show_labels === 'both' || vis.chart.setup.show_labels === 'left') {
            vis.ylabels.selectAll('.y-label.left')
                .attr('x', -Math.floor(vis.chart.setup.bar_padding / 2) - 3);
        }

        // right y-label
        if (vis.chart.setup.show_labels === 'both' || vis.chart.setup.show_labels === 'right') {
            vis.ylabels.selectAll('.y-label.right')
                .attr('x', vis.width - Math.floor(vis.chart.setup.bar_padding / 2) + 1);
        }
    }

    // update x labels if enabled
    if (this.config.show_x_labels && !this.collapsed) this.chart.update_xlabels(this);

};

Component.prototype.destroy = function() {
    this.comp.remove();
};

return Component;

///////////////////////////////////////////////////////////////////////////////////////////////////

function matrix_indicator_render(d3, vis, options, cont, ind, idx) {

    var data = options.data;

    var cell = cont.selectAll('rect')
      .data(data, d => d.key)
        .attr('x', (d, i) => i * (vis.chart.setup.bar_width + vis.chart.setup.bar_padding));
    var newcell = cell.enter().append('rect')
        .attr('class', 'cell')
        .attr('x', (d, i) => i * (vis.chart.setup.bar_width + vis.chart.setup.bar_padding))
        .attr('y', idx * (vis.chart.setup.bar_width + vis.chart.setup.bar_padding) + vis.chart.setup.bar_padding / 2)
        .attr('width', () => vis.chart.setup.bar_width)
        .attr('height', () => vis.chart.setup.bar_width)
        .attr('rx', 2)
        .attr('ry', 2);
    cell.exit().remove();

    ////////////////////////////////////////////////////////////////////
    // Apply styling to cell based on type

    var yellow_color = 'rgba(251, 228, 51, 0.7)';
    var green_color = 'rgba(0, 255, 0, 0.6)';
    var red_color = 'rgba(255, 0, 0, 0.6)';

    // bool - on/off color
    if (ind.output_stream.subtype_of('bool')) {
        newcell.style('fill', d => d.value ? (options.color || yellow_color) : 'none');

    // direction - up/down color
    } else if (ind.output_stream.subtype_of('direction')) {
        newcell.style('fill', d => (d.value === 1) ? (options.up_color || green_color) : ((d.value === -1) ? (options.down_color || red_color) : 'none'));

    // qual - linear color scale
    } else if (ind.output_stream.subtype_of('qual')) {

    // num - linear color scale
    } else if (ind.output_stream.subtype_of('num')) {

        var color_scale = d3.scale.linear()
            .domain([-options.far_lim, 0, options.far_lim])
            .range(_.isArray(options.colorscale) ? options.colorscale : ['#CC1B00', '#8F8F79', '#027F00'])
            .clamp(true);

        var opacity_scale = d3.scale.linear()
            .domain([-options.far_lim, 0, options.far_lim])
            .range(_.isArray(options.opacityscale) ? options.opacityscale : [1.0, 0.0, 1.0])
            .clamp(true);

        newcell.style('fill', d => _.isFinite(d.value) && (!options.near_lim || Math.abs(d.value) >= options.near_lim) ? color_scale(d.value) : 'none');
        newcell.style('fill-opacity', d => _.isFinite(d.value) && (!options.near_lim || Math.abs(d.value) >= options.near_lim) ? opacity_scale(d.value) : 1.0);

    // trade_cmds - up/down color
    } else if (ind.output_stream.subtype_of('trade_cmds')) {
        newcell.style('fill', function(d) {
            var val = _.reduce(d.value, (memo, cmd) => memo || (cmd[0] === 'enter' && cmd[1].direction), null);
            return (val === 1) ? (options.up_color || green_color) : ((val === -1) ? (options.down_color || red_color) : 'none');
        });
    } else {
       throw new Error('Component matrix unsupported type: ' + ind.output_stream.type);
    }

}

});
