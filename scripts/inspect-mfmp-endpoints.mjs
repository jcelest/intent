const root = "https://vendor.myfloridamarketplace.com";
const html = await fetch(`${root}/search/bids/detail/17442`).then((response) => response.text());
const scripts = Array.from(html.matchAll(/<script[^>]+src="([^"]+)/g), (match) => new URL(match[1], root).toString());
console.log(JSON.stringify({ scripts }, null, 2));
for (const script of scripts) {
  const source = await fetch(script).then((response) => response.text());
  const matches = Array.from(source.matchAll(/["']([^"']*(?:bids|attachment|download)[^"']*)["']/gi), (match) => match[1]);
  if (matches.length) console.log(JSON.stringify({ script, matches: matches.slice(0, 30) }, null, 2));
  for (const needle of ["attachmentId", "BID_ATTACHMENT", "BID_DETAIL", "search/bids/detail"]) {
    const at = source.indexOf(needle);
    if (at >= 0) console.log(JSON.stringify({ needle, context: source.slice(Math.max(0, at - 500), at + 800) }, null, 2));
  }
}
for (const path of ["/mfmp/pub/search/bids/detail?id=17442", "/mfmp/bids/detail?id=17442", "/mfmp/bids/detail/attachment/download?attachmentId=42092"]) {
  const response = await fetch(`${root}${path}`, { headers: { Accept: "application/json", "User-Agent": "Intent-Opportunity-Intelligence/1.0 (+source-traceable public records)" } });
  const body = Buffer.from(await response.arrayBuffer());
  console.log(JSON.stringify({ path, status: response.status, contentType: response.headers.get("content-type"), length: body.length, first: body.subarray(0, 100).toString("utf8") }, null, 2));
}
