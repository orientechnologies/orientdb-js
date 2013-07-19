"use strict"
var q = require('q');
var http = require('http');

var toString = Object.prototype.toString,
    push = Array.prototype.push;

var graphRegex = /^T\.(gt|gte|eq|neq|lte|lt)$|^g\.|^Vertex(?=\.class\b)|^Edge(?=\.class\b)/;
var closureRegex = /^\{.*\}$/;

function isIdString(id) {
    return !!this.OPTS.idRegex && isString(id) && this.OPTS.idRegex.test(id);
}

function isString(o) {
    return toString.call(o) === '[object String]';
}

function isGraphReference (val) {
    return isString(val) && graphRegex.test(val);
}

function isObject(o) {
    return toString.call(o) === '[object Object]';
}

function isClosure(val) {
    return isString(val) && closureRegex.test(val);   
}

function isArray(o) {
    return toString.call(o) === '[object Array]';
}

function qryMain(method, options, createNew){
    return function(){
        var self = this,
            rest,
            args = isArray(arguments[0]) ? arguments[0] : arguments,
            appendArg = '';

        rest = createNew ? new REST(options) : self._buildREST(self.params);
                 
        //cater for idx param 2
        if(method == 'idx' && args.length > 1){
            for (var k in args[1]){
                appendArg = k + ":";
                appendArg += parseArgs.call(self, args[1][k])
            }
            appendArg = "[["+ appendArg + "]]";
            args.length = 1;
        }
        rest.params += '.' + method + buildArgs.call(self, args);
        rest.params += appendArg;
        return rest;
    }
}

function parseArgs(val) {
    //check to see if the arg is referencing the graph ie. g.v(1)
    if(isObject(val) && val.hasOwnProperty('params') && isGraphReference(val.params)){
        return val.params.toString();
    }
    if(isGraphReference(val)) {
        return val.toString();
    }
    //Cater for ids that are not numbers but pass parseFloat test
    if(isIdString.call(this, val) || isNaN(parseFloat(val))) {
        return "'" + val + "'";
    }
    if(!isNaN(parseFloat(val))) {
         return val.toString();    
    }
    return val;
}

//[i] => index & [1..2] => range
//Do not pass in method name, just string arg
function qryIndex(){
    return function(arg) {
        var rest = this._buildREST(this.params);
        rest.params += '['+ arg.toString() + ']';
        return rest;
    }
}

//and | or | put  => g.v(1).outE().or(g._().has('id', 'T.eq', 9), g._().has('weight', 'T.lt', '0.6f'))
function qryPipes(method){
    return function() {
        var self = this,
            rest = self._buildREST(self.params),
            args = [],
            isArray = isArray(arguments[0]),
            argsLen = isArray ? arguments[0].length : arguments.length;

        rest.params += "." + method + "("
        for (var _i = 0; _i < argsLen; _i++) {
            rest.params += isArray ? arguments[0][_i].params || parseArgs.call(self, arguments[0][_i]) : arguments[_i].params || parseArgs.call(self, arguments[_i]);
            rest.params += ",";
        }
        rest.params = rest.params.slice(0, -1);
        rest.params += ")";
        return rest;
    }
}

//retain & except => g.V().retain([g.v(1), g.v(2), g.v(3)])
function qryCollection(method){
    return function() {
        var rest = this._buildREST(this.params),
            args = [];

        rest.params += "." + method + "(["
        for (var _i = 0, argsLen = arguments[0].length; _i < argsLen; _i++) {
            rest.params += arguments[0][_i].params;
            rest.params += ",";
        }
        rest.params = rest.params.slice(0, -1);
        rest.params += "])";
        return rest;
    }
}

function qrySql(options){
    return function(){
        var rest,
            args = arguments[0];

        rest = new REST(options, '/sql');

        rest.params = args;
        return rest;
    }
}

function buildArgs(array) {
    var argList = '',
        append = '',
        jsonString = '';
    for (var _i = 0, l = array.length; _i < l; _i++) {
        if(isClosure(array[_i])){
            append += array[_i];
        } else if (isObject(array[_i]) && !(array[_i].hasOwnProperty('params') && isGraphReference(array[_i].params))) {
            jsonString = JSON.stringify(array[_i]);
            jsonString = jsonString.replace('{', '[');
            argList += jsonString.replace('}', ']') + ",";
        } else {
            argList += parseArgs.call(this, array[_i]) + ",";
        }
    }
    argList = argList.slice(0, -1);
    return '(' + argList + ')' + append;
}

