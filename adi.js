#!/usr/bin/env node

import { createInterface } from 'readline';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';
import { readFile } from 'fs/promises';
import { Command } from 'commander';
import chalk from 'chalk';

import { runFile } from './index.js';
import { installPackage } from './core/packageManager.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const program = new Command();

program
  .name("adi")
  .description("AdiLang CLI")
  .version("1.0.0");

program
  .command("repl")
  .description("Start interactive REPL")
  .action(startRepl);

program
  .command("run <file>")
  .description("Run an .adi file")
  .action(runAdiFile);

program
  .command("compile <file>")
  .description("Compile .adi file to JavaScript")
  .action(async (file) => {
    try {
      const { compileToJS } = await import("./compiler.js");
      const fs = (await import("fs")).default;
      const { tokenize } = await import("./core/lexer.js");
      const { parse } = await import("./core/parser.js");

      const code = fs.readFileSync(file, "utf8");
      const { ast, functions = {} } = parse(tokenize(code));
      const js = compileToJS(ast, functions);
      console.log(js);
    } catch (err) {
      console.error(chalk.red("❌ Compilation Error:"), err.message);
      process.exit(1);
    }
  });

program
  .command("install <package>")
  .description("Install an AdiLang package from GitHub")
  .action(installPackage);

// === REPL Mode ===
async function startRepl() {
  console.log(chalk.green("AdiLang REPL (type 'exit' to quit)"));
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
    prompt: chalk.cyan("> "),
  });

  const { tokenize } = await import("./core/lexer.js");
  const { parse } = await import("./core/parser.js");
  const { interpret } = await import("./core/interpreter.js");

  rl.prompt();
  rl.on("line", async (line) => {
    if (line.trim().toLowerCase() === "exit") {
      rl.close();
      return;
    }

    try {
      const tokens = tokenize(line);
      const { ast } = parse(tokens);
      await interpret(ast);
    } catch (err) {
      console.error(chalk.red("❌"), err.message);
    }

    rl.prompt();
  });

  rl.on("close", () => {
    console.log(chalk.yellow("\nGoodbye!"));
    process.exit(0);
  });
}

// Allow: `adi myfile.adi` to auto-run
if (process.argv.length === 3 && !process.argv[2].startsWith("-")) {
  runAdiFile(process.argv[2]);
} else {
  program.parse(process.argv);
}

// === Run .adi file ===
async function runAdiFile(file) {
  try {
    const filePath = resolve(process.cwd(), file);
    const code = await readFile(filePath, "utf8");
    await runFile(filePath); // file path passed to runFile for consistency
  } catch (err) {
    if (err.code === "ENOENT") {
      console.error(chalk.red(`❌ File not found: ${file}`));
    } else {
      console.error(chalk.red(`❌ Error:`), err.message);
    }
    process.exit(1);
  }
}