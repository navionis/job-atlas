import { test } from "node:test";
import assert from "node:assert/strict";
import { countries, groups, parseScope, scopeMatches, searchCountries } from "../lib/geo";
test("complete country catalog and Ethiopia aliases", () => {
  assert.equal(countries.length, 250);
  assert.equal(new Set(countries.map((c) => c.code)).size, 250);
  for (const s of ["etiopia", "ETH", "Ethiopia", "ኢትዮጵያ"]) assert(searchCountries(s).some((c) => c.code === "ET"));
});
test("Ethiopia region memberships", () => {
  for (const g of ["Africa", "Eastern Africa", "EMEA", "Worldwide"]) assert(groups[g].includes("ET"));
  for (const g of ["EU", "EEA", "APAC", "LATAM"]) assert(!groups[g].includes("ET"));
});
test("explicit country and city match", () => {
  assert(scopeMatches(parseScope("Ethiopia"), "ET"));
  assert(scopeMatches(parseScope("Addis Ababa"), "ET"));
  assert(!scopeMatches(parseScope("United States"), "ET"));
});
test("remote is not worldwide", () => {
  assert(parseScope("Remote").unknown);
  assert(!scopeMatches(parseScope("Remote"), "ET"));
  assert(scopeMatches(parseScope("Worldwide"), "ET"));
});
test("group restrictions and unknown ambiguity", () => {
  assert(scopeMatches(parseScope("EMEA"), "ET"));
  assert(!scopeMatches(parseScope("EU"), "ET"));
  assert(!scopeMatches(parseScope("Worldwide except Ethiopia"), "ET"));
  assert(!scopeMatches(parseScope("EMEA UTC+2 only"), "ET"));
  assert(parseScope("Anywhere except US").uncertain);
});
test("country codes do not match substrings", () => {
  assert(!parseScope("Join us remotely").countries.includes("US"));
  assert(!parseScope("San Francisco, CA, US").countries.includes("CA"));
  assert(parseScope("San Francisco, CA, US").countries.includes("US"));
  assert(!parseScope("Indiana").countries.includes("IN"));
});
test("no Congo country collision", () => {
  assert(!parseScope("Democratic Republic of the Congo").countries.includes("CG"));
  assert(parseScope("Democratic Republic of the Congo").countries.includes("CD"));
});
test("empty scope stays unknown", () => assert(parseScope("").unknown));

test("South Africa is not all Africa; Eastern Europe is not all Europe", () => {
  assert(!scopeMatches(parseScope("South Africa"), "ET"));
  assert(scopeMatches(parseScope("South Africa"), "ZA"));
  assert(!scopeMatches(parseScope("Eastern Europe"), "GB"));
  assert(scopeMatches(parseScope("Eastern Europe"), "UA"));
});

test("longer country names do not match a different country", () => {
  assert.deepEqual(parseScope("South Sudan").countries, ["SS"]);
  assert.deepEqual(parseScope("Equatorial Guinea").countries, ["GQ"]);
  assert.deepEqual(parseScope("United States Minor Outlying Islands").countries, ["UM"]);
  assert.deepEqual(new Set(parseScope("Guinea; Guinea-Bissau").countries), new Set(["GN", "GW"]));
});
