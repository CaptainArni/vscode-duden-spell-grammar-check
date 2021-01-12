const vscode = require('vscode');
const fetch = require('node-fetch');

var api = "https://mentor.duden.de/api/grammarcheck?_format=json";

var collections = [];
var errors = [];

async function spellCheck(text) {
    return new Promise((resolve, reject) => {
        let body = { text: text };
        console.log(text);

        fetch(api, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(body),
        }).then(res => res.json())
            .then(function (json) {
                console.log(json);
                let data = json.data;
                let spellAdvices = data.spellAdvices;

                resolve(spellAdvices);
            }).catch(function (error) {
                reject(error);
            });
    });
}

const errorDecorationType = vscode.window.createTextEditorDecorationType({
    // cursor: 'crosshair',
    // use a themable color. See package.json for the declaration and default values.
    backgroundColor: { id: 'duden.error' }
});

function highlightErrors(spellAdvices, selection) {
    if (spellAdvices == null || spellAdvices.length <= 0) {
        vscode.window.showInformationMessage("No errors");
    }

    let activeEditor = vscode.window.activeTextEditor;

    spellAdvices.forEach(sa => {
        // get spelladvice values
        let errorMessage = sa.errorMessage;
        let shortMessage = sa.shortMessage;
        let length = sa.length;
        let offset = sa.offset;
        let originalError = sa.originalError;
        let proposals = sa.proposals;

        // Information Message
        // let fixMessage = "Wrong: { " + originalError + " } => Fix: ";
        // proposals.forEach(proposal => {
        //     fixMessage += "[ " + proposal + " ], ";
        // });
        // fixMessage = fixMessage.slice(0, -2);
        // fixMessage += " => Error: { " + errorMessage + " }";

        // selection offset
        let startPos = new vscode.Position(selection.start.line, selection.start.character + offset);
        let endPos = new vscode.Position(selection.start.line, selection.start.character + offset + length);

        // decorations
        let decoration = { range: new vscode.Range(startPos, endPos), hoverMessage: shortMessage };
        errors.push(decoration);
        activeEditor.setDecorations(errorDecorationType, errors);

        // vscode.window.showInformationMessage(fixMessage);

        let document = vscode.window.activeTextEditor.document;
        showDiagnostics(document, new vscode.Range(startPos, endPos), sa);
    });

}

function showDiagnostics(document, range, spellAdvice) {
    const collection = vscode.languages.createDiagnosticCollection('Info');
    collections.push(collection);

    let infos = [];
    infos.push(new vscode.DiagnosticRelatedInformation(new vscode.Location(document.uri, range), "Err: " + spellAdvice.originalError));
    spellAdvice.proposals.forEach(proposal => {
        infos.push(new vscode.DiagnosticRelatedInformation(new vscode.Location(document.uri, range), "Fix: " + proposal));
    });

    collection.set(document.uri, [{
        code: spellAdvice.type,
        message: spellAdvice.errorMessage,
        range: range,
        severity: vscode.DiagnosticSeverity.Warning,
        source: 'Duden',
        relatedInformation: infos
    }]);
}

function reset(){
    // clear first
    collections.forEach(collection => {
        collection.clear();
    });

    errors = [];
    vscode.window.activeTextEditor.setDecorations(errorDecorationType, errors);
}

module.exports = {
    reset,
    spellCheck,
    highlightErrors,
    showDiagnostics
};