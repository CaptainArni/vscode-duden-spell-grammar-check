// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
const vscode = require('vscode');

const duden = require("./duden")

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

		if (editor) {
			const document = editor.document;
			// const selection = editor.selection;

			const selections = editor.selections;

			// Get the text within the selection
			// let text = document.getText(selection);

			// replace line endings => convert to single line
			// if(!selection.isSingleLine){
			// 	text = text.replace(/(\r\n|\n|\r)/gm, " ");
			// 	editor.edit(editBuilder => {
			// 		editBuilder.replace(selection, text);
			// 	});
			// }

			duden.reset();

			selections.forEach(selection => {
				let text = document.getText(selection);

				duden.spellCheck(text).then(function (spellAdvices) {
					console.log(spellAdvices);

					duden.highlightErrors(spellAdvices, selection);
				});
			});
		}
	});

	context.subscriptions.push(disposable);
}
exports.activate = activate;

// this method is called when your extension is deactivated
function deactivate() { }

module.exports = {
	activate,
	deactivate
}
