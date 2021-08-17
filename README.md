# transform-typed-imports

A code-mod which transforms TypeScript files to move imports/exports of typings to use `import type`/`export type`, allowing the package to become `isolatedModules` friendly.

## Motivation

When transpilers like esbuild or babel are used to transform TypeScript into JavaScript, they have little to no visibility on the full AST and in many cases can't know whether something should be dropped or not. Take for example this statement:

```ts
export { Button, IButtonProps } from '@fluentui/react-button';
```

Most of the time, interface imports can be dropped because when all of the references are gone, the import is inferred to be unused. Exports like the above on the other hand are impossible to drop without knowing if `IButtonProps` is a javascript export or a TypeScript export.

TypeScript 3.8 and above solves this through the syntax "import type" and "export type", implying the named identifiers being imported/exported are TypeScript types. With these annotations the transpilers can know what to drop without full context, thus enabling features like "bundling the package to be consumed by the browser while externalizing dependencies."

Running this tool in a project with the example above will convert it to:

```
export { Button } from '@fluentui/react-button';
export type { IButtonProps } from '@fluentui/react-button';
```

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

`-d` - Dry-run only option (-d) prints output to console rather than writing changes back to the file:

```
transform-typed-imports src/**/foo.ts -d
```

## Notes

- Assumes `src` folder in project root contains TypeScript code.
- Assumes `tsconfig.json` is located in the project root.
- Comments are not moved with imports. You may need to manually adjust comments after modification, especially for linting disable comments that disable certain checks.
