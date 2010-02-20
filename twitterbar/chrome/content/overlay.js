var TWITTERBAR = {
	debug : false,
	
	lastTweet : null,
	covertMode : false,
	
	version : null,
	
	lastUrl : null,
	
	load : function () {
		TWITTERBAR_COMMON.load();
		
		this.version = Components.classes["@mozilla.org/extensions/manager;1"].getService(Components.interfaces.nsIExtensionManager).getItemForID("{1a0c9ebe-ddf9-4b76-b8a3-675c77874d37}").version;
		
		TWITTERBAR.prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("extensions.twitter.");	
		TWITTERBAR.prefs.QueryInterface(Components.interfaces.nsIPrefBranch2);
		TWITTERBAR.prefs.addObserver("", this, false);
		
		TWITTERBAR.debug = TWITTERBAR.prefs.getBoolPref("debug");
		
		var showFirstRun = false;
		var oldVersion = TWITTERBAR.prefs.getCharPref("version");
		var newVersion = this.version;
		
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
			var browser = getBrowser();
			
			setTimeout(function (browser) {
				browser.selectedTab = browser.addTab("http://www.chrisfinke.com/firstrun/twitterbar.php?v=" + newVersion);
			}, 3000, browser);
		}
		
		var engineLabel = TWITTERBAR_COMMON.strings.getString("twitter.search.name");
		
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
					setTimeout(
						function () {
							TWITTERBAR.prefs.setBoolPref("onetime.multiple", true);
							window.openDialog("chrome://twitterbar/content/dialogs/didYouKnow.xul", "multiple", "chrome,dialog,centerscreen,titlebar,alwaysraised");
						}, 5000);
					
					stillAChance = false;
				}
			}
			
			if (stillAChance && !TWITTERBAR.prefs.getBoolPref("onetime.follow")) {
				for (var i in TWITTERBAR_COMMON.accounts) {
					if (TWITTERBAR_COMMON.accounts[i].token) {
						if (Math.random() <= 0.3) {
							setTimeout(
								function () {
									TWITTERBAR.prefs.setBoolPref("onetime.follow", true);
									window.openDialog("chrome://twitterbar/content/dialogs/follow.xul", "follow", "chrome,dialog,centerscreen,titlebar,alwaysraised");
								}, 5000);
						}
				
						break;
					}
				}
			}
			
			if (!TWITTERBAR.prefs.getBoolPref("search_fixed")) {
				TWITTERBAR.prefs.setBoolPref("search_fixed", true);
				
				try {
					// Check if an old search version is installed.
					var searchService = Components.classes["@mozilla.org/browser/search-service;1"];
					
					if (searchService) {
						searchService = searchService.getService(Components.interfaces.nsIBrowserSearchService);
						
						var oneRiotSearch = searchService.getEngineByName(engineLabel);
						
						if (oneRiotSearch) {
							var testSubmission = oneRiotSearch.getSubmission("test", null);
							var searchUrl = testSubmission.uri.spec;
							
							// The old one uses a versioned parameter, which is confusing because it doesn't update as the user updates their browser.
							if (searchUrl.indexOf("twitterbar-ff/") != -1) {
								var isDefault = false;
						
								if (searchService.currentEngine == oneRiotSearch) {
									// Set this engine back as the default.
									isDefault = true;
								}
						
								searchService.removeEngine(oneRiotSearch);
								searchService.addEngineWithDetails(engineLabel, "http://www.oneriot.com/images/favicon.ico", null, document.getElementById("twitterbar-strings").getString("twitter.search.description"), "get", "http://www.oneriot.com/search?q={searchTerms}&format=html&ssrc=browserBox&spid=86f2f5da-3b24-4a87-bbb3-1ad47525359d&p=twitterbar-ff");
						
								if (isDefault) {
									var newOneRiotSearch = searchService.getEngineByName(engineLabel);
									searchService.currentEngine = newOneRiotSearch;
								}
							}
						}
					}
				} catch (e) {
				}
			}
		}
		
		document.getElementById("urlbar").addEventListener("keyup", function (event) { TWITTERBAR.postKey(event); }, false);
		document.getElementById("urlbar").addEventListener("focus", function () { TWITTERBAR.focus(); }, false);
		
		this.buttonCheck();
		
		var appcontent = document.getElementById("content");
		
		if (appcontent) {
			appcontent.addEventListener("DOMContentLoaded", TWITTERBAR.DOMContentLoaded, true);
		}
		
		// Get new trends every 2 hours.
		TWITTERBAR.trendTimer = setInterval(function () { TWITTERBAR_COMMON.getTrends(); }, 1000 * 60 * 60 * 2);
		
		setTimeout(function() { TWITTERBAR_COMMON.getTrends(); }, 1000 * 10);
	},
	
	unload : function () {
		TWITTERBAR.prefs.removeObserver("", this);
		
		var appcontent = document.getElementById("content");
		
		if (appcontent) {
			appcontent.removeEventListener("DOMContentLoaded", TWITTERBAR.DOMContentLoaded, true);
		}
		
		clearInterval(TWITTERBAR.trendTimer);
	},
	
	observe : function(subject, topic, data) {
		if (topic != "nsPref:changed") {
			return;
		}
		
		switch(data) {
			case "button":
				// Iterate over all the windows and show/hide the button based on pref-hide-button
				var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
								   .getService(Components.interfaces.nsIWindowMediator);
				var enumerator = wm.getEnumerator(null);

				var buttonMode = TWITTERBAR.prefs.getBoolPref("button").toString();

				while(enumerator.hasMoreElements()) {
					var win = enumerator.getNext();

					try {
						win.document.getElementById("twitterBox").setAttribute("hidden", buttonMode);
					} catch (e) { }
				}
			break;
			case "oneriotButton":
				// Iterate over all the windows and show/hide the button based on pref-hide-button
				var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"]
								   .getService(Components.interfaces.nsIWindowMediator);
				var enumerator = wm.getEnumerator(null);

				var buttonMode = TWITTERBAR.prefs.getBoolPref("oneriotButton").toString();

				while(enumerator.hasMoreElements()) {
					var win = enumerator.getNext();

					try {
						win.document.getElementById("twitter-oneriot-box").setAttribute("hidden", buttonMode);
					} catch (e) { }
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
						}
					}
					else if (req.status >= 500) {
						TWITTERBAR_COMMON.alert(TWITTERBAR_COMMON.strings.getString("twitterbar.failWhale"));
					}
					else {
						TWITTERBAR_COMMON.alert(TWITTERBAR_COMMON.strings.getFormattedString("twitterbar.otherError", [ req.status, req.responseText ]));
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
	
	buttonCheck : function () {
		try {
			var mode = TWITTERBAR.prefs.getBoolPref("button");
			var button = document.getElementById("twitterBox");
			
			button.setAttribute("hidden", mode.toString());
		} catch (e) { }
		
		try {
			var mode = TWITTERBAR.prefs.getBoolPref("oneriotButton");
			var button = document.getElementById("twitter-oneriot-box");
			
			button.setAttribute("hidden", mode.toString());
		} catch (e) { }
	},
	
	focus : function () {
		var status = document.getElementById("urlbar").value;
		
		if (status.match(/^https?:\/\//i)) {
			this.lastUrl = status;
		}
		
		this.toolbarCount();
	},
	
	reAuthorize : function () {
		this.addAccount();
	},
	
	addAccount : function (hidePrompt) {
		var lastAccount = TWITTERBAR_COMMON.currentAccount;
		
		TWITTERBAR_COMMON.accounts["_twitterbar"] = {"token" : "", "token_secret" : ""};
		TWITTERBAR_COMMON.currentAccount = "_twitterbar";
		
		this.oAuthorize(hidePrompt, lastAccount);
	},
	
	search : function (event, source) {
		var status = document.getElementById("urlbar").value;
		
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
					
					var urlbar = document.getElementById("urlbar");
					urlbar.value = TWITTERBAR.lastUrl;
					gBrowser.selectedBrowser.userTypedValue = TWITTERBAR.lastUrl;
					
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
						getBrowser().selectedTab = getBrowser().addTab("http://twitter.com/oauth/authorize?oauth_token="+TWITTERBAR_COMMON.oauth.request_token.oauth_token);
					}
					else if (!hidePrompt) {
						TWITTERBAR.afterPost(true);
					}
				} catch (e) {
					TWITTERBAR_COMMON.alert(TWITTERBAR_COMMON.strings.getString("twitterbar.oauthError1") + "\n\n" + e + "\n\n" + req.responseText);
				}
			}
			else if (req.status >= 500) {
				TWITTERBAR_COMMON.alert(TWITTERBAR_COMMON.strings.getString("twitterbar.failWhale"));
			}
			else {
				TWITTERBAR_COMMON.alert(TWITTERBAR_COMMON.strings.getFormattedString("twitterbar.otherError", [ req.status, req.responseText ]));
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
		
		var urlbar = document.getElementById("urlbar");
		var status = urlbar.value;
		
		TWITTERBAR.startPost(status);
	},
	
	postRequest : function (status) {
		if (TWITTERBAR.debug) {
			TWITTERBAR.log("postRequest: " + status);
		}
		
		TWITTERBAR.lastTweet = status;
		
		if (!TWITTERBAR_COMMON.oauth_token || !TWITTERBAR_COMMON.oauth_token_secret) {
			var image = document.getElementById('twitter-statusbarbutton');
			image.src =  "chrome://twitterbar/skin/bird-16-full.png";
			
			TWITTERBAR.reAuthorize();
			return;
		}
		
		if (status.length > 140) {
			if (!TWITTERBAR_COMMON.confirm(
				TWITTERBAR_COMMON.strings.getFormattedString("twitterbar.tooLong", [status.length]))) {
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
				var image = document.getElementById('twitter-statusbarbutton');
				image.src =  "chrome://twitterbar/skin/bird-16-full.png";
			}
			
			if (req.status == 401) {
				if (req.responseText.indexOf("expired") != -1) {
					TWITTERBAR.reAuthorize();
				}
				else {
					TWITTERBAR_COMMON.alert(TWITTERBAR_COMMON.strings.getFormattedString("twitterbar.twitterError", [ req.status, req.responseText ]));
				}
				
				// I think Twitter sends a 401 when you've hit your rate limit.
				// This is the reason so many people complained about being asked to reauthorize.
			}
			else if (req.status >= 500) {
				TWITTERBAR_COMMON.alert(TWITTERBAR_COMMON.strings.getString("twitterbar.failWhale"));
			}
			else if (req.status == 200) {
				TWITTERBAR.lastTweet = null;
				
				if (!TWITTERBAR.covertMode) {
					document.getElementById("urlbar").value = TWITTERBAR_COMMON.strings.getString("twitterbar.success");
					
					var image = document.getElementById("twitter-statusbarbutton");
					image.src =  "chrome://twitterbar/skin/accept.png";
					
					var json = JSON.parse(req.responseText);
					
					setTimeout(function () { TWITTERBAR.afterPost(false, json.user.screen_name); }, 1000);
				}
			}
			else {
				TWITTERBAR_COMMON.alert(TWITTERBAR_COMMON.strings.getFormattedString("twitterbar.otherError", [ req.status, req.responseText ]));
			}
			
			TWITTERBAR.covertMode = false;
		}
		
		TWITTERBAR_COMMON.apiRequest("http://twitter.com/statuses/update.json", callback, args, "POST");
	},
	
	afterPost : function (noSuccess, screenname) {
		var urlbar = document.getElementById("urlbar");
		
		urlbar.value = this.lastUrl;
		
		gBrowser.selectedBrowser.userTypedValue = this.lastUrl;
		
		if (!noSuccess && TWITTERBAR.prefs.getBoolPref("tab")){
			var url = "http://twitter.com/";
			
			if (screenname) {
				url += screenname;
			}
			
			getBrowser().selectedTab = getBrowser().addTab(url);
		}
		
		var image = document.getElementById('twitter-statusbarbutton');
		image.src = "chrome://twitterbar/skin/bird-16-full.png";
	},
	
	count : function () {
		document.getElementById("twitter-searchbutton").hidden = false;
		
		var imagest = document.getElementById('twitter-statusbarbutton');
		imagest.src = "chrome://twitterbar/skin/add.png"
		
		var count = document.getElementById('twitter-count');
		count.hidden = false;
		
		var length = this.getCharCount();
		count.value = (140 - length) + " Left";
		
		if (length > 140) {
			count.style.color = "red";
		}
		else {
			count.style.color = "green";
		}
	},
	
	countClear : function () {
		var image = document.getElementById('twitter-statusbarbutton');
		
		if (image.src.match(/add\.png/)) {
			image.src =  "chrome://twitterbar/skin/bird-16-full.png"
		}
		
		var count = document.getElementById('twitter-count');
		count.hidden = true;
		document.getElementById("twitter-searchbutton").hidden = true;
	},
	
	getCharCount : function (status) {
		if (!status) {
			var status = document.getElementById("urlbar").value;
			status = status.replace("$$", content.document.title);
			status = status.split(" --@")[0];
		}
		
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
		
		if (status.match(/^https?:\/\//i)) {
			var prefix = (TWITTERBAR.prefs.getCharPref("web").replace("$$", content.document.title).replace(/^\s+|\s+$/, "") + " ");
			length += prefix.length;
		}
		
		return length;
	},
	
	toolbarCount : function () {
		var button = document.getElementById('twitter-toolbar-count');
		
		if (button) {
			button.setAttribute('value', 140 - this.getCharCount());
		}
	},
	
	postKey : function (e) {
		if (!e || (e.keyCode != e.DOM_VK_RETURN && e.keyCode != 27 && e.keyCode != 117 && e.keyCode != 76 && e.keyCode != 68 && e.keyCode != 17 && e.keyCode != 18)){
			var urlbar = document.getElementById("urlbar");
			var status = urlbar.value;

			if (status.indexOf(" --post") != -1){
				var status = status.split(" --post")[0];
				
				TWITTERBAR.startPost(status);
			}
			else if (status.indexOf("--account") != -1) {
				urlbar.value = this.lastUrl;
				gBrowser.selectedBrowser.userTypedValue = this.lastUrl;

				TWITTERBAR_COMMON.currentAccount = "";
				
				this.addAccount(true);
			}
			else if (status.indexOf("--options") != -1){
				urlbar.value = this.lastUrl;
				
				gBrowser.selectedBrowser.userTypedValue = this.lastUrl;
				
				this.openOptions();
			}
			else if (status.indexOf(" --search") != -1) {
				this.search(null, "addressBarText");
			}
		}
		
		this.toolbarCount();
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
		
		var urlbar = document.getElementById("urlbar");
		urlbar.value = TWITTERBAR_COMMON.strings.getString("twitterbar.posting");
		
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
				
				window.openDialog('chrome://twitterbar/content/dialogs/accountPrompt.xul','twitterbar-prompt','chrome,modal', accounts, rv);
				
				if (!rv[0]) {
					urlbar.value = status;
					gBrowser.selectedBrowser.userTypedValue = status;
					
					return;
				}
				else {
					account = rv[0];
				}
			}
		}
		
		TWITTERBAR_COMMON.currentAccount = account;
		
		if (account != "_twitterbar") {
			urlbar.value = TWITTERBAR_COMMON.strings.getFormattedString("twitterbar.postingToAccount", [ account ]);
		}
		
		TWITTERBAR_SHORTENERS.shortenUrls(status, function (status) { TWITTERBAR.postRequest(status); });
		
		var imagest = document.getElementById('twitter-statusbarbutton');
		imagest.src = "chrome://twitterbar/skin/Throbber-small.gif";
	},
	
	onButtonClick : function (e) {
		if (e.button != 2){ 
			TWITTERBAR.post(true);
		}
	},
	
	openOptions : function () {
		var d = openDialog('chrome://twitterbar/content/optionsDialog.xul', 'options', 'chrome,dialog,dependent,centerscreen,resizable');
		d.focus();
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