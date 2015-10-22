'use strict';

define(['underscore', 'd3', 'eventemitter2', 'config/timeframes', 'uitools'], function(_, d3, EventEmitter2, tconfig, uitools) {

var default_config = {
    height: 100,
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
    this.margin = this.config.margin;
    // inherit left/right margins from chart
    this.margin.left = this.chart.margin.left;
    this.margin.right = this.chart.margin.right;
    this.width = 0; // grows with anchor indicator new bar updates
    this.height = this.config.height;
    this.collapsed = this.config.collapsed;

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

    // title
    vis.title = vis.config.title || '';
    if (vis.title) {
        var subs = {
            chart_setup: vis.chart.chart_setup,
            instrument: vis.chart.anchor.output_stream.instrument ? vis.chart.anchor.output_stream.instrument.name : '(no instrument)',
            timeframe: vis.chart.anchor.output_stream.tf
        };
        _.each(subs, function(val, key) {
            vis.title = vis.title.replace(new RegExp('{{' + key + '}}', 'g'), val);
        });
    }
    
    // initialize controls
    vis.controls = {};
    _.each(vis.config.controls, function(control_config, control_id) {
        var control;
        switch(control_config.type) {
            case 'radio':
                control = new uitools.RadioControl(control_config);
                break;
            default:
                throw new Error("Control config must defined a 'type' property");
        }
        vis.controls[control_id] = control;
        control.on('changed', function(value) {
            console.log("'" + control_id + "' changed to: " + value);
        });
    });    

};

Component.prototype.render = function() {

    var vis = this;
    var chart_svg = vis.chart.chart;

    vis.x_factor = vis.chart.x_factor;
    vis.x = vis.x_factor * (vis.chart.setup.maxsize - Math.min(vis.chart.setup.maxsize, vis.chart.anchor.output_stream.current_index() + 1));

    vis.resize();

    vis.comp = chart_svg.insert('g', '#cursor').attr('class', 'component panel')
        .attr('transform', 'translate(' + (vis.margin.left + vis.x + 0.5) + ',' + (vis.margin.top + vis.y + 0.5) + ')')
        //.on("mouseover", function() {vis.chart.showCursor(true)})
        //.on("mouseout", function() {vis.chart.showCursor(false)})
        //.on("mousemove", function() {vis.updateCursor()})
        .on('contextmenu', function() {
            //console.log("context menu")
        })

    vis.comp.append('rect')
        .classed({bg: 1, collapsed: vis.collapsed})
        .attr('x', -Math.floor(vis.chart.setup.bar_padding / 2))
        .attr('y', 0)
        .attr('width', vis.chart.width)
        .attr('height', vis.height);

    if (!vis.collapsed) {
        // ticks & labels
        vis.ylabels = vis.comp.append('g').attr('class', 'y-labels');

        if (!vis.config.hide_x_ticks) {
            vis.xticks = vis.comp.append('g').attr('class', 'x-ticks');
        }
    }

    // x labels
    if (vis.config.show_x_labels) {
        vis.chart.render_xlabels(vis);
    }

    // border
    vis.comp.append('rect')
        .classed({border:1, collapsed: vis.collapsed})
        .attr('x', -Math.floor(vis.chart.setup.bar_padding/2))
        .attr('y', 0)
        .attr('width', vis.chart.width)
        .attr('height', vis.height);

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
            vis.height = vis.collapsed ? vis.config.collapsed_height : vis.config.height;
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
        .attr('height', tb.height)

    vis.update();

    if (!vis.collapsed) {
        var xpos = 20;
        var ypos = 5;            
        _.each(vis.controls, function(control, control_id) {
            control.container = vis.comp;
            control.config.position = {left: xpos, top: ypos};
            control.config.padding = {top: 5, right: 10, bottom: 5, left: 10},
            control.render();
            xpos += control.config.margin.left + control.width + control.config.margin.right;
        });
    }

};

Component.prototype.resize = function() {
    this.width = (this.chart.setup.bar_width + this.chart.setup.bar_padding) * Math.min(this.chart.setup.maxsize, this.chart.anchor.current_index() + 1);
    this.height = this.collapsed ? this.config.collapsed_height : this.height;
};

Component.prototype.reposition = function() {
    this.comp.attr('transform', 'translate(' + (this.margin.left + this.x + 0.5) + ',' + (this.margin.top + this.y + 0.5) + ')');
};

// Update component pieces only (excluding indicators, yticks and ylabels)
Component.prototype.update = function() {

    var vis = this;

    vis.comp.select('rect.bg').attr('width', vis.chart.width);
    vis.comp.select('rect.border').attr('width', vis.chart.width);

    // update x labels if enabled
    if (this.config.show_x_labels) this.chart.update_xlabels(this);

};

Component.prototype.destroy = function() {
    this.comp.remove();
};

return Component;

});
