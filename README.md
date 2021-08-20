# transform-typed-imports

A code-mod which transforms TypeScript files to be "isolatedModules" friendly.

## Motivation

TypeScript transpile tools like babel and esbuild convert TypeScript into browser consumable JavaScript. In this process it is important that the tool is able to distinguish what code to drop from the output.

Take for example:

```ts
export { Button, IButtonProps } from "@fluentui/react";
```

In the example above, `Button` is an export which should emit javascript content, while `IButtonProps` is a TypeScript interface which should be removed during transpilation to JavaScript.

In order for a tool to convert this file to JavaScript without having a full understanding of the AST of `@fluentui/react`, it needs imports and exports of typed things to use `import type` and `export type` syntax, which tells the transpiler explicitly what types are safe to drop.

## Usage

Installation:

```
npm i -g transform-typed-imports
```

Usage:

```
transform-typed-imports <match> [-d] [-s]
```

Run the tool in your project folder, and it will process all TypeScript under `src`:

```
transform-typed-imports
```

Run it on a specific match:

```
transform-typed-imports src/**/foo.ts
```

`-d` - Dry-run only option (-d) prints output to console rather than writing changes back to the file:

```
transform-typed-imports src/**/foo.ts -d
```

`-s` - Run in silent mode (no console logging.)

```
transform-typed-imports -s
```

## Notes

- Assumes `src` folder in project root contains TypeScript code.
- Assumes `tsconfig.json` is located in the project root.
- Comments are not moved with imports. You may need to manually adjust comments after modification, especially for linting disable comments that disable certain checks.
