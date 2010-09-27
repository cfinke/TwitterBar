var TWITTERBAR_UI = {
	load : function () {
		removeEventListener("load", TWITTERBAR_UI.load, false);
		
		document.getElementById("urlbar").addEventListener("keyup", TWITTERBAR.postKey, false);
		document.getElementById("urlbar").addEventListener("focus", TWITTERBAR.focus, false);
		
		if (typeof messageManager == 'undefined') {
			var appcontent = document.getElementById("content");
			appcontent.addEventListener("DOMContentLoaded", TWITTERBAR.DOMContentLoaded, true);
		}
		
		TWITTERBAR_UI.buttonCheck();
		
		addEventListener("unload", TWITTERBAR_UI.unload, false);
	},
	
	unload : function () {
		removeEventListener("unload", TWITTERBAR_UI.unload, false);
		
		document.getElementById("urlbar").removeEventListener("keyup", TWITTERBAR.postKey, false);
		document.getElementById("urlbar").removeEventListener("focus", TWITTERBAR.focus, false);
		
		if (typeof messageManager == 'undefined') {
			var appcontent = document.getElementById("content");
			appcontent.removeEventListener("DOMContentLoaded", TWITTERBAR.DOMContentLoaded, true);
		}
	},
	
	showFirstRun : function (version) {
		setTimeout(
			function (version) {
				TWITTERBAR_UI.addTab("http://www.chrisfinke.com/firstrun/twitterbar.php?v=" + version);
			}, 0, version);
	},
	
	addTab : function (url) {
		getBrowser().selectedTab = getBrowser().addTab(url);
	},
	
	closeTab : function () {
		getBrowser().removeCurrentTab();
	},
	
	openOptions : function () {
		var d = openDialog('chrome://twitterbar/content/options.xul', 'options', 'chrome,dialog,dependent,centerscreen,resizable');
		d.focus();
	},
	
	follow : function () {
		TWITTERBAR_UI.request(
			TWITTERBAR.strings.getString("twitterbar.follow.request"),
			TWITTERBAR.strings.getString("twitterbar.follow.deny"),
			TWITTERBAR.strings.getString("twitterbar.follow.accept"),
			'TWITTERBAR.prefs.setBoolPref("onetime.follow", true);',
			'TWITTERBAR.prefs.setBoolPref("onetime.follow", true); TWITTERBAR.followTwtrbar();',
			TWITTERBAR.strings.getString("twitterbar.follow.moreLink"),
			'http://twitter.com/twtrbar'
		);
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
		var image = document.getElementById('twitter-statusbarbutton');
		
		if (busy) {
			image.src = "chrome://twitterbar/skin/Throbber-small.gif";
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
	
	setStatusMessage : function (text) {
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
	
	showWeb : function () { },
	
	addingAccount : function () { },
	
	showCount : function () {
		document.getElementById("twitter-searchbutton").hidden = false;
		
		var imagest = document.getElementById('twitter-statusbarbutton');
		imagest.src = "chrome://twitterbar/skin/add.png";
		
		var count = document.getElementById('twitter-count');
		count.hidden = false;
		
		var length = TWITTERBAR.getCharCount();
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
	
	keyDownTimer : null,
	
	keyDown : function () {
		clearTimeout(TWITTERBAR_UI.keyDownTimer);
		
		TWITTERBAR_UI.keyDownTimer = setTimeout(TWITTERBAR_UI.showToolbarCount, 500);
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
	},
	
	openUILink : function (url, evt, arg1, arg2) {
		openUILink(url, evt, arg1, arg2);
	},
	
	request : function (label, buttonCancelLabel, buttonAcceptLabel, cancelCallback, acceptCallback, linkLabel, linkHref) {
		// Show a notificaiton-bar-style request.
		var notificationBar = document.createElement("notification");
		notificationBar.setAttribute("id", "twitterbar-search-request");
		notificationBar.setAttribute("align", "center");
		notificationBar.setAttribute("type", "info");
		notificationBar.setAttribute("label", label);
		notificationBar.setAttribute("image", "chrome://twitterbar/skin/bird-16-full.png");
		
		if (buttonCancelLabel) {
			var no = document.createElement("button");
			no.setAttribute("label", buttonCancelLabel);
			no.setAttribute("oncommand", cancelCallback + " this.parentNode.close();");
			notificationBar.appendChild(no);
		}
		
		if (buttonAcceptLabel) {
			var ok = document.createElement("button");
			ok.setAttribute("label", buttonAcceptLabel);
			ok.setAttribute("oncommand", acceptCallback + " this.parentNode.close();");
			notificationBar.appendChild(ok);
		}
		
		notificationBar.setAttribute("opening", "true");
		
		setTimeout(function () {
			// Show it below the URL bar.
			if (document.getElementById("nav-bar")) {
				document.getElementById("navigator-toolbox").insertBefore(notificationBar, document.getElementById("nav-bar").nextSibling);
			}
			else {
				document.getElementById("navigator-toolbox").appendChild(notificationBar);
			}
		
			notificationBar.style.minHeight = "1px";
			notificationBar.style.height = "1px";
			
			target = 32;
			
			height = 1;
			
			function slide() {
				height += 1;
			
				notificationBar.style.minHeight = height + "px";
				notificationBar.style.height = height + "px";
			
				if (height == target) {
					notificationBar.setAttribute("opening", "false");
					notificationBar.style.removeProperty("minHeight");
					notificationBar.style.removeProperty("height");
					clearInterval(sliderTimeout);
				}
			}
		
			var sliderTimeout = setInterval(slide, 15);
			
			if (linkLabel) {
				setTimeout(function () {
					// Example taken from http://mxr.mozilla.org/mozilla1.9.2/source/browser/components/nsBrowserGlue.js#1192
					var link = document.createElement("label");
					link.setAttribute("value", linkLabel);
					link.className = "text-link";
					link.href = linkHref;
					
					var description = notificationBar.ownerDocument.getAnonymousElementByAttribute(notificationBar, "anonid", "messageText");
					description.appendChild(link);
				}, 0);
			}
		}, 3000);
	}
};