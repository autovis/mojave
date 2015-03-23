"use strict";

define(['underscore', 'async', 'd3', 'config/timeframes', 'indicator_collection', 'charting/plot_component', 'charting/matrix_component'],
    function(_, async, d3, timeframes, IndicatorCollection, IndicatorPlot, IndicatorMatrix) { 

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

    maxsize: 100
};

function Chart(chart_setup, input_streams, container) {
	if (!(this instanceof Chart)) return Chart.apply(Object.create(Chart.prototype), arguments);

    this.chart_setup = chart_setup;
    this.input_streams = _.isArray(input_streams) ? input_streams : [input_streams];
    this.last_index = -1;

    this.dateformat = d3.time.format("%Y-%m-%d %H:%M:%S");
    this.cursorformat = d3.time.format("%a %-m/%-d %H:%M");

    this.container = container;
    this.rendered = false;

	return this;
}

Chart.prototype = {

	constructor: Chart,

    // To be called after data and components are defined and before render()
    init: function(callback) {
        if (!_.isFunction(callback)) throw new Error("No (valid) callback given for Chart.init(cb)");

        var vis = this;

        async.series([

            // load chart setup, define default values
            function(cb) {
                requirejs(['chart_setups/'+vis.chart_setup], function(setup) {
                    vis.config = _.defaults(setup, default_config); // apply defaults
                    vis.margin = vis.config.margin;
                    vis.anchor_data = [];
                    vis.timegroup = [];
                    cb();
                });
            },

            // load collection
            function(cb) {
                if (!vis.config.collection) return cb("No indicator collection is defined, or is not a string");
                var get_ind = function(o) {
                    if (!_.isArray(o)) return null;
                    if (_.first(o) === "$xs") {
                        return o.slice(1).map(get_ind);
                    } else if (_.isObject(o[0]) && !_.isArray(o[0])) {
                        return [get_ind(o[1]), o[2]];
                    } else {
                        return [get_ind(o[0]), o[1]];    
                    }
                };
                if (vis.config.collection instanceof IndicatorCollection) {
                    vis.collection = vis.config.collection.clone();
                    delete vis.config.collection; // remove reference to original collection
                    cb();
                } else if (_.isString(vis.config.collection)) {
                    requirejs(["collections/"+vis.config.collection], function(ind_defs) {
                        // ensure all dependency indicator modules are loaded
                        var deps = _.unique(_.compact(_.flatten(_.map(ind_defs, function(def) {return get_ind(def)}))));
                        deps = _.map(deps, function(dep) {return "indicators/"+dep.replace(':', '/')});
                        requirejs(deps, function() {
                            vis.collection = new IndicatorCollection(ind_defs, vis.input_streams);
                            cb();
                        });
                    });
                } else { // assume collection definitions
                    var deps = _.unique(_.compact(_.flatten(_.map(vis.config.collection, function(def) {return get_ind(def)}))));
                    deps = _.map(deps, function(dep) {return "indicators/"+dep.replace(':', '/')});
                    requirejs(deps, function() {
                        vis.collection = new IndicatorCollection(vis.config.collection, vis.input_streams);
                        cb();
                    });
                }
            },
            
            // define anchor, components and set up their indicators
            function(cb) {

                // anchor indicator to drive time intervals across chart
                if (!vis.config.anchor) {
                    throw new Error("Anchor stream/indicator must be defined for chart");
                } else if (_.isString(vis.config.anchor)) {
                    var ind = vis.collection.indicators[vis.config.anchor];
                    if (!ind) return cb(new Error("Unrecognized indicator '"+vis.config.anchor+"' for chart anchor"));
                    vis.anchor = ind;
                } else {
                    vis.anchor = vis.config.anchor;  
                }
                if (!vis.anchor.output_stream.subtype_of('dated')) return cb(new Error("Anchor indicator's output type must be subtype of 'dated'"));
                if (!vis.anchor.output_stream.tf) return cb(new Error("Chart anchor must define a timeframe"));                 
                vis.timeframe = timeframes.defs[vis.anchor.output_stream.tf];
                if (!vis.timeframe) return cb(new Error("Unrecognized timeframe defined in chart anchor: "+vis.anchor.output_stream.tf));
            
                // on anchor update
                var prev_index = -1;

                // define anchor indicator update event handler
                vis.anchor.output_stream.on("update", function() {

                    var current_index = vis.anchor.current_index();
                    if (current_index > prev_index) { // if new bar

                        var bar = vis.anchor.output_stream.get(0);
                        var update_chart = false;

                        // update anchor data
                        if (vis.anchor_data.length == vis.config.maxsize) {
                            vis.anchor_data.shift();
                            /*
                            vis.timegroup[0].entries.shift();
                            if (_.isEmpty(vis.timegroup[0].entries)) vis.timegroup.shift(); else vis.timegroup[0].start++;
                            */
                        } else {
                            vis.width = (vis.config.bar_width + vis.config.bar_padding) * Math.min(vis.config.maxsize, vis.anchor.current_index()+1);
                            update_chart = true; // chart dimensions changed
                        }
                        vis.anchor_data.push(bar);                        

                        // Group the major labels by timegroup for timeframe
                        /*
                        var last = _.last(vis.timegroup);
                        var newbar = _.clone(bar);
                        delete newbar.date;

                        var group_date = vis.timeframe.tg_hash(bar);
                        if (_.isEmpty(last) || last.key.valueOf() !== group_date.valueOf()) {
                            vis.timegroup.push({key: group_date, entries: [newbar], start: _.isEmpty(last) ? vis.first_index : last.start + last.entries.length});
                        } else {
                            last.entries.push(newbar);
                        }
                        */

                        if (vis.rendered) if (update_chart) vis.update();

                        prev_index = current_index;
                    }
                }); // on anchor update

                // create components AND (create new indicator if defined in chart_setup OR reference corresp. existing one in collection)
                // collect all references to indicators defined in chart_setup to load new deps
                var newdeps = _.unique(_.compact(_.flatten(_.map(chart.config.components, function(comp_def) {
                    return _.flatten(_.map(comp_def.indicators, function(val, key) {
                        if (!_.isObject(val) || !_.isObject(val.def)) return null;
                        return _.map(getnames(val.def), function(indname) {
                            return _.isString(indname) ? "indicators/"+indname.replace(':', '/') : null;
                        });
                    }), true);
                }), true)));
                requirejs(newdeps, function() { // load dependent indicators first
                    vis.components = _.map(chart.config.components, function(comp_def) {
                        comp_def.chart = chart;
                        var comp;
                        if (comp_def.type == 'matrix') {
                            comp = new IndicatorMatrix(comp_def);                        
                        } else {    
                            comp = new IndicatorPlot(comp_def);
                        }
                        comp.indicators = _.object(_.compact(_.map(comp.indicators, indicator_builder)));
                        return comp;
                    });
                    cb();
                });
            },

            // initialize components
            function(cb) {

                var comp_y = 0;
                _.each(vis.components, function(comp) {
                    comp.y = comp_y;
                    comp.init.apply(comp);
                    comp_y += comp.config.margin.top + comp.height + comp.config.margin.bottom;
                });
                cb();
            },

            // set up chart indicators
            function(cb) {
                // get references to chart indicators
                var newdeps =  _.unique(_.compact(_.flatten(_.map(vis.config.indicators, function(val, key) {
                    if (!_.isObject(val) || !_.isObject(val.def)) return null;
                    return _.map(getnames(val.def), function(indname) {
                        return _.isString(indname) ? "indicators/"+indname.replace(':', '/') : null;
                    });
                }), true)));
                requirejs(newdeps, function() { // load dependent indicators first
                    vis.indicators = _.object(_.compact(_.map(vis.config.indicators, indicator_builder)));
                    _.each(vis.indicators, function(ind_attrs, id) {
                        var ind = ind_attrs._indicator;

                        if (!ind.indicator.vis_render || !ind.indicator.vis_update) throw new Error("Chart indicator '"+id+"' must define vis_render() and vis_update() functions");
                        if (_.isFunction(ind.indicator.vis_init)) ind.indicator.vis_init.apply(ind.context, [d3, vis, ind_attrs]);

                        // initialize visual data array
                        ind_attrs.data = [];
                        var first_index = 0; // for converting absolute stream indexes to data index
                        var prev_index = -1; // tracks when new bars are added

                        // define indicator update event handler
                        ind.output_stream.on("update", function(args) {

                            // update visual data array, insert new bar if applicable
                            var current_index = ind.output_stream.current_index();
                            if (current_index > prev_index) { // if new bar
                                if (ind_attrs.data.length == vis.config.maxsize) {
                                    ind_attrs.data.shift();
                                    first_index++;
                                }
                                ind_attrs.data.push({key: current_index, value: ind.output_stream.record_templater()});
                                prev_index = current_index;
                            }

                            // update modified bars
                            if (_.isArray(args.modified)) {
                                args.modified.forEach(function(idx) {
                                    var val = ind.output_stream.get_index(idx);
                                    ind_attrs.data[idx - first_index] = {key: idx, value: val};
                                });
                            }
                
                            if (vis.rendered) {
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
                    cb();
                });
            }
            
        ], callback);

        //////////////////////////////////////////////////////////////////////////////////////////////

        // helper function to grab nested anon indicators from definitions
        function getnames(def) {
            def = _.isObject(def[0]) && !_.isArray(def[0]) ? def.slice(1) : def; // remove options if present
            return _.isArray(def[0]) ? [def[1]].concat(getnames(def[0])) : [def[1]];
        }

        // helper function to create indicator from chart config key:value pair
        function indicator_builder(val, key) {
            var indicators = _.isObject(vis.collection) && _.isObject(vis.collection.indicators) ? vis.collection.indicators : {};
            if (_.has(val, "def") && _.isArray(val.def)) {
                // create new indicator (will override existing one in collection if same name)
                var newind = vis.collection.create_indicator(val.def);
                return [key, _.extend(val, {_indicator:newind, id:key})];
            } else if (_.has(indicators, key)) {
                // reference from collection
                return [key, _.extend(val, {_indicator:indicators[key], id:key})];
            } else {
                // TODO: Generate warning instead of throwing error
                throw new Error("Indicator not found in collection and not defined in chart_setup: "+key);    
            }
        }

    },

    // saves chart transformation that was set by zoom behavior; to be reapplied after chart is re-rendered
    save_transform: function() {
        if (this.chart && this.chart.attr("transform")) {
            var trans = this.chart.attr("transform");
            var m = trans.match(/^translate\(([\.0-9]+),([\.0-9]+)\)scale\(([\.0-9]+)\)/);
            //vis.transform = m ? {trans_x: m[1], trans_y: m[2], scale: m[3]} : {trans_x: 0.0, trans_y: 0.0, scale: 0.0};
            if (m) this.transform = {trans_x: m[1], trans_y: m[2], scale: m[3]};
        }
    },

    // recomputes dimensions
    resize: function() {
        var vis = this;

        // Initialize each chart component
        var comp_y = 0;
        _.each(this.components, function(comp) {
            comp.y = comp_y;
            comp.resize();
            comp_y += comp.config.margin.top + comp.height + comp.config.margin.bottom;
        });

        // Pull-in top/bottom margins from first/last components
        vis.margin.top = _.first(this.components).margin.top;
        vis.margin.bottom = _.last(this.components).margin.bottom;

        vis.width = (vis.config.bar_width + vis.config.bar_padding) * Math.min(vis.config.maxsize, vis.anchor.current_index()+1);
        vis.height = comp_y;
             
    }, // resize

    // responds to UI action to resize a component
    on_comp_resize: function(comp) {
        var vis = this;

        var comp_y = 0;
        var after = false;
        _.each(vis.components, function(comp0) {
            comp0.y = comp_y;
            if (comp0 === comp) {
                after = true;
                comp0.destroy();
                comp0.render(); 
            } else {
                if (after) comp0.reposition();
            }
            comp_y += comp0.config.margin.top + comp0.height + comp0.config.margin.bottom;
        });
        vis.height = comp_y;
        d3.select("#cursor rect").attr("height", vis.height-vis.margin.top);
    },

    // clears and renders chart
    render: _.throttle(function() {
        var vis = this;

        vis.x_factor = vis.config.bar_width+vis.config.bar_padding;

        vis.container.selectAll("svg").remove();

        var zoom = d3.behavior.zoom()
            .scaleExtent([0.3, 4])
            .on("zoom", zoomed);

        var vport = get_viewport();

        vis.svg = vis.container.append("svg") // top-most svg element
                .attr("width", vport[0]-3)
                .attr("height", vport[1]-3)

        if (vis.config.pan_and_zoom) vis.svg.call(zoom);

        vis.defs = vis.svg.append("defs");

        vis.chart = vis.svg.append("g")
            .attr("class", "chart");
        if (vis.transform) {
            vis.chart.attr("transform", "translate("+vis.transform.trans_x+","+vis.transform.trans_y+")scale("+vis.transform.scale+")");    
        }

        vis.resize();

        // render each component
        _.each(this.components, function(comp) {
            comp.render();
            // create cursor handler for each comp
            comp.updateCursor = function() {
                vis.cursorFast(comp, d3.mouse(comp.comp[0][0]));
            }
        });

        // chart indicators containers
        vis.indicators_cont = vis.chart.append("g").attr("class", "indicators");
        _.each(vis.indicators, function(ind_attrs, id) {
            vis.indicators_cont.append("g").attr("id", id);
        });
        
        // ------------------------------------------------------------------------------------------------------------
        // Cursor

        var cursor = vis.chart.append("g")
            .attr("id", "cursor")
            .attr("transform", "translate("+(vis.margin.left+0.5)+",0.5)")
            .style("display","none")

        // vertical cursor
        cursor.append("rect")
            .attr("class", "timebar")
            .attr("x", 0)
            .attr("y", vis.margin.top)
            .attr("width", vis.config.bar_width)
            .attr("height", vis.height-vis.margin.top)
        // horizontal cursor
        cursor.append("line")
            .attr("class", "y-line")
            .attr("x1", -Math.floor(vis.config.bar_padding/2)-0.5)
            .attr("x2", vis.width-Math.floor(vis.config.bar_padding/2)-0.5)
            .attr("y1", 0)
            .attr("y2", 0)
            .attr("stroke-dasharray", "6,3")     

        // cursor labels
        var cursor_ylabel_left = cursor.append("g").attr("class", "y-label left")
        cursor_ylabel_left.append("rect")
            .attr("y", -1)
            .attr("width", vis.margin.left-Math.floor(vis.config.bar_padding/2))
            .attr("height", vis.config.cursor.y_label_height)
        cursor_ylabel_left.append("text")
            .attr("x", vis.margin.left-Math.floor(vis.config.bar_padding/2)-3)
            .attr("y", vis.config.cursor.y_label_height/2+4)      
            .attr("text-anchor", "end")

        var cursor_ylabel_right = cursor.append("g").attr("class", "y-label right")
        cursor_ylabel_right.append("rect")
            .attr("x", 0)
            .attr("y", -1)
            .attr("width", vis.margin.right-Math.floor(vis.config.bar_padding/2)-1)
            .attr("height", vis.config.cursor.y_label_height)
        cursor_ylabel_right.append("text")
            .attr("x", 0)
            .attr("y", vis.config.cursor.y_label_height/2+4)

        var cursor_xlabel = cursor.append("g")
            .attr("class", "x-label")
        var xlabel_text = cursor_xlabel.append("text")
            .attr("class", "cursor_")
            .attr("y", vis.margin.top)
            .attr("text-anchor", "middle")
        var xlabel_rect = cursor_xlabel.insert("rect", "text")
            .attr("class", "title_bg")
            .attr("x", 0)
            .attr("y", 0)
            .attr("width", 0)
            .attr("height", 0)

            
        // ------------------------------------------------------------------------------------------------------------                

        var cursor_ylabel_left = cursor.select("#cursor .y-label.left")
        var cursor_ylabel_right = cursor.select("#cursor .y-label.right")
        var cursor_xlabel = cursor.select("#cursor .x-label")
        var cursor_xlabel_text = cursor_xlabel.select("text")
        var cursor_yline = cursor.select("#cursor .y-line")
        var timebar = cursor.select(".timebar")
        //var factor = vis.config.bar_width+vis.config.bar_padding;

        vis.cursorFast = _.throttle(function(comp, mouse) {
            cursor.attr("transform", "translate("+(vis.margin.left+comp.x+0.5)+",0.5)")
            var bar = Math.floor((mouse[0]+vis.config.bar_padding/2)/vis.x_factor);
            timebar.attr("x", bar*vis.x_factor);
            vis.cursorSlow(comp, mouse);
            cursor.style("display", "block");
            cursor_xlabel.attr("transform", "translate("+(bar*vis.x_factor+(vis.config.bar_width/2))+","+(comp.margin.top+comp.y-10.5)+")");
            cursor_xlabel_text.text(vis.cursorformat(comp.anchor_data[bar].date));
        }, vis.config.cursor.fast_delay);
  
        vis.cursorSlow = _.throttle(function(comp, mouse) {
            vis.selectedComp = comp;
            var cursor_ylabel_text;
            if (comp.y_scale) {
                var val = comp.y_scale.invert(mouse[1]);
                cursor_ylabel_text = comp.y_cursor_label_formatter(val);
            } else { // ind matrix with no scale
                cursor_ylabel_text = "";
            }

            cursor_ylabel_left
                .attr("transform", "translate("+(-vis.margin.left)+","+(comp.y+comp.margin.top+Math.round(mouse[1]-vis.config.cursor.y_label_height/2))+")")
            cursor_ylabel_left.select("text")
                .text(cursor_ylabel_text)
            cursor_ylabel_right
                .attr("transform", "translate("+(comp.width-Math.floor(vis.config.bar_padding/2))+","+(comp.y+comp.margin.top+Math.round(mouse[1]-vis.config.cursor.y_label_height/2))+")")
            cursor_ylabel_right.select("text")
                .text(cursor_ylabel_text)

            cursor_yline
                .attr("y1", Math.floor(comp.y+comp.margin.top+mouse[1]))
                .attr("y2", Math.floor(comp.y+comp.margin.top+mouse[1]))
                .attr("x2", comp.width-Math.floor(vis.config.bar_padding/2)-0.5)

            var bb = xlabel_text.node().getBBox();  
            xlabel_rect
                .attr("x", Math.floor(bb.x-3)+0.5)
                .attr("y", Math.floor(bb.y)+0.5)
                .attr("width", bb.width+6)
                .attr("height", bb.height)            

        }, vis.config.cursor.slow_delay);

        vis.showCursor = function(show) {
            cursor.style("display", show ? "block": "none")    
        }

        vis.rendered = true;

        ////////////////////////////////////////////////////////

        function zoomed() {
          vis.chart.attr("transform", "translate("+d3.event.translate+")scale("+d3.event.scale+")");
        }

    }, 500), // render()

    // renders x labels for components
    render_xlabels: function(comp) {
        var vis = this;

        comp.comp.selectAll("g.x-labels-min").remove();
        comp.comp.selectAll("g.x-labels-maj").remove();

        comp.xlabel_min = comp.comp.append("g").attr("class", "x-labels-min");
        comp.xlabel_maj = comp.comp.append("g").attr("class", "x-labels-maj");

        //this.update_xlabels(comp);
    },

    // updates x labels with new bars
    update_xlabels: function(comp) {
        var vis = this;

        // min_bar transform
        var min_bar = comp.xlabel_min.selectAll(".x-label-min")
          .data(comp.anchor_data, function(d) {return d.date})
            .attr("transform", function(d,i) {
                var x = i*(vis.config.bar_width+vis.config.bar_padding)-Math.floor(vis.config.bar_padding/2);
                var y = comp.height;
                return "translate("+x+","+y+")";    
            });
        // min_bar enter
        var new_min_bar = min_bar.enter().append("g")
            .attr("class", "x-label-min")
            .attr("transform", function(d,i) {
                var x = i*(vis.config.bar_width+vis.config.bar_padding)-Math.floor(vis.config.bar_padding/2);
                var y = comp.height;
                return "translate("+x+","+y+")";    
            })
            .on("click", function(d) {
                this.className += " marked";
            });
        new_min_bar.append("rect")
            .attr("width", function(d) {return vis.config.bar_width+vis.config.bar_padding})
            .attr("height", vis.config.x_label_min_height);
        new_min_bar.append("text")
            .attr("x", 1)
            .attr("y", 0)
            .attr("transform", "rotate(90)")
            .attr("text-anchor", "start")
            .text(function(d) {
                return comp.timeframe.format(d)
            });
        // min_bar exit
        min_bar.exit().remove();
            
        // maj_bar transform
        var maj_bar = comp.xlabel_maj.selectAll(".x-label-maj")
          .data(comp.timegroup, function(d) {return d.key})
            .attr("transform", function(d,i) {
                var x = (d.start-comp.first_index)*(vis.config.bar_width+vis.config.bar_padding)-Math.floor(vis.config.bar_padding/2);
                var y = comp.height+vis.config.x_label_min_height;
                return "translate("+x+","+y+")";
            })
        maj_bar.selectAll("rect")
            .attr("width", function(d) {return (vis.config.bar_width+vis.config.bar_padding)*d.entries.length})
        maj_bar.selectAll("text")
            .text(function(d) {
                return d.entries.length >= 4 ? comp.timeframe.tg_format(d.key) : ""
            });
        // maj_bar enter
        var new_maj_bar = maj_bar.enter().append("g")
            .attr("class", "x-label-maj")   
            .attr("transform", function(d,i) {
                var x = (d.start-comp.first_index)*(vis.config.bar_width+vis.config.bar_padding)-Math.floor(vis.config.bar_padding/2);
                var y = comp.height+vis.config.x_label_min_height;
                return "translate("+x+","+y+")";    
            });
        new_maj_bar.append("rect")
            .attr("width", function(d) {return (vis.config.bar_width+vis.config.bar_padding)*d.entries.length})
            .attr("height", vis.config.x_label_maj_height);
        new_maj_bar.append("text")
            .attr("x", 1)
            .attr("y", vis.config.x_label_maj_height-2.0)
            .attr("text-anchor", "start")
            .text(function(d) {
                // TODO: Make min number of bars variable to barwidth, etc.
                return d.entries.length >= 4 ? comp.timeframe.tg_format(d.key) : ""
            });
        // maj_bar exit
        maj_bar.exit().remove();
              
    },

    // 
    on_comp_anchor_update: function(comp) {

        var current_index = comp.anchor.current_index();
        if (current_index > comp.prev_index) { // if new bar

            var bar = comp.anchor.output_stream.get(0);

            // update anchor data
            if (comp.anchor_data.length == comp.chart.config.maxsize) {
                comp.anchor_data.shift();
                comp.timegroup[0].entries.shift();
                if (_.isEmpty(comp.timegroup[0].entries)) comp.timegroup.shift(); else comp.timegroup[0].start++;
                comp.first_index++;
            } else {
                comp.width = (comp.chart.config.bar_width + comp.chart.config.bar_padding) * Math.min(comp.chart.config.maxsize, current_index+1);
                comp.x = (comp.chart.config.bar_width + comp.chart.config.bar_padding) * (comp.chart.config.maxsize - Math.min(comp.chart.config.maxsize, current_index+1))
            }
            comp.anchor_data.push(bar);

            // Group the major labels by timegroup for timeframe
            var last = _.last(comp.timegroup);
            var newbar = _.clone(bar);
            delete newbar.date;

            var group_date = comp.timeframe.tg_hash(bar);
            if (_.isEmpty(last) || last.key.valueOf() !== group_date.valueOf()) {
                comp.timegroup.push({key: group_date, entries: [newbar], start: _.isEmpty(last) ? comp.first_index : last.start + last.entries.length});
            } else {
                last.entries.push(newbar);
            }

            if (comp.chart.rendered) {
                comp.reposition();
                comp.update();
            }

            comp.prev_index = current_index;
        }
                
    },

    render_ylabels: function(comp) {  
    },

    update_ylabels: function(comp) {        
    },

    // Called when anchor indicator gets new bar and chart.maxsize isn't reached
    update: function() {

        var vis = this;

        if (!vis.rendered) throw new Error("update() method called on chart before it is rendered");

        var size = Math.min(vis.config.maxsize, vis.anchor.current_index()+1);
        vis.width = (vis.config.bar_width + vis.config.bar_padding) * size;

        //vis.svg.attr("width", vis.margin.left + vis.width + vis.margin.right);
        vis.resize();

        // cursor
        vis.svg.select("#cursor .y-line").attr("x2", vis.width-Math.floor(vis.config.bar_padding/2)-0.5);
    },

    destroy: function() {        
        var vis = this;
        
        vis.rendered = false;
        if (vis.chart) vis.chart.remove();
        delete vis.chart;
    }
};

// ----------------------------------------------------------------------------

return Chart;

})

// get viewport dimensions of browser
// http://stackoverflow.com/a/2035211/880891
function get_viewport() {

    var viewPortWidth;
    var viewPortHeight;

    // the more standards compliant browsers (mozilla/netscape/opera/IE7) use window.innerWidth and window.innerHeight
    if (typeof window.innerWidth != 'undefined') {
        viewPortWidth = window.innerWidth,
        viewPortHeight = window.innerHeight
    }

    // removed compatability hacks for older versions of IE (< 7)

    return [viewPortWidth, viewPortHeight];
}