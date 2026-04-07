# SolFoundry: Technical Specifications (Session 2026-04-06)

## 🏗️ Core Architecture
- **Framework**: Anchor 0.30.1
- **Solana CLI**: 1.18.26
- **Node.js**: 20.x
- **Rust Toolchain**: `stable` (1.83.0+) — **MANDATORY** for `edition2024` dependencies (`toml_edit v0.25`).

## ⚙️ Configuration Standards (Anchor.toml)
- **Localnet Validators**: Must use `[test.validator]` without duplicating the `validator` key.
- **Program IDs**:
  - `bounty_registry`: `DwCJkFvRD7NJqzUnPo1njptVScDJsMS6ezZPNXxRrQxe`
  - `fndry_staking`: `Wkvaa5DdWWN1GWAa4UX26CJzGuU5otXF7obLL27TFET`

## 📦 Dependency Manifest (Cargo.toml)
- **Anchor 0.30+ Requirements**:
  ```toml
  [features]
  idl-build = ["anchor-lang/idl-build", "anchor-spl/idl-build"]
  ```
- All programs must include the `idl-build` feature for CI IDL generation.

## 🧠 Memory Management (Solana Limits)
- **Stack Limit**: 4096 bytes.
- **Optimization Strategy**: Use `Box<Account<'info, T>>` (Boxing) for all instruction contexts with >5 accounts or large state structures (e.g., `StakingConfig`).

---
⚔️ *STARK Protocol: Knowledge serialized for physical persistence.*
