"use strict";

/**
 * 小红书签名相关辅助函数（JS 版）
 *
 * 说明：
 * - 这是根据开源项目 MediaCrawler 的 Python 版 xhs_sign.py / playwright_sign.py 精简改写而来
 * - 仅保留当前主流程真正会用到的函数，避免工具代码过于臃肿
 *
 * 主要能力：
 * - 自定义 Base64 编码（平台混淆用）
 * - UTF-8 编码为字节数组
 * - CRC32 变体 mrc（用于 x-s-common 的 x9 字段）
 * - 生成 traceId（x-b3-traceid）
 * - 生成搜索用 search_id（base36）
 * - 通过 Playwright 注入调用 window.mnsv2，生成 x-s / x-s-common / x-b3-traceid 头
 * - 生成带签名的请求头（preHeadersWithPlaywright）
 */

const crypto = require("crypto");
const { URL } = require("url");

// 自定义 Base64 字符表（与 Python 版保持一致）
const BASE64_CHARS = Array.from(
  "ZmserbBoHQtNP+wOcza/LpngG8yJq42KWYj0DSfdikx3VT16IlUAFM97hECvuRX5"
);

// CRC32 查表（与 Python 版保持一致）
const CRC32_TABLE = [
  0, 1996959894, 3993919788, 2567524794, 124634137, 1886057615, 3915621685,
  2657392035, 249268274, 2044508324, 3772115230, 2547177864, 162941995,
  2125561021, 3887607047, 2428444049, 498536548, 1789927666, 4089016648,
  2227061214, 450548861, 1843258603, 4107580753, 2211677639, 325883990,
  1684777152, 4251122042, 2321926636, 335633487, 1661365465, 4195302755,
  2366115317, 997073096, 1281953886, 3579855332, 2724688242, 1006888145,
  1258607687, 3524101629, 2768942443, 901097722, 1119000684, 3686517206,
  2898065728, 853044451, 1172266101, 3705015759, 2882616665, 651767980,
  1373503546, 3369554304, 3218104598, 565507253, 1454621731, 3485111705,
  3099436303, 671266974, 1594198024, 3322730930, 2970347812, 795835527,
  1483230225, 3244367275, 3060149565, 1994146192, 31158534, 2563907772,
  4023717930, 1907459465, 112637215, 2680153253, 3904427059, 2013776290,
  251722036, 2517215374, 3775830040, 2137656763, 141376813, 2439277719,
  3865271297, 1802195444, 476864866, 2238001368, 4066508878, 1812370925,
  453092731, 2181625025, 4111451223, 1706088902, 314042704, 2344532202,
  4240017532, 1658658271, 366619977, 2362670323, 4224994405, 1303535960,
  984961486, 2747007092, 3569037538, 1256170817, 1037604311, 2765210733,
  3554079995, 1131014506, 879679996, 2909243462, 3663771856, 1141124467,
  855842277, 2852801631, 3708648649, 1342533948, 654459306, 3188396048,
  3373015174, 1466479909, 544179635, 3110523913, 3462522015, 1591671054,
  702138776, 2966460450, 3352799412, 1504918807, 783551873, 3082640443,
  3233442989, 3988292384, 2596254646, 62317068, 1957810842, 3939845945,
  2647816111, 81470997, 1943803523, 3814918930, 2489596804, 225274430,
  2053790376, 3826175755, 2466906013, 167816743, 2097651377, 4027552580,
  2265490386, 503444072, 1762050814, 4150417245, 2154129355, 426522225,
  1852507879, 4275313526, 2312317920, 282753626, 1742555852, 4189708143,
  2394877945, 397917763, 1622183637, 3604390888, 2714866558, 953729732,
  1340076626, 3518719985, 2797360999, 1068828381, 1219638859, 3624741850,
  2936675148, 906185462, 1090812512, 3747672003, 2825379669, 829329135,
  1181335161, 3412177804, 3160834842, 628085408, 1382605366, 3423369109,
  3138078467, 570562233, 1426400815, 3317316542, 2998733608, 733239954,
  1555261956, 3268935591, 3050360625, 752459403, 1541320221, 2607071920,
  3965973030, 1969922972, 40735498, 2617837225, 3943577151, 1913087877,
  83908371, 2512341634, 3803740692, 2075208622, 213261112, 2463272603,
  3855990285, 2094854071, 198958881, 2262029012, 4057260610, 1759359992,
  534414190, 2176718541, 4139329115, 1873836001, 414664567, 2282248934,
  4279200368, 1711684554, 285281116, 2405801727, 4167216745, 1634467795,
  376229701, 2685067896, 3608007406, 1308918612, 956543938, 2808555105,
  3495958263, 1231636301, 1047427035, 2932959818, 3654703836, 1088359270,
  936918000, 2847714899, 3736837829, 1202900863, 817233897, 3183342108,
  3401237130, 1404277552, 615818150, 3134207493, 3453421203, 1423857449,
  601450431, 3009837614, 3294710456, 1567103746, 711928724, 3020668471,
  3272380065, 1510334235, 755167117
];

