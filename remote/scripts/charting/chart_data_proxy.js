'use strict';

define(['lodash', 'async', 'd3', 'eventemitter2', 'indicator_instance', 'config/timesteps', 'dataprovider', 'collection_factory'], function(_, async, d3, EventEmitter2, IndicatorInstance, tsconfig, dataprovider, CollectionFactory) {

CollectionFactory.set_dataprovider(dataprovider);

const default_config = {
    dbname: 'chart-data-proxy'
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

    // ----------------------------------------------------------------------------------

    var request = indexedDB.open(config.dbname, 1);

    request.onupgradeneeded = event => {
        let db = event.target.result;

        let objStore = db.createObjectStore();
    };

    request.onsuccess = event => {
        this.db = event.target.result;
    };

    request.onerror = event => {
        throw new Error(`Error accessing IndexedDB db: ${config.dbname}`);
    };

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
    },

    timestep(tstep) {
        return this.groups[tstep];
    },

    clear_db() {

    }

};

// --------------------------------------------------------------------------------------

function TimestepGroup(dataproxy, config) {
    this.dataproxy = dataproxy;
    this.config = _.assign({}, this.dataproxy.config, config);
    if (!config.anchor) throw new Error('No anchor provided');
    this.anchor = config.anchor;
    if (!config.collection) throw new Error('No collection provided');
    this.collection = config.collection;
    this.sources = new Map();

    this.anchor.on('update', args => {
        _.each(this.sources, (src, id) => {
            src.get(0);
        });
    });

    return this;
}

TimestepGroup.prototype = {

    add_source(id, src) {
        let stream = this.collection.resolve_src(src);
        this.sources.set(id, stream);
    },

    iterate_all(data_cb, finished_cb) {
        let cursor = this.store.openCursor();
        cursor.onsuccess = event => {
            let cursor = event.target.result;
            if (cursor) {
                data_cb(cursor.value);
                cursor.continue();
            } else {
                finished_cb();
            }
        };
        cursor.onerror = event => {
            finished_cb(event.target.errorCode);
        };
    },

    iterate_by_index(start_idx, end_idx, data_cb, finished_db) {

    },

    iterate_by_date(start_date, end_date, data_cb, finished_db) {

    }

};

/////////////////////////////////////////////////////////////////////////////////////////

return ChartDataProxy;

});
