/* TOOLKIT — assets/js/core/zip.js
   window.ToolkitZip.zip([{ name, data: Uint8Array }]) → Blob. Shared by the
   tools that save several files at once (QR Batch, Favicon, images). */
(function initZip() {
  'use strict';

  /* A ZIP archive with stored (uncompressed) files: PNG is compressed
     already. Local headers, a central directory and its end record, with
     UTF-8 names (flag bit 11) and CRC-32. */
  const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    return c >>> 0;
  });
  function crc32(bytes) {
    let crc = 0xffffffff;
    for (let i = 0; i < bytes.length; i += 1) crc = CRC_TABLE[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
    return (crc ^ 0xffffffff) >>> 0;
  }
  function zip(files) {
    const encoder = new TextEncoder();
    const now = new Date();
    const time = (now.getHours() << 11) | (now.getMinutes() << 5) | (now.getSeconds() >> 1);
    const date = ((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate();
    const locals = [];
    const centrals = [];
    let offset = 0;
    for (const file of files) {
      const name = encoder.encode(file.name);
      const crc = crc32(file.data);
      const local = new DataView(new ArrayBuffer(30));
      local.setUint32(0, 0x04034b50, true); local.setUint16(4, 20, true); local.setUint16(6, 0x0800, true);
      local.setUint16(8, 0, true); local.setUint16(10, time, true); local.setUint16(12, date, true);
      local.setUint32(14, crc, true); local.setUint32(18, file.data.length, true); local.setUint32(22, file.data.length, true);
      local.setUint16(26, name.length, true); local.setUint16(28, 0, true);
      const central = new DataView(new ArrayBuffer(46));
      central.setUint32(0, 0x02014b50, true); central.setUint16(4, 20, true); central.setUint16(6, 20, true);
      central.setUint16(8, 0x0800, true); central.setUint16(10, 0, true); central.setUint16(12, time, true);
      central.setUint16(14, date, true); central.setUint32(16, crc, true); central.setUint32(20, file.data.length, true);
      central.setUint32(24, file.data.length, true); central.setUint16(28, name.length, true);
      central.setUint32(42, offset, true);
      locals.push(new Uint8Array(local.buffer), name, file.data);
      centrals.push(new Uint8Array(central.buffer), name);
      offset += 30 + name.length + file.data.length;
    }
    const size = centrals.reduce((sum, part) => sum + part.length, 0);
    const end = new DataView(new ArrayBuffer(22));
    end.setUint32(0, 0x06054b50, true); end.setUint16(8, files.length, true); end.setUint16(10, files.length, true);
    end.setUint32(12, size, true); end.setUint32(16, offset, true);
    return new Blob([...locals, ...centrals, new Uint8Array(end.buffer)], { type: 'application/zip' });
  }

  window.ToolkitZip = Object.freeze({ zip, crc32 });
}());