/**
 * JavaScript 无符号右移 (>>>) 的等价实现，保持与 Python 版逻辑一致
 */
function rightShiftUnsigned(num, bit) {
  const val = (num >>> 0) >> bit;
  const MAX32INT = 0xffffffff;
  return (val + (MAX32INT + 1)) % (2 * (MAX32INT + 1)) - MAX32INT - 1;
}

/**
 * CRC32 变体，用于 x-s-common 的 x9 字段
 */
function mrc(input) {
  let o = -1;
  const len = Math.min(57, input.length);
  for (let n = 0; n < len; n++) {
    o = CRC32_TABLE[(o & 0xff) ^ input.charCodeAt(n)] ^ rightShiftUnsigned(o, 8);
  }
  return o ^ -1 ^ 3988292384;
}

/**
 * 将 24 位整数转换为 4 个 Base64 字符
 */
function tripletToBase64(e) {
  return (
    BASE64_CHARS[(e >> 18) & 63] +
    BASE64_CHARS[(e >> 12) & 63] +
    BASE64_CHARS[(e >> 6) & 63] +
    BASE64_CHARS[e & 63]
  );
}

/**
 * 编码数据块
 */
function encodeChunk(data, start, end) {
  const result = [];
  for (let i = start; i < end; i += 3) {
    const c =
      ((data[i] << 16) & 0xff0000) +
      ((data[i + 1] << 8) & 0xff00) +
      (data[i + 2] & 0xff);
    result.push(tripletToBase64(c));
  }
  return result.join("");
}

/**
 * 将字符串编码为 UTF-8 字节数组（与 Python encodeUtf8 一致）
 */
function encodeUtf8(str) {
  const encoded = encodeURIComponent(str).replace(
    /%[0-9A-F]{2}/g,
    (m) => m.toUpperCase()
  );
  const result = [];
  let i = 0;
  while (i < encoded.length) {
    const ch = encoded[i];
    if (ch === "%") {
      const hex = encoded.slice(i + 1, i + 3);
      result.push(parseInt(hex, 16));
      i += 3;
    } else {
      result.push(ch.charCodeAt(0));
      i += 1;
    }
  }
  return result;
}

/**
 * 自定义 Base64 编码
 */
function b64Encode(bytes) {
  const length = bytes.length;
  const remainder = length % 3;
  const chunks = [];
  const CHUNK_SIZE = 16383;

  let mainLength = length - remainder;
  let offset = 0;
  while (offset < mainLength) {
    const end = Math.min(offset + CHUNK_SIZE, mainLength);
    chunks.push(encodeChunk(bytes, offset, end));
    offset = end;
  }

  if (remainder === 1) {
    const a = bytes[length - 1];
    chunks.push(
      BASE64_CHARS[a >> 2] +
        BASE64_CHARS[(a << 4) & 63] +
        "=="
    );
  } else if (remainder === 2) {
    const a = (bytes[length - 2] << 8) + bytes[length - 1];
    chunks.push(
      BASE64_CHARS[a >> 10] +
        BASE64_CHARS[(a >> 4) & 63] +
        BASE64_CHARS[(a << 2) & 63] +
        "="
    );
  }

  return chunks.join("");
}

/**
 * 生成 x-b3-traceid（16 位十六进制字符串）
 */
function getB3TraceId() {
  const chars = "abcdef0123456789";
  let out = "";
  for (let i = 0; i < 16; i++) {
    out += chars[Math.floor(Math.random() * chars.length)];
  }
  return out;
}

/**
 * base36 编码 / 解码，用于生成 search_id
 */
function base36encode(number) {
  if (!Number.isInteger(number)) {
    throw new TypeError("number must be an integer");
  }
  const alphabet = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  if (number === 0) return "0";
  let sign = "";
  if (number < 0) {
    sign = "-";
    number = -number;
  }
  let result = "";
  while (number !== 0) {
    const i = number % alphabet.length;
    result = alphabet[i] + result;
    number = Math.floor(number / alphabet.length);
  }
  return sign + result;
}

function base36decode(str) {
  return parseInt(str, 36);
}

/**
 * 生成 search_id（与 Python get_search_id 等价）
 */
