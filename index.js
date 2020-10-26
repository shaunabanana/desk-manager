const fs = require('fs-extra');
const path = require('path');
const shortid = require('shortid');
const Store = require('electron-store');

const { app, Menu, Tray, BrowserWindow, ipcMain } = require('electron');

let iconPath = path.join(__dirname, 'assets', 'IconTemplate.png');
let workspacePath = path.join(app.getPath('home'), 'Desktop Workspaces');
let defaultPath = path.join(workspacePath, 'Default Workspace');
let desktopPath = path.join(app.getPath('home'), 'Desktop');
let configPath = path.join(desktopPath, '.workspace');
let defaultConfigPath = path.join(defaultPath, '.workspace');

let tray;
let store = new Store();
let defaultId = '';

// Hide the app icon in macOS dock.
app.dock.hide();
// Disable quitting when window all closed.
app.on('window-all-closed', () => {});

ipcMain.on('create-workspace', (event, name) => {
    if (!fs.existsSync(path.join(workspacePath, name))) {
        fs.mkdirSync(path.join(workspacePath, name));
        fs.writeFileSync(path.join(workspacePath, name, '.workspace'), shortid.generate());
    }
});

ipcMain.on('update-preference', (event, key, value) => {
    if (key === 'general.autostart') {
        app.setLoginItemSettings({
            openAtLogin: value,
            path: app.getPath("exe")
        });
    } else if (key === 'locations.workspaces') {
        buildPaths();
    }
});

function showPreferences () {
    console.log('Showing preferences');
    console.log(preferences);
    preferences.show();
}

function newWorkspace () {
    let win = new BrowserWindow({ 
        width: 300, 
        height: 120,
        frame: false,
        resizable: false,
        movable: false,
        minimizable: false,
        maximizable: false,
        alwaysOnTop: true,
        webPreferences: {
            nodeIntegration: true
        }
    });
    win.loadFile('windows/new-workspace.html');
    win.on('closed', () => {
        win = null
    })
}

function showPreferences () {
    let win = new BrowserWindow({ 
        title: 'Preferences',
        width: 700, 
        height: 300,
        minimizable: false,
        maximizable: false,
        webPreferences: {
            nodeIntegration: true
        }
    });
    win.loadFile('windows/preferences.html');
    win.on('closed', () => {
        win = null
    })
}

function generateIds() {
    const workspaces = fs.readdirSync(workspacePath, {withFileTypes: true});
    for (let workspace of workspaces) {
        if (workspace.isDirectory()) {
            var idPath = path.join(workspacePath, workspace.name, '.workspace');
            if (!fs.existsSync(idPath)) {
                fs.writeFileSync(idPath, shortid.generate());
            }
        }
    }
}

function findNameById(id) {
    const workspaces = fs.readdirSync(workspacePath, {withFileTypes: true});
    for (let workspace of workspaces) {
        if (workspace.isDirectory()) {
            var idPath = path.join(workspacePath, workspace.name, '.workspace');
            try {
                if (fs.readFileSync(idPath, 'utf-8') === id) {
                    return workspace.name;
                }
            } catch {
                generateIds()
            }
        }
    }
    return null;
}

function findPathById(id) {
    var name = findNameById(id);
    if (name) {
        return path.join(workspacePath, name);
    } else {
        return null;
    }
}

function moveFiles(src, dest, callback) {
    const files = fs.readdirSync(src);
    let total = files.length;
    for (let file of files) {
        let processFile = null;
        if (file !== '.workspace') {
            processFile = fs.move;
        } else {
            processFile = fs.copy;
        }
        processFile(
            path.join(src, file),
            path.join(dest, file),
            {overwrite: true},
            err => {
                if (err) {
                    console.log('Duplicates');
                    console.log(path.join(src, file));
                    console.log(path.join(dest, file));
                }
                total --;
                if (total === 0 && callback) {
                    callback();
                }
            }
        );
    }
}

function putbackClicked(menuItem) {
    const currentWorkspaceId = fs.readFileSync(configPath, 'utf-8');
    const workspaceFolderPath = findPathById(currentWorkspaceId);
    console.log('Moving everything back to:', workspaceFolderPath);
    if (workspaceFolderPath.length === 0) return;

    moveFiles(desktopPath, workspaceFolderPath, () => {
        for (let item of menuItem.menu.items) {
            if (item.type == 'checkbox') item.checked = false;
        }
        fs.writeFileSync(configPath, defaultId);
        menuItem.enabled = false;
    });

    tray.setTitle("Switch Workspace");
}

