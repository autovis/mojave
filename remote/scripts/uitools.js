'use strict';

define(['underscore', 'd3', 'eventemitter2'], function(_, d3, EventEmitter2) {

function Menu (config) {

    var default_config = {
        span: 'vertical',
        margin: {
            top: 20,
            bottom: 100,
            left: 100,
            right: 100
        },
        width: 200,
        height: 25,
        text_yoffset: 18
    };

    this.config = _.extend(default_config, config);
    this.container = this.config.container;
    this.options = _.map(this.config.options, function(d, i) {return _.extend(d, {idx: i})});
}

Menu.prototype = {

    constructor: Menu,

    render: function() {

        var self = this;
        if (self.control) self.control.remove();

        var menu = this.container.append('g')
            .classed(self.config.classed || {menu:true})
            .attr('transform', function(d, i) {return 'translate(' + (Math.floor(self.config.margin.left) + 0.5) + ',' + (Math.floor(self.config.margin.top) + 0.5) + ')'});

        var option = menu.selectAll('g.option')
            .data(this.options)
          .enter().append('g')
            //.classed(function(d) {return {option:true, disabled:d.disabled && true}})
            .classed({option: true, disabled: function(d) {return d.disabled}})
            .attr('transform', function(d, i) {return 'translate(' + (self.config.span !== 'horizontal' ? 0 : i * self.config.width) + ',' + (self.config.span === 'horizontal' ? 0 : i * self.config.height) + ')'})

        option.append('rect')
            .attr('width', this.config.width)
            .attr('height', this.config.height)
            .on('click', function(d, i) {
                if (d.disabled) return false;
                menu.selectAll('g.option.selected').classed({selected: false});
                d3.select(this.parentNode).classed({selected:true});
                _.isFunction(d.action) ? d.action.call(option, d) : null;
            });

        option.append('text')
            .attr('x', 10)
            .attr('y', self.config.text_yoffset)
            .text(function(d) {return d.name})

        self.control = menu;
    }
};

function ColorLegend(config) {

    var default_config = {
        swatch_size: 13,
        intrapadding: 5,
        position: {
            top: 20,
            left: 20
        },
        margin: {
            top: 10,
            bottom: 10,
            left: 10,
            right: 60
        },
        gap: 15,
        extra: []
    };

    this.config = _.extend(default_config, config);
    this.container = this.config.container;

}

ColorLegend.prototype = {

    set_scale: function(scale) {
        if (!scale) throw new Error('Scale is undefined or invalid');
        this.scale = scale;
    },

    render: function() {

        var self = this;
        if (self.control) self.control.remove();

        var data = this.scale.range();

        var height = self.config.margin.top + (data.length * (self.config.swatch_size + self.config.intrapadding)) - self.config.intrapadding + (!_.isEmpty(self.config.extra) ? self.config.gap + self.config.extra.length * (self.config.swatch_size + self.config.intrapadding) : 0) + self.config.margin.bottom;
        var width = self.config.margin.left + self.config.swatch_size + self.config.margin.right;

        var legend = this.container.append('g')
            .classed({'legend': true})
            .attr('transform', function(d, i) {
                var top = self.config.position.top ? self.config.position.top : self.container.attr('height') - height - self.config.position.bottom;
                var left = self.config.position.left ? self.config.position.left : self.container.attr('width') - width - self.config.position.right;
                return 'translate(' + (left + 0.5) + ',' + (top + 0.5) + ')';
            });

        var legend_scale = d3.scale.linear()
            .domain([_.first(this.scale.domain()), _.last(this.scale.domain())])
            .range([(data.length * (self.config.swatch_size + self.config.intrapadding)) - self.config.intrapadding, 0]);

        // bg
        legend.append('rect')
            .attr('width', width)
            .attr('height', height)
            .attr('rx', 6)
            .attr('ry', 6)
            .style('stroke', '#bbb')
            .style('stroke-width', 0.5)
            .style('fill', '#ccc')
            .style('fill-opacity', 0.85)

        var swatch = legend.selectAll('rect.swatch')
            .data(data)
          .enter().append('rect')
            .classed({'swatch': true})
            .attr('x', self.config.margin.left)
            .attr('y', function(d, i) {return self.config.margin.top + (((data.length - 1) - i) * (self.config.swatch_size + self.config.intrapadding))})
            .attr('rx', 2)
            .attr('ry', 2)
            .attr('width', self.config.swatch_size)
            .attr('height', self.config.swatch_size)
            .style('fill', function(d) {return d})
            .style('stroke', '#555')
            .style('stroke-opacity', 0.7)

        var extra = legend.selectAll('rect.extra')
            .data(self.config.extra)
          .enter().append('rect')
            .classed({'swatch': true, 'extra': true})
            .attr('x', self.config.margin.left)
            .attr('y', function(d, i) {return self.config.margin.top + (data.length * (self.config.swatch_size + self.config.intrapadding)) + self.config.gap + (((self.config.extra.length - 1) - i) * (self.config.swatch_size + self.config.intrapadding))})
            .attr('rx', 2)
            .attr('ry', 2)
            .attr('width', self.config.swatch_size)
            .attr('height', self.config.swatch_size)
            .style('fill', function(d) {return d[0]})
            .style('stroke', '#555')
            .style('stroke-opacity', 0.7);

        legend.append('line')
            .attr('x1', self.config.margin.left + self.config.swatch_size + 7)
            .attr('y1', Math.round(self.config.margin.top + (self.config.swatch_size / 2)))
            .attr('x2', self.config.margin.left + self.config.swatch_size + 7)
            .attr('y2', Math.round(self.config.margin.top + (data.length * (self.config.swatch_size + self.config.intrapadding)) - self.config.intrapadding - (self.config.swatch_size / 2)))
            .style('stroke', '#555')
            .style('stroke-opacity', 0.4);

        legend.selectAll('line.tick1')
            .data(data)
          .enter().append('line')
            .classed({tick1: true})
            .attr('x1', self.config.margin.left + self.config.swatch_size + 4)
            .attr('y1', function(d, i) {return Math.round(self.config.margin.top + (((data.length - 1) - i) * (self.config.swatch_size + self.config.intrapadding) + (self.config.swatch_size / 2)))})
            .attr('x2', self.config.margin.left + self.config.swatch_size + 7)
            .attr('y2', function(d, i) {return Math.round(self.config.margin.top + (((data.length - 1) - i) * (self.config.swatch_size + self.config.intrapadding) + (self.config.swatch_size / 2)))})
            .style('stroke', '#555')
            .style('stroke-opacity', 0.4);

        var scale_ticks = legend_scale.ticks(5);

        legend.selectAll('line.tick2')
            .data(scale_ticks)
          .enter().append('line')
            .classed({tick2:true})
            .attr('x1', self.config.margin.left + self.config.swatch_size + 7)
            .attr('y1', function(d, i) {return Math.round(self.config.margin.top + Math.round(legend_scale(d)))})
            .attr('x2', self.config.margin.left + self.config.swatch_size + 10)
            .attr('y2', function(d, i) {return Math.round(self.config.margin.top + Math.round(legend_scale(d)))})
            .style('stroke', '#555')
            .style('stroke-opacity', 0.4)

        legend.selectAll('text.tick2')
            .data(scale_ticks)
          .enter().append('text')
            .classed({tick2: true})
            .attr('x', self.config.margin.left + self.config.swatch_size + 12)
            .attr('y', function(d, i) {return self.config.margin.top + legend_scale(d) + 3})
            .text(function(d) {return self.config.format(d)});

        legend.selectAll('line.tick2.extra')
            .data(self.config.extra)
          .enter().append('line')
            .classed({tick2: true, extra: true})
            .attr('x1', self.config.margin.left + self.config.swatch_size + 5)
            .attr('y1', function(d, i) {return Math.round(self.config.margin.top + (data.length * (self.config.swatch_size + self.config.intrapadding)) + self.config.gap + (((self.config.extra.length - 1) - i) * (self.config.swatch_size + self.config.intrapadding)) + (self.config.swatch_size / 2))})
            .attr('x2', self.config.margin.left + self.config.swatch_size + 8)
            .attr('y2', function(d, i) {return Math.round(self.config.margin.top + (data.length * (self.config.swatch_size + self.config.intrapadding)) + self.config.gap + (((self.config.extra.length - 1) - i) * (self.config.swatch_size + self.config.intrapadding)) + (self.config.swatch_size / 2))})
            .style('stroke', '#555')
            .style('stroke-opacity', 0.4);

        legend.selectAll('text.tick2.extra')
            .data(self.config.extra)
          .enter().append('text')
            .classed({tick2: true, extra: true})
            .attr('x', self.config.margin.left + self.config.swatch_size + 12)
            .attr('y', function(d, i) {return self.config.margin.top + (data.length * (self.config.swatch_size + self.config.intrapadding)) + self.config.gap + (((self.config.extra.length - 1) - i) * (self.config.swatch_size + self.config.intrapadding)) + 8})
            .text(function(d) {return d[1]})

        self.control = legend;

    },

};

function Tooltip(config) {

    var default_config = {
        x: 100,
        y: 100,
        offset: {
            x: 50,
            y: -20
        },
        width: 300,
        height: 300
    };

    this.config = _.extend(default_config, config);
    this.container = this.config.container;
    this.id = config.id || Math.random().toString().replace('0.', 'TOOLTIP-');
    this.template = this.config.template;
    this.record = {};
    this.x = this.config.x;
    this.y = this.config.y;
    this.width = this.config.width;
    this.height = this.config.height;
    this.offset = this.config.offset;
}

Tooltip.prototype = {

    render: function(record) {

        var self = this;
        this.remove();

        var tooltip = this.container.append('g')
            .attr('id', this.id)
            .classed({tooltip: true})
            .attr('transform', function(d, i) {return 'translate(' + (self.x + 0.5) + ',' + (self.y + 0.5) + ')'})
            .style('pointer-events', 'none')

        tooltip.append('rect')
            .attr('x', this.offset.x)
            .attr('y', this.offset.y)
            .attr('width', this.width)
            .attr('height', this.height)
            .attr('stroke', '#555')
            .attr('stroke-width', 1.0)
            .attr('stroke-opacity', 0.5)
            .style('fill', '#fff');

        var svg_switch = tooltip.append('switch');

        svg_switch.append('foreignObject')
            .attr('x', this.offset.x)
            .attr('y', this.offset.y)
            .attr('width', this.width)
            .attr('height', this.height)
          .append('xhtml:body')
            .html(this.template(record))

    },

    remove: function() {
        this.container.select('g#' + this.id).remove();
    }

};

function PinLabel(config) {

    var default_config = {
        target_x: 0,
        target_y: 0,
        side: 'right',
        x_offset: 5,
        y_offset: 0,
        text: '',
        x_pad: 5,
        y_pad: 1,
        size: 10,
        opacity: 1.0
    };

    this.config = _.extend(default_config, config);
    this.container = this.config.container;
}

PinLabel.prototype = {

    constructor: PinLabel,

    render: function() {
        var vis = this;

        var pin_g = vis.container.append('g').classed({pinlabel: true});
        if (vis.config.opacity) pin_g.style('opacity', vis.config.opacity);

        var text = pin_g.append('text')
            .attr('x', vis.config.target_x + (vis.config.x_offset + vis.config.x_pad) * (vis.config.side === 'right' ? 1 : -1))
            .attr('y', vis.config.target_y + vis.config.y_offset)
            .style('text-anchor', vis.config.side === 'right' ? 'start' : 'end')
            .style('fill', get_textcolor(vis.config.color))
            .text(vis.config.text);
        if (vis.config.size) text.style('font-size', vis.config.size);

        var text_bb = text.node().getBBox();

        // reposition text based on its dimensions
        text.attr('x', Math.round(vis.config.target_x + (vis.config.x_offset + vis.config.x_pad) * (vis.config.side === 'right' ? 1 : -1)));
        text.attr('y', Math.round(vis.config.target_y + vis.config.y_offset));
        text_bb = text.node().getBBox();

        // calculate path from text dim
        var pin = pin_g.insert('path', 'text')
            .style('stroke', get_textcolor(vis.config.color))
            .style('fill', vis.config.color || '#555')
            .attr('d', function() {
                var ret = 'M' + vis.config.target_x + ',' + vis.config.target_y + ' ';
                if (vis.config.side === 'right') {
                    ret += 'L' + (text_bb.x - vis.config.x_pad) + ',' + (text_bb.y - vis.config.y_pad) + ' ';
                    ret += 'L' + (text_bb.x + text_bb.width + vis.config.x_pad) + ',' + (text_bb.y - vis.config.y_pad) + ' ';
                    ret += 'L' + (text_bb.x + text_bb.width + vis.config.x_pad) + ',' + (text_bb.y + text_bb.height + vis.config.y_pad) + ' ';
                    ret += 'L' + (text_bb.x - vis.config.x_pad) + ',' + (text_bb.y + text_bb.height + vis.config.y_pad) + ' ';
                } else {
                    ret += 'L' + (text_bb.x + text_bb.width + vis.config.x_pad) + ',' + (text_bb.y + text_bb.height + vis.config.y_pad) + ' ';
                    ret += 'L' + (text_bb.x - vis.config.x_pad) + ',' + (text_bb.y + text_bb.height + vis.config.y_pad) + ' ';
                    ret += 'L' + (text_bb.x - vis.config.x_pad) + ',' + (text_bb.y - vis.config.y_pad) + ' ';
                    ret += 'L' + (text_bb.x + text_bb.width + vis.config.x_pad) + ',' + (text_bb.y - vis.config.y_pad) + ' ';
                }
                ret += 'Z';
                return ret;
            });
    }
};

function Cluster(config) {

    var default_config = {};

    this.config = _.extend(default_config, config);
    this.container = this.config.container;
    this.items = [];
}

Cluster.prototype = {

    constructor: Cluster,

    declutter_vertical: function() {

        function get_bounds(item) {
            if (item instanceof PinLabel) {
                return [item.y, item.y + item.height];
            } else {

            }
        }
    }
};

function Subcluster(config) {
    this.config = config;
    this.cluster = config.cluster;
    this.container = this.cluster.container;
    this.items = _.isArray(config.items) ? config.items : [];
}

// Panel controls

function RadioControl(config) {

    var default_config = {
        position: {
            top: 0,
            left: 0
        },
        margin: {
            top: 0,
            bottom: 0,
            left: 5,
            right: 5
        },
        padding: {
            top: 5,
            right: 10,
            bottom: 5,
            left: 10
        },
        fontsize: 12,
        height: 9,
        width: 40,
        options: []
    };

    this.config = _.extend(default_config, config);
    if (this.config.container) this.container = this.config.container;
    if (_.isEmpty(this.config.options)) throw new Error('No options provided for RadioControl');
    this.options = _.map(this.config.options, function(opt) {
        if (_.isString(opt)) {
            return {value: opt, display: opt};
        } else if (_.isObject(opt)) {
            if (!_.has(opt, 'value')) throw new Error("RadioControl option of type 'object' must contain 'value' property");
            if (!_.has(opt, 'display')) opt.display = opt.value;
            return opt;
        } else {
            throw new Error("Unsupported type '" + (typeof opt) + "' provided as RadioControl option");
        }
    });
    if (this.config.selected) {
        this.selected = _.find(this.options, function(opt) {
            return opt.value === this.config.selected;
        }, this).value;
    } else {
        this.selected = _.first(this.options).value;
    }

}

RadioControl.super_ = EventEmitter2;

RadioControl.prototype = Object.create(EventEmitter2.prototype, {
    constructor: {
        value: RadioControl,
        enumerable: false,
        writable: true,
        configurable: true
    }
});

RadioControl.prototype.render = function() {

    var self = this;
    if (self.control) self.control.remove();

    var radio = this.container.append('g')
        .classed({'radio-control': true})
        .attr('transform', function(d, i) {
            return 'translate(' + (self.config.position.left) + ',' + (self.config.position.top) + ')';
        });

    var xstart = self.config.margin.left;
    _.each(self.options, function(opt, idx) {

        var opt_elem = radio.append('g').classed({option: true, selected: self.selected === opt.value});

        var text = opt_elem.append('text')
            .attr('x', xstart + self.config.padding.left)
            .attr('y', self.config.margin.top + self.config.padding.top)
            .attr('text-anchor', 'start')
            .style('font-size', self.config.fontsize)
            .text(opt.value || 'option:' + idx);

        var bbox = text.node().getBBox();

        var rect = opt_elem.insert('rect', ':first-child')
            .attr('x', xstart)
            .attr('y', self.config.margin.top)
            .attr('height', self.config.padding.top + self.config.height + self.config.padding.bottom)
            .attr('width', self.config.padding.left + bbox.width + self.config.padding.right);

        var click_handler = function() {
            self.set(opt.value);
            self.selected = opt.value;
        };
        text.on('click', click_handler);
        rect.on('click', click_handler);

        xstart += self.config.padding.left + bbox.width + self.config.padding.right;

        opt.elem = opt_elem;
    });

    self.width = xstart - self.config.margin.left;

    // bg
    radio.insert('rect', ':first-child')
        .classed({bg: true})
        .attr('x', self.config.margin.left)
        .attr('y', self.config.margin.top)
        .attr('width', self.width)
        .attr('height', self.config.padding.top + self.config.height + self.config.padding.bottom);

    self.control = radio;

};

RadioControl.prototype.get = function() {
    return this.selected;
};

RadioControl.prototype.set = function(opt_value) {
    var self = this;
    var opt = _.find(self.options, function(opt) {
        return opt_value === opt.value;
    });
    if (opt && opt_value !== self.selected) { // option found and not already selected
        self.selected = opt_value;
        self.control.selectAll('.option').classed({selected: false});
        opt.elem.classed({selected: true});
        self.emit('changed', opt_value);
    }
};

function LabelControl(config) {

    var default_config = {
        position: {
            top: 0,
            left: 0
        },
        margin: {
            top: 5,
            bottom: 0,
            left: 5,
            right: 5
        },
        fontsize: 12,
        height: 9,
        text: 'Label_text'
    };

    this.config = _.extend(default_config, config);
    if (this.config.container) this.container = this.config.container;
}

LabelControl.prototype.render = function() {
    var self = this;

    var xstart = self.config.margin.left;

    var label = this.container.append('g')
        .classed({'label-control': true})
        .attr('transform', function(d, i) {
            return 'translate(' + (self.config.position.left) + ',' + (self.config.position.top) + ')';
        });

    var text = label.append('text')
        .attr('x', xstart)
        .attr('y', self.config.margin.top)
        .attr('text-anchor', 'start')
        .style('font-size', self.config.fontsize)
        .text(self.config.text);

    var bbox = text.node().getBBox();
    self.width = bbox.width;
}

/////////////////////////////////////////////////////////////////////////////////////////

// http://stackoverflow.com/a/2035211/880891
function get_viewport() {

    var viewPortWidth;
    var viewPortHeight;

    // the more standards compliant browsers (mozilla/netscape/opera/IE7) use window.innerWidth and window.innerHeight
    if (typeof window.innerWidth != 'undefined') {
        viewPortWidth = window.innerWidth,
        viewPortHeight = window.innerHeight
    // IE6 in standards compliant mode (i.e. with a valid doctype as the first line in the document)
    } else if (typeof document.documentElement != 'undefined'
        && typeof document.documentElement.clientWidth !==
        'undefined' && document.documentElement.clientWidth !== 0) {
        viewPortWidth = document.documentElement.clientWidth,
        viewPortHeight = document.documentElement.clientHeight;
    // older versions of IE
    } else {
        viewPortWidth = document.getElementsByTagName('body')[0].clientWidth,
        viewPortHeight = document.getElementsByTagName('body')[0].clientHeight
    }
    return [viewPortWidth, viewPortHeight];
}

return {
    Menu: Menu,
    ColorLegend: ColorLegend,
    Tooltip: Tooltip,
    PinLabel: PinLabel,
    Cluster: Cluster,
    RadioControl: RadioControl,
    LabelControl: LabelControl
}

// YIQ formula from http://harthur.github.io/brain/
function get_textcolor(bgColor) {
    var clr = d3.rgb(bgColor);
    var yiq = (clr.r * 299 + clr.g * 587 + clr.b * 114) / 1000;
    return (yiq >= 128) ? 'black' : 'white';
}

});
