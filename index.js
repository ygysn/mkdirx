import pathutils from 'node:path';
import fs from 'node:fs';
import fsp from 'node:fs/promises';

function mkdirWhenNotExists(path) {
  if (!fs.existsSync(path) && path !== '.') {
    return fsp.mkdir(path, { recursive: true });
  }
}

function isRegularObject(v) {
  return typeof v === 'object' && !Array.isArray(v) && v !== null;
}

function joinFilePath(basePath, filePath, forceRelative) {
  return pathutils.isAbsolute(filePath) && !forceRelative
    ? filePath
    : pathutils.join(basePath, filePath);
}

function resolveDestinationToTarget(basePath, dest, target) {
  return joinFilePath(
    basePath,
    joinFilePath(pathutils.dirname(dest), target, true),
    false,
  );
}

const pathsList = {};

/** Helper function to create a symbol that represents paths */
export function paths() {
  const args = Object.values(arguments);
  const pathsKey = Symbol(args.map(p => `"${p.replace('\\', '\\\\').replace('"', '\\"')}"`).join(' '));
  pathsList[pathsKey] = args;
  return pathsKey;
}

/** Directive to create a new directive */
function CustomDirective(func, props = {}) {
  if (typeof func !== 'function' || !isRegularObject(props)) {
    throw new TypeError('Invalid argument passed to CustomDirective');
  }

  this.$action = 'custom';
  this.function = func.bind({});
  this.props = props;
}

CustomDirective.prototype.exec = function(basePath, filePath, options) {
  return this.function(this.props, basePath, filePath, options);
}


/** Directive to create a new directive when creating a file or directory */
function LazyDirective(func) {
  if (typeof func !== 'function') {
    throw new TypeError('Invalid argument passed to LazyDirective');
  }

  this.$action = 'lazy';
  this.function = func;
}

LazyDirective.prototype.exec = async function(basePath, filePath, options) {
  await (await this.function(basePath, filePath, options)).exec(basePath, filePath, options);
}

/** Directive to move a file or directory to a path inside the base directory */
function MoveDirective(target) {
  if (typeof target !== 'string') {
    throw new TypeError('Invalid argument passed to MoveDirective');
  }

  this.$action = 'move';
  this.skipable = false;
  this.target = target;
}

MoveDirective.prototype.exec = function(basePath, filePath) {
  const path = joinFilePath(basePath, filePath, true);
  const target = resolveDestinationToTarget(basePath, filePath, this.target);
  return fsp.rename(target, path);
}

/** Directive to copy a file or directory to a path inside the base directory */
function CopyDirective(target) {
  if (typeof target !== 'string') {
    throw new TypeError('Invalid argument passed to CopyDirective');
  }

  this.$action = 'copy';
  this.skipable = false;
  this.target = target;
  this.dereferenceSymlink = false;
  this.filter = () => true;
  this.recursive = true;
  this.preserveTimestamps = false;
}

CopyDirective.prototype.$dereferenceSymlink = function(dereferenceSymlink) {
  if (typeof dereferenceSymlink !== 'boolean') {
    throw new TypeError('Invalid argument passed to MoveDirective.$dereferenceSymlink');
  }

  this.dereferenceSymlink = dereferenceSymlink;
  return this;
}

CopyDirective.prototype.$filter = function(filter) {
  if (typeof filter !== 'function') {
    throw new TypeError('Invalid argument passed to MoveDirective.$filter');
  }

  this.filter = filter;
  return this;
}

CopyDirective.prototype.$recursive = function(recursive) {
  if (typeof recursive !== 'boolean') {
    throw new TypeError('Invalid argument passed to MoveDirective.$recursive');
  }

  this.recursive = recursive;
  return this;
}

CopyDirective.prototype.$preserveTimestamps = function(preserveTimestamps) {
  if (typeof preserveTimestamps !== 'boolean') {
    throw new TypeError('Invalid argument passed to MoveDirective.$preserveTimestamps');
  }

  this.preserveTimestamps = preserveTimestamps;
}

