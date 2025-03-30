document.addEventListener('DOMContentLoaded', function() {
    let tabs = document.querySelectorAll('.tab');
    let tabContents = document.querySelectorAll('.tab-content');
    let toggles = document.querySelectorAll('.toggle');
    let colors = document.querySelectorAll('.color');
    let themeOptions = document.querySelectorAll('.theme-option');
    
    let settings = {};
    let sessions = [];
    let currentSession = "";
    let selectedColor = "#4285f4";
    
    // Load settings
    chrome.runtime.sendMessage({cmd: "getSettings"}, function(response) {
      settings = response.settings;
      sessions = response.sessions;
      currentSession = response.currentSession;
      
      // Update toggles based on settings
      updateToggle('privateToggle', settings.privateMode);
      updateToggle('verticalToggle', settings.verticalTabs);
      updateToggle('sleepingToggle', settings.tabSleeping);
      updateToggle('fastLoadingToggle', settings.fastLoading);
      updateToggle('stealthToggle', settings.stealthMode);
      updateToggle('autoClearToggle', settings.autoCleanCookies);
      updateToggle('proxyToggle', settings.proxySettings.enabled);
      
      // Update proxy inputs
      document.getElementById('proxyHost').value = settings.proxySettings.host;
      document.getElementById('proxyPort').value = settings.proxySettings.port;
      
      // Update user agent select
      document.getElementById('userAgent').value = settings.userAgent;
      
      // Update theme
      document.querySelector(`.theme-option[data-theme="${settings.theme}"]`).classList.add('selected');
      
      // Load sessions
      loadSessions();
    });
    
    // Tab navigation
    tabs.forEach(tab => {
      tab.addEventListener('click', function() {
        tabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));
        
        this.classList.add('active');
        document.getElementById(this.dataset.tab).classList.add('active');
      });
    });
    
    // Toggle buttons
    toggles.forEach(toggle => {
      toggle.addEventListener('click', function() {
        this.classList.toggle('on');
        
        let id = this.id;
        
        if (id === 'privateToggle') {
          settings.privateMode = this.classList.contains('on');
        } else if (id === 'verticalToggle') {
          settings.verticalTabs = this.classList.contains('on');
        } else if (id === 'sleepingToggle') {
          settings.tabSleeping = this.classList.contains('on');
        } else if (id === 'fastLoadingToggle') {
          settings.fastLoading = this.classList.contains('on');
        } else if (id === 'stealthToggle') {
          settings.stealthMode = this.classList.contains('on');
          chrome.runtime.sendMessage({cmd: "toggleStealth"});
        } else if (id === 'autoClearToggle') {
          settings.autoCleanCookies = this.classList.contains('on');
        } else if (id === 'proxyToggle') {
          settings.proxySettings.enabled = this.classList.contains('on');
        }
      });
    });
    
    // Color selection
    colors.forEach(color => {
      color.addEventListener('click', function() {
        colors.forEach(c => c.classList.remove('selected'));
        this.classList.add('selected');
        selectedColor = this.dataset.color;
      });
    });
    
    // Theme selection
    themeOptions.forEach(option => {
      option.addEventListener('click', function() {
        themeOptions.forEach(o => o.classList.remove('selected'));
        this.classList.add('selected');
        settings.theme = this.dataset.theme;
      });
    });
    
    // Add session
    document.getElementById('addSession').addEventListener('click', function() {
      let name = document.getElementById('sessionName').value;
      if (name) {
        chrome.runtime.sendMessage({
          cmd: "createSession", 
          name: name, 
          color: selectedColor
        }, function(response) {
          if (response.status === "created") {
            sessions = response.sessions;
            loadSessions();
            document.getElementById('sessionName').value = "";
          }
        });
      }
    });
    
    // Create tab group
    document.getElementById('createGroup').addEventListener('click', function() {
      let name = prompt("Enter tab group name:");
      if (name) {
        chrome.runtime.sendMessage({
          cmd: "createTabGroup", 
          name: name, 
          color: "blue"
        });
      }
    });
    
    // Float current tab
    document.getElementById('floatTab').addEventListener('click', function() {
      chrome.tabs.query({active: true, currentWindow: true}, function(tabs) {
        if (tabs.length > 0) {
          chrome.runtime.sendMessage({
            cmd: "floatTab", 
            tabId: tabs[0].id
          });
        }
      });
    });
    
    // Clear data
    document.getElementById('clearData').addEventListener('click', function() {
      if (confirm("Are you sure you want to clear all browsing data?")) {
        chrome.runtime.sendMessage({cmd: "clearData"});
      }
    });
    
    // Save settings
    document.getElementById('saveSettings').addEventListener('click', function() {
      // Update proxy settings from inputs
      settings.proxySettings.host = document.getElementById('proxyHost').value;
      settings.proxySettings.port = document.getElementById('proxyPort').value;
      
      // Update user agent
      settings.userAgent = document.getElementById('userAgent').value;
      
      chrome.runtime.sendMessage({cmd: "saveSettings", settings: settings}, function(response) {
        if (response.status === "saved") {
          alert("Settings saved!");
        }
      });
    });
    
    // Theme toggle
    document.getElementById('themeToggle').addEventListener('click', function() {
      document.body.classList.toggle('dark');
      this.classList.toggle('on');
    });
    
    // Helper functions
    function updateToggle(id, value) {
      let toggle = document.getElementById(id);
      if (value) {
        toggle.classList.add('on');
      } else {
        toggle.classList.remove('on');
      }
    }
    
    function loadSessions() {
      let sessionList = document.getElementById('sessionList');
      sessionList.innerHTML = '';
      
      sessions.forEach(session => {
        let sessionElement = document.createElement('div');
        sessionElement.className = 'session-item';
        if (session.id === currentSession) {
          sessionElement.classList.add('active');
        }
        
        sessionElement.style.borderLeftColor = session.color;
        sessionElement.textContent = session.name;
        
        sessionElement.addEventListener('click', function() {
          chrome.runtime.sendMessage({
            cmd: "switchSession", 
            id: session.id
          }, function(response) {
            if (response.status === "switched") {
              document.querySelectorAll('.session-item').forEach(item => item.classList.remove('active'));
              sessionElement.classList.add('active');
            }
          });
        });
        
        sessionList.appendChild(sessionElement);
        
        // Add delete button
        let deleteBtn = document.createElement('span');
        deleteBtn.className = 'delete-session';
        deleteBtn.innerHTML = '&times;';
        deleteBtn.addEventListener('click', function(e) {
          e.stopPropagation();
          if (confirm(`Delete session "${session.name}"?`)) {
            chrome.runtime.sendMessage({
              cmd: "deleteSession", 
              id: session.id
            }, function(response) {
              if (response.status === "deleted") {
                sessions = response.sessions;
                loadSessions();
              }
            });
          }
        });
        
        sessionElement.appendChild(deleteBtn);
      });
    }
    
    // Import/Export settings
    document.getElementById('exportSettings').addEventListener('click', function() {
      chrome.runtime.sendMessage({cmd: "exportSettings"}, function(response) {
        let dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(response.data));
        let downloadAnchorNode = document.createElement('a');
        downloadAnchorNode.setAttribute("href", dataStr);
        downloadAnchorNode.setAttribute("download", "browser_settings.json");
        document.body.appendChild(downloadAnchorNode);
        downloadAnchorNode.click();
        downloadAnchorNode.remove();
      });
    });
    
    document.getElementById('importSettings').addEventListener('click', function() {
      let fileInput = document.createElement('input');
      fileInput.type = 'file';
      fileInput.accept = '.json';
      fileInput.onchange = function(e) {
        let file = e.target.files[0];
        let reader = new FileReader();
        reader.onload = function(event) {
          try {
            let importedSettings = JSON.parse(event.target.result);
            chrome.runtime.sendMessage({
              cmd: "importSettings", 
              data: importedSettings
            }, function(response) {
              if (response.status === "imported") {
                alert("Settings imported successfully!");
                location.reload();
              }
            });
          } catch (err) {
            alert("Invalid settings file!");
          }
        };
        reader.readAsText(file);
      };
      fileInput.click();
    });
    
    // Refresh tab list
    document.getElementById('refreshTabs').addEventListener('click', function() {
      loadTabList();
    });
    
    // Load tab list
    function loadTabList() {
      let tabList = document.getElementById('tabList');
      tabList.innerHTML = '<div class="loading">Loading tabs...</div>';
      
      chrome.runtime.sendMessage({cmd: "getTabs"}, function(response) {
        tabList.innerHTML = '';
        
        response.tabs.forEach(tab => {
          let tabElement = document.createElement('div');
          tabElement.className = 'tab-item';
          
          let favicon = document.createElement('img');
          favicon.className = 'tab-favicon';
          favicon.src = tab.favIconUrl || 'images/default_favicon.png';
          tabElement.appendChild(favicon);
          
          let tabTitle = document.createElement('span');
          tabTitle.className = 'tab-title';
          tabTitle.textContent = tab.title;
          tabElement.appendChild(tabTitle);
          
          tabElement.addEventListener('click', function() {
            chrome.runtime.sendMessage({
              cmd: "activateTab", 
              tabId: tab.id
            });
            window.close();
          });
          
          tabList.appendChild(tabElement);
        });
        
        if (response.tabs.length === 0) {
          tabList.innerHTML = '<div class="empty-message">No tabs in this session</div>';
        }
      });
    }
    
    // Initial tab list load
    loadTabList();
    
    // Quick actions
    document.getElementById('newIncognito').addEventListener('click', function() {
      chrome.runtime.sendMessage({cmd: "newIncognitoWindow"});
      window.close();
    });
    
    document.getElementById('lockBrowser').addEventListener('click', function() {
      chrome.runtime.sendMessage({cmd: "lockBrowser"});
      window.close();
    });
    
    // Global keyboard shortcuts
    document.addEventListener('keydown', function(e) {
      // Ctrl+S to save settings
      if (e.ctrlKey && e.key === 's') {
        e.preventDefault();
        document.getElementById('saveSettings').click();
      }
      
      // Escape to close popup
      if (e.key === 'Escape') {
        window.close();
      }
    });
});