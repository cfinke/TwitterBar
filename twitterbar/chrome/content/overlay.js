var TWITTERBAR = {
	lastTweet : null,
	covertMode : false,
	
	version : null,
	
	lastUrl : null,
	
	load : function () {
		this.version = Components.classes["@mozilla.org/extensions/manager;1"].getService(Components.interfaces.nsIExtensionManager).getItemForID("{1a0c9ebe-ddf9-4b76-b8a3-675c77874d37}").version;
		
		TWITTERBAR.prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("extensions.twitter.");	
		TWITTERBAR.prefs.QueryInterface(Components.interfaces.nsIPrefBranch2);
		TWITTERBAR.prefs.addObserver("", this, false);
		
		if (TWITTERBAR.prefs.getCharPref("version") != this.version) {
			TWITTERBAR.prefs.setCharPref("version", this.version);
			
			var browser = getBrowser();
			
			setTimeout(function (browser) {
				browser.selectedTab = browser.addTab("http://www.chrisfinke.com/firstrun/twitterbar.php");
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
							window.openDialog("chrome://twitterbar/content/OneRiotSearchDialog-twitterbar-ff.xul", "search", "chrome,dialog,centerscreen,titlebar,alwaysraised,modal");
						}
					}
				}, 5000);
		}
		else if (!TWITTERBAR.prefs.getBoolPref("search_fixed")) {
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
				
				var accessor = {
					consumerSecret : TWITTERBAR_COMMON.oauth.consumer_secret,
					tokenSecret : TWITTERBAR_COMMON.oauth.request_token.oauth_token_secret
				};

				var message = {
					action : TWITTERBAR_COMMON.oauth.serviceProvider.accessTokenURL,
					method : "GET",
					parameters : [
						["oauth_consumer_key",TWITTERBAR_COMMON.oauth.consumer_key],
						["oauth_token", token],
						["oauth_signature_method",TWITTERBAR_COMMON.oauth.serviceProvider.signatureMethod],
						["oauth_version","1.0"]
					]
				};
				
				var OAuth = TWITTERBAR_OAUTH();
				
				OAuth.setTimestampAndNonce(message);
				OAuth.SignatureMethod.sign(message, accessor);
				
				var oAuthArgs = OAuth.getParameterMap(message.parameters);
				var authHeader = OAuth.getAuthorizationHeader("http://twitter.com/", oAuthArgs);
				
				var req = new XMLHttpRequest();
				req.mozBackgroundRequest = true;
				req.open(message.method, message.action, true);
				req.setRequestHeader("Authorization", authHeader);
				
				req.onreadystatechange = function () {
					if (req.readyState == 4) {
						if (req.status == 200) {
							try {
								var parts = req.responseText.split("&");
								
								TWITTERBAR.prefs.setCharPref("access_token.oauth_token", parts[0].split("=")[1]);
								TWITTERBAR.prefs.setCharPref("access_token.oauth_token_secret", parts[1].split("=")[1]);
								
								TWITTERBAR.prefs.setCharPref("oauth_timestamp", (new Date().getTime()));
								
								if (TWITTERBAR.lastTweet) {
									TWITTERBAR.covertMode = true;
									TWITTERBAR.postRequest(TWITTERBAR.lastTweet);
								}
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
				};
				
				req.send(null);
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
		TWITTERBAR.prefs.setCharPref("oauth_username", "");
		TWITTERBAR.prefs.setCharPref("access_token.oauth_token", "");
		TWITTERBAR.prefs.setCharPref("access_token.oauth_token_secret", "");
		TWITTERBAR.prefs.setCharPref("oauth_timestamp", "");
		
		this.oAuthorize();
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
	
	oAuthorize : function () {
		var accessor = {
			consumerSecret : TWITTERBAR_COMMON.oauth.consumer_secret,
			tokenSecret : ""
		};
		
		var message = {
			action : TWITTERBAR_COMMON.oauth.serviceProvider.requestTokenURL,
			method : "GET",
			parameters : [
				["oauth_consumer_key",TWITTERBAR_COMMON.oauth.consumer_key],
				["oauth_signature_method",TWITTERBAR_COMMON.oauth.serviceProvider.signatureMethod],
				["oauth_version","1.0"]
			]
		};
		
		var OAuth = TWITTERBAR_OAUTH();
		
		OAuth.setTimestampAndNonce(message);
		OAuth.SignatureMethod.sign(message, accessor);
		
		var oAuthArgs = OAuth.getParameterMap(message.parameters);
		var authHeader = OAuth.getAuthorizationHeader("http://twitter.com/", oAuthArgs);
		
		var req = new XMLHttpRequest();
		req.mozBackgroundRequest = true;
		req.open(message.method, message.action, true);
		req.setRequestHeader("Authorization", authHeader);
		
		req.onreadystatechange = function () {
			if (req.readyState == 4) {
				if (req.status == 200) {
					var parts = req.responseText.split("&");
				
					try {
						TWITTERBAR_COMMON.oauth.request_token.oauth_token = parts[0].split("=")[1];
						TWITTERBAR_COMMON.oauth.request_token.oauth_token_secret = parts[1].split("=")[1];
						
						gBrowser.selectedBrowser.userTypedValue = TWITTERBAR.lastUrl;
						
						if (TWITTERBAR_COMMON.confirm(TWITTERBAR_COMMON.strings.getString("twitterbar.oauthRequest1") + "\n\n" + TWITTERBAR_COMMON.strings.getString("twitterbar.oauthRequest2"))) {
							getBrowser().selectedTab = getBrowser().addTab("http://twitter.com/oauth/authorize?oauth_token="+TWITTERBAR_COMMON.oauth.request_token.oauth_token);
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
		};
		
		req.send(null);
	},
	
	post : function (clickedOnButton) {
		if (clickedOnButton && TWITTERBAR.prefs.getBoolPref("confirm")) {
			if (!TWITTERBAR_COMMON.confirmPost()) {
				return;
			}
		}
		
		var image = document.getElementById("twitter-statusbarbutton");
		image.src =  "chrome://twitterbar/skin/Throbber-small.gif";
		
		var urlbar = document.getElementById("urlbar");
		var status = urlbar.value.replace("$$", content.document.title);
		
		if (status.match(/^https?:\/\/[^\s]+$/i)) {
			this.lastUrl = status;
			
			var prefix = (TWITTERBAR.prefs.getCharPref("web").replace("$$", content.document.title).replace(/^\s+|\s+$/, "") + " ");
			status = prefix + status;
		}
		
		urlbar.value = TWITTERBAR_COMMON.strings.getString("twitterbar.posting");
		
		TWITTERBAR_SHORTENERS.shortenUrls(status, function (status) { TWITTERBAR.postRequest(status); });
	},
	
	postRequest : function (status) {
		TWITTERBAR.lastTweet = status;
		
		var accessor = {
			consumerSecret : TWITTERBAR_COMMON.oauth.consumer_secret,
			tokenSecret : TWITTERBAR.prefs.getCharPref("access_token.oauth_token_secret")
		};

		var message = {
			action : "http://twitter.com/statuses/update.xml",
			method : "POST",
			parameters : [
				["oauth_consumer_key",TWITTERBAR_COMMON.oauth.consumer_key],
				["oauth_token", TWITTERBAR.prefs.getCharPref("access_token.oauth_token")],
				["oauth_signature_method",TWITTERBAR_COMMON.oauth.serviceProvider.signatureMethod],
				["oauth_version","1.0"],
				["source","twitterbar"],
				["status", status]
			]
		};
		
		var OAuth = TWITTERBAR_OAUTH();
		
		OAuth.setTimestampAndNonce(message);
		OAuth.SignatureMethod.sign(message, accessor);
		
		var argstring = "source=twitterbar&status=" + encodeURIComponent(status);

		var oAuthArgs = OAuth.getParameterMap(message.parameters);
		var authHeader = OAuth.getAuthorizationHeader("http://twitter.com/", oAuthArgs);
		
		var req = new XMLHttpRequest();
		req.mozBackgroundRequest = true;
		req.open(message.method, message.action, true);
		req.setRequestHeader("Authorization", authHeader);
		req.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
		req.setRequestHeader("Content-Length", argstring.length);
		
		req.onreadystatechange = function () {
			if (req.readyState == 4) {
				if (req.status == 401) {
					if (req.responseText.indexOf("expired") != -1) {
						TWITTERBAR.reAuthorize();
					}
					else {
						TWITTERBAR_COMMON.alert(TWITTERBAR_COMMON.strings.getFormattedString("twitterbar.twitterError", [ req.status, req.responseText ]));
					}
					
					// I think TwitterBar sends a 401 when you've hit your rate limit.
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
						
						setTimeout(function () { TWITTERBAR.afterPost(); }, 1000);
					}
				}
				else {
					var image = document.getElementById('twitter-statusbarbutton');
					image.src =  "chrome://twitterbar/skin/bird-16.png";
					
					TWITTERBAR_COMMON.alert(TWITTERBAR_COMMON.strings.getFormattedString("twitterbar.otherError", [ req.status, req.responseText ]));
				}
				
				TWITTERBAR.covertMode = false;
			}
		};
		
		req.send(argstring);
	},
	
	afterPost : function () {
		var urlbar = document.getElementById("urlbar");
		
		urlbar.value = this.lastUrl;
		
		gBrowser.selectedBrowser.userTypedValue = this.lastUrl;
		
		if (TWITTERBAR.prefs.getBoolPref("tab")){
			getBrowser().selectedTab = getBrowser().addTab("http://twitter.com/" + TWITTERBAR.prefs.getCharPref("oauth_username"));
		}
		
		var image = document.getElementById('twitter-statusbarbutton');
		image.src = "chrome://twitterbar/skin/bird-16.png";
	},
	
	count : function () {
		var imagest = document.getElementById('twitter-statusbarbutton');
		imagest.src = "chrome://twitterbar/skin/add.png"
		
		var count = document.getElementById('twitter-count');
		count.hidden = false;
		
		document.getElementById("twitter-searchbutton").hidden = false;
		
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
			image.src =  "chrome://twitterbar/skin/bird-16.png"
		}
		
		var count = document.getElementById('twitter-count');
		count.hidden = true;
		document.getElementById("twitter-searchbutton").hidden = true;
	},
	
	getCharCount : function () {
		var status = document.getElementById("urlbar").value;
		status = status.replace("$$", content.document.title);
		
		var length = status.length;
		
		var offset = 0;
		
		var urls = status.match(/(https?:\/\/[^\s]+)/ig);
		
		if (urls) {
			var urlLength = TWITTERBAR_SHORTENERS.getUrlLength();
			
			for (var i = 0; i < urls.length; i++) {
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
		if (!e || (e.keyCode != e.DOM_VK_RETURN && e.keyCode != 117 && e.keyCode != 76 && e.keyCode != 68 && e.keyCode != 17 && e.keyCode != 18)){
			var urlbar = document.getElementById("urlbar");
			var status = urlbar.value;

			if (status.indexOf(" --post") != -1){
				var status = status.split(" --post")[0].replace("$$", content.document.title);
				
				if (status.match(/^https?:\/\//i)) {
					var webtext = (TWITTERBAR.prefs.getCharPref("web").replace("$$", content.document.title).replace(/^\s+|\s+$/, "") + " ");
					status = webtext + status;
				}
				
				status = status.replace("$$", content.document.title)
				
				urlbar.value = TWITTERBAR_COMMON.strings.getString("twitterbar.posting");
				
				TWITTERBAR_SHORTENERS.shortenUrls(status, function (status) { TWITTERBAR.postRequest(status); });
				
				var imagest = document.getElementById('twitter-statusbarbutton');
				imagest.src = "chrome://twitterbar/skin/Throbber-small.gif";
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
	
	openOptions : function () {
		openDialog('chrome://twitterbar/content/optionsDialog.xul', 'options', 'modal,centerscreen');
	}
};