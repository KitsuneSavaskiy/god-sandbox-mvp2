#!/usr/bin/env node
/**
 * print-contracts.mjs — CLI tool for the Asset Contract Registry.
 *
 * Usage:
 *   node tools/asset-contracts/print-contracts.mjs --list
 *   node tools/asset-contracts/print-contracts.mjs --contract <contractId>
 *   node tools/asset-contracts/print-contracts.mjs --help
 */

import { CONTRACTS, getContract, listContracts } from "./asset-contract-registry.mjs";

function printHelp() {
  console.log(`Asset Contract Registry — CLI

List all known asset contracts or print a specific contract in full JSON.

Usage:
  node tools/asset-contracts/print-contracts.mjs --list
  node tools/asset-contracts/print-contracts.mjs --contract <contractId>
  node tools/asset-contracts/print-contracts.mjs --help

Options:
  --list                   Print a summary table of all registered contracts.
  --contract <contractId>  Print the full JSON for the specified contract.
  --help, -h               Show this help message.

Available contract IDs:
${Object.keys(CONTRACTS).map(id => `  ${id}`).join("\n")}
`);
}

function printList() {
  const contracts = listContracts();
  const colWidths = {
    contractId: Math.max(10, ...contracts.map(c => c.contractId.length)),
    lane: Math.max(4, ...contracts.map(c => c.lane.length)),
    summary: Math.max(7, ...contracts.map(c => c.summary.length)),
  };

  const header =
    "contractId".padEnd(colWidths.contractId) + "  " +
    "lane".padEnd(colWidths.lane) + "  " +
    "summary";
  const separator = "-".repeat(header.length + 10);

  console.log("\nAsset Contract Registry\n");
  console.log(header);
  console.log(separator);

  for (const c of contracts) {
    console.log(
      c.contractId.padEnd(colWidths.contractId) + "  " +
      c.lane.padEnd(colWidths.lane) + "  " +
      c.summary,
    );
  }

  console.log(`\n${contracts.length} contract(s) registered.`);
}

function printContract(contractId) {
  const contract = getContract(contractId);
  console.log(JSON.stringify(contract, null, 2));
}

function main() {
  const argv = process.argv.slice(2);

  if (argv.length === 0 || argv.includes("--help") || argv.includes("-h")) {
    printHelp();
    process.exit(argv.length === 0 ? 1 : 0);
  }

  if (argv.includes("--list")) {
    printList();
    process.exit(0);
  }

  const contractFlagIdx = argv.indexOf("--contract");
  if (contractFlagIdx !== -1) {
    const contractId = argv[contractFlagIdx + 1];
    if (!contractId) {
      console.error("Error: --contract requires a contractId argument.");
      console.error(`Available contract IDs: ${Object.keys(CONTRACTS).join(", ")}`);
      process.exit(1);
    }

    try {
      printContract(contractId);
      process.exit(0);
    } catch (err) {
      console.error(`Error: ${err instanceof Error ? err.message : String(err)}`);
      process.exit(1);
    }
  }

  console.error(`Error: Unknown option(s): ${argv.join(" ")}`);
  console.error("Run with --help for usage information.");
  process.exit(1);
}

main();
