import * as vscode from 'vscode';
import * as path from 'path';
import {
  LanguageClient,
  LanguageClientOptions,
  ServerOptions,
  TransportKind
} from 'vscode-languageclient/node';

let client: LanguageClient;

export function activate(context: vscode.ExtensionContext) {
  // The server is implemented in node
  const serverModule = context.asAbsolutePath(
    path.join('out', 'server', 'main.js')
  );

  // If the extension is launched in debug mode then the debug server options are used
  // Otherwise the run options are used
  const serverOptions: ServerOptions = {
    run: { module: serverModule, transport: TransportKind.ipc },
    debug: {
      module: serverModule,
      transport: TransportKind.ipc,
      options: { execArgv: ['--nolazy', '--inspect=6009'] }
    }
  };

  // Options to control the language client
  const clientOptions: LanguageClientOptions = {
    // Register the server for Eghact documents
    documentSelector: [{ scheme: 'file', language: 'eghact' }],
    synchronize: {
      // Notify the server about file changes to '.egh' files contained in the workspace
      fileEvents: vscode.workspace.createFileSystemWatcher('**/*.egh')
    }
  };

  // Create the language client and start the client.
  client = new LanguageClient(
    'eghactLanguageServer',
    'Eghact Language Server',
    serverOptions,
    clientOptions
  );

  // Register commands
  registerCommands(context);

  // Start the client. This will also launch the server
  client.start();
}

function registerCommands(context: vscode.ExtensionContext) {
  // Restart Language Server command
  const restartCommand = vscode.commands.registerCommand(
    'eghact.restartLanguageServer',
    () => {
      if (client) {
        client.stop().then(() => {
          client.start();
          vscode.window.showInformationMessage('Eghact Language Server restarted');
        });
      }
    }
  );

  // Show Output command
  const showOutputCommand = vscode.commands.registerCommand(
    'eghact.showOutput',
    () => {
      if (client) {
        client.outputChannel.show();
      }
    }
  );

  // Create Component command
  const createComponentCommand = vscode.commands.registerCommand(
    'eghact.createComponent',
    async () => {
      const componentName = await vscode.window.showInputBox({
        prompt: 'Enter component name',
        validateInput: (value) => {
          if (!value || value.trim().length === 0) {
            return 'Component name is required';
          }
          if (!/^[A-Z][a-zA-Z0-9]*$/.test(value)) {
            return 'Component name must start with uppercase letter';
          }
          return null;
        }
      });

      if (componentName) {
        await createNewComponent(componentName);
      }
    }
  );

  context.subscriptions.push(
    restartCommand,
    showOutputCommand,
    createComponentCommand
  );
}

async function createNewComponent(componentName: string) {
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (!workspaceFolder) {
    vscode.window.showErrorMessage('No workspace folder found');
    return;
  }

  const componentPath = path.join(
    workspaceFolder.uri.fsPath,
    'src',
    'components',
    `${componentName}.egh`
  );

  const componentTemplate = `<template>
  <div class="${componentName.toLowerCase()}">
    <h1>Hello from ${componentName}!</h1>
  </div>
</template>

<script>
  // Component logic here
</script>

<style>
  .${componentName.toLowerCase()} {
    /* Component styles here */
  }
</style>`;

  try {
    // Ensure directory exists
    const componentDir = path.dirname(componentPath);
    await vscode.workspace.fs.createDirectory(vscode.Uri.file(componentDir));

    // Create the component file
    await vscode.workspace.fs.writeFile(
      vscode.Uri.file(componentPath),
      Buffer.from(componentTemplate, 'utf8')
    );

    // Open the new component
    const document = await vscode.workspace.openTextDocument(componentPath);
    await vscode.window.showTextDocument(document);

    vscode.window.showInformationMessage(`Component ${componentName} created successfully!`);
  } catch (error) {
    vscode.window.showErrorMessage(`Failed to create component: ${error}`);
  }
}

export function deactivate(): Thenable<void> | undefined {
  if (!client) {
    return undefined;
  }
  return client.stop();
}