function workspaceClicked(workspace) {
    console.log('Switching to workspace:', workspace.label);
    if (!fs.existsSync(configPath)) {
        generateIds();
    }
    const currentWorkspaceId = fs.readFileSync(configPath, 'utf-8');
    const currentWorkspace = findNameById(currentWorkspaceId);

    // TODO: Add error checking code in case there's no ID

    let workspaceFolderPath = findPathById(currentWorkspaceId);

    if (currentWorkspace !== 'Default Workspace') {
        console.log('-> Moving desktop files to original place:', workspaceFolderPath);
        moveFiles(desktopPath, workspaceFolderPath, () => {
            for (let item of workspace.menu.items) {
                if (item.type === 'checkbox') item.checked = false;
            }

            var workspaceFolderPath = path.join(workspacePath, workspace.label);
            console.log('-> Moving files from folder to desktop:', workspace.label);
            moveFiles(workspaceFolderPath, desktopPath, () => {
                workspace.checked = true;
                workspace.menu.items[0].enabled = true;
                // fs.writeFileSync(configPath, workspace.label);
            });
        });
    } else {
        workspaceFolderPath = path.join(workspacePath, workspace.label);
        console.log('-> Moving files from folder to desktop:', workspace.label);
        moveFiles(workspaceFolderPath, desktopPath, () => {
            workspace.checked = true;
            workspace.menu.items[0].enabled = true;
            // fs.writeFileSync(configPath, workspace.label);
        });
    }
    tray.setTitle(workspace.label);
}

function buildContextMenu() {
    // Check if the current desktop folder has a .workspace. If not, set it to the default workspace.
    if (!fs.existsSync(configPath)) {
        fs.writeFileSync(configPath, defaultId);
    }

    let currentWorkspace = findNameById(fs.readFileSync(configPath, 'utf-8'));
    currentWorkspace = currentWorkspace ? currentWorkspace : 'Default Workspace';

    const template = [
        {
            label: 'New workspace', 
            click: newWorkspace
        },
        { 
            label: 'Put everything back', 
            click: putbackClicked,
            enabled: currentWorkspace !== 'Default Workspace' ? true : false
        },
        { type: 'separator' }
    ]
    const workspaces = fs.readdirSync(workspacePath, {withFileTypes: true});
    workspaces.sort((a, b) => a.name.localeCompare(b.name));
    for (workspace of workspaces) {
        if (workspace.isDirectory() && workspace.name !== 'Default Workspace') {
            template.push({
                label: workspace.name,
                type: 'checkbox',
                checked: workspace.name === currentWorkspace ? true : false,
                click: workspaceClicked
            });
        }
    }

    template.push({ type: 'separator' });
    template.push({ 
        label: 'Preferences...', 
        click: showPreferences,
    });
    template.push({
        label: 'Quit',
        role: 'quit'
    });

    tray.setTitle(currentWorkspace === 'Default Workspace' ? "Switch Workspace" : currentWorkspace);

    return Menu.buildFromTemplate(template);
}


function buildPaths() {
    workspacePath = store.get('locations.workspaces');
    defaultPath = path.join(workspacePath, 'Default Workspace');
    desktopPath = path.join(app.getPath('home'), 'Desktop');
    configPath = path.join(desktopPath, '.workspace');
    defaultConfigPath = path.join(defaultPath, '.workspace');
}


app.on('ready', () => {
    console.log('Current config file path is:', store.path);
    if (!fs.existsSync(store.path)) {
        console.log('No current config. Generating new one.');
        store.store = {
            general: {
                autostart: false
            },
            locations: {
                workspaces: path.join(app.getPath('home'), 'Desktop Workspaces')
            }
        }
    }

    buildPaths();
    
    // Make "Desktop Workspaces" folder if doesn't exist.
    if (!fs.existsSync(workspacePath)) {
        fs.mkdirSync(workspacePath);
    }

    // Make "Default workspace" folder if doesn't exist.
    if (!fs.existsSync(defaultPath)) {
        fs.mkdirSync(defaultPath);
    }

    // Make .workspace file in default workspace if doesn't exist, and set defaultId.
    if (!fs.existsSync(defaultConfigPath)) {
        defaultId = shortid.generate();
        fs.writeFileSync(defaultConfigPath, defaultId);
    } else {
        defaultId = fs.readFileSync(defaultConfigPath, 'utf-8');
    }

    // Check if the current desktop folder has a .workspace. If not, set it to the default workspace.
    if (!fs.existsSync(configPath)) {
        fs.writeFileSync(configPath, defaultId);
    }

    // Generate any missing IDs.
    generateIds();

    let currentWorkspace = findNameById(fs.readFileSync(configPath, 'utf-8'));
    if (!currentWorkspace) {
        fs.writeFileSync(configPath, defaultId);
        currentWorkspace = findNameById(fs.readFileSync(configPath, 'utf-8'));
    }
    console.log('Current workspace is:', currentWorkspace);
    
    tray = new Tray(iconPath);
    tray.setTitle(currentWorkspace && currentWorkspace !== 'Default Workspace' ? currentWorkspace : "Switch Workspace");
    tray.setIgnoreDoubleClickEvents(true);
    tray.on('click', () => {
        tray.popUpContextMenu(buildContextMenu());
    });
});