const vscode = require('vscode');
const fetch = require('node-fetch');

var api = "https://mentor.duden.de/api/grammarcheck?_format=json";

var collections = [];
var errors = [];

async function spellCheck(text) {
    return new Promise((resolve, reject) => {
        let body = { text: text };
        console.log(text);

        // free duden only allows max of 800 characters
        if(text.length > 800){
            reject("Character limit (800) reached. Selected: " + text.length);
        }

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

// document can override to allow for async checking
function highlightErrors(text, spellAdvices, selection, activeEditor = undefined) {
    if (spellAdvices == null || spellAdvices.length <= 0) {
        vscode.window.showInformationMessage("No errors");
    }

    // line breaks => for offset calculation
    var indices = [];
    for (var i = 0; i < text.length; i++) {
        if (text[i] === "\n") indices.push(i);
    }

    activeEditor = activeEditor || vscode.window.activeTextEditor;

    spellAdvices.forEach(spellAdvice => {
        // get spelladvice values
        let shortMessage = spellAdvice.shortMessage;
        let length = spellAdvice.length;
        let offset = spellAdvice.offset;

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
        showDiagnostics(activeEditor.document, new vscode.Range(startPos, endPos), spellAdvice);
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

    // filter HTML tags
    let errorMessage = spellAdvice.errorMessage.replace(/<[^>]*>?/gm, '');

    collection.set(document.uri, [{
        code: spellAdvice.type,
        message: errorMessage,
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


function autoSpellCheck(dudenOut) {
    const configuration = vscode.workspace.getConfiguration('duden-spell-grammar-check');
    const before = configuration.get("autoCheckSurroundingLines.before");
    const after = configuration.get("autoCheckSurroundingLines.after");
    const delimiters = configuration.get("autoCheckSurroundingLines.delimiters");
    dudenOut.appendLine(`Checking source code surrounding current cursor {${before}; ${after}; with delimiters: ${JSON.stringify(delimiters)}}`);
    const activeEditor = vscode.window.activeTextEditor;
    const document = activeEditor.document;
    const cursor = activeEditor.selection.active;

    let { text, startPositionOfBefore, endPositionOfAfter } = getPositionBeforeAfter(document, cursor, before, after);
    if (text === null || text === undefined) {
        dudenOut.appendLine('Got no text.');
        return;
    }
    // note: this allows for errors on the start and end as we clip words, therefore i search for the first and last delimiter and use them
    // as an additional clip:
    // if the index is negative, the delimiter is not found
    const documentLength = lengthOfDocument(document);
    const {delimMin, delimMax} = getMinAndMaxDelimInText(delimiters, text);
    // we do not use the delims, if we include start and or end of the document
    const firstDelim = document.offsetAt(startPositionOfBefore) == 0 ? 0 : Math.max(0, delimMin);
    const lastDelim = document.offsetAt(endPositionOfAfter) === documentLength ? documentLength : Math.max(0, delimMax);
    // we do not adapt the end position as it is no longer needed
    startPositionOfBefore = shiftPositionInDocument(document, startPositionOfBefore, firstDelim);
    text = text.slice(firstDelim, lastDelim);

    reset();
    spellCheck(text).then(spellAdvices => {
        // we do only need the starting position
        highlightErrors(text, spellAdvices, new vscode.Selection(startPositionOfBefore, startPositionOfBefore), activeEditor);
    }).catch(function (message) {
        vscode.window.showWarningMessage(message);
    });
}

function getMinAndMaxDelimInText(delimiters, text) {
    // TODO: make it more efficient by only search once
    const starts = delimiters.map(d => {
        const index = text.indexOf(d);
        return index < 0 ? undefined : index + d.length
    }).filter(idx => idx !== undefined);
    const ends = delimiters.map(d => {
        const index = text.lastIndexOf(d);
        return index < 0 ? undefined : index + d.length
    }).filter(idx => idx !== undefined);
    return {
        delimMin: Math.min(...starts),
        delimMax: Math.max(...ends)
    };
}

function getPositionBeforeAfter(document, cursor, before, after) {
    // TODO: allow positions to adapt and shift if, e.g. we are at the start of the document
    const startPositionOfBefore = shiftPositionInDocument(document, cursor, -before);
    const endPositionOfAfter = shiftPositionInDocument(document, cursor, after);

    const beforeText = document.getText(new vscode.Range(startPositionOfBefore, cursor));
    const afterText = document.getText(new vscode.Range(cursor, endPositionOfAfter));
    const text = beforeText + afterText;
    return { text, startPositionOfBefore, endPositionOfAfter };
}

function lengthOfDocument(document) {
    return document.offsetAt(new vscode.Position(document.lineCount, 0));
}

function shiftPositionInDocument(document, position, shift) {
    return document.positionAt(document.offsetAt(position) + shift);
}


module.exports = {
    reset,
    spellCheck,
    highlightErrors,
    showDiagnostics,
    autoSpellCheck
};