CopyDirective.prototype.exec = function(basePath, filePath) {
  const path = joinFilePath(basePath, filePath, true);
  const target = resolveDestinationToTarget(basePath, filePath, this.target);
  return fsp.cp(target, path, {
    dereference: this.dereferenceSymlink,
    filter: this.filter,
    recursive: this.recursive,
    preserveTimestamps: this.preserveTimestamps,
  });
}

/** Directive to create file, directory, symlink or hardlink inside the base directory */
function CreateDirective(type, mode, owner) {
  this.$action = 'create';
  this.skipable = false;
  this.type = type;
  this.mode = mode;
  this.owner = owner;
}

CreateDirective.prototype.$mode = function(mode) {
  if (typeof mode !== 'number') {
    throw new TypeError(`Invalid argument passed to ${this.type[0].toUpperCase}${this.type.slice(1)}Directive.$mode`);
  }

  this.mode = mode;
  return this;
}

CreateDirective.prototype.$owner = function(uid, gid) {
  if (typeof uid !== 'number' || typeof gid !== 'number') {
    throw new TypeError(`Invalid argument passed to ${this.type[0].toUpperCase}${this.type.slice(1)}Directive.$owner`);
  }

  this.owner = { uid, gid };
  return this;
}

CreateDirective.prototype.applyFile = async function(file) {
  if (typeof this.owner?.uid === 'number' && typeof this.owner?.gid === 'number') {
    await file.chown(this.owner.uid, this.owner.gid);
  }

  if (typeof this.mode === 'number') {
    await file.chmod(this.mode);
  }
}

CreateDirective.prototype.applyPath = async function(path) {
  if (typeof this.owner?.uid === 'number' && typeof this.owner?.gid === 'number') {
    await fsp.chown(path, this.owner.uid, this.owner.gid);
  }

  if (typeof this.mode === 'number') {
    await fsp.chmod(path, this.mode);
  }
}

/** Directive to create file inside the base directory */
function FileDirective() {
  CreateDirective.call(this, 'file', undefined, undefined);
  this.skipable = false;
  this.content = Buffer.alloc(0);
}

Object.setPrototypeOf(FileDirective.prototype, CreateDirective.prototype);
FileDirective.prototype.$write = function(data) {
  if (typeof data !== 'string' && !(data instanceof Buffer)) {
    throw new TypeError(`Invalid argument passed to FileDirective.$write`);
  }

  this.content = Buffer.from(data);
  return this;
}

FileDirective.prototype.$append = function(data) {
  if (typeof data !== 'string' && !(data instanceof Buffer)) {
    throw new TypeError(`Invalid argument passed to FileDirective.$append`);
  }

  const buff = Buffer.from(data);
  this.content = Buffer.concat([this.content, buff], this.content.length + buff.length);
  return this;
}

FileDirective.prototype.exec = async function(basePath, filePath) {
  const path = joinFilePath(basePath, filePath, true);
  const file = await fsp.open(path, 'w')
  await file.write(this.content);
  await this.applyFile(file);
  await file.close();
}

/** Directive to create directory inside the base directory */
function DirectoryDirective(files) {
  CreateDirective.call(this, 'directory', undefined, undefined);
  this.skipable = false;
  this.files = files ?? {};
}

DirectoryDirective.prototype.$expand = function(files) {
  if (!isRegularObject(files)) {
    throw new TypeError(`Invalid argument passed to DirectoryDirective.$expand`);
  }

  this.files = Object.assign({}, this.files, files);
  return this;
}

DirectoryDirective.prototype.exec = async function(basePath, dirPath, options) {
  const path = joinFilePath(basePath, dirPath, true);
  await mkdirx(path, this.files, Object.assign(options, {
    force: true,
  }));
}

/** Directive to create symlink inside the base directory */
function SymlinkDirective(target, symlinkType = 'file') {
  CreateDirective.call(this, 'symlink', undefined, undefined);
  this.skipable = false;
  this.target = target;
  this.symlinkType = symlinkType;

}

