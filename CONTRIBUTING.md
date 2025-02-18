# Contributing

## How to Contribute

#### Code of Conduct

This repository has adopted the Contributor Covenant as it's Code of Conduct. It is expected that participants adhere to
it.

#### Proposing a Change

If you are unsure about whether or not a change is desired, you can create an issue. This is useful because it creates
the possibility for a discussion that's visible to everyone.

When fixing a bug it is fine to submit a pull request right away.

#### Sending a Pull Request

Steps to be performed to submit a pull request:

1. Fork the repository and create your branch from `main`.
2. Run `yarn` in the repository root.
3. If you've fixed a bug or added code that should be tested, add tests!
4. Fill out the description, link any related issues and submit your pull request.

#### Pull Request Prerequisites

You have [Node](https://nodejs.org/) installed at v18+ and [Yarn](https://yarnpkg.com/) at v1.22.0+.

Please note that commit hooks will run automatically to perform some tasks;

- format your code
- run tests
- build distributable files

#### Windows users

Make sure your editor and terminal that run the tests are set to `Powershell 7` or above with
`Git's Unix tools for Windows` installed. This is because some tests require you to be able to run `sh` and other unix
commands.

#### Development Containers

This project supports development containers (dev containers) which provide a consistent, pre-configured development
environment. Using dev containers is recommended as it ensures all contributors work with the same development setup.

To use dev containers:

1. Install [Docker Desktop](https://www.docker.com/products/docker-desktop/)
2. Install the
   [Dev Containers extension](https://marketplace.visualstudio.com/items?itemName=ms-vscode-remote.remote-containers) in
   VS Code
3. Clone the repository and open it in VS Code
4. When prompted, click "Reopen in Container" or use the command palette (F1) and select "Dev Containers: Reopen in
   Container"

The dev container will automatically:

- Set up Node.js and TypeScript environment
- Install project dependencies using Yarn

This eliminates the need to manually install Node.js, Yarn, and other dependencies on your local machine.

#### License

By contributing to this repository, you agree that your contributions will be licensed under its MIT license.
