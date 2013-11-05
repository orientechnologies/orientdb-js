var http = require("http");
var q = require("q");

var Utils = require("./utils");
var supplant = Utils.supplant;
var isObject = Utils.isObject;
var isArray = Utils.isArray;
var isClosure = Utils.isClosure;
var isGraphReference = Utils.isGraphReference;
var isRegexId = Utils.isRegexId;

var pathConnect = '/connect/';
var pathCommand = '/command/';
var pathGremlin = '/gremlin';
var pathSql = '/sql';


function qryMain(method, reset){
    return function(){
        var self = this,
            command = reset ? new Command(this, pathCommand) : self._buildCommand(self.params),
            args = '',
            appendArg = '';

        //cater for select array parameters
        if(method == 'select'){
            args = arguments;
            command.params += '.' + method + buildArgs.call(self, args, true);
        } else {
            args = isArray(arguments[0]) ? arguments[0] : arguments;
            //cater for idx param 2
            if(method == 'idx' && args.length > 1){
                for (var k in args[1]){
                    appendArg = k + ":";
                    appendArg += parseArgs.call(self, args[1][k]);
                }
                appendArg = "[["+ appendArg + "]]";
                args.length = 1;
            }
            command.params += '.' + method + buildArgs.call(self, args);
        }
        command.params += appendArg;
        return command;
    };
}

function qrySql(){
    return function(){
        var restCmd,
            args = arguments[0];

        restCmd = new Command(this, pathCommand, pathSql);
        restCmd.params = args;
        return restCmd;
    };
}

function createCommand(template, config){
    var vals = template.match(/<([^<>]*)>/g),
        valLen = vals.length,
        optionalVals = template.match(/\[([^\[\]]*)\]/g);
    return function() {
        var self = this,
            valTemp,
            argsLen = arguments.length,
            i = 0,
            j = 0,
            args = {},
            isDescriptor = false,
            temp,
            sqlCmd = qrySql();

        if(argsLen == 1 && isObject(arguments[0])){
            //check to see if the passed in Object is
            //an actual argument or a descriptor i.e addVertex can take
            //an object as the first parameter
            for (j = 0; j < valLen; j++) {
                valTemp = vals[j].slice(1,-1);
                if((valTemp in arguments[0]) && arguments[0].hasOwnProperty(valTemp)){
                    isDescriptor = true;
                    break;
                }
            }
            
            if(isDescriptor){
                args = arguments[0];
            } else {
                //must have a config.parameters[0]
                args[config.parameters[0]] = arguments[0];                    
            }

        } else {
            for (i = 0; i < argsLen; i++) {
                args[config.parameters[i]] = arguments[i];
            }
        }
        temp = supplant(template, args);
        if(config && 'defaults' in config){
            temp = supplant(temp, config.defaults);
        }
        
        for (var m = optionalVals.length - 1; m >= 0; m--) {
            temp = temp.replace(optionalVals[m], "");
        }
        temp = temp.replace(/\[|\]/g, "");
        return sqlCmd.call(self, temp);
    };
}

module.exports = { 
                   'qryMain': qryMain,
                   'qrySql': qrySql,
                   'createCommand': createCommand 
                 };


//[i] => index & [1..2] => range
//Do not pass in method name, just string arg
function qryIndex(){
    return function(arg) {
        var command = this._buildCommand(this.params);
        command.params += '['+ arg.toString() + ']';
        return command;
    };
}


//and | or | put  => g.v(1).outE().or(g._().has('id', 'T.eq', 9), g._().has('weight', 'T.lt', '0.6f'))
function qryPipes(method){
    return function() {
        var self = this,
            command = self._buildCommand(this.params),
            args = [],
            isArr = isArray(arguments[0]),
            argsLen = isArr ? arguments[0].length : arguments.length;

        command.params += "." + method + "(";
        for (var _i = 0; _i < argsLen; _i++) {
            command.params += isArr ? arguments[0][_i].params || parseArgs.call(self, arguments[0][_i]) : arguments[_i].params || parseArgs.call(self, arguments[_i]);
            command.params += ",";
        }
        command.params = command.params.slice(0, -1);
        command.params += ")";
        return command;
    };
}

//retain & except => g.V().retain([g.v(1), g.v(2), g.v(3)])
function qryCollection(method){
    return function() {
        var self = this,
            command = this._buildCommand(this.params),
            param = '';

        if(isArray(arguments[0])){
            for (var _i = 0, argsLen = arguments[0].length; _i < argsLen; _i++) {
                param += arguments[0][_i].params;
                param += ",";
            }
            command.params += "." + method + "([" + param + "])";
        } else {
            command.params += "." + method + buildArgs.call(self, arguments[0]);
        }
        return command;
    };
}

