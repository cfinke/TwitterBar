var TWITTERBAR = {
	/**
	 * The Twitter username of the currently active account.
	 */
	currentAccount : "",
	
	/**
	 * A dict of all of the authorized accounts.  A shortcut to the stored data in the prefs system.
	 */
	accounts : {},
	pendingTweets : [],
	
	debug : false,
	
	lastTweet : null,
	covertMode : false,
	
	version : null,
	
	lastUrl : null,
	
	get strings() { return document.getElementById("twitterbar-strings"); },
	
	get oauth_token_secret() { if (TWITTERBAR.currentAccount in TWITTERBAR.accounts) { return TWITTERBAR.accounts[TWITTERBAR.currentAccount].token_secret; } else { return ""; } },
	get oauth_token() { if (TWITTERBAR.currentAccount in TWITTERBAR.accounts) { return TWITTERBAR.accounts[TWITTERBAR.currentAccount].token; } else { return ""; } },
	
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
	
	loadBasic : function (e) {
		TWITTERBAR.load(e, true);
		
		removeEventListener("load", TWITTERBAR.loadBasic, false);
	},
	
	load : function (e, basic) {
		if (!basic) removeEventListener("load", TWITTERBAR.load, false);
		
		TWITTERBAR.version = Components.classes["@mozilla.org/extensions/manager;1"].getService(Components.interfaces.nsIExtensionManager).getItemForID("{1a0c9ebe-ddf9-4b76-b8a3-675c77874d37}").version;
		
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

			var showFirstRun = false;
			var oldVersion = TWITTERBAR.prefs.getCharPref("version");
			var newVersion = TWITTERBAR.version;
		
			if (oldVersion != newVersion) {
				TWITTERBAR.prefs.setCharPref("version", newVersion);
			}
		
			if (!oldVersion) {
				showFirstRun = true;
			}
			else {
				var oldParts = oldVersion.split(".");
				var newParts = newVersion.split(".");
		
				if (newParts[0] != oldParts[0] || newParts[1] != oldParts[1]) {
					showFirstRun = true;
				}
			}
		
			if (showFirstRun) {
				TWITTERBAR_UI.showFirstRun(TWITTERBAR.version);
			}
			else if (!TWITTERBAR.prefs.getBoolPref("search_request")) {
				TWITTERBAR_UI.askSearch();
			}
			else {
				if (!TWITTERBAR.prefs.getBoolPref("onetime.multiple")) {
					if (Math.random() <= 0.5) {
						TWITTERBAR_UI.didYouKnow();
					}
				}
				else if (!TWITTERBAR.prefs.getBoolPref("onetime.follow")) {
					for (var i in TWITTERBAR.accounts) {
						if (TWITTERBAR.accounts[i].token) {
							if (Math.random() <= 0.5) {
								TWITTERBAR_UI.follow();
							}
							
							break;
						}
					}
				}
			}
		
			// Get new trends every 2 hours.
			TWITTERBAR.trendTimer = setInterval(TWITTERBAR.getTrends, 1000 * 60 * 60 * 2);
		
			setTimeout(TWITTERBAR.getTrends, 1000 * 10);
		}
		
		addEventListener("unload", TWITTERBAR.unload, false);
	},
	
	unload : function () {
		removeEventListener("unload", TWITTERBAR.unload, false);
		
		TWITTERBAR.prefs.removeObserver("", TWITTERBAR);
		
		clearInterval(TWITTERBAR.trendTimer);
	},
	
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
	
	setUpAccount : function () {
		var account = TWITTERBAR.prefs.getCharPref("account");
		var accounts = TWITTERBAR.prefs.getCharPref("accounts");
		
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
		TWITTERBAR.currentAccount = account;
	},
	
	setAccount : function (username, token_secret, token) {
		var accounts = TWITTERBAR.prefs.getCharPref("accounts");
		if (!accounts) accounts = "{}";
		accounts = JSON.parse(accounts);
		accounts[username] = {"token_secret" : token_secret, "token" : token, "timestamp" : (new Date().getTime())};
		TWITTERBAR.accounts = accounts;
		
		if ("_twitterbar" in accounts) {
			delete accounts["_twitterbar"];
		}
		
		accounts = JSON.stringify(accounts);
		TWITTERBAR.prefs.setCharPref("accounts", accounts);
	},
	
	unsetAccount : function (username) {
		var accounts = TWITTERBAR.prefs.getCharPref("accounts");
		
		if (!accounts) {
			accounts = "{}";
		}
		else {
			accounts = JSON.parse(accounts);
		
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
				accounts[screenname] = {"token" : token, "token_secret" : token_secret, "timestamp": timestamp};
				
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
	
	DOMContentLoaded : function (event) {
		if (event.originalTarget instanceof HTMLDocument) {
			var page = event.originalTarget;
			
			if (page.location.href.match(/chrisfinke.com\/oauth\/twitterbar/i)) {
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
								
								TWITTERBAR.currentAccount = username;
								
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
					}
					else {
						TWITTERBAR.alert(TWITTERBAR.strings.getFormattedString("twitterbar.otherError", [ req.status, req.responseText ]));
						TWITTERBAR.pendingTweets = [];
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
					
					TWITTERBAR_UI.setStatusText(TWITTERBAR.lastUrl);
					
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
			}
			else {
				TWITTERBAR.alert(TWITTERBAR.strings.getFormattedString("twitterbar.otherError", [ req.status, req.responseText ]));
				TWITTERBAR.pendingTweets = [];
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
				}
				
				// I think Twitter sends a 401 when you've hit your rate limit.
				// This is the reason so many people complained about being asked to reauthorize.
			}
			else if (req.status >= 500) {
				TWITTERBAR.alert(TWITTERBAR.strings.getString("twitterbar.failWhale"));
				TWITTERBAR.pendingTweets = [];
			}
			else if (req.status == 200) {
				TWITTERBAR.lastTweet = null;
				
				if (!TWITTERBAR.covertMode) {
					TWITTERBAR_UI.setStatusText(TWITTERBAR.strings.getString("twitterbar.success"));
					
					TWITTERBAR_UI.setBusy(false);
					
					var json = JSON.parse(req.responseText);
					
					setTimeout(function () { TWITTERBAR.afterPost(false, json.user.screen_name); }, 3000);
				}
				else {
					TWITTERBAR.postNextTweet();
				}
			}
			else {
				TWITTERBAR.alert(TWITTERBAR.strings.getFormattedString("twitterbar.otherError", [ req.status, req.responseText ]));
				TWITTERBAR.pendingTweets = [];
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
			TWITTERBAR_UI.setStatusText(TWITTERBAR.lastUrl);
		
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
		status = status.replace(/\$\$/g, content.document.title);
		
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
		var account = "";
		var accounts = [];
		
		if (status.indexOf(" --@") != -1) {
			parts = status.split(" --@");
			
			status = parts[0].replace(/^\s+|\s+$/g, "");
			
			for (var i = 1; i < parts.length; i++) {
				accounts.push(parts[i].replace(/^\s+|\s+$/g, ""));
			}
			
			TWITTERBAR.currentAccount = accounts[0];
		}
		
		if (status.match(/^https?:\/\//i)) {
			var webtext = (TWITTERBAR.prefs.getCharPref("web").replace(/^\s+|\s+$/, "") + " ");
			status = webtext + status;
		}
		
		if (status.indexOf("$$") != -1) {
			var currentLength = TWITTERBAR.getCharCount(status);
			
			var pageTitle = content.document.title;
			
			currentLength += pageTitle.length;
			
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
					pageTitle = content.document.title;
				}
			}
			
			status = status.replace(/\$\$/g, pageTitle);
		}
		
		TWITTERBAR_UI.setStatusText(TWITTERBAR.strings.getString("twitterbar.posting"));
		
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
			TWITTERBAR_UI.setStatusText(TWITTERBAR.strings.getString("twitterbar.posting"));
			
			var pair = TWITTERBAR.pendingTweets.shift();
			
			TWITTERBAR.currentAccount = pair[0];
			var account = TWITTERBAR.currentAccount;
			
			var status = pair[1];
			
			if (account != "_twitterbar") {
				TWITTERBAR_UI.setStatusText(TWITTERBAR.strings.getFormattedString("twitterbar.postingToAccount", [ account ]));
			}
			
			TWITTERBAR_UI.setBusy(true);
			
			TWITTERBAR_SHORTENERS.shortenUrls(status, function (status) { TWITTERBAR.postRequest(status); });
		}
	},
	
	followTwtrbar : function () {
		var accounts = TWITTERBAR.accounts;
		
		for (var i in accounts) {
			TWITTERBAR.currentAccount = i;
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
							var listener = TWITTERBAR;
							
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

		var numItems = Math.min(10, feed.items.length);

		var trends = [];

		for (var i = 0; i < numItems; i++) {
			var item = feed.items.queryElementAt(i, Components.interfaces.nsIFeedEntry);
			trends.push(item.title.plainText());
		}

		delete result;

		TWITTERBAR.prefs.setCharPref("trends", trends.join("\t"));
	},
	
	addTrends : function (page) {
		// Check for the trending topics.
		var trends = page.getElementById("trends");

		if (trends) {
			var topics = TWITTERBAR.prefs.getCharPref("trends").split("\t");
	
			if (topics) {
				var str = '<h2 id="twitterbar-trends" class="sidebar-title" style="background: transparent !important;"><span title="'+TWITTERBAR.strings.getString("twitterbar.trends.byline")+'">'+TWITTERBAR.strings.getString("twitterbar.trends.title")+'</span></h2>';
				str += '<ul class="sidebar-menu more-trends-links">';
		
				var limit = Math.min(10, topics.length);
		
				for (var i = 0; i < topics.length; i++) {
					str += '<li class="link-title"><a target="_blank" title="'+topics[i]+'" href="'+TWITTERBAR.getSearchURL(topics[i], "trends-sidebar")+'"><span>'+topics[i]+'</span></a></li>';
				}
	
				str += '<li><small style="display: block; padding: 5px 14px 5px 14px;">'+TWITTERBAR.strings.getString("twitterbar.trends.explanation")+'</small></li>';
				str += '</ul>';
				str += '<hr />';

				trends.innerHTML += str;
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
	},
	
	addOneRiotSearch : function (def) {
		var searchService = Components.classes["@mozilla.org/browser/search-service;1"]
		                    .getService(Components.interfaces.nsIBrowserSearchService);
		
		var engineLabel = TWITTERBAR.strings.getString("twitter.search.name");
		var oneRiotSearch = searchService.getEngineByName(engineLabel);
		
		if (oneRiotSearch == null) {
			searchService.addEngineWithDetails(engineLabel, "http://www.oneriot.com/images/favicon.ico", null, TWITTERBAR.strings.getString("twitter.search.description"), "get", "http://www.oneriot.com/search?q={searchTerms}&format=html&ssrc=browserBox&spid=86f2f5da-3b24-4a87-bbb3-1ad47525359d&p=twitterbar-ff");
		}
		
		if (def) {
			// Make OneRiot the default
			const prefService = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService);
			const preferences = prefService.getBranch("browser.");
			preferences.setCharPref("search.selectedEngine", engineLabel);
	
			// Make OneRiot the current engine
			var engine = searchService.getEngineByName(engineLabel);
			searchService.currentEngine = engine;
		}
	}
};