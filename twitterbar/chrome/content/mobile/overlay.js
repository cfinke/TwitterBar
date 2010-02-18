var TWITTERBAR = {
	debug : true,
	
	lastTweet : null,
	covertMode : false,
	
	countShowing : false,
	
	version : null,
	
	lastUrl : null,
	
	load : function () {
		document.getElementById("twitter-statusbarbutton").style.display = 'none';
		
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
			setTimeout(function () {
				Browser.addTab("http://www.chrisfinke.com/firstrun/twitterbar.php?v=" + newVersion, true);
			}, 3000);
		}
		
		var oldsearchcomplete = document.getElementById("urlbar-edit").getAttribute("onsearchcomplete");
		
		document.getElementById("urlbar-edit").setAttribute("onsearchcomplete", "TWITTERBAR.count(); if (!TWITTERBAR.postKey()) { " + oldsearchcomplete + "}");
		document.getElementById("urlbar-edit").addEventListener("blur", TWITTERBAR.blur, true);
		document.getElementById("urlbar-edit").addEventListener("focus", TWITTERBAR.focus, true);
		
		this.buttonCheck();
		
		document.getElementById("browsers").addEventListener("load", TWITTERBAR.DOMContentLoaded, true);
		
		// Get new trends every 2 hours.
		TWITTERBAR.trendTimer = setInterval(function () { TWITTERBAR_COMMON.getTrends(); }, 1000 * 60 * 60 * 2);
		
		setTimeout(function() { TWITTERBAR_COMMON.getTrends(); }, 1000 * 10);
		
		document.getElementById("addons-list").addEventListener("AddonOptionsLoad", TWITTERBAR_OPTIONS.mobileInit, false);
		
		TWITTERBAR_COMMON.load();
	},
	
	unload : function () {
		TWITTERBAR.prefs.removeObserver("", this);
		
		document.getElementById("browsers").removeEventListener("load", TWITTERBAR.DOMContentLoaded, true);
		document.getElementById("urlbar-edit").removeEventListener("blur", TWITTERBAR.blur, true);
		document.getElementById("urlbar-edit").removeEventListener("focus", TWITTERBAR.focus, true);
		
		document.getElementById("addons-list").removeEventListener("AddonOptionsLoad", TWITTERBAR_OPTIONS.mobileInit, false);
		
		clearInterval(TWITTERBAR.trendTimer);
	},
	
	observe : function(subject, topic, data) {
		if (topic != "nsPref:changed") {
			return;
		}
		
		switch(data) {
			case "button":
				if (document.getElementById("twitterBox")) {
					document.getElementById("twitterBox").setAttribute("hidden", buttonMode);
				}
			break;
			case "debug":
				TWITTERBAR.debug = true;//TWITTERBAR.prefs.getBoolPref("debug");
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
			else if (TWITTERBAR.prefs.getBoolPref("showTrends")){
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
		var status = document.getElementById("urlbar-edit").value;
		
		if (status.match(/^https?:\/\//i)) {
			TWITTERBAR.lastUrl = status;
		}
		
		document.getElementById("twitter-statusbarbutton").style.display = '';
	},
	
	blur : function () {
		document.getElementById("twitter-statusbarbutton").style.display = 'none';
	},
	
	count : function () {
		var length = this.getCharCount();
		
		if (length > 140) {
			document.getElementById("twitter-statusbarbutton").setAttribute("toolong", "true");
		}
		else {
			document.getElementById("twitter-statusbarbutton").removeAttribute("toolong");
		}
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
	
	oAuthorize : function (hidePrompt, lastAccount) {
		function callback(req) {
			if (req.status == 200) {
				var parts = req.responseText.split("&");
			
				try {
					TWITTERBAR_COMMON.oauth.request_token.oauth_token = parts[0].split("=")[1];
					TWITTERBAR_COMMON.oauth.request_token.oauth_token_secret = parts[1].split("=")[1];
					
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
						Browser.addTab("http://twitter.com/oauth/authorize?oauth_token="+TWITTERBAR_COMMON.oauth.request_token.oauth_token, true);
						BrowserUI.activeDialog.close();
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
		
		var urlbar = document.getElementById("urlbar-edit");
		var status = urlbar.value;
		
		TWITTERBAR.startPost(status);
	},
	
	postRequest : function (status) {
		if (TWITTERBAR.debug) {
			TWITTERBAR.log("postRequest: " + status);
		}
		
		TWITTERBAR.lastTweet = status;
		
		if (!TWITTERBAR_COMMON.oauth_token || !TWITTERBAR_COMMON.oauth_token_secret) {
			TWITTERBAR.afterPost(true);
			
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
		
		function callback(req) {
			document.getElementById("twitter-statusbarbutton").removeAttribute("busy");
			
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
					document.getElementById("urlbar-edit").value = TWITTERBAR_COMMON.strings.getString("twitterbar.success");
					
					var json = JSON.parse(req.responseText);
					
					setTimeout(function () { TWITTERBAR.afterPost(false, json.status.user.screen_name); }, 1000);
				}
			}
			else {
				TWITTERBAR_COMMON.alert(TWITTERBAR_COMMON.strings.getFormattedString("twitterbar.otherError", [ req.status, req.responseText ]));
			}
			
			TWITTERBAR.covertMode = false;
		}
		
		var args = [
				["source","twitterbar"],
				["status", status]
			];
		
		TWITTERBAR_COMMON.apiRequest("http://twitter.com/statuses/update.json", callback, args, "POST");
	},
	
	afterPost : function (noSuccess, screenname) {
		var urlbar = document.getElementById("urlbar-edit");
		urlbar.value = this.lastUrl;
		
		if (!noSuccess && TWITTERBAR.prefs.getBoolPref("tab")){
			var url = "http://twitter.com/";
			
			if (screenname) {
				url += screenname;
			}
			
			Browser.addTab(url, true);
			BrowserUI.activeDialog.close();
		}
		
		document.getElementById("twitter-statusbarbutton").removeAttribute("busy");
	},
	
	getCharCount : function () {
		var status = document.getElementById("urlbar-edit").value;
		status = status.replace("$$", content.document.title);
		
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
	
	postKey : function (e) {
		if (!e || (e.keyCode != e.DOM_VK_RETURN && e.keyCode != 117 && e.keyCode != 76 && e.keyCode != 68 && e.keyCode != 17 && e.keyCode != 18)){
			var urlbar = document.getElementById("urlbar-edit");
			var status = urlbar.value;

			if (status.indexOf(" --post") != -1){
				var status = status.split(" --post")[0];
				
				TWITTERBAR.startPost(status);
			}
			else if (status.indexOf("--account") != -1) {
				TWITTERBAR_COMMON.currentAccount = "";
				
				this.addAccount();
			}
		}
	},
	
	startPost : function (status) {
		status = status.replace("$$", content.document.title);

		document.getElementById("twitter-statusbarbutton").setAttribute("busy","true");
		
		var account = "";
		
		if (status.indexOf(" --@") != -1) {
			account = status.split(" --@")[1].replace(/^\s+|\s+$/g, "");
			TWITTERBAR_COMMON.currentAccount = account;
			status = status.split(" --@")[0];
		}
		
		if (status.match(/^https?:\/\/[^\s]+$/i)) {
			this.lastUrl = status;
			
			var prefix = (TWITTERBAR.prefs.getCharPref("web").replace("$$", content.document.title).replace(/^\s+|\s+$/, "") + " ");
			status = prefix + status;
		}
		
		var urlbar = document.getElementById("urlbar-edit");
		
		if (!account) {
			var accounts = TWITTERBAR_COMMON.accounts;
			var lastAccount = "";
			
			var j = 0;
			
			for (var i in accounts) {
				lastAccount = i;
				j++;
			}
			
			if (j == 1) {
				account = lastAccount;
			}
			else {
				var rv = [];
				
				window.openDialog('chrome://twitterbar/content/dialogs/accountPrompt.xul','twitterbar-prompt','chrome,modal', accounts, rv);
				
				if (!rv[0]) {
					urlbar.value = status;
					return;
				}
				else {
					account = rv[0];
				}
			}
		}
		
		
		urlbar.value = TWITTERBAR_COMMON.strings.getString("twitterbar.posting");
		
		TWITTERBAR_SHORTENERS.shortenUrls(status, function (status) { TWITTERBAR.postRequest(status); });
	},
	
	log : function (message) {
		var consoleService = Components.classes["@mozilla.org/consoleservice;1"].getService(Components.interfaces.nsIConsoleService);
		consoleService.logStringMessage("TWITTERBAR: " + message);
	}
};