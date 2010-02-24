var TWITTERBAR_UI = {
	load : function () {
		removeEventListener("load", TWITTERBAR_UI.load, false);
		
		document.getElementById("urlbar").addEventListener("keyup", TWITTERBAR.postKey, false);
		document.getElementById("urlbar").addEventListener("focus", TWITTERBAR.focus, false);
		
		var appcontent = document.getElementById("content");
		appcontent.addEventListener("DOMContentLoaded", TWITTERBAR.DOMContentLoaded, true);
		
		TWITTERBAR_UI.buttonCheck();
		
		addEventListener("unload", TWITTERBAR_UI.unload, false);
	},
	
	unload : function () {
		removeEventListener("unload", TWITTERBAR_UI.unload, false);
		
		document.getElementById("urlbar").removeEventListener("keyup", TWITTERBAR.postKey, false);
		document.getElementById("urlbar").removeEventListener("focus", TWITTERBAR.focus, false);
		
		var appcontent = document.getElementById("content");
		appcontent.removeEventListener("DOMContentLoaded", TWITTERBAR.DOMContentLoaded, true);
	},
	
	showFirstRun : function (version) {
		var browser = getBrowser();
		
		setTimeout(function (browser) {
			TWITTERBAR_UI.addTab("http://www.chrisfinke.com/firstrun/twitterbar.php?v=" + version);
		}, 3000, browser);
	},
	
	addTab : function (url) {
		getBrowser().selectedTab = getBrowser().addTab(url);
	},
	
	openOptions : function () {
		var d = openDialog('chrome://twitterbar/content/options.xul', 'options', 'chrome,dialog,dependent,centerscreen,resizable');
		d.focus();
	},
	
	didYouKnow : function () {
		setTimeout(
			function () {
				window.openDialog("chrome://twitterbar/content/dialogs/didYouKnow.xul", "multiple", "chrome,dialog,centerscreen,titlebar,alwaysraised");
			}, 5000);
	},
	
	follow : function () {
		setTimeout(
			function () {
				window.openDialog("chrome://twitterbar/content/dialogs/follow.xul", "follow", "chrome,dialog,centerscreen,titlebar,alwaysraised");
			}, 5000);
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
	
	onButtonClick : function (e) {
		if (e.button != 2){ 
			TWITTERBAR.post(true);
		}
	},
	
	setBusy : function (busy) {
		var imagest = document.getElementById('twitter-statusbarbutton');
		
		if (busy) {
			imagest.src = "chrome://twitterbar/skin/Throbber-small.gif";
		}
		else {
			image.src =  "chrome://twitterbar/skin/bird-16-full.png";
		}
	},
	
	getStatusText : function () {
		return document.getElementById("urlbar").value;
	},
	
	setStatusText : function (text) {
		document.getElementById("urlbar").value = text;
		gBrowser.selectedBrowser.userTypedValue = text;
	},
	
	showWeb : function () { },
	
	addingAccount : function () { },
	
	showCount : function () {
		document.getElementById("twitter-searchbutton").hidden = false;
		
		var imagest = document.getElementById('twitter-statusbarbutton');
		imagest.src = "chrome://twitterbar/skin/add.png";
		
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
	
	hideCount : function () {
		TWITTERBAR_UI.setBusy(false);
		
		var count = document.getElementById('twitter-count');
		count.hidden = true;
		
		document.getElementById("twitter-searchbutton").hidden = true;
	},
	
	keyDown : function () {
		TWITTERBAR_UI.showToolbarCount();
	},
	
	focus : function () {
		TWITTERBAR_UI.showToolbarCount();
	},
	
	blur : function () { },
	
	showToolbarCount : function () {
		var button = document.getElementById('twitter-toolbar-count');

		if (button) {
			button.setAttribute('value', 140 - TWITTERBAR.getCharCount());
		}
	}
};