const fs = require('fs-extra');
const path = require('path');
var shortid = require('shortid');

const { app, Menu, Tray, BrowserWindow, ipcMain } = require('electron');


const iconPath = path.join(__dirname, 'assets', 'IconTemplate.png');
const workspacePath = path.join(app.getPath('home'), 'Desktop Workspaces');
const defaultPath = path.join(workspacePath, 'Default Workspace');
const desktopPath = path.join(app.getPath('home'), 'Desktop');
const configPath = path.join(desktopPath, '.workspace');
const defaultConfigPath = path.join(defaultPath, '.workspace');

let defaultId = '';


let tray;

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
    win.loadFile('index.html');
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
    const currentWorkspaceId = fs.readFileSync(configPath, 'utf-8');
    const currentWorkspace = findNameById(currentWorkspaceId);
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
        label: 'Quit',
        role: 'quit'
    });

    tray.setTitle(currentWorkspace === 'Default Workspace' ? "Switch workspace" : currentWorkspace);

    return Menu.buildFromTemplate(template);
}


app.on('ready', () => {
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
    console.log('Starting up. Current workspace is:', currentWorkspace);
    
    tray = new Tray(iconPath);
    tray.setTitle(currentWorkspace && currentWorkspace !== 'Default Workspace' ? currentWorkspace : "Switch workspace");
    tray.setIgnoreDoubleClickEvents(true);
    tray.on('click', () => {
        tray.popUpContextMenu(buildContextMenu());
    });
});