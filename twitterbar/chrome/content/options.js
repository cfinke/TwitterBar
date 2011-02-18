var TWITTERBAR_OPTIONS = {
	prefs : null,
	
	load : function (e) {
		removeEventListener("load", TWITTERBAR_OPTIONS.load, false);
		
		TWITTERBAR_OPTIONS.prefs = Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).QueryInterface(Components.interfaces.nsIPrefBranch).getBranch("extensions.twitter.");
		TWITTERBAR_OPTIONS.prefs.QueryInterface(Components.interfaces.nsIPrefBranch2);
		TWITTERBAR_OPTIONS.prefs.addObserver("", TWITTERBAR_OPTIONS, false);
		
		TWITTERBAR_OPTIONS.shortenerChange();
		TWITTERBAR_OPTIONS.showAccounts();
		
		addEventListener("unload", TWITTERBAR_OPTIONS.unload, false);
	},
	
	unload : function () {
		removeEventListener("unload", TWITTERBAR_OPTIONS.unload, false);
		
		TWITTERBAR_OPTIONS.prefs.removeObserver("", TWITTERBAR_OPTIONS);
	},
	
	showAccounts : function () {
		var list = document.getElementById("twitter-accounts-list");
		
		if (list) {
			if (document.getElementById("accounts-deck")) {
				document.getElementById("accounts-deck").selectedIndex = 1;
			}
			
			TWITTERBAR.setUpAccount();
			
			list.removeAllItems();
			list.selectedIndex = -1;
			
			var accounts = TWITTERBAR.accounts;
			
			for (var i in accounts) {
				if (i != "_twitterbar" && accounts[i].token) {
					list.appendItem(i, i);
				
					list.selectedIndex = Math.max(0, list.selectedIndex);
				
					if (document.getElementById("accounts-deck")) {
						document.getElementById("accounts-deck").selectedIndex = 0;
					}
				}
			}
			
			if (list.selectedIndex >= 0) {
				TWITTERBAR_OPTIONS.showAccount(list.value);
			}
		}
	},
	
	showAccount : function (username) {
		if (document.getElementById("accounts-authtime")) {
			var accounts = TWITTERBAR.accounts;
			var account = accounts[username];
		
			var oDate = new Date();
			oDate.setTime(account.timestamp);
			document.getElementById("accounts-authtime").setAttribute("value", oDate.toDateString());
		}
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
	
	mobileLoad : function (e) {
		if (document.getElementById("twitterbar-shortener-menu")) {
			TWITTERBAR_OPTIONS.load(e);
			
			document.getElementById("twitterbar-shortener-menu").value = TWITTERBAR_OPTIONS.prefs.getCharPref("shortener");
			
			TWITTERBAR_OPTIONS.showAccounts();
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
		
		if (document.location.href == "chrome://twitterbar/content/options.xul") {
			// Kind of hacky way to avoid calling sizeToContent in Fennec.
			sizeToContent();
		}
	},
	
	accept : function () {
	    if (!document.getElementById("twitterbar-preference-window").instantApply) {
		    TWITTERBAR_OPTIONS.prefs.setBoolPref("confirm", document.getElementById("pref-confirm").value);
		    TWITTERBAR_OPTIONS.prefs.setCharPref("web", document.getElementById("pref-prefix").value);
		    TWITTERBAR_OPTIONS.prefs.setBoolPref("tab", document.getElementById("pref-open-after").value);
		    TWITTERBAR_OPTIONS.prefs.setBoolPref("button", document.getElementById("pref-hide-button").value);
		    TWITTERBAR_OPTIONS.prefs.setCharPref("shortener", document.getElementById("pref-shortener").value);
		}
		
		return true;
	},
	
	addAccount : function () {
		var wm = Components.classes["@mozilla.org/appshell/window-mediator;1"].getService(Components.interfaces.nsIWindowMediator);  
		var win = wm.getMostRecentWindow("navigator:browser");
		
		win.TWITTERBAR.addAccount(true);
		win.focus();
	}
};