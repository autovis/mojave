'use strict';

define(['lodash', 'async', 'd3', 'eventemitter2', 'config/timesteps', 'dataprovider', 'jsonoc_tools', 'collection_factory', 'uitools', 'charting/plot_component', 'charting/matrix_component', 'charting/panel_component'],
    function(_, async, d3, EventEmitter2, tsconfig, dataprovider, jt, CollectionFactory, uitools, PlotComponent, MatrixComponent, PanelComponent) {

CollectionFactory.set_dataprovider(dataprovider);

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
        y_label_width: 75,
        y_label_height: 15,
        fast_delay: 5,
        slow_delay: 10
    },
    x_label_min_height: 15,
    x_label_maj_height: 11,

    maxsize: 100,
    show_labels: 'right',

    debug: true
};

function Chart(config) {
    if (!(this instanceof Chart)) return Chart.apply(Object.create(Chart.prototype), arguments);

    this.config = _.defaults(config, default_config);
    this.last_index = -1;

    this.dateformat = d3.time.format('%Y-%m-%d %H:%M:%S');
    this.cursorformat = d3.time.format('%a %-m/%-d %H:%M');

    this.container = this.config.container;
    if (!this.container) throw new Error("'container' property must be defined in config");
    this.dpclient = dataprovider.register('chart:' + this.config.setup);
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
            requirejs(['chart_setups/' + vis.config.setup], setup => {
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
                CollectionFactory.create(vis.config.collection, vis.config, (err, collection) => {
                    if (err) return console.error(err);
                    vis.collection = collection;
                    cb();
                });
            } else if (_.isString(vis.setup.collection)) {
                CollectionFactory.create(vis.setup.collection, vis.config, (err, collection) => {
                    if (err) return console.error(err);
                    vis.collection = collection;
                    cb();
                });
            } else if (!vis.setup.collection && !vis.config.collection) {
                return cb(new Error('No collections defined for chart'));
            } else { // assume collection definitions
                return cb(new Error("Unexpected type for 'collection_path' parameter"));
            }
        },

        // set up components and their indicators
        function(cb) {

            // create components AND (create new indicator if defined in chart_config OR reference corresp. existing one in collection)
            // collect all references to indicators defined in chart_config to load new deps
            var newdeps = _.uniq(_.compact(_.flatten(_.map(vis.setup.components, comp_def => {
                return _.flatten(_.map(comp_def.indicators, (val, key) => {
                    if (!_.isObject(val) || !_.isObject(val.def)) return null;
                    return _.map(getnames(val.def), indname => {
                        return _.isString(indname) ? 'indicators/' + indname.replace(':', '/') : null;
                    });
                }));
            }))));
            newdeps = _.concat(newdeps, ['indicators/ui/Selection']); // Include meta-indicators
            requirejs(newdeps, () => { // load dependent indicators first
                vis.components = _.map(vis.setup.components, comp_def => {
                    comp_def.chart = vis;
                    var comp;
                    if (comp_def.type === 'matrix') {
                        comp = new MatrixComponent(comp_def);
                        comp.indicators = _.fromPairs(_.compact(_.map(comp.indicators, _.bind(indicator_builder, vis, _, _, comp.anchor.tstep))));
                    } else if (comp_def.type === 'panel') {
                        comp = new PanelComponent(comp_def);
                    } else {
                        comp = new PlotComponent(comp_def);
                        comp.indicators = _.fromPairs(_.compact(_.map(comp.indicators, _.bind(indicator_builder, vis, _, _, comp.anchor.tstep))));
                    }
                    return comp;
                });
                cb();
            });
        },

        // preload selection data for components
        function(cb) {
            var seldeps = _.uniq(_.flattenDeep(_.map(vis.components, comp => _.map(comp.config.selections, sel => {
                var srcs = _.compact([(sel.anchor || comp.config.anchor), (sel.base || [(sel.anchor || comp.config.anchor), 'bool:True'])].concat(sel.inputs));
                return _.map(srcs, src => _.map(getnames(src), indname => {
                    return _.isString(indname) ? 'indicators/' + indname.replace(':', '/') : null;
                }));
            }))));
            requirejs(seldeps, () => {
                async.each(vis.components, (comp, cb) => {
                    comp.selections = !_.isEmpty(comp.config.selections) ? _.clone(comp.config.selections) : null;
                    async.each(comp.selections, (sel, cb) => {
                        sel.data = [];
                        sel.dataconn = vis.dpclient.connect('get', {
                            source: 'selection/' + sel.id
                        });
                        sel.dataconn.on('data', pkt => {
                            pkt.data.date = tsconfig.defs[sel.tstep].hash(pkt.data);
                            sel.data.push(pkt.data);
                        });
                        sel.dataconn.on('end', () => cb());
                        sel.dataconn.on('error', err => cb(err));
                        sel.anchor = sel.anchor || comp.config.anchor;
                        var anchor_src = vis.collection.resolve_src(sel.anchor);
                        sel.tstep = anchor_src.tstep;
                        // base condition defaults to bool:True if not provided
                        var ind_input_streams = _.map([sel.anchor, (sel.base || [sel.anchor, 'bool:True'])].concat(sel.inputs), inp => vis.collection.resolve_src(inp));
                        var sel_config = _.pick(sel, ['id', 'base', 'color', 'inputs', 'tags']);
                        sel.ind = indicator_builder({def: [ind_input_streams, 'ui:Selection', sel_config]}, "-sel-" + sel.id, comp.anchor.tstep);
                        _.assign(sel.ind[1], {visible: sel.visible});
                    }, cb);
                }, cb);
            });
        },

        // register component's controls with chart
        function(cb) {
            vis.controls = {};
            _.each(vis.components, comp => {
                if (!_.isEmpty(comp.config.controls)) comp.controls = {};
                _.each(comp.config.controls, control_config => {
                    var control;
                    if (!_.isEmpty(control)) return;
                    switch (control_config.type) {
                        case 'radio':
                            control = new uitools.RadioControl(control_config);
                            break;
                        case 'label':
                            control = new uitools.LabelControl(control_config);
                            break;
                        default:
                            throw new Error("Control config must defined a 'type' property");
                    }
                    if (_.has(vis.config.vars, control_config.id) && _.isFunction(control.set)) {
                        control.set(vis.config.vars[control_config.id]);
                    }
                    control.on('change', val => {
                        vis.emit('setvar', control_config.id, val);
                    });
                    comp.controls[control_config.id] = control;
                    comp.chart.controls[control_config.id] = control;
                });
            });
            cb();
        },

        // initialize components and indicators
        function(cb) {
            var comp_y = 0;
            _.each(vis.components, comp => {
                comp.y = comp_y;
                comp.init.apply(comp);
                comp_y += comp.config.margin.top + comp.height + comp.config.margin.bottom;
            });
            cb();
        },

        // set up chart-level indicators
        function(cb) {
            // get references to chart indicators
            var newdeps =  _.uniq(_.compact(_.flatten(_.map(vis.setup.indicators, (val, key) => {
                if (!_.isObject(val) || !_.isObject(val.def)) return null;
                return _.map(getnames(val.def), indname => {
                    return _.isString(indname) ? 'indicators/' + indname.replace(':', '/') : null;
                });
            }), true)));
            requirejs(newdeps, function() { // load dependent indicators first
                vis.indicators = _.fromPairs(_.compact(_.map(vis.setup.indicators, indicator_builder)));
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
                                first_index += 1;
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
                    }); // ind.output_stream.on('update', ...

                });
                cb();
            });
        },

        // start data flow on inputs
        function(cb) {
            vis.collection.start(cb);
        },

    ], callback);

    //////////////////////////////////////////////////////////////////////////////////////////////

    // helper function to grab nested anon indicators from definitions
    function getnames(def) {
        if (_.isString(def)) return [];
        def = _.isObject(def[0]) && !_.isArray(def[0]) ? def.slice(1) : def; // remove options if present
        return _.isArray(def[0]) ? [def[1]].concat(getnames(def[0])) : [def[1]];
    }

    // helper function to create indicator from chart config key:value pair
    function indicator_builder(val, key, tstep) {
        if (_.has(val, 'def') && _.isArray(val.def)) {
            // temp shim code to convert old JSON format for indicators to new JSONOC Ind
            var jsnc_ind = jt.create('$Collection.$Timestep.Ind', val.def);
            jsnc_ind.tstep = tstep;
            jsnc_ind.id = key;
            // create new indicator (will override existing one in collection if same name)
            var newind = vis.collection.create_indicator(jsnc_ind);
            //let first_inp = newind.input_streams[0].root;
            //if (!_.has(first_inp, 'dependents')) first_inp.dependents = [];
            //first_inp.dependents.push(newind);
            //if (first_inp.instrument) newind.output_stream.instrument = first_inp.instrument;
            vis.collection.initialize_indicator(newind);
            //var newind = vis.collection.resolve_src(jsnc_ind);
            return [key, _.extend(val, {_indicator: newind, id: key})];
        } else if (_.get(vis.collection.sources, key)) {
            // reference from collection
            return [key, _.extend(val, {_indicator: _.get(vis.collection.sources, key).indicator, id: key})];
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
        if (m) this.transform = {trans_x: m[1], trans_y: m[2], scale: m[3]};
    }
};

