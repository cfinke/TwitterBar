var TWITTERBAR_UI = {
	load : function () {
		removeEventListener("load", TWITTERBAR_UI.load, false);
		
		document.getElementById("twitter-statusbarbutton").style.display = 'none';
		
		var oldsearchcomplete = document.getElementById("urlbar-edit").getAttribute("onsearchcomplete");
		
		document.getElementById("urlbar-edit").setAttribute("onsearchcomplete", "TWITTERBAR_UI.keyDown(); if (!TWITTERBAR.postKey()) { " + oldsearchcomplete + "}");
		document.getElementById("urlbar-edit").addEventListener("blur", TWITTERBAR.blur, true);
		document.getElementById("urlbar-edit").addEventListener("focus", TWITTERBAR.focus, true);
		
		document.getElementById("addons-list").addEventListener("AddonOptionsLoad", TWITTERBAR_OPTIONS.mobileLoad, false);
		
		TWITTERBAR_UI.buttonCheck();
		
		addEventListener("unload", TWITTERBAR_UI.unload, false);
	},
	
	unload : function () {
		removeEventListener("unload", TWITTERBAR_UI.unload, false);
		
		document.getElementById("urlbar-edit").removeEventListener("blur", TWITTERBAR.blur, true);
		document.getElementById("urlbar-edit").removeEventListener("focus", TWITTERBAR.focus, true);
		
		document.getElementById("addons-list").removeEventListener("AddonOptionsLoad", TWITTERBAR_OPTIONS.mobileLoad, false);
	},
	
	showFirstRun : function (version) {
		setTimeout(TWITTERBAR_UI.addTab, 0, "http://www.chrisfinke.com/firstrun/twitterbar.php?v=" + version);
	},
	
	addTab : function (url) {
		Browser.addTab(url, true);
		
		TWITTERBAR_UI.showWeb();
	},

	closeTab : function () {
		Browser.closeTab(Browser.selectedTab);
	},
	
	openOptions : function () {
		TWITTERBAR_UI.showWeb();
		
		BrowserUI.showPanel();
		BrowserUI.switchPane("addons-container");
	},
	
	follow : function () {
		/*
		var localeString = TWITTERBAR.strings.getString("twitterbar.follow.request");
		
		if (TWITTERBAR.confirm(localeString)) {
			TWITTERBAR.followTwtrbar();
		}
		*/
	},
	
	buttonCheck : function () {
		try {
			var mode = TWITTERBAR.prefs.getBoolPref("button");
			var button = document.getElementById("twitterBox");
			
			button.setAttribute("hidden", mode.toString());
		} catch (e) { }
	},
	
	onButtonClick : function (e) {
		if (e.button != 2){ 
			TWITTERBAR.post(true);
		}
	},
	
	setBusy : function (busy) {
		if (busy) {
			document.getElementById("twitter-statusbarbutton").setAttribute("busy","true");
		}
		else {
			document.getElementById("twitter-statusbarbutton").setAttribute("busy","false");
		}
	},
	
	getStatusText : function () {
		return document.getElementById("urlbar-edit").value;
	},
	
	setStatusMessage : function (text) {
		return;
		
		if (!text) text = "";
		
		if (!text) {
			document.getElementById("twitterbar-status-container").style.display = 'none';
			document.getElementById("twitterbar-status-label").value = text;
		}
		else {
			document.getElementById("twitterbar-status-label").value = text;
			document.getElementById("twitterbar-status-container").style.display = '';
		}
	},
	
	setStatusText : function (text) {
		document.getElementById("urlbar-edit").value = text;
	},
	
	showWeb : function () {
		try {
			BrowserUI.activeDialog.close();
		} catch (webView) {
		}
	},
	
	addingAccount : function () {
		BrowserUI.hidePanel();
	},
	
	showCount : function () { },
	
	hideCount : function () { },
	
	keyDown : function () {
		var length = TWITTERBAR.getCharCount();
		
		if (length > 140) {
			document.getElementById("twitter-statusbarbutton").setAttribute("toolong", "true");
		}
		else {
			document.getElementById("twitter-statusbarbutton").removeAttribute("toolong");
		}
	},
	
	focus : function () {
		document.getElementById("twitter-statusbarbutton").style.display = '';
	},
	
	blur : function () {
		document.getElementById("twitter-statusbarbutton").style.display = 'none';
	},
	
	showToolbarCount : function () { },
	
	openUILink : function (url, evt, arg1, arg2) {
		TWITTERBAR_UI.addTab(url);
	}
};