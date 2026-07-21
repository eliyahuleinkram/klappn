// AUTO-GENERATED from @strudel/tonal ireal.mjs (the DEFAULT 'ireal' voicing
// dictionary), incl. its ^==M / +==aug / -==m aliases. These are the chord
// QUALITIES that .voicing() actually recognises; a quality NOT here collapses to
// a single fallback note (silent-ish) in the browser even though the code parses.
// So the validator hard-fails unknown qualities. e.g. valid: ^7 M7 m7 7 7sus 6 9
// 13 m7b5 o7 ; INVALID (common mistakes): maj7 min7 7sus4 sus2 dim dom add(maj).

export const CHORD_QUALITIES = new Set(["","+","-","-#5","-11","-6","-69","-7","-7b5","-9","-M7","-M9","-^7","-^9","-add9","-b6","11","13","13#11","13#9","13b9","13sus","2","5","6","69","7","7#11","7#5","7#9","7#9#11","7#9#5","7#9b5","7alt","7b13","7b13sus","7b5","7b9","7b9#11","7b9#5","7b9#9","7b9b13","7b9b5","7b9sus","7sus","7susadd3","9","9#11","9#5","9b5","9sus","M","M13","M7","M7#11","M7#5","M9","M9#11","^","^13","^7","^7#11","^7#5","^9","^9#11","add9","aug","h","h7","h9","m","m#5","m11","m6","m69","m7","m7b5","m9","m^7","m^9","madd9","mb6","o","o7","sus"]);