// recomputes dimensions
Chart.prototype.resize = function() {
    var vis = this;

    // Initialize each chart component
    var comp_y = 0;
    _.each(this.components, function(comp) {
        if (!comp.visible) return;
        comp.y = comp_y;
        comp.resize();
        comp_y += comp.config.margin.top + comp.height + comp.config.margin.bottom;
    });

    // Pull-in top/bottom margins from first/last components
    vis.margin.top = _.head(this.components).margin.top;
    vis.margin.bottom = _.last(this.components).margin.bottom;

    vis.width = (vis.setup.bar_width + vis.setup.bar_padding) * vis.setup.maxsize;
    vis.height = comp_y;
};

// responds to UI action to resize a component
Chart.prototype.on_comp_resize = function(comp) {
    var vis = this;

    var comp_y = 0;
    var after = !comp; // if no comp, simply reposition all
    _.each(vis.components, function(comp0) {
        if (!comp0.visible) return;
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

    vis.svg = vis.container.append('svg');

    if (vis.setup.pan_and_zoom) vis.svg.call(zoom);

    vis.defs = vis.svg.append('defs');

    vis.chart = vis.svg.append('g')
        .attr('class', 'chart');
    if (vis.transform) {
        vis.chart.attr('transform', 'translate(' + vis.transform.trans_x + ',' + vis.transform.trans_y + ')scale(' + vis.transform.scale + ')');
    }

    vis.resize();
    vis.svg.attr('width', vis.setup.margin.left + vis.width + vis.setup.margin.right).attr('height', vis.height);

    // render each component
    _.each(this.components, function(comp) {
        if (!comp.visible) return;
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
        .attr('x', 0)
        .attr('y', vis.margin.top)
        .attr('width', vis.setup.bar_width)
        .attr('height', vis.height - vis.margin.top);
    // horizontal cursor
    cursor.append('line')
        .attr('class', 'y-line')
        .attr('x1', -Math.floor(vis.setup.bar_padding / 2) - 0.5)
        .attr('x2', vis.width - Math.floor(vis.setup.bar_padding / 2) - 0.5)
        .attr('y1', 0)
        .attr('y2', 0)
        .attr('stroke-dasharray', '6,3');

    // cursor labels
    var cursor_ylabel_left = null;
    var cursor_ylabel_right = null;
    if (vis.setup.show_labels === 'left' || vis.setup.show_labels === 'both') {
        cursor_ylabel_left = cursor.append('g').attr('class', 'y-label left');
        cursor_ylabel_left.append('rect')
            .attr('y', -1)
            .attr('width', vis.setup.cursor.y_label_width - Math.floor(vis.setup.bar_padding / 2))
            .attr('height', vis.setup.cursor.y_label_height);
        cursor_ylabel_left.append('text')
            .attr('x', vis.setup.cursor.y_label_width - Math.floor(vis.setup.bar_padding / 2) - 3)
            .attr('y', vis.setup.cursor.y_label_height / 2 + 4)
            .attr('text-anchor', 'end');
    }

    if (vis.setup.show_labels === 'right' || vis.setup.show_labels === 'both') {
        cursor_ylabel_right = cursor.append('g').attr('class', 'y-label right');
        cursor_ylabel_right.append('rect')
            .attr('x', 0)
            .attr('y', -1)
            .attr('width', vis.setup.cursor.y_label_width - Math.floor(vis.setup.bar_padding / 2) - 1)
            .attr('height', vis.setup.cursor.y_label_height);
        cursor_ylabel_right.append('text')
            .attr('x', 0)
            .attr('y', vis.setup.cursor.y_label_height / 2 + 4);
    }

    var cursor_xlabel = cursor.append('g')
        .attr('class', 'x-label');
    var xlabel_text = cursor_xlabel.append('text')
        .attr('class', 'cursor_')
        .attr('y', vis.margin.top)
        .attr('text-anchor', 'middle');
    var xlabel_rect = cursor_xlabel.insert('rect', 'text')
        .attr('class', 'title_bg')
        .attr('x', 0)
        .attr('y', 0)
        .attr('width', 0)
        .attr('height', 0);

    // ------------------------------------------------------------------------------------------------------------

    cursor_ylabel_left = cursor.select('#cursor .y-label.left');
    cursor_ylabel_right = cursor.select('#cursor .y-label.right');
    var cursor_xlabel_text = cursor_xlabel.select('text');
    var cursor_yline = cursor.select('#cursor .y-line');
    var timebar = cursor.select('.timebar');

    vis.cursorFast = _.throttle(function(comp, mouse) {
        var bar = Math.floor((mouse[0] + vis.setup.bar_padding / 2) / vis.x_factor);
        if (!comp.anchor_data[bar]) return;
        cursor.attr('transform', 'translate(' + (vis.margin.left + comp.x + 0.5) + ',0.5)');
        timebar.attr('x', bar * vis.x_factor);
        vis.cursorSlow(comp, mouse);
        cursor.style('display', 'block');
        cursor_xlabel.attr('transform', 'translate(' + (bar * vis.x_factor + (vis.setup.bar_width / 2)) + ',' + (comp.margin.top + comp.y - 10.5) + ')');
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
                .attr('transform', 'translate(' + -vis.setup.cursor.y_label_width + ',' + (comp.y + comp.margin.top + Math.round(mouse[1] - vis.setup.cursor.y_label_height / 2)) + ')');
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
            .attr('y1', Math.floor(comp.y + comp.margin.top + mouse[1]))
            .attr('y2', Math.floor(comp.y + comp.margin.top + mouse[1]))
            .attr('x2', comp.width - Math.floor(vis.setup.bar_padding / 2) - 0.5);

        var bb = xlabel_text.node().getBBox();
        xlabel_rect
            .attr('x', Math.floor(bb.x - 3) + 0.5)
            .attr('y', Math.floor(bb.y) + 0.5)
            .attr('width', bb.width + 6)
            .attr('height', bb.height);

    }, vis.setup.cursor.slow_delay);

    vis.showCursor = function(show) {
        cursor.style('display', show ? 'block' : 'none');
    };

    vis.rendered = true;

    ////////////////////////////////////////////////////////

    function zoomed() {
        vis.chart.attr('transform', 'translate(' + d3.event.translate + ')scale(' + d3.event.scale + ')');
    }

}, 500); // render()

// renders x labels for components
Chart.prototype.render_xlabels = function(comp) {

    comp.comp.selectAll('g.x-labels-min').remove();
    comp.comp.selectAll('g.x-labels-maj').remove();

    comp.xlabel_min = comp.comp.append('g').attr('class', 'x-labels-min');
    comp.xlabel_maj = comp.comp.append('g').attr('class', 'x-labels-maj');

    //this.update_xlabels(comp);
};

// updates x labels with new bars
Chart.prototype.update_xlabels = function(comp) {
    var vis = this;

    // min_bar transform
    var min_bar = comp.xlabel_min.selectAll('.x-label-min')
        .data(comp.anchor_data, d => d.date)
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
        .attr('width', vis.setup.bar_width + vis.setup.bar_padding)
        .attr('height', vis.setup.x_label_min_height);
    new_min_bar.append('text')
        .attr('x', 1)
        .attr('y', 0)
        .attr('transform', 'rotate(90)')
        .attr('text-anchor', 'start')
        .text(d => comp.timestep.format(d));
    // min_bar exit
    min_bar.exit().remove();

    // maj_bar transform
    var maj_bar = comp.xlabel_maj.selectAll('.x-label-maj')
        .data(comp.timegroup, d => d.key)
        .attr('transform', function(d) {
            var x = (d.start - comp.first_index) * (vis.setup.bar_width + vis.setup.bar_padding) - Math.floor(vis.setup.bar_padding / 2);
            var y = comp.height + vis.setup.x_label_min_height;
            return 'translate(' + x + ',' + y + ')';
        });
    maj_bar.selectAll('rect')
        .attr('width', d => (vis.setup.bar_width + vis.setup.bar_padding) * d.entries.length);
    maj_bar.selectAll('text')
        .text(d => d.entries.length >= 4 ? comp.timestep.tg_format(d.key) : '');
    // maj_bar enter
    var new_maj_bar = maj_bar.enter().append('g')
        .attr('class', 'x-label-maj')
        .attr('transform', function(d) {
            var x = (d.start - comp.first_index) * (vis.setup.bar_width + vis.setup.bar_padding) - Math.floor(vis.setup.bar_padding / 2);
            var y = comp.height + vis.setup.x_label_min_height;
            return 'translate(' + x + ',' + y + ')';
        });
    new_maj_bar.append('rect')
        .attr('width', d => (vis.setup.bar_width + vis.setup.bar_padding) * d.entries.length)
        .attr('height', vis.setup.x_label_maj_height);
    new_maj_bar.append('text')
        .attr('x', 1)
        .attr('y', vis.setup.x_label_maj_height - 2.0)
        .attr('text-anchor', 'start')
        // TODO: Make min number of bars variable to barwidth, etc.
        .text(d => d.entries.length >= 4 ? comp.timestep.tg_format(d.key) : '');
    // maj_bar exit
    maj_bar.exit().remove();
};

// called when 'update' event is fired on anchor indicator
Chart.prototype.on_comp_anchor_update = function(comp) {

    var current_index = comp.anchor.current_index();
    if (current_index > comp.prev_index) { // if new bar

        var bar = comp.anchor.get(0);

        // update anchor data
        if (comp.anchor_data.length === comp.chart.setup.maxsize) {
            comp.anchor_data.shift();
            comp.timegroup[0].entries.shift();
            if (_.isEmpty(comp.timegroup[0].entries)) comp.timegroup.shift(); else comp.timegroup[0].start += 1;
            comp.first_index += 1;
        } else {
            comp.width = (comp.chart.setup.bar_width + comp.chart.setup.bar_padding) * Math.min(comp.chart.setup.maxsize, current_index + 1);
            comp.x = (comp.chart.setup.bar_width + comp.chart.setup.bar_padding) * (comp.chart.setup.maxsize - Math.min(comp.chart.setup.maxsize, current_index + 1));
        }
        comp.anchor_data.push(bar);

        // Group the major labels by timegroup for timestep
        var last = _.last(comp.timegroup);
        var newbar = _.clone(bar);
        delete newbar.date;

        var group_date = comp.timestep.tg_hash(bar);
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

};

// Called when anchor indicator gets new bar and chart.maxsize isn't reached
Chart.prototype.update = function() {
    var vis = this;

    if (!vis.rendered) throw new Error('update() method called on chart before it is rendered');

    var size = Math.min(vis.setup.maxsize, vis.anchor.current_index() + 1);
    vis.width = (vis.setup.bar_width + vis.setup.bar_padding) * size;

    //vis.svg.attr('width', vis.margin.left + vis.width + vis.margin.right);
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
    _.each(obj, (val, key) => {
        if (_.isArray(val) && val.length > 0) {
            var first = _.head(val);
            if (_.head(first) === '$') {
                switch (first) {
                    case '$switch':
                        var id = val[1];
                        if (!_.isString(id)) throw new Error('2nd parameter of "$switch" must be string, instead: ' + JSON.stringify(id));
                        var control = vis.controls[id];
                        if (!control) throw new Error('Undefined control: ' + id);
                        control.on('change', () => refresh_func.apply(null, [id, control.get()]));
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
    return _.fromPairs(_.map(obj, function(val, key) {
        if (_.isArray(val)) {
            if (val.length > 0) {
                var first = _.head(val);
                if (_.head(first) === '$') {
                    switch (first) {
                        case '$switch':
                            if (!_.isString(val[1])) throw new Error('Second parameter of "$switch" directive must be a string, instead it is: ' + JSON.stringify(val[1]));
                            var control = vis.controls[val[1]];
                            if (!control) throw new Error('Undefined control: ' + val[1]);
                            var control_value = control.get();
                            var ret_value = val[3] || undefined;
                            _.each(!_.isString(val[2]) && val[2], function(val2, cond) {
                                if (control_value === cond) ret_value = val2;
                            });
                            return [key, ret_value];
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
