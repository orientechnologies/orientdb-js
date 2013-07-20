var q = require('q');
var http = require('http');
module.exports = require(__dirname + '/../src/orientdb-js.js').inject(q, http);
