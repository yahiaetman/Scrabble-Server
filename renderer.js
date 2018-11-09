// Add electron and ipc to window object so that we can access them from anywhere

// eslint-disable-next-line import/no-extraneous-dependencies
window.electron = require('electron');

window.ipc = window.electron.ipcRenderer;
