'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.ECPairFactory = void 0;
const utils_1 = require('@noble/hashes/utils');
const luckycoinjs_lib_1 = require('luckycoinjs-lib');
const wif = require('wif');
const types = require('./types');
const isOptions = types.typeforce.maybe(
  types.typeforce.compile({
    compressed: types.maybe(types.Boolean),
    network: types.maybe(types.Network),
  }),
);
const toXOnly = (pubKey) =>
  pubKey.length === 32 ? pubKey : pubKey.slice(1, 33);
function ECPairFactory(ecc) {
  function isPoint(maybePoint) {
    return ecc.isPoint(maybePoint);
  }
  function fromPrivateKey(buffer, options) {
    types.typeforce(types.Buffer256bit, buffer);
    if (!ecc.isPrivate(buffer))
      throw new TypeError('Private key not in range [1, n)');
    types.typeforce(isOptions, options);
    return new ECPair(buffer, undefined, options);
  }
  function fromPublicKey(buffer, options) {
    types.typeforce(ecc.isPoint, buffer);
    types.typeforce(isOptions, options);
    return new ECPair(undefined, buffer, options);
  }
  function fromWIF(wifString) {
    const decoded = wif.decode(wifString);
    const version = decoded.version;
    const network = luckycoinjs_lib_1.networks.luckycoin;
    if (version !== network.wif) throw new Error('Invalid network version');
    return fromPrivateKey(Buffer.from(decoded.privateKey), {
      compressed: decoded.compressed,
    });
  }
  function makeRandom(options) {
    types.typeforce(isOptions, options);
    if (options === undefined) options = {};
    const rng =
      options.rng || ((v) => Buffer.from((0, utils_1.randomBytes)(v)));
    let d;
    do {
      d = rng(32);
      types.typeforce(types.Buffer256bit, d);
    } while (!ecc.isPrivate(d));
    return fromPrivateKey(d, options);
  }
  class ECPair {
    __D;
    __Q;
    compressed;
    network;
    lowR;
    constructor(__D, __Q, options) {
      this.__D = __D;
      this.__Q = __Q;
      this.lowR = false;
      if (options === undefined) options = {};
      this.compressed =
        options.compressed === undefined ? true : options.compressed;
      this.network = luckycoinjs_lib_1.networks.luckycoin;
      if (__Q !== undefined)
        this.__Q = Buffer.from(ecc.pointCompress(__Q, this.compressed));
    }
    get privateKey() {
      return this.__D;
    }
    get publicKey() {
      if (!this.__Q) {
        const p = ecc.pointFromScalar(this.__D, this.compressed);
        this.__Q = Buffer.from(p);
      }
      return this.__Q;
    }
    toWIF() {
      if (!this.__D) throw new Error('Missing private key');
      return wif.encode(this.network.wif, this.__D, this.compressed);
    }
    tweak(t) {
      if (this.privateKey) return this.tweakFromPrivateKey(t);
      return this.tweakFromPublicKey(t);
    }
    sign(hash, _lowR) {
      if (!this.__D) throw new Error('Missing private key');
      return Buffer.from(
        ecc.sign(hash, this.__D, (0, utils_1.randomBytes)(32)),
      );
    }
    signSchnorr(hash) {
      if (!this.privateKey) throw new Error('Missing private key');
      if (!ecc.signSchnorr)
        throw new Error('signSchnorr not supported by ecc library');
      return Buffer.from(
        ecc.signSchnorr(hash, this.privateKey, (0, utils_1.randomBytes)(32)),
      );
    }
    verify(hash, signature) {
      return ecc.verify(hash, this.publicKey, signature);
    }
    verifySchnorr(hash, signature) {
      if (!ecc.verifySchnorr)
        throw new Error('verifySchnorr not supported by ecc library');
      return ecc.verifySchnorr(hash, this.publicKey.subarray(1, 33), signature);
    }
    tweakFromPublicKey(t) {
      const xOnlyPubKey = toXOnly(this.publicKey);
      const tweakedPublicKey = ecc.xOnlyPointAddTweak(xOnlyPubKey, t);
      if (!tweakedPublicKey || tweakedPublicKey.xOnlyPubkey === null)
        throw new Error('Cannot tweak public key!');
      const parityByte = Buffer.from([
        tweakedPublicKey.parity === 0 ? 0x02 : 0x03,
      ]);
      return fromPublicKey(
        Buffer.concat([parityByte, tweakedPublicKey.xOnlyPubkey]),
        { compressed: this.compressed },
      );
    }
    tweakFromPrivateKey(t) {
      const hasOddY =
        this.publicKey[0] === 3 ||
        (this.publicKey[0] === 4 && (this.publicKey[64] & 1) === 1);
      const privateKey = hasOddY
        ? ecc.privateNegate(this.privateKey)
        : this.privateKey;
      const tweakedPrivateKey = ecc.privateAdd(privateKey, t);
      if (!tweakedPrivateKey) throw new Error('Invalid tweaked private key!');
      return fromPrivateKey(Buffer.from(tweakedPrivateKey), {
        compressed: this.compressed,
      });
    }
  }
  return {
    isPoint,
    fromPrivateKey,
    fromPublicKey,
    fromWIF,
    makeRandom,
  };
}
exports.ECPairFactory = ECPairFactory;
