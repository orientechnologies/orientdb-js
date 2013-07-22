;(function(){
	var orientdb = require(__dirname + '/src/orientdb-js.js');
	orientdb.POST.then = require(__dirname + '/src/node-compat.js').post;
	module.exports = orientdb;
})();