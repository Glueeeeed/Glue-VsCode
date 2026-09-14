import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	const diagnosticCollection = vscode.languages.createDiagnosticCollection('glue');
	context.subscriptions.push(diagnosticCollection);

	function validateDocument(document: vscode.TextDocument) {
		if (document.languageId !== 'glue') {
			return;
		}

		const diagnostics: vscode.Diagnostic[] = [];

		for (let i = 0; i < document.lineCount; i++) {
			const line = document.lineAt(i);
			const trimmed = line.text.trim();

			if (trimmed.length === 0 || trimmed.startsWith('//')) {
				continue;
			}

			if (
				!trimmed.endsWith('{') &&
				!trimmed.endsWith('}') &&
				!trimmed.endsWith(';') &&
				(trimmed.startsWith('int ') || trimmed.startsWith('return') || trimmed.startsWith('shout') || trimmed.startsWith('random'))
			) {
				const range = new vscode.Range(
					i,
					Math.max(0, line.text.length - 1),
					i,
					line.text.length
				);
				diagnostics.push(new vscode.Diagnostic(
					range,
					'Syntax error: Expected `;` at the end of the line',
					vscode.DiagnosticSeverity.Error
				));
			}


			if (trimmed.includes('func')) {
				if (/\bvoid\b/.test(trimmed)) {
					const voidIndex = line.text.indexOf('void');
					const range = new vscode.Range(i, voidIndex, i, voidIndex + 4);
					diagnostics.push(new vscode.Diagnostic(
						range,
						'Syntax error: The `void` keyword is not allowed. A function without a specified type (e.g., `func test()`) is implicitly `void`.',
						vscode.DiagnosticSeverity.Error
					));
				}

				if (/\bmain\s*\(/.test(trimmed)) {
					const mainIndex = line.text.indexOf('main');

					if (!/\bfunc\s+int\s+main\s*\(/.test(trimmed)) {
						const range = new vscode.Range(i, mainIndex, i, mainIndex + 4);
						diagnostics.push(new vscode.Diagnostic(
							range,
							'Syntax error: The `main` function must specifically return an `int` type (`func int main()`).',
							vscode.DiagnosticSeverity.Error
						));
					}


					let hasReturnZero = false;
					let depth = 0;
					let blockStarted = false;

					for (let j = i; j < document.lineCount; j++) {
						const blockLine = document.lineAt(j).text;

						if (blockLine.includes('{')) {
							depth += (blockLine.match(/\{/g) || []).length;
							blockStarted = true;
						}

						if (blockStarted && /\breturn\s+\d+\s*;/.test(blockLine)) {
							hasReturnZero = true;
						}

						if (blockLine.includes('}')) {
							depth -= (blockLine.match(/\}/g) || []).length;
							if (depth <= 0 && blockStarted) {
								break;
							}
						}
					}

					if (!hasReturnZero) {
						const range = new vscode.Range(i, mainIndex, i, mainIndex + 4);
						diagnostics.push(new vscode.Diagnostic(
							range,
							'Syntax error: The `main` function block must contain `return 0;`.',
							vscode.DiagnosticSeverity.Error
						));
					}
				}
			}

			const intDeclarationMatch = line.text.match(/\bint\s+([a-zA-Z_]\w*)(\s*=\s*;|\s*;)/);
			if (intDeclarationMatch) {
				const startChar = line.text.indexOf(intDeclarationMatch[0]);
				const range = new vscode.Range(
					i,
					startChar,
					i,
					startChar + intDeclarationMatch[0].length
				);
				diagnostics.push(new vscode.Diagnostic(
					range,
					'Syntax error: An `int` variable must be initialized with a value (e.g., `int x = 0;`).',
					vscode.DiagnosticSeverity.Error
				));
			}

			const shoutMatch = line.text.match(/\bshout\s*\(([^)]*)\)/);
			if (shoutMatch) {
				const argsContent = shoutMatch[1];
				const shoutStartIndex = line.text.indexOf(shoutMatch[0]);

				if (argsContent.includes('+')) {
					const plusIndex = line.text.indexOf('+', shoutStartIndex);
					const range = new vscode.Range(i, plusIndex, i, plusIndex + 1);
					diagnostics.push(new vscode.Diagnostic(
						range,
						'Syntax error: The `shout` function does not support the `+` operator. Use comma-separated arguments instead, e.g., shout(x, "text", x);',
						vscode.DiagnosticSeverity.Error
					));
				}

				if (argsContent.trim().length === 0) {
					const range = new vscode.Range(
						i,
						shoutStartIndex,
						i,
						shoutStartIndex + shoutMatch[0].length
					);
					diagnostics.push(new vscode.Diagnostic(
						range,
						'Syntax error: The `shout` function requires at least one argument.',
						vscode.DiagnosticSeverity.Error
					));
				}
			}

			const randomMatch = line.text.match(/\brandom\s*\(([^)]*)\)/);
			if (randomMatch) {
				const argsContent = randomMatch[1].trim();
				const randomStartIndex = line.text.indexOf(randomMatch[0]);

				const args = argsContent.length > 0
					? argsContent.split(',').map(arg => arg.trim())
					: [];

				if (args.length !== 2) {
					const range = new vscode.Range(
						i,
						randomStartIndex,
						i,
						randomStartIndex + randomMatch[0].length
					);
					diagnostics.push(new vscode.Diagnostic(
						range,
						`Syntax error: The \`random\` function requires exactly 2 arguments (e.g., random(1, 2)), but ${args.length} provided.`,
						vscode.DiagnosticSeverity.Error
					));
				}
			}
		}

		diagnosticCollection.set(document.uri, diagnostics);
	}

	context.subscriptions.push(
		vscode.workspace.onDidOpenTextDocument((doc) => validateDocument(doc)),
		vscode.workspace.onDidSaveTextDocument((doc) => validateDocument(doc)),
		vscode.workspace.onDidChangeTextDocument((event) => validateDocument(event.document)),
		vscode.workspace.onDidCloseTextDocument((doc) => diagnosticCollection.delete(doc.uri))
	);

	if (vscode.window.activeTextEditor) {
		validateDocument(vscode.window.activeTextEditor.document);
	}
}

export function deactivate() {}