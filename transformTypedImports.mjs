import fs from "fs";
import path from "path";
import { ModuleResolutionKind, Project, SyntaxKind } from "ts-morph";
import minimatch from "minimatch";

const divider = "--------------------------------------------------";

/**
 * Transforms the imports/exports for the current project. Assumes the
 * project has TypeScript files under the /src folder. Will also assume
 * tsconfig.json is in the project root, and will use it if found.
 */
export default async function transformTypedImports({
  projectPath = process.cwd(),
  dry = false,
  sourceMatch,
} = {}) {
  const { writeFile } = fs.promises;

  console.log("Finding source files...");

  let tsConfigFilePath = path.join(process.cwd(), "tsconfig.json");

  if (!fs.existsSync(tsConfigFilePath)) {
    tsConfigFilePath = undefined;
  }

  // initialize
  const project = new Project({
    // Read more: https://ts-morph.com/setup/
    tsConfigFilePath,
    compilerOptions: {
      moduleResolution: ModuleResolutionKind.NodeJs,
      jsx: 4,
    },
  });

  // add source files
  project.addSourceFilesAtPaths(["**/src/**/*.ts", "**/src/**/*.tsx"]);

  const compiler = project.getLanguageService().compilerObject;

  let sourceFiles = project.getSourceFiles();

  let matchedFiles = sourceFiles.filter((s) => {
    // Remove .d.ts files from files to modify, should the get into
    // sourceFiles matched/loaded by the language service.
    if (s.getFilePath().endsWith(".d.ts")) {
      return false;
    }

    // If a sourceMatch is provided, use minimatch to match it against
    // the source filepath.
    if (sourceMatch) {
      return minimatch(
        path.relative(projectPath, s.getFilePath()),
        sourceMatch
      );
    }
    return true;
  });

  // If we don't have source files, return.
  if (!matchedFiles?.length) {
    console.log(`No source files matched.`);
    return;
  }

  console.log(
    `Processing ${matchedFiles.length} file(s)${
      sourceFiles.length ? ` (Total parsed: ${sourceFiles.length})` : ""
    }...`
  );

  // For each source file...
  for (let source of matchedFiles) {
    console.log(`\nParsing source: "${source.getFilePath()}"\n${divider}`);

    const filePath = source.getFilePath();

    let hasChanged = false;
    const moduleSpecifierToNamedImports = {};
    const moduleSpecifierToNamedExports = {};

    // ...Iterate through imports;
    for (let decl of source.getImportDeclarations()) {
      // For each clause within each import...
      for (let clause of decl.getDescendantsOfKind(SyntaxKind.ImportClause)) {
        const isTypeClause = clause.getText().startsWith("type");

        // ...If the clause is not a typed import,
        if (!isTypeClause) {
          const moduleSpecifier = decl.getModuleSpecifierValue();

          // Iterate through the named imports
          for (const importSpecifier of decl.getNamedImports()) {
            const name = importSpecifier.getNameNode().getText();
            const alias = importSpecifier.getAliasNode()?.getText();

            const definitions = compiler.getDefinitionAtPosition(
              source.getFilePath(),
              importSpecifier.getStart() + 1
            );

            // If the definition is a typed definition,
            if (
              definitions.find(
                (d) => d.kind === "interface" || d.kind === "type"
              )
            ) {
              // Remove the import and cache it to be re-added as a typed import later on.
              hasChanged = true;
              importSpecifier.remove();

              // If this is the last named import, remove the import declaration.
              if (!decl.getNamedImports()?.length) {
                decl.remove();
              }

              console.log(`* Removing import ${name} from ${moduleSpecifier}`);

              moduleSpecifierToNamedImports[moduleSpecifier] =
                moduleSpecifierToNamedImports[moduleSpecifier] || [];

              // Push either a name string or object if alias is required.
              moduleSpecifierToNamedImports[moduleSpecifier].push(
                alias
                  ? {
                      name,
                      alias,
                    }
                  : name
              );
            }
          }
        }
      }
    }

    // ...Iterate through exports;
    for (let decl of source.getExportDeclarations()) {
      // If the export declaration is not a typed export...
      if (!decl.getText().startsWith("export type")) {
        // Iterate through the named exports
        for (let clause of decl.getNamedExports()) {
          const name = clause.getNameNode().getText();
          const alias = clause.getAliasNode()?.getText();

          const moduleSpecifier = clause
            .getExportDeclaration()
            .getModuleSpecifierValue();

          const definitions = compiler.getDefinitionAtPosition(
            source.getFilePath(),
            clause.getStart() + 1
          );

          const kind = definitions?.find(
            (d) =>
              d.kind === "interface" || d.kind === "type" || d.kind === "alias"
          )?.kind;

          // console.log("export", name, alias, definitions, clause.getStart());

          // If this is a typed export,
          if (kind) {
            // Remove the named export
            hasChanged = true;

            if (decl.getNamedExports().length === 1) {
              decl.remove();
            } else {
              clause.remove();
            }
            // If this is the last named export, remove the declaration.
            console.log(
              `* Removing export ${name} (${kind}) from ${moduleSpecifier}`
            );

            const namedExports = (moduleSpecifierToNamedExports[
              moduleSpecifier
            ] = moduleSpecifierToNamedExports[moduleSpecifier] || []);
            namedExports.push(alias ? { name, alias } : name);
          }
        }
      }
    }

    // If we have made changes, apply them.
    if (hasChanged) {
      // ...Iterate through imports we removed and add back as type imports.
      for (const moduleSpecifier of Object.keys(
        moduleSpecifierToNamedImports
      )) {
        console.log(
          `* Adding imports for ${moduleSpecifier}:`,
          moduleSpecifierToNamedImports[moduleSpecifier]
        );
        source.addImportDeclaration({
          isTypeOnly: true,
          namedImports: moduleSpecifierToNamedImports[moduleSpecifier],
          moduleSpecifier,
        });
      }

      // ...Also iterate through exports.
      for (const moduleSpecifier of Object.keys(
        moduleSpecifierToNamedExports
      )) {
        console.log(
          `* Adding exports for ${moduleSpecifier}:`,
          moduleSpecifierToNamedExports[moduleSpecifier]
        );
        const decl = {
          isTypeOnly: true,
          namedExports: moduleSpecifierToNamedExports[moduleSpecifier],
        };

        if (moduleSpecifier !== "undefined") {
          decl.moduleSpecifier = moduleSpecifier;
        }

        source.addExportDeclaration(decl);
      }

      if (dry) {
        console.log(
          `\nPrinting source file "${source.getFilePath()}":\n${divider}\n${source.getText()}${divider}`
        );
      } else {
        // Save the source.
        console.log(`\nSaving source file "${source.getFilePath()}"`);
        await source.save();
      }
    }
  }
}
