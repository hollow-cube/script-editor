# Contributing

Thanks for your interest in contributing! This document covers the basics you need to know before opening a pull
request.

## Getting Started

See [Development Setup](../.github/DEVELOPMENT_SETUP.md) for instructions on building and running the project locally.

## Before You Contribute

All contributors must sign our Contributor License Agreement.
You'll be automatically prompted by CLA Assistant when you open your first pull request.

## Pull Requests

- Please open an issue or discuss on Discord before opening a PR (even for bug fixes).
  This helps ensure that your contribution is aligned with our goals and avoids duplicate/wasted effort.
- Keep PRs relatively focused on a single change. Smaller PRs are easier to review and more likely to be merged quickly.
- Follow go formatting conventions. Please avoid PRs that only change formatting or style.
- We don't have a set review period, please be patient while we review.

## Preview Deployments

When you open a pull request, a live preview of the editor is built from your branch and deployed automatically.
A bot comment on the PR links it at `https://script-editor-<PR-number>.preview.hollowcube.dev/editor`. The comment updates on
every push, so the preview always reflects your latest commit. The preview talks to the production API. It is
removed automatically when the PR is closed or merged — nothing for you to set up or tear down.

## Communication

For questions, discussion, or if you're unsure whether a change would be welcome, please ask in the`#general-dev`
channel in our [Discord](https://discord.hollowcube.net).
