import Action from './action';
import Docker from './docker';
import Image from './image';

describe('Docker', () => {
  it('builds', async () => {
    const tag = await Docker.build({
      // path: Action.rootFolder,
      dockerfile: `${Action.rootFolder}/Dockerfile`,
      image: new Image({ version: '2019.2.11f1', targetPlatform: 'WebGL' }),
    });

    expect(tag).toStrictEqual('unity-builder:2019.2.11f1-webgl');
  });
});
