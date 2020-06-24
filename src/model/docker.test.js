import Action from './action';
import Docker from './docker';
import ImageTag from './image-tag';

describe('Docker', () => {
  it('builds', async () => {
    const path = Action.actionFolder;
    const dockerfile = `${path}/Dockerfile`;
    const baseImage = new ImageTag({
      repository: '',
      name: 'alpine',
      version: '3',
      platform: 'Test',
    });

    const tag = await Docker.build({ path, dockerfile, baseImage }, true);

    expect(tag).toBeInstanceOf(ImageTag);
    expect(tag.toString()).toStrictEqual('unity-builder:3');
  }, 240000);

  it.skip('runs', async () => {
    const image = 'unity-builder:2019.2.11f1-webgl';

    const parameters = {
      workspace: Action.rootFolder,
      projectPath: `${Action.rootFolder}/test-project`,
      buildName: 'someBuildName',
      buildsPath: 'build',
      method: '',
    };

    await Docker.run(image, parameters);
  });
});
