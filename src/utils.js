var graphRegex = /^T\.(gt|gte|eq|neq|lte|lt|decr|incr|notin|in)$|^Contains\.(IN|NOT_IN)$|^g\.|^Vertex(\.class)$|^Edge(\.class)$/;
var closureRegex = /^\{.*\}$/;

var toString = Object.prototype.toString;

function isString(o) {
    return toString.call(o) === '[object String]';
}
function isObject(o) {
        return toString.call(o) === '[object Object]';
}
function isArray(o) {
        return toString.call(o) === '[object Array]';
}

module.exports = {

    supplant: function (s, o) {
        return s.replace(/<([^<>]*)>/g,
            function (a, b) {
                var r;
                if(b in o) {
                    r = o[b];    
                    if(isObject(r)){
                        return JSON.stringify(r);
                    } else if(isArray(r)){
                        return r.join(',');
                    } else if(isString(r) || isNumber(r)){
                        return r;
                    }
                }
                return a;
            }
        );
    },

    /* TODO: check if this is needed */
    isRegexId: function (id) {
        return !!this.OPTS.idRegex && isString(id) && this.OPTS.idRegex.test(id);
    },

    isGraphReference: function (val) {
        return isString(val) && graphRegex.test(val);
    },

    isObject: isObject,

    isClosure: function (val) {
        return isString(val) && closureRegex.test(val);
    },

    isArray: isArray
};
