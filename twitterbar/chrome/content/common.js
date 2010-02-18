var TWITTERBAR_COMMON = {
	accounts : {},
	currentAccount : "",
	
	get oauth_token_secret() { if (TWITTERBAR_COMMON.currentAccount in TWITTERBAR_COMMON.accounts) { return TWITTERBAR_COMMON.accounts[TWITTERBAR_COMMON.currentAccount].token_secret; } else { return ""; } },
	get oauth_token() { if (TWITTERBAR_COMMON.currentAccount in TWITTERBAR_COMMON.accounts) { return TWITTERBAR_COMMON.accounts[TWITTERBAR_COMMON.currentAccount].token; } else { return ""; } },
	
	get strings() { return document.getElementById("twitterbar-strings"); },
	prefs : Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("extensions.twitter."),
	
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
	
	load : function () {
		TWITTERBAR_COMMON.prefs.QueryInterface(Components.interfaces.nsIPrefBranch2);
		TWITTERBAR_COMMON.prefs.addObserver("", TWITTERBAR_COMMON, false);
		
		addEventListener("unload", TWITTERBAR_COMMON.unload, false);
		
		var upgraded = TWITTERBAR_COMMON.upgradeToAccounts();
		
		if (upgraded) {
			TWITTERBAR_COMMON.setUpAccount();
		}
	},
	
	unload : function () {
		removeEventListener("unload", TWITTERBAR_COMMON.unload, false);
		
		TWITTERBAR_COMMON.prefs.removeObserver("", TWITTERBAR_COMMON);
	},
	
	observe : function(subject, topic, data) {
		if (topic != "nsPref:changed") {
			return;
		}
		
		switch(data) {
			case "accounts":
				TWITTERBAR_COMMON.setUpAccount();
			break;
		}
	},
	
	setUpAccount : function () {
		var account = TWITTERBAR_COMMON.prefs.getCharPref("account");
		var accounts = TWITTERBAR_COMMON.prefs.getCharPref("accounts");
		
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
				
				TWITTERBAR_COMMON.prefs.setCharPref("account", account);
			}
		}
		else {
			accounts = {};
			TWITTERBAR_COMMON.prefs.setCharPref("account", "");
		}
		
		if (account && !(account in accounts)) {
			account = "";
			TWITTERBAR_COMMON.prefs.setCharPref("account", "");
		}
		
		TWITTERBAR_COMMON.accounts = accounts;
		TWITTERBAR_COMMON.currentAccount = account;
	},
	
	setAccount : function (username, token_secret, token) {
		var accounts = TWITTERBAR_COMMON.prefs.getCharPref("accounts");
		if (!accounts) accounts = "{}";
		accounts = JSON.parse(accounts);
		accounts[username] = {"token_secret" : token_secret, "token" : token, "timestamp" : (new Date().getTime())};
		TWITTERBAR_COMMON.accounts = accounts;
		
		if ("_twitterbar" in accounts) {
			delete accounts["_twitterbar"];
		}
		
		accounts = JSON.stringify(accounts);
		TWITTERBAR_COMMON.prefs.setCharPref("accounts", accounts);
	},
	
	unsetAccount : function (username) {
		var accounts = TWITTERBAR_COMMON.prefs.getCharPref("accounts");
		
		if (!accounts) {
			accounts = "{}";
		}
		else {
			accounts = JSON.parse(accounts);
		
			if (username in accounts) {
				delete accounts[username];
			}
		
			TWITTERBAR_COMMON.accounts = accounts;
			accounts = JSON.stringify(accounts);
		}
		
		TWITTERBAR_COMMON.prefs.setCharPref("accounts", accounts);
		
		TWITTERBAR_COMMON.setUpAccount();
	},
	
	apiRequest : function (url, callback, args, method) {
		if (TWITTERBAR.debug) {
			TWITTERBAR.log("apiRequest: " + url);
		}
		
		if (!method) {
			method = "GET";
		}
		
		var accessor = {
			consumerSecret : TWITTERBAR_COMMON.oauth.consumer_secret,
			tokenSecret : TWITTERBAR_COMMON.oauth_token_secret
		};
		
		var message = {
			action : url,
			method : method,
			parameters : [
				["oauth_consumer_key",TWITTERBAR_COMMON.oauth.consumer_key],
				["oauth_signature_method",TWITTERBAR_COMMON.oauth.serviceProvider.signatureMethod],
				["oauth_version","1.0"]
			]
		};
		
		var token = TWITTERBAR_COMMON.oauth_token;
		
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
		
		var req = new XMLHttpRequest();
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
				if (TWITTERBAR.debug) {
					TWITTERBAR.log("apiRequest response: (" + req.status + ") " + req.responseText);
				}
				
				if (callback) {
					callback(req);
				}
			}
		};
		
		req.send(argstring);
	},
	
	upgradeToAccounts : function () {
		function callback(req) {
			if (req.status == 200) {
				var json = JSON.parse(req.responseText);
				var screenname = json.screen_name;
				
				var token = TWITTERBAR_COMMON.oauth_token;
				var token_secret = TWITTERBAR_COMMON.oauth_token_secret;
				var timestamp = TWITTERBAR_COMMON.prefs.getCharPref("oauth_timestamp");
				
				var accounts = {};
				accounts[screenname] = {"token" : token, "token_secret" : token_secret, "timestamp": timestamp};
				
				var accounts_string = JSON.stringify(accounts);
				TWITTERBAR_COMMON.prefs.setCharPref("accounts", accounts_string);
				
				TWITTERBAR_COMMON.prefs.setCharPref("access_token.oauth_token", "");
				TWITTERBAR_COMMON.prefs.setCharPref("access_token.oauth_token_secret", "");
				TWITTERBAR_COMMON.prefs.setCharPref("oauth_timestamp", "");
			}
			else {
				if (req.status == 401) {
					TWITTERBAR_COMMON.prefs.setCharPref("access_token.oauth_token", "");
					TWITTERBAR_COMMON.prefs.setCharPref("access_token.oauth_token_secret", "");
					TWITTERBAR_COMMON.prefs.setCharPref("oauth_timestamp", "");
				}
			}
			
			TWITTERBAR_COMMON.setUpAccount();
		}
		
		if (
				TWITTERBAR_COMMON.prefs.getCharPref("access_token.oauth_token") || 
				TWITTERBAR_COMMON.prefs.getCharPref("access_token.oauth_token_secret") || 
				TWITTERBAR_COMMON.prefs.getCharPref("oauth_timestamp")
			) {
			if (TWITTERBAR.debug) {
				TWITTERBAR.log("Doing it.");
			}
				
			TWITTERBAR_COMMON.apiRequest("http://twitter.com/account/verify_credentials.json", callback);
			
			return false;
		}
		
		return true;
	},
	
	alert : function (msg) {
		var title = TWITTERBAR_COMMON.strings.getString("twitterbar.alertTitle");
		
		var prompts = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
								.getService(Components.interfaces.nsIPromptService);
		prompts.alert(null, title, msg);
	},
	
	confirm : function (msg) {
		var title = TWITTERBAR_COMMON.strings.getString("twitterbar.alertTitle");
		
		var prompts = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
								.getService(Components.interfaces.nsIPromptService);
		return prompts.confirm(null, title, msg);
	},
	
	confirmPost : function () {
		var title = TWITTERBAR_COMMON.strings.getString("twitterbar.alertTitle");
		var msg = TWITTERBAR_COMMON.strings.getString("twitterbar.confirmPostToTwitter");
		var cbMsg = TWITTERBAR_COMMON.strings.getString("twitterbar.confirmPrefString");
		
		var prompts = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
								.getService(Components.interfaces.nsIPromptService);

		var check = { value : TWITTERBAR_COMMON.prefs.getBoolPref("confirm") };
		var result = prompts.confirmCheck(null, title, msg, cbMsg, check);
		
		if (result) {
			TWITTERBAR_COMMON.prefs.setBoolPref("confirm", check.value);
			return true;
		}
		
		return false;
	},

	getTrends : function () {
		var lastUpdate = TWITTERBAR_COMMON.prefs.getCharPref("trends.update");
		var trends = TWITTERBAR_COMMON.prefs.getCharPref("trends");

		if (trends == "" || (new Date().getTime()) - lastUpdate > (1000 * 60 * 60 * 1.8)) {
			var feedUrl = "http://www.oneriot.com/rss/trendingtopics";

			var req = new XMLHttpRequest();
			req.open("GET", feedUrl, true);

			req.onreadystatechange = function () {
				if (req.readyState == 4) {
					if (req.status == 200) {
						var ioService = Components.classes["@mozilla.org/network/io-service;1"]
										.getService(Components.interfaces.nsIIOService);
						var data = req.responseText;
						var uri = ioService.newURI(feedUrl, null, null);

						if (data.length) {
							var parser = Components.classes["@mozilla.org/feed-processor;1"]
											.createInstance(Components.interfaces.nsIFeedProcessor);
							var listener = TWITTERBAR_COMMON;

							try {
								parser.listener = listener;
								parser.parseFromString(data, uri);
							} catch (e) {
							}
						}
					}
				}
			};

			req.send(null);
		}
	},

	handleResult: function(result) {
		TWITTERBAR_COMMON.prefs.setCharPref("trends.update", new Date().getTime());

		if (result.bozo) {
			return;
		}

		var feed = result.doc;

		if (!feed) {
			return;
		}

		try {
			feed.QueryInterface(Components.interfaces.nsIFeed);
		} catch (e) {
			return;
		}

		var numItems = Math.min(10, feed.items.length);

		var trends = [];

		for (var i = 0; i < numItems; i++) {
			var item = feed.items.queryElementAt(i, Components.interfaces.nsIFeedEntry);
			trends.push(item.title.plainText());
		}

		delete result;

		TWITTERBAR_COMMON.prefs.setCharPref("trends", trends.join("\t"));
	},
	
	addTrends : function (page) {
		// Check for the trending topics.
		var trends = page.getElementById("trends");

		if (trends) {
			var topics = TWITTERBAR_COMMON.prefs.getCharPref("trends").split("\t");
	
			if (topics) {
				var str = '<h2 id="twitterbar-trends" class="sidebar-title" style="background: transparent !important;"><span title="'+this.strings.getString("twitterbar.trends.byline")+'">'+this.strings.getString("twitterbar.trends.title")+'</span></h2>';
				str += '<ul class="sidebar-menu more-trends-links">';
		
				var limit = Math.min(10, topics.length);
		
				for (var i = 0; i < topics.length; i++) {
					str += '<li class="link-title"><a target="_blank" title="'+topics[i]+'" href="'+TWITTERBAR_COMMON.getSearchURL(topics[i], "trends-sidebar")+'"><span>'+topics[i]+'</span></a></li>';
				}
	
				str += '<li><small style="display: block; padding: 5px 14px 5px 14px;">'+this.strings.getString("twitterbar.trends.explanation")+'</small></li>';
				str += '</ul>';
				str += '<hr />';

				trends.innerHTML += str;
			}
		}
	},
	
	getSearchURL : function (search_terms, source) {
		search_terms = encodeURIComponent(search_terms);
		search_terms = search_terms.replace(/%20/g, "+");
		
		if (!source) { 
			source = "browserBox";
		}
		
		return "http://www.oneriot.com/search?q=" + search_terms + "&format=html&ssrc="+source+"&spid=86f2f5da-3b24-4a87-bbb3-1ad47525359d&p=twitterbar-ff/"+TWITTERBAR.version;
	}
};