# transform-typed-imports

A code-mod which transforms TypeScript files to be "isolatedModules" friendly.

## Motivation

TypeScript transpile tools like babel and esbuild convert TypeScript into browser consumable JavaScript. In this process it is important that the tool is able to distinguish what code to drop from the output.

In the example above, `Button` is a real JavaScript export, while `IButtonProps` is a TypeScript interface which doesn't exist in the Javascript output. In order for a tool to convert this file to JavaScript without having a full understanding of the AST of `@fluentui/react`, it needs imports and exports of typed things to use `import type` and `export type`. This syntax gives enough information for the tool to drop type-only things from the JavaScript output.

## Usage

Install globally:

```
npm i -g transform-typed-imports
```

Run the tool in your project folder, and it will process all TypeScript under `src`:

```
transform-typed-imports
```

Run it on a specific match:

```
transform-typed-imports src/**/foo.ts
```

Dry-run only option (-d):

```
transform-typed-imports src/**/foo.ts -d
```

## Notes

* Assumes `src` folder in project root contains TypeScript code.
* Assumes `tsconfig.json` is located in the project root.
