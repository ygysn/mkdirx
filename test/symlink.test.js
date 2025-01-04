import fs from 'node:fs';
import assert from 'node:assert';
import crypto from 'node:crypto';
import mkdirx from '../index.js';

describe('testing mkdirx.symlink()', () => {
  const baseDir = `.tmp-${crypto.randomBytes(8).toString('hex')}`;
  it(`create a simple symlink`, async () => {
    await mkdirx(baseDir, {
      target: mkdirx.dir(),
      symlink: mkdirx.symlink('target'),
    });

    const symlinkStat = fs.lstatSync(`${baseDir}/symlink`);
    assert(symlinkStat.isSymbolicLink());
  });

  it(`create symlinks in nested directories`, async () => {
    await mkdirx(baseDir, {
      '1/a/b/from': mkdirx.dir(),
      '2/a/b/to': mkdirx.symlink('../../../1/a/b/from'),
    });

    const symlinkStat = fs.lstatSync(`${baseDir}/2/a/b/to`);
    assert(symlinkStat.isSymbolicLink());
  });

  afterEach(() => fs.rmSync(baseDir, { recursive: true }));
});
