/* ═══════════════════════════════════════════════════════════
   Toolkit — MD5 (RFC 1321)
   Web Crypto has no MD5, yet MD5 sums still label many downloads.
   MD5 is broken for security: the tools that use it say so and offer
   it only to compare checksums. window.ToolkitMD5.hex(bytes) returns
   the digest of a Uint8Array as 32 lowercase hex digits.
   ═══════════════════════════════════════════════════════════ */

(function initMD5() {
  'use strict';

  const SHIFTS = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
  const CONSTANTS = new Uint32Array(64).map((_, index) => Math.floor(Math.abs(Math.sin(index + 1)) * 2 ** 32) >>> 0);

  function hex(bytes) {
    const length = bytes.length;
    // Message + 0x80 + zero padding + 64-bit little-endian bit length.
    const padded = new Uint8Array((((length + 8) >> 6) + 1) * 64);
    padded.set(bytes);
    padded[length] = 0x80;
    const view = new DataView(padded.buffer);
    view.setUint32(padded.length - 8, (length * 8) >>> 0, true);
    view.setUint32(padded.length - 4, Math.floor(length / 0x20000000), true);

    let a0 = 0x67452301;
    let b0 = 0xefcdab89;
    let c0 = 0x98badcfe;
    let d0 = 0x10325476;
    const words = new Uint32Array(16);
    for (let offset = 0; offset < padded.length; offset += 64) {
      for (let index = 0; index < 16; index += 1) words[index] = view.getUint32(offset + index * 4, true);
      let a = a0;
      let b = b0;
      let c = c0;
      let d = d0;
      for (let step = 0; step < 64; step += 1) {
        let mix;
        let word;
        if (step < 16) { mix = (b & c) | (~b & d); word = step; }
        else if (step < 32) { mix = (d & b) | (~d & c); word = (5 * step + 1) % 16; }
        else if (step < 48) { mix = b ^ c ^ d; word = (3 * step + 5) % 16; }
        else { mix = c ^ (b | ~d); word = (7 * step) % 16; }
        const shift = SHIFTS[(step >> 4) * 4 + (step % 4)];
        const sum = (a + mix + CONSTANTS[step] + words[word]) >>> 0;
        a = d;
        d = c;
        c = b;
        b = (b + ((sum << shift) | (sum >>> (32 - shift)))) >>> 0;
      }
      a0 = (a0 + a) >>> 0;
      b0 = (b0 + b) >>> 0;
      c0 = (c0 + c) >>> 0;
      d0 = (d0 + d) >>> 0;
    }
    const digest = new DataView(new ArrayBuffer(16));
    [a0, b0, c0, d0].forEach((value, index) => digest.setUint32(index * 4, value, true));
    return [...new Uint8Array(digest.buffer)].map((byte) => byte.toString(16).padStart(2, '0')).join('');
  }

  window.ToolkitMD5 = Object.freeze({ hex });
}());
