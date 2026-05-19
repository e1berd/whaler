export type SandboxImage = {
  id: string
  label: string
  image: string
  description: string
  languages: string[]
  defaultFiles?: Array<{
    path: string
    content: string
  }>
  preview: {
    webCommand: string
    terminalCommand: string
    port: number
  }
}

export const SANDBOX_IMAGES = [
  {
    id: "node-22",
    label: "Node.js 22",
    image: "node:22-bookworm-slim",
    description: "TypeScript, JavaScript, Vite, tooling",
    languages: ["typescript", "javascript", "json", "html", "css"],
    defaultFiles: [
      {
        path: "index.js",
        content: `import { createServer } from "node:http"\n\nconst port = Number(process.env.PORT ?? 4173)\n\ncreateServer((_req, res) => {\n  res.writeHead(200, { "content-type": "text/html; charset=utf-8" })\n  res.end("<h1>Whaler Node preview</h1><p>Edit <code>index.js</code> and press Run.</p>")\n}).listen(port, "0.0.0.0", () => {\n  console.log(\`Listening on \${port}\`)\n})\n`
      },
      {
        path: "package.json",
        content: `{"type":"module","scripts":{"start":"node index.js"}}\n`
      }
    ],
    preview: {
      // Fallbacks no longer depend on python3 (not in node:bookworm-slim).
      // Order: vite project → static index.html via `npx serve` → plain node index.js.
      webCommand:
        "if [ -f package.json ] && grep -q '\"vite\"' package.json; then printf 'import { defineConfig } from \"vite\"\\nexport default defineConfig({ server: { hmr: false } })\\n' > vite.config.whaler-preview.js && npm install && npx vite --host 0.0.0.0 --port ${PORT} --strictPort --config vite.config.whaler-preview.js; elif [ -f index.html ] && [ ! -f index.js ]; then npx --yes serve -l ${PORT} -s .; elif [ -f index.js ]; then node index.js; else echo 'No entrypoint found (expected index.js, index.html, or a vite project)' >&2; exit 1; fi",
      terminalCommand: "if [ -n \"$FILE\" ]; then node \"$FILE\"; elif [ -f package.json ]; then npm install && npm run start; else node --version && ls -la; fi",
      port: 4173
    }
  },
  {
    id: "vite-vue",
    label: "Vite Vue",
    image: "whaler/sandbox-vite-vue:latest",
    description: "Vue starter with Vite preview defaults",
    languages: ["typescript", "javascript", "vue", "json", "html", "css"],
    defaultFiles: [
      {
        path: "package.json",
        content: `{"type":"module","scripts":{"dev":"vite","build":"vue-tsc --noEmit && vite build","preview":"vite preview"},"dependencies":{"@vitejs/plugin-vue":"^6.0.2","typescript":"^5.9.3","vite":"^7.2.4","vue":"^3.5.24","vue-tsc":"^3.1.4"},"devDependencies":{}}\n`
      },
      {
        path: "index.html",
        content: `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Whaler Vue Preview</title></head><body><div id="app"></div><script type="module" src="/src/main.ts"></script></body></html>\n`
      },
      {
        path: "src/main.ts",
        content: `import { createApp } from "vue"\nimport App from "./App.vue"\nimport "./style.css"\n\ncreateApp(App).mount("#app")\n`
      },
      {
        path: "src/App.vue",
        content: `<script setup lang="ts">\nconst message = "Whaler Vite Vue preview"\n</script>\n\n<template>\n  <main class="page">\n    <h1>{{ message }}</h1>\n    <p>Edit <code>src/App.vue</code> and press Play.</p>\n  </main>\n</template>\n`
      },
      {
        path: "src/style.css",
        content: `body{margin:0;font-family:Inter,system-ui,sans-serif;background:#101418;color:#f7fafc}.page{min-height:100vh;display:grid;place-content:center;text-align:center;gap:12px}h1{font-size:42px;margin:0}code{background:#26313a;padding:2px 6px;border-radius:6px}\n`
      },
      {
        path: "vite.config.ts",
        content: `import { defineConfig } from "vite"\nimport vue from "@vitejs/plugin-vue"\n\nexport default defineConfig({ plugins: [vue()], server: { hmr: false } })\n`
      },
      {
        path: "tsconfig.json",
        content: `{"compilerOptions":{"target":"ES2022","module":"ESNext","moduleResolution":"Bundler","strict":true,"jsx":"preserve","skipLibCheck":true},"include":["src/**/*.ts","src/**/*.vue"]}\n`
      }
    ],
    preview: {
      webCommand: "printf 'import base from \"./vite.config\"\\nimport { mergeConfig } from \"vite\"\\nexport default mergeConfig(base, { server: { hmr: false } })\\n' > vite.config.whaler-preview.ts && npm install && npx vite --host 0.0.0.0 --port ${PORT} --strictPort --config vite.config.whaler-preview.ts",
      terminalCommand: "if [ -n \"$FILE\" ] && [ \"${FILE##*.}\" = \"js\" ]; then node \"$FILE\"; else npm install && npm run build; fi",
      port: 4173
    }
  },
  {
    id: "vite-react",
    label: "Vite React",
    image: "whaler/sandbox-vite-react:latest",
    description: "React starter with Vite preview defaults",
    languages: ["typescript", "javascript", "tsx", "jsx", "json", "html", "css"],
    defaultFiles: [
      {
        path: "package.json",
        content: `{"type":"module","scripts":{"dev":"vite","build":"tsc -b && vite build","preview":"vite preview"},"dependencies":{"@vitejs/plugin-react":"^5.1.1","typescript":"^5.9.3","vite":"^7.2.4","react":"^19.2.1","react-dom":"^19.2.1","@types/react":"^19.2.7","@types/react-dom":"^19.2.3"},"devDependencies":{}}\n`
      },
      {
        path: "index.html",
        content: `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Whaler React Preview</title></head><body><div id="root"></div><script type="module" src="/src/main.tsx"></script></body></html>\n`
      },
      {
        path: "src/main.tsx",
        content: `import React from "react"\nimport { createRoot } from "react-dom/client"\nimport "./style.css"\n\ncreateRoot(document.getElementById("root")!).render(<h1>Whaler Vite React preview</h1>)\n`
      },
      {
        path: "src/style.css",
        content: `body{margin:0;font-family:Inter,system-ui,sans-serif;background:#101418;color:#f7fafc;min-height:100vh;display:grid;place-content:center}h1{font-size:42px}\n`
      },
      {
        path: "vite.config.ts",
        content: `import { defineConfig } from "vite"\nimport react from "@vitejs/plugin-react"\n\nexport default defineConfig({ plugins: [react()], server: { hmr: false } })\n`
      },
      {
        path: "tsconfig.json",
        content: `{"compilerOptions":{"target":"ES2022","module":"ESNext","moduleResolution":"Bundler","jsx":"react-jsx","strict":true,"skipLibCheck":true},"include":["src"]}\n`
      }
    ],
    preview: {
      webCommand: "printf 'import base from \"./vite.config\"\\nimport { mergeConfig } from \"vite\"\\nexport default mergeConfig(base, { server: { hmr: false } })\\n' > vite.config.whaler-preview.ts && npm install && npx vite --host 0.0.0.0 --port ${PORT} --strictPort --config vite.config.whaler-preview.ts",
      terminalCommand: "if [ -n \"$FILE\" ] && [ \"${FILE##*.}\" = \"js\" ]; then node \"$FILE\"; else npm install && npm run build; fi",
      port: 4173
    }
  },
  {
    id: "vite-angular",
    label: "Angular 21+",
    image: "whaler/sandbox-vite-angular:latest",
    description: "Angular 21+ project image for browser previews",
    languages: ["typescript", "javascript", "html", "css", "json"],
    defaultFiles: [
      {
        path: "package.json",
        content: `{
  "scripts": {
    "start": "ng serve",
    "build": "ng build"
  },
  "dependencies": {
    "@angular/animations": "^21.2.0",
    "@angular/common": "^21.2.0",
    "@angular/compiler": "^21.2.0",
    "@angular/core": "^21.2.0",
    "@angular/forms": "^21.2.0",
    "@angular/platform-browser": "^21.2.0",
    "@angular/router": "^21.2.0",
    "rxjs": "^7.8.2",
    "tslib": "^2.8.1",
    "zone.js": "^0.15.1"
  },
  "devDependencies": {
    "@angular/build": "^21.2.0",
    "@angular/cli": "^21.2.0",
    "@angular/compiler-cli": "^21.2.0",
    "typescript": "^5.9.3"
  }
}
`
      },
      {
        path: "angular.json",
        content: `{
  "$schema": "./node_modules/@angular/cli/lib/config/schema.json",
  "version": 1,
  "newProjectRoot": "projects",
  "projects": {
    "whaler-angular-preview": {
      "projectType": "application",
      "root": "",
      "sourceRoot": "src",
      "prefix": "app",
      "architect": {
        "build": {
          "builder": "@angular/build:application",
          "options": {
            "browser": "src/main.ts",
            "tsConfig": "tsconfig.app.json",
            "assets": [
              {
                "glob": "**/*",
                "input": "public"
              }
            ],
            "styles": ["src/styles.css"]
          },
          "configurations": {
            "production": {
              "outputHashing": "all"
            },
            "development": {
              "optimization": false,
              "extractLicenses": false,
              "sourceMap": true
            }
          },
          "defaultConfiguration": "development"
        },
        "serve": {
          "builder": "@angular/build:dev-server",
          "configurations": {
            "production": {
              "buildTarget": "whaler-angular-preview:build:production"
            },
            "development": {
              "buildTarget": "whaler-angular-preview:build:development"
            }
          },
          "defaultConfiguration": "development"
        }
      }
    }
  }
}
`
      },
      {
        path: "tsconfig.json",
        content: `{
  "compileOnSave": false,
  "compilerOptions": {
    "outDir": "./dist/out-tsc",
    "strict": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "skipLibCheck": true,
    "isolatedModules": true,
    "experimentalDecorators": true,
    "moduleResolution": "bundler",
    "importHelpers": true,
    "target": "ES2022",
    "module": "ES2022"
  },
  "angularCompilerOptions": {
    "enableI18nLegacyMessageIdFormat": false,
    "strictInjectionParameters": true,
    "strictInputAccessModifiers": true,
    "strictTemplates": true
  }
}
`
      },
      {
        path: "tsconfig.app.json",
        content: `{
  "extends": "./tsconfig.json",
  "compilerOptions": {
    "types": []
  },
  "files": ["src/main.ts"],
  "include": ["src/**/*.d.ts"]
}
`
      },
      {
        path: "index.html",
        content: `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <title>Whaler Angular Preview</title>
    <base href="/" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
  </head>
  <body>
    <app-root></app-root>
  </body>
</html>
`
      },
      {
        path: "src/main.ts",
        content: `import { Component, signal } from "@angular/core"\nimport { bootstrapApplication } from "@angular/platform-browser"\n\n@Component({\n  selector: "app-root",\n  standalone: true,\n  template: \`\n    <main class="page">\n      <section class="panel">\n        <p class="eyebrow">Angular 21+</p>\n        <h1>{{ title() }}</h1>\n        <p>Edit <code>src/main.ts</code> and press Run.</p>\n        <button type="button" (click)="increment()">Clicks: {{ clicks() }}</button>\n      </section>\n    </main>\n  \`\n})\nclass App {\n  readonly title = signal("Whaler Angular preview")\n  readonly clicks = signal(0)\n\n  increment(): void {\n    this.clicks.update((value) => value + 1)\n  }\n}\n\nbootstrapApplication(App).catch((error) => console.error(error))\n`
      },
      {
        path: "src/styles.css",
        content: `html,
body {
  margin: 0;
  min-height: 100%;
  font-family: Inter, system-ui, sans-serif;
  background: #101418;
  color: #f7fafc;
}

.page {
  min-height: 100vh;
  display: grid;
  place-items: center;
  padding: 24px;
}

.panel {
  display: grid;
  gap: 14px;
  text-align: center;
}

.eyebrow {
  margin: 0;
  color: #7dd3fc;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

h1 {
  margin: 0;
  font-size: 42px;
}

p {
  margin: 0;
  color: #cbd5e1;
}

code {
  background: #26313a;
  padding: 2px 6px;
  border-radius: 6px;
}

button {
  justify-self: center;
  border: 0;
  border-radius: 8px;
  padding: 10px 14px;
  background: #38bdf8;
  color: #082f49;
  font-weight: 800;
  cursor: pointer;
}
`
      },
      {
        path: "public/.gitkeep",
        content: ``
      }
    ],
    preview: {
      webCommand: "npm install && npm start -- --host 0.0.0.0 --port ${PORT}",
      terminalCommand: "npm install && npm run build",
      port: 4173
    }
  },
  {
    id: "vite-js",
    label: "Vite JavaScript",
    image: "whaler/sandbox-vite-js:latest",
    description: "Native JavaScript Vite project",
    languages: ["javascript", "json", "html", "css"],
    defaultFiles: [
      {
        path: "package.json",
        content: `{"type":"module","scripts":{"dev":"vite","build":"vite build","preview":"vite preview"},"dependencies":{"vite":"^7.2.4"},"devDependencies":{}}\n`
      },
      {
        path: "index.html",
        content: `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Whaler JS Preview</title></head><body><div id="app"></div><script type="module" src="/src/main.js"></script></body></html>\n`
      },
      {
        path: "src/main.js",
        content: `document.querySelector("#app").innerHTML = "<h1>Whaler Vite JavaScript preview</h1>"\n`
      }
    ],
    preview: {
      webCommand: "printf 'import { defineConfig } from \"vite\"\\nexport default defineConfig({ server: { hmr: false } })\\n' > vite.config.whaler-preview.js && npm install && npx vite --host 0.0.0.0 --port ${PORT} --strictPort --config vite.config.whaler-preview.js",
      terminalCommand: "if [ -n \"$FILE\" ]; then node \"$FILE\"; else npm install && npm run build; fi",
      port: 4173
    }
  },
  {
    id: "vite-ts",
    label: "Vite TypeScript",
    image: "whaler/sandbox-vite-ts:latest",
    description: "Native TypeScript Vite project",
    languages: ["typescript", "javascript", "json", "html", "css"],
    defaultFiles: [
      {
        path: "package.json",
        content: `{"type":"module","scripts":{"dev":"vite","build":"tsc && vite build","preview":"vite preview"},"dependencies":{"typescript":"^5.9.3","vite":"^7.2.4"},"devDependencies":{}}\n`
      },
      {
        path: "index.html",
        content: `<!DOCTYPE html><html><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Whaler TS Preview</title></head><body><div id="app"></div><script type="module" src="/src/main.ts"></script></body></html>\n`
      },
      {
        path: "src/main.ts",
        content: `document.querySelector<HTMLDivElement>("#app")!.innerHTML = "<h1>Whaler Vite TypeScript preview</h1>"\n`
      },
      {
        path: "tsconfig.json",
        content: `{"compilerOptions":{"target":"ES2022","module":"ESNext","moduleResolution":"Bundler","strict":true,"skipLibCheck":true},"include":["src"]}\n`
      }
    ],
    preview: {
      webCommand: "printf 'import { defineConfig } from \"vite\"\\nexport default defineConfig({ server: { hmr: false } })\\n' > vite.config.whaler-preview.js && npm install && npx vite --host 0.0.0.0 --port ${PORT} --strictPort --config vite.config.whaler-preview.js",
      terminalCommand: "if [ -n \"$FILE\" ] && [ \"${FILE##*.}\" = \"js\" ]; then node \"$FILE\"; else npm install && npm run build; fi",
      port: 4173
    }
  },
  {
    id: "php-fpm",
    label: "PHP FPM",
    image: "php:8.4-fpm-alpine",
    description: "PHP scripts and FPM-compatible projects",
    languages: ["php", "html", "css", "javascript", "json"],
    defaultFiles: [
      {
        path: "index.php",
        content: `<?php\n$message = "Whaler PHP preview";\n?><h1><?= htmlspecialchars($message, ENT_QUOTES) ?></h1>\n`
      }
    ],
    preview: {
      webCommand: "php -S 0.0.0.0:${PORT} -t .",
      terminalCommand: "if [ -n \"$FILE\" ]; then php \"$FILE\"; else php -v && find . -name '*.php' -maxdepth 3 -print -exec php -l {} \\;; fi",
      port: 4173
    }
  },
  {
    id: "python-313",
    label: "Python 3.13",
    image: "python:3.13-slim",
    description: "Python scripts and small services",
    languages: ["python", "toml", "yaml", "json"],
    defaultFiles: [
      {
        path: "main.py",
        content: `import os\nfrom http.server import HTTPServer, BaseHTTPRequestHandler\n\nclass Handler(BaseHTTPRequestHandler):\n    def do_GET(self):\n        self.send_response(200)\n        self.send_header("content-type", "text/html; charset=utf-8")\n        self.end_headers()\n        self.wfile.write(b"<h1>Whaler Python preview</h1><p>Edit <code>main.py</code> and press Run.</p>")\n\nport = int(os.environ.get("PORT", 4173))\nprint(f"Listening on {port}")\nHTTPServer(("0.0.0.0", port), Handler).serve_forever()\n`
      },
      {
        path: "index.html",
        content: `<!DOCTYPE html>\n<html><head><meta charset="utf-8"><title>Whaler Python preview</title></head>\n<body><h1>Whaler Python preview</h1><p>Static fallback. Run <code>main.py</code> for the dynamic server.</p></body></html>\n`
      }
    ],
    preview: {
      // Prefer a `main.py` server if present so users see live Python output;
      // otherwise fall back to the built-in static file server.
      webCommand: "if [ -f main.py ]; then python main.py; else python -m http.server ${PORT} --bind 0.0.0.0; fi",
      terminalCommand: "if [ -n \"$FILE\" ]; then python \"$FILE\"; else python --version && find . -maxdepth 2 -type f; fi",
      port: 4173
    }
  },
  {
    id: "bun-12",
    label: "Bun 1.2",
    image: "oven/bun:1.2",
    description: "Bun runtime and package tooling",
    languages: ["typescript", "javascript", "json"],
    defaultFiles: [
      {
        path: "package.json",
        content: `{\n  "type": "module",\n  "scripts": {\n    "dev": "bun run index.ts"\n  }\n}\n`
      },
      {
        path: "index.ts",
        content: `const port = Number(process.env.PORT ?? 4173)\n\nBun.serve({\n  port,\n  hostname: "0.0.0.0",\n  fetch: () =>\n    new Response("<h1>Whaler Bun preview</h1><p>Edit <code>index.ts</code> and press Run.</p>", {\n      headers: { "content-type": "text/html; charset=utf-8" }\n    })\n})\n\nconsole.log(\`Listening on \${port}\`)\n`
      }
    ],
    preview: {
      // Use `bun run index.ts` directly so PORT env works; skip --host/--port
      // CLI flags which would be forwarded as argv to a script that doesn't
      // parse them.
      webCommand: "if [ -f package.json ]; then bun install --silent 2>/dev/null || true; fi; if [ -f index.ts ]; then bun run index.ts; elif [ -f index.js ]; then bun run index.js; else echo 'No index.ts/index.js found' >&2; exit 1; fi",
      terminalCommand: "if [ -n \"$FILE\" ]; then bun run \"$FILE\"; elif [ -f package.json ]; then bun install && bun run build 2>/dev/null || bun --version; else bun --version && ls -la; fi",
      port: 4173
    }
  },
  {
    id: "deno-2",
    label: "Deno 2",
    image: "denoland/deno:2.3.5",
    description: "Deno runtime with TypeScript-first workflow",
    languages: ["typescript", "javascript", "json"],
    defaultFiles: [
      {
        path: "deno.json",
        content: `{\n  "tasks": {\n    "dev": "deno run --allow-net --allow-read --allow-env main.ts"\n  }\n}\n`
      },
      {
        path: "main.ts",
        content: `const port = Number(Deno.env.get("PORT") ?? 4173)\n\nDeno.serve({ port, hostname: "0.0.0.0" }, () =>\n  new Response(\n    "<h1>Whaler Deno preview</h1><p>Edit <code>main.ts</code> and press Run.</p>",\n    { headers: { "content-type": "text/html; charset=utf-8" } }\n  )\n)\n\nconsole.log(\`Listening on \${port}\`)\n`
      }
    ],
    preview: {
      // Try the user's `dev` task first; fall back to running main.ts directly
      // (so a deleted deno.json doesn't break preview), then to a static server.
      webCommand:
        "if [ -f deno.json ] || [ -f deno.jsonc ]; then deno task dev; elif [ -f main.ts ]; then deno run --allow-net --allow-read --allow-env main.ts; elif [ -f index.ts ]; then deno run --allow-net --allow-read --allow-env index.ts; else deno run --allow-net --allow-read jsr:@std/http/file-server --host 0.0.0.0 --port ${PORT}; fi",
      terminalCommand:
        "if [ -n \"$FILE\" ]; then deno run --allow-all \"$FILE\"; elif [ -f deno.json ] || [ -f deno.jsonc ]; then deno task build 2>/dev/null || deno check .; else deno --version && ls -la; fi",
      port: 4173
    }
  }
] as const satisfies readonly SandboxImage[]

export type SandboxImageId = (typeof SANDBOX_IMAGES)[number]["id"]

export function getSandboxImage(id: string): SandboxImage | undefined {
  return SANDBOX_IMAGES.find((image) => image.id === id)
}
