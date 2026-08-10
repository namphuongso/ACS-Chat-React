# Package Publishing Guide

This guide provides step-by-step instructions for versioning, maintaining the changelog, and publishing the `@namphuongtechnologi/acs-chat-react` package.

## Prerequisites

- Ensure you have Node.js and npm installed.
- Ensure you are logged into the correct npm registry (`npm login`).
- Your Git working directory must be clean (all changes committed).

## Step 1: Versioning

We use Semantic Versioning (SemVer). Before publishing, you must bump the package version appropriately.

1. **Determine the release type:**
   - **Patch (`1.0.x`)**: Backward-compatible bug fixes.
   - **Minor (`1.x.0`)**: New, backward-compatible features.
   - **Major (`x.0.0`)**: Breaking changes that require users to update their code.

2. **Run the npm version command:**
   Execute one of the following commands. This will automatically update the `version` in `package.json`, create a Git commit, and generate a new Git tag.
   ```bash
   npm version patch  # e.g., 1.0.0 -> 1.0.1
   # OR
   npm version minor  # e.g., 1.0.0 -> 1.1.0
   # OR
   npm version major  # e.g., 1.0.0 -> 2.0.0
   ```

## Step 2: Changelog Maintenance

It's important to keep a record of what changes in each version.

1. Open `CHANGELOG.md` in the root of the library.
2. Add a new heading for the version you just created, along with the current date. For example:
   ```markdown
   ## [1.1.0] - 2026-08-05
   ```
3. Group your changes under the following sub-headings as applicable:
   - `### Added` - For new features.
   - `### Changed` - For changes in existing functionality.
   - `### Deprecated` - For soon-to-be removed features.
   - `### Removed` - For now removed features.
   - `### Fixed` - For bug fixes.
   - `### Security` - In case of vulnerabilities.
4. Stage and amend your version commit to include these changelog updates (or commit it separately before running `npm version`).

_(Note: If the project adopts an automated tool like `release-it` or `standard-version` in the future, this step can be automated.)_

## Step 3: Build the Library

Before publishing, you must ensure that the latest production build is generated.

```bash
npm run build
```

This command compiles TypeScript and bundles the assets into the `dist/` directory.

## Step 4: Publish to npm

Publish the built package to the npm registry.

1. **Dry Run (Recommended):**
   Verify exactly what files will be packed and published.

   ```bash
   npm publish --dry-run
   ```

   _Check the output to ensure no sensitive files or unnecessary source files are being included._

2. **Publish the Package:**
   ```bash
   npm publish
   ```
   _Note: If `@namphuongtechnologi/acs-chat-react` is a public scoped package, you may need to run `npm publish --access public` for the first publish. If it's a private registry, ensure your `.npmrc` is configured correctly._

## Step 5: Push Commits and Tags

Once the package is successfully published, push your version commit and the new tag to the remote repository.

```bash
git push origin main
git push origin --tags
```

Congratulations! The new version of the library is now published and available for consumption.
