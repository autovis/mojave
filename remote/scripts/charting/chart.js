'use strict';

define(['lodash', 'async', 'd3', 'eventemitter2', 'config/timeframes', 'collection_factory', 'charting/chart_data_backing', 'charting/plot_component', 'charting/matrix_component', 'charting/panel_component'],
    function(_, async, d3, EventEmitter2, timeframes, CollectionFactory, ChartDataBacking, IndicatorPlot, IndicatorMatrix, Panel) {

var default_config = {
};

var default_setup = {
    margin: {
        left: 5,
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

    maxsize: 100,
    show_labels: 'right'
};

function Chart(config) {
	if (!(this instanceof Chart)) return Chart.apply(Object.create(Chart.prototype), arguments);

    this.config = _.defaults(config, default_config);
    this.input_streams = _.isArray(this.config.inputs) ? this.config.inputs : [this.config.inputs];
    this.last_index = -1;

    this.dateformat = d3.time.format('%Y-%m-%d %H:%M:%S');
    this.cursorformat = d3.time.format('%a %-m/%-d %H:%M');

    this.container = this.config.container;
    if (!this.container) throw new Error("'container' property must be defined in config");
    this.rendered = false;

	return this;
}

Chart.super_ = EventEmitter2;

Chart.prototype = Object.create(EventEmitter2.prototype, {
    constructor: {
        value: Chart,
        enumerable: false,
        writable: true,
        configurable: true
    }
});

// To be called after data and components are defined and before render()
Chart.prototype.init = function(callback) {
    if (!_.isFunction(callback)) throw new Error('No (valid) callback given for Chart.init()');

    var vis = this;

    async.series([

        // load chart setup, define default values
        function(cb) {
            requirejs(['chart_setups/' + vis.config.setup], function(setup) {
                vis.setup = _.defaults(setup, default_setup); // apply defaults
                vis.margin = vis.setup.margin;
                vis.anchor_data = [];
                vis.timegroup = [];
                cb();
            });
        },

        // load collection
        function(cb) {

            if (CollectionFactory.is_collection(vis.config.collection)) {
                vis.collection = vis.config.collection.clone();
                delete vis.config.collection; // remove original reference to collection
                cb();
            } else if (_.isString(vis.config.collection)) {
                CollectionFactory.create(vis.config.collection, vis.input_streams, vis.config, function(err, collection) {
                    if (err) return console(err);
                    vis.collection = collection;
                    cb();
                });
            } else if (_.isString(vis.setup.collection)) {
                CollectionFactory.create(vis.setup.collection, vis.input_streams, vis.config, function(err, collection) {
                    if (err) return console(err);
                    vis.collection = collection;
                    cb();
                });
            } else if (!vis.setup.collection && !vis.config.collection) {
                return cb(new Error('No collections defined for chart'));
            } else { // assume collection definitions
                return cb(new Error("Unexpected type for 'collection_path' parameter"));
            }
        },

        // set up data backing
        function(cb) {
            vis.backing = new ChartDataBacking({
                chart: vis,
                collection: vis.collection
            });
            cb();
        },

        // set up anchor, components and indicators
        function(cb) {

            // anchor indicator to drive time intervals across chart
            if (_.isString(vis.setup.anchor)) {
                var ind = vis.collection.indicators[vis.setup.anchor];
                if (!ind) return cb(new Error("Unrecognized indicator '" + vis.setup.anchor + "' for chart anchor"));
                vis.anchor = ind;
            } else {
                throw new Error('Invalid or undefined chart anchor');
            }
            if (!vis.anchor.output_stream.subtype_of('dated')) return cb(new Error("Anchor indicator's output type must be subtype of 'dated'"));
            if (!vis.anchor.output_stream.tf) return cb(new Error('Chart anchor must define a timeframe'));
            vis.timeframe = timeframes.defs[vis.anchor.output_stream.tf];
            if (!vis.timeframe) return cb(new Error('Unrecognized timeframe defined in chart anchor: ' + vis.anchor.output_stream.tf));

            // create components AND (create new indicator if defined in chart_config OR reference corresp. existing one in collection)
            // collect all references to indicators defined in chart_config to load new deps
            var newdeps = _.unique(_.compact(_.flatten(_.map(vis.setup.components, function(comp_def) {
                return _.flatten(_.map(comp_def.indicators, function(val, key) {
                    if (!_.isObject(val) || !_.isObject(val.def)) return null;
                    return _.map(getnames(val.def), function(indname) {
                        return _.isString(indname) ? 'indicators/' + indname.replace(':', '/') : null;
                    });
                }));
            }))));
            requirejs(newdeps, function() { // load dependent indicators first
                vis.components = _.map(vis.setup.components, function(comp_def) {
                    comp_def.chart = vis;
                    var comp;
                    if (comp_def.type === 'matrix') {
                        comp = new IndicatorMatrix(comp_def);
                        comp.indicators = _.object(_.compact(_.map(comp.indicators, indicator_builder)));
                    } else if (comp_def.type === 'panel') {
                        comp = new Panel(comp_def);
                    } else {
                        comp = new IndicatorPlot(comp_def);
                        comp.indicators = _.object(_.compact(_.map(comp.indicators, indicator_builder)));
                    }
                    return comp;
                });
                cb();
            });
        },

        // initialize components
        function(cb) {
            var comp_y = 0;
            vis.controls = {};
            _.each(vis.components, function(comp) {
                comp.y = comp_y;
                comp.init.apply(comp);
                comp_y += comp.config.margin.top + comp.height + comp.config.margin.bottom;
            });
            cb();
        },

        // set up chart-level indicators
        function(cb) {
            // get references to chart indicators
            var newdeps =  _.unique(_.compact(_.flatten(_.map(vis.setup.indicators, function(val, key) {
                if (!_.isObject(val) || !_.isObject(val.def)) return null;
                return _.map(getnames(val.def), function(indname) {
                    return _.isString(indname) ? 'indicators/' + indname.replace(':', '/') : null;
                });
            }), true)));
            requirejs(newdeps, function() { // load dependent indicators first
                vis.indicators = _.object(_.compact(_.map(vis.setup.indicators, indicator_builder)));
                _.each(vis.indicators, function(ind_attrs, id) {
                    var ind = ind_attrs._indicator;

                    ind.vis_init(vis, ind_attrs);

                    // initialize visual data array
                    ind_attrs.data = [];
                    var first_index = 0; // for converting absolute stream indexes to data index
                    var prev_index = -1; // tracks when new bars are added

                    // define indicator update event handler
                    ind.output_stream.on('update', function(args) {

                        // update visual data array, insert new bar if applicable
                        var current_index = ind.output_stream.current_index();
                        if (current_index > prev_index) { // if new bar
                            if (ind_attrs.data.length === vis.setup.maxsize) {
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
                            var cont = vis.indicators_cont.select('#' + id);

                            if (current_index > prev_index) { // if new bar
                                ind.vis_render(vis, ind_attrs, cont);
                            } else {
                                ind.vis_update(vis, ind_attrs, cont);
                            }
                            delete vis.data;
                        }
                    }); // ind.output_stream.on("update", ...

                });
                cb();
            });
        },

        // initialize schema and add update listener
        function(cb) {
            var anchor_indicators = [];
            var comp_indicators = [];
            var chart_indicators = [];

            vis.schema = {};

            cb();
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
        if (_.has(val, 'def') && _.isArray(val.def)) {
            // create new indicator (will override existing one in collection if same name)
            var newind = vis.collection.create_indicator(val.def);
            return [key, _.extend(val, {_indicator:newind, id:key})];
        } else if (_.has(indicators, key)) {
            // reference from collection
            return [key, _.extend(val, {_indicator:indicators[key], id:key})];
        } else {
            // TODO: Generate warning instead of throwing error
            throw new Error('Indicator not found in collection and not defined in chart_config: ' + key);
        }
    }

};

// saves chart transformation that was set by zoom behavior; to be reapplied after chart is re-rendered
Chart.prototype.save_transform = function() {
    if (this.chart && this.chart.attr('transform')) {
        var trans = this.chart.attr('transform');
        var m = trans.match(/^translate\(([\.0-9]+),([\.0-9]+)\)scale\(([\.0-9]+)\)/);
        //vis.transform = m ? {trans_x: m[1], trans_y: m[2], scale: m[3]} : {trans_x: 0.0, trans_y: 0.0, scale: 0.0};
        if (m) this.transform = {trans_x: m[1], trans_y: m[2], scale: m[3]};
    }
};

// recomputes dimensions
Chart.prototype.resize = function() {
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

    vis.width = (vis.setup.bar_width + vis.setup.bar_padding) * Math.min(vis.setup.maxsize, vis.anchor.current_index() + 1);
    vis.height = comp_y;
};

// responds to UI action to resize a component
Chart.prototype.on_comp_resize = function(comp) {
    var vis = this;

    var comp_y = 0;
    var after = false;
    _.each(vis.components, function(comp0) {
        comp0.y = comp_y;
        if (comp0 === comp) {
            after = true;
            comp0.destroy();
            comp0.render();
        } else if (after) {
            comp0.reposition();
        }
        comp_y += comp0.config.margin.top + comp0.height + comp0.config.margin.bottom;
    });
    vis.height = comp_y;
    vis.svg.attr('width', vis.setup.margin.left + vis.width + vis.setup.margin.right).attr('height', vis.height);
    d3.select('#cursor rect').attr('height', vis.height - vis.margin.top);
};

// clears and renders chart
Chart.prototype.render = _.throttle(function() {
    var vis = this;

    vis.x_factor = vis.setup.bar_width + vis.setup.bar_padding;

    vis.container.selectAll('svg').remove();

    var zoom = d3.behavior.zoom()
        .scaleExtent([0.3, 4])
        .on('zoom', zoomed);

    //var vport = get_viewport();
    var contbox = vis.container.node().getBoundingClientRect();
    vis.svg = vis.container.append('svg') // top-most svg element
        //.attr('width', vport[0] - 3)
        //.attr('height', vport[1] - 3);
        .attr('width', contbox.width)
        .attr('height', contbox.height);

    if (vis.setup.pan_and_zoom) vis.svg.call(zoom);

    vis.defs = vis.svg.append('defs');

    vis.chart = vis.svg.append('g')
        .attr('class', 'chart');
    if (vis.transform) {
        vis.chart.attr('transform', 'translate(' + vis.transform.trans_x + ',' + vis.transform.trans_y + ')scale(' + vis.transform.scale + ')');
    }

    vis.resize();

    // render each component
    _.each(this.components, function(comp) {
        comp.render();
        // create cursor handler for each comp
        comp.updateCursor = function() {
            vis.cursorFast(comp, d3.mouse(comp.comp[0][0]));
        };
    });

    // chart indicators containers
    vis.indicators_cont = vis.chart.append('g').attr('class', 'indicators');
    _.each(vis.indicators, function(ind_attrs, id) {
        vis.indicators_cont.append('g').attr('id', id);
    });

    // ------------------------------------------------------------------------------------------------------------
    // Cursor

    var cursor = vis.chart.append('g')
        .attr('id', 'cursor')
        .attr('transform', 'translate(' + (vis.margin.left + 0.5) + ',0.5)')
        .style('display', 'none');

    // vertical cursor
    cursor.append('rect')
        .attr('class', 'timebar')
        .attr("x", 0)
        .attr("y", vis.margin.top)
        .attr("width", vis.setup.bar_width)
        .attr("height", vis.height-vis.margin.top);
    // horizontal cursor
    cursor.append("line")
        .attr("class", "y-line")
        .attr("x1", -Math.floor(vis.setup.bar_padding/2)-0.5)
        .attr("x2", vis.width-Math.floor(vis.setup.bar_padding/2)-0.5)
        .attr("y1", 0)
        .attr("y2", 0)
        .attr("stroke-dasharray", "6,3");

    // cursor labels
    var cursor_ylabel_left = null;
    var cursor_ylabel_right = null;
    if (vis.setup.show_labels === 'left' || vis.setup.show_labels === 'both') {
        var cursor_ylabel_left = cursor.append('g').attr('class', 'y-label left');
        cursor_ylabel_left.append('rect')
            .attr('y', -1)
            .attr('width', vis.margin.left - Math.floor(vis.setup.bar_padding / 2))
            .attr('height', vis.setup.cursor.y_label_height);
        cursor_ylabel_left.append('text')
            .attr('x', vis.margin.left - Math.floor(vis.setup.bar_padding / 2) - 3)
            .attr('y', vis.setup.cursor.y_label_height / 2 + 4)
            .attr('text-anchor', 'end');
    }

    if (vis.setup.show_labels === 'right' || vis.setup.show_labels === 'both') {
        var cursor_ylabel_right = cursor.append('g').attr('class', 'y-label right');
        cursor_ylabel_right.append('rect')
            .attr('x', 0)
            .attr('y', -1)
            .attr('width', vis.margin.right - Math.floor(vis.setup.bar_padding / 2) - 1)
            .attr('height', vis.setup.cursor.y_label_height);
        cursor_ylabel_right.append('text')
            .attr('x', 0)
            .attr('y', vis.setup.cursor.y_label_height / 2 + 4);
    }

    var cursor_xlabel = cursor.append("g")
        .attr("class", "x-label");
    var xlabel_text = cursor_xlabel.append("text")
        .attr("class", "cursor_")
        .attr("y", vis.margin.top)
        .attr("text-anchor", "middle");
    var xlabel_rect = cursor_xlabel.insert("rect", "text")
        .attr("class", "title_bg")
        .attr("x", 0)
        .attr("y", 0)
        .attr("width", 0)
        .attr("height", 0);

    // ------------------------------------------------------------------------------------------------------------

    var cursor_ylabel_left = cursor.select("#cursor .y-label.left");
    var cursor_ylabel_right = cursor.select("#cursor .y-label.right");
    var cursor_xlabel = cursor.select("#cursor .x-label");
    var cursor_xlabel_text = cursor_xlabel.select("text");
    var cursor_yline = cursor.select("#cursor .y-line");
    var timebar = cursor.select(".timebar");
    //var factor = vis.setup.bar_width + vis.setup.bar_padding;

    vis.cursorFast = _.throttle(function(comp, mouse) {
        cursor.attr("transform", "translate("+(vis.margin.left+comp.x+0.5)+",0.5)");
        var bar = Math.floor((mouse[0]+vis.setup.bar_padding/2)/vis.x_factor);
        timebar.attr("x", bar*vis.x_factor);
        vis.cursorSlow(comp, mouse);
        cursor.style("display", "block");
        cursor_xlabel.attr("transform", "translate("+(bar*vis.x_factor+(vis.setup.bar_width/2))+","+(comp.margin.top+comp.y-10.5)+")");
        cursor_xlabel_text.text(vis.cursorformat(comp.anchor_data[bar].date));
    }, vis.setup.cursor.fast_delay);

    vis.cursorSlow = _.throttle(function(comp, mouse) {
        vis.selectedComp = comp;
        var cursor_ylabel_text;
        if (comp.y_scale) {
            var val = comp.y_scale.invert(mouse[1]);
            cursor_ylabel_text = comp.y_cursor_label_formatter(val);
        } else { // ind matrix with no scale
            cursor_ylabel_text = '';
        }

        if (cursor_ylabel_left) {
            cursor_ylabel_left
                .attr('transform', 'translate(' + -vis.margin.left + ',' + (comp.y + comp.margin.top + Math.round(mouse[1] - vis.setup.cursor.y_label_height / 2)) + ')');
            cursor_ylabel_left.select('text')
                .text(cursor_ylabel_text);
        }
        if (cursor_ylabel_right) {
            cursor_ylabel_right
                .attr('transform', 'translate(' + (comp.width - Math.floor(vis.setup.bar_padding / 2)) + ',' + (comp.y + comp.margin.top + Math.round(mouse[1] - vis.setup.cursor.y_label_height / 2)) + ')');
            cursor_ylabel_right.select('text')
                .text(cursor_ylabel_text);
        }

        cursor_yline
            .attr("y1", Math.floor(comp.y+comp.margin.top+mouse[1]))
            .attr("y2", Math.floor(comp.y+comp.margin.top+mouse[1]))
            .attr("x2", comp.width-Math.floor(vis.setup.bar_padding/2)-0.5);

        var bb = xlabel_text.node().getBBox();
        xlabel_rect
            .attr("x", Math.floor(bb.x-3)+0.5)
            .attr("y", Math.floor(bb.y)+0.5)
            .attr("width", bb.width+6)
            .attr("height", bb.height);

    }, vis.setup.cursor.slow_delay);

    vis.showCursor = function(show) {
        cursor.style("display", show ? "block": "none");
    };

    vis.rendered = true;

    ////////////////////////////////////////////////////////

    function zoomed() {
        vis.chart.attr("transform", "translate("+d3.event.translate+")scale("+d3.event.scale+")");
    }

}, 500); // render()

// renders x labels for components
Chart.prototype.render_xlabels = function(comp) {
    var vis = this;

    comp.comp.selectAll("g.x-labels-min").remove();
    comp.comp.selectAll("g.x-labels-maj").remove();

    comp.xlabel_min = comp.comp.append("g").attr("class", "x-labels-min");
    comp.xlabel_maj = comp.comp.append("g").attr("class", "x-labels-maj");

    //this.update_xlabels(comp);
};

// updates x labels with new bars
Chart.prototype.update_xlabels = function(comp) {
    var vis = this;

    // min_bar transform
    var min_bar = comp.xlabel_min.selectAll('.x-label-min')
        .data(comp.anchor_data, function(d) {return d.date})
        .attr('transform', function(d, i) {
            var x = i * (vis.setup.bar_width + vis.setup.bar_padding) - Math.floor(vis.setup.bar_padding / 2);
            var y = comp.height;
            return 'translate(' + x + ',' + y + ')';
        });
    // min_bar enter
    var new_min_bar = min_bar.enter().append('g')
        .attr('class', 'x-label-min')
        .attr('transform', function(d, i) {
            var x = i * (vis.setup.bar_width + vis.setup.bar_padding) - Math.floor(vis.setup.bar_padding / 2);
            var y = comp.height;
            return 'translate(' + x + ',' + y + ')';
        })
        .on('click', function() {
            this.className += ' marked';
        });
    new_min_bar.append('rect')
        .attr('width', function() {return vis.setup.bar_width + vis.setup.bar_padding})
        .attr('height', vis.setup.x_label_min_height);
    new_min_bar.append('text')
        .attr('x', 1)
        .attr('y', 0)
        .attr('transform', 'rotate(90)')
        .attr('text-anchor', 'start')
        .text(function(d) {
            return comp.timeframe.format(d);
        });
    // min_bar exit
    min_bar.exit().remove();

    // maj_bar transform
    var maj_bar = comp.xlabel_maj.selectAll('.x-label-maj')
        .data(comp.timegroup, function(d) {return d.key})
        .attr('transform', function(d) {
            var x = (d.start - comp.first_index) * (vis.setup.bar_width + vis.setup.bar_padding) - Math.floor(vis.setup.bar_padding / 2);
            var y = comp.height + vis.setup.x_label_min_height;
            return 'translate(' + x + ',' + y + ')';
        });
    maj_bar.selectAll('rect')
        .attr('width', function(d) {return (vis.setup.bar_width + vis.setup.bar_padding) * d.entries.length});
    maj_bar.selectAll('text')
        .text(function(d) {
            return d.entries.length >= 4 ? comp.timeframe.tg_format(d.key) : '';
        });
    // maj_bar enter
    var new_maj_bar = maj_bar.enter().append('g')
        .attr('class', 'x-label-maj')
        .attr('transform', function(d) {
            var x = (d.start - comp.first_index) * (vis.setup.bar_width + vis.setup.bar_padding) - Math.floor(vis.setup.bar_padding / 2);
            var y = comp.height + vis.setup.x_label_min_height;
            return 'translate(' + x + ',' + y + ')';
        });
    new_maj_bar.append('rect')
        .attr('width', function(d) {return (vis.setup.bar_width + vis.setup.bar_padding) * d.entries.length})
        .attr('height', vis.setup.x_label_maj_height);
    new_maj_bar.append('text')
        .attr('x', 1)
        .attr('y', vis.setup.x_label_maj_height - 2.0)
        .attr('text-anchor', 'start')
        .text(function(d) {
            // TODO: Make min number of bars variable to barwidth, etc.
            return d.entries.length >= 4 ? comp.timeframe.tg_format(d.key) : '';
        });
    // maj_bar exit
    maj_bar.exit().remove();
};

// called when 'update' event is fired on anchor indicator
Chart.prototype.on_comp_anchor_update = function(comp) {

    var current_index = comp.anchor.current_index();
    if (current_index > comp.prev_index) { // if new bar

        var bar = comp.anchor.output_stream.get(0);

        // update anchor data
        if (comp.anchor_data.length == comp.chart.setup.maxsize) {
            comp.anchor_data.shift();
            comp.timegroup[0].entries.shift();
            if (_.isEmpty(comp.timegroup[0].entries)) comp.timegroup.shift(); else comp.timegroup[0].start++;
            comp.first_index++;
        } else {
            comp.width = (comp.chart.setup.bar_width + comp.chart.setup.bar_padding) * Math.min(comp.chart.setup.maxsize, current_index + 1);
            comp.x = (comp.chart.setup.bar_width + comp.chart.setup.bar_padding) * (comp.chart.setup.maxsize - Math.min(comp.chart.setup.maxsize, current_index+1));
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

Chart.prototype.render_ylabels = function(comp) {
};

Chart.prototype.update_ylabels = function(comp) {
};

// Called when anchor indicator gets new bar and chart.maxsize isn't reached
Chart.prototype.update = function() {
    var vis = this;

    if (!vis.rendered) throw new Error('update() method called on chart before it is rendered');

    var size = Math.min(vis.setup.maxsize, vis.anchor.current_index() + 1);
    vis.width = (vis.setup.bar_width + vis.setup.bar_padding) * size;

    //vis.svg.attr("width", vis.margin.left + vis.width + vis.margin.right);
    vis.resize();

    // cursor
    vis.svg.select('#cursor .y-line').attr('x2', vis.width - Math.floor(vis.setup.bar_padding / 2) - 0.5);
};

Chart.prototype.destroy = function() {
    var vis = this;

    vis.rendered = false;
    if (vis.chart) vis.chart.remove();
    delete vis.chart;
};

// Register any control-based directives to execute 'refresh_func' when control is changed
Chart.prototype.register_directives = function(obj, refresh_func) {
    var vis = this;
    _.each(obj, function(val, key) {
        if (_.isArray(val) && val.length > 0) {
            var first = _.first(val);
            if (_.first(first) === '$') {
                switch (first) {
                    case '$switch':
                        if (!_.isString(val[1])) throw new Error("Second parameter of '$switch' directive must be a string, instead it is: " + JSON.stringify(val[1]));
                        var control = vis.controls[val[1]];
                        if (!control) throw new Error('Undefined control: ' + val[1]);
                        if (control instanceof EventEmitter2) control.on('changed', refresh_func);
                        break;
                    default:
                        throw new Error('Unrecognized directive: ' + first);
                }
            }
        }
    });
};

// Recursively evaluates any directives defined in an object
Chart.prototype.eval_directives = function(obj) {
    var vis = this;
    return _.object(_.map(obj, function(val, key) {
        if (_.isArray(val)) {
            if (val.length > 0) {
                var first = _.first(val);
                if (_.first(first) === '$') {
                    switch (first) {
                        case '$switch':
                            if (!_.isString(val[1])) throw new Error("Second parameter of '$switch' directive must be a string, instead it is: " + JSON.stringify(val[1]));
                            var control = vis.controls[val[1]];
                            if (!control) throw new Error('Undefined control: ' + val[1]);
                            var control_value = control.get();
                            var ret_value = val[3] || undefined;
                            _.each(!_.isString(val[2]) && val[2], function(val2, cond) {
                                if (control_value === cond) ret_value = val2;
                            });
                            return [key, ret_value];
                            break;
                        default:
                            throw new Error('Unrecognized directive: ' + first);
                    }
                } else {
                    return [key, val];
                }
            } else {
                return [key, []];
            }
        } else {
            return [key, val];
        }
    }));
};

// ----------------------------------------------------------------------------

return Chart;

});

// get viewport dimensions of browser
// http://stackoverflow.com/a/2035211/880891
function get_viewport() {

    var viewPortWidth;
    var viewPortHeight;

    // the more standards compliant browsers (mozilla/netscape/opera/IE7) use window.innerWidth and window.innerHeight
    if (typeof window.innerWidth != 'undefined') {
        viewPortWidth = window.innerWidth;
        viewPortHeight = window.innerHeight;
    }

    // removed compatability hacks for older versions of IE (< 7)

    return [viewPortWidth, viewPortHeight];
}
