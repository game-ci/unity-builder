# Unity - Builder

[![Actions status](https://github.com/webbertakken/unity-builder/workflows/Actions%20%F0%9F%98%8E/badge.svg)](https://github.com/webbertakken/unity-builder/actions?query=branch%3Amaster+workflow%3A%22Actions+%F0%9F%98%8E%22)

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
name: Build project
on: [push]
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
        targetPlatform:
          - WebGL
          - iOS
    steps:
      - uses: actions/checkout@v1
      - uses: webbertakken/unity-activate@v1
      - uses: webbertakken/unity-builder@v0.3
        with:
          projectPath: ${{ matrix.projectPath }}
          unityVersion: ${{ matrix.unityVersion }}
          targetPlatform: ${{ matrix.targetPlatform }}
      - uses: webbertakken/unity-return-license@v1
        if: always()
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

_**required:** `true`_

#### buildName

Name of the build.

_**required:** `false`_
_**default:** `testBuild`_

#### buildsPath

Path where the builds should be stored.

In this folder a folder will be created for every targetPlatform.

_**required:** `false`_
_**default:** `build`_

#### buildCommand

Custom command to run your build.

There are two conditions for a custom buildCommand:

- Must reference a valid path to a `static` method.
- The class must reside in the `Assets/Editor` directory.

_**example:**_

```yaml
- uses: webbertakken/unity-builder@master
  with:
    buildCommand: EditorNamespace.BuilderClassName.StaticBulidMethod
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
