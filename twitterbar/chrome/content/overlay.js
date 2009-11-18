var TWITTERBAR = {
	get strings() { return document.getElementById("twitterbar-strings"); },
	version : null,
	
	lastUrl : null,
	
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
	
	getUrlLength : function () {
		var shortener = this.prefs.getCharPref("shortener");
		
		if (shortener == "tinyurl") {
			return 25;
		}
		else if (shortener == "") {
			// Twitter uses bit.ly.
			return 20;
		}
		else {
			// is.gd
			return 18;
		}
	},
	
	getBrowser: function () {
		if (typeof getBrowser != 'undefined') {
			return getBrowser();
		}
		else {
			return Browser;
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
	
	confirmPost : function () {
		var title = this.strings.getString("twitterbar.alertTitle");
		var msg = this.strings.getString("twitterbar.confirmPostToTwitter");
		var cbMsg = this.strings.getString("twitterbar.confirmPrefString");
		
		var prompts = Components.classes["@mozilla.org/embedcomp/prompt-service;1"]
								.getService(Components.interfaces.nsIPromptService);

		var check = { value : TWITTERBAR.prefs.getBoolPref("confirm") };
		var result = prompts.confirmCheck(null, title, msg, cbMsg, check);
		
		if (result) {
			this.prefs.setBoolPref("confirm", check.value);
			return true;
		}
		
		return false;
	},
	
	load : function () {
		this.version = Components.classes["@mozilla.org/extensions/manager;1"].getService(Components.interfaces.nsIExtensionManager).getItemForID("{1a0c9ebe-ddf9-4b76-b8a3-675c77874d37}").version;
		
		this.prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).getBranch("extensions.twitter.");	
		this.prefs.QueryInterface(Components.interfaces.nsIPrefBranch2);
		this.prefs.addObserver("", this, false);
		
		var version = Components.classes["@mozilla.org/extensions/manager;1"].getService(Components.interfaces.nsIExtensionManager).getItemForID("{1a0c9ebe-ddf9-4b76-b8a3-675c77874d37}").version;
		
		if (this.prefs.getCharPref("version") != version) {
			this.prefs.setCharPref("version", version);
			
			var browser = this.getBrowser();
			
			setTimeout(function (browser) {
				browser.selectedTab = browser.addTab("http://www.chrisfinke.com/firstrun/twitterbar.php");
			}, 3000, browser);
		}
		
		var engineLabel = TWITTERBAR.strings.getString("twitter.search.name");
		
		if (!this.prefs.getBoolPref("search_request")) {
			this.prefs.setBoolPref("search_request", true);
			
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
		else if (!this.prefs.getBoolPref("search_fixed")) {
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
	
		if (document.getElementById("urlbar-edit")) {
			var oldsearchcomplete = document.getElementById("urlbar-edit").getAttribute("onsearchcomplete");
			
			document.getElementById("urlbar-edit").setAttribute("onsearchcomplete", "if (!TWITTERBAR.postKey()) { " + oldsearchcomplete + "}");
			document.getElementById("urlbar-edit").addEventListener("focus", function () { TWITTERBAR.focus(); }, false);
		}
		
		if (document.getElementById("urlbar")) {
			document.getElementById("urlbar").addEventListener("keyup", function (event) { TWITTERBAR.postKey(event); }, false);
			document.getElementById("urlbar").addEventListener("focus", function () { TWITTERBAR.focus(); }, false);
		}
		
		this.buttonCheck();
		
		try {
			var browsers = document.getElementById("browsers");
			browsers.addEventListener("load", TWITTERBAR.getAccessToken, true);
		} catch (notFennec) {
			getBrowser().addEventListener("load", TWITTERBAR.getAccessToken, true);
		}

		var appcontent = document.getElementById("content");
		
		if (appcontent) {
			appcontent.addEventListener("DOMContentLoaded", TWITTERBAR.DOMContentLoaded, true);
		}
		
		// Get new trends every 2 hours.
		TWITTERBAR.trendTimer = setInterval(function () { TWITTERBAR.getTrends(); }, 1000 * 60 * 60 * 2);
		
		setTimeout(function() { TWITTERBAR.getTrends(); }, 1000 * 10);
	},
	
	unload : function () {
		this.prefs.removeObserver("", this);
		
		try {
			document.getElementById("browsers").removeEventListener("load", TWITTERBAR.getAccessToken, true);
		} catch (notFennec) {
			getBrowser().removeEventListener("load", TWITTERBAR.getAccessToken, true);
		}

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

				var buttonMode = this.prefs.getBoolPref("button").toString();

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

				var buttonMode = this.prefs.getBoolPref("oneriotButton").toString();

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
		if (TWITTERBAR.prefs.getBoolPref("showTrends")) {
			var page = event.target;
		
			try {
				if (!page.location.host.match(/^twitter\.com$/)) {
					return;
				}
			} catch (e) {
				return;
			}
		
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
		}
	},
	
	buttonCheck : function () {
		try {
			var mode = this.prefs.getBoolPref("button");
			var button = document.getElementById("twitterBox");
			
			button.setAttribute("hidden", mode.toString());
		} catch (e) { }
		
		try {
			var mode = this.prefs.getBoolPref("oneriotButton");
			var button = document.getElementById("twitter-oneriot-box");
			
			button.setAttribute("hidden", mode.toString());
		} catch (e) { }
	},
	
	focus : function () {
		var status = (document.getElementById("urlbar") || document.getElementById("urlbar-edit")).value;
		
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
	
	getSearchURL : function (search_terms, source) {
		search_terms = encodeURIComponent(search_terms);
		search_terms = search_terms.replace(/%20/g, "+");
		
		if (!source) { 
			source = "browserBox";
		}
		
		return "http://www.oneriot.com/search?q=" + search_terms + "&format=html&ssrc="+source+"&spid=86f2f5da-3b24-4a87-bbb3-1ad47525359d&p=twitterbar-ff/"+TWITTERBAR.version;
	},
	
	search : function (event, source) {
		var status = (document.getElementById("urlbar") || document.getElementById("urlbar-edit")).value;
		
		if (status.match(/^(https?:\/\/[^\s]+)$/ig)) {
			var search_terms = status;
		}
		else {
			var search_terms = status.replace(/https?:\/\/[^\s]+/ig, "");
		}

		search_terms = search_terms.replace(" --search", "");
		
		openUILink(TWITTERBAR.getSearchURL(search_terms, source), event, false, true);
	},
	
	oAuthorize : function () {
		var accessor = {
			consumerSecret : TWITTERBAR.oauth.consumer_secret,
			tokenSecret : ""
		};
		
		var message = {
			action : TWITTERBAR.oauth.serviceProvider.requestTokenURL,
			method : "GET",
			parameters : [
				["oauth_consumer_key",TWITTERBAR.oauth.consumer_key],
				["oauth_signature_method",TWITTERBAR.oauth.serviceProvider.signatureMethod],
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
						TWITTERBAR.oauth.request_token.oauth_token = parts[0].split("=")[1];
						TWITTERBAR.oauth.request_token.oauth_token_secret = parts[1].split("=")[1];
					
						if (TWITTERBAR.confirm(TWITTERBAR.strings.getString("twitterbar.oauthRequest1") + "\n\n" + TWITTERBAR.strings.getString("twitterbar.oauthRequest2"))) {
							try {
								TWITTERBAR.getBrowser().selectedTab = TWITTERBAR.getBrowser().addTab("http://twitter.com/oauth/authorize?oauth_token="+TWITTERBAR.oauth.request_token.oauth_token);
							} catch (fennec) {
								content.location.href = "http://twitter.com/oauth/authorize?oauth_token="+TWITTERBAR.oauth.request_token.oauth_token;
							}
						}
					} catch (e) {
						TWITTERBAR.alert(TWITTERBAR.strings.getString("twitterbar.oauthError1") + "\n\n" + e + "\n\n" + req.responseText);
					}
				}
				else if (req.status >= 500) {
					TWITTERBAR.alert(TWITTERBAR.strings.getString("twitterbar.failWhale"));
				}
				else {
					TWITTERBAR.alert(TWITTERBAR.strings.getFormattedString("twitterbar.otherError", [ req.status, req.responseText ]));
				}
			}
		};
		
		req.send(null);
	},
	
	getAccessToken : function (event) {
		if (event.originalTarget instanceof HTMLDocument) {
			var doc = event.originalTarget;
			
			if (doc.location.href.match(/chrisfinke.com\/oauth\/twitterbar/i)) {
				var urlArgs = doc.location.href.split("?")[1].split("&");
				
				var token = "";
				
				for (var i = 0; i < urlArgs.length; i++) {
					var argParts = urlArgs[i].split("=");
					
					if (argParts[0] == "oauth_token"){
						token = argParts[1];
					}
				}
				
				var accessor = {
					consumerSecret : TWITTERBAR.oauth.consumer_secret,
					tokenSecret : TWITTERBAR.oauth.request_token.oauth_token_secret
				};

				var message = {
					action : TWITTERBAR.oauth.serviceProvider.accessTokenURL,
					method : "GET",
					parameters : [
						["oauth_consumer_key",TWITTERBAR.oauth.consumer_key],
						["oauth_token", token],
						["oauth_signature_method",TWITTERBAR.oauth.serviceProvider.signatureMethod],
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
							} catch (e) {
								TWITTERBAR.alert(TWITTERBAR.strings.getFormattedString("twitterbar.otherError", [ e, req.responseText ]));
							}
						}
						else if (req.status >= 500) {
							TWITTERBAR.alert(TWITTERBAR.strings.getString("twitterbar.failWhale"));
						}
						else {
							TWITTERBAR.alert(TWITTERBAR.strings.getFormattedString("twitterbar.otherError", [ req.status, req.responseText ]));
						}
					}
				};

				req.send(null);
			}
		}
	},
	
	post : function (clickedOnButton) {
		if (clickedOnButton && this.prefs.getBoolPref("confirm")) {
			if (!this.confirmPost()) {
				return;
			}
		}
		
		var image = document.getElementById("twitter-statusbarbutton");
		image.src =  "chrome://twitterbar/skin/Throbber-small.gif";
		
		var urlbar = (document.getElementById("urlbar") || document.getElementById("urlbar-edit"));
		var status = urlbar.value.replace("$$", content.document.title);
		
		if (status.match(/^https?:\/\/[^\s]+$/i)) {
			this.lastUrl = status;
			
			var prefix = (this.prefs.getCharPref("web").replace("$$", content.document.title).replace(/^\s+|\s+$/, "") + " ");
			status = prefix + status;
		}
		
		urlbar.value = TWITTERBAR.strings.getString("twitterbar.posting");
		
		TWITTERBAR_SHORTENERS.shortenUrls(status, function (status) { TWITTERBAR.postRequest(status); });
	},
	
	postRequest : function (status) {
		var accessor = {
			consumerSecret : TWITTERBAR.oauth.consumer_secret,
			tokenSecret : TWITTERBAR.prefs.getCharPref("access_token.oauth_token_secret")
		};

		var message = {
			action : "http://twitter.com/statuses/update.xml",
			method : "POST",
			parameters : [
				["oauth_consumer_key",TWITTERBAR.oauth.consumer_key],
				["oauth_token", TWITTERBAR.prefs.getCharPref("access_token.oauth_token")],
				["oauth_signature_method",TWITTERBAR.oauth.serviceProvider.signatureMethod],
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
						TWITTERBAR.alert(TWITTERBAR.strings.getFormattedString("twitterbar.twitterError", [ req.status, req.responseText ]));
					}
					
					// I think TwitterBar sends a 401 when you've hit your rate limit.
					// This is the reason so many people complained about being asked to reauthorize.
				}
				else if (req.status >= 500) {
					TWITTERBAR.alert(TWITTERBAR.strings.getString("twitterbar.failWhale"));
				}
				else if (req.status == 200) {
					var urlbar = (document.getElementById("urlbar") || document.getElementById("urlbar-edit"));
					urlbar.value = TWITTERBAR.strings.getString("twitterbar.success");
					
					var image = document.getElementById("twitter-statusbarbutton");
					image.src =  "chrome://twitterbar/skin/accept.png";
				
					setTimeout(function () { TWITTERBAR.afterPost(); }, 1000);
				}
				else {
					var image = document.getElementById('twitter-statusbarbutton');
					image.src =  "chrome://twitterbar/skin/twitter.ico";
					
					TWITTERBAR.alert(TWITTERBAR.strings.getFormattedString("twitterbar.otherError", [ req.status, req.responseText ]));
				}
			}
		};
		
		req.send(argstring);
	},
	
	afterPost : function () {
		var urlbar = (document.getElementById("urlbar") || document.getElementById("urlbar-edit"));
		
		urlbar.value = this.lastUrl;
		
		try {
			gBrowser.selectedBrowser.userTypedValue = this.lastUrl;
		} catch (fennec) {
		}
		
		if (this.prefs.getBoolPref("tab")){
			try {
				TWITTERBAR.getBrowser().selectedTab = TWITTERBAR.getBrowser().addTab("http://twitter.com/" + this.prefs.getCharPref("oauth_username"));
			} catch (fennec) {
				Browser.addTab("http://twitter.com/" + this.prefs.getCharPref("oauth_username"));
			}
		}
		
		var image = document.getElementById('twitter-statusbarbutton');
		image.src = "chrome://twitterbar/skin/twitter.ico";
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
			image.src =  "chrome://twitterbar/skin/twitter.ico"
		}
		
		var count = document.getElementById('twitter-count');
		count.hidden = true;
		document.getElementById("twitter-searchbutton").hidden = true;
	},
	
	getCharCount : function () {
		var status = (document.getElementById("urlbar") || document.getElementById("urlbar-edit")).value;
		status = status.replace("$$", content.document.title);
		
		var length = status.length;
		
		var offset = 0;
		
		var urls = status.match(/(https?:\/\/[^\s]+)/ig);
		
		if (urls) {
			var urlLength = this.getUrlLength();
			
			for (var i = 0; i < urls.length; i++) {
				if (urls[i].length > urlLength) {
					offset += (urls[i].length - urlLength);
				}
			}
		}
		
		length -= offset;
		
		if (status.match(/^https?:\/\//i)) {
			var prefix = (this.prefs.getCharPref("web").replace("$$", content.document.title).replace(/^\s+|\s+$/, "") + " ");
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
			var urlbar = (document.getElementById("urlbar") || document.getElementById("urlbar-edit"));
			var status = urlbar.value;

			if (status.indexOf(" --post") != -1){
				var status = status.split(" --post")[0].replace("$$", content.document.title);
				
				if (status.match(/^https?:\/\//i)) {
					var webtext = (this.prefs.getCharPref("web").replace("$$", content.document.title).replace(/^\s+|\s+$/, "") + " ");
					status = webtext + status;
				}
				
				status = status.replace("$$", content.document.title)
				
				urlbar.value = this.strings.getString("twitterbar.posting");
				
				TWITTERBAR_SHORTENERS.shortenUrls(status, function (status) { TWITTERBAR.postRequest(status); });
				
				var imagest = document.getElementById('twitter-statusbarbutton');
				imagest.src = "chrome://twitterbar/skin/Throbber-small.gif";
			}
			else if (status.indexOf("--options") != -1){
				urlbar.value = this.lastUrl;
				
				try {
					gBrowser.selectedBrowser.userTypedValue = this.lastUrl;
				} catch (fennec) {
				}
				
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
	}
};