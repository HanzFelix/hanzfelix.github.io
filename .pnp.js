#!/usr/bin/env node

/* eslint-disable max-len, flowtype/require-valid-file-annotation, flowtype/require-return-type */
/* global packageInformationStores, null, $$SETUP_STATIC_TABLES */

// Used for the resolveUnqualified part of the resolution (ie resolving folder/index.js & file extensions)
// Deconstructed so that they aren't affected by any fs monkeypatching occuring later during the execution
const {statSync, lstatSync, readlinkSync, readFileSync, existsSync, realpathSync} = require('fs');

const Module = require('module');
const path = require('path');
const StringDecoder = require('string_decoder');

const ignorePattern = null ? new RegExp(null) : null;

const pnpFile = path.resolve(__dirname, __filename);
const builtinModules = new Set(Module.builtinModules || Object.keys(process.binding('natives')));

const topLevelLocator = {name: null, reference: null};
const blacklistedLocator = {name: NaN, reference: NaN};

// Used for compatibility purposes - cf setupCompatibilityLayer
const patchedModules = [];
const fallbackLocators = [topLevelLocator];

// Matches backslashes of Windows paths
const backwardSlashRegExp = /\\/g;

// Matches if the path must point to a directory (ie ends with /)
const isDirRegExp = /\/$/;

// Matches if the path starts with a valid path qualifier (./, ../, /)
// eslint-disable-next-line no-unused-vars
const isStrictRegExp = /^\.{0,2}\//;

// Splits a require request into its components, or return null if the request is a file path
const pathRegExp = /^(?![a-zA-Z]:[\\\/]|\\\\|\.{0,2}(?:\/|$))((?:@[^\/]+\/)?[^\/]+)\/?(.*|)$/;

// Keep a reference around ("module" is a common name in this context, so better rename it to something more significant)
const pnpModule = module;

/**
 * Used to disable the resolution hooks (for when we want to fallback to the previous resolution - we then need
 * a way to "reset" the environment temporarily)
 */

let enableNativeHooks = true;

/**
 * Simple helper function that assign an error code to an error, so that it can more easily be caught and used
 * by third-parties.
 */

function makeError(code, message, data = {}) {
  const error = new Error(message);
  return Object.assign(error, {code, data});
}

/**
 * Ensures that the returned locator isn't a blacklisted one.
 *
 * Blacklisted packages are packages that cannot be used because their dependencies cannot be deduced. This only
 * happens with peer dependencies, which effectively have different sets of dependencies depending on their parents.
 *
 * In order to deambiguate those different sets of dependencies, the Yarn implementation of PnP will generate a
 * symlink for each combination of <package name>/<package version>/<dependent package> it will find, and will
 * blacklist the target of those symlinks. By doing this, we ensure that files loaded through a specific path
 * will always have the same set of dependencies, provided the symlinks are correctly preserved.
 *
 * Unfortunately, some tools do not preserve them, and when it happens PnP isn't able anymore to deduce the set of
 * dependencies based on the path of the file that makes the require calls. But since we've blacklisted those paths,
 * we're able to print a more helpful error message that points out that a third-party package is doing something
 * incompatible!
 */

// eslint-disable-next-line no-unused-vars
function blacklistCheck(locator) {
  if (locator === blacklistedLocator) {
    throw makeError(
      `BLACKLISTED`,
      [
        `A package has been resolved through a blacklisted path - this is usually caused by one of your tools calling`,
        `"realpath" on the return value of "require.resolve". Since the returned values use symlinks to disambiguate`,
        `peer dependencies, they must be passed untransformed to "require".`,
      ].join(` `)
    );
  }

  return locator;
}

