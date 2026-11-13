import * as vscode from 'vscode';

export function activate(context: vscode.ExtensionContext) {
	const diagnosticCollection = vscode.languages.createDiagnosticCollection('glue');
	context.subscriptions.push(diagnosticCollection);

	// Code completion provider
	const completionProvider = vscode.languages.registerCompletionItemProvider('glue', {
		provideCompletionItems(_document: vscode.TextDocument, _position: vscode.Position) {
			const items: vscode.CompletionItem[] = [];

			const keywords = [
				{ label: 'int', kind: vscode.CompletionItemKind.Keyword, insertText: 'int ${1:variableName} = ${2:value};' },
				{ label: 'float', kind: vscode.CompletionItemKind.Keyword, insertText: 'float ${1:variableName} = ${2:value}f;' },
				{ label: 'string', kind: vscode.CompletionItemKind.Keyword, insertText: 'string ${1:variableName} = ${2:value}f;' },
				{ label: 'double', kind: vscode.CompletionItemKind.Keyword, insertText: 'double ${1:variableName} = ${2:value};' },
				{ label: 'byte', kind: vscode.CompletionItemKind.Keyword, insertText: 'byte ${1:variableName} = ${2:value};' },
				{ label: 'small', kind: vscode.CompletionItemKind.Keyword, insertText: 'small ${1:variableName} = ${2:value};' },
				{ label: 'long', kind: vscode.CompletionItemKind.Keyword, insertText: 'long ${1:variableName} = ${2:value};' },
				{ label: 'huge', kind: vscode.CompletionItemKind.Keyword, insertText: 'huge ${1:variableName} = ${2:value};' },
				{ label: 'func', kind: vscode.CompletionItemKind.Keyword, insertText: 'func ${1:returnType} ${2:functionName}() {\n\t$0\n}' },
				{ label: 'if', kind: vscode.CompletionItemKind.Keyword, insertText: 'if (${1:condition}) {\n\t$0\n}' },
				{ label: 'while', kind: vscode.CompletionItemKind.Keyword, insertText: 'while (${1:condition}) {\n\t$0\n}' },
				{ label: 'sticky', kind: vscode.CompletionItemKind.Keyword, insertText: 'sticky ${1:variableType}  ${2:variableName} = ${3:value};' },
				{ label: 'const', kind: vscode.CompletionItemKind.Keyword, insertText: 'const ${1:variableType}  ${2:variableName} = ${3:value};' },
				{ label: 'return', kind: vscode.CompletionItemKind.Keyword, insertText: 'return ${1:value};' },
				{ label: 'sigue', kind: vscode.CompletionItemKind.Keyword, insertText: 'sigue;' },
				{ label: 'fin', kind: vscode.CompletionItemKind.Keyword, insertText: 'fin;' },
				{ label: 'sino', kind: vscode.CompletionItemKind.Keyword, insertText: 'sino' },
			];

			const functions = [
				{ label: 'shout', kind: vscode.CompletionItemKind.Function, insertText: 'shout(${1:message});' },
				{ label: 'shin', kind: vscode.CompletionItemKind.Function, insertText: 'shin();' },
				{ label: 'random', kind: vscode.CompletionItemKind.Function, insertText: 'random(${1:min}, ${2:max});' },
			];

			const methods = [
				{ label: 'toInt', kind: vscode.CompletionItemKind.Method, insertText: 'toInt()' },
				{ label: 'toString', kind: vscode.CompletionItemKind.Method, insertText: 'toString()' },
				{ label: 'toFloat', kind: vscode.CompletionItemKind.Method, insertText: 'toFloat()' },
			];

			for (const kw of keywords) {
				const item = new vscode.CompletionItem(kw.label, kw.kind);
				item.insertText = new vscode.SnippetString(kw.insertText);
				item.detail = 'Keyword';
				items.push(item);
			}

			for (const fn of functions) {
				const item = new vscode.CompletionItem(fn.label, fn.kind);
				item.insertText = new vscode.SnippetString(fn.insertText);
				item.detail = 'Built-in function';
				items.push(item);
			}

			for (const m of methods) {
				const item = new vscode.CompletionItem(m.label, m.kind);
				item.insertText = new vscode.SnippetString(m.insertText);
				item.detail = 'Method';
				items.push(item);
			}

			return items;
		}
	}, '.', ' ', '(', 'f');

	context.subscriptions.push(completionProvider);

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