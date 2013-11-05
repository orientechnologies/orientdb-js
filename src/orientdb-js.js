var q = require("q"),
    merge = require("./utils").merge,
    Trxn = require("./transaction"),
    gremlin = require("./gremlin");


module.exports = (function(){
    function OrientDB(options){
        var self = this;
        //default options
        this.OPTS = {
            'ssl': false,
            'host': 'localhost',
            'port': 2480,
            'database': 'tinkergraph',
            //'user': 'root',
            //'password': 'EB478DB41FB3498FB96E6BDACA51C54DE20B281ED985B0DC03D5434D48BE28D1'
        };

//        this.typeMap = {};

        if(options){
            this.setOptions(options);
        }

        this.V = gremlin.qryMain('V', true);
        this._ = gremlin.qryMain('_', true);
        this.E = gremlin.qryMain('E', true);
        this.V =  gremlin.qryMain('V', true);

        this.sql = gremlin.qrySql();
        
        //Methods
        this.e = gremlin.qryMain('e', true);
        this.idx = gremlin.qryMain('idx', true);
        this.v = gremlin.qryMain('v', true);

        //Indexing
        this.createIndex = gremlin.qryMain('createIndex', true);
        this.createKeyIndex = gremlin.qryMain('createKeyIndex', true);
        this.getIndices =  gremlin.qryMain('getIndices', true);
        this.getIndexedKeys =  gremlin.qryMain('getIndexedKeys', true);
        this.getIndex =  gremlin.qryMain('getIndex', true);
        this.dropIndex = gremlin.qryMain('dropIndex', true);
        this.dropKeyIndex = gremlin.qryMain('dropKeyIndex', true);

        this.clear =  gremlin.qryMain('clear', true);
        this.shutdown = gremlin.qryMain('shutdown', true);
        this.getFeatures = gremlin.qryMain('getFeatures', true);

        //CUD
        this.addVertex = gremlin.createCommand("CREATE VERTEX [<class>] [CLUSTER <cluster>] [CONTENT <content>]",
                                    {  parameters:['content']
                                    });


        this.addEdge = gremlin.createCommand("CREATE EDGE <class> [CLUSTER <cluster>] FROM <from> TO <to> [CONTENT <content>]",
                                {  defaults:{ class: 'E' },
                                    parameters:['from','to','content']
                                });

        this.connect = function(){
            return q.fcall(function() {
                return self;
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

    // OrientDB.prototype.begin = function (typeMap){
    //     return new Trxn(this.OPTS, typeMap ? merge(typeMap, this.typeMap) : this.typeMap);
    // };

    return OrientDB;
})();
