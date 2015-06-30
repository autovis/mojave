'use strict';

define(['lodash', 'async', 'd3', 'lokijs', 'indicator_instance', 'config/timeframes'], function(_, async, d3, Loki, IndicatorInstance, timeframes) {

var default_config = {
    dbname: 'chart-data-backing',
    storename: 'default'
};

function ChartDataBacking(config) {
	if (!(this instanceof ChartDataBacking)) return ChartDataBacking.apply(Object.create(ChartDataBacking.prototype), arguments);

    this.config = _.defaults(config, default_config);
    this.input_streams = _.isArray(this.config.inputs) ? this.config.inputs : [this.config.inputs];
    this.last_index = -1;

    this.chart = this.config.chart;
    if (!this.chart) throw new Error("'chart' must be defined in config");

    this.db = new Loki(this.config.dbname);

    this.groups = {};

	return this;
}

ChartDataBacking.prototype = {

	//constructor: ChartDataBacking,

    init: function(callback) {
        if (!_.isFunction(callback)) throw new Error('No (valid) callback given for ChartDataBacking.init()');
        var bak = this;

        bak.winsize = bak.chart.maxsize;

    },

    add_timeframe_group: function(anchor, indicators) {
        var tf = anchor.output_stream.tf;
        if (!tf) throw new Error('Anchor must define a timeframe');
        // check if anchor
        var tfgroup = new TimeframeGroup(this, anchor);
        this.groups[tf] = tfgroup;
    }

};

// --------------------------------------------------------------------------------------

function TimeframeGroup(backing, anchor) {
    this.backing = backing;
    this.anchor = anchor;
    this.indicator_data = {};
    //this.anchor = anchor;
    //this.streams = streams;
    //this.backing = backing;
    //this.store = this.db.addCollection(backing.storename + ':' + anchor.output_stream.tf);

    this.anchor.on('update', function(args) {
        _.each(this.indicator_data, function(indata, id) {
            indata.indicator.output_stream.get(0);
        });
    });
}

TimeframeGroup.prototype.add_indicator = function(id, indicator) {
    if (indicator instanceof IndicatorInstance) throw new Error("TimeframeGroup.add_indicator(): Parameter 'indicator' must be of type IndicatorInstance");
    this.indicator_data[id] = new IndicatorData(indicator);
}

// --------------------------------------------------------------------------------------

function IndicatorData(indicator) {
    this.indicator = indicator;
    this.backing = null;
    this.data = [];
}

IndicatorData.prototype = {

};

/////////////////////////////////////////////////////////////////////////////////////////

return ChartDataBacking;

});