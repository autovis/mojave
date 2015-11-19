
var fs = require('fs');

var ctx = {}; // context
ctx.DefVar = function() {this.x = 1; return this};
ctx.Ind = function() {return this};
ctx.UseVar = function() {return this};
ctx.Timestep = function() {return this};
ctx.Input = function() {return this};

var jsonoc_parse = get_jsonoc_parse(ctx);

fs.readFile(__dirname + '/common/collections/test.js', function(err, data) {
    var parsed = jsonoc_parse(data.toString());
    console.dir(parsed);
});

/////////////////////////////////////////////////////////////////////////////////////////

// Modified version of Douglas Crockford's json_parse function:
// https://github.com/douglascrockford/JSON-js/blob/master/json_parse.js

function get_jsonoc_parse(context) {

    "use strict";

    var line = 1;
    var col = 1;
    context = context || {};

    var at,     // The index of the current character
        ch,     // The current character
        escapee = {
            '"': '"',
            '\\': '\\',
            '/': '/',
            b: '\b',
            f: '\f',
            n: '\n',
            r: '\r',
            t: '\t'
        },
        text,

        error = function (m) {

// Call error when something is wrong.

            throw {
                name: 'SyntaxError',
                message: m,
                at: at,
                text: text
            };

        },

        next = function (c) {

// If a c parameter is provided, verify that it matches the current character.

            if (c && c !== ch) {
                error("Expected '" + c + "' instead of '" + ch + "' at " + line + ":" + col);
            }

// Get the next character. When there are no more characters,
// return the empty string.

            ch = text.charAt(at);
            at += 1;
            col += 1;
            return ch;
        },

        newline = function () {
            next('\n');
            line += 1;
            col = 1;
        },

        number = function () {

            var number,
                string = '';

            if (ch === '-') {
                string = '-';
                next('-');
            }
            while (ch >= '0' && ch <= '9') {
                string += ch;
                next();
            }
            if (ch === '.') {
                string += '.';
                while (next() && ch >= '0' && ch <= '9') {
                    string += ch;
                }
            }
            if (ch === 'e' || ch === 'E') {
                string += ch;
                next();
                if (ch === '-' || ch === '+') {
                    string += ch;
                    next();
                }
                while (ch >= '0' && ch <= '9') {
                    string += ch;
                    next();
                }
            }
            number = +string;
            if (!isFinite(number)) {
                error("Bad number at " + line + ":" + col);
            } else {
                return number;
            }
        },

        string = function () {

            var hex,
                i,
                string = '',
                uffff;

            if (ch === '"') {
                while (next()) {
                    if (ch === '"') {
                        next();
                        return string;
                    }
                    if (ch === '\\') {
                        next();
                        if (ch === 'u') {
                            uffff = 0;
                            for (i = 0; i < 4; i += 1) {
                                hex = parseInt(next(), 16);
                                if (!isFinite(hex)) {
                                    break;
                                }
                                uffff = uffff * 16 + hex;
                            }
                            string += String.fromCharCode(uffff);
                        } else if (typeof escapee[ch] === 'string') {
                            string += escapee[ch];
                        } else {
                            break;
                        }
                    } else {
                        string += ch;
                    }
                }
            }
            error("Bad string at " + line + ":" + col);
        },

        white = function () {

            while (ch && ch <= ' ') {
                ch === '\n' ? newline() : next();
            }
            // support comments
            if (ch === '/') {
                next('/');
                if (ch === '*') {
                    next('*');
                    while (ch) {
                        if (ch === '*') {
                            next('*');
                            if (ch === '/') {
                                next('/');
                                break;
                            }
                        } else if (ch === '\n') {
                            newline();
                        } else {
                            next();
                        }
                    }
                } else if (ch === '/') {
                    next('/');
                    while (ch && ch !== '\n') {
                        next();
                    }
                    next('\n');
                } else {
                    error('Unexpected token: "/' + ch + '" at ' + line + ":" + col);
                }
                white();
            }
        },

        value,  // Place holder for the value function.

        params = function () {

            var result = [];
            next('(');
            white();
            if (ch === ')') {
                next(')');
                return [];
            }
            result.push(value());
            white();
            while (ch && ch === ',') {
                next(',');
                white();
                result.push(value());
                white();
            }
            next();

            return result;
        },

        word = function () {

            var path = [];
            var first = true;
            var current = context;
            while (ch) {
                var wordstr = '';
                while (ch >= 'a' && ch <= 'z' || ch >= 'A' && ch <= 'Z' || ch === '$' || ch === '_') {
                    wordstr += ch;
                    next();
                }
                if (first) {
                    // check special keywords
                    if (wordstr === 'true') {
                        return true;
                    } else if (wordstr === 'false') {
                        return false;
                    } else if (wordstr === 'null') {
                        return null;
                    }
                }
                if (current.hasOwnProperty(wordstr)) {
                    current = current[wordstr];
                    path.push(wordstr);
                } else {
                    error('Unrecognized token: "' + wordstr + '" at ' + line + ":" + col);
                }
                white();
                if (ch === '.') {
                    next('.');
                    white();
                } else {
                    break;
                }
                first = false;
            }

            if (ch === '(') {
                if (isFunction(current)) {
                    var args = params();
                    return new current(args);
                } else {
                    error('Object "' + path.join('.') + '" is a constructor at ' + line + ":" + col);
                }
                path.push(params());
            }

            return current;
        },

        objkey = function() {
            if (ch === '"') {
                return string();
            } else if (ch >= 'a' && ch <= 'z' || ch >= 'A' && ch <= 'Z' || ch === '$' || ch === '_') {
                var wordstr = ch;
                next();
                while (ch >= 'a' && ch <= 'z' || ch >= 'A' && ch <= 'Z' || ch === '$' || ch === '_' || ch >= '0' && ch <= '9') {
                    wordstr += ch;
                    next();
                }
                return wordstr;
            } else {
                error('Unexpected character "' + ch + '" for object key at ' + line + ":" + col);
            }
        },

        array = function () {

            var array = [];

            if (ch === '[') {
                next('[');
                white();
                if (ch === ']') {
                    next(']');
                    return array;   // empty array
                }
                while (ch) {
                    array.push(value());
                    white();
                    if (ch === ']') {
                        next(']');
                        return array;
                    }
                    next(',');
                    white();
                }
            }
            error("Bad array at " + line + ":" + col);
        },

        object = function () {

            var key,
                object = {};

            if (ch === '{') {
                next('{');
                white();
                if (ch === '}') {
                    next('}');
                    return object;   // empty object
                }
                while (ch) {
                    key = objkey();
                    white();
                    next(':');
                    if (Object.hasOwnProperty.call(object, key)) {
                        error('Duplicate key "' + key + '" at ' + line + ":" + col);
                    }
                    object[key] = value();
                    white();
                    if (ch === '}') {
                        next('}');
                        return object;
                    }
                    next(',');
                    white();
                }
            }
            error("Bad object");
        };

    value = function () {

// Parse a JSON value. It could be an object, an array, a string, a number,
// or a word.

        white();
        switch (ch) {
        case '{':
            return object();
        case '[':
            return array();
        case '"':
            return string();
        case '-':
            return number();
        default:
            return ch >= '0' && ch <= '9'
                ? number()
                : word();
        }
    };

// Return the json_parse function. It will have access to all of the above
// functions and variables.

    return function (source, reviver) {
        var result;

        text = source;
        at = 0;
        ch = ' ';
        result = value();
        white();
        if (ch) {
            error("Unexpected character '" + ch + "' at " + line + ":" + col);
        }

// If there is a reviver function, we recursively walk the new structure,
// passing each name/value pair to the reviver function for possible
// transformation, starting with a temporary root object that holds the result
// in an empty key. If there is not a reviver function, we simply return the
// result.

        return typeof reviver === 'function'
            ? (function walk(holder, key) {
                var k, v, value = holder[key];
                if (value && typeof value === 'object') {
                    for (k in value) {
                        if (Object.prototype.hasOwnProperty.call(value, k)) {
                            v = walk(value, k);
                            if (v !== undefined) {
                                value[k] = v;
                            } else {
                                delete value[k];
                            }
                        }
                    }
                }
                return reviver.call(holder, key, value);
            }({'': result}, ''))
            : result;
    };

};

// http://stackoverflow.com/questions/5999998/how-can-i-check-if-a-javascript-variable-is-function-type
function isFunction(functionToCheck) {
    var getType = {};
    return functionToCheck && getType.toString.call(functionToCheck) === '[object Function]';
}