function buildArgs(array, retainArray) {
    var self = this,
        argList = '',
        append = '',
        jsonString = '';

    for (var _i = 0, l = array.length; _i < l; _i++) {
        if(isClosure(array[_i])){
            append += array[_i];
        } else if (isObject(array[_i]) && !(array[_i].hasOwnProperty('params') && isGraphReference(array[_i].params))) {
            jsonString = JSON.stringify(array[_i]);
            jsonString = jsonString.replace('{', '[');
            argList += jsonString.replace('}', ']') + ",";
        } else if(retainArray && isArray(array[_i])) {
            argList += "[" + parseArgs.call(self, array[_i]) + "],";
        } else {
            argList += parseArgs.call(self, array[_i]) + ",";
        }
    }
    argList = argList.slice(0, -1);
    return '(' + argList + ')' + append;
}

function parseArgs(val) {
    if(val === null) {
        return 'null';
    }
    //check to see if the arg is referencing the graph ie. g.v(1)
    if(isObject(val) && val.hasOwnProperty('params') && isGraphReference(val.params)){
        return val.params.toString();
    }
    if(isGraphReference(val)) {
        return val.toString();
    }
    //Cater for ids that are not numbers but pass parseFloat test
    if(isRegexId.call(this, val) || isNaN(parseFloat(val))) {
        return "'" + val + "'";
    }
    if(!isNaN(parseFloat(val))) {
         return val.toString();
    }
    return val;
}

Command = (function () {
    function Command(OrientDB, cmdUrl, cmdTypeUrl) {
        this.OrientDB = OrientDB;
        this.OPTS = OrientDB.OPTS;
        // if('sid' in options){
        //     this.sid = options.sid;
        // }
        this.cmdUrl = cmdUrl || '/command/';
        this.cmdTypeUrl = cmdTypeUrl || '/gremlin';
        this.httpStr = "http://";//options.ssl ? "https://" : "http://";
        this.params = 'g';
    }

    function basic_auth(user, password) {
        var tok = user + ':' + password;
        var hash = new Buffer(tok).toString('base64');
        return "Basic " + hash;
    }

    function auth() {
        return function(){
            var deferred = q.defer();
            var options = {
                'host': this.OPTS.host,
                'port': this.OPTS.port,
                'path': pathConnect + this.OPTS.database,
                headers: {
                    'Authorization': basic_auth(this.OPTS.user, this.OPTS.password)
                },
                'method': 'GET'
            };

            http.get(options, function(res) {
                var body = '';
                var resp = '';
                res.on('data', function(results) {
                    body += results;
                });
    
                res.on('end', function() {
                    if (res.statusCode >= 200 && res.statusCode < 300) {
                        resp = !!res.length ? JSON.parse(body) : {'sid':res.headers['set-cookie'][0].split(';'), status: res.statusCode, statusText: 'No content'};
                        deferred.resolve(resp);
                    } else {
                        deferred.reject(res);
                    }
                });
            }).on('error', function(e) {
                deferred.reject(e);
            });
            return deferred.promise;
        };
    }

    function get() {
        return function(callback){
            return getData.call(this).then().nodeify(callback);
        };
    }

    function postData(){
        var deferred = q.defer();
        var payload = this.params || '{}';
        var body = '';
        var options = {
            'host': this.OPTS.host,
            'port': this.OPTS.port,
            'path': this.cmdUrl + this.OPTS.database + this.cmdTypeUrl,
            headers: {
                'Authorization': basic_auth(this.OPTS.user, this.OPTS.password),
                'Cookie': this.OPTS.sid,
                'Content-Type': 'application/json',
                'Content-Length': Buffer.byteLength(payload, 'utf8')
            },
            'method': 'POST'
        };

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


    var post = function() {
        return function(callback){
            return postData.call(this).then().nodeify(callback);
        };
    };

    Command.prototype = {
        _buildCommand: function (qryString){
            this.params = qryString;
            return this;
        },

        /*** Transform ***/
        _: qryMain('_'),
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
        orderMap: qryMain('orderMap'),

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
        keys: qryMain('keys'),
        remove: qryMain('remove'),
        values: qryMain('values'),
        put: qryPipes('put'),

        getPropertyKeys: qryMain('getPropertyKeys'),
        setProperty: qryMain('setProperty'),
        getProperty: qryMain('getProperty'),

        /*** http ***/
        get: post(),
        authenticate: auth()

    };

    return Command;
})();
