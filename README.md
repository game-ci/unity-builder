# Unity - Builder

[![Actions status](https://github.com/webbertakken/unity-builder/workflows/Actions/badge.svg?event=push&branch=master)](https://github.com/webbertakken/unity-builder/actions?query=branch%3Amaster+event%3Apush+workflow%3A%22Actions)
[![lgtm - code quality](https://img.shields.io/lgtm/grade/javascript/g/webbertakken/unity-builder.svg?logo=lgtm&logoWidth=18)](https://lgtm.com/projects/g/webbertakken/unity-builder/context:javascript)
[![codecov - test coverage](https://codecov.io/gh/webbertakken/unity-builder/branch/master/graph/badge.svg)](https://codecov.io/gh/webbertakken/unity-builder)

---

GitHub Action to
[build Unity projects](https://github.com/marketplace/actions/unity-builder)
for different platforms.

Part of the
[Unity Actions](https://github.com/webbertakken/unity-actions)
collection.

---

[Github Action](https://github.com/features/actions)
to build Unity projects for different platforms.

It is recommended to run the
[Test](https://github.com/webbertakken/unity-actions#test)
action from the
[Unity Actions](https://github.com/webbertakken/unity-actions)
collection before running this action. This action also requires the [Activation](https://github.com/marketplace/actions/unity-activate) step.

## Documentation

See the
[Unity Actions](https://github.com/webbertakken/unity-actions)
collection repository for workflow documentation and reference implementation.

## Usage

#### Setup builder

By default the enabled scenes from the project's settings will be built.

Create or edit the file called `.github/workflows/main.yml` and add a job to it.

##### Personal License

Personal licenses require a one-time manual activation step (per unity version).

Make sure you
[acquire and activate](https://github.com/marketplace/actions/unity-request-activation-file)
your license file and add it as a secret.

Then, define the build step as follows:

```yaml
- uses: webbertakken/unity-builder@<version>
  env:
    UNITY_LICENSE: ${{ secrets.UNITY_LICENSE }}
  with:
    projectPath: path/to/your/project
    unityVersion: 2020.X.XXXX
    targetPlatform: WebGL
```

##### Professional license

Professional licenses do not need any manual steps.

Instead, three variables will need to be set.

- `UNITY_EMAIL` (should contain the email address for your Unity account)
- `UNITY_PASSWORD` (the password that you use to login to Unity)
- `UNITY_SERIAL` (the serial provided by Unity)

Define the build step as follows:

```yaml
- uses: webbertakken/unity-builder@<version>
  env:
    UNITY_EMAIL: ${{ secrets.UNITY_EMAIL }}
    UNITY_PASSWORD: ${{ secrets.UNITY_PASSWORD }}
    UNITY_SERIAL: ${{ secrets.UNITY_SERIAL }}
  with:
    projectPath: path/to/your/project
    unityVersion: 2020.X.XXXX
    targetPlatform: WebGL
```

That is all you need to build your project.

#### Storing the build

To be able to access your built files,
they need to be uploaded as artifacts.
To do this it is recommended to use Github Actions official
[upload artifact action](https://github.com/marketplace/actions/upload-artifact)
after any build action.

By default, Builder outputs it's builds to a folder named `build`.

Example:

```yaml
- uses: actions/upload-artifact@v1
  with:
    name: Build
    path: build
```

Builds can now be downloaded as Artifacts in the Actions tab.

#### Caching

In order to make builds run faster, you can cache Library files from previous
builds. To do so simply add Github Actions official
[cache action](https://github.com/marketplace/actions/cache) before any unity steps.

Example:

```yaml
- uses: actions/cache@v1.1.0
  with:
    path: path/to/your/project/Library
    key: Library-MyProjectName-TargetPlatform
    restore-keys: |
      Library-MyProjectName-
      Library-
```

This simple addition could speed up your build by more than 50%.

## Complete example

A complete workflow that builds every available platform could look like this:

```yaml
name: Build project

on:
  pull_request: {}
  push: { branches: [master] }

env:
  UNITY_LICENSE: ${{ secrets.UNITY_LICENSE }}

jobs:
  buildForSomePlatforms:
    name: Build for ${{ matrix.targetPlatform }} on version ${{ matrix.unityVersion }}
    runs-on: ubuntu-latest
    strategy:
      fail-fast: false
      matrix:
        projectPath:
          - path/to/your/project
        unityVersion:
          - 2019.2.11f1
          - 2019.3.0f1
        targetPlatform:
          - StandaloneOSX # Build a macOS standalone (Intel 64-bit).
          - StandaloneWindows # Build a Windows standalone.
          - StandaloneWindows64 # Build a Windows 64-bit standalone.
          - StandaloneLinux64 # Build a Linux 64-bit standalone.
          - iOS # Build an iOS player.
          - Android # Build an Android .apk standalone app.
          - WebGL # WebGL.
          - WSAPlayer # Build an Windows Store Apps player.
          - PS4 # Build a PS4 Standalone.
          - XboxOne # Build a Xbox One Standalone.
          - tvOS # Build to Apple's tvOS platform.
          - Switch # Build a Nintendo Switch player.
    steps:
      - uses: actions/checkout@v2
        with:
          lfs: true
      - uses: actions/cache@v1.1.0
        with:
          path: ${{ matrix.projectPath }}/Library
          key: Library-${{ matrix.projectPath }}-${{ matrix.targetPlatform }}
          restore-keys: |
            Library-${{ matrix.projectPath }}-
            Library-
      - uses: webbertakken/unity-builder@<version>
        with:
          projectPath: ${{ matrix.projectPath }}
          unityVersion: ${{ matrix.unityVersion }}
          targetPlatform: ${{ matrix.targetPlatform }}
      - uses: actions/upload-artifact@v1
        with:
          name: Build
          path: build
```

> **Note:** _Environment variables are set for all jobs in the workflow like this._

## Configuration options

Below options can be specified under `with:` for the `unity-builder` action.

#### projectPath

Specify the path to your Unity project to be built.
The path should be relative to the root of your project.

_**required:** `false`_
_**default:** `<your project root>`_

#### unityVersion

Version of Unity to use for building the project.

_**required:** `false`_
_**default:** `2019.2.1f11`_

#### targetPlatform

Platform that the build should target.

Must be one of the [allowed values](https://docs.unity3d.com/ScriptReference/BuildTarget.html) listed in the Unity scripting manual.

_**required:** `true`_

#### buildName

Name of the build. Also the folder in which the build will be stored within `buildsPath`.

_**required:** `false`_
_**default:** `<build_target>`_

#### buildsPath

Path where the builds should be stored.

In this folder a folder will be created for every targetPlatform.

_**required:** `false`_
_**default:** `build`_

#### buildMethod

Custom command to run your build.

There are two conditions for a custom buildCommand:

- Must reference a valid path to a `static` method.
- The class must reside in the `Assets/Editor` directory.

_**example:**_

```yaml
- uses: webbertakken/unity-builder@<version>
  with:
    buildMethod: EditorNamespace.BuilderClassName.StaticBulidMethod
```

_**required:** `false`_
_**default:** Built-in script that will run a build out of the box._

#### versioning

Configure a specific versioning strategy

```yaml
- uses: webbertakken/unity-builder@<version>
  with:
    versioning: Semantic
```

Find the available strategies below:

##### Semantic

Versioning out of the box! **(recommended)**

> Compatible with **all platforms**.
> Does **not** modify your repository.
> Requires **zero configuration**.

How it works:

> Generates a version based on [semantic versioning](https://semver.org/).
> Follows `<major>.<minor>.<patch>` for example `0.17.2`.
> The latest tag dictates `<major>.<minor>` (defaults to 0.0 for no tag).
> The number of commits (since the last tag, if any) is used for `<patch>`.

No configuration required.

##### Custom

Allows specifying a custom version in the `version` field. **(advanced users)**

> This strategy is useful when your project or pipeline has some kind of orchestration
> that determines the versions.

##### None

No version will be set by Builder. **(not recommended)**

> Not recommended unless you generate a new version in a pre-commit hook. Manually
> setting versions is error-prone.

#### allowDirtyBuild

Allows the branch of the build to be dirty, and still generate the build.

```yaml
- uses: webbertakken/unity-builder@<version>
  with:
    allowDirtyBuild: true
```

Note that it is generally bad practice to modify your branch
in a CI Pipeline. However there are exceptions where this might
be needed. (use with care).

#### customParameters

Custom parameters to configure the build.

Parameters must start with a hyphen (`-`) and may be followed by a value (without hyphen).

Parameters without a value will be considered booleans (with a value of true).

_**example:**_

```yaml
- uses: webbertakken/unity-builder@<version>
  with:
    customParameters: -profile SomeProfile -someBoolean -someValue exampleValue
```

_**required:** `false`_
_**default:** ""_

## More actions

Visit
[Unity Actions](https://github.com/webbertakken/unity-actions)
to find related actions for Unity.

Feel free to contribute.

## Licence

[MIT](./LICENSE)
