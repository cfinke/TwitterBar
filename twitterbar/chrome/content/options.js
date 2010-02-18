var TWITTERBAR_OPTIONS = {
	prefs : null,
	
	get strings() { return document.getElementById("twitterbar-strings"); },
	
	init : function () {
		addEventListener("unload", TWITTERBAR_OPTIONS.unload, false);
		
		TWITTERBAR_OPTIONS.prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).QueryInterface(Components.interfaces.nsIPrefBranch).getBranch("extensions.twitter.");
		TWITTERBAR_OPTIONS.prefs.QueryInterface(Components.interfaces.nsIPrefBranch2);
		TWITTERBAR_OPTIONS.prefs.addObserver("", TWITTERBAR_OPTIONS, false);
		
		TWITTERBAR_OPTIONS.shortenerChange();
		TWITTERBAR_OPTIONS.showAccounts();
		
		sizeToContent();
	},
	
	unload : function () {
		removeEventListener("unload", TWITTERBAR_OPTIONS.unload, false);
		
		TWITTERBAR_OPTIONS.prefs.removeObserver("", TWITTERBAR_OPTIONS);
	},
	
	showAccounts : function () {
		TWITTERBAR_COMMON.setUpAccount();
		
		var container = document.getElementById("auth-rows");
		
		var children = container.childNodes;
		var len = children.length;
		
		for (var i = len - 1; i >= 1; i--) {
			container.removeChild(container.lastChild);
		}
		
		// List the authorized accounts, a remove button for each, and a button to add a new account.
		var accounts = TWITTERBAR_COMMON.accounts;
		
		for (var i in accounts) {
			if (i != "_twitterbar" && accounts[i].token) {
				var oDate = new Date();
				oDate.setTime(accounts[i].timestamp);
			
				var row = document.createElement("row");
				row.setAttribute("align", "center");
				
				var name = document.createElement("label");
				name.setAttribute("value", i);
			
				var date = document.createElement("label");
				date.setAttribute("value", oDate.toDateString());
			
				var button = document.createElement("button");
				button.setAttribute("label", "Remove");
				button.account = i;
				button.setAttribute("oncommand", "TWITTERBAR_COMMON.unsetAccount(this.account);");
			
				row.appendChild(name);
				row.appendChild(date);
				row.appendChild(button);
			
				container.appendChild(row);
			}
		}
		
		sizeToContent();
	},
	
	observe : function(subject, topic, data) {
		if (topic != "nsPref:changed") {
			return;
		}
		
		switch(data) {
			case "accounts":
				TWITTERBAR_OPTIONS.showAccounts();
			break;
		}
	},

	mobileInit : function (e) {
		if (document.getElementById("twitterbar-shortener-menu")) {
			document.getElementById("twitterbar-shortener-menu").value = TWITTERBAR_OPTIONS.prefs.getCharPref("shortener");
			
			TWITTERBAR_OPTIONS.init();
		}
	},

	setShortener : function () {
		TWITTERBAR_OPTIONS.prefs.setCharPref("shortener", document.getElementById("twitterbar-shortener-menu").selectedItem.getAttribute("value"));
		
		TWITTERBAR_OPTIONS.shortenerChange();
	},
	
	shortenerChange : function () {
		if (document.getElementById("twitterbar-shortener-menu")) {
			if (document.getElementById("twitterbar-shortener-menu").selectedItem.getAttribute("value") == "bitly") {
				if (document.getElementById("bitly-options")) {
					document.getElementById("bitly-options").style.display = '';
				}
				if (document.getElementById("twitter-bitly-login")) {
					document.getElementById("twitter-bitly-login").style.display = '';
				}
				if (document.getElementById("twitter-bitly-api-key")) {
					document.getElementById("twitter-bitly-api-key").style.display = '';
				}
			}
			else {
				if (document.getElementById("bitly-options")) {
					document.getElementById("bitly-options").style.display = 'none';
				}
				if (document.getElementById("twitter-bitly-login")) {
					document.getElementById("twitter-bitly-login").style.display = 'none';
				}
				if (document.getElementById("twitter-bitly-api-key")) {
					document.getElementById("twitter-bitly-api-key").style.display = 'none';
				}
			}
		}
	},
	
	accept : function () {
	    if (!document.getElementById("twitterbar-preference-window").instantApply) {
		    TWITTERBAR_OPTIONS.prefs.setBoolPref("confirm", document.getElementById("pref-confirm").value);
		    TWITTERBAR_OPTIONS.prefs.setCharPref("web", document.getElementById("pref-prefix").value);
		    TWITTERBAR_OPTIONS.prefs.setBoolPref("tab", document.getElementById("pref-open-after").value);
		    TWITTERBAR_OPTIONS.prefs.setBoolPref("button", document.getElementById("pref-hide-button").value);
		    TWITTERBAR_OPTIONS.prefs.setBoolPref("oneriotButton", document.getElementById("pref-hide-oneriot").value);
		    TWITTERBAR_OPTIONS.prefs.setCharPref("shortener", document.getElementById("pref-shortener").value);
		    TWITTERBAR_OPTIONS.prefs.setBoolPref("showTrends", document.getElementById("pref-show-trends").value);
		}
		
		return true;
	},
	
	clearAuth : function () {
		/* todo */
    }
};