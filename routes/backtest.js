var express = require('express');
var router = express.Router();

router.get('/', function(req, res) {
    res.render('backtest', {title: 'Backtesting'});
});

module.exports = router;
