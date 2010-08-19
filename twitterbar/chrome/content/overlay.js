var TWITTERBAR = {
	/**
	 * The Twitter username of the currently active account.
	 */
	currentAccount : "",
	
	/**
	 * A dict of all of the authorized accounts.  A shortcut to the stored data in the prefs system.
	 */
	accounts : {},
	
	/**
	 * An array of pending messages to be sent to Twitter of the format:
	 * [ ["screenname1", "Message 1"], ["screenname2", "Message 2"] ]
	 */
	pendingTweets : [],
	
	/**
	 * A shortcut to the debug pref. Enable to get debugging information.
	 */
	debug : false,
	
	/**
	 * Stores the last sent message in the case that the authorization workflow kicks in.
	 */
	lastTweet : null,
	
	/**
	 * Whether to hide the fact that a message is being sent.  Used after authorization.
	 */
	covertMode : false,
	
	/**
	 * The current version of TwitterBar, cached after the initial async call.
	 */
	version : null,
	
	/**
	 * Whatever the user replaced when they started typing their message.
	 */
	lastUrl : null,
	
	/**
	 * Shortcut to the stringbundle.
	 */
	get strings() { return document.getElementById("twitterbar-strings"); },
	
	/**
	 * Token secret for the currently selected account.
	 */
	get oauth_token_secret() { if (TWITTERBAR.currentAccount in TWITTERBAR.accounts) { return TWITTERBAR.accounts[TWITTERBAR.currentAccount].token_secret; } else { return ""; } },
	
	/**
	 * Token for the currently selected account.
	 */
	get oauth_token() { if (TWITTERBAR.currentAccount.toLowerCase() in TWITTERBAR.accounts) { return TWITTERBAR.accounts[TWITTERBAR.currentAccount.toLowerCase()].token; } else { return ""; } },
	
	/**
	 * OAuth data for Twitter.
	 */
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
	 * Sets up the object, but without any UI or prompts.
	 */
	
	loadBasic : function (e) {
		TWITTERBAR.load(e, true);
		
		removeEventListener("load", TWITTERBAR.loadBasic, false);
	},
	
	_currentTitle : null,
	_currentURL : null,
	
	get currentTitle() { if (typeof messageManager != 'undefined') { return TWITTERBAR._currentTitle; } else { return content.document.title; } },
	get currentURL() { if (typeof messageManager != 'undefined') { return TWITTERBAR._currentURL; } else { return content.document.location.href; } },
	set currentTitle(val) { TWITTERBAR._currentTitle = val; },
	set currentURL(val) { TWITTERBAR._currentURL = val; },
	
	/**
	 * Initializes important aspects for functionality.
	 */
	
	load : function (e, basic) {
		if (!basic) removeEventListener("load", TWITTERBAR.load, false);
		
		if (typeof messageManager != 'undefined') {
			messageManager.addMessageListener("TwitterBar:PageChange", TWITTERBAR.pageChange);
			messageManager.addMessageListener("TwitterBar:NewToken", TWITTERBAR.newToken);
			messageManager.addMessageListener("TwitterBar:TrendRequest", TWITTERBAR.returnTrends);
			
			messageManager.loadFrameScript("chrome://twitterbar/content/content_script.js", true);
		}
		
		TWITTERBAR.prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("extensions.twitter.");	
		TWITTERBAR.prefs.QueryInterface(Components.interfaces.nsIPrefBranch2);
		TWITTERBAR.prefs.addObserver("", TWITTERBAR, false);
		
		TWITTERBAR.debug = TWITTERBAR.prefs.getBoolPref("debug");
		
		if (basic) {
			TWITTERBAR.setUpAccount();
		}
		else {
			var upgraded = TWITTERBAR.upgradeToAccounts();

			if (upgraded) {
				TWITTERBAR.setUpAccount();
			}
			
			// Get new trends every 2 hours.
			TWITTERBAR.trendTimer = setInterval(TWITTERBAR.getTrends, 1000 * 60 * 60 * 2);
		
			setTimeout(TWITTERBAR.getTrends, 1000 * 10);
			
			TWITTERBAR.showFirstRun();
			
			/*
			if (!TWITTERBAR.prefs.getBoolPref("onetime.follow")) {
				for (var i in TWITTERBAR.accounts) {
					if (TWITTERBAR.accounts[i].token) {
						if (Math.random() < 0.3) {
							TWITTERBAR_UI.follow();
						}
						
						break;
					}
				}
			}
			*/
		}
		
		addEventListener("unload", TWITTERBAR.unload, false);
	},
	
	pageChange : function (message) {
		TWITTERBAR.currentTitle  = message.json.title;
		TWITTERBAR.currentURL = message.json.url;
	},
	
	/**
	 * Clears listeners and observers.
	 */
	
	unload : function () {
		removeEventListener("unload", TWITTERBAR.unload, false);
		
		TWITTERBAR.prefs.removeObserver("", TWITTERBAR);
		
		clearInterval(TWITTERBAR.trendTimer);
	},
	
	/**
	 * Pref observer for instantly applied pref changes.
	 */
	observe : function(subject, topic, data) {
		if (topic != "nsPref:changed") {
			return;
		}
		
		switch(data) {
			case "button":
			case "oneriotButton":
				// Iterate over all the windows and show/hide the button based on pref-hide-button
				var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
				                   .getService(Components.interfaces.nsIWindowMediator);
				var enumerator = wm.getEnumerator(null);
				
				while(enumerator.hasMoreElements()) {
					var win = enumerator.getNext();
					
					try {
						win.TWITTERBAR_UI.buttonCheck();
					} catch (e) {
					}
				}
			break;
			case "debug":
				TWITTERBAR.debug = TWITTERBAR.prefs.getBoolPref("debug");
			break;
			case "accounts":
				TWITTERBAR.setUpAccount();
			break;
		}
	},
	
	getVersion : function (callback) {
		var addonId = "{1a0c9ebe-ddf9-4b76-b8a3-675c77874d37}";
		
		if ("@mozilla.org/extensions/manager;1" in Components.classes) {
			// < Firefox 4
			var version = Components.classes["@mozilla.org/extensions/manager;1"]
				.getService(Components.interfaces.nsIExtensionManager).getItemForID(addonId).version;
			
			TWITTERBAR.version = version;
			callback(version);
		}
		else {
			// Firefox 4.
			Components.utils.import("resource://gre/modules/AddonManager.jsm");  
			
			AddonManager.getAddonByID(addonId, function (addon) {
				TWITTERBAR.version = addon.version;
				
				callback(addon.version);
			});
		}
	},
	
	showFirstRun : function () {
		function isMajorUpdate(version1, version2) {
			if (!version1) {
				return true;
			}
			else {
				var oldParts = version1.split(".");
				var newParts = version2.split(".");
		
				if (newParts[0] != oldParts[0] || newParts[1] != oldParts[1]) {
					return true;
				}
			}
			
			return false;
		}
		
		function doShowFirstRun(version) {
			if (isMajorUpdate(TWITTERBAR.prefs.getCharPref("version"), version)) {
				TWITTERBAR_UI.showFirstRun(version);
			}
			
			TWITTERBAR.prefs.setCharPref("version", version);
		}
		
		TWITTERBAR.getVersion(doShowFirstRun);
	},
	
	setUpAccount : function () {
		var account = TWITTERBAR.prefs.getCharPref("account").toLowerCase();;
		var accounts = TWITTERBAR.prefs.getCharPref("accounts");
		
		if (accounts) {
			accounts = JSON.parse(accounts);
			
			var newAccounts = {};
			
			for (var i in accounts) {
				newAccounts[i.toLowerCase()] = accounts[i];
			}
			
			accounts = newAccounts;
			
			if (!(account in accounts)) {
				account = "";
			}
			
			if (!account) {
				for (var i in accounts) {
					account = i;
					break;
				}
				
				TWITTERBAR.prefs.setCharPref("account", account);
			}
		}
		else {
			accounts = {};
			TWITTERBAR.prefs.setCharPref("account", "");
		}
		
		if (account && !(account in accounts)) {
			account = "";
			TWITTERBAR.prefs.setCharPref("account", "");
		}
		
		TWITTERBAR.accounts = accounts;
		TWITTERBAR.currentAccount = account.toLowerCase();
	},
	
	setAccount : function (username, token_secret, token) {
		var accounts = TWITTERBAR.prefs.getCharPref("accounts");
		if (!accounts) accounts = "{}";
		accounts = JSON.parse(accounts);
		accounts[username.toLowerCase()] = {"token_secret" : token_secret, "token" : token, "timestamp" : (new Date().getTime())};
		TWITTERBAR.accounts = accounts;
		
		if ("_twitterbar" in accounts) {
			delete accounts["_twitterbar"];
		}
		
		accounts = JSON.stringify(accounts);
		TWITTERBAR.prefs.setCharPref("accounts", accounts);
	},
	
	unsetAccount : function (username) {
		username = username.toLowerCase();
		
		var accounts = TWITTERBAR.prefs.getCharPref("accounts");
		
		if (!accounts) {
			accounts = "{}";
		}
		else {
			accounts = JSON.parse(accounts);
			
			var newAccounts = {};
			
			for (i in accounts) {
				newAccounts[i.toLowerCase()] = accounts[i];
			}
			
			accounts = newAccounts;
			
			if (username in accounts) {
				delete accounts[username];
			}
			
			TWITTERBAR.accounts = accounts;
			accounts = JSON.stringify(accounts);
		}
		
		TWITTERBAR.prefs.setCharPref("accounts", accounts);
		
		TWITTERBAR.setUpAccount();
	},
	
	apiRequest : function (url, callback, args, method) {
		if (TWITTERBAR.debug) {
			TWITTERBAR.log("apiRequest: " + url);
		}
		
		if (!method) {
			method = "GET";
		}
		
		var accessor = {
			consumerSecret : TWITTERBAR.oauth.consumer_secret,
			tokenSecret : TWITTERBAR.oauth_token_secret
		};
		
		var message = {
			action : url,
			method : method,
			parameters : [
				["oauth_consumer_key",TWITTERBAR.oauth.consumer_key],
				["oauth_signature_method",TWITTERBAR.oauth.serviceProvider.signatureMethod],
				["oauth_version","1.0"]
			]
		};
		
		var token = TWITTERBAR.oauth_token;
		
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
				
				var token = TWITTERBAR.oauth_token;
				var token_secret = TWITTERBAR.oauth_token_secret;
				var timestamp = TWITTERBAR.prefs.getCharPref("oauth_timestamp");
				
				var accounts = {};
				accounts[screenname.toLowerCase()] = {"token" : token, "token_secret" : token_secret, "timestamp": timestamp};
				
				var accounts_string = JSON.stringify(accounts);
				TWITTERBAR.prefs.setCharPref("accounts", accounts_string);
			}
			
			TWITTERBAR.setUpAccount();
		}
		
		if (
				TWITTERBAR.prefs.getCharPref("access_token.oauth_token") || 
				TWITTERBAR.prefs.getCharPref("access_token.oauth_token_secret") || 
				TWITTERBAR.prefs.getCharPref("oauth_timestamp")
			) {
			TWITTERBAR.accounts["_twitterbar"] = {"token" : TWITTERBAR.prefs.getCharPref("access_token.oauth_token"), "token_secret" : TWITTERBAR.prefs.getCharPref("access_token.oauth_token_secret")};
			TWITTERBAR.currentAccount = "_twitterbar";
				
			TWITTERBAR.apiRequest("http://twitter.com/account/verify_credentials.json", callback);
			
			TWITTERBAR.prefs.setCharPref("access_token.oauth_token", "");
			TWITTERBAR.prefs.setCharPref("access_token.oauth_token_secret", "");
			TWITTERBAR.prefs.setCharPref("oauth_timestamp", "");
			
			return false;
		}
		
		return true;
	},
	
	confirmPost : function () {
		var title = TWITTERBAR.strings.getString("twitterbar.alertTitle");
		var msg = TWITTERBAR.strings.getString("twitterbar.confirmPostToTwitter");
		var cbMsg = TWITTERBAR.strings.getString("twitterbar.confirmPrefString");
		
		var prompts = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
								.getService(Components.interfaces.nsIPromptService);

		var check = { value : TWITTERBAR.prefs.getBoolPref("confirm") };
		var result = prompts.confirmCheck(null, title, msg, cbMsg, check);
		
		if (result) {
			TWITTERBAR.prefs.setBoolPref("confirm", check.value);
			return true;
		}
		
		return false;
	},
	
	newToken : function (message) {
		var token = message.json.token;
		
		function callback(req) {
			if (req.status == 200) {
				try {
					var parts = req.responseText.split("&");
					
					var token = parts[0].split("=")[1];
					var token_secret = parts[1].split("=")[1];
					
					TWITTERBAR.accounts["_twitterbar"] = {"token" : token, "token_secret" : token_secret};
					TWITTERBAR.currentAccount = "_twitterbar";
					
					function callback(req) {
						var json = JSON.parse(req.responseText);
						var username = json.screen_name;
						
						TWITTERBAR.setAccount(username, token_secret, token);
						
						TWITTERBAR.currentAccount = username.toLowerCase();
						
						if (TWITTERBAR.lastTweet) {
							TWITTERBAR.covertMode = true;
							TWITTERBAR.postRequest(TWITTERBAR.lastTweet);
						}
					}
					
					TWITTERBAR.apiRequest("http://twitter.com/account/verify_credentials.json", callback);
				} catch (e) {
					TWITTERBAR.alert(TWITTERBAR.strings.getFormattedString("twitterbar.otherError", [ e, req.responseText ]));
					TWITTERBAR.postNextTweet();
				}
			}
			else if (req.status >= 500) {
				TWITTERBAR.alert(TWITTERBAR.strings.getString("twitterbar.failWhale"));
				TWITTERBAR.pendingTweets = [];
				
				TWITTERBAR_UI.setStatusText(TWITTERBAR.lastTweet);
				TWITTERBAR_UI.setStatusMessage();
			}
			else {
				TWITTERBAR.alert(TWITTERBAR.strings.getFormattedString("twitterbar.otherError", [ req.status, req.responseText ]));
				TWITTERBAR.pendingTweets = [];
				
				TWITTERBAR_UI.setStatusText(TWITTERBAR.lastTweet);
				TWITTERBAR_UI.setStatusMessage();
			}
		}
		
		TWITTERBAR.accounts["_twitterbar"] = {"token" : token, "token_secret" : ""};
		TWITTERBAR.currentAccount = "_twitterbar";
		
		TWITTERBAR.apiRequest(TWITTERBAR.oauth.serviceProvider.accessTokenURL, callback);
	},
	
	DOMContentLoaded : function (event) {
		if (event.originalTarget instanceof HTMLDocument) {
			var page = event.originalTarget;
			
			if (page.location && page.location.href.match(/chrisfinke.com\/oauth\/twitterbar/i)) {
				var urlArgs = page.location.href.split("?")[1].split("&");
				
				var token = "";
				
				for (var i = 0; i < urlArgs.length; i++) {
					var argParts = urlArgs[i].split("=");
					
					if (argParts[0] == "oauth_token"){
						token = argParts[1];
					}
				}
				
				function callback(req) {
					if (req.status == 200) {
						try {
							var parts = req.responseText.split("&");
							
							var token = parts[0].split("=")[1];
							var token_secret = parts[1].split("=")[1];
							
							TWITTERBAR.accounts["_twitterbar"] = {"token" : token, "token_secret" : token_secret};
							TWITTERBAR.currentAccount = "_twitterbar";
							
							function callback(req) {
								var json = JSON.parse(req.responseText);
								var username = json.screen_name;
								
								TWITTERBAR.setAccount(username, token_secret, token);
								
								TWITTERBAR.currentAccount = username.toLowerCase();
								
								if (TWITTERBAR.lastTweet) {
									TWITTERBAR.covertMode = false;
									TWITTERBAR.postRequest(TWITTERBAR.lastTweet);
								}
								else {
									TWITTERBAR_UI.setBusy(false);
									TWITTERBAR_UI.setStatusMessage();
								}
							}
							
							TWITTERBAR.apiRequest("http://twitter.com/account/verify_credentials.json", callback);
						} catch (e) {
							TWITTERBAR.alert(TWITTERBAR.strings.getFormattedString("twitterbar.otherError", [ e, req.responseText ]));
							TWITTERBAR.postNextTweet();
						}
					}
					else if (req.status >= 500) {
						TWITTERBAR.alert(TWITTERBAR.strings.getString("twitterbar.failWhale"));
						TWITTERBAR.pendingTweets = [];
						
						TWITTERBAR_UI.setStatusText(TWITTERBAR.lastTweet);
						TWITTERBAR_UI.setStatusMessage();
					}
					else {
						TWITTERBAR.alert(TWITTERBAR.strings.getFormattedString("twitterbar.otherError", [ req.status, req.responseText ]));
						TWITTERBAR.pendingTweets = [];
						
						TWITTERBAR_UI.setStatusText(TWITTERBAR.lastTweet);
						TWITTERBAR_UI.setStatusMessage();
					}
				}
				
				TWITTERBAR.accounts["_twitterbar"] = {"token" : token, "token_secret" : ""};
				TWITTERBAR.currentAccount = "_twitterbar";
				
				TWITTERBAR.apiRequest(TWITTERBAR.oauth.serviceProvider.accessTokenURL, callback);
			}
			else if (TWITTERBAR.prefs.getBoolPref("showTrends")) {
				try {
					if (!page.location.host.match(/^twitter\.com$/)) {
						return;
					}
				} catch (e) {
					return;
				}
				
				TWITTERBAR.addTrends(page);
			}
		}
	},
	
	focus : function () {
		var status = TWITTERBAR_UI.getStatusText();
		
		if (status.match(/^https?:\/\//i)) {
			TWITTERBAR.lastUrl = status;
		}
		
		TWITTERBAR_UI.focus();
	},
	
	blur : function () {
		TWITTERBAR_UI.blur();
	},
	
	reAuthorize : function () {
		TWITTERBAR.addAccount();
	},
	
	addAccount : function (hidePrompt) {
		if (hidePrompt) {
			TWITTERBAR_UI.showWeb();
			
			TWITTERBAR_UI.setBusy(true);
			TWITTERBAR_UI.setStatusMessage(TWITTERBAR.strings.getString("twitterbar.addingAccount"));
		}
		
		TWITTERBAR_UI.addingAccount();
		
		var lastAccount = TWITTERBAR.currentAccount;
		
		TWITTERBAR.accounts["_twitterbar"] = {"token" : "", "token_secret" : ""};
		TWITTERBAR.currentAccount = "_twitterbar";
		
		TWITTERBAR.oAuthorize(hidePrompt, lastAccount);
	},
	
	search : function (event, source) {
		var status = TWITTERBAR_UI.getStatusText();
		
		if (status.match(/^(https?:\/\/[^\s]+)$/ig)) {
			var search_terms = status;
		}
		else {
			var search_terms = status.replace(/https?:\/\/[^\s]+/ig, "");
		}

		search_terms = search_terms.replace(" --search", "");
		
		TWITTERBAR_UI.openUILink(TWITTERBAR.getSearchURL(search_terms, source), event, false, true);
	},
	
	oAuthorize : function (hidePrompt, lastAccount) {
		function callback(req) {
			if (req.status == 200) {
				var parts = req.responseText.split("&");
			
				try {
					TWITTERBAR.oauth.request_token.oauth_token = parts[0].split("=")[1];
					TWITTERBAR.oauth.request_token.oauth_token_secret = parts[1].split("=")[1];
					
					// @here
					//TWITTERBAR_UI.setStatusText(TWITTERBAR.lastUrl);
					
					var message = "";
					
					if (!lastAccount || lastAccount == "_twitterbar") {
						message = TWITTERBAR.strings.getString("twitterbar.oauthRequest1");
					}
					else {
						message = TWITTERBAR.strings.getFormattedString("twitterbar.oauthRequest1a", [ lastAccount ]);
					}
					
					message += "\n\n";
					message += TWITTERBAR.strings.getString("twitterbar.oauthRequest2");
					
					if (hidePrompt || (TWITTERBAR.confirm(message))) {
						TWITTERBAR_UI.addTab("http://twitter.com/oauth/authorize?oauth_token="+TWITTERBAR.oauth.request_token.oauth_token);
					}
					else if (!hidePrompt) {
						TWITTERBAR.afterPost(true);
					}
				} catch (e) {
					TWITTERBAR.alert(TWITTERBAR.strings.getString("twitterbar.oauthError1") + "\n\n" + e + "\n\n" + req.responseText);
					TWITTERBAR.postNextTweet();
				}
			}
			else if (req.status >= 500) {
				TWITTERBAR.alert(TWITTERBAR.strings.getString("twitterbar.failWhale"));
				TWITTERBAR.pendingTweets = [];
				
				if (hidePrompt) {
					TWITTERBAR_UI.setStatusText("");
					TWITTERBAR_UI.closeTab();
				}
				else {
					TWITTERBAR_UI.setStatusText(TWITTERBAR.lastTweet);
					TWITTERBAR_UI.setStatusMessage();
				}
				
				TWITTERBAR_UI.setBusy(false);
			}
			else {
				TWITTERBAR.alert(TWITTERBAR.strings.getFormattedString("twitterbar.otherError", [ req.status, req.responseText ]));
				TWITTERBAR.pendingTweets = [];
				
				if (hidePrompt) {
					TWITTERBAR_UI.setStatusText("");
					TWITTERBAR_UI.closeTab();
				}
				else {
					TWITTERBAR_UI.setStatusText(TWITTERBAR.lastTweet);
					TWITTERBAR_UI.setStatusMessage();
				}
				
				TWITTERBAR_UI.setBusy(false);
			}
		}
		
		TWITTERBAR.apiRequest(TWITTERBAR.oauth.serviceProvider.requestTokenURL, callback);
	},
	
	post : function (clickedOnButton) {
		if (clickedOnButton && TWITTERBAR.prefs.getBoolPref("confirm")) {
			if (!TWITTERBAR.confirmPost()) {
				return;
			}
		}
		
		var status = TWITTERBAR_UI.getStatusText();
		
		TWITTERBAR.startPost(status);
	},
	
	postRequest : function (status) {
		if (TWITTERBAR.debug) {
			TWITTERBAR.log("postRequest: " + status);
		}
		
		TWITTERBAR.lastTweet = status;
		
		if (!TWITTERBAR.oauth_token || !TWITTERBAR.oauth_token_secret) {
			TWITTERBAR_UI.setBusy(false);
			TWITTERBAR.reAuthorize();
			return;
		}
		
		if (status.length > 140) {
			if (!TWITTERBAR.confirm(
				TWITTERBAR.strings.getFormattedString("twitterbar.tooLong", [status.length]))) {
				TWITTERBAR.pendingTweets = [];
				TWITTERBAR.afterPost(true);
				return;
			}
		}
		
		var args = [
				["source","twitterbar"],
				["status", status]
			];
		
		function callback(req) {
			if (req.status != 200 || TWITTERBAR.covertMode) {
				TWITTERBAR_UI.setBusy(false);
			}
			
			if (req.status == 401) {
				if (req.responseText.indexOf("expired") != -1) {
					TWITTERBAR.reAuthorize();
				}
				else {
					TWITTERBAR.alert(TWITTERBAR.strings.getFormattedString("twitterbar.twitterError", [ req.status, req.responseText ]));
					TWITTERBAR.pendingTweets = [];
					
					TWITTERBAR_UI.setStatusText(TWITTERBAR.lastTweet);
					TWITTERBAR_UI.setStatusMessage();
				}
				
				// I think Twitter sends a 401 when you've hit your rate limit.
				// This is the reason so many people complained about being asked to reauthorize.
			}
			else if (req.status >= 500) {
				TWITTERBAR.alert(TWITTERBAR.strings.getString("twitterbar.failWhale"));
				TWITTERBAR.pendingTweets = [];
				
				TWITTERBAR_UI.setStatusText(TWITTERBAR.lastTweet);
				TWITTERBAR_UI.setStatusMessage();
			}
			else if (req.status == 200) {
				TWITTERBAR.lastTweet = null;
				
				if (!TWITTERBAR.covertMode || TWITTERBAR.pendingTweets.length == 0) {
					var json = JSON.parse(req.responseText);

					TWITTERBAR_UI.setBusy(false);
					
					TWITTERBAR_UI.setStatusMessage(TWITTERBAR.strings.getString("twitterbar.success"));

					setTimeout(function () { TWITTERBAR.afterPost(false, json.user.screen_name); }, 3000);
				}
				else if (TWITTERBAR.pendingTweets.length > 0) {
					TWITTERBAR.postNextTweet();
				}
			}
			else {
				TWITTERBAR.alert(TWITTERBAR.strings.getFormattedString("twitterbar.otherError", [ req.status, req.responseText ]));
				TWITTERBAR.pendingTweets = [];
				
				TWITTERBAR_UI.setStatusText(TWITTERBAR.lastTweet);
				TWITTERBAR_UI.setStatusMessage();
			}
			
			TWITTERBAR.covertMode = false;
		}
		
		TWITTERBAR.apiRequest("http://twitter.com/statuses/update.json", callback, args, "POST");
	},
	
	afterPost : function (noSuccess, screenname) {
		if (TWITTERBAR.pendingTweets.length > 0) {
			TWITTERBAR.postNextTweet();
		}
		else {
			TWITTERBAR_UI.setStatusMessage();
			
			if (!noSuccess && TWITTERBAR.prefs.getBoolPref("tab")){
				var url = "http://twitter.com/";
			
				if (screenname) {
					url += screenname;
				}
				
				TWITTERBAR_UI.addTab(url);
			}
			
			TWITTERBAR_UI.setBusy(false);
		}
	},
	
	getCharCount : function (status) {
		if (!status) {
			var status = TWITTERBAR_UI.getStatusText();
		}
		
		if (status.match(/^https?:\/\//i)) {
			status = TWITTERBAR.prefs.getCharPref("web").replace(/^\s+|\s+$/, "") + " " + status;
		}
		
		status = status.split(" --@")[0];
		status = status.replace(/\$\$/g, TWITTERBAR.currentTitle);
		
		var length = status.length;
		
		var offset = 0;
		
		var urls = status.match(/(https?:\/\/[^\s]+)/ig);
		
		if (urls) {
			for (var i = 0; i < urls.length; i++) {
				var urlLength = TWITTERBAR_SHORTENERS.getUrlLength(urls[i]);
				
				if (urls[i].length > urlLength) {
					offset += (urls[i].length - urlLength);
				}
			}
		}
		
		length -= offset;
		
		return length;
	},
	
	postKey : function (e) {
		var keyCode = null;
		
		if (e) {
			keyCode = e.keyCode;
		}
		
		if (!e || (keyCode != e.DOM_VK_RETURN && keyCode != 27 && keyCode != 117 && keyCode != 76 && keyCode != 68 && keyCode != 17 && keyCode != 18)){
			var status = TWITTERBAR_UI.getStatusText();
			
			if (status.indexOf("--") != -1) {
				if (status.indexOf(" --post") != -1){
					var status = status.split(" --post")[0];
				
					TWITTERBAR.startPost(status);
				}
				else if (status.indexOf("--account") != -1) {
					TWITTERBAR_UI.setStatusText(TWITTERBAR.lastUrl);

					TWITTERBAR.currentAccount = "";
				
					TWITTERBAR.addAccount(true);
				}
				else if (status.indexOf("--options") != -1){
					TWITTERBAR_UI.setStatusText(TWITTERBAR.lastUrl);
				
					TWITTERBAR_UI.openOptions();
				}
				else if (status.indexOf(" --search") != -1) {
					TWITTERBAR.search(null, "addressBarText");
				}
			}
		}
		
		TWITTERBAR_UI.keyDown();
	},
	
	startPost : function (status) {
		TWITTERBAR_UI.setStatusText(TWITTERBAR.lastUrl);
		
		var account = "";
		var accounts = [];
		
		if (status.indexOf(" --@") != -1) {
			parts = status.split(" --@");
			
			status = parts[0].replace(/^\s+|\s+$/g, "");
			
			for (var i = 1; i < parts.length; i++) {
				accounts.push(parts[i].replace(/^\s+|\s+$/g, "").toLowerCase());
			}
			
			TWITTERBAR.currentAccount = accounts[0].toLowerCase();
		}
		
		if (status.match(/^https?:\/\//i)) {
			var webtext = (TWITTERBAR.prefs.getCharPref("web").replace(/^\s+|\s+$/, "") + " ");
			status = webtext + status;
		}
		
		if (status.indexOf("$$") != -1) {
			var currentLength = TWITTERBAR.getCharCount(status);
			
			var pageTitle = TWITTERBAR.currentTitle;
			
			if (currentLength > 140 && pageTitle.indexOf(" ") != -1) {
				// Truncate the page title to make it fit.
				var charactersToLose = currentLength - 140;
				charactersToLose += 3; // ...
				charactersToLose -= 2; // $$
				
				pageTitle = pageTitle.substring(0, pageTitle.length - charactersToLose);
				
				if (pageTitle.indexOf(" ") != -1) {
					pageTitle = pageTitle.split(" ");
					pageTitle.pop();
					pageTitle = pageTitle.join(" ") + "...";
				}
				else {
					pageTitle = TWITTERBAR.currentTitle;
				}
			}
			
			status = status.replace(/\$\$/g, pageTitle);
		}
		
		TWITTERBAR_UI.setStatusMessage(TWITTERBAR.strings.getString("twitterbar.posting"));
		
		if (accounts.length > 0) {
			account = accounts[0];
		}
		
		if (!account) {
			var accounts = TWITTERBAR.accounts;
			var lastAccount = "";
			
			var j = 0;
			
			for (var i in accounts) {
				lastAccount = i;
				j++;
			}
			
			if (j == 0) {
				account = "_twitterbar";
				TWITTERBAR.accounts["_twitterbar"] = {"token" : "", "token_secret" : ""};
				
				TWITTERBAR.pendingTweets.push([ account, status ]);
			}
			else if (j == 1) {
				account = lastAccount;
				
				TWITTERBAR.pendingTweets.push([ account, status ]);
			}
			else {
				var rv = [];
				
				window.openDialog('chrome://twitterbar/content/dialogs/accountPrompt.xul','twitterbar-prompt','chrome,modal', accounts, rv, TWITTERBAR.currentAccount);
				
				if (rv.length == 0) {
					TWITTERBAR_UI.setStatusText(status);
					
					return;
				}
				else {
					for (var i = 0; i < rv.length; i++) {
						TWITTERBAR.pendingTweets.push([ rv[i], status ]);
					}
				}
			}
		}
		else {
			for (var i = 0; i < accounts.length; i++) {
				TWITTERBAR.pendingTweets.push([ accounts[i], status ]);
			}
		}
		
		TWITTERBAR.postNextTweet();
	},
	
	postNextTweet : function () {
		if (TWITTERBAR.pendingTweets.length > 0) {
			TWITTERBAR_UI.setStatusMessage(TWITTERBAR.strings.getString("twitterbar.posting"));
			
			var pair = TWITTERBAR.pendingTweets.shift();
			
			TWITTERBAR.currentAccount = pair[0].toLowerCase();
			var account = TWITTERBAR.currentAccount;
			
			var status = pair[1];
			
			if (account != "_twitterbar") {
				TWITTERBAR_UI.setStatusMessage(TWITTERBAR.strings.getFormattedString("twitterbar.postingToAccount", [ account ]));
			}
			
			TWITTERBAR_UI.setBusy(true);
			
			TWITTERBAR_SHORTENERS.shortenUrls(status, function (status) { TWITTERBAR.postRequest(status); });
		}
	},
	
	followTwtrbar : function () {
		var accounts = TWITTERBAR.accounts;
		
		for (var i in accounts) {
			TWITTERBAR.currentAccount = i.toLowerCase();
			TWITTERBAR.apiRequest("http://twitter.com/friendships/create/twtrbar.json", false, false, "POST");
		}
	},
	
	log : function (message) {
		var consoleService = Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);
		consoleService.logStringMessage("TWITTERBAR: " + message);
	},
	
	getSearchURL : function (search_terms, source) {
		search_terms = encodeURIComponent(search_terms);
		search_terms = search_terms.replace(/%20/g, "+");
		
		if (!source) { 
			source = "browserBox";
		}
		
		return "http://www.oneriot.com/search?q=" + search_terms + "&format=html&ssrc="+source+"&spid=86f2f5da-3b24-4a87-bbb3-1ad47525359d&p=twitterbar-ff/"+TWITTERBAR.version;
	},
	
	getTrends : function () {
		var lastUpdate = TWITTERBAR.prefs.getCharPref("trends.update");
		var trends = TWITTERBAR.prefs.getCharPref("trends");
		
		if (trends == "" || (new Date().getTime()) - lastUpdate > (1000 * 60 * 60 * 1.8)) {
			var feedUrl = "http://api.ads.oneriot.com/search?appId=twitterbar01&version=1.1&format=XML";
			
			var req = new XMLHttpRequest();
			req.open("GET", feedUrl, true);
			req.overrideMimeType("text/xml");
			
			req.onreadystatechange = function () {
				if (req.readyState == 4) {
					if (req.status == 200) {
						TWITTERBAR.parseTrendingNews(req.responseXML, feedUrl);
					}
				}
			};
			
			req.send(null);
		}
	},
	
	parseTrendingNews : function (xml, url) {
		var result = {
			bozo : false,
			
			doc : {
				QueryInterface : function () { },
				
				link : {
					resolve : function () {
						return "http://www.oneriot.com/";
					}
				},
				
				title : {
					plainText : function () {
						return "Trending News";
					}
				},
				
				summary : {
					text : "Trending news courtesy of TwitterBar"
				},
				
				items : {
					get length() { return this._items.length; },
					
					queryElementAt : function (index) {
						return this._items[index];
					},
					
					_items : []
				}
			},
			
			uri : {
				_uri : url,
				
				resolve : function () {
					return this._uri;
				}
			}
		};
		
		var items = xml.getElementsByTagName("featured-result");
		var updated = new Date();
		updated.setTime( xml.getElementsByTagName("time")[0].textContent * 1000);
		
		for (var i = 0; i < items.length; i++) {
			var itemUrl = items[i].getElementsByTagName("redirect-url")[0].textContent;
			
			var item = {
				id : "http://" + items[i].getElementsByTagName("display-url")[0].textContent,
				
				uri : itemUrl,
				
				displayUri : items[i].getElementsByTagName("display-url")[0].textContent,
				trackingUri : items[i].getElementsByTagName("tracking-url")[0].textContent,
				
				link : {
					_link : items[i].getElementsByTagName("redirect-url")[0].textContent,
				
					resolve : function () {
						return this._link;
					}
				},
				
				updated : updated,
				
				title : {
					_title : items[i].getElementsByTagName("title")[0].textContent,
				
					plainText : function () {
						return this._title.replace(/<[^>]+>/g, "");
					}
				},
			
				summary : {
					_summary : items[i].getElementsByTagName("snippet")[0].textContent,
				
					get text() {
						return this._summary.replace(/<[^>]+>/g, "");
					} 
				}
			};
			
			result.doc.items._items.push(item);
		}
		
		TWITTERBAR.handleResult(result);
	},
	
	handleResult: function(result) {
		TWITTERBAR.prefs.setCharPref("trends.update", new Date().getTime());

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

		var trends = [];

		for (var i = 0; i < feed.items.length; i++) {
			var item = feed.items.queryElementAt(i, Components.interfaces.nsIFeedEntry);
			trends.push(
				{
					"title": item.title.plainText(),
					"url": item.uri,
					"displayUrl": item.displayUri,
					"trackingUrl" : item.trackingUri
				}
			);
		}

		delete result;

		TWITTERBAR.prefs.setCharPref("trends", JSON.stringify(trends));
	},
	
	returnTrends : function () {
		var rv = {
			"links" : [],
			"title" : TWITTERBAR.strings.getString("twitterbar.trends.title"),
			"byline" : TWITTERBAR.strings.getString("twitterbar.trends.byline"),
			"explanation" : TWITTERBAR.strings.getString("twitterbar.trends.explanation")
		};
		
		if (TWITTERBAR.prefs.getBoolPref("showTrends")) {
			var topics = TWITTERBAR.prefs.getCharPref("trends");
		
			if (topics) {
				try {
					topics = JSON.parse(topics);
				} catch (e) {
					alert(e);
					TWITTERBAR.prefs.setCharPref("trends", "");
					TWITTERBAR.prefs.setCharPref("trends.update", 0);
				
					setTimeout(TWITTERBAR.getTrends, 1000 * 10);
					messageManager.sendAsyncMessage("TwitterBar:Trends", rv);
					return;
				}
				
				var limit = 4;
			
				var ios = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService);
			
				for (var i = 0; i < Math.min(limit, topics.length); i++) {
					var idx = Math.floor(Math.random() * topics.length);
					var topic = topics[idx];
					topics.splice(idx, 1);
				
					try {
						var trackingUrl = ios.newURI(topic.trackingUrl, null, null);
						if (!trackingUrl.schemeIs("http") && !trackingUrl.schemeIs('https')) {
							throw "InvalidScheme";
						}
					
						var url = ios.newURI(topic.url, null, null);
						if (url.scheme != 'http' && url.scheme != 'https') {
							throw "InvalidScheme";
						}
					
						rv.links.push( { "bug" : trackingUrl.spec, "targetUrl" : topic.displayUrl, "url" : url.spec, "label" : topic.title } );
					} catch (e) {
						limit++;
						TWITTERBAR.log(e);
					}
				}
			}
		}
		
		messageManager.sendAsyncMessage("TwitterBar:Trends", rv);
	},
	
	addTrends : function (page) {
		var sidebar = page.getElementById("side");

		if (sidebar) {
			var topics = TWITTERBAR.prefs.getCharPref("trends");
			
			if (topics) {
				try {
					topics = JSON.parse(topics);
				} catch (e) {
					TWITTERBAR.prefs.setCharPref("trends", "");
					TWITTERBAR.prefs.setCharPref("trends.update", 0);
					
					setTimeout(TWITTERBAR.getTrends, 1000 * 10);
					return;
				}
				
				var links = [];
				
				var limit = 4;
				
				var ios = Components.classes["@mozilla.org/network/io-service;1"].getService(Components.interfaces.nsIIOService);
				
				for (var i = 0; i < Math.min(limit, topics.length); i++) {
					var idx = Math.floor(Math.random() * topics.length);
					var topic = topics[idx];
					topics.splice(idx, 1);
					
					try {
						var trackingUrl = ios.newURI(topic.trackingUrl, null, null);
						if (!trackingUrl.schemeIs("http") && !trackingUrl.schemeIs('https')) {
							throw "InvalidScheme";
						}
						
						var url = ios.newURI(topic.url, null, null);
						if (url.scheme != 'http' && url.scheme != 'https') {
							throw "InvalidScheme";
						}
						
						links.push( { "bug" : trackingUrl.spec, "targetUrl" : topic.displayUrl, "url" : url.spec, "label" : topic.title } );
					} catch (e) {
						limit++;
						TWITTERBAR.log(e);
					}
				}
				
				if (links.length > 0) {
					var container = page.createElement("div");
					container.setAttribute("id", "twitterbar-trends");
					
					var header = page.createElement("h2");
					header.setAttribute("class", "sidebar-title")
					header.style.backgroundColor = "transparent !important";
					
					var title = page.createElement("span");
					title.setAttribute("title", TWITTERBAR.strings.getString("twitterbar.trends.byline"));
					title.appendChild(page.createTextNode(TWITTERBAR.strings.getString("twitterbar.trends.title")));
					
					header.appendChild(title);
					
					container.appendChild(header);
					
					var list = page.createElement("ul");
					list.setAttribute("class", "sidebar-menu more-trends-links");
					
					for (var i = 0; i < links.length; i++) {
						var item = page.createElement("li");
						item.setAttribute("class", "link-title");
						item.style.background = 'url("' + links[i].bug + '") no-repeat';
						
						var a = page.createElement("a");
						a.setAttribute("target", "_blank");
						a.setAttribute("title", links[i].targetUrl);
						a.setAttribute("href", links[i].url);
						
						var span = page.createElement("span");
						span.appendChild(page.createTextNode(links[i].label));
						
						a.appendChild(span);
						item.appendChild(a);
						list.appendChild(item);
					}
					
					var notice = page.createElement("li");
					
					var text = page.createElement("small");
					text.style.display = 'block';
					text.style.padding = '5px 14px';
					text.appendChild(page.createTextNode(TWITTERBAR.strings.getString("twitterbar.trends.explanation")));
					
					notice.appendChild(text);
					list.appendChild(notice);
					
					container.appendChild(list);
					container.appendChild(page.createElement("hr"));
					
					var possibleSiblings = ["side_lists", "custom_search", "trends"];
					
					var sibling = null;
					
					for (var i = 0; i < possibleSiblings.length; i++) {
						var possibleSibling = page.getElementById(possibleSiblings[i]);
						
						if (possibleSibling) {
							possibleSibling.parentNode.insertBefore(container, possibleSibling);
							return;
						}
					}
					
					sidebar.appendChild(container);
				}
			}
		}
	},
	
	alert : function (msg) {
		var title = TWITTERBAR.strings.getString("twitterbar.alertTitle");
		
		var prompts = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
		              .getService(Components.interfaces.nsIPromptService);
		prompts.alert(null, title, msg);
	},
	
	confirm : function (msg) {
		var title = TWITTERBAR.strings.getString("twitterbar.alertTitle");
		
		var prompts = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
		              .getService(Components.interfaces.nsIPromptService);
		return prompts.confirm(null, title, msg);
	},
	
	confirmCheck : function (msg, cbLabel) {
		var title = TWITTERBAR.strings.getString("twitterbar.alertTitle");
		
		var prompts = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
		              .getService(Components.interfaces.nsIPromptService);
		
		var cb = { value : false };
		
		var rv = prompts.confirmCheck(null, title, msg, cbLabel, cb);
		
		return [ rv, cb.value ];
	}
};

