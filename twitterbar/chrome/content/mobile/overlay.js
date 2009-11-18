var TWITTERBAR = {
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
		
		if (TWITTERBAR.prefs.getCharPref("version") != this.version) {
			TWITTERBAR.prefs.setCharPref("version", this.version);
			
			setTimeout(function () {
				Browser.addTab("http://www.chrisfinke.com/firstrun/twitterbar.php", true);
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
	},
	
	unload : function () {
		TWITTERBAR.prefs.removeObserver("", this);
		
		document.getElementById("browsers").removeEventListener("load", TWITTERBAR.DOMContentLoaded, true);
		document.getElementById("urlbar-edit").removeEventListener("blur", TWITTERBAR.blur, true);
		document.getElementById("urlbar-edit").removeEventListener("focus", TWITTERBAR.focus, true);
		
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
		TWITTERBAR.prefs.setCharPref("oauth_username", "");
		TWITTERBAR.prefs.setCharPref("access_token.oauth_token", "");
		TWITTERBAR.prefs.setCharPref("access_token.oauth_token_secret", "");
		TWITTERBAR.prefs.setCharPref("oauth_timestamp", "");
		
		this.oAuthorize();
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
					
						if (TWITTERBAR_COMMON.confirm(TWITTERBAR_COMMON.strings.getString("twitterbar.oauthRequest1") + "\n\n" + TWITTERBAR_COMMON.strings.getString("twitterbar.oauthRequest2"))) {
							Browser.addTab("http://twitter.com/oauth/authorize?oauth_token="+TWITTERBAR_COMMON.oauth.request_token.oauth_token, true);
							BrowserUI.activeDialog.close();
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
		
		document.getElementById("twitter-statusbarbutton").setAttribute("busy","true");
		
		var urlbar = document.getElementById("urlbar-edit");
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
				document.getElementById("twitter-statusbarbutton").removeAttribute("busy");
				
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
						document.getElementById("urlbar-edit").value = TWITTERBAR_COMMON.strings.getString("twitterbar.success");

						setTimeout(function () { TWITTERBAR.afterPost(); }, 1000);
					}
				}
				else {
					TWITTERBAR_COMMON.alert(TWITTERBAR_COMMON.strings.getFormattedString("twitterbar.otherError", [ req.status, req.responseText ]));
				}
				
				TWITTERBAR.covertMode = false;
			}
		};
		
		req.send(argstring);
	},
	
	afterPost : function () {
		var urlbar = document.getElementById("urlbar-edit");
		urlbar.value = this.lastUrl;
		
		if (TWITTERBAR.prefs.getBoolPref("tab")){
			Browser.addTab("http://twitter.com/" + TWITTERBAR.prefs.getCharPref("oauth_username"), true);
			BrowserUI.activeDialog.close();
		}
	},
	
	getCharCount : function () {
		var status = document.getElementById("urlbar-edit").value;
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
	
	postKey : function (e) {
		if (!e || (e.keyCode != e.DOM_VK_RETURN && e.keyCode != 117 && e.keyCode != 76 && e.keyCode != 68 && e.keyCode != 17 && e.keyCode != 18)){
			var urlbar = document.getElementById("urlbar-edit");
			var status = urlbar.value;

			if (status.indexOf(" --post") != -1){
				var status = status.split(" --post")[0].replace("$$", content.document.title);
				
				if (status.match(/^https?:\/\//i)) {
					var webtext = (TWITTERBAR.prefs.getCharPref("web").replace("$$", content.document.title).replace(/^\s+|\s+$/, "") + " ");
					status = webtext + status;
				}
				
				status = status.replace("$$", content.document.title)
				
				urlbar.value = TWITTERBAR_COMMON.strings.getString("twitterbar.posting");
				
				document.getElementById('twitter-statusbarbutton').setAttribute("busy", "true");
				
				TWITTERBAR_SHORTENERS.shortenUrls(status, function (status) { TWITTERBAR.postRequest(status); });
			}
		}
	}
};