function getSearchId() {
  const e = BigInt(Date.now()) * (1n << 64n);
  const t = BigInt(Math.floor(Math.random() * 2147483646));
  const value = e + t;
  // BigInt 转十进制字符串，再转 base36
  return base36encode(Number(value % BigInt(Number.MAX_SAFE_INTEGER)));
}

/**
 * 计算 MD5 Hex
 */
function md5Hex(str) {
  return crypto.createHash("md5").update(str, "utf8").digest("hex");
}

/**
 * 构建待签名字符串：uri + JSON.stringify(data)
 */
function buildSignString(uri, data) {
  let c = uri;
  if (data != null) {
    if (typeof data === "object") {
      c += JSON.stringify(data);
    } else if (typeof data === "string") {
      c += data;
    }
  }
  return c;
}

/**
 * 构建 x-s 负载（XYS_ 前缀 + base64）
 */
function buildXsPayload(x3Value, dataType) {
  const payload = {
    x0: "4.2.1",
    x1: "xhs-pc-web",
    x2: "Mac OS",
    x3: x3Value,
    x4: dataType
  };
  const bytes = encodeUtf8(JSON.stringify(payload));
  return "XYS_" + b64Encode(bytes);
}

/**
 * 构建 x-s-common
 */
function buildXsCommon(a1, b1, x_s, x_t) {
  const payload = {
    s0: 3,
    s1: "",
    x0: "1",
    x1: "4.2.2",
    x2: "Mac OS",
    x3: "xhs-pc-web",
    x4: "4.74.0",
    x5: a1,
    x6: x_t,
    x7: x_s,
    x8: b1,
    x9: mrc(x_t + x_s + b1),
    x10: 154,
    x11: "normal"
  };
  const bytes = encodeUtf8(JSON.stringify(payload));
  return b64Encode(bytes);
}

/**
 * 通过 Playwright 调用 window.mnsv2
 */
async function callMnsv2(page, signStr, md5Str) {
  const signEscaped = signStr
    .replace(/\\/g, "\\\\")
    .replace(/'/g, "\\'")
    .replace(/\n/g, "\\n");
  const md5Escaped = md5Str.replace(/\\/g, "\\\\").replace(/'/g, "\\'");

  try {
    const result = await page.evaluate(
      `window.mnsv2 && window.mnsv2('${signEscaped}', '${md5Escaped}')`
    );
    return result || "";
  } catch (e) {
    console.error("[xhs-sign] callMnsv2 error:", e);
    return "";
  }
}

/**
 * 通过 Playwright 生成 x-s
 */
async function signXsWithPlaywright(page, uri, data) {
  const signStr = buildSignString(uri, data);
  const md5Str = md5Hex(signStr);
  const x3Value = await callMnsv2(page, signStr, md5Str);
  const dataType =
    typeof data === "object" && data !== null ? "object" : "string";
  return buildXsPayload(x3Value, dataType);
}

/**
 * 通过 Playwright 生成完整签名头
 */
async function signWithPlaywright(page, uri, data, a1) {
  const b1 = await page
    .evaluate("() => window.localStorage && window.localStorage.getItem('b1')")
    .catch(() => "");

  const x_s = await signXsWithPlaywright(page, uri, data);
  const x_t = String(Date.now());

  return {
    "x-s": x_s,
    "x-t": x_t,
    "x-s-common": buildXsCommon(a1 || "", b1 || "", x_s, x_t),
    "x-b3-traceid": getB3TraceId()
  };
}

/**
 * 使用 Playwright 生成签名头（等价于 Python pre_headers_with_playwright）
 */
async function preHeadersWithPlaywright(page, url, cookieDict, params, payload) {
  const a1Value = (cookieDict && cookieDict.a1) || "";

  let uri;
  try {
    const u = new URL(url, "https://www.xiaohongshu.com");
    uri = u.pathname;
  } catch {
    // 传入的可能本身就是 uri，例如 "/api/..."
    uri = url;
  }

  let data;
  if (params != null) {
    data = params;
  } else if (payload != null) {
    data = payload;
  } else {
    throw new Error("params or payload is required");
  }

  const signs = await signWithPlaywright(page, uri, data, a1Value);

  return {
    "X-S": signs["x-s"],
    "X-T": signs["x-t"],
    "x-S-Common": signs["x-s-common"],
    "X-B3-Traceid": signs["x-b3-traceid"]
  };
}

module.exports = {
  mrc,
  encodeUtf8,
  b64Encode,
  getB3TraceId,
  base36encode,
  base36decode,
  getSearchId,
  md5Hex,
  buildSignString,
  buildXsPayload,
  buildXsCommon,
  callMnsv2,
  signXsWithPlaywright,
  signWithPlaywright,
  preHeadersWithPlaywright
};


