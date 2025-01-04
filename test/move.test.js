'use strict'

import fs from 'node:fs';
import assert from 'node:assert';
import crypto from 'node:crypto';
import mkdirx from '../index.js';

describe('testing mkdirx.move()', () => {
  const baseDir = `.tmp-${crypto.randomBytes(8).toString('hex')}`;

  it('move regular file', async () => {
    await mkdirx(baseDir, {
      'from.txt': mkdirx.file(),
      'to.txt': mkdirx.move('from.txt'),
    });
    assert(fs.statSync(`${baseDir}/to.txt`).isFile());
  });

  it('move regular file that are in nested directories', async () => {
    await mkdirx(baseDir, {
      '1/a/b/from.txt': mkdirx.file(),
      '2/a/b/to.txt': mkdirx.move('../../../1/a/b/from.txt'),
    });
    assert(fs.statSync(`${baseDir}/2/a/b/to.txt`).isFile());
  });

  it('move nested directories', async () => {
    await mkdirx(baseDir, {
      '1/a/a/file1.txt': mkdirx.file(),
      '1/a/a/file2.txt': mkdirx.file(),
      '1/a/file3.txt': mkdirx.file(),
      '1/a/a/b': mkdirx.dir(),
      '2/a': mkdirx.move('../1'),
    });
    assert(fs.statSync(`${baseDir}/2/a`).isDirectory());
  });

  afterEach(() => fs.rmSync(baseDir, { recursive: true }));
});