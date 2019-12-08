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
  buildForWebGL:
    name: Build for WebGL 🕸
    runs-on: ubuntu-latest
    steps:
```

Activate Unity in a step using the 
[Unity Activate](https://github.com/marketplace/actions/unity-activate)
action. 

Configure the builder as follows:

```yaml
      # Configure builder
      - name: Build project
        id: buildStep
        uses: webbertakken/unity-builder@v0.2 # WIP (only webgl for now)
        env:  
          # Optional: Path to your project, leave blank for "./"
          UNITY_PROJECT_PATH: path/to/your/project

          # Name for your build
          BUILD_NAME: TestBuild

          # Optional: Builds path, leave blank for "build"
          BUILDS_PATH: build

          # Target platform for your build
          BUILD_TARGET: WebGL

          # Optional: <StaticBuildClass.StaticMethod> 
          BUILD_METHOD: ""
```

> _**Note:** By default the enabled scenes from the 
project's settings will be built._

You use the id to **upload your built files** like so:

```yaml
      # Upload distributables
      - name: Upload Build
        uses: actions/upload-artifact@v1
        with:
          name: Build
          path: ${{ steps.buildStep.outputs.allBuildsPath }}
```

Return the Unity license in a final step using the 
[Unity Return License](https://github.com/marketplace/actions/unity-return-license)
action. 

Commit and push your workflow definition.

## More actions

Visit 
[Unity Actions](https://github.com/webbertakken/unity-actions) 
to find related actions for Unity.

Feel free to contribute.

## Licence 

[MIT](./LICENSE)
