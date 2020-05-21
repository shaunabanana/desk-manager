const fs = require('fs-extra');
const path = require('path');

const { app, Menu, Tray, BrowserWindow, ipcMain } = require('electron');


const iconPath = path.join(__dirname, 'assets', 'icon.png');
const workspacePath = path.join(app.getPath('home'), 'Desktop Workspaces');
const defaultPath = path.join(workspacePath, 'Default Workspace');
const desktopPath = path.join(app.getPath('home'), 'Desktop');
const configPath = path.join(desktopPath, '.workspaceName');

// Hide the app icon in macOS dock.
app.dock.hide();
// Disable quitting when window all closed.
app.on('window-all-closed', () => {});

ipcMain.on('create-workspace', (event, name) => {
    if (!fs.existsSync(path.join(workspacePath, name))) {
        fs.mkdirSync(path.join(workspacePath, name));
        fs.writeFileSync(path.join(workspacePath, name, '.workspaceName'), name);
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
    console.log(path.join(__dirname, 'index.html'));
    win.loadFile('index.html');
    win.on('closed', () => {
        win = null
    })
}

function moveFiles(src, dest, callback) {
    const files = fs.readdirSync(src);
    let total = files.length;
    for (let file of files) {
        fs.move(
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
    const currentWorkspace = fs.readFileSync(configPath, 'utf-8');
    if (currentWorkspace.length == 0) return;

    const workspaceFolderPath = path.join(workspacePath, currentWorkspace);

    moveFiles(desktopPath, workspaceFolderPath, () => {
        for (let item of menuItem.menu.items) {
            if (item.type == 'checkbox') item.checked = false;
        }
        fs.writeFileSync(configPath, 'Default Workspace');
        menuItem.enabled = false;
    });
}

function workspaceClicked(workspace) {
    const currentWorkspace = fs.readFileSync(configPath, 'utf-8');
    let workspaceFolderPath = path.join(workspacePath, currentWorkspace);
    if (currentWorkspace != 'Default Workspace') {
        moveFiles(desktopPath, workspaceFolderPath, () => {
            for (let item of workspace.menu.items) {
                if (item.type == 'checkbox') item.checked = false;
            }

            workspaceFolderPath = path.join(workspacePath, workspace.label);
            moveFiles(workspaceFolderPath, desktopPath, () => {
                workspace.checked = true;
                workspace.menu.items[0].enabled = true;
                fs.writeFileSync(configPath, workspace.label);
            });
        });
    } else {
        workspaceFolderPath = path.join(workspacePath, workspace.label);
        moveFiles(workspaceFolderPath, desktopPath, () => {
            workspace.checked = true;
            workspace.menu.items[0].enabled = true;
            fs.writeFileSync(configPath, workspace.label);
        });
    }
}

function buildContextMenu() {
    if (!fs.existsSync(defaultPath)) {
        fs.mkdirSync(defaultPath);
    }

    if (!fs.existsSync(configPath)) {
        fs.writeFileSync(configPath, 'Default Workspace');
    }

    const currentWorkspace = fs.readFileSync(configPath, 'utf-8');
    console.log(currentWorkspace)

    const template = [
        { 
            label: 'New workspace', 
            click: newWorkspace
        },
        { 
            label: 'Put everything back', 
            click: putbackClicked,
            enabled: currentWorkspace != 'Default Workspace' ? true : false
        },
        { type: 'separator' }
    ]
    const workspaces = fs.readdirSync(workspacePath, {withFileTypes: true});
    for (workspace of workspaces) {
        if (workspace.isDirectory() && workspace.name != 'Default Workspace') {
            template.push({
                label: workspace.name,
                type: 'checkbox',
                checked: workspace.name == currentWorkspace ? true : false,
                click: workspaceClicked
            });
        }
    }

    template.push({ type: 'separator' });
    template.push({
        label: 'Quit',
        role: 'quit'
    });

    return Menu.buildFromTemplate(template);
}


app.on('ready', () => {
    const tray = new Tray(iconPath);
    tray.setTitle("Switch workspace");
    tray.setIgnoreDoubleClickEvents(true);
    tray.on('click', () => {
        tray.popUpContextMenu(buildContextMenu());
    });
});