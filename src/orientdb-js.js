;(function(global) {
    "use strict";
    var q = global.Q || {};

    var toString = Object.prototype.toString,
        push = Array.prototype.push;

    var graphRegex = /^T\.(gt|gte|eq|neq|lte|lt|incr|decr)$|^g\.|^Vertex(?=\.class\b)|^Edge(?=\.class\b)/;
    var closureRegex = /^\{.*\}$/;

    function isRegexId(id) {
        return !!this.idRegex && isString(id) && this.idRegex.test(id);
    };

    function isString(o) {
        return toString.call(o) === '[object String]';
    }

    function isGraphReference (val) {
        return isString(val) && graphRegex.test(val);
    }

    function isObject(o) {
        return toString.call(o) === '[object Object]';
    }

    function isNumber(o) {
        return toString.call(o) === '[object Number]';
    }

    function isClosure(val) {
        return isString(val) && closureRegex.test(val);   
    }

    function isArray(o) {
        return toString.call(o) === '[object Array]';
    }

    function supplant (s, o) {
        return s.replace(/<([^<>]*)>/g,
            function (a, b) {
                var r = o[b];
                if(isObject(r)){
                    return JSON.stringify(r);
                } else if(isString(r) || isNumber(r)){
                    return r;
                };
                return a;
            }
        );
    };

    function qryCommand(template, config){
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
                };
                
                if(isDescriptor){
                    args = arguments[0];
                } else {
                    //must have a config.parameters[0]
                    args[config.parameters[0]] = arguments[0];                    
                }

            } else {
                for (i = 0; i < argsLen; i++) {
                    args[config.parameters[i]] = arguments[i];
                };
            }
            temp = supplant(template, args);
            if(config && 'defaults' in config){
                temp = supplant(temp, config.defaults);
            }
            
            for (var i = optionalVals.length - 1; i >= 0; i--) {
                temp = temp.replace(optionalVals[i], "");
            };
            temp = temp.replace(/\[|\]/g, "");
            return sqlCmd.call(self, temp);
        }
    }

    function qryMain(method, createNew){
        return function(){
            var self = this,
                restCmd,
                args = isArray(arguments[0]) ? arguments[0] : arguments,
                appendArg = '';

            restCmd = createNew ? new REST(self.OPTS, '/command/') : self._buildREST(self.params);
                     
            //cater for idx param 2
            if(method == 'idx' && args.length > 1){
                for (var k in args[1]){
                    appendArg = k + ":";
                    appendArg += parseArgs.call(self, args[1][k]);
                }
                appendArg = "[["+ appendArg + "]]";
                args.length = 1;
            }
            restCmd.params += '.' + method + buildArgs.call(self, args);
            restCmd.params += appendArg;
            return restCmd;
        };
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
        if(isRegexId.call(this, val) || isNaN(parseFloat(val))) {
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
            var restCmd = this._buildREST(this.params);
            restCmd.params += '['+ arg.toString() + ']';
            return restCmd;
        };
    }

    //and | or | put  => g.v(1).outE().or(g._().has('id', 'T.eq', 9), g._().has('weight', 'T.lt', '0.6f'))
    function qryPipes(method){
        return function() {
            var self = this,
                restCmd = self._buildREST(self.params),
                args = [],
                isArray = isArray(arguments[0]),
                argsLen = isArray ? arguments[0].length : arguments.length;

            restCmd.params += "." + method + "(";
            for (var _i = 0; _i < argsLen; _i++) {
                restCmd.params += isArray ? arguments[0][_i].params || parseArgs.call(self, arguments[0][_i]) : arguments[_i].params || parseArgs.call(self, arguments[_i]);
                restCmd.params += ",";
            }
            restCmd.params = restCmd.params.slice(0, -1);
            restCmd.params += ")";
            return restCmd;
        };
    }

    //retain & except => g.V().retain([g.v(1), g.v(2), g.v(3)])
    function qryCollection(method){
        return function() {
            var restCmd = this._buildREST(this.params),
                args = [];

            restCmd.params += "." + method + "([";
            for (var _i = 0, argsLen = arguments[0].length; _i < argsLen; _i++) {
                restCmd.params += arguments[0][_i].params;
                restCmd.params += ",";
            }
            restCmd.params = restCmd.params.slice(0, -1);
            restCmd.params += "])";
            return restCmd;
        };
    }

    function qrySql(){
        return function(){
            var restCmd,
                args = arguments[0];

            restCmd = new REST(this.OPTS, '/command/', '/sql');
            restCmd.params = args;
            return restCmd;
        };
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

    /* Brower specific functions. Node functions override these from index.js */
    var REST = (function () {
        var self;
        function REST(options, cmdUrl, cmdTypeUrl) {
            self = this;
            if('sid' in options){
                this.sid = options.sid;
            }
            this.cmdUrl = cmdUrl || '/command/';
            this.cmdTypeUrl = cmdTypeUrl || '/gremlin';
            this.OPTS = options;
            this.httpStr = options.ssl ? "https://" : "http://";
            this.params = 'g'; 

            this.ajax = function (method, url, data, headers) {
                var deferred = q.defer();
                var xhr, payload, o = {};
                var resp = '';
                data = data || {};
                headers = headers || {};
                
                try {
                    xhr = new_xhr();
                } catch (e) {
                    deferred.reject(-1);
                    return deferred.promise;
                }

                payload = encode(data);
                if (method === 'GET' && payload) {
                    url += payload;
                    payload = null;
                }

                xhr.open(method, url, true);
                for (var h in headers) {
                    if (headers.hasOwnProperty(h)) {
                        xhr.setRequestHeader(h, headers[h]);
                    }
                }

                xhr.onreadystatechange = function() {
                    if (xhr.readyState === 4) {
                        if (xhr.status >= 200 && xhr.status < 300) {
                            resp = !!xhr.responseText.length ? JSON.parse(xhr.responseText) : {status: xhr.status, statusText: xhr.statusText};
                            deferred.resolve(resp);
                        } else {
                            deferred.reject(xhr);
                        }
                    }
                };

                xhr.send(payload);
                return deferred.promise;
            };
        }
        
        function encode(data) {
            var result = "";
            if (typeof data === "string") {
                result = data;
            } else {
                var e = encodeURIComponent;
                for (var k in data) {
                    if (data.hasOwnProperty(k)) {
                        result += '&' + e(k) + '=' + e(data[k]);
                    }
                }
            }
            return result;
        }

        function new_xhr() {
            var xhr;
            if (window.XMLHttpRequest) {
                xhr = new XMLHttpRequest();
            } else if (typeof XDomainRequest != "undefined") {
                // Otherwise, check if XDomainRequest.
                // XDomainRequest only exists in IE, and is IE's way of making CORS requests.
                xhr = new XDomainRequest();
          } else if (window.ActiveXObject) {
                try {
                    xhr = new ActiveXObject("Msxml2.XMLHTTP");
                } catch (e) {
                    xhr = new ActiveXObject("Microsoft.XMLHTTP");
                }
            }
            return xhr;
        }

        function basic_auth (user, password) {
            var tok = user + ':' + password;
            var hash = global.btoa(tok);
            return "Basic " + hash;
        }
        

        var post = function () {
            return function(success, error) {
                var baseUrl = this.cmdUrl + this.OPTS.database,
                    data = this.params, headers;
                
                return this.ajax.call(this, 'POST', baseUrl + this.cmdTypeUrl, data, headers)
                    .then(success, error);
            }; 
        };

        var auth = function() {
            return function() {
                return q.fcall(function() {
                    var url = self.httpStr + self.OPTS.host + ":" + self.OPTS.port + self.cmdUrl + self.OPTS.database,
                        authen = basic_auth(self.OPTS.user, self.OPTS.password),
                        headers = {'Authorization': authen};
                    return self.ajax('GET', url, null, headers);
                });
            };
        };

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
            orderMap: qryMain('orderMap'),
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

            /*** overridden in NodeJS ***/
            then: post(),
            authenticate: auth(),
        };
        
        return REST;
    })();

    var OrientDB = (function(){
            
        function OrientDB(options){
            var self = this;
            this.idRegex = /^[0-9]+:[0-9]+$/;
            this.sid = '';
            //default options
            this.OPTS = {
                'ssl': false,
                'host': 'localhost',
                'port': 2480,
                'database': 'tinkergraph',
                //'user': 'root',
                //'password': 'EB478DB41FB3498FB96E6BDACA51C54DE20B281ED985B0DC03D5434D48BE28D1'
            };
        
            if(options){
                this.setOptions(options);
            }

            this._ = qryMain('_', true);
            this.E = qryMain('E', true);
            this.V =  qryMain('V', true);

            this.sql = qrySql();

            //Methods
            this.e = qryMain('e', true);
            this.idx = qryMain('idx', true);
            this.v = qryMain('v', true);

            //Indexing
            this.createIndex = qryMain('createIndex', true);
            this.createKeyIndex = qryMain('createKeyIndex', true);
            this.getIndices =  qryMain('getIndices', true);
            this.getIndexedKeys =  qryMain('getIndexedKeys', true);
            this.getIndex =  qryMain('getIndex', true);
            this.dropIndex = qryMain('dropIndex', true);
            this.dropKeyIndex = qryMain('dropKeyIndex', true);

            this.clear =  qryMain('clear', true);
            this.shutdown =  qryMain('shutdown', true);
            this.getFeatures = qryMain('getFeatures', true);

            //CUD
            this.addVertex = qryCommand("CREATE VERTEX [<class>] [CLUSTER <cluster>] [CONTENT <content>]",
                                        {  parameters:['content']
                                        });


            this.addEdge = qryCommand("CREATE EDGE <class> [CLUSTER <cluster>] FROM <from> TO <to> [CONTENT <content>]"
                                    ,{  defaults:{ class: 'E' },
                                        parameters:['from','to','content']
                                    });

            this.connect = function(){
                var rest = new REST(this.OPTS, '/connect/');
                return rest.authenticate()
                    .then(function(resp){
                        if(resp.status === 204){
                            if('sid' in resp){
                                self.setOptions({'sid': resp.sid});
                            }
                            return self;
                        } else {
                            throw { message:"Problem establishing connect to database.", response: resp};
                        }                        
                    });
            };
        }

        OrientDB.prototype.setOptions = function (options){
            if(!!options){
                for (var k in options){
                    if(options.hasOwnProperty(k)){
                        this.OPTS[k] = options[k];
                    }
                }
            }
        };
        return OrientDB;
    })();

    var orientdb = function(options){
        var db = new OrientDB(options);
        return db.connect();
    };

    // some AMD build optimizers, like r.js, check for specific condition patterns like the following:
    if (typeof define == 'function' && typeof define.amd == 'object' && define.amd) {        
        define({ connect: orientdb });
    }
    // check for `exports` after `define` in case a build optimizer adds an `exports` object
    else if (typeof module !== 'undefined' && typeof module.exports !== 'undefined') {
        exports.REST = REST.prototype;
        exports.connect = orientdb;
    }
    else {
        //browser
        global.OrientDB = { connect: orientdb };
    }

})(this);