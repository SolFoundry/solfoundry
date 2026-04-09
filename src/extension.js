// This is the main entry point of the SolFoundry Bounty Browser extension.

// Import the required modules
const vscode = require('vscode');

function activate(context) {
    let disposable = vscode.commands.registerCommand('solfoundry-bounty-browser.start', function () {
        vscode.window.showInformationMessage('SolFoundry Bounty Browser is starting!');
    });
    context.subscriptions.push(disposable);
}

function deactivate() {}

module.exports = { activate, deactivate };