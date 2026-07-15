# Deno Desktop Architecture Research

This document tracks research that must be completed before starting the Deno desktop migration tasks in `Tasks.md`. Research findings and the final decision should be appended here; this is not an implementation task.

Conduct all spikes, experiments, downloaded samples, generated test artifacts, and other throwaway research work under `/tmp`. Do not add temporary research code or artifacts to the project workspace.

## Questions to Resolve

- Which maintained Deno-native WebView library can host the Vue renderer on macOS and Windows?
- What native prerequisites and redistribution constraints apply on each target platform?
- Can it load bundled local assets, expose a typed JavaScript/native bridge, restrict navigation, apply a Content Security Policy, propagate bridge failures, and shut down cleanly?
- Does it support the current PrimeVue and Tailwind renderer without behavioral regressions?
- Which Deno-compatible SQLite driver and packaging approach fit the selected host?
- Can Linux reuse the same implementation without a separate engineering path?

## Required Spike

- Open the compiled Vue renderer in a native window on macOS.
- Complete one typed request/response through the bridge.
- Record asset-loading, security, error-propagation, and lifecycle behavior.
- Record Windows prerequisites and a reproducible manual verification procedure for the project owner.
- Remove throwaway spike code after documenting the result.

## CEF Fallback Criteria

Use Deno + CEF for the production shell only if the native WebView cannot satisfy a documented blocking requirement. The test-only CEF backend required for Playwright MCP automation does not, by itself, trigger this production fallback.

## Findings

To be completed during research.

## Decision

To be completed after the spike and manual Windows verification.
