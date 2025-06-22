import MagicString from 'magic-string';

export async function transformHtml(html, options = {}) {
  const s = new MagicString(html);
  
  if (options.injectHMRClient) {
    // Inject HMR client script
    const hmrScript = `
    <script type="module">
      import { createHMRClient } from '/__eghact/client/hmr.js';
      const hmr = createHMRClient();
      hmr.connect();
    </script>
    `;
    
    // Find </head> or </body> to inject script
    const headEnd = html.indexOf('</head>');
    if (headEnd !== -1) {
      s.appendLeft(headEnd, hmrScript);
    } else {
      const bodyEnd = html.indexOf('</body>');
      if (bodyEnd !== -1) {
        s.appendLeft(bodyEnd, hmrScript);
      } else {
        // No head or body, append at end
        s.append(hmrScript);
      }
    }
  }
  
  // Transform .egh imports to .js
  const moduleRegex = /<script\s+type="module"[^>]*>([\s\S]*?)<\/script>/g;
  let match;
  
  while ((match = moduleRegex.exec(html)) !== null) {
    const scriptContent = match[1];
    const transformed = transformImports(scriptContent);
    if (transformed !== scriptContent) {
      s.overwrite(
        match.index + match[0].indexOf(scriptContent),
        match.index + match[0].indexOf(scriptContent) + scriptContent.length,
        transformed
      );
    }
  }
  
  return s.toString();
}

function transformImports(code) {
  // Transform .egh imports to .js
  return code.replace(
    /import\s+(.+?)\s+from\s+['"](.+?)\.egh['"]/g,
    'import $1 from "$2.egh"'
  );
}