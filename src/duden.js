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

function highlightErrors(text, spellAdvices, selection) {
    if (spellAdvices == null || spellAdvices.length <= 0) {
        vscode.window.showInformationMessage("No errors");
    }

    // line breaks => for offset calculation
    var indices = [];
    for (var i = 0; i < text.length; i++) {
        if (text[i] === "\n") indices.push(i);
    }

    let activeEditor = vscode.window.activeTextEditor;

    spellAdvices.forEach(spellAdvice => {
        // get spelladvice values
        let errorMessage = spellAdvice.errorMessage;
        let shortMessage = spellAdvice.shortMessage;
        let length = spellAdvice.length;
        let offset = spellAdvice.offset;
        let originalError = spellAdvice.originalError;
        let proposals = spellAdvice.proposals;

        // calculate offset for line and character
        let lineOffset = 0;
        let charOffset = offset;

        indices.forEach(index => {
            if (offset > index) {
                lineOffset++;
                charOffset = offset - index - 1;
            }
        });

        // console.log(offset + "<->L:" + lineOffset + "<->C:" + charOffset);

        // selection offset
        let startPos = new vscode.Position(selection.start.line + lineOffset, selection.start.character + charOffset);
        let endPos = new vscode.Position(selection.start.line + lineOffset, selection.start.character + charOffset + length);

        // decorations
        let decoration = { range: new vscode.Range(startPos, endPos), hoverMessage: shortMessage };
        errors.push(decoration);
        activeEditor.setDecorations(errorDecorationType, errors);

        // display diagnostics with fixes
        let document = vscode.window.activeTextEditor.document;
        showDiagnostics(document, new vscode.Range(startPos, endPos), spellAdvice);
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

function reset() {
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