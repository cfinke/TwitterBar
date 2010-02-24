var TWITTERBAR = {
	debug : false,
	
	lastTweet : null,
	covertMode : false,
	
	version : null,
	
	lastUrl : null,
	
	load : function () {
		removeEventListener("load", TWITTERBAR.load, false);
		
		TWITTERBAR.version = Components.classes["@mozilla.org/extensions/manager;1"].getService(Components.interfaces.nsIExtensionManager).getItemForID("{1a0c9ebe-ddf9-4b76-b8a3-675c77874d37}").version;
		
		TWITTERBAR.prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("extensions.twitter.");	
		TWITTERBAR.prefs.QueryInterface(Components.interfaces.nsIPrefBranch2);
		TWITTERBAR.prefs.addObserver("", TWITTERBAR, false);
		
		TWITTERBAR.debug = TWITTERBAR.prefs.getBoolPref("debug");
		
		addEventListener("unload", TWITTERBAR.unload, false);
		
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
		
		var engineLabel = TWITTERBAR_COMMON.strings.getString("twitter.search.name");
		
		/**
		 * @todo Is this OK in Fennec?
		 */
		
		if (!TWITTERBAR.prefs.getBoolPref("search_request")) {
			TWITTERBAR.prefs.setBoolPref("search_request", true);
			
			setTimeout(
				function installSearch() {
					var searchService = Components.classes["@mozilla.org/browser/search-service;1"];
					
					if (searchService) {
						searchService = searchService.getService(Components.interfaces.nsIBrowserSearchService);
						
						var oneRiotSearch = searchService.getEngineByName(engineLabel);
						
						if (oneRiotSearch == null) {
							window.openDialog("chrome://twitterbar/content/OneRiotSearchDialog-twitterbar-ff.xul", "search", "chrome,dialog,centerscreen,titlebar,alwaysraised");
						}
					}
				}, 5000);
		}
		else {
			var stillAChance = true;
			
			if (!TWITTERBAR.prefs.getBoolPref("onetime.multiple")) {
				if (Math.random() <= 0.3) {
					TWITTERBAR_UI.didYouKnow();
					TWITTERBAR.prefs.setBoolPref("onetime.multiple", true);
					
					stillAChance = false;
				}
			}
			
			if (stillAChance && !TWITTERBAR.prefs.getBoolPref("onetime.follow")) {
				for (var i in TWITTERBAR_COMMON.accounts) {
					if (TWITTERBAR_COMMON.accounts[i].token) {
						if (Math.random() <= 0.3) {
							TWITTERBAR_UI.follow();
							TWITTERBAR.prefs.setBoolPref("onetime.follow", true);
						}
				
						break;
					}
				}
			}
		}
		
		// Get new trends every 2 hours.
		TWITTERBAR.trendTimer = setInterval(TWITTERBAR_COMMON.getTrends, 1000 * 60 * 60 * 2);
		
		setTimeout(TWITTERBAR_COMMON.getTrends, 1000 * 10);
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
		}
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
							
							TWITTERBAR_COMMON.accounts["_twitterbar"] = {"token" : token, "token_secret" : token_secret};
							TWITTERBAR_COMMON.currentAccount = "_twitterbar";
							
							function callback(req) {
								var json = JSON.parse(req.responseText);
								var username = json.screen_name;
								
								TWITTERBAR_COMMON.setAccount(username, token_secret, token);
								
								TWITTERBAR_COMMON.currentAccount = username;
								
								if (TWITTERBAR.lastTweet) {
									TWITTERBAR.covertMode = true;
									TWITTERBAR.postRequest(TWITTERBAR.lastTweet);
								}
							}
							
							TWITTERBAR_COMMON.apiRequest("http://twitter.com/account/verify_credentials.json", callback);
						} catch (e) {
							TWITTERBAR_COMMON.alert(TWITTERBAR_COMMON.strings.getFormattedString("twitterbar.otherError", [ e, req.responseText ]));
							TWITTERBAR.postNextTweet();
						}
					}
					else if (req.status >= 500) {
						TWITTERBAR_COMMON.alert(TWITTERBAR_COMMON.strings.getString("twitterbar.failWhale"));
						TWITTERBAR_COMMON.pendingTweets = [];
					}
					else {
						TWITTERBAR_COMMON.alert(TWITTERBAR_COMMON.strings.getFormattedString("twitterbar.otherError", [ req.status, req.responseText ]));
						TWITTERBAR_COMMON.pendingTweets = [];
					}
				}
				
				TWITTERBAR_COMMON.accounts["_twitterbar"] = {"token" : token, "token_secret" : ""};
				TWITTERBAR_COMMON.currentAccount = "_twitterbar";
				
				TWITTERBAR_COMMON.apiRequest(TWITTERBAR_COMMON.oauth.serviceProvider.accessTokenURL, callback);
			}
			else if (TWITTERBAR.prefs.getBoolPref("showTrends")) {
				try {
					if (!page.location.host.match(/^twitter\.com$/)) {
						return;
					}
				} catch (e) {
					return;
				}
				
				TWITTERBAR_COMMON.addTrends(page);
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
		
		var lastAccount = TWITTERBAR_COMMON.currentAccount;
		
		TWITTERBAR_COMMON.accounts["_twitterbar"] = {"token" : "", "token_secret" : ""};
		TWITTERBAR_COMMON.currentAccount = "_twitterbar";
		
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
		
		openUILink(TWITTERBAR_COMMON.getSearchURL(search_terms, source), event, false, true);
	},
	
	oAuthorize : function (hidePrompt, lastAccount) {
		function callback(req) {
			if (req.status == 200) {
				var parts = req.responseText.split("&");
			
				try {
					TWITTERBAR_COMMON.oauth.request_token.oauth_token = parts[0].split("=")[1];
					TWITTERBAR_COMMON.oauth.request_token.oauth_token_secret = parts[1].split("=")[1];
					
					TWITTERBAR_UI.setStatusText(TWITTERBAR.lastUrl);
					
					var message = "";
					
					if (!lastAccount || lastAccount == "_twitterbar") {
						message = TWITTERBAR_COMMON.strings.getString("twitterbar.oauthRequest1");
					}
					else {
						message = TWITTERBAR_COMMON.strings.getFormattedString("twitterbar.oauthRequest1a", [ lastAccount ]);
					}
					
					message += "\n\n";
					message += TWITTERBAR_COMMON.strings.getString("twitterbar.oauthRequest2");
					
					if (hidePrompt || (TWITTERBAR_COMMON.confirm(message))) {
						TWITTERBAR_UI.addTab("http://twitter.com/oauth/authorize?oauth_token="+TWITTERBAR_COMMON.oauth.request_token.oauth_token);
					}
					else if (!hidePrompt) {
						TWITTERBAR.afterPost(true);
					}
				} catch (e) {
					TWITTERBAR_COMMON.alert(TWITTERBAR_COMMON.strings.getString("twitterbar.oauthError1") + "\n\n" + e + "\n\n" + req.responseText);
					TWITTERBAR.postNextTweet();
				}
			}
			else if (req.status >= 500) {
				TWITTERBAR_COMMON.alert(TWITTERBAR_COMMON.strings.getString("twitterbar.failWhale"));
				TWITTERBAR_COMMON.pendingTweets = [];
			}
			else {
				TWITTERBAR_COMMON.alert(TWITTERBAR_COMMON.strings.getFormattedString("twitterbar.otherError", [ req.status, req.responseText ]));
				TWITTERBAR_COMMON.pendingTweets = [];
			}
		}
		
		TWITTERBAR_COMMON.apiRequest(TWITTERBAR_COMMON.oauth.serviceProvider.requestTokenURL, callback);
	},
	
	post : function (clickedOnButton) {
		if (clickedOnButton && TWITTERBAR.prefs.getBoolPref("confirm")) {
			if (!TWITTERBAR_COMMON.confirmPost()) {
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
		
		if (!TWITTERBAR_COMMON.oauth_token || !TWITTERBAR_COMMON.oauth_token_secret) {
			TWITTERBAR_UI.setBusy(false);
			
			TWITTERBAR.reAuthorize();
			return;
		}
		
		if (status.length > 140) {
			if (!TWITTERBAR_COMMON.confirm(
				TWITTERBAR_COMMON.strings.getFormattedString("twitterbar.tooLong", [status.length]))) {
				TWITTERBAR_COMMON.pendingTweets = [];
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
					TWITTERBAR_COMMON.alert(TWITTERBAR_COMMON.strings.getFormattedString("twitterbar.twitterError", [ req.status, req.responseText ]));
					TWITTERBAR_COMMON.pendingTweets = [];
				}
				
				// I think Twitter sends a 401 when you've hit your rate limit.
				// This is the reason so many people complained about being asked to reauthorize.
			}
			else if (req.status >= 500) {
				TWITTERBAR_COMMON.alert(TWITTERBAR_COMMON.strings.getString("twitterbar.failWhale"));
				TWITTERBAR_COMMON.pendingTweets = [];
			}
			else if (req.status == 200) {
				TWITTERBAR.lastTweet = null;
				
				if (!TWITTERBAR.covertMode) {
					TWITTERBAR_UI.setStatusText(TWITTERBAR_COMMON.strings.getString("twitterbar.success"));
					
					TWITTERBAR_UI.setBusy(false);
					
					var json = JSON.parse(req.responseText);
					
					setTimeout(function () { TWITTERBAR.afterPost(false, json.user.screen_name); }, 3000);
				}
				else {
					TWITTERBAR.postNextTweet();
				}
			}
			else {
				TWITTERBAR_COMMON.alert(TWITTERBAR_COMMON.strings.getFormattedString("twitterbar.otherError", [ req.status, req.responseText ]));
				TWITTERBAR_COMMON.pendingTweets = [];
			}
			
			TWITTERBAR.covertMode = false;
		}
		
		TWITTERBAR_COMMON.apiRequest("http://twitter.com/statuses/update.json", callback, args, "POST");
	},
	
	afterPost : function (noSuccess, screenname) {
		if (TWITTERBAR_COMMON.pendingTweets.length > 0) {
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
		if (!e || (e.keyCode != e.DOM_VK_RETURN && e.keyCode != 27 && e.keyCode != 117 && e.keyCode != 76 && e.keyCode != 68 && e.keyCode != 17 && e.keyCode != 18)){
			var status = TWITTERBAR_UI.getStatusText();
			
			if (status.indexOf(" --post") != -1){
				var status = status.split(" --post")[0];
				
				TWITTERBAR.startPost(status);
			}
			else if (status.indexOf("--account") != -1) {
				TWITTERBAR_UI.setStatusText(TWITTERBAR.lastUrl);

				TWITTERBAR_COMMON.currentAccount = "";
				
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
		
		TWITTERBAR_UI.onKeyDown();
	},
	
	startPost : function (status) {
		var account = "";
		
		if (status.indexOf(" --@") != -1) {
			account = status.split(" --@")[1].replace(/^\s+|\s+$/g, "");
			TWITTERBAR_COMMON.currentAccount = account;
			status = status.split(" --@")[0];
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
		
		TWITTERBAR_UI.setStatusText(TWITTERBAR_COMMON.strings.getString("twitterbar.posting"));
		
		if (!account) {
			var accounts = TWITTERBAR_COMMON.accounts;
			var lastAccount = "";
			
			var j = 0;
			
			for (var i in accounts) {
				lastAccount = i;
				j++;
			}
			
			if (j == 0) {
				account = "_twitterbar";
				TWITTERBAR_COMMON.accounts["_twitterbar"] = {"token" : "", "token_secret" : ""};
			}
			else if (j == 1) {
				account = lastAccount;
			}
			else {
				var rv = [];
				
				window.openDialog('chrome://twitterbar/content/dialogs/accountPrompt.xul','twitterbar-prompt','chrome,modal', accounts, rv, TWITTERBAR_COMMON.currentAccount);
				
				if (rv.length == 0) {
					TWITTERBAR_UI.setStatusText(status);
					
					return;
				}
				else {
					for (var i = 0; i < rv.length; i++) {
						TWITTERBAR_COMMON.pendingTweets.push([ rv[i], status ]);
					}
				}
			}
		}
		
		TWITTERBAR.postNextTweet();
	},
	
	postNextTweet : function () {
		if (TWITTERBAR_COMMON.pendingTweets.length > 0) {
			TWITTERBAR_UI.setStatusText(TWITTERBAR_COMMON.strings.getString("twitterbar.posting"));
			
			var pair = TWITTERBAR_COMMON.pendingTweets.shift();
			
			TWITTERBAR_COMMON.currentAccount = pair[0];
			var account = TWITTERBAR_COMMON.currentAccount;
			
			var status = pair[1];
			
			if (account != "_twitterbar") {
				TWITTERBAR_UI.setStatusText(TWITTERBAR_COMMON.strings.getFormattedString("twitterbar.postingToAccount", [ account ]));
			}
			
			TWITTERBAR_UI.setBusy(true);
			
			TWITTERBAR_SHORTENERS.shortenUrls(status, function (status) { TWITTERBAR.postRequest(status); });
		}
	},
	
	followTwtrbar : function () {
		var accounts = TWITTERBAR_COMMON.accounts;
		
		for (var i in accounts) {
			TWITTERBAR_COMMON.currentAccount = i;
			TWITTERBAR_COMMON.apiRequest("http://twitter.com/friendships/create/twtrbar.json", false, false, "POST");
		}
	},
	
	log : function (message) {
		var consoleService = Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);
		consoleService.logStringMessage("TWITTERBAR: " + message);
	}
};