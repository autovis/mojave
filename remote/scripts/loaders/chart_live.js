'use strict';

var chart;
var spinner;
var kb_listener;

requirejs(['lodash', 'async', 'jquery', 'jquery-ui', 'd3', 'Keypress', 'moment-timezone', 'spin', 'hash', 'stream', 'config/instruments', 'charting/chart'], function(_, async, $, jqueryUI, d3, keypress, moment, Spinner, hash, Stream, instruments, Chart) {

    const BARWIDTH_INC = 3;

    var config = {
        barwidth_inc: 3,
        scroll_inc: 100,
        instruments: ['eurusd', 'gbpusd', 'audusd', 'usdcad', 'usdjpy'],
        chart_setups: ['basic_mtf_strategy_chart', 'geom_chart', '2016-04_chart', '2016-06_BB_chart', 'test_chart', 'basic_chart', 'basic_strategy_chart'],
        debug: false
    };
    config.current_instrument = _.first(config.instruments);
    config.current_setup = _.first(config.chart_setups);
    config.current_date = moment(); // today
    // get previous weekday if today is weekend
    if ([0, 6].includes(config.current_date.day())) config.current_date = get_previous_trading_day(config.current_date);

    requirejs(['jquery-ui-layout-min'], () => {
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

    // apply theme
    var theme = localStorage.getItem('theme') || 'light';
    var ss = d3.select('#theme-ss');
    if (theme === 'dark') {
        ss.attr('href', '/css/chart-default-dark.css');
    } else {
        ss.attr('href', '/css/chart-default.css');
    }

    // set up nav pane
    var nav_table = $('<table>').css('width', '100%');
    var nav_left = $('<td>').addClass('nav').attr('id', 'nav-left').css('width', '33%').css('text-align', 'left');
    var nav_center = $('<td>').addClass('nav').attr('id', 'nav-center').css('width', '33%').css('text-align', 'center');
    var nav_right = $('<td>').addClass('nav').attr('id', 'nav-right').css('width', '33%').css('text-align', 'right');
    nav_table.append($('<tbody>').append($('<tr>').append(nav_left).append(nav_center).append(nav_right)));
    // nav controls
    var vars = hash.get();
    var instr_sel = $('<select>');
    _.each(config.instruments, instr => {
        if (!_.has(instruments, instr)) throw new Error('Unrecognized instrument: ' + instr);
        var opt = $('<option>').attr('value', instr).text(instruments[instr].name);
        if (instr === vars.instrument) {
            opt.attr('selected', 'selected');
            config.current_instrument = instr;
        }
        instr_sel.append(opt);
    });
    nav_left.append(instr_sel);

    var chart_sel = $('<select>');
    _.each(config.chart_setups, setup => {
        //if (!_.has(instruments, instr)) throw new Error('Unrecognized instrument: ' + instr);
        var opt = $('<option>').attr('value', setup).text(setup);
        if (setup === vars.setup) {
            opt.attr('selected', 'selected');
            config.current_setup = setup;
        }
        chart_sel.append(opt);
    });
    nav_left.append(chart_sel);

    // Date input calendar
    var date_input = $('<input>').attr('type', 'date').css('font-size', '16px').css('text-align', 'center');
    var datestr = config.current_date.format('YYYY-MM-DD');
    date_input.attr('max', config.current_date.format('YYYY-MM-DD'));
    date_input.val(datestr);
    nav_right.append(date_input);

    $('#head').append(nav_table);

    // nav control events
    instr_sel.on('change', () => {
        config.current_instrument = instr_sel.val();
        hash.add({instrument: instr_sel.val()});
        render_chart();
    });
    chart_sel.on('change', () => {
        config.current_setup = chart_sel.val();
        hash.add({setup: chart_sel.val()});
        render_chart();
    });
    date_input.on('change', () => {
        var cal_date = moment(date_input.val());
        var cal_date_str = cal_date.format('YYYY-MM-DD');
        // get previous weekday if weekend is chosen
        cal_date = get_previous_trading_day(cal_date);
        var params = hash.get();
        params.date = cal_date_str;
        window.open('/chart#' + _.map(params, (v, k) => k + '=' + encodeURIComponent(v)).join('&'));
        date_input.val(config.current_date.format('YYYY-MM-DD'));

    });

    // initialize spinner
    spinner = new Spinner({
        lines: 24, // The number of lines to draw
        length: 20, // The length of each line
        width: 5, // The line thickness
        radius: 50, // The radius of the inner circle
        scale: 1, // Scales overall size of the spinner
        corners: 0.3, // Corner roundness (0..1)
        color: theme === 'dark' ? '#ffe' : '#000', // #rgb or #rrggbb or array of colors
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

    render_chart(function(err) {
        if (err) throw err;

        // ---------------------------------
        // final post-render initialization:

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
                localStorage.setItem('theme', 'dark');
            } else {
                ss.attr('href', '/css/chart-default.css');
                localStorage.setItem('theme', 'light');
            }
            chart.render();
        });
        kb_listener.simple_combo('a', () => { // scroll left
            var cont = $('#chart');
            cont.scrollLeft(Math.max(cont.scrollLeft() - config.scroll_inc, 0));
        });
        kb_listener.simple_combo('d', () => { // scroll right
            var cont = $('#chart');
            cont.scrollLeft(Math.min(cont.scrollLeft() + config.scroll_inc, chart.width));
        });

        // scroll to far right
        $('#chart').scrollLeft(chart.width);

    });

    /////////////////////////////////////////////////////////////////////////////////////

    function reset_chart() {
        if (chart && chart.chart) {
            // clear any dialogs
            var evt = new MouseEvent('click');
            chart.chart.node().dispatchEvent(evt);
        }
    }

    function render_chart(callback) {

        if (_.isUndefined(callback)) callback = () => null;

        reset_chart();
        if (chart && chart.chart) chart.chart.style('opacity', '0.5');
        spinner.spin(document.getElementById('chart'));

        try {
            var chart_options = {
                source: 'oanda',
                instrument: config.current_instrument,
                vars: {}, // this should be optional
                //range: [config.current_date.format('YYYY-MM-DD') + ' 01:00', config.current_date.format('YYYY-MM-DD') + ' 15:00'],
                count: {
                    'm1.input': 300
                    //'m5.input': 30
                },

                /*
                range: {
                    'H1.input': [
                        get_previous_trading_day(config.current_date).format('YYYY-MM-DD') + ' 00:00',
                        config.current_date.format('YYYY-MM-DD') + ' 01:00'
                    ],
                    'm1.input': [
                        config.current_date.format('YYYY-MM-DD') + ' 01:00',
                        config.current_date.format('YYYY-MM-DD HH:mm')
                    ]

                },
                */

                setup: config.current_setup,
                container: d3.select('#chart'),
                subscribe: true,
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
                if (err) console.error(err);

                chart.render();
                chart.kb_listener = kb_listener;

                spinner.stop();
                callback();
            });
        } catch (e) {
            spinner.stop();
            console.error(e);
            return;
        }
    }

    function get_previous_trading_day(date) {
        var currday = date.clone();
        do { // find previous weekday
            currday.subtract(1, 'days');
        } while ([0, 6].includes(currday.day()));
        return currday;
    }

});