SymlinkDirective.prototype.$symlinkType = function(symlinkType) {
  if (!['dir', 'file', 'junction', null].includes(symlinkType)) {
    throw new TypeError(`Invalid argument passed to FileDirective.$symlinkType`);
  }

  this.symlinkType = symlinkType ?? 'file';
  return this;
}

SymlinkDirective.prototype.exec = async function(basePath, filePath) {
  const path = joinFilePath(basePath, filePath, true);
  await fsp.symlink(this.target, path, this.symlinkType);
}

/** Directive to create hardlink inside the base directory */
function HardLinkDirective(target) {
  CreateDirective.call(this, 'hardlink', undefined, undefined);
  this.skipable = false;
  this.target = target;
}

HardLinkDirective.prototype.exec = async function(basePath, filePath) {
  const path = joinFilePath(basePath, filePath, false);
  const target = resolveDestinationToTarget(basePath, filePath, this.target);
  await fsp.link(target, path);
}

/** Helper function to create CustomDirective */
export function custom(func, props) {
  return new CustomDirective(func, props);
}

/** Helper function to create LazyDirective */
export function lazy(func) {
  return new LazyDirective(func);
}

/** Helper function to create MoveDirective */
export function move(from, to) {
  return new MoveDirective(from, to);
}

/** Helper function to create CopyDirective */
export function copy(from, to) {
  return new CopyDirective(from, to);
}

/** Helper function to create FileDirective */
export function file() {
  return new FileDirective();
}

/** Helper function to create DirectoryDirective */
export function dir(files) {
  return new DirectoryDirective(files);
}

/** Helper function to create SymlinkDirective */
export function symlink(target, symlinkType) {
  return new SymlinkDirective(target, symlinkType);
}

/** Helper function to create HardLinkDirective */
export function link(target) {
  return new HardLinkDirective(target);
}

/** Create directories and files based on object mappings between filenames and directives */
export async function mkdirx(basePath, files, options = {}) {
  if (typeof basePath !== 'string' || !basePath || !isRegularObject(files) || !isRegularObject(options)) {
    throw new Error('Invalid arguments passed to mkdirx');
  } else if (fs.existsSync(basePath) && !options.force) {
    throw new Error(`${basePath} directory already exists`);
  }

  const tmpFiles = Object.assign({}, files);
  for (const pathsSymbol of Object.getOwnPropertySymbols(files)) {
    const fileInfo = files[pathsSymbol];
    if (!pathsList[pathsSymbol]) {
      throw new TypeError(`Invalid path, '${pathsSymbol.toString()}' is unknown`);
    }

    for (const fileName of pathsList[pathsSymbol]) {
      if (tmpFiles[fileName]) {
        throw new Error(`${fileName} is duplicate`);
      }
      tmpFiles[fileName] = fileInfo;
    }
    delete tmpFiles[pathsSymbol];
    delete pathsList[pathsSymbol];
  }

  await mkdirWhenNotExists(basePath);
  const executePromises = [];
  for (const filePath of Object.keys(tmpFiles)) {
    const fileDirective = tmpFiles[filePath];
    if (typeof fileDirective.$type !== 'string' && typeof fileDirective.exec !== 'function') {
      throw new TypeError('Invalid object files');
    }

    await mkdirWhenNotExists(pathutils.dirname(pathutils.join(basePath, filePath)));
    if (fileDirective.skipable) {
      executePromises.push(fileDirective.exec(basePath, filePath, options));
    } else {
      await fileDirective.exec(basePath, filePath, options);
    }
  }

  if (executePromises.length !== 0) {
    await Promise.all(executePromises);
  }
}

mkdirx.paths = paths;
mkdirx.custom = custom;
mkdirx.lazy = lazy;
mkdirx.move = move;
mkdirx.copy = copy;
mkdirx.file = file;
mkdirx.dir = dir;
mkdirx.symlink = symlink;
mkdirx.link = link;

export default mkdirx;
