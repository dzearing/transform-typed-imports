#!/usr/bin/env node

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import transformTypedImports, {
  TransformTypedImportsOptions,
} from "./transformTypedImports";

const argv = yargs(hideBin(process.argv))
  .command("* [sourceMatch] [-d]" as any)
  .option("d", {
    alias: "dry",
    default: false,
    type: "boolean",
    describe: "Dry run.",
  })
  .option("s", {
    alias: "silent",
    default: false,
    type: "boolean",
    describe: "Silent mode. Avoids logging to the console.",
  })
  .example(
    "$0 src/**/*.{ts|tsx}",
    "apply transform on all TypeScript files under src folder"
  )
  .help("h")
  .alias("h", "help").argv;

transformTypedImports(argv as TransformTypedImportsOptions);