var REST = (function () {
    function REST(options, urlPath) {
        this.pathBase = '/command/';
        this.urlPath = urlPath || '/rest';
        this.OPTS = options;
        this.params = 'g';    
    }
  
    //add to OPTS
    function basic_auth(user, password) {
      var tok = user + ':' + password;
      var hash = new Buffer(tok).toString('base64');
      return "Basic " + hash;
    }

    function post () {
        return function(success, error) {
            var baseUrl = this.pathBase + this.OPTS.graph,
                data = this.params,           
                auth = basic_auth(this.OPTS.user, this.OPTS.password),
                headers = {'Authorization': auth};
            return postData.call(this, baseUrl + this.urlPath, data, headers).then(success, error);
        } 
    }

    function postData(path, data, headers){
        var deferred = q.defer();
        var payload = data || '{}';
        var body = '';

        
        var options = {
            'host': this.OPTS.host,
            'port': this.OPTS.port,
            'path': path,
            headers: {
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload, 'utf8')
            },
            'method': 'POST'
        };

        for (var h in headers) {
            if (headers.hasOwnProperty(h)) {
                options.headers[h] = headers[h];
            }
        }

        var req = http.request(options, function(res) {
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

    REST.prototype = {
        _buildREST: function (qryString){
            this.params = qryString;
            return this;
        },
        
        /*** Transform ***/
        both: qryMain('both'),
        bothE: qryMain('bothE'),
        bothV: qryMain('bothV'),
        cap: qryMain('cap'),
        gather: qryMain('gather'),
        id: qryMain('id'),
        'in': qryMain('in'),
        inE: qryMain('inE'),
        inV: qryMain('inV'),
        property: qryMain('property'),
        label: qryMain('label'),
        map: qryMain('map'),
        memoize: qryMain('memoize'),
        order: qryMain('order'),
        out: qryMain('out'),
        outE: qryMain('outE'),
        outV: qryMain('outV'),
        path: qryMain('path'),
        scatter: qryMain('scatter'),
        select: qryMain('select'),
        transform: qryMain('transform'),
        
        /*** Filter ***/
        index: qryIndex(), //index(i)
        range: qryIndex(), //range('[i..j]')
        and:  qryPipes('and'),
        back:  qryMain('back'),
        dedup: qryMain('dedup'),
        except: qryCollection('except'),
        filter: qryMain('filter'),
        has: qryMain('has'),
        hasNot: qryMain('hasNot'),
        interval: qryMain('interval'),
        or: qryPipes('or'),
        random: qryMain('random'),
        retain: qryCollection('retain'),
        simplePath: qryMain('simplePath'),
        
        /*** Side Effect ***/ 
        // aggregate //Not implemented
        as: qryMain('as'),
        groupBy: qryMain('groupBy'),
        groupCount: qryMain('groupCount'), //Not Fully Implemented ??
        optional: qryMain('optional'),
        sideEffect: qryMain('sideEffect'),

        linkBoth: qryMain('linkBoth'),
        linkIn: qryMain('linkIn'),
        linkOut: qryMain('linkOut'),
        // store //Not implemented
        // table //Not implemented
        // tree //Not implemented

        /*** Branch ***/
        copySplit: qryPipes('copySplit'),
        exhaustMerge: qryMain('exhaustMerge'),
        fairMerge: qryMain('fairMerge'),
        ifThenElse: qryMain('ifThenElse'), //g.v(1).out().ifThenElse('{it.name=='josh'}','{it.age}','{it.name}')
        loop: qryMain('loop'),

        /*** Methods ***/
        //fill //Not implemented
        count: qryMain('count'),
        iterate: qryMain('iterate'),
        next: qryMain('next'),
        toList: qryMain('toList'),
        put: qryPipes('put'),

        getPropertyKeys: qryMain('getPropertyKeys'),
        setProperty: qryMain('setProperty'),
        getProperty: qryMain('getProperty'),

        /*** http ***/
        then: post(),

    }
    return REST;
})();

var OrientDB = (function(){
        
    function OrientDB(options){

        //default options
        this.OPTS = {
            'host': 'localhost',
            'port': 2480,
            'graph': 'tinkergraph',
            'idRegex': /^[0-9]+:[0-9]+$///,
            //'user': 'root',
            //'password': 'EB478DB41FB3498FB96E6BDACA51C54DE20B281ED985B0DC03D5434D48BE28D1'
        };
    
        if(options){
            this.setOptions(options);
        }

        this.V = qryMain('V', this.OPTS, true);
        this._ = qryMain('_', this.OPTS, true);
        this.E = qryMain('E', this.OPTS, true);
        this.V =  qryMain('V', this.OPTS, true);

        this.sql = qrySql(this.OPTS);

        //Methods
        this.e = qryMain('e', this.OPTS, true);
        this.idx = qryMain('idx', this.OPTS, true);
        this.v = qryMain('v', this.OPTS, true);

        //Indexing
        this.createIndex = qryMain('createIndex');
        this.createKeyIndex = qryMain('createKeyIndex');
        this.getIndices =  qryMain('getIndices');
        this.getIndexedKeys =  qryMain('getIndexedKeys');
        this.getIndex =  qryMain('getIndex');
        this.dropIndex = qryMain('dropIndex');
        this.dropKeyIndex = qryMain('dropKeyIndex');

        this.clear =  qryMain('clear');
        this.shutdown =  qryMain('shutdown');
        this.getFeatures = qryMain('getFeatures');

    }

    OrientDB.prototype.setOptions = function (options){
        if(!!options){
            for (var k in options){
                if(options.hasOwnProperty(k)){
                    this.OPTS[k] = options[k];
                }
            }
        }
    }

    OrientDB.prototype.setAuth = function (user, password){
        this.setOptions({ 'user': user, 'password': password });
    }

    OrientDB.prototype.begin = function (){
        return new Trxn(this.OPTS);
    }

    return OrientDB;
})();
module.exports = OrientDB;