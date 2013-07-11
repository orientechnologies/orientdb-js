;(function (definition) {

    // RequireJS
    if (typeof define === 'function' && define.amd) {
        define([], function () {
            var exports = {};
            definition(exports);
            return exports;
        });
    // CommonJS
    } else if (typeof exports === 'object') {
        definition(exports);
    }

})(function (exports){
    "use strict"

    var q = require('q');
    var http = require('http');

    var toString = Object.prototype.toString,
        push = Array.prototype.push;

    //default options
    var OPTS = {
        'host': 'localhost',
        'port': 2480,
        'graph': 'tinkergraph',
        'idRegex': /^[0-9]+:[0-9]+$///,
        //'user': 'root',
        //'password': 'EB478DB41FB3498FB96E6BDACA51C54DE20B281ED985B0DC03D5434D48BE28D1'
    };


    var _pathBase = '/command/';
    var _urlPath = '/gremlin';

    var graphRegex = /^T\.(gt|gte|eq|neq|lte|lt)$|^g\.|^Vertex(?=\.class\b)|^Edge(?=\.class\b)/;
    var closureRegex = /^\{.*\}$/;

    function Orient(qryString) {
        if(!!qryString){
            this.params = qryString;
        } else {
            this.params = 'g';    
        };

    }

    exports.setOptions= _setOptions();
    exports._ = _qryMain('_', true);
    exports.E = _qryMain('E', true); 
    exports.V =  _qryMain('V', true); 
   
    //Methods
    exports.e = _qryMain('e', true); 
    exports.idx = _qryMain('idx', true); 
    exports.v = _qryMain('v', true); 

    exports.sql = _qrySql(true);
    
    //Indexing
    exports.createIndex = _qryMain('createIndex');
    exports.createKeyIndex = _qryMain('createKeyIndex');
    exports.getIndices =  _qryMain('getIndices');
    exports.getIndexedKeys =  _qryMain('getIndexedKeys');
    exports.getIndex =  _qryMain('getIndex');
    exports.dropIndex = _qryMain('dropIndex');
    exports.dropKeyIndex = _qryMain('dropKeyIndex');

    exports.clear =  _qryMain('clear');
    exports.shutdown =  _qryMain('shutdown');
    exports.getFeatures = _qryMain('getFeatures');

    function _setOptions (){
        return function (options){
            if(!!options){
                for (var k in options){
                    if(options.hasOwnProperty(k)){
                        OPTS[k] = options[k];
                    }
                }
            }
        }
    }

    function _isIdString(id) {
        return !!OPTS.idRegex && _isString(id) && OPTS.idRegex.test(id);
    }

    function _isString(o) {
        return toString.call(o) === '[object String]';
    }

    function _isGraphReference (val) {
        return _isString(val) && graphRegex.test(val);
    }

    function _isObject(o) {
        return toString.call(o) === '[object Object]';
    }

    function _isClosure(val) {
        return _isString(val) && closureRegex.test(val);   
    }

    function _isArray(o) {
        return toString.call(o) === '[object Array]';
    }

    function _isUndefined(o) {
        return toString.call(o) === '[object Undefined]';
    }

    // function _isNan(o) {
    //     return o !== o;
    // }

    function _parseArgs(val) {
        //check to see if the arg is referencing the graph ie. g.v(1)
        if(_isObject(val) && val.hasOwnProperty('params') && _isGraphReference(val.params)){
            return val.params.toString();
        }
        if(_isGraphReference(val)) {
            return val.toString();
        }
        //Cater for ids that are not numbers but pass parseFloat test
        if(_isIdString(val) || isNaN(parseFloat(val))) {
            return "'" + val + "'";
        }
        if(!isNaN(parseFloat(val))) {
             return val.toString();    
        }
        return val;
    }

    function _qryMain(method, reset){
        return function(){
            var gremlin,
                args = _isArray(arguments[0]) ? arguments[0] : arguments,
                appendArg = '';

            gremlin = reset ? new Orient() : new Orient(this.params);
                     
            //cater for idx param 2
            if(method == 'idx' && args.length > 1){
                for (var k in args[1]){
                    appendArg = k + ":";
                    appendArg += _parseArgs(args[1][k])
                }
                appendArg = "[["+ appendArg + "]]";
                args.length = 1;
            }
            gremlin.params += '.' + method + _args(args);
            gremlin.params += appendArg;

            _urlPath = '/gremlin';
            return gremlin;
        }
    }

    //[i] => index & [1..2] => range
    //Do not pass in method name, just string arg
    function _qryIndex(){
        return function(arg) {
            var gremlin = new Orient(this.params);
            gremlin.params += '['+ arg.toString() + ']';
            return gremlin;
        }
    }

    //and | or | put  => g.v(1).outE().or(g._().has('id', 'T.eq', 9), g._().has('weight', 'T.lt', '0.6f'))
    function _qryPipes(method){
        return function() {
            var gremlin = new Orient(this.params),
                args = [],
                isArray = _isArray(arguments[0]),
                argsLen = isArray ? arguments[0].length : arguments.length;

            gremlin.params += "." + method + "("
            for (var _i = 0; _i < argsLen; _i++) {
                gremlin.params += isArray ? arguments[0][_i].params || _parseArgs(arguments[0][_i]) : arguments[_i].params || _parseArgs(arguments[_i]);
                gremlin.params += ",";
            }
            gremlin.params = gremlin.params.slice(0, -1);
            gremlin.params += ")";
            return gremlin;
        }
    }

    //retain & except => g.V().retain([g.v(1), g.v(2), g.v(3)])
    function _qryCollection(method){
        return function() {
            var gremlin = new Orient(this.params),
                args = [];

            gremlin.params += "." + method + "(["
            for (var _i = 0, argsLen = arguments[0].length; _i < argsLen; _i++) {
                gremlin.params += arguments[0][_i].params;
                gremlin.params += ",";
            }
            gremlin.params = gremlin.params.slice(0, -1);
            gremlin.params += "])";
            return gremlin;
        }
    }

    function _qrySql(reset){
        return function(){
            var gremlin,
                args = arguments[0];

            gremlin = reset ? new Orient() : new Orient(this.params);

            gremlin.params = args;
            _urlPath = '/sql';
            return gremlin;
        }
    }

    function _args(array) {
        var argList = '',
            append = '',
            jsonString = '';
            
        for (var _i = 0, l = array.length; _i < l; _i++) {
            if(_isClosure(array[_i])){
                append += array[_i];
            } else if (_isObject(array[_i]) && !(array[_i].hasOwnProperty('params') && _isGraphReference(array[_i].params))) {
                jsonString = JSON.stringify(array[_i]);
                jsonString = jsonString.replace('{', '[');
                argList += jsonString.replace('}', ']') + ",";
            } else {
                argList += _parseArgs(array[_i]) + ",";
            }
        }
        argList = argList.slice(0, -1);
        return '(' + argList + ')' + append;
    }
    
    Orient.prototype = {
        
        /*** Transform ***/
        both: _qryMain('both'),
        bothE: _qryMain('bothE'),
        bothV: _qryMain('bothV'),
        cap: _qryMain('cap'),
        gather: _qryMain('gather'),
        id: _qryMain('id'),
        'in': _qryMain('in'),
        inE: _qryMain('inE'),
        inV: _qryMain('inV'),
        property: _qryMain('property'),
        label: _qryMain('label'),
        map: _qryMain('map'),
        memoize: _qryMain('memoize'),
        order: _qryMain('order'),
        out: _qryMain('out'),
        outE: _qryMain('outE'),
        outV: _qryMain('outV'),
        path: _qryMain('path'),
        scatter: _qryMain('scatter'),
        select: _qryMain('select'),
        transform: _qryMain('transform'),
        
        /*** Filter ***/
        index: _qryIndex(), //index(i)
        range: _qryIndex(), //range('[i..j]')
        and:  _qryPipes('and'),
        back:  _qryMain('back'),
        dedup: _qryMain('dedup'),
        except: _qryCollection('except'),
        filter: _qryMain('filter'),
        has: _qryMain('has'),
        hasNot: _qryMain('hasNot'),
        interval: _qryMain('interval'),
        or: _qryPipes('or'),
        random: _qryMain('random'),
        retain: _qryCollection('retain'),
        simplePath: _qryMain('simplePath'),
        
        /*** Side Effect ***/ 
        // aggregate //Not implemented
        as: _qryMain('as'),
        groupBy: _qryMain('groupBy'),
        groupCount: _qryMain('groupCount'), //Not Fully Implemented ??
        optional: _qryMain('optional'),
        sideEffect: _qryMain('sideEffect'),

        linkBoth: _qryMain('linkBoth'),
        linkIn: _qryMain('linkIn'),
        linkOut: _qryMain('linkOut'),
        // store //Not implemented
        // table //Not implemented
        // tree //Not implemented

        /*** Branch ***/
        copySplit: _qryPipes('copySplit'),
        exhaustMerge: _qryMain('exhaustMerge'),
        fairMerge: _qryMain('fairMerge'),
        ifThenElse: _qryMain('ifThenElse'), //g.v(1).out().ifThenElse('{it.name=='josh'}','{it.age}','{it.name}')
        loop: _qryMain('loop'),

        /*** Methods ***/
        //fill //Not implemented
        count: _qryMain('count'),
        iterate: _qryMain('iterate'),
        next: _qryMain('next'),
        toList: _qryMain('toList'),
        put: _qryPipes('put'),

        getPropertyKeys: _qryMain('getPropertyKeys'),
        setProperty: _qryMain('setProperty'),
        getProperty: _qryMain('getProperty'),

        /*** http ***/
        then: post()
    }


    function base_auth(user, password) {
      var tok = user + ':' + password;
      var hash = new Buffer(tok).toString('base64');
      return "Basic " + hash;
    }

    function post () {
        return function(success, error) {
            var baseUrl = _pathBase + OPTS.graph,
                data = this.params,           
                auth = base_auth(OPTS.user, OPTS.password),
                headers = {'Authorization': auth};
            return postData(baseUrl + _urlPath, data, headers).then(success, error);
        } 
    }


    function postData(urlPath, data, headers){
        var deferred = q.defer();
        var payload = data || '{}';
        var body = '';
        
        var options = {
            'host': OPTS.host,
            'port': OPTS.port,
            'path': urlPath,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload, 'utf8')
            },
            'method': 'POST'
        };
        //options.path += urlPath;

        for (var h in headers) {
            if (headers.hasOwnProperty(h)) {
                options.headers[h] = headers[h];
            }
        }

        var req = http.request(options, function(res) {
            //res.setEncoding('utf8');
            
            res.on('data', function (chunk) {
                body += chunk;
            });
            res.on('end', function() {
                deferred.resolve(JSON.parse(body));
            });
        });

        req.on('error', function(e) {
          console.error('problem with request: ' + e.message);
          deferred.reject("Error: " + e.message);
        });

        // write data to request body
        req.write(payload);
        req.end();
        return deferred.promise;
    }
});