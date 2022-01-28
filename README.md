# DeskManager
 A macOS app that swaps files in and out of your desktop folder.
 
## Download
[Click here](https://github.com/shaunabanana/desk-manager/releases/download/β-0.4/DeskManager-darwin-x64-b0.4.zip) for the newest version.
For all versions, see the [Releases](https://github.com/shaunabanana/desk-manager/releases) page.

## Usage
* Place the app file in `/Applications`, and launch the app. Upon the first launch, you will likely be asked for permission to access your desktop folder. This is for swapping the files.
* You will notice that there's now a "Desktop Workspaces" folder under your home directory. This is where all the desktop folders live.
* Any folder you create here will be automatically added to the menu, and you can select an item in the menu to swap it out.

## Development
Set up dependencies:
```
npm install
```
Package into app file:
```
electron-packager . DeskManager --overwrite
```

## Support me
<a href="https://www.buymeacoffee.com/shengchen" target="_blank"><img src="https://cdn.buymeacoffee.com/buttons/default-orange.png" alt="Buy Me A Coffee" height="41" width="174"></a>
