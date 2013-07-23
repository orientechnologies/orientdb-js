;(function() {
    "use strict";
	var q = require('q');
	var http = require('http');

	var basic_auth = function(user, password) {
		var tok = user + ':' + password;
		var hash = new Buffer(tok).toString('base64');
		return "Basic " + hash;

	};

	var postData = function(){
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
	};


	var post = function() {
		return function(success, error){
			return postData.call(this).then(success, error);
		};
	};

	var auth = function() {
		return function(){
			var deferred = q.defer();
			var options = {
				'host': this.OPTS.host,
				'port': this.OPTS.port,
				'path': '/connect/' + this.OPTS.database,
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
    };

	exports.post = post;
	exports.auth = auth;
})();