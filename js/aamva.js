// Parser for the PDF417 barcode on the back of US/Canadian driver licenses and state IDs (AAMVA standard).
// Pure function so it can be unit tested. Staff always review and correct parsed fields before saving.
const CODES = { DCS:'lastName', DAC:'firstName', DAD:'middleName', DBB:'dob', DBA:'idExpiry', DBD:'issued', DAQ:'idNumber',
  DAG:'street', DAI:'city', DAJ:'state', DAK:'zip', DCG:'country', DBC:'sex', DAU:'height', DAY:'eyes', DAA:'fullName' };

const title = (s) => s.toLowerCase().replace(/(^|[\s'-])([a-z])/g, (_, a, b) => a + b.toUpperCase());

/** 8 digits -> YYYY-MM-DD. US is MMDDCCYY, Canada is CCYYMMDD; also detects by value. */
export function normDate(s, country = 'USA') {
  const d = (s || '').replace(/\D/g, '');
  if (d.length !== 8) return '';
  const ymd = country === 'CAN' || Number(d.slice(0, 2)) > 12;
  return ymd ? `${d.slice(0, 4)}-${d.slice(4, 6)}-${d.slice(6)}` : `${d.slice(4)}-${d.slice(0, 2)}-${d.slice(2, 4)}`;
}

function elementsFrom(raw) {
  const base = raw.indexOf('@'), at = raw.indexOf('ANSI ');
  if (base >= 0 && at >= 0) {
    const st = at + 5, ver = Number(raw.substr(st + 6, 2));
    let p = st + 8 + (ver >= 2 ? 2 : 0);
    const n = Number(raw.substr(p, 2)); p += 2;
    for (let i = 0; i < n; i++, p += 10) {
      const type = raw.substr(p, 2), off = Number(raw.substr(p + 2, 4)), len = Number(raw.substr(p + 6, 4));
      if ((type === 'DL' || type === 'ID') && off > 0 && len > 0) {
        let sub = raw.substr(base + off, len);
        if (/^(DL|ID)/.test(sub)) sub = sub.slice(2);
        if (/^D[A-Z]{2}/.test(sub)) return sub.split(/[\n\r]+/).filter(Boolean).map((l) => [l.slice(0, 3), l.slice(3).trim()]);
      }
    }
  }
  // Fallback: scan for known element codes anywhere (handles scanners that mangle the header).
  const out = [], re = new RegExp(`(?:^|[\\n\\r]|DL|ID)(${Object.keys(CODES).join('|')})([^\\n\\r]*)`, 'g');
  for (let m; (m = re.exec(raw));) out.push([m[1], m[2].trim()]);
  return out;
}

/** Returns { ok, fields } where fields use our own names; ok is false if nothing usable was found. */
export function parseAamva(raw) {
  const el = Object.fromEntries(elementsFrom(String(raw || '')).filter(([c]) => CODES[c]).map(([c, v]) => [CODES[c], v]));
  if (!el.lastName && !el.fullName && !el.idNumber) return { ok: false, fields: {} };
  let { lastName, firstName, middleName } = el;
  if (!lastName && el.fullName) [lastName, firstName, middleName] = el.fullName.split(/[,$]/).map((x) => x.trim());
  const country = el.country || 'USA';
  return { ok: true, fields: {
    firstName: title(firstName || ''), middleName: title((middleName || '').split(/[,\s]/)[0] || ''), lastName: title(lastName || ''),
    dob: normDate(el.dob, country), idExpiry: normDate(el.idExpiry, country), issued: normDate(el.issued, country),
    idNumber: (el.idNumber || '').trim(), street: title(el.street || ''), city: title(el.city || ''),
    state: (el.state || '').toUpperCase().slice(0, 2), zip: (el.zip || '').replace(/\D/g, '').slice(0, 5),
    sex: el.sex === '1' ? 'M' : el.sex === '2' ? 'F' : '', country,
  } };
}
