// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const { clearInterval } = require('timers');
const vscode = require('vscode');

const duden = require("./duden")

let autoCheckInterval;

// this method is called when your extension is activated
// your extension is activated the very first time the command is executed

/**
 * @param {vscode.ExtensionContext} context
 */
function activate(context) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "duden-spell-grammar-check" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with  registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('duden-spell-grammar-check.checkSpelling', function () {
		// The code you place here will be executed every time your command is executed
		const editor = vscode.window.activeTextEditor;

		if(editor) {
			const document = editor.document;
			const selections = editor.selections;

			duden.reset();

			selections.forEach(selection => {
				let text = document.getText(selection);

				duden.spellCheck(text).then(function (spellAdvices) {
					console.log(spellAdvices);

					duden.highlightErrors(text, spellAdvices, selection);
				}).catch(function (message) {
					vscode.window.showWarningMessage(message);
				});
			});
		}
	});

	context.subscriptions.push(disposable);

	const autoSpellCheck = function () {
		const dudenOut = vscode.window.createOutputChannel("Duden Spell & Grammar Check");
		const configuration = vscode.workspace.getConfiguration('duden-spell-grammar-check');
		if(autoCheckInterval === undefined) {
			const interval = configuration.get('autoCheckSurroundingLines.interval')
			duden.autoSpellCheck(dudenOut);
			dudenOut.appendLine(`Start automated checking every ${interval} milliseconds.`);
			autoCheckInterval = setInterval(() => duden.autoSpellCheck(dudenOut), interval);
		} else {
			dudenOut.appendLine("Stopped automated checking.");
			disableAutoCheck();
		}
	};
	const checkSpellingAroundCursor = vscode.commands.registerCommand('duden-spell-grammar-check.checkSpellingAroundCursor', autoSpellCheck);
	context.subscriptions.push(checkSpellingAroundCursor);
}

exports.activate = activate;

// this method is called when your extension is deactivated
function deactivate() {
	if(autoCheckInterval !== undefined)
		disableAutoCheck();
}

function disableAutoCheck() {
	clearInterval(autoCheckInterval);
	autoCheckInterval = undefined;
}

module.exports = {
	activate,
	deactivate
}
