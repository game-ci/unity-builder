# Unity - Builder

(Not affiliated with Unity Technologies)

GitHub Action to [build Unity projects](https://github.com/marketplace/actions/unity-builder) for different platforms.

Part of the <a href="https://game.ci">GameCI</a> open source project. <br /> <br />

[![Builds - Ubuntu](https://github.com/game-ci/unity-builder/actions/workflows/build-tests-ubuntu.yml/badge.svg)](https://github.com/game-ci/unity-builder/actions/workflows/build-tests-ubuntu.yml)
[![Builds - Windows](https://github.com/game-ci/unity-builder/actions/workflows/build-tests-windows.yml/badge.svg)](https://github.com/game-ci/unity-builder/actions/workflows/build-tests-windows.yml)
[![Builds - MacOS](https://github.com/game-ci/unity-builder/actions/workflows/build-tests-mac.yml/badge.svg)](https://github.com/game-ci/unity-builder/actions/workflows/build-tests-mac.yml)
[![codecov - test coverage](https://codecov.io/gh/game-ci/unity-builder/branch/master/graph/badge.svg)](https://codecov.io/gh/game-ci/unity-builder)
<br /> <br />

## How to use

Find the [docs](https://game.ci/docs/github/builder) on the GameCI [documentation website](https://game.ci/docs).

## Related actions

Visit the GameCI <a href="https://github.com/game-ci/unity-actions">Unity Actions</a> status repository for related
Actions.

## AWS provider with local emulator

The AWS provider can target a local AWS emulator such as [LocalStack](https://github.com/localstack/localstack).
Configure the endpoint URLs through environment variables before running tests or the action:

```
AWS_ENDPOINT=http://localhost:4566
AWS_ACCESS_KEY_ID=test
AWS_SECRET_ACCESS_KEY=test
```

When these variables are set, Unity Builder will direct its CloudFormation, ECS, Kinesis, CloudWatch Logs and S3 clients
to the emulator instead of the real AWS services. See `.github/workflows/cloud-runner-integrity-localstack.yml` for an
example configuration.

## Community

Feel free to join us on
<a href="http://game.ci/discord"><img height="30" src="media/Discord-Logo.svg" alt="Discord" /></a> and engage with the
community.

## Contributing

To help improve the documentation, please find the docs [repository](https://github.com/game-ci/documentation).

To contribute to Unity Builder, kindly read the [contribution guide](./CONTRIBUTING.md).

## Support us

GameCI is free for everyone forever.

You can support us at [OpenCollective](https://opencollective.com/game-ci).

## Licence

This repository is [MIT](./LICENSE) licensed.

This includes all contributions from the community.
