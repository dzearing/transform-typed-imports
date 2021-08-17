#!/usr/bin/env node

import yargs from "yargs";
import { hideBin } from "yargs/helpers";
import transformTypedImports from "../transformTypedImports.mjs";

const argv = yargs(hideBin(process.argv))
  .command("* [sourceMatch] [-d]")
  .option("d", {
    alias: "dry",
    default: false,
    type: "boolean",
    describe: "Dry run.",
  })
  .example(
    "$0 src/**/*.{ts|tsx}",
    "apply transform on all TypeScript files under src folder"
  )
  .help("h")
  .alias("h", "help").argv;

await transformTypedImports(argv);
