'use strict';

define(['lodash'], function(_) {

    var accounts = {
        'default': {
            brokers: {
                'oanda': {
                    account_id: '@@OANDA_ACCOUNT_ID@@',
                    access_token: '@@OANDA_ACCESS_TOKEN@@'
                }
            }
        }
    };

    /////////////////////////////////////////////////////////////////////////////////////

    function get_value(deepval) {
        var path = deepval.split('.');
        var value = _.reduce(path, function(val, memo) {
            if (!_.has(val, memo)) throw Error("Value '" + deepval + "' not defined in accounts.js");
            return val[memo];
        }, accounts);
        var envmatch = value.match(/^@@(.*)@@$/);
        if (envmatch) {
            var env_var = envmatch[1].toUpperCase();
            if (_.has(process.env, env_var)) {
                return process.env[env_var];
            } else {
                throw Error("accounts.js: path '" + deepval + "' references an environment variable that does not exist");
            }
        } else {
            return value;
        }
    }

    return {
        get_value: get_value
    };

});
