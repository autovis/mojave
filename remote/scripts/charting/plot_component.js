"use strict";

define(['underscore', 'd3', 'config/timeframes'], function(_, d3, tconfig) {

var default_config = {
    title: "Indicator_Plot_Title",
    height: 200,
    margin: {
        top: 0,
        bottom: 1
    },
    y_scale: {
        domain: [0,1],
        ticks: 100
    },
    //volume_scale: 0.05,
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
    // comp height does not include top/bottom margins
    this.x = 0;
    this.y = 0;
    this.width = 0; // grows with anchor indicator new bar updates
    this.height = this.config.height;
    this.collapsed = this.config.collapsed;

    this.anchor = null;
    this.anchor_data = [];
    this.timeframe = null;
    this.timegroup = [];    // data used for major x labels
    this.first_index = 0;   // first index used by anchor
    this.prev_index = -1;   // to track new bars in anchor

    this.ymin = Infinity;
    this.ymax = -Infinity;
    this.yspan = null;
    this.y_scale = null;

	return this;
}

Component.prototype = {

	constructor: Component,

    init: function() {

        var vis = this;

        // set up scale
        vis.y_scale = d3.scale.linear()
            .range([vis.height,0]);
        if (_.isObject(vis.config.y_scale)) {
            if (_.isArray(vis.config.y_scale.domain)) {
                vis.y_scale.domain(vis.config.y_scale.domain);
            }
        }

        // set up anchor indicator
        if (_.isString(vis.config.anchor)) {
            var ind = vis.chart.collection.indicators[vis.config.anchor];
            if (!ind) throw new Error("Unrecognized indicator '"+vis.config.anchor+"' for chart anchor");
            vis.anchor = ind;
        } else if (vis.chart.anchor) {
            vis.anchor = vis.chart.anchor;
        } else if (!vis.config.anchor) {
            throw new Error("Anchor stream/indicator must be defined for component or its containing chart");
        } else { // assume anchor indicator already constructed
            vis.anchor = vis.config.anchor;
        }

        // validate anchor
        //if (!vis.anchor.output_stream.subtype_of('dated')) return cb(new Error("Anchor indicator's output type must be subtype of 'dated'"));
        if (!vis.anchor.output_stream.tf) throw new Error("Chart anchor must have a defined timeframe");
        vis.timeframe = tconfig.defs[vis.anchor.output_stream.tf];
        if (!vis.timeframe) throw new Error("Unrecognized timeframe defined in chart anchor: "+vis.anchor.output_stream.tf);

        // define anchor indicator update event handler
        vis.anchor.output_stream.on("update", function(args) {
            vis.chart.on_comp_anchor_update(vis);
        }); // on anchor update

        // initialize indicators
        _.each(vis.indicators, function(ind_attrs, id) {
            var ind = ind_attrs._indicator;

            if (!ind.indicator.vis_render || !ind.indicator.vis_update) throw new Error("Indicator '"+id+"' must define vis_render() and vis_update() functions");
            if (_.isFunction(ind.indicator.vis_init)) ind.indicator.vis_init.apply(ind.context, [d3, vis, ind_attrs]);

            // determine which indicator output streams will be plotted in component
            if (_.isEmpty(ind.output_stream.fieldmap)) {
                if (!ind.output_stream.subtype_of("num")) throw new Error("Indicator '"+id+"' must output a number or an object");
                ind_attrs.plot_streams = [ind.output_stream];
                ind_attrs.plot_data = [];
            } else {
                if (_.isArray(ind.indicator.vis_render_fields)) {
                    var suppressed = _.isArray(ind_attrs.suppress) ? ind_attrs.suppress : [ind_attrs.suppress];
                    ind_attrs.plot_streams = _.compact(_.map(ind.indicator.vis_render_fields, function(field) {
                        if (suppressed.indexOf(field) > -1) return null;
                        return ind.output_stream.substream(field);
                    }));
                } else {
                    console.log(ind.output_stream.fieldmap);
                    throw new Error("No subfields specified for plotting '"+id+"' indicator in 'vis_render_fields' array, or all are suppressed");
                }
            }

            // initialize visual data array
            ind_attrs.data = [];
            var first_index = 0; // for converting absolute stream indexes to data index
            var prev_index = -1; // tracks when new bars are added

            // define indicator update event handler
            ind.output_stream.on("update", function(args) {

                // update visual data array, insert new bar if applicable
                var current_index = ind.output_stream.current_index();
                if (current_index > prev_index) { // if new bar
                    if (ind_attrs.data.length == vis.chart.config.maxsize) {
                        ind_attrs.data.shift();
                        first_index++;
                    }
                    ind_attrs.data.push({key: current_index, value: ind.output_stream.record_templater()});
                    prev_index = current_index;

                    // TODO: Replace temp hack with more efficient way of recalculating max/min for scale on each new bar
                    var vals = _.filter(_.flatten(_.map(vis.plot_streams, function(str) {return _.map(_.range(first_index, current_index+1), function(idx) {return str.get_index(idx)})})), _.isFinite);
                    vis.ymin = _.min(vals);
                    vis.ymax = _.max(vals);
                } else {
                    vis.ymin = ind_attrs.plot_streams.reduce(function(ymin, str) {return Math.min(ymin, _.isFinite(str.get(0)) ? str.get(0) : ymin)}, vis.ymin);
                    vis.ymax = ind_attrs.plot_streams.reduce(function(ymax, str) {return Math.max(ymax, _.isFinite(str.get(0)) ? str.get(0) : ymax)}, vis.ymax);
                }

                // update modified bars
                if (_.isArray(args.modified)) {
                    args.modified.forEach(function(idx) {
                        var val = ind.output_stream.get_index(idx);
                        ind_attrs.data[idx - first_index] = {key: idx, value: val};
                    });
                }

                // adjust scale based on min/max values of y axis
                if (vis.config.y_scale && vis.config.y_scale.autoscale && _.isFinite(vis.ymin) && _.isFinite(vis.ymax)) {
                    var dom = vis.y_scale.domain();
                    if (vis.ymin != dom[0] || vis.ymax != dom[1]) {
                        vis.y_scale.domain([vis.ymin, vis.ymax]);
                        if (vis.chart.rendered && !vis.collapsed) vis.on_scale_changed();
                    }
                }

                if (vis.chart.rendered && !vis.collapsed) {
                    vis.data = ind_attrs.data;
                    var cont = vis.indicators_cont.select("#"+id);

                    if (current_index > prev_index) { // if new bar
                        ind.indicator.vis_render.apply(ind.context, [d3, vis, ind_attrs, cont]);
                    } else {
                        ind.indicator.vis_update.apply(ind.context, [d3, vis, ind_attrs, cont]);
                    }
                    delete vis.data;
                }
            }); // ind.output_stream.on("update", ...
        });

        vis.plot_streams = _.flatten(_.map(vis.indicators, function(attrs) {return attrs.plot_streams || []}), true);

        vis.updateCursor = function() {};  // placeholder

        // title
        vis.title = vis.config.title || "";
        if (vis.title) {
            var subs = {
                chart_setup: vis.chart.chart_setup,
                instrument: vis.anchor.output_stream.instrument ? vis.anchor.output_stream.instrument.name : "(no instrument)",
                timeframe: vis.anchor.output_stream.tf
            }
            _.each(subs, function(val, key) {
                vis.title = vis.title.replace(new RegExp("{{"+key+"}}", 'g'), val);
            });
        }

    },

    render: function() {

        var vis = this;
        var chart_svg = vis.chart.chart;

        vis.x_factor = vis.chart.x_factor;
        vis.x = vis.x_factor * (vis.chart.config.maxsize - Math.min(vis.chart.config.maxsize, vis.anchor.output_stream.current_index()+1));

        // y_labels format
        if (vis.config.y_scale.price) { // price custom formatter
            vis.y_label_formatter = function(x) {return x.toFixed(parseInt(Math.log(1/vis.chart.anchor.output_stream.instrument.unit_size)/Math.log(10)))};
        } else { // use default d3 formatter
            vis.y_label_formatter = vis.y_scale.tickFormat(vis.config.y_scale.ticks);
        }

        // y-scale cursor format
        if (vis.config.y_scale.price) { // round based on instrument unit_size
            vis.y_cursor_label_formatter = function(x) {return x.toFixed(parseInt(Math.log(1/vis.chart.anchor.output_stream.instrument.unit_size)/Math.log(10))+1)};
        } else if (_.isNumber(vis.config.y_scale.round)) { // round to decimal place
            vis.y_cursor_label_formatter = function(val) {return d3.round(val, vis.config.y_scale.round)};
        } else if (vis.config.y_scale.round) { // round to integer
            vis.y_cursor_label_formatter = function(val) {return Math.round(val)};
        } else { // use default d3 formatter
            vis.y_cursor_label_formatter = vis.y_scale.tickFormat(vis.config.y_scale.ticks);
        }

        vis.resize();

        vis.comp = chart_svg.insert("g", "#cursor").attr("class", "component")
            .attr("transform", "translate("+(vis.margin.left+vis.x+0.5)+","+(vis.margin.top+vis.y+0.5)+")")
            //.attr("cursor", "none")
            .on("mouseover", function() {vis.chart.showCursor(true)})
            .on("mouseout", function() {vis.chart.showCursor(false)})
            .on("mousemove", function() {vis.updateCursor()})
            .on("contextmenu", function() {
                console.log("context menu");
            })
            .on("click", function() {
                var mouse = d3.mouse(vis.comp[0][0]);
                var idx = Math.floor((mouse[0]+vis.chart.config.bar_padding/2)/vis.chart.x_factor);
                var indvals = _.object(_.map(vis.indicators, function(val, key) {return [key, val.data[idx].value]}));
                indvals["_idx"] = _.first(_.values(vis.indicators)).data[idx].key;
                console.log(indvals);
            });

        vis.comp.append("rect")
            .attr("class", "bg")
            .attr("x", -Math.floor(vis.chart.config.bar_padding/2))
            .attr("y", 0)
            .attr("width", vis.width)
            .attr("height", vis.height);

        if (!vis.collapsed) {
            // ticks & labels
            vis.yticks = vis.comp.append("g").attr("class", "y-ticks");
            vis.ylabels = vis.comp.append("g").attr("class", "y-labels");
            vis.ylines = vis.comp.append("g").attr("class", "y-lines");

            if (!vis.config.hide_x_ticks) {
                vis.xticks = vis.comp.append("g").attr("class", "x-ticks");
            }
        }


        // render x labels
        if (vis.config.show_x_labels) {
            vis.chart.render_xlabels(vis);
        }

        // border
        vis.comp.append("rect").attr("class","border")
            .attr("x", -Math.floor(vis.chart.config.bar_padding/2))
            .attr("y", 0)
            .attr("width", vis.width)
            .attr("height", vis.height);

        if (!vis.collapsed) {
            // data markings
            vis.indicators_cont = vis.comp.append("g").attr("class", "indicators");
        }

        // glass pane
        var glass = vis.comp.append("g")
            .attr("class", "glass");

        if (_.isString(vis.title)) {
            // title
            var title_elem = glass.append("text")
                .attr("class", "title")
                .attr("x", 4)
                .attr("y", 13)
                .text(vis.title);
            // title bg
            var tb = title_elem.node().getBBox();
            glass.insert("rect", ".title")
                .attr("class", "title_bg")
                .attr("x", Math.floor(tb.x-3)+0.5)
                .attr("y", Math.floor(tb.y)+0.5)
                .attr("width", tb.width+6)
                .attr("height", tb.height);
        }

        if (!vis.collapsed) {

            vis.update();

            _.each(vis.indicators, function(ind_attrs, id) {
                var ind = ind_attrs._indicator;
                var cont = vis.indicators_cont.append("g").attr("id", id).attr("class", "indicator");
                vis.data = ind_attrs.data;
                if (_.isFunction(ind.indicator.vis_render)) ind.indicator.vis_render.apply(ind.context, [d3, vis, ind_attrs, cont]);
            });
            delete vis.data;
        }

    },

    resize: function() {
        this.width = (this.chart.config.bar_width + this.chart.config.bar_padding) * Math.min(this.chart.config.maxsize, this.anchor.current_index()+1);
        this.height = this.collapsed ? this.config.collapsed_height : this.config.height;
    },

    reposition: function() {
        this.comp.attr("transform", "translate("+(this.margin.left+this.x+0.5)+","+(this.margin.top+this.y+0.5)+")");
    },

    // Update component pieces only (excluding indicators, yticks and ylabels)
    update: function() {

        var vis = this;

        vis.comp.select("rect.bg").attr("width", vis.width);
        vis.comp.select("rect.border").attr("width", vis.width);

        if (!vis.collapsed) {

            // x ticks
            if (!vis.config.hide_x_ticks) {
                var xtick = vis.xticks.selectAll(".x-tick")
                  .data(vis.timegroup)
                    .attr("x1", function(d) {return (d.start-vis.first_index)*(vis.chart.config.bar_width+vis.chart.config.bar_padding)-Math.floor(vis.chart.config.bar_padding/2)})
                    .attr("y1", 0)
                    .attr("x2", function(d) {return (d.start-vis.first_index)*(vis.chart.config.bar_width+vis.chart.config.bar_padding)-Math.floor(vis.chart.config.bar_padding/2)})
                    .attr("y2", vis.height);
                xtick.enter().append("line")
                    .attr("class", "x-tick")
                    .attr("x1", function(d) {return (d.start-vis.first_index)*(vis.chart.config.bar_width+vis.chart.config.bar_padding)-Math.floor(vis.chart.config.bar_padding/2)})
                    .attr("y1", 0)
                    .attr("x2", function(d) {return (d.start-vis.first_index)*(vis.chart.config.bar_width+vis.chart.config.bar_padding)-Math.floor(vis.chart.config.bar_padding/2)})
                    .attr("y2", vis.height);
                xtick.exit().remove();
            }

            vis.on_scale_changed();
        }

        // update x labels if enabled
        if (this.config.show_x_labels) this.chart.update_xlabels(this);
    },

    on_scale_changed: function() {
        var vis = this;

        var ticknum;
        var domain = vis.y_scale.domain();
        var range = Math.abs(domain[1] - domain[0]);
        var getticktype = function(d) {
            if (d == 0) return "pri";
            if (Math.floor(Math.round(d)/100)*100 == Math.round(d)) {
                return "ter";
            } else if (Math.floor(Math.round(d)/10)*10 == Math.round(d)) {
                return "sec";
            } else {
                return "pri";
            }
        };

        if (vis.config.y_scale.price) {
            var unitsize = vis.chart.anchor.output_stream.instrument.unit_size;
            range = Math.round(range / unitsize);
            ticknum = range;
            getticktype = _.compose(getticktype, function(d) {return d/unitsize});
        } else if (_.isFinite(vis.config.y_scale.ticks)) {
            ticknum = vis.config.y_scale.ticks;
            getticktype = function() {return "pri"};
        } else if (_.isFinite(vis.config.y_scale.tick_interval)) {
            ticknum = Math.round(range / vis.config.y_scale.tick_interval);
            getticktype = _.compose(getticktype, function(d) {return d/vis.config.y_scale.tick_interval});
        } else {
            ticknum = 5;
            getticktype = function() {return "pri"};
        }

        ticknum = ticknum / vis.height > 10 ? Math.round(ticknum / 100) : (vis.height / ticknum < 10 ? Math.round(ticknum / 10) : ticknum);

        // y ticks
        var ytick = vis.yticks.selectAll(".y-tick")
          .data(vis.y_scale.ticks(ticknum))
            .attr("y1", function(d) {return Math.floor(vis.y_scale(d))})
            .attr("x1", -Math.floor(vis.chart.config.bar_padding/2)-0.5)
            .attr("y2", function(d) {return Math.floor(vis.y_scale(d))})
            .attr("x2", vis.width-Math.floor(vis.chart.config.bar_padding/2)-0.5)
            .attr("type", getticktype);
        ytick.enter().append("line")
            .attr("class", "y-tick")
            .attr("y1", function(d) {return Math.floor(vis.y_scale(d))})
            .attr("x1", -Math.floor(vis.chart.config.bar_padding/2)-0.5)
            .attr("y2", function(d) {return Math.floor(vis.y_scale(d))})
            .attr("x2", vis.width-Math.floor(vis.chart.config.bar_padding/2)-0.5)
            .attr("type", getticktype);
        ytick.exit().remove();

        // use ticknum for label placement - reduce to 1/10 if labels too dense
        ticknum = vis.height / ticknum < 10 ? Math.round(ticknum / 10) : ticknum;

        // y labels
        vis.ylabels.selectAll(".y-label").remove();

        var ylabel = vis.ylabels.selectAll(".y-label")
            .data(vis.y_scale.ticks(ticknum));
        // left
        ylabel.enter().append("text")
            .attr("class", function(d) {return "y-label left "+getticktype(d)})
            .text(vis.y_label_formatter)
            .attr("x", -Math.floor(vis.chart.config.bar_padding/2)-3)
            .attr("y", function(d) {return Math.floor(vis.y_scale(d))})
            .attr("text-anchor", "end")
            .attr("dy", 4);
        // right
        ylabel.enter().append("text")
            .attr("class", function(d) {return "y-label right "+getticktype(d)})
            .text(vis.y_label_formatter)
            .attr("x", vis.width-Math.floor(vis.chart.config.bar_padding/2)+1)
            .attr("y", function(d) {return Math.floor(vis.y_scale(d))})
            .attr("text-anchor", "start")
            .attr("dy", 4);

        // plot y-lines
        if (!_.isEmpty(vis.config.levels)) {
            var ylines_in_view = _.filter(vis.config.levels, function(line) {return line.y >= vis.ymin && line.y <= vis.ymax});
            var y_line = vis.ylines.selectAll("line")
              .data(ylines_in_view)
                .attr("y1", function(d) {return Math.round(vis.y_scale(d.y))})
                .attr("x2", vis.width-Math.floor(vis.chart.config.bar_padding/2)-0.5)
                .attr("y2", function(d) {return Math.round(vis.y_scale(d.y))});

            y_line.enter().append("line")
                .attr("x1", -Math.floor(vis.chart.config.bar_padding/2)-0.5)
                .attr("y1", function(d) {return Math.round(vis.y_scale(d.y))})
                .attr("x2", vis.width-Math.floor(vis.chart.config.bar_padding/2)-0.5)
                .attr("y2", function(d) {return Math.round(vis.y_scale(d.y))})
                .attr("stroke", function(d) {return d.color || "blue"})
                .attr("stroke-width", function(d) {return parseInt(d.width) || 2})
                .attr("stroke-opacity", function(d) {return parseFloat(d.opacity) || 1})
                .attr("stroke-dasharray", function(d) {return d.dasharray || "none"});
            y_line.exit().remove();
        }

    },

    destroy: function() {
        this.comp.remove();
    }

};

return Component;

});
