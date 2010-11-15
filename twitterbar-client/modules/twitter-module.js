var gTwitterBar = {
	exists : false,
	
	loadStack : 0,
	
	load : function () {
		gTwitterBar.loadStack++;
		
		if (!gTwitterBar.exists) {
			gTwitterBar.exists = true;
	
			var db = gTwitterBar.getDB();
	
			if (!db.tableExists("messages_home")) {
				db.executeSimpleSQL("CREATE TABLE messages_home (account TEXT, twitter_id INTEGER, created INTEGER, text TEXT, in_reply_to_status_id INTEGER, in_reply_to_user_id TEXT, in_reply_to_screen_name TEXT, user_screen_name TEXT, user_profile_image_url TEXT, via_user_screen_name TEXT, PRIMARY KEY (account, twitter_id))");
			}
	
			if (!db.tableExists("messages_mentions")) {
				db.executeSimpleSQL("CREATE TABLE messages_mentions (account TEXT, twitter_id INTEGER, created INTEGER, text TEXT, in_reply_to_status_id INTEGER, in_reply_to_user_id TEXT, in_reply_to_screen_name TEXT, user_screen_name TEXT, user_profile_image_url TEXT, via_user_screen_name TEXT, PRIMARY KEY (account, twitter_id))");
			}
	
			if (!db.tableExists("messages_direct")) {
				db.executeSimpleSQL("CREATE TABLE messages_direct (account TEXT, twitter_id INTEGER, created INTEGER, text TEXT, in_reply_to_status_id INTEGER, in_reply_to_user_id TEXT, in_reply_to_screen_name TEXT, user_screen_name TEXT, user_profile_image_url TEXT, via_user_screen_name TEXT, PRIMARY KEY (twitter_id))");
			}
	
			gTwitterBar.closeDB();
	
			gTwitterBar.prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("extensions.twitter.");	
			gTwitterBar.prefs.QueryInterface(Components.interfaces.nsIPrefBranch2);
			gTwitterBar.prefs.addObserver("", gTwitterBar, false);
	
			gTwitterBar.setUpAccount();
	
			// Set up timers here.
	
			var j = 0;
	
			for (i in gTwitterBar.timers) {
				gTwitterBar.timers[i] = gTwitterBar.setTimeout(function (a, b) { gTwitterBar.checkTwitter(a,b); }, 1000 * 60 * j, null, i);
				j++;
			}
		}
		
		gTwitterBar.updateToolbarIcon();
	
		return true;
	},
	
	unload : function () {
		gTwitterBar.loadStack--;
		
		if (gTwitterBar.loadStack == 0) {
			// Do it.
			gTwitterBar.exists = false;
		}
	},
	
	updateToolbarIcon : function () {
		var username = gTwitterBar.prefs.getCharPref("sidebarAccount");
		
		// Determine newness for home, mentions, and dm
		var home_last = gTwitterBar.getAccountField(username, "last_view_home");
		var mentions_last = gTwitterBar.getAccountField(username, "last_view_mentions");
		var dm_last = gTwitterBar.getAccountField(username, "last_view_dm");
	
		var home_newest = gTwitterBar.getLastTimestamp(username, "home");
		var mentions_newest = gTwitterBar.getLastTimestamp(username, "mentions");
		var dm_newest = gTwitterBar.getLastTimestamp(username, "direct");
		
		var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
		                   .getService(Components.interfaces.nsIWindowMediator);
		
		var enumerator = wm.getEnumerator("navigator:browser");
		
		while (enumerator.hasMoreElements()) {
			var win = enumerator.getNext();
			
			if (win.document.getElementById("twitter-sidebar-button")) {
				if ((home_last < home_newest) || (mentions_last < mentions_newest) || (dm_last < dm_newest)) {
					win.document.getElementById("twitter-sidebar-button").setAttribute("new", "true");
				}
				else {
					win.document.getElementById("twitter-sidebar-button").removeAttribute("new");
				}
			}
		}
	},
	
	getAccountField : function (username, field) {
		var accounts = gTwitterBar.prefs.getCharPref("accounts");
		
		if (!accounts) {
			return false;
		}
		
		accounts = JSON.parse(accounts);
		
		if (!(username in accounts)){ 
			return false;
		}
		
		if (!(field in accounts[username])) {
			return false;
		}
		
		return accounts[username][field];
	},
	
	getLastTimestamp : function (username, method) {
		var sinceId = 0;
		
		if (!username) {
			username = gTwitterBar.prefs.getCharPref("sidebarAccount");
		}
		
		if (!method) method = "home";
		
		var table = "messages_home";
		
		switch (method) {
			case "mentions":
				table = "messages_mentions";
			break;
			case "direct":
				table = "messages_direct";
			break;
		}
		
		var db = gTwitterBar.getDB();
		
		var select = db.createStatement("SELECT MAX(created) AS sinceId FROM "+table+" WHERE account=:account");
		select.params.account = username;
		
		try {
			while (select.executeStep()) {
				sinceId = select.row.sinceId;
				break;
			}
		}
		catch (e) {
			gTwitterBar.log(e);
		}
		finally {
			select.reset();
		}
		
		select.finalize();
		
		gTwitterBar.closeDB();
		
		if (!sinceId) {
			sinceId = 0;
		}
		
		return sinceId;
	},
	
	timers : {
		"home" : null,
		"mentions" : null,
		"direct": null
	},
	
	prefs : null,
	
	db : null,
	dbStack : 0,
	dbFile : null,
	
	/**
	 * Token secret for a given account.
	 */
	get_oauth_token_secret : function (username) { if (username in gTwitterBar.accounts) { return gTwitterBar.accounts[username].token_secret; } else { return ""; } },
	
	/**
	 * Token for a given account.
	 */
	get_oauth_token : function (username) { if (username in gTwitterBar.accounts) { return gTwitterBar.accounts[username].token; } else { return ""; } },
	
	oauth : {
		consumer_key : "lwVKpcTJM69MeYobWq3mg",
		consumer_secret : "TVjchnocdkVUcFtNhzCzVwOql5meAgbShN621r6bueE", 
		
		request_token : {
			oauth_token : "",
			oauth_token_secret : ""
		},
		
		serviceProvider : {
			signatureMethod : "HMAC-SHA1",
			requestTokenURL : "http://twitter.com/oauth/request_token",
			userAuthorizationURL : "http://twitter.com/oauth/authorize",
			accessTokenURL : "http://twitter.com/oauth/access_token",
			echoURL : "http://www.chrisfinke.com/oauth/twitterbar"
		}
	},
	
	/**
	 * The Twitter username of the currently active account.
	 */
	currentAccount : "",
	
	/**
	 * A dict of all of the authorized accounts.  A shortcut to the stored data in the prefs system.
	 */
	accounts : {},
	
	setUpAccount : function () {
		var account = gTwitterBar.prefs.getCharPref("account");
		var accounts = gTwitterBar.prefs.getCharPref("accounts");
		
		if (accounts) {
			accounts = JSON.parse(accounts);
			
			if (!(account in accounts)) {
				account = "";
			}
			
			if (!account) {
				for (var i in accounts) {
					account = i;
					break;
				}
				
				gTwitterBar.prefs.setCharPref("account", account);
			}
		}
		else {
			accounts = {};
			gTwitterBar.prefs.setCharPref("account", "");
		}
		
		if (account && !(account in accounts)) {
			account = "";
			gTwitterBar.prefs.setCharPref("account", "");
		}
		
		gTwitterBar.accounts = accounts;
		gTwitterBar.currentAccount = account;
	},
	
	observe : function(subject, topic, data) {
		if (topic != "nsPref:changed") {
			return;
		}
		
		switch(data) {
			case "accounts":
				gTwitterBar.setUpAccount();
			break;
		}
	},
	
	getDB : function () {
		gTwitterBar.dbStack++;
		
		if (gTwitterBar.dbStack > 1) {
			return gTwitterBar.db;
		}
		
		var storageService = Components.classes["@mozilla.org/storage/service;1"]
		                     .getService(Components.interfaces.mozIStorageService);
		
		if (!gTwitterBar.dbFile) {
			gTwitterBar.dbFile = Components.classes["@mozilla.org/file/directory_service;1"].  
			                      getService(Components.interfaces.nsIProperties).  
			                      get("ProfD", Components.interfaces.nsIFile);
			gTwitterBar.dbFile.append("twitterbar.sqlite");
		}
		
		try {
			gTwitterBar.db = storageService.openDatabase(gTwitterBar.dbFile);
		} catch (e) {
			gTwitterBar.log(e);
			
			// Corrupt or non-SQLite file.
			// TODO Remove/recreate file.
			throw e;
		}
		
		return gTwitterBar.db;
	},
	
	closeDB : function (force) {
		gTwitterBar.dbStack--;
		
		if (force) gTwitterBar.dbStack = 0;
	
		if (gTwitterBar.dbStack == 0) {
			try { gTwitterBar.db.close(); } catch (e) { gTwitterBar.log(e); }
		}
	},
	
	setTimeout : function (callback, timeout, arg1, arg2, arg3, arg4) {
		var cb = {
			notify : function (timer) {
				callback(arg1, arg2, arg3, arg4);
			}
		};
		
		var timer = Components.classes["@mozilla.org/timer;1"]
		            .createInstance(Components.interfaces.nsITimer);
		timer.initWithCallback(cb, timeout, timer.TYPE_ONE_SHOT);
		return timer;
	},
	
	clearTimeout : function (timer) {
		if (timer) {
			timer.cancel();
		}
	},
	
	getSinceId : function (username, method) {
		var sinceId = 0;
		
		if (!username) {
			username = gTwitterBar.prefs.getCharPref("sidebarAccount");
		}
		
		if (!method) method = "home";
		
		var table = "messages_home";
		
		switch (method) {
			case "mentions":
				table = "messages_mentions";
			break;
			case "direct":
				table = "messages_direct";
			break;
		}
		
		var db = gTwitterBar.getDB();
		
		var select = db.createStatement("SELECT MAX(twitter_id) AS sinceId FROM "+table+" WHERE account=:account");
		select.params.account = username;
		
		try {
			while (select.executeStep()) {
				sinceId = select.row.sinceId;
				break;
			}
		}
		catch (e) {
			gTwitterBar.log(e);
		}
		finally {
			select.reset();
		}
		
		select.finalize();
		
		gTwitterBar.closeDB();
		
		if (!sinceId) {
			sinceId = 0;
		}
		
		return sinceId;
	},
	
	checkTwitter : function (username, method, callback) {
		if (typeof callback != "function") callback = null;
		
		if (!username) {
			username = gTwitterBar.prefs.getCharPref("sidebarAccount");
		}
		
		var url = "statuses/home_timeline";
		var table = "messages_home";
		
		switch (method) {
			case "mentions":
				table = "messages_mentions";
				url = "statuses/mentions";
			break;
			case "direct":
				table = "messages_direct";
				url = "direct_messages";
			break;
			default:
				method = "home";
			break;
		}
		
		gTwitterBar.log("Checking Twitter ("+method+") for @"+ username);
		
		if (!callback) gTwitterBar.clearTimeout(gTwitterBar.timers[method]);
		
		function req_callback(req) {
			if (req.status == 200) {
				var json = JSON.parse(req.responseText);
				
				var db = gTwitterBar.getDB();
				
				for (var i = 0; i < json.length; i++) {
					var insert = db.createStatement("INSERT INTO "+table+" (account, twitter_id, created, text, user_screen_name, user_profile_image_url, in_reply_to_status_id, in_reply_to_screen_name, via_user_screen_name) VALUES (:account, :twitter_id, :created, :text, :user_screen_name, :user_profile_image_url, :in_reply_to_status_id, :in_reply_to_screen_name, :via_user_screen_name)");
					
					insert.params.account = username;
					insert.params.twitter_id = json[i].id;
					insert.params.created = Math.round(Date.parse(json[i].created_at) / 1000);
					
					if ("in_reply_to_status_id" in json[i]) {
						insert.params.in_reply_to_status_id = json[i].in_reply_to_status_id;
						insert.params.in_reply_to_screen_name = json[i].in_reply_to_screen_name;
					}
					else {
						insert.params.in_reply_to_status_id = "";
						insert.params.in_reply_to_screen_name = "";
					}
					
					if ("retweeted_status" in json[i]) {
						insert.params.via_user_screen_name = json[i].user.screen_name;
						insert.params.text = json[i].retweeted_status.text;
						insert.params.twitter_id = json[i].retweeted_status.id;
						
						var user = json[i].retweeted_status.user;
					}
					else {
						insert.params.twitter_id = json[i].id;
						insert.params.text = json[i].text;
						insert.params.via_user_screen_name = "";
						
						if ("user" in json[i]) {
							var user = json[i].user;
						}
						else if ("sender" in json[i]) {
							var user = json[i].sender;
						}
					}
					
					insert.params.user_screen_name = user.screen_name;
					insert.params.user_profile_image_url=user.profile_image_url;
					
					try {
						insert.execute();
					} catch (e) {
						gTwitterBar.log(e);
					}
					
					insert.reset();
					insert.finalize();
				}
				
				gTwitterBar.closeDB();
				
				if (json.length > 0) {
					gTwitterBar.prefs.setBoolPref("notifierHacks.new", !gTwitterBar.prefs.getBoolPref("notifierHacks.new"));
				}
			}
			else {
				gTwitterBar.log("Error: " + req.status);
			}
			
			if (!callback) gTwitterBar.timers[method] = gTwitterBar.setTimeout(function (a, b) { gTwitterBar.checkTwitter(a, b); }, 60 * 1000 * 3, null, method);
			else callback(req.status);
			
			gTwitterBar.updateToolbarIcon();
		}
		
		var sinceId = gTwitterBar.getSinceId(username, method);
		
		var args = [];
		
		var fullUrl = "http://api.twitter.com/1/" + url + ".json";
		if (sinceId) fullUrl += "?since_id=" + sinceId;
		
		gTwitterBar.apiRequest(fullUrl, req_callback, args, "GET", username);
	},
	
	apiRequest : function (url, callback, args, method, username) {
		gTwitterBar.log("apiRequest: " + url);
		
		if (!method) {
			method = "GET";
		}
		
		var accessor = {
			consumerSecret : gTwitterBar.oauth.consumer_secret,
			tokenSecret : gTwitterBar.get_oauth_token_secret(username)
		};
		
		var message = {
			action : url,
			method : method,
			parameters : [
				["oauth_consumer_key",gTwitterBar.oauth.consumer_key],
				["oauth_signature_method",gTwitterBar.oauth.serviceProvider.signatureMethod],
				["oauth_version","1.0"]
			]
		};
		
		var token = gTwitterBar.get_oauth_token(username);
		
		if (token) {
			message.parameters.push(["oauth_token", token]);
		}
		
		var argstring = "";
		
		if (args) {
			for (var i = 0; i < args.length; i++) {
				message.parameters.push(args[i]);
				
				if (argstring.length > 0) {
					argstring += "&";
				}
				
				argstring += encodeURIComponent(args[i][0]) + "=" + encodeURIComponent(args[i][1]);
			}
		}
		
		var OAuth = TWITTERBAR_OAUTH();
		
		OAuth.setTimestampAndNonce(message);
		OAuth.SignatureMethod.sign(message, accessor);
		
		var oAuthArgs = OAuth.getParameterMap(message.parameters);
		var authHeader = OAuth.getAuthorizationHeader("http://twitter.com/", oAuthArgs);
		
		var req = Components.classes["@mozilla.org/xmlextras/xmlhttprequest;1"]
		                    .createInstance(Components.interfaces.nsIXMLHttpRequest);
		req.mozBackgroundRequest = true;
		req.open(message.method, message.action, true);
		req.setRequestHeader("Authorization", authHeader);
		
		if (argstring) {
			req.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
			req.setRequestHeader("Content-Length", argstring.length);
		}
		else {
			argstring = null;
		}
		
		req.onreadystatechange = function () {
			if (req.readyState == 4) {
				gTwitterBar.log("apiRequest response: (" + req.status + ") " + req.responseText);
				
				if (callback) {
					callback(req);
				}
			}
		};
		
		req.send(argstring);
	},
	
	log : function (message) {
		var consoleService = Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);
		consoleService.logStringMessage("Twitter API: " + message);
	}
};

