var TWITTERBAR = {
	get prefs() { return Components.classes["@mozilla.org/preferences-service;1"].getService(Components.interfaces.nsIPrefService).QueryInterface(Components.interfaces.nsIPrefBranch).getBranch("extensions.twitter."); },
	
	get passwordManager() {
		if (Components.classes["@mozilla.org/passwordmanager;1"]) {
			var passwordManager = Components.classes["@mozilla.org/passwordmanager;1"].createInstance();
			passwordManager = passwordManager.QueryInterface(Components.interfaces.nsIPasswordManager);
			
			return passwordManager;
		}
		
		return false;
	},
	
	get loginManager() {
		if (Components.classes["@mozilla.org/login-manager;1"]) {
			var loginManager = Components.classes["@mozilla.org/login-manager;1"].getService(Components.interfaces.nsILoginManager);
			
			return loginManager;
		}
		
		return false;
	},
	
	lastUrl : null,
	
	load : function () {
		(document.getElementById("urlbar") || document.getElementById("urlbar-edit")).addEventListener("keyup", function (event) { TWITTERBAR.postKey(event); }, false);
		(document.getElementById("urlbar") || document.getElementById("urlbar-edit")).addEventListener("focus", function () { TWITTERBAR.focus(); }, false);
		
		this.buttonCheck();
	},
	
	buttonCheck : function () {
		try {
			var mode = this.prefs.getBoolPref("button");
			var button = document.getElementById("twitterBox");
			
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
	
	post : function () {
		var image = document.getElementById("twitter-statusbarbutton");
		image.src =  "chrome://twitterbar/skin/Throbber-small.gif";
		
		var urlbar = (document.getElementById("urlbar") || document.getElementById("urlbar-edit"));
		var status = urlbar.value;
		
		if (status.match(/^https?:\/\//i)) {
			this.lastUrl = status;
			
			var prefix = this.prefs.getCharPref("web");
			status = prefix + status;
		}
		
		urlbar.value = "Posting to Twitter...";
		
		var mode = this.prefs.getIntPref("mode");
		if (mode == 0) this.postRequestSecure(status);
		else if (mode == 1) this.postRequestSafe(status);
	},
	
	postRequestSecure : function (status) {
		var argstring = "source=twitterbar&status=" + encodeURIComponent(status);
		
		var req = new XMLHttpRequest();
		req.open("POST", "http://twitter.com/statuses/update.xml", true);
		req.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
		req.setRequestHeader("Content-Length", argstring.length);
		
		req.onreadystatechange = function () {
			if (req.readyState == 4) {
				if (req.status == 200) {
					var urlbar = (document.getElementById("urlbar") || document.getElementById("urlbar-edit"));
					urlbar.value = "Post Successful!";
					var image = document.getElementById("twitter-statusbarbutton");
					image.src =  "chrome://twitterbar/skin/accept.png";
				
					setTimeout(TWITTERBAR.afterPost, 1000);
				}
				else {
					alert(req.responseText);
				}
			}
		};
		
		req.send(argstring);
	},
	
	postRequestSafe : function (status) {
		var auth = this.getAuth();
		
		var argstring = "source=twitterbar&status=" + encodeURIComponent(status);
		
		var req = new XMLHttpRequest();
		req.open("POST", "http://twitter.com/statuses/update.xml", true);
		req.setRequestHeader("Authorization", "Basic " + btoa(auth.username + ":" + auth.password));
		req.setRequestHeader("Content-Type", "application/x-www-form-urlencoded");
		req.setRequestHeader("Content-Length", argstring.length);
		
		req.onreadystatechange = function () {
			if (req.readyState == 4) {
				if (req.status == 200) {
					var urlbar = (document.getElementById("urlbar") || document.getElementById("urlbar-edit"));
					urlbar.value = "Post Successful!";
					var image = document.getElementById("twitter-statusbarbutton");
					image.src =  "chrome://twitterbar/skin/accept.png";
				
					setTimeout(TWITTERBAR.afterPost, 1000);
				}
				else {
					alert(req.responseText);
				}
			}
		};
		
		req.send(argstring);
	},
	
	afterPost : function () {
		// 'this' is not TWITTERBAR
		var urlbar = (document.getElementById("urlbar") || document.getElementById("urlbar-edit"));
		urlbar.value = TWITTERBAR.lastUrl;	
		
		var mode = TWITTERBAR.prefs.getBoolPref("tab");
		
		if (mode == true){
			var newTab = window.getBrowser().addTab("http://twitter.com");
			window.getBrowser().selectedTab = newTab;
		}
		
		var image = document.getElementById('twitter-statusbarbutton');
		image.src =  "chrome://twitterbar/skin/bullet.png"
	},
	
	count : function () {
		var status = (document.getElementById("urlbar") || document.getElementById("urlbar-edit")).value;
		var length = status.length;
		var count = document.getElementById('twitter-count');
		count.hidden = false;
		var imagest = document.getElementById('twitter-statusbarbutton');
		imagest.src =  "chrome://twitterbar/skin/add.png"
		
		if (status.match(/^https?:\/\//i)) {
			var web = this.prefs.getCharPref("web").length;
			count.value = 140 - web - length + " Left:";
			if (length > 140 - web)
			count.style.color = "red";
			if (length < 140 - web)
			count.style.color = "green";		
		}
		else{
			count.value = 140 - length + " Left:";
			if (length > 140)
			count.style.color = "red";
			if (length < 140)
			count.style.color = "green";	
		}
	},
	
	countClear : function () {
		var image = document.getElementById('twitter-statusbarbutton');
		
		if (image.src.match(/add\.png/)) {
			image.src =  "chrome://twitterbar/skin/bullet.png"
		}
		
		var count = document.getElementById('twitter-count');
		count.hidden = true;
	},
	
	toolbarCount : function () {
		var button = document.getElementById('twitter-toolbar-count');
		
		if (button) {
			var urlbar = (document.getElementById("urlbar") || document.getElementById("urlbar-edit"));
			var status = urlbar.value;
			var length = status.length;
			
			if (status.match(/^https?:\/\//i)) {
				var web = this.prefs.getCharPref("web").length;
				var count = 140 - web - length.toString();
				button.setAttribute('value', count);
			}
			else{
				var count = 140 - length.toString();
				button.setAttribute('value', count);
			}
		}
	},
	
	postKey : function (e) {
		if (e.keyCode != e.DOM_VK_RETURN && e.keyCode != 117 && e.keyCode != 76 && e.keyCode != 68 && e.keyCode != 17 && e.keyCode != 18){
			var urlbar = (document.getElementById("urlbar") || document.getElementById("urlbar-edit"));
			var status = urlbar.value;
			if (status.match(/ --post/)){
				var status = status.split(" --post")[0];
				var website = status.substring(0,7);
				if (website == "http://"  || website == "https:/"){
					var webtext = this.prefs.getCharPref("web");
					status = webtext + status;
				}
				urlbar.value = "Posting to Twitter...";
				
				var mode = this.prefs.getIntPref("mode");
				if (mode == "0"){
					this.postRequestSecure(status);
				}
				if (mode == "1"){
					this.postRequestSafe(status);
				}
				var imagest = document.getElementById('twitter-statusbarbutton');
				imagest.src =  "chrome://twitterbar/skin/Throbber-small.gif"
			}
		
			if (status.match(/ --options/)){
				this.openOptions();
			}
		}
		
		this.toolbarCount();
	},
	
	optionsInit : function () {
		var username = document.getElementById('twitter-username');
		var password = document.getElementById('twitter-password');
		var mode = this.prefs.getIntPref("mode");
		var tabmode = this.prefs.getBoolPref("tab");
		var butmode = this.prefs.getBoolPref("button");
		var modesafe = document.getElementById('twitter-safe');
		var modesecure = document.getElementById('twitter-secure');
		var modegroup = document.getElementById('twitter-options-radiogroup');
		var web = this.prefs.getCharPref("web");
		var webbox = document.getElementById('twitter-web');
		var tab = document.getElementById('twitter-tab');
		var but = document.getElementById('twitter-button');
		webbox.setAttribute('value',web);
		if (mode == "1"){
		modesecure.setAttribute('selected','false');
		modesafe.setAttribute('selected','true');
		username.setAttribute('disabled','false');
		password.setAttribute('disabled','false');
		}
		if(tabmode == true){
		tab.setAttribute('checked','true');
		}
		if(butmode == true){
		but.setAttribute('checked','true');
		}
		
		var auth = this.getAuth();
		username.value = auth.username;
		password.value = auth.password;
	},
	
	optionsAccept : function () {
		var username = document.getElementById('twitter-username').value;
		var password = document.getElementById('twitter-password').value;
		var modesafe = document.getElementById('twitter-safe');
		var modesecure = document.getElementById('twitter-secure');
		var web = document.getElementById('twitter-web');
		this.prefs.setCharPref("web",web.value);
		if (modesafe.getAttribute('selected') == "true")
		var modeset = "1";
		if (modesecure.getAttribute('selected') == "true")
		var modeset = "0";
		this.prefs.setIntPref("mode",modeset);
		this.clearAuth();
		this.setAuth(username, password);
		var tab = document.getElementById('twitter-tab');
		var tabpref = tab.getAttribute('checked');
		if (tabpref == "true"){
		this.prefs.setBoolPref("tab",true);
		}
		else{
		this.prefs.setBoolPref("tab",false);
		}
		var but = document.getElementById('twitter-button');
		var butpref = but.getAttribute('checked');
		if (butpref == "true"){
		this.prefs.setBoolPref("button",true);
		}
		else{
		this.prefs.setBoolPref("button",false);
		}
		
	},
	
	getAuth : function () {
		var auth = {};

		var passwordManager = this.passwordManager;
		var loginManager = this.loginManager;

		if (passwordManager) {
			var e = passwordManager.enumerator;

			// step through each password in the password manager until we find the one we want:
			while (e.hasMoreElements()) {
			    try {
			        // get an nsIPassword object out of the password manager.
			        // This contains the actual password...
			        var pass = e.getNext().QueryInterface(Components.interfaces.nsIPassword);
			        if (pass.host == 'twitterbar') {
						auth.username = pass.user;
						auth.password = pass.password;
						break;
			        }
			    } catch (ex) {
			    }
			}
		}
		else {
			var nsLoginInfo = new Components.Constructor("@mozilla.org/login-manager/loginInfo;1", Components.interfaces.nsILoginInfo, "init");
			var logins = loginManager.findLogins({}, "twitterbar", "twitterbar", null);
			for (var j = 0; j < logins.length; j++) {
				auth.username = logins[j].username;
				auth.password = logins[j].password;
				break;
			}
		}

		if (typeof auth.username == 'undefined') auth.username = '';
		if (typeof auth.password == 'undefined') auth.password = '';

		return auth;
	},
	
	clearAuth : function () {
		var passwordManager = this.passwordManager;
		var loginManager = this.loginManager;
	
		if (passwordManager) {
			var e = passwordManager.enumerator;
			var usernames = [];
		
			while (e.hasMoreElements()) {
			    try {
			        var pass = e.getNext().QueryInterface(Components.interfaces.nsIPassword);
		
			        if (pass.host == 'twitterbar') {
						usernames.push(pass.user);
			        }
			    } catch (ex) {
			    }
			}
		
			for (var i = 0; i < usernames.length; i++){
				try{
					passwordManager.removeUser('twitterbar', usernames[i]);
				} catch (e) {
				}
			}
		}
		else {
			var logins = loginManager.findLogins({}, 'twitterbar', 'twitterbar', null);

			for (var j = 0; j < logins.length; j++) {
				loginManager.removeLogin(logins[j]);
			}
		}
	},
	
	setAuth : function (username, password) {
		var passwordManager = this.passwordManager;
		var loginManager = this.loginManager;

		if (passwordManager) {
			passwordManager.addUser('twitterbar', username, password);
		}
		else {
			var nsLoginInfo = new Components.Constructor("@mozilla.org/login-manager/loginInfo;1", Components.interfaces.nsILoginInfo, "init");
			var loginInfo = new nsLoginInfo('twitterbar', 'twitterbar', null, username, password, "", "");
			loginManager.addLogin(loginInfo);
		}
	},
	
	optionsSelect : function (radio) {
		var userinput = document.getElementById('twitter-username');
		var passinput = document.getElementById('twitter-password');
		if (radio.selectedIndex == 0){
		userinput.disabled = true;
		passinput.disabled = true;
		}
		if (radio.selectedIndex == 1){
		userinput.disabled = false;
		passinput.disabled = false;
		}
	},
	
	openOptions : function () {
		openDialog('chrome://twitter/content/optionsDialog.xul', 'options', 'modal,centerscreen');
	}
};