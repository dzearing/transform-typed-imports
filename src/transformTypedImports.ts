import fs from "fs";
import path from "path";
import {
  ExportDeclarationStructure,
  ModuleResolutionKind,
  OptionalKind,
  Project,
  SyntaxKind,
} from "ts-morph";
import minimatch from "minimatch";

const divider = "--------------------------------------------------";
const emptyModuleSpecifier = "/undefined/";

export interface TransformTypedImportsOptions {
  /**
   * Root of the project, defaults to process.cwd();
   */
  projectPath?: string;

  /**
   * Dry run only, emits source output to console rather than to disk.
   */
  dry?: boolean;

  /**
   * Silent mode, don't log to console.log.
   */
  silent?: boolean;

  /**
   * Glob match to apply transforms to.
   */
  sourceMatch?: string;
}

export interface TransformTypedImportsChangeEntry {
  path: string;
  originalContent: string;
  newContent: string | undefined;
}

export interface TransformTypedImportsResult {
  options: TransformTypedImportsOptions;
  log: any[];
  filesParsed: string[];
  filesMatched: string[];
  updates: TransformTypedImportsChangeEntry[];
}

/**
 * Transforms the imports/exports for the current project. Assumes the
 * project has TypeScript files under the /src folder. Will also assume
 * tsconfig.json is in the project root, and will use it if found.
 */
export async function transformTypedImports(
  options: TransformTypedImportsOptions = {}
): Promise<TransformTypedImportsResult> {
  const {
    projectPath = process.cwd(),
    dry = false,
    sourceMatch = "",
    silent = false,
  } = options;
  const result: TransformTypedImportsResult = {
    options,
    log: [],
    filesParsed: [],
    filesMatched: [],
    updates: [],
  };

  const log = (...messages: any[]) => {
    if (!silent) {
      console.log(...messages);
    }

    result.log.push(...messages);
  };

  log("Finding source files...");

  let tsConfigFilePath: string | undefined = path.join(
    projectPath,
    "tsconfig.json"
  );

  if (!fs.existsSync(tsConfigFilePath)) {
    tsConfigFilePath = undefined;
  }

  // initialize
  const project = new Project({
    // Read more: https://ts-morph.com/setup/
    tsConfigFilePath,
    skipAddingFilesFromTsConfig: true,
    compilerOptions: {
      moduleResolution: ModuleResolutionKind.NodeJs,
      jsx: 4,
    },
  });

  // add source files
  project.addSourceFilesAtPaths([
    path.join(projectPath, "src/**/*.ts"),
    path.join(projectPath, "src/**/*.tsx"),
  ]);

  const compiler = project.getLanguageService().compilerObject;
  let filesParsed = project.getSourceFiles();
  let filesMatched = filesParsed.filter((s) => {
    // Remove .d.ts files from files to modify, should they be loaded as
    // sourceFiles by the language service.
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

  // Track parsed/matched in result.
  result.filesParsed =
    filesParsed?.map((s) => path.normalize(s.getFilePath())) || [];
  result.filesMatched =
    filesMatched?.map((s) => path.normalize(s.getFilePath())) || [];

  // If we don't have source files, return.
  if (!filesMatched?.length) {
    log(`No source files matched.`);
    return result;
  }

  log(
    `Processing ${filesMatched.length} file(s)${
      filesParsed.length ? ` (Total parsed: ${filesParsed.length})` : ""
    }...`
  );

  // For each source file...
  for (let source of filesMatched) {
    log(`\nParsing source: "${source.getFilePath()}"\n${divider}`);

    const filePath = source.getFilePath();
    const changeEntry: TransformTypedImportsChangeEntry = {
      path: filePath,
      originalContent: source.getText(),
      newContent: undefined,
    };

    let hasChanged = false;
    const moduleSpecifierToNamedImports: Record<
      string,
      (string | { name: string; alias: string })[]
    > = {};
    const moduleSpecifierToNamedExports: Record<
      string,
      (string | { name: string; alias: string })[]
    > = {};

    // ...Iterate through imports;
    for (let decl of source.getImportDeclarations()) {
      // For each clause within each import...
      for (let clause of decl.getDescendantsOfKind(SyntaxKind.ImportClause)) {
        const isTypeClause = clause.getText().startsWith("type");

        // ...If the clause is not a typed import,
        if (!isTypeClause) {
          const moduleSpecifier =
            decl.getModuleSpecifierValue() || emptyModuleSpecifier;

          // Iterate through the named imports
          for (const importSpecifier of decl.getNamedImports()) {
            const name = importSpecifier.getNameNode().getText();
            const alias = importSpecifier.getAliasNode()?.getText();

            const definitions = compiler.getDefinitionAtPosition(
              filePath,
              importSpecifier.getStart()
            );

            // If the definition is a typed definition,
            if (
              definitions?.find(
                (d) => d.kind === "interface" || d.kind === "type"
              )
            ) {
              // Remove the import and cache it to be re-added as a typed import later on.
              hasChanged = true;
              importSpecifier.remove();

              // If this is the last named import, remove the import declaration.
              if (!decl.getNamedImports()?.length && !decl.getDefaultImport()) {
                decl.remove();
              }

              log(`* Removing import ${name} from ${moduleSpecifier}`);

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

          const moduleSpecifier =
            clause.getExportDeclaration().getModuleSpecifierValue() ||
            emptyModuleSpecifier;

          const definitions = compiler.getDefinitionAtPosition(
            source.getFilePath(),
            clause.getStart()
          );

          const kind = definitions?.find(
            (d) => d.kind === "interface" || d.kind === "type"
          )?.kind;

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
            log(`* Removing export ${name} (${kind}) from ${moduleSpecifier}`);

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
        log(
          `* Adding imports for ${moduleSpecifier}:`,
          moduleSpecifierToNamedImports[moduleSpecifier] as any
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
        log(
          `* Adding exports for ${moduleSpecifier}:`,
          moduleSpecifierToNamedExports[moduleSpecifier]
        );
        const decl: OptionalKind<ExportDeclarationStructure> = {
          isTypeOnly: true,
          namedExports: moduleSpecifierToNamedExports[moduleSpecifier],
        };

        if (moduleSpecifier !== emptyModuleSpecifier) {
          decl.moduleSpecifier = moduleSpecifier;
        }

        source.addExportDeclaration(decl);
      }

      // Update the change entry.
      changeEntry.newContent = source.getText();
      result.updates.push(changeEntry);

      if (dry) {
        log(
          `\nPrinting source file "${source.getFilePath()}":\n${divider}\n${source.getText()}${divider}`
        );
      } else {
        // Save the source.
        log(`\nSaving source file "${source.getFilePath()}"`);
        await source.save();
      }
    }
  }

  return result;
}