function TWITTERBAR_OAUTH() {
    var OAuth; if (OAuth == null) OAuth = {};

    OAuth.setProperties = function setProperties(into, from) {
        if (into != null && from != null) {
            for (var key in from) {
                into[key] = from[key];
            }
        }
        return into;
    }

    OAuth.setProperties(OAuth, // utility functions
    {
        percentEncode: function percentEncode(s) {
            if (s == null) {
                return "";
            }
            if (s instanceof Array) {
                var e = "";
                for (var i = 0; i < s.length; ++s) {
                    if (e != "") e += '&';
                    e += percentEncode(s[i]);
                }
                return e;
            }
            s = encodeURIComponent(s);
            // Now replace the values which encodeURIComponent doesn't do
            // encodeURIComponent ignores: - _ . ! ~ * ' ( )
            // OAuth dictates the only ones you can ignore are: - _ . ~
            // Source: http://developer.mozilla.org/en/docs/Core_JavaScript_1.5_Reference:Global_Functions:encodeURIComponent
            s = s.replace(/\!/g, "%21");
            s = s.replace(/\*/g, "%2A");
            s = s.replace(/\'/g, "%27");
            s = s.replace(/\(/g, "%28");
            s = s.replace(/\)/g, "%29");
            return s;
        }
    ,
        decodePercent: function decodePercent(s) {
            if (s != null) {
                // Handle application/x-www-form-urlencoded, which is defined by
                // http://www.w3.org/TR/html4/interact/forms.html#h-17.13.4.1
                s = s.replace(/\+/g, " ");
            }
            return decodeURIComponent(s);
        }
    ,
        /** Convert the given parameters to an Array of name-value pairs. */
        getParameterList: function getParameterList(parameters) {
            if (parameters == null) {
                return [];
            }
            if (typeof parameters != "object") {
                return decodeForm(parameters + "");
            }
            if (parameters instanceof Array) {
                return parameters;
            }
            var list = [];
            for (var p in parameters) {
                list.push([p, parameters[p]]);
            }
            return list;
        }
    ,
        /** Convert the given parameters to a map from name to value. */
        getParameterMap: function getParameterMap(parameters) {
            if (parameters == null) {
                return {};
            }
            if (typeof parameters != "object") {
                return getParameterMap(decodeForm(parameters + ""));
            }
            if (parameters instanceof Array) {
                var map = {};
                for (var p = 0; p < parameters.length; ++p) {
                    var key = parameters[p][0];
                    if (map[key] === undefined) { // first value wins
                        map[key] = parameters[p][1];
                    }
                }
                return map;
            }
            return parameters;
        }
    ,
        getParameter: function getParameter(parameters, name) {
            if (parameters instanceof Array) {
                for (var p = 0; p < parameters.length; ++p) {
                    if (parameters[p][0] == name) {
                        return parameters[p][1]; // first value wins
                    }
                }
            } else {
                return OAuth.getParameterMap(parameters)[name];
            }
            return null;
        }
    ,
        formEncode: function formEncode(parameters) {
            var form = "";
            var list = OAuth.getParameterList(parameters);
            for (var p = 0; p < list.length; ++p) {
                var value = list[p][1];
                if (value == null) value = "";
                if (form != "") form += '&';
                form += OAuth.percentEncode(list[p][0])
                  +'='+ OAuth.percentEncode(value);
            }
            return form;
        }
    ,
        decodeForm: function decodeForm(form) {
            var list = [];
            var nvps = form.split('&');
            for (var n = 0; n < nvps.length; ++n) {
                var nvp = nvps[n];
                if (nvp == "") {
                    continue;
                }
                var equals = nvp.indexOf('=');
                var name;
                var value;
                if (equals < 0) {
                    name = OAuth.decodePercent(nvp);
                    value = null;
                } else {
                    name = OAuth.decodePercent(nvp.substring(0, equals));
                    value = OAuth.decodePercent(nvp.substring(equals + 1));
                }
                list.push([name, value]);
            }
            return list;
        }
    ,
        setParameter: function setParameter(message, name, value) {
            var parameters = message.parameters;
            if (parameters instanceof Array) {
                for (var p = 0; p < parameters.length; ++p) {
                    if (parameters[p][0] == name) {
                        if (value === undefined) {
                            parameters.splice(p, 1);
                        } else {
                            parameters[p][1] = value;
                            value = undefined;
                        }
                    }
                }
                if (value !== undefined) {
                    parameters.push([name, value]);
                }
            } else {
                parameters = OAuth.getParameterMap(parameters);
                parameters[name] = value;
                message.parameters = parameters;
            }
        }
    ,
        setParameters: function setParameters(message, parameters) {
            var list = OAuth.getParameterList(parameters);
            for (var i = 0; i < list.length; ++i) {
                OAuth.setParameter(message, list[i][0], list[i][1]);
            }
        }
    ,
        /** Fill in parameters to help construct a request message.
            This function doesn't fill in every parameter.
            The accessor object should be like:
            {consumerKey:'foo', consumerSecret:'bar', accessorSecret:'nurn', token:'krelm', tokenSecret:'blah'}
            The accessorSecret property is optional.
         */
        completeRequest: function completeRequest(message, accessor) {
            if (message.method == null) {
                message.method = "GET";
            }
            var map = OAuth.getParameterMap(message.parameters);
            if (map.oauth_consumer_key == null) {
                OAuth.setParameter(message, "oauth_consumer_key", accessor.consumerKey || "");
            }
            if (map.oauth_token == null && accessor.token != null) {
                OAuth.setParameter(message, "oauth_token", accessor.token);
            }
            if (map.oauth_version == null) {
                OAuth.setParameter(message, "oauth_version", "1.0");
            }
            if (map.oauth_timestamp == null) {
                OAuth.setParameter(message, "oauth_timestamp", OAuth.timestamp());
            }
            if (map.oauth_nonce == null) {
                OAuth.setParameter(message, "oauth_nonce", OAuth.nonce(6));
            }
            OAuth.SignatureMethod.sign(message, accessor);
        }
    ,
        setTimestampAndNonce: function setTimestampAndNonce(message) {
            OAuth.setParameter(message, "oauth_timestamp", OAuth.timestamp());
            OAuth.setParameter(message, "oauth_nonce", OAuth.nonce(6));
        }
    ,
        addToURL: function addToURL(url, parameters) {
            newURL = url;
            if (parameters != null) {
                var toAdd = OAuth.formEncode(parameters);
                if (toAdd.length > 0) {
                    var q = url.indexOf('?');
                    if (q < 0) newURL += '?';
                    else       newURL += '&';
                    newURL += toAdd;
                }
            }
            return newURL;
        }
    ,
        /** Construct the value of the Authorization header for an HTTP request. */
        getAuthorizationHeader: function getAuthorizationHeader(realm, parameters) {
            var header = 'OAuth realm="' + OAuth.percentEncode(realm) + '"';
            var list = OAuth.getParameterList(parameters);
            for (var p = 0; p < list.length; ++p) {
                var parameter = list[p];
                var name = parameter[0];
                if (name.indexOf("oauth_") == 0) {
                    header += ',' + OAuth.percentEncode(name) + '="' + OAuth.percentEncode(parameter[1]) + '"';
                }
            }
            return header;
        }
    ,
        timestamp: function timestamp() {
            var d = new Date();
            return Math.floor(d.getTime()/1000);
        }
    ,
        nonce: function nonce(length) {
            var chars = OAuth.nonce.CHARS;
            var result = "";
            for (var i = 0; i < length; ++i) {
                var rnum = Math.floor(Math.random() * chars.length);
                result += chars.substring(rnum, rnum+1);
            }
            return result;
        }
    });

    OAuth.nonce.CHARS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXTZabcdefghiklmnopqrstuvwxyz";

    /** Define a constructor function,
        without causing trouble to anyone who was using it as a namespace.
        That is, if parent[name] already existed and had properties,
        copy those properties into the new constructor.
     */
    OAuth.declareClass = function declareClass(parent, name, newConstructor) {
        var previous = parent[name];
        parent[name] = newConstructor;
        if (newConstructor != null && previous != null) {
            for (var key in previous) {
                if (key != "prototype") {
                    newConstructor[key] = previous[key];
                }
            }
        }
        return newConstructor;
    }

    /** An abstract algorithm for signing messages. */
    OAuth.declareClass(OAuth, "SignatureMethod", function OAuthSignatureMethod(){});

    OAuth.setProperties(OAuth.SignatureMethod.prototype, // instance members
    {
        /** Add a signature to the message. */
        sign: function sign(message) {
            var baseString = OAuth.SignatureMethod.getBaseString(message);
            var signature = this.getSignature(baseString);
            OAuth.setParameter(message, "oauth_signature", signature);
            return signature; // just in case someone's interested
        }
    ,
        /** Set the key string for signing. */
        initialize: function initialize(name, accessor) {
            var consumerSecret;
            if (accessor.accessorSecret != null
                && name.length > 9
                && name.substring(name.length-9) == "-Accessor")
            {
                consumerSecret = accessor.accessorSecret;
            } else {
                consumerSecret = accessor.consumerSecret;
            }
            this.key = OAuth.percentEncode(consumerSecret)
                 +"&"+ OAuth.percentEncode(accessor.tokenSecret);
        }
    });

    /* SignatureMethod expects an accessor object to be like this:
       {tokenSecret: "lakjsdflkj...", consumerSecret: "QOUEWRI..", accessorSecret: "xcmvzc..."}
       The accessorSecret property is optional.
     */
    // Class members:
    OAuth.setProperties(OAuth.SignatureMethod, // class members
    {
        sign: function sign(message, accessor) {
            var name = OAuth.getParameterMap(message.parameters).oauth_signature_method;
            if (name == null || name == "") {
                name = "HMAC-SHA1";
                OAuth.setParameter(message, "oauth_signature_method", name);
            }
            OAuth.SignatureMethod.newMethod(name, accessor).sign(message);
        }
    ,
        /** Instantiate a SignatureMethod for the given method name. */
        newMethod: function newMethod(name, accessor) {
            var impl = OAuth.SignatureMethod.REGISTERED[name];
            if (impl != null) {
                var method = new impl();
                method.initialize(name, accessor);
                return method;
            }
            var err = new Error("signature_method_rejected");
            var acceptable = "";
            for (var r in OAuth.SignatureMethod.REGISTERED) {
                if (acceptable != "") acceptable += '&';
                acceptable += OAuth.percentEncode(r);
            }
            err.oauth_acceptable_signature_methods = acceptable;
            throw err;
        }
    ,
        /** A map from signature method name to constructor. */
        REGISTERED : {}
    ,
        /** Subsequently, the given constructor will be used for the named methods.
            The constructor will be called with no parameters.
            The resulting object should usually implement getSignature(baseString).
            You can easily define such a constructor by calling makeSubclass, below.
         */
        registerMethodClass: function registerMethodClass(names, classConstructor) {
            for (var n = 0; n < names.length; ++n) {
                OAuth.SignatureMethod.REGISTERED[names[n]] = classConstructor;
            }
        }
    ,
        /** Create a subclass of OAuth.SignatureMethod, with the given getSignature function. */
        makeSubclass: function makeSubclass(getSignatureFunction) {
            var superClass = OAuth.SignatureMethod;
            var subClass = function() {
                superClass.call(this);
            }; 
            subClass.prototype = new superClass();
            // Delete instance variables from prototype:
            // delete subclass.prototype... There aren't any.
            subClass.prototype.getSignature = getSignatureFunction;
            subClass.prototype.constructor = subClass;
            return subClass;
        }
    ,
        getBaseString: function getBaseString(message) {
            var URL = message.action;
            var q = URL.indexOf('?');
            var parameters;
            if (q < 0) {
                parameters = message.parameters;
            } else {
                // Combine the URL query string with the other parameters:
                parameters = OAuth.decodeForm(URL.substring(q + 1));
                var toAdd = OAuth.getParameterList(message.parameters);
                for (var a = 0; a < toAdd.length; ++a) {
                    parameters.push(toAdd[a]);
                }
            }
            return OAuth.percentEncode(message.method.toUpperCase())
             +'&'+ OAuth.percentEncode(OAuth.SignatureMethod.normalizeUrl(URL))
             +'&'+ OAuth.percentEncode(OAuth.SignatureMethod.normalizeParameters(parameters));
        }
    ,
        normalizeUrl: function normalizeUrl(url) {
            var uri = OAuth.SignatureMethod.parseUri(url);
            var scheme = uri.protocol.toLowerCase();
            var authority = uri.authority.toLowerCase();
            var dropPort = (scheme == "http" && uri.port == 80)
                        || (scheme == "https" && uri.port == 443);
            if (dropPort) {
                // find the last : in the authority
                var index = authority.lastIndexOf(":");
                if (index >= 0) {
                    authority = authority.substring(0, index);
                }
            }
            var path = uri.path;
            if (!path) {
                path = "/"; // conforms to RFC 2616 section 3.2.2
            }
            // we know that there is no query and no fragment here.
            return scheme + "://" + authority + path;
        }
    ,
        parseUri: function parseUri (str) {
            /* This function was adapted from parseUri 1.2.1
               http://stevenlevithan.com/demo/parseuri/js/assets/parseuri.js
             */
            var o = {key: ["source","protocol","authority","userInfo","user","password","host","port","relative","path","directory","file","query","anchor"],
                     parser: {strict: /^(?:([^:\/?#]+):)?(?:\/\/((?:(([^:@]*):?([^:@]*))?@)?([^:\/?#]*)(?::(\d*))?))?((((?:[^?#\/]*\/)*)([^?#]*))(?:\?([^#]*))?(?:#(.*))?)/ }};
            var m = o.parser.strict.exec(str);
            var uri = {};
            var i = 14;
            while (i--) uri[o.key[i]] = m[i] || "";
            return uri;
        }
    ,
        normalizeParameters: function normalizeParameters(parameters) {
            if (parameters == null) {
                return "";
            }
            var list = OAuth.getParameterList(parameters);
            var sortable = [];
            for (var p = 0; p < list.length; ++p) {
                var nvp = list[p];
                if (nvp[0] != "oauth_signature") {
                    sortable.push([ OAuth.percentEncode(nvp[0])
                                  + " " // because it comes before any character that can appear in a percentEncoded string.
                                  + OAuth.percentEncode(nvp[1])
                                  , nvp]);
                }
            }
            sortable.sort(function(a,b) {
                              if (a[0] < b[0]) return  -1;
                              if (a[0] > b[0]) return 1;
                              return 0;
                          });
            var sorted = [];
            for (var s = 0; s < sortable.length; ++s) {
                sorted.push(sortable[s][1]);
            }
            return OAuth.formEncode(sorted);
        }
    });

    OAuth.SignatureMethod.registerMethodClass(["PLAINTEXT", "PLAINTEXT-Accessor"],
        OAuth.SignatureMethod.makeSubclass(
            function getSignature(baseString) {
                return this.key;
            }
        ));

    OAuth.SignatureMethod.registerMethodClass(["HMAC-SHA1", "HMAC-SHA1-Accessor"],
        OAuth.SignatureMethod.makeSubclass(
            function getSignature(baseString) {
                var hexcase = 0;  /* hex output format. 0 - lowercase; 1 - uppercase        */
                var b64pad  = "="; /* base-64 pad character. "=" for strict RFC compliance   */
                var chrsz   = 8;  /* bits per input character. 8 - ASCII; 16 - Unicode      */

                /*
                 * These are the functions you'll usually want to call
                 * They take string arguments and return either hex or base-64 encoded strings
                 */
                function hex_sha1(s){return binb2hex(core_sha1(str2binb(s),s.length * chrsz));}
                function b64_sha1(s){return binb2b64(core_sha1(str2binb(s),s.length * chrsz));}
                function str_sha1(s){return binb2str(core_sha1(str2binb(s),s.length * chrsz));}
                function hex_hmac_sha1(key, data){ return binb2hex(core_hmac_sha1(key, data));}
                function b64_hmac_sha1(key, data){ return binb2b64(core_hmac_sha1(key, data));}
                function str_hmac_sha1(key, data){ return binb2str(core_hmac_sha1(key, data));}

                /*
                 * Perform a simple self-test to see if the VM is working
                 */
                function sha1_vm_test()
                {
                  return hex_sha1("abc") == "a9993e364706816aba3e25717850c26c9cd0d89d";
                }

                /*
                 * Calculate the SHA-1 of an array of big-endian words, and a bit length
                 */
                function core_sha1(x, len)
                {
                  /* append padding */
                  x[len >> 5] |= 0x80 << (24 - len % 32);
                  x[((len + 64 >> 9) << 4) + 15] = len;

                  var w = Array(80);
                  var a =  1732584193;
                  var b = -271733879;
                  var c = -1732584194;
                  var d =  271733878;
                  var e = -1009589776;

                  for(var i = 0; i < x.length; i += 16)
                  {
                    var olda = a;
                    var oldb = b;
                    var oldc = c;
                    var oldd = d;
                    var olde = e;

                    for(var j = 0; j < 80; j++)
                    {
                      if(j < 16) w[j] = x[i + j];
                      else w[j] = rol(w[j-3] ^ w[j-8] ^ w[j-14] ^ w[j-16], 1);
                      var t = safe_add(safe_add(rol(a, 5), sha1_ft(j, b, c, d)),
                                       safe_add(safe_add(e, w[j]), sha1_kt(j)));
                      e = d;
                      d = c;
                      c = rol(b, 30);
                      b = a;
                      a = t;
                    }

                    a = safe_add(a, olda);
                    b = safe_add(b, oldb);
                    c = safe_add(c, oldc);
                    d = safe_add(d, oldd);
                    e = safe_add(e, olde);
                  }
                  return Array(a, b, c, d, e);

                }

                /*
                 * Perform the appropriate triplet combination function for the current
                 * iteration
                 */
                function sha1_ft(t, b, c, d)
                {
                  if(t < 20) return (b & c) | ((~b) & d);
                  if(t < 40) return b ^ c ^ d;
                  if(t < 60) return (b & c) | (b & d) | (c & d);
                  return b ^ c ^ d;
                }

                /*
                 * Determine the appropriate additive constant for the current iteration
                 */
                function sha1_kt(t)
                {
                  return (t < 20) ?  1518500249 : (t < 40) ?  1859775393 :
                         (t < 60) ? -1894007588 : -899497514;
                }

                /*
                 * Calculate the HMAC-SHA1 of a key and some data
                 */
                function core_hmac_sha1(key, data)
                {
                  var bkey = str2binb(key);
                  if(bkey.length > 16) bkey = core_sha1(bkey, key.length * chrsz);

                  var ipad = Array(16), opad = Array(16);
                  for(var i = 0; i < 16; i++)
                  {
                    ipad[i] = bkey[i] ^ 0x36363636;
                    opad[i] = bkey[i] ^ 0x5C5C5C5C;
                  }

                  var hash = core_sha1(ipad.concat(str2binb(data)), 512 + data.length * chrsz);
                  return core_sha1(opad.concat(hash), 512 + 160);
                }

                /*
                 * Add integers, wrapping at 2^32. This uses 16-bit operations internally
                 * to work around bugs in some JS interpreters.
                 */
                function safe_add(x, y)
                {
                  var lsw = (x & 0xFFFF) + (y & 0xFFFF);
                  var msw = (x >> 16) + (y >> 16) + (lsw >> 16);
                  return (msw << 16) | (lsw & 0xFFFF);
                }

                /*
                 * Bitwise rotate a 32-bit number to the left.
                 */
                function rol(num, cnt)
                {
                  return (num << cnt) | (num >>> (32 - cnt));
                }

                /*
                 * Convert an 8-bit or 16-bit string to an array of big-endian words
                 * In 8-bit function, characters >255 have their hi-byte silently ignored.
                 */
                function str2binb(str)
                {
                  var bin = Array();
                  var mask = (1 << chrsz) - 1;
                  for(var i = 0; i < str.length * chrsz; i += chrsz)
                    bin[i>>5] |= (str.charCodeAt(i / chrsz) & mask) << (32 - chrsz - i%32);
                  return bin;
                }

                /*
                 * Convert an array of big-endian words to a string
                 */
                function binb2str(bin)
                {
                  var str = "";
                  var mask = (1 << chrsz) - 1;
                  for(var i = 0; i < bin.length * 32; i += chrsz)
                    str += String.fromCharCode((bin[i>>5] >>> (32 - chrsz - i%32)) & mask);
                  return str;
                }

                /*
                 * Convert an array of big-endian words to a hex string.
                 */
                function binb2hex(binarray)
                {
                  var hex_tab = hexcase ? "0123456789ABCDEF" : "0123456789abcdef";
                  var str = "";
                  for(var i = 0; i < binarray.length * 4; i++)
                  {
                    str += hex_tab.charAt((binarray[i>>2] >> ((3 - i%4)*8+4)) & 0xF) +
                           hex_tab.charAt((binarray[i>>2] >> ((3 - i%4)*8  )) & 0xF);
                  }
                  return str;
                }

                /*
                 * Convert an array of big-endian words to a base-64 string
                 */
                function binb2b64(binarray)
                {
                  var tab = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
                  var str = "";
                  for(var i = 0; i < binarray.length * 4; i += 3)
                  {
                    var triplet = (((binarray[i   >> 2] >> 8 * (3 -  i   %4)) & 0xFF) << 16)
                                | (((binarray[i+1 >> 2] >> 8 * (3 - (i+1)%4)) & 0xFF) << 8 )
                                |  ((binarray[i+2 >> 2] >> 8 * (3 - (i+2)%4)) & 0xFF);
                    for(var j = 0; j < 4; j++)
                    {
                      if(i * 8 + j * 6 > binarray.length * 32) str += b64pad;
                      else str += tab.charAt((triplet >> 6*(3-j)) & 0x3F);
                    }
                  }
                  return str;
                }
                
                return b64_hmac_sha1(this.key, baseString);
            }
        ));
    
        return OAuth;

};

var EXPORTED_SYMBOLS = ["gTwitterBar"];