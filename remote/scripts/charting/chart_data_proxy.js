'use strict';

define(['lodash', 'async', 'd3', 'eventemitter2', 'indicator_instance', 'config/timesteps', 'dataprovider', 'collection_factory'], function(_, async, d3, EventEmitter2, IndicatorInstance, tsconfig, dataprovider, CollectionFactory) {

CollectionFactory.set_dataprovider(dataprovider);

const default_config = {
    dbname: 'chart-data-proxy'
    //storename: 'default'
};

function ChartDataProxy(config) {
    if (!(this instanceof ChartDataProxy)) return ChartDataProxy.apply(Object.create(ChartDataProxy.prototype), arguments);

    this.config = _.defaults(config, default_config);
    this.input_streams = _.isArray(this.config.inputs) ? this.config.inputs : [this.config.inputs];
    this.last_index = -1;

    this.chart = this.config.chart;
    if (!this.chart) throw new Error("'chart' must be defined in config");

    this.dpclient = dataprovider.register('chart:' + this.config.setup);

    this.groups = {};

    return this;
}

ChartDataProxy.prototype = {

	//constructor: ChartDataProxy,

    init(callback) {
        if (!_.isFunction(callback)) throw new Error('No (valid) callback given for ChartDataProxy.init()');
        _.each(this.groups, (tgroup, tstep) => {

        });
        this.initialized = true;
    },

    add_timestep_group(anchor, indicators) {
        if (this.initialized) throw new Error('add_timestep_group() method cannot be called after init() is called');
        var tstep = anchor.tstep;
        if (!tstep) throw new Error('Anchor must define a timestep');
        // check if anchor
        if (_.has(this.groups, tstep)) throw new Error('Timestep "' + tstep + '" has already been defined');
        var tfgroup = new TimestepGroup(this, anchor);
        this.groups[tstep] = tfgroup;
    }

};

// --------------------------------------------------------------------------------------

function TimestepGroup(dataproxy, anchor) {
    this.dataproxy = dataproxy;
    this.anchor = anchor;
    this.indicator_data = {};
    //this.anchor = anchor;
    //this.streams = streams;
    //this.dataproxy = dataproxy;
    //this.store = this.db.addCollection(dataproxy.storename + ':' + anchor.tstep);

    this.anchor.on('update', function(args) {
        _.each(this.indicator_data, function(indata, id) {
            indata.indicator.output_stream.get(0);
        });
    });
}

TimestepGroup.prototype.add_indicator = function(id, indicator) {
    if (indicator instanceof IndicatorInstance) throw new Error("TimestepGroup.add_indicator(): Parameter 'indicator' must be of type IndicatorInstance");
    this.indicator_data[id] = new IndicatorData(indicator);
};

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
