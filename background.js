let settings = {
    darkMode: false,
    verticalTabs: false,
    privateMode: false,
    stealthMode: false,
    tabSleeping: true,
    fastLoading: true,
    autoCleanCookies: false,
    userAgent: "default",
    proxySettings: {
      enabled: false,
      host: "",
      port: ""
    },
    theme: "default"
  };
  
  let sessions = [
    { id: "default", name: "Default", color: "#4285f4" }
  ];
  
  let currentSession = "default";
  let tabGroups = [];
  let floatingTabs = [];
  let sleepingTabs = [];
  
  // Load settings from storage
  chrome.storage.local.get(["settings", "sessions"], function(data) {
    if (data.settings) settings = data.settings;
    if (data.sessions) sessions = data.sessions;
  });
  
  // Listen for commands
  chrome.commands.onCommand.addListener((command) => {
    if (command === "toggle-private-mode") {
      togglePrivateMode();
    } else if (command === "create-tab-group") {
      createTabGroup();
    } else if (command === "toggle-vertical-tabs") {
      toggleVerticalTabs();
    } else if (command === "float-tab") {
      floatCurrentTab();
    }
  });
  
  // Listen for messages from popup
  chrome.runtime.onMessage.addListener((msg, sender, sendBack) => {
    if (msg.cmd === "getSettings") {
      sendBack({settings: settings, sessions: sessions, currentSession: currentSession});
    } else if (msg.cmd === "saveSettings") {
      settings = msg.settings;
      chrome.storage.local.set({settings: settings});
      applySettings();
      sendBack({status: "saved"});
    } else if (msg.cmd === "createSession") {
      createSession(msg.name, msg.color);
      sendBack({status: "created", sessions: sessions});
    } else if (msg.cmd === "switchSession") {
      switchSession(msg.id);
      sendBack({status: "switched", currentSession: msg.id});
    } else if (msg.cmd === "createTabGroup") {
      createTabGroup(msg.name, msg.color);
      sendBack({status: "created"});
    } else if (msg.cmd === "floatTab") {
      floatTab(msg.tabId);
      sendBack({status: "floated"});
    } else if (msg.cmd === "toggleStealth") {
      toggleStealthMode();
      sendBack({status: "toggled", stealthMode: settings.stealthMode});
    } else if (msg.cmd === "clearData") {
      clearBrowsingData();
      sendBack({status: "cleared"});
    }
    return true;
  });
  
  function togglePrivateMode() {
    settings.privateMode = !settings.privateMode;
    chrome.storage.local.set({settings: settings});
    
    if (settings.privateMode) {
      chrome.contentSettings.cookies.set({
        primaryPattern: "<all_urls>",
        setting: "session_only"
      });
    } else {
      chrome.contentSettings.cookies.clear({});
    }
  }
  
  function toggleStealthMode() {
    settings.stealthMode = !settings.stealthMode;
    chrome.storage.local.set({settings: settings});
    
    if (settings.stealthMode) {
      chrome.webRequest.onBeforeSendHeaders.addListener(
        removeTrackingHeaders,
        {urls: ["<all_urls>"]},
        ["blocking", "requestHeaders"]
      );
    } else {
      chrome.webRequest.onBeforeSendHeaders.removeListener(removeTrackingHeaders);
    }
  }
  
  function removeTrackingHeaders(details) {
    let headers = details.requestHeaders;
    let filtered = headers.filter(header => {
      return header.name.toLowerCase() !== "referer" && 
             header.name.toLowerCase() !== "cookie";
    });
    
    if (settings.userAgent !== "default") {
      filtered.push({
        name: "User-Agent",
        value: settings.userAgent
      });
    }
    
    return {requestHeaders: filtered};
  }
  
  function createSession(name, color) {
    let id = "session_" + Date.now();
    sessions.push({id: id, name: name, color: color});
    chrome.storage.local.set({sessions: sessions});
  }
  
  function switchSession(id) {
    currentSession = id;
    chrome.cookies.getAll({}, function(cookies) {
      for (let cookie of cookies) {
        chrome.cookies.remove({
          url: getCookieUrl(cookie),
          name: cookie.name
        });
      }
    });
  }
  
  function getCookieUrl(cookie) {
    let prefix = cookie.secure ? "https://" : "http://";
    let domain = cookie.domain.charAt(0) === '.' ? cookie.domain.substr(1) : cookie.domain;
    return prefix + domain + cookie.path;
  }
  
  function createTabGroup(name, color) {
    chrome.tabs.query({highlighted: true}, function(tabs) {
      if (tabs.length > 0) {
        let tabIds = tabs.map(tab => tab.id);
        chrome.tabGroups.create({tabIds: tabIds}, function(group) {
          chrome.tabGroups.update(group.id, {
            title: name,
            color: color
          });
        });
      }
    });
  }
  
  function toggleVerticalTabs() {
    settings.verticalTabs = !settings.verticalTabs;
    chrome.storage.local.set({settings: settings});
    
    chrome.tabs.query({}, function(tabs) {
      for (let tab of tabs) {
        chrome.tabs.sendMessage(tab.id, {
          action: "toggleVerticalTabs", 
          value: settings.verticalTabs
        });
      }
    });
  }
  
  function floatCurrentTab() {
    chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
      if (tabs.length > 0) {
        floatTab(tabs[0].id);
      }
    });
  }
  
  function floatTab(tabId) {
    chrome.windows.create({
      tabId: tabId,
      type: "popup",
      width: 400,
      height: 300,
      top: 10,
      left: 10,
      focused: true
    }, function(window) {
      floatingTabs.push({
        tabId: tabId,
        windowId: window.id
      });
    });
  }
  
  function enableTabSleeping() {
    if (!settings.tabSleeping) return;
    
    setInterval(function() {
      chrome.tabs.query({active: false}, function(tabs) {
        let now = Date.now();
        for (let tab of tabs) {
          let found = sleepingTabs.find(item => item.id === tab.id);
          
          if (!found && now - tab.lastAccessed > 300000) { // 5 minutes
            sleepingTabs.push({id: tab.id, url: tab.url});
            chrome.tabs.discard(tab.id);
          }
        }
      });
    }, 60000); // Check every minute
  }
  
  function applySettings() {
    // Apply proxy settings
    if (settings.proxySettings.enabled) {
      chrome.proxy.settings.set({
        value: {
          mode: "fixed_servers",
          rules: {
            singleProxy: {
              scheme: "http",
              host: settings.proxySettings.host,
              port: parseInt(settings.proxySettings.port)
            }
          }
        },
        scope: "regular"
      });
    } else {
      chrome.proxy.settings.clear({scope: "regular"});
    }
    
    // Apply user agent
    if (settings.userAgent !== "default") {
      chrome.webRequest.onBeforeSendHeaders.addListener(
        changeUserAgent,
        {urls: ["<all_urls>"]},
        ["blocking", "requestHeaders"]
      );
    } else {
      chrome.webRequest.onBeforeSendHeaders.removeListener(changeUserAgent);
    }
    
    // Enable tab sleeping
    if (settings.tabSleeping) {
      enableTabSleeping();
    }
  }
  
  function changeUserAgent(details) {
    let headers = details.requestHeaders;
    for (let i = 0; i < headers.length; i++) {
      if (headers[i].name.toLowerCase() === "user-agent") {
        headers[i].value = settings.userAgent;
        break;
      }
    }
    return {requestHeaders: headers};
  }
  
  function clearBrowsingData() {
    chrome.browsingData.remove({
      "since": 0
    }, {
      "appcache": true,
      "cache": true,
      "cookies": true,
      "downloads": true,
      "fileSystems": true,
      "formData": true,
      "history": true,
      "indexedDB": true,
      "localStorage": true,
      "passwords": true,
      "serviceWorkers": true,
      "webSQL": true
    });
  }
  
  // Initialize settings
  applySettings();
  
  // content.js
  let isDarkMode = false;
  let isVerticalTabs = false;
  
  chrome.runtime.onMessage.addListener(function(request, sender, sendResponse) {
    if (request.action === "toggleDarkMode") {
      isDarkMode = request.value;
      applyDarkMode();
    } else if (request.action === "toggleVerticalTabs") {
      isVerticalTabs = request.value;
      applyVerticalTabs();
    }
  });
  
  function applyDarkMode() {
    if (isDarkMode) {
      let style = document.createElement('style');
      style.id = 'darkModeStyle';
      style.textContent = `
        :root {
          color-scheme: dark !important;
        }
        body {
          background-color: #1a1a1a !important;
          color: #f0f0f0 !important;
        }
        a {
          color: #6699ff !important;
        }
        input, textarea, select {
          background-color: #333 !important;
          color: #f0f0f0 !important;
          border: 1px solid #555 !important;
        }
      `;
      document.head.appendChild(style);
    } else {
      let style = document.getElementById('darkModeStyle');
      if (style) style.remove();
    }
  }
  
  function applyVerticalTabs() {
    if (isVerticalTabs) {
      // We can't actually change Chrome's tab UI from an extension
      // This is just a placeholder for the concept
      console.log("Vertical tabs enabled (simulated)");
    } else {
      console.log("Vertical tabs disabled (simulated)");
    }
  }
  
  // Check if should preload links in the background
  function setupPreloading() {
    document.addEventListener('mouseover', function(e) {
      let link = e.target.closest('a');
      if (link && link.href) {
        let url = new URL(link.href);
        if (url.hostname === window.location.hostname) {
          let linkElement = document.createElement('link');
          linkElement.rel = 'prefetch';
          linkElement.href = link.href;
          document.head.appendChild(linkElement);
        }
      }
    });
  }
  
  // Initialize content script features
  chrome.storage.local.get("settings", function(data) {
    if (data.settings) {
      isDarkMode = data.settings.darkMode;
      isVerticalTabs = data.settings.verticalTabs;
      
      if (isDarkMode) applyDarkMode();
      if (isVerticalTabs) applyVerticalTabs();
      if (data.settings.fastLoading) setupPreloading();
    }
  });