import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	const diagnosticCollection = vscode.languages.createDiagnosticCollection('glue');
	context.subscriptions.push(diagnosticCollection);

	function validateDocument(document: vscode.TextDocument) {
		if (document.languageId !== 'glue') {
			return;
		}

		const diagnostics: vscode.Diagnostic[] = [];
		const text = document.getText();

		for (let i = 0; i < document.lineCount; i++) {
			const line = document.lineAt(i);
			const trimmed = line.text.trim();

			if (
				trimmed.length > 0 &&
				!trimmed.startsWith('//') &&
				!trimmed.endsWith('{') &&
				!trimmed.endsWith('}') &&
				!trimmed.endsWith(';') &&
				(trimmed.startsWith('int ') || trimmed.startsWith('return') || trimmed.startsWith('shout'))
			) {
				const range = new vscode.Range(
					i,
					line.text.length - 1,
					i,
					line.text.length
				);
				const diagnostic = new vscode.Diagnostic(
					range,
					'Syntax Error: expected `;`',
					vscode.DiagnosticSeverity.Error
				);
				diagnostics.push(diagnostic);
			}
		}

		diagnosticCollection.set(document.uri, diagnostics);
	}

	context.subscriptions.push(
		vscode.workspace.onDidOpenTextDocument((doc) => validateDocument(doc))
	);

	context.subscriptions.push(
		vscode.workspace.onDidSaveTextDocument((doc) => validateDocument(doc))
	);

	context.subscriptions.push(
		vscode.workspace.onDidChangeTextDocument((event) => validateDocument(event.document))
	);

	context.subscriptions.push(
		vscode.workspace.onDidCloseTextDocument((doc) => diagnosticCollection.delete(doc.uri))
	);

	if (vscode.window.activeTextEditor) {
		validateDocument(vscode.window.activeTextEditor.document);
	}
}

export function deactivate() {}