let packageInformationStores = new Map([
  ["@fontsource/fira-mono", new Map([
    ["4.5.10", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-@fontsource-fira-mono-4.5.10-443be4b2b4fc6e685b88431fcfdaf8d5f5639bbf-integrity/node_modules/@fontsource/fira-mono/"),
      packageDependencies: new Map([
        ["@fontsource/fira-mono", "4.5.10"],
      ]),
    }],
  ])],
  ["@neoconfetti/svelte", new Map([
    ["1.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-@neoconfetti-svelte-1.0.0-84a7f98981ad546d959d8c99460da8cebdf70301-integrity/node_modules/@neoconfetti/svelte/"),
      packageDependencies: new Map([
        ["@neoconfetti/svelte", "1.0.0"],
      ]),
    }],
  ])],
  ["@sveltejs/adapter-auto", new Map([
    ["3.3.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-@sveltejs-adapter-auto-3.3.1-57a3d9c402bea468f0899755758551e7e74deaae-integrity/node_modules/@sveltejs/adapter-auto/"),
      packageDependencies: new Map([
        ["@sveltejs/kit", "2.17.2"],
        ["import-meta-resolve", "4.1.0"],
        ["@sveltejs/adapter-auto", "3.3.1"],
      ]),
    }],
  ])],
  ["import-meta-resolve", new Map([
    ["4.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-import-meta-resolve-4.1.0-f9db8bead9fafa61adb811db77a2bf22c5399706-integrity/node_modules/import-meta-resolve/"),
      packageDependencies: new Map([
        ["import-meta-resolve", "4.1.0"],
      ]),
    }],
  ])],
  ["@sveltejs/adapter-static", new Map([
    ["3.0.8", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-@sveltejs-adapter-static-3.0.8-f23ee99a9678dbaec58b79d183bc3defbfe99f1a-integrity/node_modules/@sveltejs/adapter-static/"),
      packageDependencies: new Map([
        ["@sveltejs/kit", "2.17.2"],
        ["@sveltejs/adapter-static", "3.0.8"],
      ]),
    }],
  ])],
  ["@sveltejs/kit", new Map([
    ["2.17.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-@sveltejs-kit-2.17.2-87c6a1efe42a3f06dd0558e49b79988fec4338bd-integrity/node_modules/@sveltejs/kit/"),
      packageDependencies: new Map([
        ["@sveltejs/vite-plugin-svelte", "4.0.4"],
        ["svelte", "5.20.2"],
        ["vite", "5.4.14"],
        ["@types/cookie", "0.6.0"],
        ["cookie", "0.6.0"],
        ["devalue", "5.1.1"],
        ["esm-env", "1.2.2"],
        ["import-meta-resolve", "4.1.0"],
        ["kleur", "4.1.5"],
        ["magic-string", "0.30.17"],
        ["mrmime", "2.0.1"],
        ["sade", "1.8.1"],
        ["set-cookie-parser", "2.7.1"],
        ["sirv", "3.0.1"],
        ["@sveltejs/kit", "2.17.2"],
      ]),
    }],
  ])],
  ["@types/cookie", new Map([
    ["0.6.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-@types-cookie-0.6.0-eac397f28bf1d6ae0ae081363eca2f425bedf0d5-integrity/node_modules/@types/cookie/"),
      packageDependencies: new Map([
        ["@types/cookie", "0.6.0"],
      ]),
    }],
  ])],
  ["cookie", new Map([
    ["0.6.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-cookie-0.6.0-2798b04b071b0ecbff0dbb62a505a8efa4e19051-integrity/node_modules/cookie/"),
      packageDependencies: new Map([
        ["cookie", "0.6.0"],
      ]),
    }],
  ])],
  ["devalue", new Map([
    ["5.1.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-devalue-5.1.1-a71887ac0f354652851752654e4bd435a53891ae-integrity/node_modules/devalue/"),
      packageDependencies: new Map([
        ["devalue", "5.1.1"],
      ]),
    }],
  ])],
  ["esm-env", new Map([
    ["1.2.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-esm-env-1.2.2-263c9455c55861f41618df31b20cb571fc20b75e-integrity/node_modules/esm-env/"),
      packageDependencies: new Map([
        ["esm-env", "1.2.2"],
      ]),
    }],
  ])],
  ["kleur", new Map([
    ["4.1.5", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-kleur-4.1.5-95106101795f7050c6c650f350c683febddb1780-integrity/node_modules/kleur/"),
      packageDependencies: new Map([
        ["kleur", "4.1.5"],
      ]),
    }],
  ])],
  ["magic-string", new Map([
    ["0.30.17", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-magic-string-0.30.17-450a449673d2460e5bbcfba9a61916a1714c7453-integrity/node_modules/magic-string/"),
      packageDependencies: new Map([
        ["@jridgewell/sourcemap-codec", "1.5.0"],
        ["magic-string", "0.30.17"],
      ]),
    }],
  ])],
  ["@jridgewell/sourcemap-codec", new Map([
    ["1.5.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-@jridgewell-sourcemap-codec-1.5.0-3188bcb273a414b0d215fd22a58540b989b9409a-integrity/node_modules/@jridgewell/sourcemap-codec/"),
      packageDependencies: new Map([
        ["@jridgewell/sourcemap-codec", "1.5.0"],
      ]),
    }],
  ])],
  ["mrmime", new Map([
    ["2.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-mrmime-2.0.1-bc3e87f7987853a54c9850eeb1f1078cd44adddc-integrity/node_modules/mrmime/"),
      packageDependencies: new Map([
        ["mrmime", "2.0.1"],
      ]),
    }],
  ])],
  ["sade", new Map([
    ["1.8.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-sade-1.8.1-0a78e81d658d394887be57d2a409bf703a3b2701-integrity/node_modules/sade/"),
      packageDependencies: new Map([
        ["mri", "1.2.0"],
        ["sade", "1.8.1"],
      ]),
    }],
  ])],
  ["mri", new Map([
    ["1.2.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-mri-1.2.0-6721480fec2a11a4889861115a48b6cbe7cc8f0b-integrity/node_modules/mri/"),
      packageDependencies: new Map([
        ["mri", "1.2.0"],
      ]),
    }],
  ])],
  ["set-cookie-parser", new Map([
    ["2.7.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-set-cookie-parser-2.7.1-3016f150072202dfbe90fadee053573cc89d2943-integrity/node_modules/set-cookie-parser/"),
      packageDependencies: new Map([
        ["set-cookie-parser", "2.7.1"],
      ]),
    }],
  ])],
  ["sirv", new Map([
    ["3.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-sirv-3.0.1-32a844794655b727f9e2867b777e0060fbe07bf3-integrity/node_modules/sirv/"),
      packageDependencies: new Map([
        ["@polka/url", "1.0.0-next.28"],
        ["mrmime", "2.0.1"],
        ["totalist", "3.0.1"],
        ["sirv", "3.0.1"],
      ]),
    }],
  ])],
  ["@polka/url", new Map([
    ["1.0.0-next.28", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-@polka-url-1.0.0-next.28-d45e01c4a56f143ee69c54dd6b12eade9e270a73-integrity/node_modules/@polka/url/"),
      packageDependencies: new Map([
        ["@polka/url", "1.0.0-next.28"],
      ]),
    }],
  ])],
  ["totalist", new Map([
    ["3.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-totalist-3.0.1-ba3a3d600c915b1a97872348f79c127475f6acf8-integrity/node_modules/totalist/"),
      packageDependencies: new Map([
        ["totalist", "3.0.1"],
      ]),
    }],
  ])],
  ["@sveltejs/vite-plugin-svelte", new Map([
    ["4.0.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-@sveltejs-vite-plugin-svelte-4.0.4-79dfc00377f5456f4c3d95f56817d6486cc0df6c-integrity/node_modules/@sveltejs/vite-plugin-svelte/"),
      packageDependencies: new Map([
        ["svelte", "5.20.2"],
        ["vite", "5.4.14"],
        ["@sveltejs/vite-plugin-svelte-inspector", "3.0.1"],
        ["debug", "4.4.0"],
        ["deepmerge", "4.3.1"],
        ["kleur", "4.1.5"],
        ["magic-string", "0.30.17"],
        ["vitefu", "1.0.5"],
        ["@sveltejs/vite-plugin-svelte", "4.0.4"],
      ]),
    }],
  ])],
  ["@sveltejs/vite-plugin-svelte-inspector", new Map([
    ["3.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-@sveltejs-vite-plugin-svelte-inspector-3.0.1-006bcab6ea90e09c65459133d4e3eaa6b1e83e28-integrity/node_modules/@sveltejs/vite-plugin-svelte-inspector/"),
      packageDependencies: new Map([
        ["svelte", "5.20.2"],
        ["vite", "5.4.14"],
        ["debug", "4.4.0"],
        ["@sveltejs/vite-plugin-svelte-inspector", "3.0.1"],
      ]),
    }],
  ])],
  ["debug", new Map([
    ["4.4.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-debug-4.4.0-2b3f2aea2ffeb776477460267377dc8710faba8a-integrity/node_modules/debug/"),
      packageDependencies: new Map([
        ["ms", "2.1.3"],
        ["debug", "4.4.0"],
      ]),
    }],
  ])],
  ["ms", new Map([
    ["2.1.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-ms-2.1.3-574c8138ce1d2b5861f0b44579dbadd60c6615b2-integrity/node_modules/ms/"),
      packageDependencies: new Map([
        ["ms", "2.1.3"],
      ]),
    }],
  ])],
  ["deepmerge", new Map([
    ["4.3.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-deepmerge-4.3.1-44b5f2147cd3b00d4b56137685966f26fd25dd4a-integrity/node_modules/deepmerge/"),
      packageDependencies: new Map([
        ["deepmerge", "4.3.1"],
      ]),
    }],
  ])],
  ["vitefu", new Map([
    ["1.0.5", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-vitefu-1.0.5-eab501e07da167bbb68e957685823e6b425e7ce2-integrity/node_modules/vitefu/"),
      packageDependencies: new Map([
        ["vite", "5.4.14"],
        ["vitefu", "1.0.5"],
      ]),
    }],
  ])],
  ["@tailwindcss/postcss", new Map([
    ["4.0.7", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-@tailwindcss-postcss-4.0.7-b8bc02b5e23248ac7cbac1970ed807850e03261c-integrity/node_modules/@tailwindcss/postcss/"),
      packageDependencies: new Map([
        ["@alloc/quick-lru", "5.2.0"],
        ["@tailwindcss/node", "4.0.7"],
        ["@tailwindcss/oxide", "4.0.7"],
        ["lightningcss", "1.29.1"],
        ["postcss", "8.5.2"],
        ["tailwindcss", "4.0.7"],
        ["@tailwindcss/postcss", "4.0.7"],
      ]),
    }],
  ])],
  ["@alloc/quick-lru", new Map([
    ["5.2.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-@alloc-quick-lru-5.2.0-7bf68b20c0a350f936915fcae06f58e32007ce30-integrity/node_modules/@alloc/quick-lru/"),
      packageDependencies: new Map([
        ["@alloc/quick-lru", "5.2.0"],
      ]),
    }],
  ])],
  ["@tailwindcss/node", new Map([
    ["4.0.7", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-@tailwindcss-node-4.0.7-11211457bbe83ff3656c74bf0276e27e9ce87410-integrity/node_modules/@tailwindcss/node/"),
      packageDependencies: new Map([
        ["enhanced-resolve", "5.18.1"],
        ["jiti", "2.4.2"],
        ["tailwindcss", "4.0.7"],
        ["@tailwindcss/node", "4.0.7"],
      ]),
    }],
  ])],
  ["enhanced-resolve", new Map([
    ["5.18.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-enhanced-resolve-5.18.1-728ab082f8b7b6836de51f1637aab5d3b9568faf-integrity/node_modules/enhanced-resolve/"),
      packageDependencies: new Map([
        ["graceful-fs", "4.2.11"],
        ["tapable", "2.2.1"],
        ["enhanced-resolve", "5.18.1"],
      ]),
    }],
  ])],
  ["graceful-fs", new Map([
    ["4.2.11", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-graceful-fs-4.2.11-4183e4e8bf08bb6e05bbb2f7d2e0c8f712ca40e3-integrity/node_modules/graceful-fs/"),
      packageDependencies: new Map([
        ["graceful-fs", "4.2.11"],
      ]),
    }],
  ])],
  ["tapable", new Map([
    ["2.2.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-tapable-2.2.1-1967a73ef4060a82f12ab96af86d52fdb76eeca0-integrity/node_modules/tapable/"),
      packageDependencies: new Map([
        ["tapable", "2.2.1"],
      ]),
    }],
  ])],
  ["jiti", new Map([
    ["2.4.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-jiti-2.4.2-d19b7732ebb6116b06e2038da74a55366faef560-integrity/node_modules/jiti/"),
      packageDependencies: new Map([
        ["jiti", "2.4.2"],
      ]),
    }],
  ])],
  ["tailwindcss", new Map([
    ["4.0.7", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-tailwindcss-4.0.7-b3e26a5dda77651808a873f1b535cc8c39fcb0ae-integrity/node_modules/tailwindcss/"),
      packageDependencies: new Map([
        ["tailwindcss", "4.0.7"],
      ]),
    }],
  ])],
  ["@tailwindcss/oxide", new Map([
    ["4.0.7", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-@tailwindcss-oxide-4.0.7-b53573fc01b8b61af195ad36957d05c78278761d-integrity/node_modules/@tailwindcss/oxide/"),
      packageDependencies: new Map([
        ["@tailwindcss/oxide-win32-x64-msvc", "4.0.7"],
        ["@tailwindcss/oxide", "4.0.7"],
      ]),
    }],
  ])],
  ["@tailwindcss/oxide-win32-x64-msvc", new Map([
    ["4.0.7", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-@tailwindcss-oxide-win32-x64-msvc-4.0.7-500cf333326a45078ca5b0fd68b56b1f0b434bfa-integrity/node_modules/@tailwindcss/oxide-win32-x64-msvc/"),
      packageDependencies: new Map([
        ["@tailwindcss/oxide-win32-x64-msvc", "4.0.7"],
      ]),
    }],
  ])],
  ["lightningcss", new Map([
    ["1.29.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-lightningcss-1.29.1-1d4d62332fc5ba4b6c28e04a8c5638c76019702b-integrity/node_modules/lightningcss/"),
      packageDependencies: new Map([
        ["detect-libc", "1.0.3"],
        ["lightningcss-win32-x64-msvc", "1.29.1"],
        ["lightningcss", "1.29.1"],
      ]),
    }],
  ])],
  ["detect-libc", new Map([
    ["1.0.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-detect-libc-1.0.3-fa137c4bd698edf55cd5cd02ac559f91a4c4ba9b-integrity/node_modules/detect-libc/"),
      packageDependencies: new Map([
        ["detect-libc", "1.0.3"],
      ]),
    }],
  ])],
  ["lightningcss-win32-x64-msvc", new Map([
    ["1.29.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-lightningcss-win32-x64-msvc-1.29.1-54dcd52884f6cbf205a53d49239559603f194927-integrity/node_modules/lightningcss-win32-x64-msvc/"),
      packageDependencies: new Map([
        ["lightningcss-win32-x64-msvc", "1.29.1"],
      ]),
    }],
  ])],
  ["postcss", new Map([
    ["8.5.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-postcss-8.5.2-e7b99cb9d2ec3e8dd424002e7c16517cb2b846bd-integrity/node_modules/postcss/"),
      packageDependencies: new Map([
        ["nanoid", "3.3.8"],
        ["picocolors", "1.1.1"],
        ["source-map-js", "1.2.1"],
        ["postcss", "8.5.2"],
      ]),
    }],
  ])],
  ["nanoid", new Map([
    ["3.3.8", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-nanoid-3.3.8-b1be3030bee36aaff18bacb375e5cce521684baf-integrity/node_modules/nanoid/"),
      packageDependencies: new Map([
        ["nanoid", "3.3.8"],
      ]),
    }],
  ])],
  ["picocolors", new Map([
    ["1.1.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-picocolors-1.1.1-3d321af3eab939b083c8f929a1d12cda81c26b6b-integrity/node_modules/picocolors/"),
      packageDependencies: new Map([
        ["picocolors", "1.1.1"],
      ]),
    }],
  ])],
  ["source-map-js", new Map([
    ["1.2.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-source-map-js-1.2.1-1ce5650fddd87abc099eda37dcff024c2667ae46-integrity/node_modules/source-map-js/"),
      packageDependencies: new Map([
        ["source-map-js", "1.2.1"],
      ]),
    }],
  ])],
  ["@types/eslint", new Map([
    ["8.56.12", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-@types-eslint-8.56.12-1657c814ffeba4d2f84c0d4ba0f44ca7ea1ca53a-integrity/node_modules/@types/eslint/"),
      packageDependencies: new Map([
        ["@types/estree", "1.0.6"],
        ["@types/json-schema", "7.0.15"],
        ["@types/eslint", "8.56.12"],
      ]),
    }],
  ])],
  ["@types/estree", new Map([
    ["1.0.6", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-@types-estree-1.0.6-628effeeae2064a1b4e79f78e81d87b7e5fc7b50-integrity/node_modules/@types/estree/"),
      packageDependencies: new Map([
        ["@types/estree", "1.0.6"],
      ]),
    }],
  ])],
  ["@types/json-schema", new Map([
    ["7.0.15", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-@types-json-schema-7.0.15-596a1747233694d50f6ad8a7869fcb6f56cf5841-integrity/node_modules/@types/json-schema/"),
      packageDependencies: new Map([
        ["@types/json-schema", "7.0.15"],
      ]),
    }],
  ])],
  ["eslint", new Map([
    ["8.57.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-eslint-8.57.1-7df109654aba7e3bbe5c8eae533c5e461d3c6ca9-integrity/node_modules/eslint/"),
      packageDependencies: new Map([
        ["@eslint-community/eslint-utils", "pnp:68e36f0d07f687f05cda6dd611e55c893648db63"],
        ["@eslint-community/regexpp", "4.12.1"],
        ["@eslint/eslintrc", "2.1.4"],
        ["@eslint/js", "8.57.1"],
        ["@humanwhocodes/config-array", "0.13.0"],
        ["@humanwhocodes/module-importer", "1.0.1"],
        ["@nodelib/fs.walk", "1.2.8"],
        ["@ungap/structured-clone", "1.3.0"],
        ["ajv", "6.12.6"],
        ["chalk", "4.1.2"],
        ["cross-spawn", "7.0.6"],
        ["debug", "4.4.0"],
        ["doctrine", "3.0.0"],
        ["escape-string-regexp", "4.0.0"],
        ["eslint-scope", "7.2.2"],
        ["eslint-visitor-keys", "3.4.3"],
        ["espree", "9.6.1"],
        ["esquery", "1.6.0"],
        ["esutils", "2.0.3"],
        ["fast-deep-equal", "3.1.3"],
        ["file-entry-cache", "6.0.1"],
        ["find-up", "5.0.0"],
        ["glob-parent", "6.0.2"],
        ["globals", "13.24.0"],
        ["graphemer", "1.4.0"],
        ["ignore", "5.3.2"],
        ["imurmurhash", "0.1.4"],
        ["is-glob", "4.0.3"],
        ["is-path-inside", "3.0.3"],
        ["js-yaml", "4.1.0"],
        ["json-stable-stringify-without-jsonify", "1.0.1"],
        ["levn", "0.4.1"],
        ["lodash.merge", "4.6.2"],
        ["minimatch", "3.1.2"],
        ["natural-compare", "1.4.0"],
        ["optionator", "0.9.4"],
        ["strip-ansi", "6.0.1"],
        ["text-table", "0.2.0"],
        ["eslint", "8.57.1"],
      ]),
    }],
  ])],
  ["@eslint-community/eslint-utils", new Map([
    ["pnp:68e36f0d07f687f05cda6dd611e55c893648db63", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-68e36f0d07f687f05cda6dd611e55c893648db63/node_modules/@eslint-community/eslint-utils/"),
      packageDependencies: new Map([
        ["eslint-visitor-keys", "3.4.3"],
        ["@eslint-community/eslint-utils", "pnp:68e36f0d07f687f05cda6dd611e55c893648db63"],
      ]),
    }],
    ["pnp:95db2819e12c07d08cf0abbd48fe339ae94dec45", {
      packageLocation: path.resolve(__dirname, "./.pnp/externals/pnp-95db2819e12c07d08cf0abbd48fe339ae94dec45/node_modules/@eslint-community/eslint-utils/"),
      packageDependencies: new Map([
        ["eslint", "8.57.1"],
        ["eslint-visitor-keys", "3.4.3"],
        ["@eslint-community/eslint-utils", "pnp:95db2819e12c07d08cf0abbd48fe339ae94dec45"],
      ]),
    }],
  ])],
  ["eslint-visitor-keys", new Map([
    ["3.4.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-eslint-visitor-keys-3.4.3-0cd72fe8550e3c2eae156a96a4dddcd1c8ac5800-integrity/node_modules/eslint-visitor-keys/"),
      packageDependencies: new Map([
        ["eslint-visitor-keys", "3.4.3"],
      ]),
    }],
  ])],
  ["@eslint-community/regexpp", new Map([
    ["4.12.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-@eslint-community-regexpp-4.12.1-cfc6cffe39df390a3841cde2abccf92eaa7ae0e0-integrity/node_modules/@eslint-community/regexpp/"),
      packageDependencies: new Map([
        ["@eslint-community/regexpp", "4.12.1"],
      ]),
    }],
  ])],
  ["@eslint/eslintrc", new Map([
    ["2.1.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-@eslint-eslintrc-2.1.4-388a269f0f25c1b6adc317b5a2c55714894c70ad-integrity/node_modules/@eslint/eslintrc/"),
      packageDependencies: new Map([
        ["ajv", "6.12.6"],
        ["debug", "4.4.0"],
        ["espree", "9.6.1"],
        ["globals", "13.24.0"],
        ["ignore", "5.3.2"],
        ["import-fresh", "3.3.1"],
        ["js-yaml", "4.1.0"],
        ["minimatch", "3.1.2"],
        ["strip-json-comments", "3.1.1"],
        ["@eslint/eslintrc", "2.1.4"],
      ]),
    }],
  ])],
  ["ajv", new Map([
    ["6.12.6", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-ajv-6.12.6-baf5a62e802b07d977034586f8c3baf5adf26df4-integrity/node_modules/ajv/"),
      packageDependencies: new Map([
        ["fast-deep-equal", "3.1.3"],
        ["fast-json-stable-stringify", "2.1.0"],
        ["json-schema-traverse", "0.4.1"],
        ["uri-js", "4.4.1"],
        ["ajv", "6.12.6"],
      ]),
    }],
  ])],
  ["fast-deep-equal", new Map([
    ["3.1.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-fast-deep-equal-3.1.3-3a7d56b559d6cbc3eb512325244e619a65c6c525-integrity/node_modules/fast-deep-equal/"),
      packageDependencies: new Map([
        ["fast-deep-equal", "3.1.3"],
      ]),
    }],
  ])],
  ["fast-json-stable-stringify", new Map([
    ["2.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-fast-json-stable-stringify-2.1.0-874bf69c6f404c2b5d99c481341399fd55892633-integrity/node_modules/fast-json-stable-stringify/"),
      packageDependencies: new Map([
        ["fast-json-stable-stringify", "2.1.0"],
      ]),
    }],
  ])],
  ["json-schema-traverse", new Map([
    ["0.4.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-json-schema-traverse-0.4.1-69f6a87d9513ab8bb8fe63bdb0979c448e684660-integrity/node_modules/json-schema-traverse/"),
      packageDependencies: new Map([
        ["json-schema-traverse", "0.4.1"],
      ]),
    }],
  ])],
  ["uri-js", new Map([
    ["4.4.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-uri-js-4.4.1-9b1a52595225859e55f669d928f88c6c57f2a77e-integrity/node_modules/uri-js/"),
      packageDependencies: new Map([
        ["punycode", "2.3.1"],
        ["uri-js", "4.4.1"],
      ]),
    }],
  ])],
  ["punycode", new Map([
    ["2.3.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-punycode-2.3.1-027422e2faec0b25e1549c3e1bd8309b9133b6e5-integrity/node_modules/punycode/"),
      packageDependencies: new Map([
        ["punycode", "2.3.1"],
      ]),
    }],
  ])],
  ["espree", new Map([
    ["9.6.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-espree-9.6.1-a2a17b8e434690a5432f2f8018ce71d331a48c6f-integrity/node_modules/espree/"),
      packageDependencies: new Map([
        ["acorn", "8.14.0"],
        ["acorn-jsx", "5.3.2"],
        ["eslint-visitor-keys", "3.4.3"],
        ["espree", "9.6.1"],
      ]),
    }],
  ])],
  ["acorn", new Map([
    ["8.14.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-acorn-8.14.0-063e2c70cac5fb4f6467f0b11152e04c682795b0-integrity/node_modules/acorn/"),
      packageDependencies: new Map([
        ["acorn", "8.14.0"],
      ]),
    }],
  ])],
  ["acorn-jsx", new Map([
    ["5.3.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-acorn-jsx-5.3.2-7ed5bb55908b3b2f1bc55c6af1653bada7f07937-integrity/node_modules/acorn-jsx/"),
      packageDependencies: new Map([
        ["acorn", "8.14.0"],
        ["acorn-jsx", "5.3.2"],
      ]),
    }],
  ])],
  ["globals", new Map([
    ["13.24.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-globals-13.24.0-8432a19d78ce0c1e833949c36adb345400bb1171-integrity/node_modules/globals/"),
      packageDependencies: new Map([
        ["type-fest", "0.20.2"],
        ["globals", "13.24.0"],
      ]),
    }],
  ])],
  ["type-fest", new Map([
    ["0.20.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-type-fest-0.20.2-1bf207f4b28f91583666cb5fbd327887301cd5f4-integrity/node_modules/type-fest/"),
      packageDependencies: new Map([
        ["type-fest", "0.20.2"],
      ]),
    }],
  ])],
  ["ignore", new Map([
    ["5.3.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-ignore-5.3.2-3cd40e729f3643fd87cb04e50bf0eb722bc596f5-integrity/node_modules/ignore/"),
      packageDependencies: new Map([
        ["ignore", "5.3.2"],
      ]),
    }],
  ])],
  ["import-fresh", new Map([
    ["3.3.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-import-fresh-3.3.1-9cecb56503c0ada1f2741dbbd6546e4b13b57ccf-integrity/node_modules/import-fresh/"),
      packageDependencies: new Map([
        ["parent-module", "1.0.1"],
        ["resolve-from", "4.0.0"],
        ["import-fresh", "3.3.1"],
      ]),
    }],
  ])],
  ["parent-module", new Map([
    ["1.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-parent-module-1.0.1-691d2709e78c79fae3a156622452d00762caaaa2-integrity/node_modules/parent-module/"),
      packageDependencies: new Map([
        ["callsites", "3.1.0"],
        ["parent-module", "1.0.1"],
      ]),
    }],
  ])],
  ["callsites", new Map([
    ["3.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-callsites-3.1.0-b3630abd8943432f54b3f0519238e33cd7df2f73-integrity/node_modules/callsites/"),
      packageDependencies: new Map([
        ["callsites", "3.1.0"],
      ]),
    }],
  ])],
  ["resolve-from", new Map([
    ["4.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-resolve-from-4.0.0-4abcd852ad32dd7baabfe9b40e00a36db5f392e6-integrity/node_modules/resolve-from/"),
      packageDependencies: new Map([
        ["resolve-from", "4.0.0"],
      ]),
    }],
  ])],
  ["js-yaml", new Map([
    ["4.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-js-yaml-4.1.0-c1fb65f8f5017901cdd2c951864ba18458a10602-integrity/node_modules/js-yaml/"),
      packageDependencies: new Map([
        ["argparse", "2.0.1"],
        ["js-yaml", "4.1.0"],
      ]),
    }],
  ])],
  ["argparse", new Map([
    ["2.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-argparse-2.0.1-246f50f3ca78a3240f6c997e8a9bd1eac49e4b38-integrity/node_modules/argparse/"),
      packageDependencies: new Map([
        ["argparse", "2.0.1"],
      ]),
    }],
  ])],
  ["minimatch", new Map([
    ["3.1.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-minimatch-3.1.2-19cd194bfd3e428f049a70817c038d89ab4be35b-integrity/node_modules/minimatch/"),
      packageDependencies: new Map([
        ["brace-expansion", "1.1.11"],
        ["minimatch", "3.1.2"],
      ]),
    }],
  ])],
  ["brace-expansion", new Map([
    ["1.1.11", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-brace-expansion-1.1.11-3c7fcbf529d87226f3d2f52b966ff5271eb441dd-integrity/node_modules/brace-expansion/"),
      packageDependencies: new Map([
        ["balanced-match", "1.0.2"],
        ["concat-map", "0.0.1"],
        ["brace-expansion", "1.1.11"],
      ]),
    }],
  ])],
  ["balanced-match", new Map([
    ["1.0.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-balanced-match-1.0.2-e83e3a7e3f300b34cb9d87f615fa0cbf357690ee-integrity/node_modules/balanced-match/"),
      packageDependencies: new Map([
        ["balanced-match", "1.0.2"],
      ]),
    }],
  ])],
  ["concat-map", new Map([
    ["0.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-concat-map-0.0.1-d8a96bd77fd68df7793a73036a3ba0d5405d477b-integrity/node_modules/concat-map/"),
      packageDependencies: new Map([
        ["concat-map", "0.0.1"],
      ]),
    }],
  ])],
  ["strip-json-comments", new Map([
    ["3.1.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-strip-json-comments-3.1.1-31f1281b3832630434831c310c01cccda8cbe006-integrity/node_modules/strip-json-comments/"),
      packageDependencies: new Map([
        ["strip-json-comments", "3.1.1"],
      ]),
    }],
  ])],
  ["@eslint/js", new Map([
    ["8.57.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-@eslint-js-8.57.1-de633db3ec2ef6a3c89e2f19038063e8a122e2c2-integrity/node_modules/@eslint/js/"),
      packageDependencies: new Map([
        ["@eslint/js", "8.57.1"],
      ]),
    }],
  ])],
  ["@humanwhocodes/config-array", new Map([
    ["0.13.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-@humanwhocodes-config-array-0.13.0-fb907624df3256d04b9aa2df50d7aa97ec648748-integrity/node_modules/@humanwhocodes/config-array/"),
      packageDependencies: new Map([
        ["@humanwhocodes/object-schema", "2.0.3"],
        ["debug", "4.4.0"],
        ["minimatch", "3.1.2"],
        ["@humanwhocodes/config-array", "0.13.0"],
      ]),
    }],
  ])],
  ["@humanwhocodes/object-schema", new Map([
    ["2.0.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-@humanwhocodes-object-schema-2.0.3-4a2868d75d6d6963e423bcf90b7fd1be343409d3-integrity/node_modules/@humanwhocodes/object-schema/"),
      packageDependencies: new Map([
        ["@humanwhocodes/object-schema", "2.0.3"],
      ]),
    }],
  ])],
  ["@humanwhocodes/module-importer", new Map([
    ["1.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-@humanwhocodes-module-importer-1.0.1-af5b2691a22b44be847b0ca81641c5fb6ad0172c-integrity/node_modules/@humanwhocodes/module-importer/"),
      packageDependencies: new Map([
        ["@humanwhocodes/module-importer", "1.0.1"],
      ]),
    }],
  ])],
  ["@nodelib/fs.walk", new Map([
    ["1.2.8", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-@nodelib-fs-walk-1.2.8-e95737e8bb6746ddedf69c556953494f196fe69a-integrity/node_modules/@nodelib/fs.walk/"),
      packageDependencies: new Map([
        ["@nodelib/fs.scandir", "2.1.5"],
        ["fastq", "1.19.0"],
        ["@nodelib/fs.walk", "1.2.8"],
      ]),
    }],
  ])],
  ["@nodelib/fs.scandir", new Map([
    ["2.1.5", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-@nodelib-fs-scandir-2.1.5-7619c2eb21b25483f6d167548b4cfd5a7488c3d5-integrity/node_modules/@nodelib/fs.scandir/"),
      packageDependencies: new Map([
        ["@nodelib/fs.stat", "2.0.5"],
        ["run-parallel", "1.2.0"],
        ["@nodelib/fs.scandir", "2.1.5"],
      ]),
    }],
  ])],
  ["@nodelib/fs.stat", new Map([
    ["2.0.5", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-@nodelib-fs-stat-2.0.5-5bd262af94e9d25bd1e71b05deed44876a222e8b-integrity/node_modules/@nodelib/fs.stat/"),
      packageDependencies: new Map([
        ["@nodelib/fs.stat", "2.0.5"],
      ]),
    }],
  ])],
  ["run-parallel", new Map([
    ["1.2.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-run-parallel-1.2.0-66d1368da7bdf921eb9d95bd1a9229e7f21a43ee-integrity/node_modules/run-parallel/"),
      packageDependencies: new Map([
        ["queue-microtask", "1.2.3"],
        ["run-parallel", "1.2.0"],
      ]),
    }],
  ])],
  ["queue-microtask", new Map([
    ["1.2.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-queue-microtask-1.2.3-4929228bbc724dfac43e0efb058caf7b6cfb6243-integrity/node_modules/queue-microtask/"),
      packageDependencies: new Map([
        ["queue-microtask", "1.2.3"],
      ]),
    }],
  ])],
  ["fastq", new Map([
    ["1.19.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-fastq-1.19.0-a82c6b7c2bb4e44766d865f07997785fecfdcb89-integrity/node_modules/fastq/"),
      packageDependencies: new Map([
        ["reusify", "1.0.4"],
        ["fastq", "1.19.0"],
      ]),
    }],
  ])],
  ["reusify", new Map([
    ["1.0.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-reusify-1.0.4-90da382b1e126efc02146e90845a88db12925d76-integrity/node_modules/reusify/"),
      packageDependencies: new Map([
        ["reusify", "1.0.4"],
      ]),
    }],
  ])],
  ["@ungap/structured-clone", new Map([
    ["1.3.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-@ungap-structured-clone-1.3.0-d06bbb384ebcf6c505fde1c3d0ed4ddffe0aaff8-integrity/node_modules/@ungap/structured-clone/"),
      packageDependencies: new Map([
        ["@ungap/structured-clone", "1.3.0"],
      ]),
    }],
  ])],
  ["chalk", new Map([
    ["4.1.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-chalk-4.1.2-aac4e2b7734a740867aeb16bf02aad556a1e7a01-integrity/node_modules/chalk/"),
      packageDependencies: new Map([
        ["ansi-styles", "4.3.0"],
        ["supports-color", "7.2.0"],
        ["chalk", "4.1.2"],
      ]),
    }],
  ])],
  ["ansi-styles", new Map([
    ["4.3.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-ansi-styles-4.3.0-edd803628ae71c04c85ae7a0906edad34b648937-integrity/node_modules/ansi-styles/"),
      packageDependencies: new Map([
        ["color-convert", "2.0.1"],
        ["ansi-styles", "4.3.0"],
      ]),
    }],
  ])],
  ["color-convert", new Map([
    ["2.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-color-convert-2.0.1-72d3a68d598c9bdb3af2ad1e84f21d896abd4de3-integrity/node_modules/color-convert/"),
      packageDependencies: new Map([
        ["color-name", "1.1.4"],
        ["color-convert", "2.0.1"],
      ]),
    }],
  ])],
  ["color-name", new Map([
    ["1.1.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-color-name-1.1.4-c2a09a87acbde69543de6f63fa3995c826c536a2-integrity/node_modules/color-name/"),
      packageDependencies: new Map([
        ["color-name", "1.1.4"],
      ]),
    }],
  ])],
  ["supports-color", new Map([
    ["7.2.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-supports-color-7.2.0-1b7dcdcb32b8138801b3e478ba6a51caa89648da-integrity/node_modules/supports-color/"),
      packageDependencies: new Map([
        ["has-flag", "4.0.0"],
        ["supports-color", "7.2.0"],
      ]),
    }],
  ])],
  ["has-flag", new Map([
    ["4.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-has-flag-4.0.0-944771fd9c81c81265c4d6941860da06bb59479b-integrity/node_modules/has-flag/"),
      packageDependencies: new Map([
        ["has-flag", "4.0.0"],
      ]),
    }],
  ])],
  ["cross-spawn", new Map([
    ["7.0.6", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-cross-spawn-7.0.6-8a58fe78f00dcd70c370451759dfbfaf03e8ee9f-integrity/node_modules/cross-spawn/"),
      packageDependencies: new Map([
        ["path-key", "3.1.1"],
        ["shebang-command", "2.0.0"],
        ["which", "2.0.2"],
        ["cross-spawn", "7.0.6"],
      ]),
    }],
  ])],
  ["path-key", new Map([
    ["3.1.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-path-key-3.1.1-581f6ade658cbba65a0d3380de7753295054f375-integrity/node_modules/path-key/"),
      packageDependencies: new Map([
        ["path-key", "3.1.1"],
      ]),
    }],
  ])],
  ["shebang-command", new Map([
    ["2.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-shebang-command-2.0.0-ccd0af4f8835fbdc265b82461aaf0c36663f34ea-integrity/node_modules/shebang-command/"),
      packageDependencies: new Map([
        ["shebang-regex", "3.0.0"],
        ["shebang-command", "2.0.0"],
      ]),
    }],
  ])],
  ["shebang-regex", new Map([
    ["3.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-shebang-regex-3.0.0-ae16f1644d873ecad843b0307b143362d4c42172-integrity/node_modules/shebang-regex/"),
      packageDependencies: new Map([
        ["shebang-regex", "3.0.0"],
      ]),
    }],
  ])],
  ["which", new Map([
    ["2.0.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-which-2.0.2-7c6a8dd0a636a0327e10b59c9286eee93f3f51b1-integrity/node_modules/which/"),
      packageDependencies: new Map([
        ["isexe", "2.0.0"],
        ["which", "2.0.2"],
      ]),
    }],
  ])],
  ["isexe", new Map([
    ["2.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-isexe-2.0.0-e8fbf374dc556ff8947a10dcb0572d633f2cfa10-integrity/node_modules/isexe/"),
      packageDependencies: new Map([
        ["isexe", "2.0.0"],
      ]),
    }],
  ])],
  ["doctrine", new Map([
    ["3.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-doctrine-3.0.0-addebead72a6574db783639dc87a121773973961-integrity/node_modules/doctrine/"),
      packageDependencies: new Map([
        ["esutils", "2.0.3"],
        ["doctrine", "3.0.0"],
      ]),
    }],
  ])],
  ["esutils", new Map([
    ["2.0.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-esutils-2.0.3-74d2eb4de0b8da1293711910d50775b9b710ef64-integrity/node_modules/esutils/"),
      packageDependencies: new Map([
        ["esutils", "2.0.3"],
      ]),
    }],
  ])],
  ["escape-string-regexp", new Map([
    ["4.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-escape-string-regexp-4.0.0-14ba83a5d373e3d311e5afca29cf5bfad965bf34-integrity/node_modules/escape-string-regexp/"),
      packageDependencies: new Map([
        ["escape-string-regexp", "4.0.0"],
      ]),
    }],
  ])],
  ["eslint-scope", new Map([
    ["7.2.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-eslint-scope-7.2.2-deb4f92563390f32006894af62a22dba1c46423f-integrity/node_modules/eslint-scope/"),
      packageDependencies: new Map([
        ["esrecurse", "4.3.0"],
        ["estraverse", "5.3.0"],
        ["eslint-scope", "7.2.2"],
      ]),
    }],
  ])],
  ["esrecurse", new Map([
    ["4.3.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-esrecurse-4.3.0-7ad7964d679abb28bee72cec63758b1c5d2c9921-integrity/node_modules/esrecurse/"),
      packageDependencies: new Map([
        ["estraverse", "5.3.0"],
        ["esrecurse", "4.3.0"],
      ]),
    }],
  ])],
  ["estraverse", new Map([
    ["5.3.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-estraverse-5.3.0-2eea5290702f26ab8fe5370370ff86c965d21123-integrity/node_modules/estraverse/"),
      packageDependencies: new Map([
        ["estraverse", "5.3.0"],
      ]),
    }],
  ])],
  ["esquery", new Map([
    ["1.6.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-esquery-1.6.0-91419234f804d852a82dceec3e16cdc22cf9dae7-integrity/node_modules/esquery/"),
      packageDependencies: new Map([
        ["estraverse", "5.3.0"],
        ["esquery", "1.6.0"],
      ]),
    }],
  ])],
  ["file-entry-cache", new Map([
    ["6.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-file-entry-cache-6.0.1-211b2dd9659cb0394b073e7323ac3c933d522027-integrity/node_modules/file-entry-cache/"),
      packageDependencies: new Map([
        ["flat-cache", "3.2.0"],
        ["file-entry-cache", "6.0.1"],
      ]),
    }],
  ])],
  ["flat-cache", new Map([
    ["3.2.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-flat-cache-3.2.0-2c0c2d5040c99b1632771a9d105725c0115363ee-integrity/node_modules/flat-cache/"),
      packageDependencies: new Map([
        ["flatted", "3.3.3"],
        ["keyv", "4.5.4"],
        ["rimraf", "3.0.2"],
        ["flat-cache", "3.2.0"],
      ]),
    }],
  ])],
  ["flatted", new Map([
    ["3.3.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-flatted-3.3.3-67c8fad95454a7c7abebf74bb78ee74a44023358-integrity/node_modules/flatted/"),
      packageDependencies: new Map([
        ["flatted", "3.3.3"],
      ]),
    }],
  ])],
  ["keyv", new Map([
    ["4.5.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-keyv-4.5.4-a879a99e29452f942439f2a405e3af8b31d4de93-integrity/node_modules/keyv/"),
      packageDependencies: new Map([
        ["json-buffer", "3.0.1"],
        ["keyv", "4.5.4"],
      ]),
    }],
  ])],
  ["json-buffer", new Map([
    ["3.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-json-buffer-3.0.1-9338802a30d3b6605fbe0613e094008ca8c05a13-integrity/node_modules/json-buffer/"),
      packageDependencies: new Map([
        ["json-buffer", "3.0.1"],
      ]),
    }],
  ])],
  ["rimraf", new Map([
    ["3.0.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-rimraf-3.0.2-f1a5402ba6220ad52cc1282bac1ae3aa49fd061a-integrity/node_modules/rimraf/"),
      packageDependencies: new Map([
        ["glob", "7.2.3"],
        ["rimraf", "3.0.2"],
      ]),
    }],
  ])],
  ["glob", new Map([
    ["7.2.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-glob-7.2.3-b8df0fb802bbfa8e89bd1d938b4e16578ed44f2b-integrity/node_modules/glob/"),
      packageDependencies: new Map([
        ["fs.realpath", "1.0.0"],
        ["inflight", "1.0.6"],
        ["inherits", "2.0.4"],
        ["minimatch", "3.1.2"],
        ["once", "1.4.0"],
        ["path-is-absolute", "1.0.1"],
        ["glob", "7.2.3"],
      ]),
    }],
  ])],
  ["fs.realpath", new Map([
    ["1.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-fs-realpath-1.0.0-1504ad2523158caa40db4a2787cb01411994ea4f-integrity/node_modules/fs.realpath/"),
      packageDependencies: new Map([
        ["fs.realpath", "1.0.0"],
      ]),
    }],
  ])],
  ["inflight", new Map([
    ["1.0.6", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-inflight-1.0.6-49bd6331d7d02d0c09bc910a1075ba8165b56df9-integrity/node_modules/inflight/"),
      packageDependencies: new Map([
        ["once", "1.4.0"],
        ["wrappy", "1.0.2"],
        ["inflight", "1.0.6"],
      ]),
    }],
  ])],
  ["once", new Map([
    ["1.4.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-once-1.4.0-583b1aa775961d4b113ac17d9c50baef9dd76bd1-integrity/node_modules/once/"),
      packageDependencies: new Map([
        ["wrappy", "1.0.2"],
        ["once", "1.4.0"],
      ]),
    }],
  ])],
  ["wrappy", new Map([
    ["1.0.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-wrappy-1.0.2-b5243d8f3ec1aa35f1364605bc0d1036e30ab69f-integrity/node_modules/wrappy/"),
      packageDependencies: new Map([
        ["wrappy", "1.0.2"],
      ]),
    }],
  ])],
  ["inherits", new Map([
    ["2.0.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-inherits-2.0.4-0fa2c64f932917c3433a0ded55363aae37416b7c-integrity/node_modules/inherits/"),
      packageDependencies: new Map([
        ["inherits", "2.0.4"],
      ]),
    }],
  ])],
  ["path-is-absolute", new Map([
    ["1.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-path-is-absolute-1.0.1-174b9268735534ffbc7ace6bf53a5a9e1b5c5f5f-integrity/node_modules/path-is-absolute/"),
      packageDependencies: new Map([
        ["path-is-absolute", "1.0.1"],
      ]),
    }],
  ])],
  ["find-up", new Map([
    ["5.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-find-up-5.0.0-4c92819ecb7083561e4f4a240a86be5198f536fc-integrity/node_modules/find-up/"),
      packageDependencies: new Map([
        ["locate-path", "6.0.0"],
        ["path-exists", "4.0.0"],
        ["find-up", "5.0.0"],
      ]),
    }],
  ])],
  ["locate-path", new Map([
    ["6.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-locate-path-6.0.0-55321eb309febbc59c4801d931a72452a681d286-integrity/node_modules/locate-path/"),
      packageDependencies: new Map([
        ["p-locate", "5.0.0"],
        ["locate-path", "6.0.0"],
      ]),
    }],
  ])],
  ["p-locate", new Map([
    ["5.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-p-locate-5.0.0-83c8315c6785005e3bd021839411c9e110e6d834-integrity/node_modules/p-locate/"),
      packageDependencies: new Map([
        ["p-limit", "3.1.0"],
        ["p-locate", "5.0.0"],
      ]),
    }],
  ])],
  ["p-limit", new Map([
    ["3.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-p-limit-3.1.0-e1daccbe78d0d1388ca18c64fea38e3e57e3706b-integrity/node_modules/p-limit/"),
      packageDependencies: new Map([
        ["yocto-queue", "0.1.0"],
        ["p-limit", "3.1.0"],
      ]),
    }],
  ])],
  ["yocto-queue", new Map([
    ["0.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-yocto-queue-0.1.0-0294eb3dee05028d31ee1a5fa2c556a6aaf10a1b-integrity/node_modules/yocto-queue/"),
      packageDependencies: new Map([
        ["yocto-queue", "0.1.0"],
      ]),
    }],
  ])],
  ["path-exists", new Map([
    ["4.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-path-exists-4.0.0-513bdbe2d3b95d7762e8c1137efa195c6c61b5b3-integrity/node_modules/path-exists/"),
      packageDependencies: new Map([
        ["path-exists", "4.0.0"],
      ]),
    }],
  ])],
  ["glob-parent", new Map([
    ["6.0.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-glob-parent-6.0.2-6d237d99083950c79290f24c7642a3de9a28f9e3-integrity/node_modules/glob-parent/"),
      packageDependencies: new Map([
        ["is-glob", "4.0.3"],
        ["glob-parent", "6.0.2"],
      ]),
    }],
  ])],
  ["is-glob", new Map([
    ["4.0.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-is-glob-4.0.3-64f61e42cbbb2eec2071a9dac0b28ba1e65d5084-integrity/node_modules/is-glob/"),
      packageDependencies: new Map([
        ["is-extglob", "2.1.1"],
        ["is-glob", "4.0.3"],
      ]),
    }],
  ])],
  ["is-extglob", new Map([
    ["2.1.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-is-extglob-2.1.1-a88c02535791f02ed37c76a1b9ea9773c833f8c2-integrity/node_modules/is-extglob/"),
      packageDependencies: new Map([
        ["is-extglob", "2.1.1"],
      ]),
    }],
  ])],
  ["graphemer", new Map([
    ["1.4.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-graphemer-1.4.0-fb2f1d55e0e3a1849aeffc90c4fa0dd53a0e66c6-integrity/node_modules/graphemer/"),
      packageDependencies: new Map([
        ["graphemer", "1.4.0"],
      ]),
    }],
  ])],
  ["imurmurhash", new Map([
    ["0.1.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-imurmurhash-0.1.4-9218b9b2b928a238b13dc4fb6b6d576f231453ea-integrity/node_modules/imurmurhash/"),
      packageDependencies: new Map([
        ["imurmurhash", "0.1.4"],
      ]),
    }],
  ])],
  ["is-path-inside", new Map([
    ["3.0.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-is-path-inside-3.0.3-d231362e53a07ff2b0e0ea7fed049161ffd16283-integrity/node_modules/is-path-inside/"),
      packageDependencies: new Map([
        ["is-path-inside", "3.0.3"],
      ]),
    }],
  ])],
  ["json-stable-stringify-without-jsonify", new Map([
    ["1.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-json-stable-stringify-without-jsonify-1.0.1-9db7b59496ad3f3cfef30a75142d2d930ad72651-integrity/node_modules/json-stable-stringify-without-jsonify/"),
      packageDependencies: new Map([
        ["json-stable-stringify-without-jsonify", "1.0.1"],
      ]),
    }],
  ])],
  ["levn", new Map([
    ["0.4.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-levn-0.4.1-ae4562c007473b932a6200d403268dd2fffc6ade-integrity/node_modules/levn/"),
      packageDependencies: new Map([
        ["prelude-ls", "1.2.1"],
        ["type-check", "0.4.0"],
        ["levn", "0.4.1"],
      ]),
    }],
  ])],
  ["prelude-ls", new Map([
    ["1.2.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-prelude-ls-1.2.1-debc6489d7a6e6b0e7611888cec880337d316396-integrity/node_modules/prelude-ls/"),
      packageDependencies: new Map([
        ["prelude-ls", "1.2.1"],
      ]),
    }],
  ])],
  ["type-check", new Map([
    ["0.4.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-type-check-0.4.0-07b8203bfa7056c0657050e3ccd2c37730bab8f1-integrity/node_modules/type-check/"),
      packageDependencies: new Map([
        ["prelude-ls", "1.2.1"],
        ["type-check", "0.4.0"],
      ]),
    }],
  ])],
  ["lodash.merge", new Map([
    ["4.6.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-lodash-merge-4.6.2-558aa53b43b661e1925a0afdfa36a9a1085fe57a-integrity/node_modules/lodash.merge/"),
      packageDependencies: new Map([
        ["lodash.merge", "4.6.2"],
      ]),
    }],
  ])],
  ["natural-compare", new Map([
    ["1.4.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-natural-compare-1.4.0-4abebfeed7541f2c27acfb29bdbbd15c8d5ba4f7-integrity/node_modules/natural-compare/"),
      packageDependencies: new Map([
        ["natural-compare", "1.4.0"],
      ]),
    }],
  ])],
  ["optionator", new Map([
    ["0.9.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-optionator-0.9.4-7ea1c1a5d91d764fb282139c88fe11e182a3a734-integrity/node_modules/optionator/"),
      packageDependencies: new Map([
        ["deep-is", "0.1.4"],
        ["fast-levenshtein", "2.0.6"],
        ["levn", "0.4.1"],
        ["prelude-ls", "1.2.1"],
        ["type-check", "0.4.0"],
        ["word-wrap", "1.2.5"],
        ["optionator", "0.9.4"],
      ]),
    }],
  ])],
  ["deep-is", new Map([
    ["0.1.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-deep-is-0.1.4-a6f2dce612fadd2ef1f519b73551f17e85199831-integrity/node_modules/deep-is/"),
      packageDependencies: new Map([
        ["deep-is", "0.1.4"],
      ]),
    }],
  ])],
  ["fast-levenshtein", new Map([
    ["2.0.6", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-fast-levenshtein-2.0.6-3d8a5c66883a16a30ca8643e851f19baa7797917-integrity/node_modules/fast-levenshtein/"),
      packageDependencies: new Map([
        ["fast-levenshtein", "2.0.6"],
      ]),
    }],
  ])],
  ["word-wrap", new Map([
    ["1.2.5", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-word-wrap-1.2.5-d2c45c6dd4fbce621a66f136cbe328afd0410b34-integrity/node_modules/word-wrap/"),
      packageDependencies: new Map([
        ["word-wrap", "1.2.5"],
      ]),
    }],
  ])],
  ["strip-ansi", new Map([
    ["6.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-strip-ansi-6.0.1-9e26c63d30f53443e9489495b2105d37b67a85d9-integrity/node_modules/strip-ansi/"),
      packageDependencies: new Map([
        ["ansi-regex", "5.0.1"],
        ["strip-ansi", "6.0.1"],
      ]),
    }],
  ])],
  ["ansi-regex", new Map([
    ["5.0.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-ansi-regex-5.0.1-082cb2c89c9fe8659a311a53bd6a4dc5301db304-integrity/node_modules/ansi-regex/"),
      packageDependencies: new Map([
        ["ansi-regex", "5.0.1"],
      ]),
    }],
  ])],
  ["text-table", new Map([
    ["0.2.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-text-table-0.2.0-7f5ee823ae805207c00af2df4a84ec3fcfa570b4-integrity/node_modules/text-table/"),
      packageDependencies: new Map([
        ["text-table", "0.2.0"],
      ]),
    }],
  ])],
  ["eslint-config-prettier", new Map([
    ["9.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-eslint-config-prettier-9.1.0-31af3d94578645966c082fcb71a5846d3c94867f-integrity/node_modules/eslint-config-prettier/"),
      packageDependencies: new Map([
        ["eslint", "8.57.1"],
        ["eslint-config-prettier", "9.1.0"],
      ]),
    }],
  ])],
  ["eslint-plugin-svelte", new Map([
    ["2.46.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-eslint-plugin-svelte-2.46.1-22691c8685420cd4eabf0cbaa31a0cfb8395595b-integrity/node_modules/eslint-plugin-svelte/"),
      packageDependencies: new Map([
        ["eslint", "8.57.1"],
        ["svelte", "5.20.2"],
        ["@eslint-community/eslint-utils", "pnp:95db2819e12c07d08cf0abbd48fe339ae94dec45"],
        ["@jridgewell/sourcemap-codec", "1.5.0"],
        ["eslint-compat-utils", "0.5.1"],
        ["esutils", "2.0.3"],
        ["known-css-properties", "0.35.0"],
        ["postcss", "8.5.2"],
        ["postcss-load-config", "3.1.4"],
        ["postcss-safe-parser", "6.0.0"],
        ["postcss-selector-parser", "6.1.2"],
        ["semver", "7.7.1"],
        ["svelte-eslint-parser", "0.43.0"],
        ["eslint-plugin-svelte", "2.46.1"],
      ]),
    }],
  ])],
  ["eslint-compat-utils", new Map([
    ["0.5.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-eslint-compat-utils-0.5.1-7fc92b776d185a70c4070d03fd26fde3d59652e4-integrity/node_modules/eslint-compat-utils/"),
      packageDependencies: new Map([
        ["eslint", "8.57.1"],
        ["semver", "7.7.1"],
        ["eslint-compat-utils", "0.5.1"],
      ]),
    }],
  ])],
  ["semver", new Map([
    ["7.7.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-semver-7.7.1-abd5098d82b18c6c81f6074ff2647fd3e7220c9f-integrity/node_modules/semver/"),
      packageDependencies: new Map([
        ["semver", "7.7.1"],
      ]),
    }],
  ])],
  ["known-css-properties", new Map([
    ["0.35.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-known-css-properties-0.35.0-f6f8e40ab4e5700fa32f5b2ef5218a56bc853bd6-integrity/node_modules/known-css-properties/"),
      packageDependencies: new Map([
        ["known-css-properties", "0.35.0"],
      ]),
    }],
  ])],
  ["postcss-load-config", new Map([
    ["3.1.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-postcss-load-config-3.1.4-1ab2571faf84bb078877e1d07905eabe9ebda855-integrity/node_modules/postcss-load-config/"),
      packageDependencies: new Map([
        ["postcss", "8.5.2"],
        ["lilconfig", "2.1.0"],
        ["yaml", "1.10.2"],
        ["postcss-load-config", "3.1.4"],
      ]),
    }],
  ])],
  ["lilconfig", new Map([
    ["2.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-lilconfig-2.1.0-78e23ac89ebb7e1bfbf25b18043de756548e7f52-integrity/node_modules/lilconfig/"),
      packageDependencies: new Map([
        ["lilconfig", "2.1.0"],
      ]),
    }],
  ])],
  ["yaml", new Map([
    ["1.10.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-yaml-1.10.2-2301c5ffbf12b467de8da2333a459e29e7920e4b-integrity/node_modules/yaml/"),
      packageDependencies: new Map([
        ["yaml", "1.10.2"],
      ]),
    }],
  ])],
  ["postcss-safe-parser", new Map([
    ["6.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-postcss-safe-parser-6.0.0-bb4c29894171a94bc5c996b9a30317ef402adaa1-integrity/node_modules/postcss-safe-parser/"),
      packageDependencies: new Map([
        ["postcss", "8.5.2"],
        ["postcss-safe-parser", "6.0.0"],
      ]),
    }],
  ])],
  ["postcss-selector-parser", new Map([
    ["6.1.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-postcss-selector-parser-6.1.2-27ecb41fb0e3b6ba7a1ec84fff347f734c7929de-integrity/node_modules/postcss-selector-parser/"),
      packageDependencies: new Map([
        ["cssesc", "3.0.0"],
        ["util-deprecate", "1.0.2"],
        ["postcss-selector-parser", "6.1.2"],
      ]),
    }],
  ])],
  ["cssesc", new Map([
    ["3.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-cssesc-3.0.0-37741919903b868565e1c09ea747445cd18983ee-integrity/node_modules/cssesc/"),
      packageDependencies: new Map([
        ["cssesc", "3.0.0"],
      ]),
    }],
  ])],
  ["util-deprecate", new Map([
    ["1.0.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-util-deprecate-1.0.2-450d4dc9fa70de732762fbd2d4a28981419a0ccf-integrity/node_modules/util-deprecate/"),
      packageDependencies: new Map([
        ["util-deprecate", "1.0.2"],
      ]),
    }],
  ])],
  ["svelte-eslint-parser", new Map([
    ["0.43.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-svelte-eslint-parser-0.43.0-649e80f65183c4c1d1536d03dcb903e0632f4da4-integrity/node_modules/svelte-eslint-parser/"),
      packageDependencies: new Map([
        ["svelte", "5.20.2"],
        ["eslint-scope", "7.2.2"],
        ["eslint-visitor-keys", "3.4.3"],
        ["espree", "9.6.1"],
        ["postcss", "8.5.2"],
        ["postcss-scss", "4.0.9"],
        ["svelte-eslint-parser", "0.43.0"],
      ]),
    }],
  ])],
  ["postcss-scss", new Map([
    ["4.0.9", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-postcss-scss-4.0.9-a03c773cd4c9623cb04ce142a52afcec74806685-integrity/node_modules/postcss-scss/"),
      packageDependencies: new Map([
        ["postcss", "8.5.2"],
        ["postcss-scss", "4.0.9"],
      ]),
    }],
  ])],
  ["prettier", new Map([
    ["3.5.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-prettier-3.5.1-22fac9d0b18c0b92055ac8fb619ac1c7bef02fb7-integrity/node_modules/prettier/"),
      packageDependencies: new Map([
        ["prettier", "3.5.1"],
      ]),
    }],
  ])],
  ["prettier-plugin-svelte", new Map([
    ["3.3.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-prettier-plugin-svelte-3.3.3-49d5c025a1516063ac7ef026806f880caa310424-integrity/node_modules/prettier-plugin-svelte/"),
      packageDependencies: new Map([
        ["prettier", "3.5.1"],
        ["svelte", "5.20.2"],
        ["prettier-plugin-svelte", "3.3.3"],
      ]),
    }],
  ])],
  ["prettier-plugin-tailwindcss", new Map([
    ["0.6.11", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-prettier-plugin-tailwindcss-0.6.11-cfacd60c4f81997353ee913e589037f796df0f5f-integrity/node_modules/prettier-plugin-tailwindcss/"),
      packageDependencies: new Map([
        ["prettier", "3.5.1"],
        ["prettier-plugin-svelte", "3.3.3"],
        ["prettier-plugin-tailwindcss", "0.6.11"],
      ]),
    }],
  ])],
  ["svelte", new Map([
    ["5.20.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-svelte-5.20.2-b08c003e982a32c588dcbbf24c1ac8606c0654dd-integrity/node_modules/svelte/"),
      packageDependencies: new Map([
        ["@ampproject/remapping", "2.3.0"],
        ["@jridgewell/sourcemap-codec", "1.5.0"],
        ["@types/estree", "1.0.6"],
        ["acorn", "8.14.0"],
        ["acorn-typescript", "1.4.13"],
        ["aria-query", "5.3.2"],
        ["axobject-query", "4.1.0"],
        ["clsx", "2.1.1"],
        ["esm-env", "1.2.2"],
        ["esrap", "1.4.5"],
        ["is-reference", "3.0.3"],
        ["locate-character", "3.0.0"],
        ["magic-string", "0.30.17"],
        ["zimmerframe", "1.1.2"],
        ["svelte", "5.20.2"],
      ]),
    }],
  ])],
  ["@ampproject/remapping", new Map([
    ["2.3.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-@ampproject-remapping-2.3.0-ed441b6fa600072520ce18b43d2c8cc8caecc7f4-integrity/node_modules/@ampproject/remapping/"),
      packageDependencies: new Map([
        ["@jridgewell/gen-mapping", "0.3.8"],
        ["@jridgewell/trace-mapping", "0.3.25"],
        ["@ampproject/remapping", "2.3.0"],
      ]),
    }],
  ])],
  ["@jridgewell/gen-mapping", new Map([
    ["0.3.8", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-@jridgewell-gen-mapping-0.3.8-4f0e06362e01362f823d348f1872b08f666d8142-integrity/node_modules/@jridgewell/gen-mapping/"),
      packageDependencies: new Map([
        ["@jridgewell/set-array", "1.2.1"],
        ["@jridgewell/sourcemap-codec", "1.5.0"],
        ["@jridgewell/trace-mapping", "0.3.25"],
        ["@jridgewell/gen-mapping", "0.3.8"],
      ]),
    }],
  ])],
  ["@jridgewell/set-array", new Map([
    ["1.2.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-@jridgewell-set-array-1.2.1-558fb6472ed16a4c850b889530e6b36438c49280-integrity/node_modules/@jridgewell/set-array/"),
      packageDependencies: new Map([
        ["@jridgewell/set-array", "1.2.1"],
      ]),
    }],
  ])],
  ["@jridgewell/trace-mapping", new Map([
    ["0.3.25", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-@jridgewell-trace-mapping-0.3.25-15f190e98895f3fc23276ee14bc76b675c2e50f0-integrity/node_modules/@jridgewell/trace-mapping/"),
      packageDependencies: new Map([
        ["@jridgewell/resolve-uri", "3.1.2"],
        ["@jridgewell/sourcemap-codec", "1.5.0"],
        ["@jridgewell/trace-mapping", "0.3.25"],
      ]),
    }],
  ])],
  ["@jridgewell/resolve-uri", new Map([
    ["3.1.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-@jridgewell-resolve-uri-3.1.2-7a0ee601f60f99a20c7c7c5ff0c80388c1189bd6-integrity/node_modules/@jridgewell/resolve-uri/"),
      packageDependencies: new Map([
        ["@jridgewell/resolve-uri", "3.1.2"],
      ]),
    }],
  ])],
  ["acorn-typescript", new Map([
    ["1.4.13", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-acorn-typescript-1.4.13-5f851c8bdda0aa716ffdd5f6ac084df8acc6f5ea-integrity/node_modules/acorn-typescript/"),
      packageDependencies: new Map([
        ["acorn", "8.14.0"],
        ["acorn-typescript", "1.4.13"],
      ]),
    }],
  ])],
  ["aria-query", new Map([
    ["5.3.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-aria-query-5.3.2-93f81a43480e33a338f19163a3d10a50c01dcd59-integrity/node_modules/aria-query/"),
      packageDependencies: new Map([
        ["aria-query", "5.3.2"],
      ]),
    }],
  ])],
  ["axobject-query", new Map([
    ["4.1.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-axobject-query-4.1.0-28768c76d0e3cff21bc62a9e2d0b6ac30042a1ee-integrity/node_modules/axobject-query/"),
      packageDependencies: new Map([
        ["axobject-query", "4.1.0"],
      ]),
    }],
  ])],
  ["clsx", new Map([
    ["2.1.1", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-clsx-2.1.1-eed397c9fd8bd882bfb18deab7102049a2f32999-integrity/node_modules/clsx/"),
      packageDependencies: new Map([
        ["clsx", "2.1.1"],
      ]),
    }],
  ])],
  ["esrap", new Map([
    ["1.4.5", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-esrap-1.4.5-45469ad75773fd948d0eb190c2677e4807ba2483-integrity/node_modules/esrap/"),
      packageDependencies: new Map([
        ["@jridgewell/sourcemap-codec", "1.5.0"],
        ["esrap", "1.4.5"],
      ]),
    }],
  ])],
  ["is-reference", new Map([
    ["3.0.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-is-reference-3.0.3-9ef7bf9029c70a67b2152da4adf57c23d718910f-integrity/node_modules/is-reference/"),
      packageDependencies: new Map([
        ["@types/estree", "1.0.6"],
        ["is-reference", "3.0.3"],
      ]),
    }],
  ])],
  ["locate-character", new Map([
    ["3.0.0", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-locate-character-3.0.0-0305c5b8744f61028ef5d01f444009e00779f974-integrity/node_modules/locate-character/"),
      packageDependencies: new Map([
        ["locate-character", "3.0.0"],
      ]),
    }],
  ])],
  ["zimmerframe", new Map([
    ["1.1.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-zimmerframe-1.1.2-5b75f1fa83b07ae2a428d51e50f58e2ae6855e5e-integrity/node_modules/zimmerframe/"),
      packageDependencies: new Map([
        ["zimmerframe", "1.1.2"],
      ]),
    }],
  ])],
  ["svelte-check", new Map([
    ["4.1.4", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-svelte-check-4.1.4-59ec6f08d23647ec508ff01584ef6d191c77c9e1-integrity/node_modules/svelte-check/"),
      packageDependencies: new Map([
        ["svelte", "5.20.2"],
        ["typescript", "5.7.3"],
        ["@jridgewell/trace-mapping", "0.3.25"],
        ["chokidar", "4.0.3"],
        ["fdir", "6.4.3"],
        ["picocolors", "1.1.1"],
        ["sade", "1.8.1"],
        ["svelte-check", "4.1.4"],
      ]),
    }],
  ])],
  ["chokidar", new Map([
    ["4.0.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-chokidar-4.0.3-7be37a4c03c9aee1ecfe862a4a23b2c70c205d30-integrity/node_modules/chokidar/"),
      packageDependencies: new Map([
        ["readdirp", "4.1.2"],
        ["chokidar", "4.0.3"],
      ]),
    }],
  ])],
  ["readdirp", new Map([
    ["4.1.2", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-readdirp-4.1.2-eb85801435fbf2a7ee58f19e0921b068fc69948d-integrity/node_modules/readdirp/"),
      packageDependencies: new Map([
        ["readdirp", "4.1.2"],
      ]),
    }],
  ])],
  ["fdir", new Map([
    ["6.4.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-fdir-6.4.3-011cdacf837eca9b811c89dbb902df714273db72-integrity/node_modules/fdir/"),
      packageDependencies: new Map([
        ["fdir", "6.4.3"],
      ]),
    }],
  ])],
  ["typescript", new Map([
    ["5.7.3", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-typescript-5.7.3-919b44a7dbb8583a9b856d162be24a54bf80073e-integrity/node_modules/typescript/"),
      packageDependencies: new Map([
        ["typescript", "5.7.3"],
      ]),
    }],
  ])],
  ["vite", new Map([
    ["5.4.14", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-vite-5.4.14-ff8255edb02134df180dcfca1916c37a6abe8408-integrity/node_modules/vite/"),
      packageDependencies: new Map([
        ["esbuild", "0.21.5"],
        ["postcss", "8.5.2"],
        ["rollup", "4.34.8"],
        ["vite", "5.4.14"],
      ]),
    }],
  ])],
  ["esbuild", new Map([
    ["0.21.5", {
      packageLocation: path.resolve(__dirname, "./.pnp/unplugged/npm-esbuild-0.21.5-9ca301b120922959b766360d8ac830da0d02997d-integrity/node_modules/esbuild/"),
      packageDependencies: new Map([
        ["@esbuild/win32-x64", "0.21.5"],
        ["esbuild", "0.21.5"],
      ]),
    }],
  ])],
  ["@esbuild/win32-x64", new Map([
    ["0.21.5", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-@esbuild-win32-x64-0.21.5-acad351d582d157bb145535db2a6ff53dd514b5c-integrity/node_modules/@esbuild/win32-x64/"),
      packageDependencies: new Map([
        ["@esbuild/win32-x64", "0.21.5"],
      ]),
    }],
  ])],
  ["rollup", new Map([
    ["4.34.8", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-rollup-4.34.8-e859c1a51d899aba9bcf451d4eed1d11fb8e2a6e-integrity/node_modules/rollup/"),
      packageDependencies: new Map([
        ["@types/estree", "1.0.6"],
        ["@rollup/rollup-win32-x64-msvc", "4.34.8"],
        ["rollup", "4.34.8"],
      ]),
    }],
  ])],
  ["@rollup/rollup-win32-x64-msvc", new Map([
    ["4.34.8", {
      packageLocation: path.resolve(__dirname, "../../../AppData/Local/Yarn/Cache/v6/npm-@rollup-rollup-win32-x64-msvc-4.34.8-4cdb2cfae69cdb7b1a3cc58778e820408075e928-integrity/node_modules/@rollup/rollup-win32-x64-msvc/"),
      packageDependencies: new Map([
        ["@rollup/rollup-win32-x64-msvc", "4.34.8"],
      ]),
    }],
  ])],
  [null, new Map([
    [null, {
      packageLocation: path.resolve(__dirname, "./"),
      packageDependencies: new Map([
        ["@fontsource/fira-mono", "4.5.10"],
        ["@neoconfetti/svelte", "1.0.0"],
        ["@sveltejs/adapter-auto", "3.3.1"],
        ["@sveltejs/adapter-static", "3.0.8"],
        ["@sveltejs/kit", "2.17.2"],
        ["@sveltejs/vite-plugin-svelte", "4.0.4"],
        ["@tailwindcss/postcss", "4.0.7"],
        ["@types/eslint", "8.56.12"],
        ["eslint", "8.57.1"],
        ["eslint-config-prettier", "9.1.0"],
        ["eslint-plugin-svelte", "2.46.1"],
        ["postcss", "8.5.2"],
        ["prettier", "3.5.1"],
        ["prettier-plugin-svelte", "3.3.3"],
        ["prettier-plugin-tailwindcss", "0.6.11"],
        ["svelte", "5.20.2"],
        ["svelte-check", "4.1.4"],
        ["tailwindcss", "4.0.7"],
        ["typescript", "5.7.3"],
        ["vite", "5.4.14"],
      ]),
    }],
  ])],
]);

