;(function() {
    "use strict";
	var q = require('q');
	var http = require('http');
    exports.post = function(success, error) {

		var basic_auth = function(user, password) {
		var tok = user + ':' + password;
		var hash = new Buffer(tok).toString('base64');
			return "Basic " + hash;
		};

		var postData = function(path, data, headers){
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
	};

	var baseUrl = this.pathBase + this.OPTS.database,
		data = this.params,
		auth = basic_auth(this.OPTS.user, this.OPTS.password),
		headers = {'Authorization': auth};

		return postData.call(this, baseUrl + this.urlPath, data, headers).then(success, error);
	};
})();