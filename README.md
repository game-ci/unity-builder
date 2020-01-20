# Unity - Builder

[![Actions status](https://github.com/webbertakken/unity-builder/workflows/Actions%20%F0%9F%98%8E/badge.svg?event=push&branch=master)](https://github.com/webbertakken/unity-builder/actions?query=branch%3Amaster+event%3Apush+workflow%3A%22Actions+%F0%9F%98%8E%22)

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

Create or edit the file called `.github/workflows/main.yml` and add a job to it.

```yaml
- uses: webbertakken/unity-builder@v0.5
  env:
    UNITY_LICENSE: ${{ secrets.UNITY_LICENSE }}
  with:
    projectPath: path/to/your/project
    unityVersion: 2020.X.XXXX
    targetPlatform: WebGL
```

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
      - uses: actions/checkout@v1
      - uses: webbertakken/unity-builder@v0.5
        with:
          projectPath: ${{ matrix.projectPath }}
          unityVersion: ${{ matrix.unityVersion }}
          targetPlatform: ${{ matrix.targetPlatform }}
      - uses: actions/upload-artifact@v1
        with:
          name: Build
          path: build
```

> **Notes:**
>
> - Don't forget to replace _&lt;test-project&gt;_ with your project name.
> - By default the enabled scenes from the project's settings will be built.

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
- uses: webbertakken/unity-builder@master
  with:
    buildMethod: EditorNamespace.BuilderClassName.StaticBulidMethod
```

_**required:** `false`_
_**default:** Built-in script that will run a build out of the box._

## More actions

Visit
[Unity Actions](https://github.com/webbertakken/unity-actions)
to find related actions for Unity.

Feel free to contribute.

## Licence

[MIT](./LICENSE)
