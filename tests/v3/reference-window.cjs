const {app, BrowserWindow} = require("electron");

let window;
app.whenReady().then(async () => {
  window = new BrowserWindow({
    width:1440, height:900, useContentSize:true, show:false,
    webPreferences:{contextIsolation:true, nodeIntegration:false, sandbox:true, backgroundThrottling:false},
  });
  await window.loadURL("about:blank");
});
