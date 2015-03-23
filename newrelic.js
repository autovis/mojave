exports.config = {

  app_name : ['mojave'],
  license_key : '',
  host : 'collector.newrelic.com',
  port : 443,
  ssl : true,
  ignore_server_configuration : false,
  agent_enabled : true,
  apdex_t : 0.100,
  capture_params : true,
  ignored_params : [],
  
  logging : {
    level : 'info',
    filepath : 'stdout',
    enabled: true
  },
  
  error_collector : {
    enabled : true,
    ignore_status_codes : [404]
  },
  
  transaction_tracer : {
    enabled : true,
    transaction_threshold : 'apdex_f',
    /**
     * Increase this parameter to increase the diversity of the slow
     * transaction traces recorded by your application over time. Confused?
     * Read on.
     *
     * Transactions are named based on the request (see the README for the
     * details of how requests are mapped to transactions), and top_n refers to
     * the "top n slowest transactions" grouped by these names. The module will
     * only replace a recorded trace with a new trace if the new trace is
     * slower than the previous slowest trace of that name. The default value
     * for this setting is 20, as the transaction trace view page also defaults
     * to showing the 20 slowest transactions.
     *
     * If you want to record the absolute slowest transaction over the last
     * minute, set top_n to 0 or 1. This used to be the default, and has a
     * problem in that it will allow one very slow route to dominate your slow
     * transaction traces.
     *
     * The module will always record at least 5 different slow transactions in
     * the reporting periods after it starts up, and will reset its internal
     * slow trace aggregator if no slow transactions have been recorded for the
     * last 5 harvest cycles, restarting the aggregation process.
     *
     * @env NEW_RELIC_TRACER_TOP_N
     */
    top_n : 20
  },

  debug : {
    internal_metrics : false,
    tracer_tracing : false
  },

  rules : {
    name : [],
    ignore : []
  },
  
  enforce_backstop : true,
  
  browser_monitoring : {

    /**
     * Enable browser monitoring header generation.
     *
     * This does not auto-instrument, rather it enables the agent to generate headers.
     * The newrelic module can generate the appropriate <script> header, but you must
     * inject the header yourself, or use a module that does so.
     *
     * Usage:
     *
     *     var newrelic = require('newrelic');
     *
     *     router.get('/', function (req, res) {
     *       var header = newrelic.getBrowserTimingHeader();
     *       res.write(header)
     *       // write the rest of the page
     *     });
     *
     * This generates the <script>...</script> header necessary for Browser Monitoring
     * This script must be manually injected into your templates, as high as possible
     * in the header, but _after_ any X-UA-COMPATIBLE HTTP-EQUIV meta tags.
     * Otherwise you may hurt IE!
     *
     * This method must be called _during_ a transaction, and must be called every
     * time you want to generate the headers.
     *
     * Do *not* reuse the headers between users, or even between requests.
     *
     * @env NEW_RELIC_BROWSER_MONITOR_ENABLE
     */
    enable : true,

    /**
     * Request un-minified sources from the server.
     *
     * @env NEW_RELIC_BROWSER_MONITOR_DEBUG
     */
    debug : false
  },
  
  transaction_events : {
    enabled: true,
    max_samples_per_minute: 10000,
    max_samples_stored: 20000,
  },

  high_security : false,

  /**
   * Labels
   *
   * An object of label names and values that will be applied to the data sent
   * from this agent. Both label names and label values have a maximum length of
   * 255 characters. This object should contain at most 64 labels.
   */
  labels: {}
}
