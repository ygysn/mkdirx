'use strict'

import assert from 'node:assert';
import mkdirx from '../index.js';

describe('testing mkdirx.custom()', () => {
  it('create a simple custom directive', async () => {
    let isSuccess = false;
    await mkdirx.custom(async function (props) {
      isSuccess = props.done;
    }, { done: true }).exec('', '');

    assert(isSuccess);
  });
});