let locatorsByLocations = new Map([
  ["./.pnp/externals/pnp-68e36f0d07f687f05cda6dd611e55c893648db63/node_modules/@eslint-community/eslint-utils/", blacklistedLocator],
  ["./.pnp/externals/pnp-95db2819e12c07d08cf0abbd48fe339ae94dec45/node_modules/@eslint-community/eslint-utils/", blacklistedLocator],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-@fontsource-fira-mono-4.5.10-443be4b2b4fc6e685b88431fcfdaf8d5f5639bbf-integrity/node_modules/@fontsource/fira-mono/", {"name":"@fontsource/fira-mono","reference":"4.5.10"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-@neoconfetti-svelte-1.0.0-84a7f98981ad546d959d8c99460da8cebdf70301-integrity/node_modules/@neoconfetti/svelte/", {"name":"@neoconfetti/svelte","reference":"1.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-@sveltejs-adapter-auto-3.3.1-57a3d9c402bea468f0899755758551e7e74deaae-integrity/node_modules/@sveltejs/adapter-auto/", {"name":"@sveltejs/adapter-auto","reference":"3.3.1"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-import-meta-resolve-4.1.0-f9db8bead9fafa61adb811db77a2bf22c5399706-integrity/node_modules/import-meta-resolve/", {"name":"import-meta-resolve","reference":"4.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-@sveltejs-adapter-static-3.0.8-f23ee99a9678dbaec58b79d183bc3defbfe99f1a-integrity/node_modules/@sveltejs/adapter-static/", {"name":"@sveltejs/adapter-static","reference":"3.0.8"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-@sveltejs-kit-2.17.2-87c6a1efe42a3f06dd0558e49b79988fec4338bd-integrity/node_modules/@sveltejs/kit/", {"name":"@sveltejs/kit","reference":"2.17.2"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-@types-cookie-0.6.0-eac397f28bf1d6ae0ae081363eca2f425bedf0d5-integrity/node_modules/@types/cookie/", {"name":"@types/cookie","reference":"0.6.0"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-cookie-0.6.0-2798b04b071b0ecbff0dbb62a505a8efa4e19051-integrity/node_modules/cookie/", {"name":"cookie","reference":"0.6.0"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-devalue-5.1.1-a71887ac0f354652851752654e4bd435a53891ae-integrity/node_modules/devalue/", {"name":"devalue","reference":"5.1.1"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-esm-env-1.2.2-263c9455c55861f41618df31b20cb571fc20b75e-integrity/node_modules/esm-env/", {"name":"esm-env","reference":"1.2.2"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-kleur-4.1.5-95106101795f7050c6c650f350c683febddb1780-integrity/node_modules/kleur/", {"name":"kleur","reference":"4.1.5"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-magic-string-0.30.17-450a449673d2460e5bbcfba9a61916a1714c7453-integrity/node_modules/magic-string/", {"name":"magic-string","reference":"0.30.17"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-@jridgewell-sourcemap-codec-1.5.0-3188bcb273a414b0d215fd22a58540b989b9409a-integrity/node_modules/@jridgewell/sourcemap-codec/", {"name":"@jridgewell/sourcemap-codec","reference":"1.5.0"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-mrmime-2.0.1-bc3e87f7987853a54c9850eeb1f1078cd44adddc-integrity/node_modules/mrmime/", {"name":"mrmime","reference":"2.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-sade-1.8.1-0a78e81d658d394887be57d2a409bf703a3b2701-integrity/node_modules/sade/", {"name":"sade","reference":"1.8.1"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-mri-1.2.0-6721480fec2a11a4889861115a48b6cbe7cc8f0b-integrity/node_modules/mri/", {"name":"mri","reference":"1.2.0"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-set-cookie-parser-2.7.1-3016f150072202dfbe90fadee053573cc89d2943-integrity/node_modules/set-cookie-parser/", {"name":"set-cookie-parser","reference":"2.7.1"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-sirv-3.0.1-32a844794655b727f9e2867b777e0060fbe07bf3-integrity/node_modules/sirv/", {"name":"sirv","reference":"3.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-@polka-url-1.0.0-next.28-d45e01c4a56f143ee69c54dd6b12eade9e270a73-integrity/node_modules/@polka/url/", {"name":"@polka/url","reference":"1.0.0-next.28"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-totalist-3.0.1-ba3a3d600c915b1a97872348f79c127475f6acf8-integrity/node_modules/totalist/", {"name":"totalist","reference":"3.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-@sveltejs-vite-plugin-svelte-4.0.4-79dfc00377f5456f4c3d95f56817d6486cc0df6c-integrity/node_modules/@sveltejs/vite-plugin-svelte/", {"name":"@sveltejs/vite-plugin-svelte","reference":"4.0.4"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-@sveltejs-vite-plugin-svelte-inspector-3.0.1-006bcab6ea90e09c65459133d4e3eaa6b1e83e28-integrity/node_modules/@sveltejs/vite-plugin-svelte-inspector/", {"name":"@sveltejs/vite-plugin-svelte-inspector","reference":"3.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-debug-4.4.0-2b3f2aea2ffeb776477460267377dc8710faba8a-integrity/node_modules/debug/", {"name":"debug","reference":"4.4.0"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-ms-2.1.3-574c8138ce1d2b5861f0b44579dbadd60c6615b2-integrity/node_modules/ms/", {"name":"ms","reference":"2.1.3"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-deepmerge-4.3.1-44b5f2147cd3b00d4b56137685966f26fd25dd4a-integrity/node_modules/deepmerge/", {"name":"deepmerge","reference":"4.3.1"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-vitefu-1.0.5-eab501e07da167bbb68e957685823e6b425e7ce2-integrity/node_modules/vitefu/", {"name":"vitefu","reference":"1.0.5"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-@tailwindcss-postcss-4.0.7-b8bc02b5e23248ac7cbac1970ed807850e03261c-integrity/node_modules/@tailwindcss/postcss/", {"name":"@tailwindcss/postcss","reference":"4.0.7"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-@alloc-quick-lru-5.2.0-7bf68b20c0a350f936915fcae06f58e32007ce30-integrity/node_modules/@alloc/quick-lru/", {"name":"@alloc/quick-lru","reference":"5.2.0"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-@tailwindcss-node-4.0.7-11211457bbe83ff3656c74bf0276e27e9ce87410-integrity/node_modules/@tailwindcss/node/", {"name":"@tailwindcss/node","reference":"4.0.7"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-enhanced-resolve-5.18.1-728ab082f8b7b6836de51f1637aab5d3b9568faf-integrity/node_modules/enhanced-resolve/", {"name":"enhanced-resolve","reference":"5.18.1"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-graceful-fs-4.2.11-4183e4e8bf08bb6e05bbb2f7d2e0c8f712ca40e3-integrity/node_modules/graceful-fs/", {"name":"graceful-fs","reference":"4.2.11"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-tapable-2.2.1-1967a73ef4060a82f12ab96af86d52fdb76eeca0-integrity/node_modules/tapable/", {"name":"tapable","reference":"2.2.1"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-jiti-2.4.2-d19b7732ebb6116b06e2038da74a55366faef560-integrity/node_modules/jiti/", {"name":"jiti","reference":"2.4.2"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-tailwindcss-4.0.7-b3e26a5dda77651808a873f1b535cc8c39fcb0ae-integrity/node_modules/tailwindcss/", {"name":"tailwindcss","reference":"4.0.7"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-@tailwindcss-oxide-4.0.7-b53573fc01b8b61af195ad36957d05c78278761d-integrity/node_modules/@tailwindcss/oxide/", {"name":"@tailwindcss/oxide","reference":"4.0.7"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-@tailwindcss-oxide-win32-x64-msvc-4.0.7-500cf333326a45078ca5b0fd68b56b1f0b434bfa-integrity/node_modules/@tailwindcss/oxide-win32-x64-msvc/", {"name":"@tailwindcss/oxide-win32-x64-msvc","reference":"4.0.7"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-lightningcss-1.29.1-1d4d62332fc5ba4b6c28e04a8c5638c76019702b-integrity/node_modules/lightningcss/", {"name":"lightningcss","reference":"1.29.1"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-detect-libc-1.0.3-fa137c4bd698edf55cd5cd02ac559f91a4c4ba9b-integrity/node_modules/detect-libc/", {"name":"detect-libc","reference":"1.0.3"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-lightningcss-win32-x64-msvc-1.29.1-54dcd52884f6cbf205a53d49239559603f194927-integrity/node_modules/lightningcss-win32-x64-msvc/", {"name":"lightningcss-win32-x64-msvc","reference":"1.29.1"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-postcss-8.5.2-e7b99cb9d2ec3e8dd424002e7c16517cb2b846bd-integrity/node_modules/postcss/", {"name":"postcss","reference":"8.5.2"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-nanoid-3.3.8-b1be3030bee36aaff18bacb375e5cce521684baf-integrity/node_modules/nanoid/", {"name":"nanoid","reference":"3.3.8"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-picocolors-1.1.1-3d321af3eab939b083c8f929a1d12cda81c26b6b-integrity/node_modules/picocolors/", {"name":"picocolors","reference":"1.1.1"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-source-map-js-1.2.1-1ce5650fddd87abc099eda37dcff024c2667ae46-integrity/node_modules/source-map-js/", {"name":"source-map-js","reference":"1.2.1"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-@types-eslint-8.56.12-1657c814ffeba4d2f84c0d4ba0f44ca7ea1ca53a-integrity/node_modules/@types/eslint/", {"name":"@types/eslint","reference":"8.56.12"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-@types-estree-1.0.6-628effeeae2064a1b4e79f78e81d87b7e5fc7b50-integrity/node_modules/@types/estree/", {"name":"@types/estree","reference":"1.0.6"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-@types-json-schema-7.0.15-596a1747233694d50f6ad8a7869fcb6f56cf5841-integrity/node_modules/@types/json-schema/", {"name":"@types/json-schema","reference":"7.0.15"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-eslint-8.57.1-7df109654aba7e3bbe5c8eae533c5e461d3c6ca9-integrity/node_modules/eslint/", {"name":"eslint","reference":"8.57.1"}],
  ["./.pnp/externals/pnp-68e36f0d07f687f05cda6dd611e55c893648db63/node_modules/@eslint-community/eslint-utils/", {"name":"@eslint-community/eslint-utils","reference":"pnp:68e36f0d07f687f05cda6dd611e55c893648db63"}],
  ["./.pnp/externals/pnp-95db2819e12c07d08cf0abbd48fe339ae94dec45/node_modules/@eslint-community/eslint-utils/", {"name":"@eslint-community/eslint-utils","reference":"pnp:95db2819e12c07d08cf0abbd48fe339ae94dec45"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-eslint-visitor-keys-3.4.3-0cd72fe8550e3c2eae156a96a4dddcd1c8ac5800-integrity/node_modules/eslint-visitor-keys/", {"name":"eslint-visitor-keys","reference":"3.4.3"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-@eslint-community-regexpp-4.12.1-cfc6cffe39df390a3841cde2abccf92eaa7ae0e0-integrity/node_modules/@eslint-community/regexpp/", {"name":"@eslint-community/regexpp","reference":"4.12.1"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-@eslint-eslintrc-2.1.4-388a269f0f25c1b6adc317b5a2c55714894c70ad-integrity/node_modules/@eslint/eslintrc/", {"name":"@eslint/eslintrc","reference":"2.1.4"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-ajv-6.12.6-baf5a62e802b07d977034586f8c3baf5adf26df4-integrity/node_modules/ajv/", {"name":"ajv","reference":"6.12.6"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-fast-deep-equal-3.1.3-3a7d56b559d6cbc3eb512325244e619a65c6c525-integrity/node_modules/fast-deep-equal/", {"name":"fast-deep-equal","reference":"3.1.3"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-fast-json-stable-stringify-2.1.0-874bf69c6f404c2b5d99c481341399fd55892633-integrity/node_modules/fast-json-stable-stringify/", {"name":"fast-json-stable-stringify","reference":"2.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-json-schema-traverse-0.4.1-69f6a87d9513ab8bb8fe63bdb0979c448e684660-integrity/node_modules/json-schema-traverse/", {"name":"json-schema-traverse","reference":"0.4.1"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-uri-js-4.4.1-9b1a52595225859e55f669d928f88c6c57f2a77e-integrity/node_modules/uri-js/", {"name":"uri-js","reference":"4.4.1"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-punycode-2.3.1-027422e2faec0b25e1549c3e1bd8309b9133b6e5-integrity/node_modules/punycode/", {"name":"punycode","reference":"2.3.1"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-espree-9.6.1-a2a17b8e434690a5432f2f8018ce71d331a48c6f-integrity/node_modules/espree/", {"name":"espree","reference":"9.6.1"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-acorn-8.14.0-063e2c70cac5fb4f6467f0b11152e04c682795b0-integrity/node_modules/acorn/", {"name":"acorn","reference":"8.14.0"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-acorn-jsx-5.3.2-7ed5bb55908b3b2f1bc55c6af1653bada7f07937-integrity/node_modules/acorn-jsx/", {"name":"acorn-jsx","reference":"5.3.2"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-globals-13.24.0-8432a19d78ce0c1e833949c36adb345400bb1171-integrity/node_modules/globals/", {"name":"globals","reference":"13.24.0"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-type-fest-0.20.2-1bf207f4b28f91583666cb5fbd327887301cd5f4-integrity/node_modules/type-fest/", {"name":"type-fest","reference":"0.20.2"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-ignore-5.3.2-3cd40e729f3643fd87cb04e50bf0eb722bc596f5-integrity/node_modules/ignore/", {"name":"ignore","reference":"5.3.2"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-import-fresh-3.3.1-9cecb56503c0ada1f2741dbbd6546e4b13b57ccf-integrity/node_modules/import-fresh/", {"name":"import-fresh","reference":"3.3.1"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-parent-module-1.0.1-691d2709e78c79fae3a156622452d00762caaaa2-integrity/node_modules/parent-module/", {"name":"parent-module","reference":"1.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-callsites-3.1.0-b3630abd8943432f54b3f0519238e33cd7df2f73-integrity/node_modules/callsites/", {"name":"callsites","reference":"3.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-resolve-from-4.0.0-4abcd852ad32dd7baabfe9b40e00a36db5f392e6-integrity/node_modules/resolve-from/", {"name":"resolve-from","reference":"4.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-js-yaml-4.1.0-c1fb65f8f5017901cdd2c951864ba18458a10602-integrity/node_modules/js-yaml/", {"name":"js-yaml","reference":"4.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-argparse-2.0.1-246f50f3ca78a3240f6c997e8a9bd1eac49e4b38-integrity/node_modules/argparse/", {"name":"argparse","reference":"2.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-minimatch-3.1.2-19cd194bfd3e428f049a70817c038d89ab4be35b-integrity/node_modules/minimatch/", {"name":"minimatch","reference":"3.1.2"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-brace-expansion-1.1.11-3c7fcbf529d87226f3d2f52b966ff5271eb441dd-integrity/node_modules/brace-expansion/", {"name":"brace-expansion","reference":"1.1.11"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-balanced-match-1.0.2-e83e3a7e3f300b34cb9d87f615fa0cbf357690ee-integrity/node_modules/balanced-match/", {"name":"balanced-match","reference":"1.0.2"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-concat-map-0.0.1-d8a96bd77fd68df7793a73036a3ba0d5405d477b-integrity/node_modules/concat-map/", {"name":"concat-map","reference":"0.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-strip-json-comments-3.1.1-31f1281b3832630434831c310c01cccda8cbe006-integrity/node_modules/strip-json-comments/", {"name":"strip-json-comments","reference":"3.1.1"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-@eslint-js-8.57.1-de633db3ec2ef6a3c89e2f19038063e8a122e2c2-integrity/node_modules/@eslint/js/", {"name":"@eslint/js","reference":"8.57.1"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-@humanwhocodes-config-array-0.13.0-fb907624df3256d04b9aa2df50d7aa97ec648748-integrity/node_modules/@humanwhocodes/config-array/", {"name":"@humanwhocodes/config-array","reference":"0.13.0"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-@humanwhocodes-object-schema-2.0.3-4a2868d75d6d6963e423bcf90b7fd1be343409d3-integrity/node_modules/@humanwhocodes/object-schema/", {"name":"@humanwhocodes/object-schema","reference":"2.0.3"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-@humanwhocodes-module-importer-1.0.1-af5b2691a22b44be847b0ca81641c5fb6ad0172c-integrity/node_modules/@humanwhocodes/module-importer/", {"name":"@humanwhocodes/module-importer","reference":"1.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-@nodelib-fs-walk-1.2.8-e95737e8bb6746ddedf69c556953494f196fe69a-integrity/node_modules/@nodelib/fs.walk/", {"name":"@nodelib/fs.walk","reference":"1.2.8"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-@nodelib-fs-scandir-2.1.5-7619c2eb21b25483f6d167548b4cfd5a7488c3d5-integrity/node_modules/@nodelib/fs.scandir/", {"name":"@nodelib/fs.scandir","reference":"2.1.5"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-@nodelib-fs-stat-2.0.5-5bd262af94e9d25bd1e71b05deed44876a222e8b-integrity/node_modules/@nodelib/fs.stat/", {"name":"@nodelib/fs.stat","reference":"2.0.5"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-run-parallel-1.2.0-66d1368da7bdf921eb9d95bd1a9229e7f21a43ee-integrity/node_modules/run-parallel/", {"name":"run-parallel","reference":"1.2.0"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-queue-microtask-1.2.3-4929228bbc724dfac43e0efb058caf7b6cfb6243-integrity/node_modules/queue-microtask/", {"name":"queue-microtask","reference":"1.2.3"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-fastq-1.19.0-a82c6b7c2bb4e44766d865f07997785fecfdcb89-integrity/node_modules/fastq/", {"name":"fastq","reference":"1.19.0"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-reusify-1.0.4-90da382b1e126efc02146e90845a88db12925d76-integrity/node_modules/reusify/", {"name":"reusify","reference":"1.0.4"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-@ungap-structured-clone-1.3.0-d06bbb384ebcf6c505fde1c3d0ed4ddffe0aaff8-integrity/node_modules/@ungap/structured-clone/", {"name":"@ungap/structured-clone","reference":"1.3.0"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-chalk-4.1.2-aac4e2b7734a740867aeb16bf02aad556a1e7a01-integrity/node_modules/chalk/", {"name":"chalk","reference":"4.1.2"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-ansi-styles-4.3.0-edd803628ae71c04c85ae7a0906edad34b648937-integrity/node_modules/ansi-styles/", {"name":"ansi-styles","reference":"4.3.0"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-color-convert-2.0.1-72d3a68d598c9bdb3af2ad1e84f21d896abd4de3-integrity/node_modules/color-convert/", {"name":"color-convert","reference":"2.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-color-name-1.1.4-c2a09a87acbde69543de6f63fa3995c826c536a2-integrity/node_modules/color-name/", {"name":"color-name","reference":"1.1.4"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-supports-color-7.2.0-1b7dcdcb32b8138801b3e478ba6a51caa89648da-integrity/node_modules/supports-color/", {"name":"supports-color","reference":"7.2.0"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-has-flag-4.0.0-944771fd9c81c81265c4d6941860da06bb59479b-integrity/node_modules/has-flag/", {"name":"has-flag","reference":"4.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-cross-spawn-7.0.6-8a58fe78f00dcd70c370451759dfbfaf03e8ee9f-integrity/node_modules/cross-spawn/", {"name":"cross-spawn","reference":"7.0.6"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-path-key-3.1.1-581f6ade658cbba65a0d3380de7753295054f375-integrity/node_modules/path-key/", {"name":"path-key","reference":"3.1.1"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-shebang-command-2.0.0-ccd0af4f8835fbdc265b82461aaf0c36663f34ea-integrity/node_modules/shebang-command/", {"name":"shebang-command","reference":"2.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-shebang-regex-3.0.0-ae16f1644d873ecad843b0307b143362d4c42172-integrity/node_modules/shebang-regex/", {"name":"shebang-regex","reference":"3.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-which-2.0.2-7c6a8dd0a636a0327e10b59c9286eee93f3f51b1-integrity/node_modules/which/", {"name":"which","reference":"2.0.2"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-isexe-2.0.0-e8fbf374dc556ff8947a10dcb0572d633f2cfa10-integrity/node_modules/isexe/", {"name":"isexe","reference":"2.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-doctrine-3.0.0-addebead72a6574db783639dc87a121773973961-integrity/node_modules/doctrine/", {"name":"doctrine","reference":"3.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-esutils-2.0.3-74d2eb4de0b8da1293711910d50775b9b710ef64-integrity/node_modules/esutils/", {"name":"esutils","reference":"2.0.3"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-escape-string-regexp-4.0.0-14ba83a5d373e3d311e5afca29cf5bfad965bf34-integrity/node_modules/escape-string-regexp/", {"name":"escape-string-regexp","reference":"4.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-eslint-scope-7.2.2-deb4f92563390f32006894af62a22dba1c46423f-integrity/node_modules/eslint-scope/", {"name":"eslint-scope","reference":"7.2.2"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-esrecurse-4.3.0-7ad7964d679abb28bee72cec63758b1c5d2c9921-integrity/node_modules/esrecurse/", {"name":"esrecurse","reference":"4.3.0"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-estraverse-5.3.0-2eea5290702f26ab8fe5370370ff86c965d21123-integrity/node_modules/estraverse/", {"name":"estraverse","reference":"5.3.0"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-esquery-1.6.0-91419234f804d852a82dceec3e16cdc22cf9dae7-integrity/node_modules/esquery/", {"name":"esquery","reference":"1.6.0"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-file-entry-cache-6.0.1-211b2dd9659cb0394b073e7323ac3c933d522027-integrity/node_modules/file-entry-cache/", {"name":"file-entry-cache","reference":"6.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-flat-cache-3.2.0-2c0c2d5040c99b1632771a9d105725c0115363ee-integrity/node_modules/flat-cache/", {"name":"flat-cache","reference":"3.2.0"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-flatted-3.3.3-67c8fad95454a7c7abebf74bb78ee74a44023358-integrity/node_modules/flatted/", {"name":"flatted","reference":"3.3.3"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-keyv-4.5.4-a879a99e29452f942439f2a405e3af8b31d4de93-integrity/node_modules/keyv/", {"name":"keyv","reference":"4.5.4"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-json-buffer-3.0.1-9338802a30d3b6605fbe0613e094008ca8c05a13-integrity/node_modules/json-buffer/", {"name":"json-buffer","reference":"3.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-rimraf-3.0.2-f1a5402ba6220ad52cc1282bac1ae3aa49fd061a-integrity/node_modules/rimraf/", {"name":"rimraf","reference":"3.0.2"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-glob-7.2.3-b8df0fb802bbfa8e89bd1d938b4e16578ed44f2b-integrity/node_modules/glob/", {"name":"glob","reference":"7.2.3"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-fs-realpath-1.0.0-1504ad2523158caa40db4a2787cb01411994ea4f-integrity/node_modules/fs.realpath/", {"name":"fs.realpath","reference":"1.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-inflight-1.0.6-49bd6331d7d02d0c09bc910a1075ba8165b56df9-integrity/node_modules/inflight/", {"name":"inflight","reference":"1.0.6"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-once-1.4.0-583b1aa775961d4b113ac17d9c50baef9dd76bd1-integrity/node_modules/once/", {"name":"once","reference":"1.4.0"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-wrappy-1.0.2-b5243d8f3ec1aa35f1364605bc0d1036e30ab69f-integrity/node_modules/wrappy/", {"name":"wrappy","reference":"1.0.2"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-inherits-2.0.4-0fa2c64f932917c3433a0ded55363aae37416b7c-integrity/node_modules/inherits/", {"name":"inherits","reference":"2.0.4"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-path-is-absolute-1.0.1-174b9268735534ffbc7ace6bf53a5a9e1b5c5f5f-integrity/node_modules/path-is-absolute/", {"name":"path-is-absolute","reference":"1.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-find-up-5.0.0-4c92819ecb7083561e4f4a240a86be5198f536fc-integrity/node_modules/find-up/", {"name":"find-up","reference":"5.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-locate-path-6.0.0-55321eb309febbc59c4801d931a72452a681d286-integrity/node_modules/locate-path/", {"name":"locate-path","reference":"6.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-p-locate-5.0.0-83c8315c6785005e3bd021839411c9e110e6d834-integrity/node_modules/p-locate/", {"name":"p-locate","reference":"5.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-p-limit-3.1.0-e1daccbe78d0d1388ca18c64fea38e3e57e3706b-integrity/node_modules/p-limit/", {"name":"p-limit","reference":"3.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-yocto-queue-0.1.0-0294eb3dee05028d31ee1a5fa2c556a6aaf10a1b-integrity/node_modules/yocto-queue/", {"name":"yocto-queue","reference":"0.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-path-exists-4.0.0-513bdbe2d3b95d7762e8c1137efa195c6c61b5b3-integrity/node_modules/path-exists/", {"name":"path-exists","reference":"4.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-glob-parent-6.0.2-6d237d99083950c79290f24c7642a3de9a28f9e3-integrity/node_modules/glob-parent/", {"name":"glob-parent","reference":"6.0.2"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-is-glob-4.0.3-64f61e42cbbb2eec2071a9dac0b28ba1e65d5084-integrity/node_modules/is-glob/", {"name":"is-glob","reference":"4.0.3"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-is-extglob-2.1.1-a88c02535791f02ed37c76a1b9ea9773c833f8c2-integrity/node_modules/is-extglob/", {"name":"is-extglob","reference":"2.1.1"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-graphemer-1.4.0-fb2f1d55e0e3a1849aeffc90c4fa0dd53a0e66c6-integrity/node_modules/graphemer/", {"name":"graphemer","reference":"1.4.0"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-imurmurhash-0.1.4-9218b9b2b928a238b13dc4fb6b6d576f231453ea-integrity/node_modules/imurmurhash/", {"name":"imurmurhash","reference":"0.1.4"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-is-path-inside-3.0.3-d231362e53a07ff2b0e0ea7fed049161ffd16283-integrity/node_modules/is-path-inside/", {"name":"is-path-inside","reference":"3.0.3"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-json-stable-stringify-without-jsonify-1.0.1-9db7b59496ad3f3cfef30a75142d2d930ad72651-integrity/node_modules/json-stable-stringify-without-jsonify/", {"name":"json-stable-stringify-without-jsonify","reference":"1.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-levn-0.4.1-ae4562c007473b932a6200d403268dd2fffc6ade-integrity/node_modules/levn/", {"name":"levn","reference":"0.4.1"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-prelude-ls-1.2.1-debc6489d7a6e6b0e7611888cec880337d316396-integrity/node_modules/prelude-ls/", {"name":"prelude-ls","reference":"1.2.1"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-type-check-0.4.0-07b8203bfa7056c0657050e3ccd2c37730bab8f1-integrity/node_modules/type-check/", {"name":"type-check","reference":"0.4.0"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-lodash-merge-4.6.2-558aa53b43b661e1925a0afdfa36a9a1085fe57a-integrity/node_modules/lodash.merge/", {"name":"lodash.merge","reference":"4.6.2"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-natural-compare-1.4.0-4abebfeed7541f2c27acfb29bdbbd15c8d5ba4f7-integrity/node_modules/natural-compare/", {"name":"natural-compare","reference":"1.4.0"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-optionator-0.9.4-7ea1c1a5d91d764fb282139c88fe11e182a3a734-integrity/node_modules/optionator/", {"name":"optionator","reference":"0.9.4"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-deep-is-0.1.4-a6f2dce612fadd2ef1f519b73551f17e85199831-integrity/node_modules/deep-is/", {"name":"deep-is","reference":"0.1.4"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-fast-levenshtein-2.0.6-3d8a5c66883a16a30ca8643e851f19baa7797917-integrity/node_modules/fast-levenshtein/", {"name":"fast-levenshtein","reference":"2.0.6"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-word-wrap-1.2.5-d2c45c6dd4fbce621a66f136cbe328afd0410b34-integrity/node_modules/word-wrap/", {"name":"word-wrap","reference":"1.2.5"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-strip-ansi-6.0.1-9e26c63d30f53443e9489495b2105d37b67a85d9-integrity/node_modules/strip-ansi/", {"name":"strip-ansi","reference":"6.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-ansi-regex-5.0.1-082cb2c89c9fe8659a311a53bd6a4dc5301db304-integrity/node_modules/ansi-regex/", {"name":"ansi-regex","reference":"5.0.1"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-text-table-0.2.0-7f5ee823ae805207c00af2df4a84ec3fcfa570b4-integrity/node_modules/text-table/", {"name":"text-table","reference":"0.2.0"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-eslint-config-prettier-9.1.0-31af3d94578645966c082fcb71a5846d3c94867f-integrity/node_modules/eslint-config-prettier/", {"name":"eslint-config-prettier","reference":"9.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-eslint-plugin-svelte-2.46.1-22691c8685420cd4eabf0cbaa31a0cfb8395595b-integrity/node_modules/eslint-plugin-svelte/", {"name":"eslint-plugin-svelte","reference":"2.46.1"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-eslint-compat-utils-0.5.1-7fc92b776d185a70c4070d03fd26fde3d59652e4-integrity/node_modules/eslint-compat-utils/", {"name":"eslint-compat-utils","reference":"0.5.1"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-semver-7.7.1-abd5098d82b18c6c81f6074ff2647fd3e7220c9f-integrity/node_modules/semver/", {"name":"semver","reference":"7.7.1"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-known-css-properties-0.35.0-f6f8e40ab4e5700fa32f5b2ef5218a56bc853bd6-integrity/node_modules/known-css-properties/", {"name":"known-css-properties","reference":"0.35.0"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-postcss-load-config-3.1.4-1ab2571faf84bb078877e1d07905eabe9ebda855-integrity/node_modules/postcss-load-config/", {"name":"postcss-load-config","reference":"3.1.4"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-lilconfig-2.1.0-78e23ac89ebb7e1bfbf25b18043de756548e7f52-integrity/node_modules/lilconfig/", {"name":"lilconfig","reference":"2.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-yaml-1.10.2-2301c5ffbf12b467de8da2333a459e29e7920e4b-integrity/node_modules/yaml/", {"name":"yaml","reference":"1.10.2"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-postcss-safe-parser-6.0.0-bb4c29894171a94bc5c996b9a30317ef402adaa1-integrity/node_modules/postcss-safe-parser/", {"name":"postcss-safe-parser","reference":"6.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-postcss-selector-parser-6.1.2-27ecb41fb0e3b6ba7a1ec84fff347f734c7929de-integrity/node_modules/postcss-selector-parser/", {"name":"postcss-selector-parser","reference":"6.1.2"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-cssesc-3.0.0-37741919903b868565e1c09ea747445cd18983ee-integrity/node_modules/cssesc/", {"name":"cssesc","reference":"3.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-util-deprecate-1.0.2-450d4dc9fa70de732762fbd2d4a28981419a0ccf-integrity/node_modules/util-deprecate/", {"name":"util-deprecate","reference":"1.0.2"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-svelte-eslint-parser-0.43.0-649e80f65183c4c1d1536d03dcb903e0632f4da4-integrity/node_modules/svelte-eslint-parser/", {"name":"svelte-eslint-parser","reference":"0.43.0"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-postcss-scss-4.0.9-a03c773cd4c9623cb04ce142a52afcec74806685-integrity/node_modules/postcss-scss/", {"name":"postcss-scss","reference":"4.0.9"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-prettier-3.5.1-22fac9d0b18c0b92055ac8fb619ac1c7bef02fb7-integrity/node_modules/prettier/", {"name":"prettier","reference":"3.5.1"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-prettier-plugin-svelte-3.3.3-49d5c025a1516063ac7ef026806f880caa310424-integrity/node_modules/prettier-plugin-svelte/", {"name":"prettier-plugin-svelte","reference":"3.3.3"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-prettier-plugin-tailwindcss-0.6.11-cfacd60c4f81997353ee913e589037f796df0f5f-integrity/node_modules/prettier-plugin-tailwindcss/", {"name":"prettier-plugin-tailwindcss","reference":"0.6.11"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-svelte-5.20.2-b08c003e982a32c588dcbbf24c1ac8606c0654dd-integrity/node_modules/svelte/", {"name":"svelte","reference":"5.20.2"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-@ampproject-remapping-2.3.0-ed441b6fa600072520ce18b43d2c8cc8caecc7f4-integrity/node_modules/@ampproject/remapping/", {"name":"@ampproject/remapping","reference":"2.3.0"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-@jridgewell-gen-mapping-0.3.8-4f0e06362e01362f823d348f1872b08f666d8142-integrity/node_modules/@jridgewell/gen-mapping/", {"name":"@jridgewell/gen-mapping","reference":"0.3.8"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-@jridgewell-set-array-1.2.1-558fb6472ed16a4c850b889530e6b36438c49280-integrity/node_modules/@jridgewell/set-array/", {"name":"@jridgewell/set-array","reference":"1.2.1"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-@jridgewell-trace-mapping-0.3.25-15f190e98895f3fc23276ee14bc76b675c2e50f0-integrity/node_modules/@jridgewell/trace-mapping/", {"name":"@jridgewell/trace-mapping","reference":"0.3.25"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-@jridgewell-resolve-uri-3.1.2-7a0ee601f60f99a20c7c7c5ff0c80388c1189bd6-integrity/node_modules/@jridgewell/resolve-uri/", {"name":"@jridgewell/resolve-uri","reference":"3.1.2"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-acorn-typescript-1.4.13-5f851c8bdda0aa716ffdd5f6ac084df8acc6f5ea-integrity/node_modules/acorn-typescript/", {"name":"acorn-typescript","reference":"1.4.13"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-aria-query-5.3.2-93f81a43480e33a338f19163a3d10a50c01dcd59-integrity/node_modules/aria-query/", {"name":"aria-query","reference":"5.3.2"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-axobject-query-4.1.0-28768c76d0e3cff21bc62a9e2d0b6ac30042a1ee-integrity/node_modules/axobject-query/", {"name":"axobject-query","reference":"4.1.0"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-clsx-2.1.1-eed397c9fd8bd882bfb18deab7102049a2f32999-integrity/node_modules/clsx/", {"name":"clsx","reference":"2.1.1"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-esrap-1.4.5-45469ad75773fd948d0eb190c2677e4807ba2483-integrity/node_modules/esrap/", {"name":"esrap","reference":"1.4.5"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-is-reference-3.0.3-9ef7bf9029c70a67b2152da4adf57c23d718910f-integrity/node_modules/is-reference/", {"name":"is-reference","reference":"3.0.3"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-locate-character-3.0.0-0305c5b8744f61028ef5d01f444009e00779f974-integrity/node_modules/locate-character/", {"name":"locate-character","reference":"3.0.0"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-zimmerframe-1.1.2-5b75f1fa83b07ae2a428d51e50f58e2ae6855e5e-integrity/node_modules/zimmerframe/", {"name":"zimmerframe","reference":"1.1.2"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-svelte-check-4.1.4-59ec6f08d23647ec508ff01584ef6d191c77c9e1-integrity/node_modules/svelte-check/", {"name":"svelte-check","reference":"4.1.4"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-chokidar-4.0.3-7be37a4c03c9aee1ecfe862a4a23b2c70c205d30-integrity/node_modules/chokidar/", {"name":"chokidar","reference":"4.0.3"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-readdirp-4.1.2-eb85801435fbf2a7ee58f19e0921b068fc69948d-integrity/node_modules/readdirp/", {"name":"readdirp","reference":"4.1.2"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-fdir-6.4.3-011cdacf837eca9b811c89dbb902df714273db72-integrity/node_modules/fdir/", {"name":"fdir","reference":"6.4.3"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-typescript-5.7.3-919b44a7dbb8583a9b856d162be24a54bf80073e-integrity/node_modules/typescript/", {"name":"typescript","reference":"5.7.3"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-vite-5.4.14-ff8255edb02134df180dcfca1916c37a6abe8408-integrity/node_modules/vite/", {"name":"vite","reference":"5.4.14"}],
  ["./.pnp/unplugged/npm-esbuild-0.21.5-9ca301b120922959b766360d8ac830da0d02997d-integrity/node_modules/esbuild/", {"name":"esbuild","reference":"0.21.5"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-@esbuild-win32-x64-0.21.5-acad351d582d157bb145535db2a6ff53dd514b5c-integrity/node_modules/@esbuild/win32-x64/", {"name":"@esbuild/win32-x64","reference":"0.21.5"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-rollup-4.34.8-e859c1a51d899aba9bcf451d4eed1d11fb8e2a6e-integrity/node_modules/rollup/", {"name":"rollup","reference":"4.34.8"}],
  ["../../../AppData/Local/Yarn/Cache/v6/npm-@rollup-rollup-win32-x64-msvc-4.34.8-4cdb2cfae69cdb7b1a3cc58778e820408075e928-integrity/node_modules/@rollup/rollup-win32-x64-msvc/", {"name":"@rollup/rollup-win32-x64-msvc","reference":"4.34.8"}],
  ["./", topLevelLocator],
]);
exports.findPackageLocator = function findPackageLocator(location) {
  let relativeLocation = normalizePath(path.relative(__dirname, location));

  if (!relativeLocation.match(isStrictRegExp))
    relativeLocation = `./${relativeLocation}`;

  if (location.match(isDirRegExp) && relativeLocation.charAt(relativeLocation.length - 1) !== '/')
    relativeLocation = `${relativeLocation}/`;

  let match;

  if (relativeLocation.length >= 189 && relativeLocation[188] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 189)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 187 && relativeLocation[186] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 187)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 179 && relativeLocation[178] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 179)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 173 && relativeLocation[172] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 173)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 172 && relativeLocation[171] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 172)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 169 && relativeLocation[168] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 169)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 168 && relativeLocation[167] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 168)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 167 && relativeLocation[166] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 167)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 165 && relativeLocation[164] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 165)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 164 && relativeLocation[163] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 164)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 161 && relativeLocation[160] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 161)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 159 && relativeLocation[158] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 159)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 157 && relativeLocation[156] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 157)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 156 && relativeLocation[155] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 156)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 155 && relativeLocation[154] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 155)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 154 && relativeLocation[153] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 154)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 153 && relativeLocation[152] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 153)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 151 && relativeLocation[150] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 151)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 150 && relativeLocation[149] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 150)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 149 && relativeLocation[148] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 149)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 147 && relativeLocation[146] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 147)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 146 && relativeLocation[145] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 146)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 145 && relativeLocation[144] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 145)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 144 && relativeLocation[143] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 144)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 143 && relativeLocation[142] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 143)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 141 && relativeLocation[140] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 141)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 140 && relativeLocation[139] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 140)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 139 && relativeLocation[138] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 139)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 138 && relativeLocation[137] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 138)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 137 && relativeLocation[136] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 137)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 136 && relativeLocation[135] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 136)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 135 && relativeLocation[134] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 135)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 134 && relativeLocation[133] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 134)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 133 && relativeLocation[132] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 133)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 132 && relativeLocation[131] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 132)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 131 && relativeLocation[130] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 131)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 129 && relativeLocation[128] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 129)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 127 && relativeLocation[126] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 127)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 126 && relativeLocation[125] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 126)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 125 && relativeLocation[124] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 125)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 124 && relativeLocation[123] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 124)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 123 && relativeLocation[122] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 123)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 122 && relativeLocation[121] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 122)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 121 && relativeLocation[120] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 121)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 120 && relativeLocation[119] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 120)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 119 && relativeLocation[118] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 119)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 117 && relativeLocation[116] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 117)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 108 && relativeLocation[107] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 108)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 106 && relativeLocation[105] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 106)))
      return blacklistCheck(match);

  if (relativeLocation.length >= 2 && relativeLocation[1] === '/')
    if (match = locatorsByLocations.get(relativeLocation.substr(0, 2)))
      return blacklistCheck(match);

  return null;
};


/**
 * Returns the module that should be used to resolve require calls. It's usually the direct parent, except if we're
 * inside an eval expression.
 */

function getIssuerModule(parent) {
  let issuer = parent;

  while (issuer && (issuer.id === '[eval]' || issuer.id === '<repl>' || !issuer.filename)) {
    issuer = issuer.parent;
  }

  return issuer;
}

/**
 * Returns information about a package in a safe way (will throw if they cannot be retrieved)
 */

function getPackageInformationSafe(packageLocator) {
  const packageInformation = exports.getPackageInformation(packageLocator);

  if (!packageInformation) {
    throw makeError(
      `INTERNAL`,
      `Couldn't find a matching entry in the dependency tree for the specified parent (this is probably an internal error)`
    );
  }

  return packageInformation;
}

/**
 * Implements the node resolution for folder access and extension selection
 */

function applyNodeExtensionResolution(unqualifiedPath, {extensions}) {
  // We use this "infinite while" so that we can restart the process as long as we hit package folders
  while (true) {
    let stat;

    try {
      stat = statSync(unqualifiedPath);
    } catch (error) {}

    // If the file exists and is a file, we can stop right there

    if (stat && !stat.isDirectory()) {
      // If the very last component of the resolved path is a symlink to a file, we then resolve it to a file. We only
      // do this first the last component, and not the rest of the path! This allows us to support the case of bin
      // symlinks, where a symlink in "/xyz/pkg-name/.bin/bin-name" will point somewhere else (like "/xyz/pkg-name/index.js").
      // In such a case, we want relative requires to be resolved relative to "/xyz/pkg-name/" rather than "/xyz/pkg-name/.bin/".
      //
      // Also note that the reason we must use readlink on the last component (instead of realpath on the whole path)
      // is that we must preserve the other symlinks, in particular those used by pnp to deambiguate packages using
      // peer dependencies. For example, "/xyz/.pnp/local/pnp-01234569/.bin/bin-name" should see its relative requires
      // be resolved relative to "/xyz/.pnp/local/pnp-0123456789/" rather than "/xyz/pkg-with-peers/", because otherwise
      // we would lose the information that would tell us what are the dependencies of pkg-with-peers relative to its
      // ancestors.

      if (lstatSync(unqualifiedPath).isSymbolicLink()) {
        unqualifiedPath = path.normalize(path.resolve(path.dirname(unqualifiedPath), readlinkSync(unqualifiedPath)));
      }

      return unqualifiedPath;
    }

    // If the file is a directory, we must check if it contains a package.json with a "main" entry

    if (stat && stat.isDirectory()) {
      let pkgJson;

      try {
        pkgJson = JSON.parse(readFileSync(`${unqualifiedPath}/package.json`, 'utf-8'));
      } catch (error) {}

      let nextUnqualifiedPath;

      if (pkgJson && pkgJson.main) {
        nextUnqualifiedPath = path.resolve(unqualifiedPath, pkgJson.main);
      }

      // If the "main" field changed the path, we start again from this new location

      if (nextUnqualifiedPath && nextUnqualifiedPath !== unqualifiedPath) {
        const resolution = applyNodeExtensionResolution(nextUnqualifiedPath, {extensions});

        if (resolution !== null) {
          return resolution;
        }
      }
    }

    // Otherwise we check if we find a file that match one of the supported extensions

    const qualifiedPath = extensions
      .map(extension => {
        return `${unqualifiedPath}${extension}`;
      })
      .find(candidateFile => {
        return existsSync(candidateFile);
      });

    if (qualifiedPath) {
      return qualifiedPath;
    }

    // Otherwise, we check if the path is a folder - in such a case, we try to use its index

    if (stat && stat.isDirectory()) {
      const indexPath = extensions
        .map(extension => {
          return `${unqualifiedPath}/index${extension}`;
        })
        .find(candidateFile => {
          return existsSync(candidateFile);
        });

      if (indexPath) {
        return indexPath;
      }
    }

    // Otherwise there's nothing else we can do :(

    return null;
  }
}

/**
 * This function creates fake modules that can be used with the _resolveFilename function.
 * Ideally it would be nice to be able to avoid this, since it causes useless allocations
 * and cannot be cached efficiently (we recompute the nodeModulePaths every time).
 *
 * Fortunately, this should only affect the fallback, and there hopefully shouldn't be a
 * lot of them.
 */

function makeFakeModule(path) {
  const fakeModule = new Module(path, false);
  fakeModule.filename = path;
  fakeModule.paths = Module._nodeModulePaths(path);
  return fakeModule;
}

/**
 * Normalize path to posix format.
 */

function normalizePath(fsPath) {
  fsPath = path.normalize(fsPath);

  if (process.platform === 'win32') {
    fsPath = fsPath.replace(backwardSlashRegExp, '/');
  }

  return fsPath;
}

/**
 * Forward the resolution to the next resolver (usually the native one)
 */

function callNativeResolution(request, issuer) {
  if (issuer.endsWith('/')) {
    issuer += 'internal.js';
  }

  try {
    enableNativeHooks = false;

    // Since we would need to create a fake module anyway (to call _resolveLookupPath that
    // would give us the paths to give to _resolveFilename), we can as well not use
    // the {paths} option at all, since it internally makes _resolveFilename create another
    // fake module anyway.
    return Module._resolveFilename(request, makeFakeModule(issuer), false);
  } finally {
    enableNativeHooks = true;
  }
}

/**
 * This key indicates which version of the standard is implemented by this resolver. The `std` key is the
 * Plug'n'Play standard, and any other key are third-party extensions. Third-party extensions are not allowed
 * to override the standard, and can only offer new methods.
 *
 * If an new version of the Plug'n'Play standard is released and some extensions conflict with newly added
 * functions, they'll just have to fix the conflicts and bump their own version number.
 */

exports.VERSIONS = {std: 1};

/**
 * Useful when used together with getPackageInformation to fetch information about the top-level package.
 */

exports.topLevel = {name: null, reference: null};

/**
 * Gets the package information for a given locator. Returns null if they cannot be retrieved.
 */

exports.getPackageInformation = function getPackageInformation({name, reference}) {
  const packageInformationStore = packageInformationStores.get(name);

  if (!packageInformationStore) {
    return null;
  }

  const packageInformation = packageInformationStore.get(reference);

  if (!packageInformation) {
    return null;
  }

  return packageInformation;
};

/**
 * Transforms a request (what's typically passed as argument to the require function) into an unqualified path.
 * This path is called "unqualified" because it only changes the package name to the package location on the disk,
 * which means that the end result still cannot be directly accessed (for example, it doesn't try to resolve the
 * file extension, or to resolve directories to their "index.js" content). Use the "resolveUnqualified" function
 * to convert them to fully-qualified paths, or just use "resolveRequest" that do both operations in one go.
 *
 * Note that it is extremely important that the `issuer` path ends with a forward slash if the issuer is to be
 * treated as a folder (ie. "/tmp/foo/" rather than "/tmp/foo" if "foo" is a directory). Otherwise relative
 * imports won't be computed correctly (they'll get resolved relative to "/tmp/" instead of "/tmp/foo/").
 */

exports.resolveToUnqualified = function resolveToUnqualified(request, issuer, {considerBuiltins = true} = {}) {
  // The 'pnpapi' request is reserved and will always return the path to the PnP file, from everywhere

  if (request === `pnpapi`) {
    return pnpFile;
  }

  // Bailout if the request is a native module

  if (considerBuiltins && builtinModules.has(request)) {
    return null;
  }

  // We allow disabling the pnp resolution for some subpaths. This is because some projects, often legacy,
  // contain multiple levels of dependencies (ie. a yarn.lock inside a subfolder of a yarn.lock). This is
  // typically solved using workspaces, but not all of them have been converted already.

  if (ignorePattern && ignorePattern.test(normalizePath(issuer))) {
    const result = callNativeResolution(request, issuer);

    if (result === false) {
      throw makeError(
        `BUILTIN_NODE_RESOLUTION_FAIL`,
        `The builtin node resolution algorithm was unable to resolve the module referenced by "${request}" and requested from "${issuer}" (it didn't go through the pnp resolver because the issuer was explicitely ignored by the regexp "null")`,
        {
          request,
          issuer,
        }
      );
    }

    return result;
  }

  let unqualifiedPath;

  // If the request is a relative or absolute path, we just return it normalized

  const dependencyNameMatch = request.match(pathRegExp);

  if (!dependencyNameMatch) {
    if (path.isAbsolute(request)) {
      unqualifiedPath = path.normalize(request);
    } else if (issuer.match(isDirRegExp)) {
      unqualifiedPath = path.normalize(path.resolve(issuer, request));
    } else {
      unqualifiedPath = path.normalize(path.resolve(path.dirname(issuer), request));
    }
  }

  // Things are more hairy if it's a package require - we then need to figure out which package is needed, and in
  // particular the exact version for the given location on the dependency tree

  if (dependencyNameMatch) {
    const [, dependencyName, subPath] = dependencyNameMatch;

    const issuerLocator = exports.findPackageLocator(issuer);

    // If the issuer file doesn't seem to be owned by a package managed through pnp, then we resort to using the next
    // resolution algorithm in the chain, usually the native Node resolution one

    if (!issuerLocator) {
      const result = callNativeResolution(request, issuer);

      if (result === false) {
        throw makeError(
          `BUILTIN_NODE_RESOLUTION_FAIL`,
          `The builtin node resolution algorithm was unable to resolve the module referenced by "${request}" and requested from "${issuer}" (it didn't go through the pnp resolver because the issuer doesn't seem to be part of the Yarn-managed dependency tree)`,
          {
            request,
            issuer,
          }
        );
      }

      return result;
    }

    const issuerInformation = getPackageInformationSafe(issuerLocator);

    // We obtain the dependency reference in regard to the package that request it

    let dependencyReference = issuerInformation.packageDependencies.get(dependencyName);

    // If we can't find it, we check if we can potentially load it from the packages that have been defined as potential fallbacks.
    // It's a bit of a hack, but it improves compatibility with the existing Node ecosystem. Hopefully we should eventually be able
    // to kill this logic and become stricter once pnp gets enough traction and the affected packages fix themselves.

    if (issuerLocator !== topLevelLocator) {
      for (let t = 0, T = fallbackLocators.length; dependencyReference === undefined && t < T; ++t) {
        const fallbackInformation = getPackageInformationSafe(fallbackLocators[t]);
        dependencyReference = fallbackInformation.packageDependencies.get(dependencyName);
      }
    }

    // If we can't find the path, and if the package making the request is the top-level, we can offer nicer error messages

    if (!dependencyReference) {
      if (dependencyReference === null) {
        if (issuerLocator === topLevelLocator) {
          throw makeError(
            `MISSING_PEER_DEPENDENCY`,
            `You seem to be requiring a peer dependency ("${dependencyName}"), but it is not installed (which might be because you're the top-level package)`,
            {request, issuer, dependencyName}
          );
        } else {
          throw makeError(
            `MISSING_PEER_DEPENDENCY`,
            `Package "${issuerLocator.name}@${issuerLocator.reference}" is trying to access a peer dependency ("${dependencyName}") that should be provided by its direct ancestor but isn't`,
            {request, issuer, issuerLocator: Object.assign({}, issuerLocator), dependencyName}
          );
        }
      } else {
        if (issuerLocator === topLevelLocator) {
          throw makeError(
            `UNDECLARED_DEPENDENCY`,
            `You cannot require a package ("${dependencyName}") that is not declared in your dependencies (via "${issuer}")`,
            {request, issuer, dependencyName}
          );
        } else {
          const candidates = Array.from(issuerInformation.packageDependencies.keys());
          throw makeError(
            `UNDECLARED_DEPENDENCY`,
            `Package "${issuerLocator.name}@${issuerLocator.reference}" (via "${issuer}") is trying to require the package "${dependencyName}" (via "${request}") without it being listed in its dependencies (${candidates.join(
              `, `
            )})`,
            {request, issuer, issuerLocator: Object.assign({}, issuerLocator), dependencyName, candidates}
          );
        }
      }
    }

    // We need to check that the package exists on the filesystem, because it might not have been installed

    const dependencyLocator = {name: dependencyName, reference: dependencyReference};
    const dependencyInformation = exports.getPackageInformation(dependencyLocator);
    const dependencyLocation = path.resolve(__dirname, dependencyInformation.packageLocation);

    if (!dependencyLocation) {
      throw makeError(
        `MISSING_DEPENDENCY`,
        `Package "${dependencyLocator.name}@${dependencyLocator.reference}" is a valid dependency, but hasn't been installed and thus cannot be required (it might be caused if you install a partial tree, such as on production environments)`,
        {request, issuer, dependencyLocator: Object.assign({}, dependencyLocator)}
      );
    }

    // Now that we know which package we should resolve to, we only have to find out the file location

    if (subPath) {
      unqualifiedPath = path.resolve(dependencyLocation, subPath);
    } else {
      unqualifiedPath = dependencyLocation;
    }
  }

  return path.normalize(unqualifiedPath);
};

/**
 * Transforms an unqualified path into a qualified path by using the Node resolution algorithm (which automatically
 * appends ".js" / ".json", and transforms directory accesses into "index.js").
 */

exports.resolveUnqualified = function resolveUnqualified(
  unqualifiedPath,
  {extensions = Object.keys(Module._extensions)} = {}
) {
  const qualifiedPath = applyNodeExtensionResolution(unqualifiedPath, {extensions});

  if (qualifiedPath) {
    return path.normalize(qualifiedPath);
  } else {
    throw makeError(
      `QUALIFIED_PATH_RESOLUTION_FAILED`,
      `Couldn't find a suitable Node resolution for unqualified path "${unqualifiedPath}"`,
      {unqualifiedPath}
    );
  }
};

/**
 * Transforms a request into a fully qualified path.
 *
 * Note that it is extremely important that the `issuer` path ends with a forward slash if the issuer is to be
 * treated as a folder (ie. "/tmp/foo/" rather than "/tmp/foo" if "foo" is a directory). Otherwise relative
 * imports won't be computed correctly (they'll get resolved relative to "/tmp/" instead of "/tmp/foo/").
 */

exports.resolveRequest = function resolveRequest(request, issuer, {considerBuiltins, extensions} = {}) {
  let unqualifiedPath;

  try {
    unqualifiedPath = exports.resolveToUnqualified(request, issuer, {considerBuiltins});
  } catch (originalError) {
    // If we get a BUILTIN_NODE_RESOLUTION_FAIL error there, it means that we've had to use the builtin node
    // resolution, which usually shouldn't happen. It might be because the user is trying to require something
    // from a path loaded through a symlink (which is not possible, because we need something normalized to
    // figure out which package is making the require call), so we try to make the same request using a fully
    // resolved issuer and throws a better and more actionable error if it works.
    if (originalError.code === `BUILTIN_NODE_RESOLUTION_FAIL`) {
      let realIssuer;

      try {
        realIssuer = realpathSync(issuer);
      } catch (error) {}

      if (realIssuer) {
        if (issuer.endsWith(`/`)) {
          realIssuer = realIssuer.replace(/\/?$/, `/`);
        }

        try {
          exports.resolveToUnqualified(request, realIssuer, {considerBuiltins});
        } catch (error) {
          // If an error was thrown, the problem doesn't seem to come from a path not being normalized, so we
          // can just throw the original error which was legit.
          throw originalError;
        }

        // If we reach this stage, it means that resolveToUnqualified didn't fail when using the fully resolved
        // file path, which is very likely caused by a module being invoked through Node with a path not being
        // correctly normalized (ie you should use "node $(realpath script.js)" instead of "node script.js").
        throw makeError(
          `SYMLINKED_PATH_DETECTED`,
          `A pnp module ("${request}") has been required from what seems to be a symlinked path ("${issuer}"). This is not possible, you must ensure that your modules are invoked through their fully resolved path on the filesystem (in this case "${realIssuer}").`,
          {
            request,
            issuer,
            realIssuer,
          }
        );
      }
    }
    throw originalError;
  }

  if (unqualifiedPath === null) {
    return null;
  }

  try {
    return exports.resolveUnqualified(unqualifiedPath, {extensions});
  } catch (resolutionError) {
    if (resolutionError.code === 'QUALIFIED_PATH_RESOLUTION_FAILED') {
      Object.assign(resolutionError.data, {request, issuer});
    }
    throw resolutionError;
  }
};

/**
 * Setups the hook into the Node environment.
 *
 * From this point on, any call to `require()` will go through the "resolveRequest" function, and the result will
 * be used as path of the file to load.
 */

exports.setup = function setup() {
  // A small note: we don't replace the cache here (and instead use the native one). This is an effort to not
  // break code similar to "delete require.cache[require.resolve(FOO)]", where FOO is a package located outside
  // of the Yarn dependency tree. In this case, we defer the load to the native loader. If we were to replace the
  // cache by our own, the native loader would populate its own cache, which wouldn't be exposed anymore, so the
  // delete call would be broken.

  const originalModuleLoad = Module._load;

  Module._load = function(request, parent, isMain) {
    if (!enableNativeHooks) {
      return originalModuleLoad.call(Module, request, parent, isMain);
    }

    // Builtins are managed by the regular Node loader

    if (builtinModules.has(request)) {
      try {
        enableNativeHooks = false;
        return originalModuleLoad.call(Module, request, parent, isMain);
      } finally {
        enableNativeHooks = true;
      }
    }

    // The 'pnpapi' name is reserved to return the PnP api currently in use by the program

    if (request === `pnpapi`) {
      return pnpModule.exports;
    }

    // Request `Module._resolveFilename` (ie. `resolveRequest`) to tell us which file we should load

    const modulePath = Module._resolveFilename(request, parent, isMain);

    // Check if the module has already been created for the given file

    const cacheEntry = Module._cache[modulePath];

    if (cacheEntry) {
      return cacheEntry.exports;
    }

    // Create a new module and store it into the cache

    const module = new Module(modulePath, parent);
    Module._cache[modulePath] = module;

    // The main module is exposed as global variable

    if (isMain) {
      process.mainModule = module;
      module.id = '.';
    }

    // Try to load the module, and remove it from the cache if it fails

    let hasThrown = true;

    try {
      module.load(modulePath);
      hasThrown = false;
    } finally {
      if (hasThrown) {
        delete Module._cache[modulePath];
      }
    }

    // Some modules might have to be patched for compatibility purposes

    for (const [filter, patchFn] of patchedModules) {
      if (filter.test(request)) {
        module.exports = patchFn(exports.findPackageLocator(parent.filename), module.exports);
      }
    }

    return module.exports;
  };

  const originalModuleResolveFilename = Module._resolveFilename;

  Module._resolveFilename = function(request, parent, isMain, options) {
    if (!enableNativeHooks) {
      return originalModuleResolveFilename.call(Module, request, parent, isMain, options);
    }

    let issuers;

    if (options) {
      const optionNames = new Set(Object.keys(options));
      optionNames.delete('paths');

      if (optionNames.size > 0) {
        throw makeError(
          `UNSUPPORTED`,
          `Some options passed to require() aren't supported by PnP yet (${Array.from(optionNames).join(', ')})`
        );
      }

      if (options.paths) {
        issuers = options.paths.map(entry => `${path.normalize(entry)}/`);
      }
    }

    if (!issuers) {
      const issuerModule = getIssuerModule(parent);
      const issuer = issuerModule ? issuerModule.filename : `${process.cwd()}/`;

      issuers = [issuer];
    }

    let firstError;

    for (const issuer of issuers) {
      let resolution;

      try {
        resolution = exports.resolveRequest(request, issuer);
      } catch (error) {
        firstError = firstError || error;
        continue;
      }

      return resolution !== null ? resolution : request;
    }

    throw firstError;
  };

  const originalFindPath = Module._findPath;

  Module._findPath = function(request, paths, isMain) {
    if (!enableNativeHooks) {
      return originalFindPath.call(Module, request, paths, isMain);
    }

    for (const path of paths || []) {
      let resolution;

      try {
        resolution = exports.resolveRequest(request, path);
      } catch (error) {
        continue;
      }

      if (resolution) {
        return resolution;
      }
    }

    return false;
  };

  process.versions.pnp = String(exports.VERSIONS.std);
};

exports.setupCompatibilityLayer = () => {
  // ESLint currently doesn't have any portable way for shared configs to specify their own
  // plugins that should be used (https://github.com/eslint/eslint/issues/10125). This will
  // likely get fixed at some point, but it'll take time and in the meantime we'll just add
  // additional fallback entries for common shared configs.

  for (const name of [`react-scripts`]) {
    const packageInformationStore = packageInformationStores.get(name);
    if (packageInformationStore) {
      for (const reference of packageInformationStore.keys()) {
        fallbackLocators.push({name, reference});
      }
    }
  }

  // Modern versions of `resolve` support a specific entry point that custom resolvers can use
  // to inject a specific resolution logic without having to patch the whole package.
  //
  // Cf: https://github.com/browserify/resolve/pull/174

  patchedModules.push([
    /^\.\/normalize-options\.js$/,
    (issuer, normalizeOptions) => {
      if (!issuer || issuer.name !== 'resolve') {
        return normalizeOptions;
      }

      return (request, opts) => {
        opts = opts || {};

        if (opts.forceNodeResolution) {
          return opts;
        }

        opts.preserveSymlinks = true;
        opts.paths = function(request, basedir, getNodeModulesDir, opts) {
          // Extract the name of the package being requested (1=full name, 2=scope name, 3=local name)
          const parts = request.match(/^((?:(@[^\/]+)\/)?([^\/]+))/);

          // make sure that basedir ends with a slash
          if (basedir.charAt(basedir.length - 1) !== '/') {
            basedir = path.join(basedir, '/');
          }
          // This is guaranteed to return the path to the "package.json" file from the given package
          const manifestPath = exports.resolveToUnqualified(`${parts[1]}/package.json`, basedir);

          // The first dirname strips the package.json, the second strips the local named folder
          let nodeModules = path.dirname(path.dirname(manifestPath));

          // Strips the scope named folder if needed
          if (parts[2]) {
            nodeModules = path.dirname(nodeModules);
          }

          return [nodeModules];
        };

        return opts;
      };
    },
  ]);
};

if (module.parent && module.parent.id === 'internal/preload') {
  exports.setupCompatibilityLayer();

  exports.setup();
}

if (process.mainModule === module) {
  exports.setupCompatibilityLayer();

  const reportError = (code, message, data) => {
    process.stdout.write(`${JSON.stringify([{code, message, data}, null])}\n`);
  };

  const reportSuccess = resolution => {
    process.stdout.write(`${JSON.stringify([null, resolution])}\n`);
  };

  const processResolution = (request, issuer) => {
    try {
      reportSuccess(exports.resolveRequest(request, issuer));
    } catch (error) {
      reportError(error.code, error.message, error.data);
    }
  };

  const processRequest = data => {
    try {
      const [request, issuer] = JSON.parse(data);
      processResolution(request, issuer);
    } catch (error) {
      reportError(`INVALID_JSON`, error.message, error.data);
    }
  };

  if (process.argv.length > 2) {
    if (process.argv.length !== 4) {
      process.stderr.write(`Usage: ${process.argv[0]} ${process.argv[1]} <request> <issuer>\n`);
      process.exitCode = 64; /* EX_USAGE */
    } else {
      processResolution(process.argv[2], process.argv[3]);
    }
  } else {
    let buffer = '';
    const decoder = new StringDecoder.StringDecoder();

    process.stdin.on('data', chunk => {
      buffer += decoder.write(chunk);

      do {
        const index = buffer.indexOf('\n');
        if (index === -1) {
          break;
        }

        const line = buffer.slice(0, index);
        buffer = buffer.slice(index + 1);

        processRequest(line);
      } while (true);
    });
  }
}
