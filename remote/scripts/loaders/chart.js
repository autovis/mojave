'use strict';

var chart;
var spinner;
var kb_listener;

requirejs(['lodash', 'async', 'jquery', 'jquery-ui', 'd3', 'Keypress', 'moment-timezone', 'spin', 'hash', 'stream', 'config/instruments', 'charting/chart'], function(_, async, $, jqueryUI, d3, keypress, moment, Spinner, hash, Stream, instruments, Chart) {

    const BARWIDTH_INC = 3;

    var config = {
        barwidth_inc: 3,
        instruments: ['eurusd', 'gbpusd', 'audusd', 'usdcad', 'usdjpy'],
        chart_setups: ['2016-04_chart', 'basic_chart'],
        debug: false
    };
    config.current_instrument = _.first(config.instruments);
    config.current_setup = _.first(config.chart_setups);
    config.current_date = moment(); // today
    // get previous weekday if today is weekend
    while (_.includes([0, 6], config.current_date.day())) {
        config.current_date.subtract(1, 'days');
    }

    requirejs(['jquery-ui-layout-min'], function() {
        $('body').layout({
            defaults: {
                closable: true,
                resizable: true,
                slideable: true
            },
            north: {
                closable: true,
                resizable: false,
                slidable: false,
                size: 50
            }
        });
    });

    // Set up nav pane
    var nav_table = $('<table>').css('width', '100%');
    var nav_left = $('<td>').addClass('nav').attr('id', 'nav-left').css('width', '33%').css('text-align', 'left');
    var nav_center = $('<td>').addClass('nav').attr('id', 'nav-center').css('width', '33%').css('text-align', 'center');
    var nav_right = $('<td>').addClass('nav').attr('id', 'nav-right').css('width', '33%').css('text-align', 'right');
    nav_table.append($('<tbody>').append($('<tr>').append(nav_left).append(nav_center).append(nav_right)));

    var instr_sel = $('<select>');
    _.each(config.instruments, instr => {
        if (!_.has(instruments, instr)) throw new Error('Unrecognized instrument: ' + instr);
        var opt = $('<option>').attr('value', instr).text(instruments[instr].name);
        instr_sel.append(opt);
    });
    nav_left.append(instr_sel);

    var chart_sel = $('<select>');
    _.each(config.chart_setups, setup => {
        //if (!_.has(instruments, instr)) throw new Error('Unrecognized instrument: ' + instr);
        var opt = $('<option>').attr('value', setup).text(setup);
        chart_sel.append(opt);
    });
    nav_left.append(chart_sel);

    var prev = $('<button>').css('font-weight', 'bold').text("<< PREV");
    nav_center.append(prev);

    var date_input = $('<input>').attr('type', 'date').css('font-size', '16px').css('text-align', 'center');
    date_input.val(config.current_date.format('YYYY-MM-DD'));
    date_input.attr('max', config.current_date.format('YYYY-MM-DD'));
    nav_center.append(date_input);

    var next = $('<button>').css('font-weight', 'bold').text("NEXT >>");
    nav_center.append(next);
    $('#head').append(nav_table);
    next.attr('disabled', 'true');

    // nav control events
    instr_sel.on('change', () => {
        config.current_instrument = instr_sel.val();
        render_chart();
    });
    chart_sel.on('change', () => {
        config.current_setup = chart_sel.val();
        render_chart();
    });
    date_input.on('change', () => {
        config.current_date = moment(date_input.val());
        // get previous weekday if weekend is chosen
        while (_.includes([0, 6], config.current_date.day())) {
            config.current_date.subtract(1, 'days');
            date_input.val(config.current_date.format('YYYY-MM-DD'));
        }
        render_chart();
    });
    prev.on('click', () => {
        do { // find previous weekday
            config.current_date.subtract(1, 'days');
        } while (_.includes([0, 6], config.current_date.day()));
        date_input.val(config.current_date.format('YYYY-MM-DD'));
        next.attr('disabled', null);
        render_chart();
    });
    next.on('click', () => {
        do { // find next weekday
            config.current_date.add(1, 'days');
        } while (_.includes([0, 6], config.current_date.day()));
        // test if next weekday is after current day, if so disable "next" button
        var nextnext = config.current_date.clone();
        do {
            nextnext.add(1, 'days');
        } while (_.includes([0, 6], nextnext.day()));
        if (nextnext.isAfter(moment().subtract(1, 'days'), 'day')) next.attr('disabled', 'true');
        //
        date_input.val(config.current_date.format('YYYY-MM-DD'));
        render_chart();
    });

    // initialize spinner
    spinner = new Spinner({
        lines: 24, // The number of lines to draw
        length: 20, // The length of each line
        width: 5, // The line thickness
        radius: 50, // The radius of the inner circle
        scale: 1, // Scales overall size of the spinner
        corners: 0.3, // Corner roundness (0..1)
        color: '#000', // #rgb or #rrggbb or array of colors
        opacity: 0.1, // Opacity of the lines
        rotate: 0, // The rotation offset
        direction: 1, // 1: clockwise, -1: counterclockwise
        speed: 0.7, // Rounds per second
        trail: 43, // Afterglow percentage
        fps: 20, // Frames per second when using setTimeout() as a fallback for CSS
        zIndex: 2e9, // The z-index (defaults to 2000000000)
        className: 'spinner', // The CSS class to assign to the spinner
        top: '33%', // Top position relative to parent
        left: '50%', // Left position relative to parent
        shadow: false, // Whether to render a shadow
        hwaccel: false, // Whether to use hardware acceleration
        position: 'absolute' // Element positioning
    });

    render_chart();

    // set up keyboard listeners
    kb_listener = new keypress.Listener();

    kb_listener.simple_combo(']', () => {
        if (!chart) return;
        if (chart.setup.bar_width >= 50) return;
        chart.setup.bar_width =  Math.floor(chart.setup.bar_width / BARWIDTH_INC) * BARWIDTH_INC + BARWIDTH_INC;
        chart.setup.bar_padding = Math.ceil(Math.log(chart.setup.bar_width) / Math.log(2));
        chart.resize();
        chart.save_transform();
        chart.render();
    });
    kb_listener.simple_combo('[', () => {
        if (!chart) return;
        if (chart.setup.bar_width <= BARWIDTH_INC) return;
        chart.setup.bar_width =  Math.floor(chart.setup.bar_width / BARWIDTH_INC) * BARWIDTH_INC - BARWIDTH_INC;
        chart.setup.bar_padding = Math.ceil(Math.log(chart.setup.bar_width) / Math.log(2));
        chart.resize();
        chart.save_transform();
        chart.render();
    });
    kb_listener.simple_combo('.', () => {
        if (!chart) return;
        chart.selectedComp.height = Math.min(chart.selectedComp.height + 20, 2000);
        if (chart.selectedComp.y_scale) chart.selectedComp.y_scale.range([chart.selectedComp.height, 0]);
        chart.on_comp_resize(chart.selectedComp);
    });
    kb_listener.simple_combo(',', () => {
        if (!chart) return;
        chart.selectedComp.height = Math.max(chart.selectedComp.height - 20, 20);
        if (chart.selectedComp.y_scale) chart.selectedComp.y_scale.range([chart.selectedComp.height, 0]);
        chart.on_comp_resize(chart.selectedComp);
    });
    kb_listener.simple_combo('/', () => {
        if (!chart) return;
        var comp = _.find(chart.components, comp => comp.config.y_scale && comp.config.y_scale.price && comp.config.anchor !== 'tick');
        var domain = comp.y_scale.domain();
        comp.height = (domain[1] - domain[0]) / instruments[config.current_instrument].unit_size * 10.25;
        comp.height = Math.max(Math.min(Math.round(comp.height), 900), 150);
        if (comp.y_scale) comp.y_scale.range([comp.height, 0]);
        chart.on_comp_resize(comp);
    });
    kb_listener.simple_combo('q', () => {
        if (!chart) return;
        var ss = d3.select('#theme-ss');
        if (ss.attr('href') === '/css/chart-default.css') {
            ss.attr('href', '/css/chart-default-dark.css');
        } else {
            ss.attr('href', '/css/chart-default.css');
        }
        chart.render();
    });

    /////////////////////////////////////////////////////////////////////////////////////

    function reset_chart() {
        if (chart && chart.chart) {
            // clear any dialogs
            var evt = new MouseEvent('click');
            chart.chart.node().dispatchEvent(evt);
        }
    }

    function render_chart() {

        reset_chart();
        if (chart && chart.chart) chart.chart.style('opacity', '0.5');
        spinner.spin(document.getElementById('chart'));

        try {
            var chart_options = {
                source: 'oanda',
                instrument: config.current_instrument,
                timeframe: 'm5',
                range: [config.current_date.format('YYYY-MM-DD') + ' 01:00', config.current_date.format('YYYY-MM-DD') + ' 11:00'],
                vars: {
                    ltf: 'm5',
                    htf: 'H1'
                },
                setup: config.current_setup,
                container: d3.select('#chart'),
                subscribe: false,
                debug: config.debug
            };

            // Initialize dates using current timezone
            if (_.isArray(chart_options.range)) {
                chart_options.range = _.map(chart_options.range, date => moment.tz(date, moment.tz.guess()));
            }
            _.assign(chart_options.vars, hash.get()); // apply hash vars
            chart = new Chart(chart_options);
            chart.on('setvar', (key, val) => {
                var obj = {};
                obj[key] = val;
                hash.add(obj);
            });
            chart.init(err => {
                if (err) throw err;

                // remove any tick-based components
                chart.components = _.filter(chart.components, comp => comp.config.anchor !== 'tick');
                // force geometry
                chart.setup.bar_width = 8;
                chart.setup.bar_padding = 2;

                chart.render();
                chart.kb_listener = kb_listener;

                spinner.stop();
            });
        } catch (e) {
            spinner.stop();
            console.error(e);
            return;
        }
    }

});
