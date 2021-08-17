# transform-typed-imports

A code-mod which transforms TypeScript files to move imports/exports of typings to use `import type`/`export type`, allowing the package to become `isolatedModules` friendly.

Converts this (a class and an interface import and export):

```ts
import { Checkbox, CheckboxProps } from '@fluentui/react-checkbox';
// ...
export { Button, IButtonProps } from '@fluentui/react-button';
```

To this (separting JavaScript and TypeScript imports/exports explicitly):

```ts
import { Checkbox } from '@fluentui/react-checkbox';
import type { CheckboxProps } from '@fluentui/react-checkbox';
// ...
export { Button } from '@fluentui/react-button';
export type { IButtonProps } from '@fluentui/react-button';
```

...which in turn lets transpilers transform your TypeScript into the appropriate JavaScript without knowing the types of the external dependencies:

```js
import { Checkbox } from '@fluentui/react-checkbox';
// ...
export { Button } from '@fluentui/react-button';
```

## Motivation

When transpilers like esbuild or babel are used to transform TypeScript into JavaScript, they have little to no visibility on the full AST and in many cases can't know whether something should be dropped or not. Take for example this statement:

```ts
export { Button, IButtonProps } from '@fluentui/react-button';
```

Most of the time, interface imports are dropped because removing TypeScript from the code means the import is inferred to be unused. Cross-package interface exports like the above `IButtonProps` on the other hand are impossible to drop without parsing the AST of the external package to discover if `IButtonProps` is a JavaScript export or a TypeScript export.

TypeScript 3.8 and above solves this through the syntax `import type` and `export type`, implying the named identifiers being imported/exported are TypeScript types. With these annotations the transpilers can know what to drop without full context, thus enabling features like "bundling the package to be consumed by the browser while externalizing dependencies."

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
- Alias imports/exports are preserved.
- Comments are not moved with imports. You may need to manually adjust comments after modification, especially for linting disable comments that disable certain checks.
