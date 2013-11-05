var q = require("q"),
    command = require("./command");

var qryMain = command.qryMain;
var qrySql = command.qrySql;
var createCommand = command.createCommand;

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

        if(options){
            this.setOptions(options);
        }

        this.V = qryMain('V', true);
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
        this.shutdown = qryMain('shutdown', true);
        this.getFeatures = qryMain('getFeatures', true);

        //CUD
        this.addVertex = createCommand("CREATE VERTEX [<class>] [CLUSTER <cluster>] [CONTENT <content>]",
                                    {  parameters:['content']
                                    });


        this.addEdge = createCommand("CREATE EDGE <class> [CLUSTER <cluster>] FROM <from> TO <to> [CONTENT <content>]",
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

    return OrientDB;
})();
