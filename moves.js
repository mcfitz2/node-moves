var _ = require('underscore')
, qs = require('querystring')
, request = require('request')
, url = require('url')
, moment = require("moment")
, async = require("async");
var Moves = module.exports = function(config_obj) {
    if (!(this instanceof Moves)) {
	return new Moves(config_obj);
    }

    var config = {
        oauth_base: 'https://api.moves-app.com/oauth/v1'
      , api_base: 'https://api.moves-app.com/api/1.1'
      , authorize_url: '/authorize'
    };
    
    this.config = _.extend(config, config_obj);
    
    this.http = request;

    if (!this.config.client_id) { 
	throw new Error('Missing Client ID');
    }
    if(!this.config.access_token) {
	throw new Error('Valid access token is required');
    }
    if(!this.config.client_secret) {
	throw new Error('Missing client secret');
    }
    var self = this;
    this.user = {
	profile:function() {
	    console.log("fetch user profile", self);
	},
	summary:{
	    daily:function() {}
	},
	activities:{
	    daily:function() {}
	},
	places:{
	    daily:function() {}
	},
	storyline:{
	    daily:function(day, params, callback) {
		if (typeof params === 'function') {
		    callback = params;
		    params = {};
		}
		self.get("/user/storyline/daily/"+day, params, function(err, res, body) {
		    callback(err, body);
		});
	    },
	    all:function(params, callback) {
		
		if (typeof params === 'function') {
		    callback = params;
		    params = {};
		}
		//console.log("Grabbing entire storyline", params);
		function f(thing) {
		    return thing.format("YYYYMMDD");
		}
		function mkDates(start) {
		    var now = moment();
		    var diff = now.diff(moment(start, "YYYYMMDD"), 'days');
		  //  console.log(now, diff);
		    var lowEnd = 1;
		    var highEnd = diff;
		    var arr = [];
		    while(lowEnd <= highEnd){
			arr.push(f(moment(now).subtract(lowEnd++, 'days')));
		    }
		    return arr;
		}
		
		self.get("/user/profile", {}, function(err, res, body) { 
		    console.log(err, res.statusCode, body);
		    var firstDate = body.profile.firstDate;
		    var dates = mkDates(firstDate);
		    //console.log(dates);
		    async.concat(dates, function(date, callback) {
			self.get("/user/storyline/daily/"+date, params, function(err, res, body) {
			    callback(err, body);
			});
		    }, function(err, results) {
			callback(err, results);
		    });
		});
	    }
	}
    };
};

Moves.prototype.authorize = function(options, res) {
    options = options || {};

    if(typeof res === 'object' && typeof res.header !== 'function') {
	throw new Error('authorize requires the first parameter to be a valid node response object');
    }
    if(!options.scope) {
        throw new Error('Scope is required');
    }
    if(!_.isArray(options.scope)) {
	throw new Error('Scope must be an array');
    }
    var query = {
        client_id: this.config.client_id
      , response_type: 'code'
      , scope: options.scope.join(' ')
    };

    if(options.state) query.state = options.state
    if(options.redirect_uri) query.redirect_uri = options.redirect_uri

    var auth_url = this.config.oauth_base + this.config.authorize_url + '?' + qs.stringify(query)

    if(!res) return auth_url

    res.header('Content-Type', 'text/html')
    res.statusCode = 302
    res.header('Location', auth_url)
    res.end('Redirecting...')
}

Moves.prototype.token = function(code, callback) {
    if(!code)                          throw new Error('You must include a code')
    if(!this.config.client_secret)     throw new Error('Missing client secret')
    if(typeof callback !== 'function') throw new Error('Invalid callback')

    var query = {
        grant_type: 'authorization_code'
      , code: code
      , client_id: this.config.client_id
      , client_secret: this.config.client_secret
    }
    if(this.config.redirect_uri) query.redirect_uri = this.config.redirect_uri

    this.http.post(this.config.oauth_base + '/access_token?' + qs.stringify(query), callback)
}

Moves.prototype.refresh_token = function(scope, callback) {
    if(typeof scope === 'function' && !callback) {
        callback = scope
        scope = undefined
    }
    if(!this.config.refresh_token)            throw new Error('You must include a token')
    if(!this.config.client_secret)     throw new Error('Missing client secret')
    if(typeof callback !== 'function') throw new Error('Invalid callback')

    var query = {
        grant_type: 'refresh_token'
      , refresh_token: this.config.refresh_token
      , client_id: this.config.client_id
      , client_secret: this.config.client_secret
    }
    if(scope) query.scope = scope

    this.http.post(this.config.oauth_base + '/access_token?' + qs.stringify(query), callback)
}

Moves.prototype.token_info = function(callback) {
    if (!this.config.access_token) {
	throw new Error('You must include a token');
    }

    var query = {
        access_token: this.config.access_token
    }

    this.http.get(this.config.oauth_base + '/tokeninfo?' + qs.stringify(query), callback)
}

Moves.prototype.get = function(call, params, callback) {
    if(!call) throw new Error('call is required. Please refer to the Moves docs <https://dev.moves-app.com/docs/api>')
    if(!this.config.access_token) throw new Error('Valid access token is required')

    var url = this.config.api_base+call;

    params.access_token = this.config.access_token;
    
    this.http.get({url:url, json:true, qs:params}, callback);
}

Moves.prototype.activities = function(params, callback) {
    var self = this;
    if (typeof params === 'function') {
	callback = params;
	params = {};
    }
    self.get("/activities", params, function(err, res, body) {
	callback(err, body);
    });
}
